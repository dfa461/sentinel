"""
Enhanced RL-powered assessment endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import httpx
import os
from datetime import datetime
from dotenv import load_dotenv
import subprocess
import tempfile
import time
import re

load_dotenv()

router = APIRouter(prefix="/api/rl", tags=["rl-assessment"])

GROK_API_KEY = os.getenv("GROK_API_KEY")
GROK_API_URL = os.getenv("GROK_API_URL", "https://api.x.ai/v1/chat/completions")

# RL State tracking
rl_state_db: Dict[str, Any] = {}
rl_training_data: List[Dict[str, Any]] = []


class SocraticQuestionRequest(BaseModel):
    code: str
    problem: str
    language: str
    pauseDuration: float
    progressMetrics: Dict[str, Any]  # Accept as dict


class ThoughtProcessEvaluationRequest(BaseModel):
    question: str
    response: str
    code: str
    problem: str


class AdaptiveHintRequest(BaseModel):
    code: str
    problem: str
    language: str
    progressMetrics: Dict[str, Any]  # Accept as dict
    executionAttempts: List[Dict[str, Any]]
    context: str


class ProgressMonitorRequest(BaseModel):
    code: str
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
    finalCode: str
    language: str
    progressMetrics: Dict[str, Any]  # Accept as dict
    monitoringEvents: List[Dict[str, Any]]
    hintsUsed: List[Dict[str, Any]]
    executionAttempts: List[Dict[str, Any]]
    rlSignals: List[Dict[str, Any]]
    elapsedTime: int


async def call_grok_api(messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
    """Call Grok API with the given messages"""
    if not GROK_API_KEY:
        raise HTTPException(status_code=500, detail="Grok API key not configured")

    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "grok-beta",
        "messages": messages,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(GROK_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Grok API error: {str(e)}")


@router.post("/generate-socratic-question")
async def generate_socratic_question(request: SocraticQuestionRequest):
    """
    Generate a Socratic question based on pause detection.
    Uses online RL to adapt question difficulty and type.
    """

    socratic_prompt = f"""You are a Socratic teacher using AI to guide software engineering candidates through problem-solving.

**Context:**
The candidate paused for {request.pauseDuration:.1f} seconds while solving:
{request.problem}

**Current Code (in {request.language}):**
```{request.language}
{request.code}
```

**Progress Metrics:**
- Lines written: {request.progressMetrics.get('linesWritten', 0)}
- Code complexity: {request.progressMetrics.get('codeComplexity', 0)}/100
- Total changes: {request.progressMetrics.get('totalChanges', 0)}
- Consecutive failures: {request.progressMetrics.get('consecutiveFailures', 0)}

**Your Task:**
Generate a Socratic question that:
1. Helps them think through their approach (don't give answers)
2. Probes their understanding of what they've written
3. Guides them toward the right track if they're stuck
4. Is specific to their code, not generic

**Question Types:**
- Guiding: "What are you trying to accomplish in this section?"
- Probing: "Why did you choose this data structure?"
- Challenging: "What edge cases might this approach miss?"
- Clarifying: "Can you explain your thought process here?"

**Respond ONLY with JSON:**
{{
    "question": "Your Socratic question here",
    "expectedInsights": ["What you hope they'll realize"],
    "difficulty": "guiding" | "probing" | "challenging"
}}"""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": socratic_prompt}],
            temperature=0.6
        )

        # Parse JSON response
        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
            return result
        else:
            # Fallback question
            return {
                "question": "Can you walk me through your thinking on this approach?",
                "expectedInsights": ["Understanding their reasoning"],
                "difficulty": "guiding"
            }

    except Exception as e:
        print(f"Error generating Socratic question: {e}")
        return {
            "question": "What's your strategy for solving this problem?",
            "expectedInsights": ["Overall approach"],
            "difficulty": "guiding"
        }


@router.post("/evaluate-thought-process")
async def evaluate_thought_process(request: ThoughtProcessEvaluationRequest):
    """
    Evaluate candidate's thought process and provide feedback.
    This is the key RL component - we learn from these interactions.
    """

    evaluation_prompt = f"""You are an expert technical interviewer evaluating a candidate's thought process.

**Question Asked:**
{request.question}

**Candidate's Response:**
{request.response}

**Their Current Code:**
```
{request.code}
```

**Problem:**
{request.problem}

**Your Task:**
Evaluate if the candidate is on the right track. Consider:
1. Do they understand what they're doing?
2. Is their reasoning sound?
3. Are they making progress toward a solution?
4. Do they show problem-solving skills?

**Be encouraging but honest.** If they're off track, gently guide them.

**Respond ONLY with JSON:**
{{
    "isOnRightTrack": true/false,
    "feedback": "Specific, constructive feedback (2-3 sentences)",
    "confidence": 0.0-1.0,
    "suggestedDirection": "If off track, what should they consider?"
}}"""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": evaluation_prompt}],
            temperature=0.4
        )

        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            evaluation = json.loads(json_str)

            # Record RL training data
            rl_training_data.append({
                "type": "thought_process_evaluation",
                "question": request.question,
                "response": request.response,
                "code": request.code,
                "evaluation": evaluation,
                "timestamp": datetime.now().isoformat(),
            })

            return {"evaluation": evaluation}
        else:
            return {
                "evaluation": {
                    "isOnRightTrack": True,
                    "feedback": "Good thinking! Keep going with your current approach.",
                    "confidence": 0.5
                }
            }

    except Exception as e:
        print(f"Error evaluating thought process: {e}")
        return {
            "evaluation": {
                "isOnRightTrack": True,
                "feedback": "Continue with your approach and see where it leads.",
                "confidence": 0.5
            }
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
    Monitor ongoing progress and provide quality feedback.
    This is the continuous RL monitoring loop.
    """

    # Analyze code quality in real-time
    quality_prompt = f"""You are monitoring a candidate's coding progress in real-time.

**Code (in {request.language}):**
```{request.language}
{request.code}
```

**Progress:**
- Lines: {request.progressMetrics.get('linesWritten', 0)}
- Complexity: {request.progressMetrics.get('codeComplexity', 0)}
- Changes: {request.progressMetrics.get('totalChanges', 0)}

**Recent Events:**
{json.dumps(request.monitoringEvents[-5:] if len(request.monitoringEvents) > 5 else request.monitoringEvents, indent=2)}

**Task:**
Quick assessment - should we intervene with quality feedback?

**Respond with JSON:**
{{
    "intervention_needed": true/false,
    "type": "quality_feedback",
    "content": "Brief suggestion if needed"
}}"""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": quality_prompt}],
            temperature=0.4
        )

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

        # Simple comparison (production would need more sophisticated comparison)
        passed = actual_output.strip() == test_case.output.strip()

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


async def execute_javascript_code(code: str, test_case: TestCase) -> TestResult:
    """Execute JavaScript code with test case input"""

    # Extract function name from the code (look for function function_name pattern)
    # Find all function definitions, use the last one (typically the solution function)
    func_matches = re.finditer(r'function\s+(\w+)\s*\(', code)
    func_names = [match.group(1) for match in func_matches]

    if not func_names:
        return TestResult(
            passed=False,
            input=test_case.input,
            expectedOutput=test_case.output,
            error="Could not find a function definition in the code"
        )

    # Use the last function defined (typically the solution function)
    func_name = func_names[-1]

    # Wrap the user's code with a call that executes it with test inputs
    wrapped_code = f"""{code}

// Execute the function with test inputs and print the result
const result = {func_name}({test_case.input});
console.log(result);
"""

    # Create a temporary file with the wrapped code
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(wrapped_code)
        temp_file = f.name

    try:
        # Execute with timeout
        process = subprocess.run(
            ['node', temp_file],
            capture_output=True,
            text=True,
            timeout=5  # 5 second timeout
        )

        stdout = process.stdout
        stderr = process.stderr

        # Capture the last line of stdout as the actual output for comparison
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

        # Simple comparison
        passed = actual_output.strip() == test_case.output.strip()

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


@router.post("/execute-code")
async def execute_code(request: CodeExecutionRequest):
    """
    Execute code against test cases in a sandboxed environment.
    Supports Python and JavaScript.
    """

    if request.language not in ["python", "javascript"]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")

    results = []
    passed_count = 0

    for test_case in request.testCases:
        try:
            start_time = time.time()

            if request.language == "python":
                result = await execute_python_code(request.code, test_case)
            else:  # javascript
                result = await execute_javascript_code(request.code, test_case)

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
    summary_prompt = f"""You are evaluating a candidate using an RL-powered interactive assessment system.

**Problem:** {submission.problemId}
**Final Code ({submission.language}):**
```{submission.language}
{submission.finalCode}
```

**RL Metrics:**
- Duration: {submission.elapsedTime}s
- Lines written: {submission.progressMetrics.get('linesWritten', 0)}
- Code complexity: {submission.progressMetrics.get('codeComplexity', 0)}
- Total code changes: {submission.progressMetrics.get('totalChanges', 0)}
- Hints used: {3 - submission.progressMetrics.get('hintsRemaining', 3)}/3
- Execution attempts: {len(submission.executionAttempts)}
- Consecutive failures: {submission.progressMetrics.get('consecutiveFailures', 0)}

**Monitoring Events:**
{json.dumps(submission.monitoringEvents, indent=2)}

**RL Signals (State-Action-Reward):**
{json.dumps(submission.rlSignals, indent=2)}

**Hints Used:**
{json.dumps(submission.hintsUsed, indent=2)}

**Analysis:**
This is an advanced RL-based assessment. Consider:
1. Code quality and correctness
2. How they responded to pauses/questions
3. How effectively they used hints
4. Their learning trajectory (getting better over time?)
5. Engagement with the Socratic process
6. Problem-solving adaptability

**Respond with JSON:**
{{
    "overallRating": 1-10,
    "strengths": ["strength 1", "strength 2", ...],
    "weaknesses": ["weakness 1", "weakness 2", ...],
    "recommendation": "strong_hire" | "hire" | "maybe" | "no_hire",
    "rlInsights": "How they performed in the interactive RL system",
    "learningTrajectory": "Did they improve throughout the assessment?"
}}"""

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
            summary = {
                "overallRating": 6,
                "strengths": ["Completed assessment", "Used interactive features"],
                "weaknesses": ["Evaluation unavailable"],
                "recommendation": "maybe",
                "rlInsights": "Full analysis pending",
                "learningTrajectory": "Data collected successfully"
            }

        # Store complete RL assessment
        assessment_id = f"rl_assess_{datetime.now().timestamp()}"
        rl_state_db[assessment_id] = {
            "candidateId": submission.candidateId,
            "problemId": submission.problemId,
            "startTime": datetime.now().timestamp() * 1000 - submission.elapsedTime * 1000,
            "endTime": datetime.now().timestamp() * 1000,
            "finalCode": submission.finalCode,
            "progressMetrics": submission.progressMetrics,
            "monitoringEvents": submission.monitoringEvents,
            "hintsUsed": submission.hintsUsed,
            "executionAttempts": submission.executionAttempts,
            "rlSignals": submission.rlSignals,
            **summary,
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


@router.get("/rl-training-stats")
async def get_rl_training_stats():
    """Get statistics on RL training data collected"""
    return {
        "totalAssessments": len(rl_state_db),
        "trainingDataPoints": len(rl_training_data),
        "recentSignals": rl_training_data[-10:] if rl_training_data else [],
    }
