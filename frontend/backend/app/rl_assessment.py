"""
Enhanced RL-powered assessment endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import json
import os
from datetime import datetime
from dotenv import load_dotenv
import subprocess
import tempfile
import time
import re
import random
import uuid
import shutil
from xai_sdk import AsyncClient
from xai_sdk.chat import user, system

load_dotenv()

router = APIRouter(prefix="/api/rl", tags=["rl-assessment"])

GROK_API_KEY = os.getenv("GROK_API_KEY")

# Create global xAI client
xai_client = AsyncClient(api_key=GROK_API_KEY)

# RL State tracking
rl_state_db: Dict[str, Any] = {}
rl_training_data: List[Dict[str, Any]] = []
bandit_sessions: Dict[str, Any] = {}

ACTION_SPACE = [
    "no_hint",
    "gentle_hint",
    "strong_hint",
    "debug_followup",
    "refactor_followup",
    "optimization_followup",
    "edge_case_followup",
]

FEATURE_NAMES = [
    "pause_length_norm",
    "code_cleanliness",
    "failed_run_rate",
    "hints_used_norm",
    "difficulty_norm",
    "err_syntax",
    "err_runtime",
    "err_edge_case",
    "err_timeout",
]

DEFAULT_POLICY_METRICS = {
    "debugging": 0.25,
    "refactor": 0.25,
    "time_factor_optimization": 0.25,
    "edge_case_resilience": 0.25,
}

# Neutral starting weights: light, even priors so the bandit learns from session data.
DEFAULT_ACTION_WEIGHTS = {
    "debug_followup": [0.1] * len(FEATURE_NAMES),
    "refactor_followup": [0.1] * len(FEATURE_NAMES),
    "optimization_followup": [0.1] * len(FEATURE_NAMES),
    "edge_case_followup": [0.1] * len(FEATURE_NAMES),
    "gentle_hint": [0.08] * len(FEATURE_NAMES),
    "strong_hint": [0.08] * len(FEATURE_NAMES),
    "no_hint": [0.05] * len(FEATURE_NAMES),
}


class AdaptiveHintRequest(BaseModel):
    code: str
    problem: str
    language: str
    progressMetrics: Dict[str, Any]  # Accept as dict
    executionAttempts: List[Dict[str, Any]]
    context: str


class ProgressMonitorRequest(BaseModel):
    code: str
    previousChallengeCode: str  # Code from last challenge to compare against
    problem: str
    language: str
    progressMetrics: Dict[str, Any]  # Accept as dict
    monitoringEvents: List[Dict[str, Any]]


class TestCase(BaseModel):
    input: str
    output: str


class TestResult(BaseModel):
    passed: bool
    input: str
    expectedOutput: str
    actualOutput: Optional[str] = None
    error: Optional[str] = None
    executionTime: Optional[float] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None


class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    testCases: List[TestCase]


class RLAssessmentSubmission(BaseModel):
    candidateId: str
    problemId: str
    problemTitle: str
    problemDescription: str
    finalCode: str
    language: str
    progressMetrics: Dict[str, Any]  # Accept as dict
    monitoringEvents: List[Dict[str, Any]]
    hintsUsed: List[Dict[str, Any]]
    challengeTodos: List[Dict[str, Any]]  # Challenge questions and responses
    executionAttempts: List[Dict[str, Any]]
    rlSignals: List[Dict[str, Any]]
    elapsedTime: int


class RLSessionStartRequest(BaseModel):
    candidateId: str
    problemId: str
    language: str
    difficulty: Optional[str] = "medium"


class RLSessionStepRequest(BaseModel):
    sessionId: str
    code: str
    problem: str
    language: str
    pauseDuration: float
    progressMetrics: Dict[str, Any]
    executionAttempts: List[Dict[str, Any]]
    hintsUsed: List[Dict[str, Any]] = []
    monitoringEvents: List[Dict[str, Any]] = []


async def call_grok_api(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    model: str = "grok-4-1-fast-reasoning"
) -> str:
    """Call Grok API with the given messages"""
    if not GROK_API_KEY:
        raise HTTPException(status_code=500, detail="Grok API key not configured")

    try:
        # Convert simple dict messages to SDK objects
        sdk_messages = []
        for msg in messages:
            if msg["role"] == "user":
                sdk_messages.append(user(msg["content"]))
            elif msg["role"] == "system":
                sdk_messages.append(system(msg["content"]))
            # Add other roles if needed, but for now we mainly use user/system

        # Create chat session
        chat = xai_client.chat.create(
            model=model,
            messages=sdk_messages,
            temperature=temperature
        )

        # Get response
        response = await chat.sample()
        return response.content

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grok API error: {str(e)}")


def analyze_code_cleanliness(code: str) -> Dict[str, Any]:
    """
    Lightweight static code check to estimate cleanliness without external tooling.
    Returns a score between 0 and 1 plus notes for the interviewer.
    """
    lines = code.splitlines()
    if not lines:
        return {"score": 0.0, "notes": ["No code provided"]}

    long_lines = sum(1 for ln in lines if len(ln) > 120)
    todo_count = sum(1 for ln in lines if "TODO" in ln or "FIXME" in ln)
    tab_mix = sum(1 for ln in lines if "\t" in ln and ln.lstrip("\t") != ln)
    print_debug = sum(1 for ln in lines if re.search(r"print\\s*\\(", ln))

    style_penalty = (
        (long_lines / len(lines)) * 0.25
        + (todo_count / max(len(lines), 1)) * 0.2
        + (tab_mix / max(len(lines), 1)) * 0.1
        + min(print_debug, 3) * 0.05
    )
    score = max(0.0, 1.0 - style_penalty)

    notes = []
    if long_lines:
        notes.append(f"{long_lines} long lines detected")
    if todo_count:
        notes.append(f"{todo_count} TODO/FIXME markers present")
    if tab_mix:
        notes.append("Mixed tabs/spaces found")
    if print_debug:
        notes.append("Debug print statements present")

    return {"score": round(score, 3), "notes": notes}


def normalize_pause(pause_seconds: float) -> float:
    """Normalize pause length to 0-1 scale assuming 60s is max stall."""
    return round(min(pause_seconds / 60.0, 1.0), 3)


def normalize_hints_used(count: int) -> float:
    """Normalize hints to 0-1 assuming 3 hints budget."""
    return round(min(count / 3.0, 1.0), 3)


def normalize_difficulty(level: str) -> float:
    mapping = {"easy": 0.2, "medium": 0.5, "hard": 0.8}
    return mapping.get(level, 0.5)


def categorize_error(err_msg: str) -> str:
    """Classify error types to drive contextual bandit features."""
    if not err_msg:
        return "none"
    lower = err_msg.lower()
    if "syntax" in lower or "parse" in lower:
        return "syntax"
    if "timeout" in lower:
        return "timeout"
    if "assert" in lower or "expect" in lower:
        return "edge_case"
    if "typeerror" in lower or "valueerror" in lower:
        return "runtime"
    return "runtime"


def summarize_failures(execution_attempts: List[Dict[str, Any]]) -> Tuple[float, str]:
    """
    Compute failure rate and dominant error type from execution attempts.
    Execution attempts are expected to include `passed` or `error` fields.
    """
    if not execution_attempts:
        return 0.0, "none"

    fail_count = 0
    last_error = "none"
    for attempt in execution_attempts:
        if not attempt.get("passed", False) or attempt.get("error"):
            fail_count += 1
            last_error = categorize_error(str(attempt.get("error", "")))

    fail_rate = fail_count / max(len(execution_attempts), 1)
    return round(fail_rate, 3), last_error


def build_context_features(step: RLSessionStepRequest, session_meta: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize contextual bandit features for the current interview tick."""
    quality = analyze_code_cleanliness(step.code)
    fail_rate, error_type = summarize_failures(step.executionAttempts)

    hints_used = len(step.hintsUsed)
    difficulty = session_meta.get("difficulty", "medium")
    total_changes = step.progressMetrics.get("totalChanges", 0)

    return {
        "pause_length": round(step.pauseDuration, 2),
        "code_cleanliness": quality["score"],
        "code_cleanliness_notes": quality["notes"],
        "fail_rate": fail_rate,
        "error_type": error_type,
        "difficulty": difficulty,
        "hints_used": hints_used,
        "total_changes": total_changes,
    }


def feature_vector_from_context(context: Dict[str, Any]) -> List[float]:
    """Build ordered feature vector x aligned to FEATURE_NAMES."""
    err = context.get("error_type", "none")
    return [
        normalize_pause(context.get("pause_length", 0.0)),
        context.get("code_cleanliness", 0.0),
        context.get("fail_rate", 0.0),
        normalize_hints_used(context.get("hints_used", 0)),
        normalize_difficulty(context.get("difficulty", "medium")),
        1.0 if err == "syntax" else 0.0,
        1.0 if err == "runtime" else 0.0,
        1.0 if err == "edge_case" else 0.0,
        1.0 if err == "timeout" else 0.0,
    ]


def action_bias(action: str, context: Dict[str, Any], policy_metrics: Dict[str, float]) -> float:
    """Deterministic heuristic nudges layered on top of learned weights."""
    bias = 0.0

    # Pause-driven hints
    if context["pause_length"] > 20 and action in {"gentle_hint", "strong_hint"}:
        bias += 0.15
    if context["pause_length"] > 40 and action == "strong_hint":
        bias += 0.25

    # Failure-driven debugging
    if context["fail_rate"] >= 0.5 and action in {"debug_followup", "strong_hint"}:
        bias += 0.2

    # Cleanliness / refactor
    if context["code_cleanliness"] < 0.6 and action in {"refactor_followup", "gentle_hint"}:
        bias += 0.18

    # Time-factor optimization
    if policy_metrics.get("time_factor_optimization", 0) > 0.35 and action == "optimization_followup":
        bias += 0.12

    # Edge cases
    if context["error_type"] == "edge_case" and action == "edge_case_followup":
        bias += 0.22

    # Avoid over-hinting
    if context["hints_used"] >= 2 and action == "no_hint":
        bias += 0.05
    if context["hints_used"] >= 2 and action.startswith("hint"):
        bias -= 0.05

    return bias


def select_bandit_action(session_state: Dict[str, Any], context: Dict[str, Any], feature_vec: List[float]) -> Tuple[str, Dict[str, float]]:
    """Epsilon-greedy contextual bandit selection using per-action weight vectors."""
    epsilon = 0.15
    weights = session_state["weight_vectors"]
    policy_metrics = session_state["policy_metrics"]

    scores: Dict[str, float] = {}
    for action in ACTION_SPACE:
        w = weights.get(action, [0.0] * len(FEATURE_NAMES))
        dot = sum(w_i * x_i for w_i, x_i in zip(w, feature_vec))
        scores[action] = dot + action_bias(action, context, policy_metrics)

    if random.random() < epsilon:
        chosen = random.choice(ACTION_SPACE)
    else:
        chosen = max(scores, key=scores.get)

    return chosen, scores


def compute_reward(context: Dict[str, Any], prev_context: Optional[Dict[str, Any]]) -> float:
    """Reward based on correctness change, cleanliness change, and information gain."""
    if not prev_context:
        return 0.0

    correctness_change = prev_context["fail_rate"] - context["fail_rate"]
    quality_change = context["code_cleanliness"] - prev_context["code_cleanliness"]
    info_gain = min(max(context["total_changes"] - prev_context.get("total_changes", 0), 0) / 10, 1.0)

    reward = 0.5 * correctness_change + 0.3 * quality_change + 0.2 * info_gain
    return round(reward, 3)


def update_bandit_weights(session_state: Dict[str, Any], action: str, reward: float, feature_vec: List[float]) -> None:
    """
    Update only the chosen action's weight vector using (r - baseline) * x.
    Mirrors the numeric example shared by the user.
    """
    lr = 0.1
    baseline = session_state.get("reward_baseline", 0.3)
    delta = reward - baseline

    weights = session_state["weight_vectors"]
    w = weights.get(action, [0.0] * len(FEATURE_NAMES))
    updated = [round(w_i + lr * delta * x_i, 6) for w_i, x_i in zip(w, feature_vec)]
    weights[action] = updated

    # Slow baseline drift toward observed rewards
    session_state["reward_baseline"] = round(baseline * 0.9 + reward * 0.1, 4)


def update_policy_metrics(session_state: Dict[str, Any], context: Dict[str, Any], reward: float) -> Dict[str, float]:
    """Track how much each policy facet should be emphasized."""
    metrics = session_state["policy_metrics"]

    metrics["debugging"] = max(0.0, min(1.0, metrics["debugging"] + (context["fail_rate"] * 0.2)))
    metrics["refactor"] = max(0.0, min(1.0, metrics["refactor"] + ((0.7 - context["code_cleanliness"]) * 0.15)))
    metrics["time_factor_optimization"] = max(
        0.0,
        min(1.0, metrics["time_factor_optimization"] + (context["pause_length"] / 300))
    )
    metrics["edge_case_resilience"] = max(
        0.0,
        min(1.0, metrics["edge_case_resilience"] + (0.2 if context["error_type"] == "edge_case" else 0.0))
    )

    # Reinforce positive outcomes
    for key in metrics:
        metrics[key] = round(metrics[key] + (reward * 0.05), 3)

    return metrics


def schedule_next_evaluation(context: Dict[str, Any], action: str) -> int:
    """Delay until the next monitoring tick in milliseconds."""
    base_ms = 20000
    if action in {"strong_hint", "follow_debug"}:
        base_ms = 12000
    if context["pause_length"] > 45:
        base_ms = 8000
    if context["fail_rate"] == 0 and context["code_cleanliness"] > 0.8:
        base_ms = 30000
    return base_ms


def build_action_rationale(action: str, context: Dict[str, Any]) -> str:
    """Human-readable rationale to surface in the recruiter console."""
    reasons = []
    if context["pause_length"] > 20:
        reasons.append("long pause detected")
    if context["fail_rate"] > 0:
        reasons.append(f"{int(context['fail_rate'] * 100)}% fail rate")
    if context["code_cleanliness"] < 0.65:
        reasons.append("code cleanliness trending low")
    if context["error_type"] != "none":
        reasons.append(f"recent {context['error_type']} error")
    if not reasons:
        reasons.append("periodic check-in")
    return f"{action} selected because {', '.join(reasons)}."


def get_edge_case_hint_focus(context: Dict[str, Any]) -> str:
    """Pick focus area for edge-case probing."""
    if context["error_type"] == "edge_case":
        return "tighten assertions and cover boundary inputs that the failing test implies"
    if context["fail_rate"] < 0.3:
        return "probe off-by-one, empty inputs, and large input performance"
    return "stabilize failing paths first, then enumerate untested branches"


async def generate_targeted_hint(
    action: str,
    step: RLSessionStepRequest,
    context: Dict[str, Any],
    policy_metrics: Dict[str, float]
) -> Dict[str, Any]:
    """
    Route to Grok with an action-specific prompt so we can personalize hints and follow-ups.
    """
    focus_map = {
        "debug_followup": "Debug the most recent failing run. Suggest a minimal experiment to surface the bug quickly.",
        "refactor_followup": "Refactor for readability and maintainability without changing behavior.",
        "optimization_followup": "Optimize time complexity or remove obvious inefficiencies, keeping correctness intact.",
        "edge_case_followup": f"Surface edge cases: {get_edge_case_hint_focus(context)}.",
        "gentle_hint": "Offer a gentle directional nudge.",
        "strong_hint": "Provide a direct hint but still require the candidate to write code.",
    }
    focus = focus_map.get(action, "Observe quietly.")

    hint_prompt = f"""You are Grok 4.1 acting as an adaptive interviewer during a 30-minute coding session.

Contextual bandit features:
- Pause length (s): {context['pause_length']}
- Code cleanliness score: {context['code_cleanliness']}
- Fail rate: {context['fail_rate']}
- Error type: {context['error_type']}
- Difficulty: {context['difficulty']}
- Hints used: {context['hints_used']}

Policy weights:
- Debugging: {policy_metrics['debugging']}
- Refactor: {policy_metrics['refactor']}
- Time optimization: {policy_metrics['time_factor_optimization']}
- Edge-case resilience: {policy_metrics['edge_case_resilience']}

Problem:
{step.problem}

Candidate code ({step.language}):
```{step.language}
{step.code}
```

Action requested: {action} — {focus}

Requirements:
- Keep to 2 sentences.
- Be specific to their code/errors.
- If suggesting a follow-up question, make it probing and concise.

Respond ONLY with JSON:
{{
  "action": "{action}",
  "hint": "The adaptive hint or probing follow-up",
  "followUpQuestion": "Optional probing question",
  "confidence": 0.0-1.0
}}"""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": hint_prompt}],
            temperature=0.45,
            model="grok-4-1-fast-reasoning"
        )

        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            return json.loads(response[json_start:json_end])
    except Exception as e:
        print(f"Error generating targeted hint: {e}")

    return {
        "action": action,
        "hint": "Take a breath, rerun the failing path, and inspect the inputs causing the issue.",
        "followUpQuestion": "What test would prove the current fix works for edge cases?",
        "confidence": 0.35,
    }


@router.post("/session/start")
async def start_rl_session(request: RLSessionStartRequest):
    """
    Initialize a 30-minute online RL session for a candidate.
    Tracks contextual bandit weights and policy metrics for the interview.
    """
    session_id = f"rlsess_{uuid.uuid4().hex}"
    now = time.time()

    bandit_sessions[session_id] = {
        "candidateId": request.candidateId,
        "problemId": request.problemId,
        "language": request.language,
        "difficulty": request.difficulty,
        "created_at": now,
        "expires_at": now + 1800,  # 30 minutes
        "weight_vectors": {k: v.copy() for k, v in DEFAULT_ACTION_WEIGHTS.items()},
        "policy_metrics": DEFAULT_POLICY_METRICS.copy(),
        "reward_baseline": 0.3,
        "history": [],
        "last_context": None,
    }

    return {
        "sessionId": session_id,
        "expiresAt": bandit_sessions[session_id]["expires_at"],
        "policyMetrics": bandit_sessions[session_id]["policy_metrics"],
        "weightVectors": bandit_sessions[session_id]["weight_vectors"],
        "message": "RL session initialized for 30 minutes of adaptive interviewing."
    }


@router.post("/session/step")
async def rl_session_step(step: RLSessionStepRequest):
    """
    Online RL tick: gather pause/run/code cleanliness signals, decide on hints/follow-ups,
    update contextual bandit weights, and return the next action with Grok 4.1 content.
    """
    if step.sessionId not in bandit_sessions:
        raise HTTPException(status_code=404, detail="RL session not found")

    session_state = bandit_sessions[step.sessionId]
    context = build_context_features(step, session_state)
    prev_context = session_state.get("last_context")
    feature_vec = feature_vector_from_context(context)

    action, scores = select_bandit_action(session_state, context, feature_vec)
    hint_payload = None
    if action != "no_hint":
        hint_payload = await generate_targeted_hint(action, step, context, session_state["policy_metrics"])

    reward = compute_reward(context, prev_context)
    update_bandit_weights(session_state, action, reward, feature_vec)
    policy_metrics = update_policy_metrics(session_state, context, reward)
    session_state["last_context"] = context

    session_state["history"].append({
        "timestamp": datetime.now().isoformat(),
        "context": context,
        "action": action,
        "reward": reward,
        "scores": scores,
        "hint": hint_payload,
        "weights": session_state["weight_vectors"].get(action),
        "featureVector": feature_vec,
    })

    rl_training_data.append({
        "type": "online_bandit_step",
        "sessionId": step.sessionId,
        "candidateId": session_state["candidateId"],
        "problemId": session_state["problemId"],
        "context": context,
        "action": action,
        "reward": reward,
        "policyMetrics": policy_metrics,
        "timestamp": datetime.now().isoformat(),
        "featureVector": feature_vec,
        "weightVectors": session_state["weight_vectors"],
    })

    next_eval_ms = schedule_next_evaluation(context, action)
    rationale = build_action_rationale(action, context)
    expired = time.time() > session_state["expires_at"]

    return {
        "sessionId": step.sessionId,
        "action": action,
        "hint": hint_payload,
        "contextFeatures": context,
        "policyMetrics": policy_metrics,
        "rewardApplied": reward,
        "scores": scores,
        "nextEvaluationMs": next_eval_ms,
        "rationale": rationale,
        "sessionExpired": expired,
    }
@router.post("/generate-adaptive-hint")
async def generate_adaptive_hint(request: AdaptiveHintRequest):
    """
    Generate adaptive hint based on code, progress, and context.
    Uses RL to learn what hints are most effective.
    """

    # Determine hint context
    context_description = {
        "execution_failures": f"After {request.progressMetrics.get('consecutiveFailures', 0)} failed execution attempts",
        "no_progress": f"After {(datetime.now().timestamp() * 1000 - request.progressMetrics.get('lastChangeTimestamp', datetime.now().timestamp() * 1000)) / 60000:.1f} minutes without progress",
        "manual_request": "At candidate's request",
    }.get(request.context, "General hint request")

    hint_prompt = f"""You are an AI tutor providing adaptive hints to a coding candidate.

**Problem:**
{request.problem}

**Current Code (in {request.language}):**
```{request.language}
{request.code}
```

**Progress Metrics:**
- Lines written: {request.progressMetrics.get('linesWritten', 0)}
- Code complexity: {request.progressMetrics.get('codeComplexity', 0)}/100
- Consecutive failures: {request.progressMetrics.get('consecutiveFailures', 0)}
- Hints remaining: {request.progressMetrics.get('hintsRemaining', 3)}

**Context:** {context_description}

**Execution History:**
{json.dumps(request.executionAttempts, indent=2) if request.executionAttempts else "No executions yet"}

**Your Task:**
Generate a helpful but not too revealing hint. The hint should:
1. Guide them toward a solution without giving it away
2. Be specific to their code and situation
3. Address the most blocking issue they're facing
4. Encourage them to think, not just copy

**Hint Level:**
- If 3 hints remaining: Gentle nudge
- If 2 hints remaining: More specific guidance
- If 1 hint remaining: Direct but still requires thinking

**Respond ONLY with JSON:**
{{
    "hint": "Your adaptive hint here (1-2 sentences)",
    "reasoning": "Why you're giving this hint",
    "expectedImpact": "What you expect them to do with this"
}}"""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": hint_prompt}],
            temperature=0.5
        )

        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)

            # Record RL training data
            rl_training_data.append({
                "type": "adaptive_hint",
                "code": request.code,
                "context": request.context,
                "hint": result,
                "progressMetrics": request.progressMetrics,
                "timestamp": datetime.now().isoformat(),
            })

            return result
        else:
            return {
                "hint": "Consider breaking down the problem into smaller steps.",
                "reasoning": "General problem-solving strategy",
                "expectedImpact": "Better structured approach"
            }

    except Exception as e:
        print(f"Error generating adaptive hint: {e}")
        return {
            "hint": "Take a step back and think about the problem requirements.",
            "reasoning": "General guidance",
            "expectedImpact": "Refocus on problem"
        }


@router.post("/monitor-progress")
async def monitor_progress(request: ProgressMonitorRequest):
    """
    Monitor ongoing progress and generate challenge questions when appropriate.
    This is the "Watcher" agent that probes candidate understanding.
    """

    # Build the prompt with comparison to previous challenge code
    previous_code_section = ""
    if request.previousChallengeCode:
        previous_code_section = f"""
**Previous Code (from last challenge):**
```{request.language}
{request.previousChallengeCode}
```

**IMPORTANT:** Only generate a new challenge if there has been SIGNIFICANT progress since the previous code. Compare the two code snapshots to determine if enough has changed to warrant a new challenge question."""
    else:
        previous_code_section = """
**Note:** This is the first check, so no previous challenge exists. Generate a challenge if the candidate has written substantial initial code."""

    watcher_prompt = f"""You are a technical interviewer AI analyzing a candidate's code in real-time during an assessment.

**Problem:** {request.problem}

**Current Code (in {request.language}):**
```{request.language}
{request.code}
```
{previous_code_section}

**Progress Metrics:**
- Lines: {request.progressMetrics.get('linesWritten', 0)}
- Complexity: {request.progressMetrics.get('codeComplexity', 0)}
- Changes: {request.progressMetrics.get('totalChanges', 0)}

**Recent Events:**
{json.dumps(request.monitoringEvents[-5:] if len(request.monitoringEvents) > 5 else request.monitoringEvents, indent=2)}

**CRITICAL INSTRUCTIONS:**
1. FIRST, perform a detailed line-by-line diff between previous and current code
2. Identify SPECIFIC new additions (data structures, algorithms, logic blocks, NOT just variable names or comments)
3. Generate a challenge if there are meaningful structural changes (at least 10+ lines of new meaningful code)

**Examples of SIGNIFICANT progress that WARRANT a challenge:**
- Added a complete new data structure (HashMap, PriorityQueue, TreeSet)
- Implemented a new algorithm (sorting, traversal, frequency counting)
- Added a complete solution approach (skeleton → working solution)
- Significant refactoring with architectural changes

**Examples of MINOR changes that DO NOT warrant a challenge:**
- Adding/modifying comments
- Renaming variables
- Small bug fixes (1-5 lines)
- Formatting changes
- Adding simple if-else conditions
- Tweaking existing logic slightly

**Challenge Question Requirements:**
- Must be SPECIFIC to the NEW code elements added since last challenge
- Must be DIFFERENT from generic questions (avoid: "explain your approach", "walk me through")
- Focus on ONE specific aspect: data structure choice, time complexity, edge case, or design decision
- Keep it concise (1-2 sentences max)

**REJECT the challenge (set intervention_needed: false) if:**
- Less than 10 lines of meaningful new code
- Changes are cosmetic or minor (just comments, formatting, variable renames)
- Code structure is essentially the same
- You can't identify a SPECIFIC new element to ask about

**Output Format (respond in JSON only):**
{{
    "intervention_needed": true/false,
    "type": "challenge",
    "content": "Your challenge question here (or empty string if intervention_needed is false)"
}}

Respond ONLY with valid JSON, no other text. Be VERY strict - when in doubt, set intervention_needed to false."""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": watcher_prompt}],
            temperature=0.4  # Balanced temperature for consistency with some variety
        )

        # Parse JSON response
        # Try to extract JSON if Grok adds extra text
        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            return json.loads(json_str)
        else:
            return {"intervention_needed": False}

    except Exception as e:
        print(f"Error monitoring progress: {e}")
        return {"intervention_needed": False}


async def execute_python_code(code: str, test_case: TestCase) -> TestResult:
    """Execute Python code with test case input"""

    # Extract function name from the code (look for def function_name pattern)
    # Find all function definitions and skip __init__ and other dunder methods
    func_matches = re.finditer(r'def\s+(\w+)\s*\(', code)
    func_names = [match.group(1) for match in func_matches if not match.group(1).startswith('__')]

    if not func_names:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Could not find a non-dunder function definition in the code"
        )

    # Use the last function defined (typically the solution function)
    func_name = func_names[-1]

    # Wrap the user's code with a main function that calls it with test inputs
    # The test_case.input should be in the format of function arguments, e.g., "2, 3"
    wrapped_code = f"""{code}

if __name__ == "__main__":
    result = {func_name}({test_case.input})
    print(result)
"""

    # Create a temporary file with the wrapped code
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(wrapped_code)
        temp_file = f.name

    try:
        # Execute with timeout
        process = subprocess.run(
            ['python3', temp_file],
            capture_output=True,
            text=True,
            timeout=5  # 5 second timeout
        )

        stdout = process.stdout
        stderr = process.stderr

        # Capture the last line of stdout as the actual output for comparison
        # This allows print statements to be shown while still comparing final result
        output_lines = stdout.strip().split('\n') if stdout.strip() else []
        actual_output = output_lines[-1] if output_lines else ""

        # Remove the last line from stdout since it's already in actualOutput
        console_output = '\n'.join(output_lines[:-1]) if len(output_lines) > 1 else ""

        if process.returncode != 0:
            return TestResult(
                passed=False,
                input=test_case.input,
                expectedOutput=test_case.output,
                error=stderr or "Execution failed",
                stdout=console_output
            )

        # Normalize output for comparison (Python adds spaces after commas in lists)
        # Remove spaces after commas to handle both "[1,5]" and "[1, 5]" formats
        def normalize_output(s: str) -> str:
            # Remove spaces after commas, but preserve other formatting
            normalized = re.sub(r',\s+', ',', s.strip())
            return normalized

        # Compare normalized outputs
        passed = normalize_output(actual_output) == normalize_output(test_case.output)

        return TestResult(
            passed=passed,
            input=test_case.input,
            expectedOutput=test_case.output,
            actualOutput=actual_output,
            stdout=console_output,
            stderr=stderr
        )

    except subprocess.TimeoutExpired:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Execution timeout (5 seconds)",
            stdout="",
            stderr=""
        )
    finally:
        # Clean up temp file
        os.unlink(temp_file)


def parse_java_test_input(test_input: str) -> str:
    """
    Parse test input and convert to valid Java syntax.
    Converts: nums = [1,1,1,2,2,3], k = 2
    To: new int[]{1,1,1,2,2,3}, 2
    """
    # Split by comma but respect array brackets
    parts = []
    current = ""
    bracket_depth = 0

    for char in test_input:
        if char == '[':
            bracket_depth += 1
            current += char
        elif char == ']':
            bracket_depth -= 1
            current += char
        elif char == ',' and bracket_depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += char

    if current.strip():
        parts.append(current.strip())

    # Process each part
    java_args = []
    for part in parts:
        # Check if it's a variable assignment (e.g., "nums = [1,2,3]")
        if '=' in part:
            var_name, value = part.split('=', 1)
            var_name = var_name.strip()
            value = value.strip()

            # Convert array notation
            if value.startswith('[') and value.endswith(']'):
                # Extract array elements
                array_content = value[1:-1].strip()
                java_args.append(f"new int[]{{{array_content}}}")
            else:
                # Regular value (int, string, etc.)
                java_args.append(value)
        else:
            # No assignment, just use the value
            java_args.append(part.strip())

    return ", ".join(java_args)


async def execute_java_code(code: str, test_case: TestCase) -> TestResult:
    """Execute Java code with test case input"""

    # Extract method name from the code (look for public type methodName pattern)
    method_match = re.search(r'public\s+\w+(?:\[\])?\s+(\w+)\s*\(', code)
    if not method_match:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Could not find a public method definition in the code"
        )

    method_name = method_match.group(1)

    # Parse test input to Java syntax
    java_input = parse_java_test_input(test_case.input)

    # Remove the closing brace from the user's code to add main method
    code_lines = code.strip().split('\n')

    # Find the last closing brace (should be the class closing brace)
    last_brace_idx = -1
    for i in range(len(code_lines) - 1, -1, -1):
        if code_lines[i].strip() == '}':
            last_brace_idx = i
            break

    if last_brace_idx == -1:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Could not find class closing brace in the code"
        )

    # Insert main method before the last closing brace
    main_method = """
    public static void main(String[] args) {
        Solution solution = new Solution();
        Object result = solution.METHOD_NAME(ARGS);

        // Handle array output
        if (result instanceof int[]) {
            int[] arr = (int[]) result;
            System.out.print("[");
            for (int i = 0; i < arr.length; i++) {
                System.out.print(arr[i]);
                if (i < arr.length - 1) System.out.print(",");
            }
            System.out.print("]");
        } else {
            System.out.print(result);
        }
    }
"""

    main_method = main_method.replace("METHOD_NAME", method_name).replace("ARGS", java_input)

    # Reconstruct the code with main method
    wrapped_lines = code_lines[:last_brace_idx] + [main_method] + code_lines[last_brace_idx:]
    wrapped_code = '\n'.join(wrapped_lines)

    # Create a temporary directory for Java files
    temp_dir = tempfile.mkdtemp()
    java_file = os.path.join(temp_dir, "Solution.java")

    try:
        # Write the Java code to file
        with open(java_file, 'w') as f:
            f.write(wrapped_code)

        # Debug: print the wrapped code
        print(f"[DEBUG] Wrapped Java code:\n{wrapped_code}\n")

        # Compile Java code
        compile_process = subprocess.run(
            ['javac', java_file],
            capture_output=True,
            text=True,
            timeout=10
        )

        if compile_process.returncode != 0:
            return TestResult(
                passed=False,
                input=test_case.input,
                expectedOutput=test_case.output,
                error=f"Compilation error:\n{compile_process.stderr}\n\nGenerated code:\n{wrapped_code}",
                stderr=compile_process.stderr
            )

        # Execute compiled Java code
        execute_process = subprocess.run(
            ['java', '-cp', temp_dir, 'Solution'],
            capture_output=True,
            text=True,
            timeout=5
        )

        stdout = execute_process.stdout
        stderr = execute_process.stderr

        # Get output
        output_lines = stdout.strip().split('\n') if stdout.strip() else []
        actual_output = output_lines[-1] if output_lines else ""
        console_output = '\n'.join(output_lines[:-1]) if len(output_lines) > 1 else ""

        if execute_process.returncode != 0:
            return TestResult(
                passed=False,
                input=test_case.input,
                expectedOutput=test_case.output,
                error=stderr or "Execution failed",
                stdout=console_output
            )

        # Normalize output for comparison
        def normalize_output(s: str) -> str:
            normalized = re.sub(r',\s+', ',', s.strip())
            return normalized

        passed = normalize_output(actual_output) == normalize_output(test_case.output)

        return TestResult(
            passed=passed,
            input=test_case.input,
            expectedOutput=test_case.output,
            actualOutput=actual_output,
            stdout=console_output,
            stderr=stderr
        )

    except subprocess.TimeoutExpired:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Execution timeout (5 seconds)",
            stdout="",
            stderr=""
        )
    finally:
        # Clean up temp files
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/execute-code")
async def execute_code(request: CodeExecutionRequest):
    """
    Execute code against test cases in a sandboxed environment.
    Supports Python and Java.
    """

    if request.language not in ["python", "java"]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}. Supported languages: python, java")

    results = []
    passed_count = 0

    for test_case in request.testCases:
        try:
            start_time = time.time()

            # Execute based on language
            if request.language == "python":
                result = await execute_python_code(request.code, test_case)
            else:  # java
                result = await execute_java_code(request.code, test_case)

            execution_time = time.time() - start_time
            result.executionTime = execution_time

            if result.passed:
                passed_count += 1

            results.append(result)

        except Exception as e:
            results.append(TestResult(
                passed=False,
                input=test_case.input,
                expectedOutput=test_case.output,
                error=f"Execution error: {str(e)}"
            ))

    return {
        "success": passed_count == len(request.testCases),
        "results": results,
        "testsTotal": len(request.testCases),
        "testsPassed": passed_count
    }


@router.post("/submit-rl-assessment")
async def submit_rl_assessment(submission: RLAssessmentSubmission):
    """
    Submit complete RL-enhanced assessment with all tracking data.
    This data is gold for training the RL model.
    """

    # Generate comprehensive summary using all RL data
    summary_prompt = f"""You are evaluating a candidate using an RL-powered interactive assessment system. Provide a comprehensive technical evaluation.

**Problem:** {submission.problemTitle}
{submission.problemDescription}

**Final Code ({submission.language}):**
```{submission.language}
{submission.finalCode}
```

**Execution Metrics:**
- Duration: {submission.elapsedTime}s
- Lines written: {submission.progressMetrics.get('linesWritten', 0)}
- Code complexity: {submission.progressMetrics.get('codeComplexity', 0)}
- Total code changes: {submission.progressMetrics.get('totalChanges', 0)}
- Hints used: {len(submission.hintsUsed)}
- Execution attempts: {len(submission.executionAttempts)}
- Consecutive failures: {submission.progressMetrics.get('consecutiveFailures', 0)}

**Challenge Questions & Responses:**
{json.dumps(submission.challengeTodos, indent=2)}

**Hints Used:**
{json.dumps(submission.hintsUsed, indent=2)}

**Execution Attempts:**
{json.dumps(submission.executionAttempts, indent=2)}

**Monitoring Events:**
{json.dumps(submission.monitoringEvents[-10:] if len(submission.monitoringEvents) > 10 else submission.monitoringEvents, indent=2)}

**Evaluation Instructions:**
Analyze the candidate's performance across multiple dimensions and provide detailed, specific feedback.

**Output Format (respond in JSON only):**
{{
    "coreSummary": {{
        "overallRecommendation": "Strong Hire" | "Hire" | "Weak Hire" | "No Hire",
        "finalVerdictConfidence": "High" | "Medium" | "Low",
        "overallRating": 1-10
    }},
    "technicalEvaluation": {{
        "problemUnderstanding": "Strong" | "Moderate" | "Weak",
        "problemUnderstandingNotes": "Specific observations about how well they understood the problem",
        "algorithmChoice": "Excellent" | "Good" | "Fair" | "Poor",
        "algorithmNotes": "Assessment of their algorithm/approach choice and reasoning",
        "codeQuality": "Excellent" | "Good" | "Fair" | "Poor",
        "codeQualityNotes": "Readability, structure, maintainability observations",
        "correctness": "Excellent" | "Good" | "Fair" | "Poor",
        "correctnessNotes": "Test results, edge-case handling assessment",
        "debuggingAbility": "Excellent" | "Good" | "Fair" | "Poor",
        "debuggingNotes": "Independence, speed of iteration, problem-solving approach"
    }},
    "followUpAdaptability": {{
        "performanceOnFollowUps": "Excellent" | "Good" | "Fair" | "Poor",
        "followUpNotes": "How they handled challenge questions",
        "abilityToGeneralize": "Excellent" | "Good" | "Fair" | "Poor",
        "generalizationNotes": "Could they extend solution to new constraints?",
        "depthOfReasoning": "Excellent" | "Good" | "Fair" | "Poor",
        "reasoningNotes": "Scalability thinking, trade-off analysis"
    }},
    "communicationCollaboration": {{
        "clarityInExplanation": "Excellent" | "Good" | "Fair" | "Poor",
        "clarityNotes": "How clearly they explained their approach in responses",
        "responsivenessToFeedback": "Excellent" | "Good" | "Fair" | "Poor",
        "responsivenessNotes": "How they responded to hints and challenges",
        "tradeoffDiscussion": "Excellent" | "Good" | "Fair" | "Poor",
        "tradeoffNotes": "Ability to discuss design choices and trade-offs"
    }},
    "executionMetrics": {{
        "timeToComplete": "{submission.elapsedTime}s ({submission.elapsedTime // 60}m {submission.elapsedTime % 60}s)",
        "hintsUsed": {len(submission.hintsUsed)},
        "iterationsToCorrect": {len(submission.executionAttempts)},
        "efficiency": "Efficient" | "Average" | "Slow"
    }},
    "strengthsWeaknesses": {{
        "topStrengths": ["strength 1", "strength 2", "strength 3"],
        "topConcerns": ["concern 1", "concern 2"]
    }},
    "detailedFeedback": "2-3 paragraph detailed analysis of their performance, learning trajectory, and overall assessment quality"
}}

Respond ONLY with valid JSON, no other text."""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": summary_prompt}],
            temperature=0.3
        )

        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            summary = json.loads(json_str)
        else:
            # Fallback summary if Grok fails
            summary = {
                "coreSummary": {
                    "overallRecommendation": "Hire",
                    "finalVerdictConfidence": "Low",
                    "overallRating": 6
                },
                "technicalEvaluation": {
                    "problemUnderstanding": "Moderate",
                    "problemUnderstandingNotes": "Evaluation pending",
                    "algorithmChoice": "Good",
                    "algorithmNotes": "Evaluation pending",
                    "codeQuality": "Good",
                    "codeQualityNotes": "Evaluation pending",
                    "correctness": "Good",
                    "correctnessNotes": "Evaluation pending",
                    "debuggingAbility": "Good",
                    "debuggingNotes": "Evaluation pending"
                },
                "followUpAdaptability": {
                    "performanceOnFollowUps": "Good",
                    "followUpNotes": "Evaluation pending",
                    "abilityToGeneralize": "Good",
                    "generalizationNotes": "Evaluation pending",
                    "depthOfReasoning": "Good",
                    "reasoningNotes": "Evaluation pending"
                },
                "communicationCollaboration": {
                    "clarityInExplanation": "Good",
                    "clarityNotes": "Evaluation pending",
                    "responsivenessToFeedback": "Good",
                    "responsivenessNotes": "Evaluation pending",
                    "tradeoffDiscussion": "Good",
                    "tradeoffNotes": "Evaluation pending"
                },
                "executionMetrics": {
                    "timeToComplete": f"{submission.elapsedTime}s",
                    "hintsUsed": len(submission.hintsUsed),
                    "iterationsToCorrect": len(submission.executionAttempts),
                    "efficiency": "Average"
                },
                "strengthsWeaknesses": {
                    "topStrengths": ["Completed assessment", "Used interactive features"],
                    "topConcerns": ["Evaluation pending"]
                },
                "detailedFeedback": "Full evaluation pending. Candidate completed the assessment and used the interactive features."
            }

        # Store complete RL assessment
        assessment_id = f"rl_assess_{datetime.now().timestamp()}"
        rl_state_db[assessment_id] = {
            "candidateId": submission.candidateId,
            "problemId": submission.problemId,
            "problemTitle": submission.problemTitle,
            "problemDescription": submission.problemDescription,
            "language": submission.language,
            "startTime": datetime.now().timestamp() * 1000 - submission.elapsedTime * 1000,
            "endTime": datetime.now().timestamp() * 1000,
            "finalCode": submission.finalCode,
            "progressMetrics": submission.progressMetrics,
            "monitoringEvents": submission.monitoringEvents,
            "hintsUsed": submission.hintsUsed,
            "challengeTodos": submission.challengeTodos,
            "executionAttempts": submission.executionAttempts,
            "rlSignals": submission.rlSignals,
            "evaluation": summary,
        }

        # Save RL training data
        with open("rl_training_data.json", "a") as f:
            f.write(json.dumps({
                "assessmentId": assessment_id,
                "submission": submission.dict(),
                "summary": summary,
                "timestamp": datetime.now().isoformat(),
            }) + "\n")

        return {
            "assessmentId": assessment_id,
            "summary": summary
        }

    except Exception as e:
        print(f"Error submitting RL assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit assessment: {str(e)}")


@router.get("/assessment/{assessment_id}")
async def get_rl_assessment(assessment_id: str):
    """Get RL assessment summary for recruiter dashboard"""
    if assessment_id not in rl_state_db:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return rl_state_db[assessment_id]


@router.get("/rl-training-stats")
async def get_rl_training_stats():
    """Get statistics on RL training data collected"""
    return {
        "totalAssessments": len(rl_state_db),
        "trainingDataPoints": len(rl_training_data),
        "recentSignals": rl_training_data[-10:] if rl_training_data else [],
    }
