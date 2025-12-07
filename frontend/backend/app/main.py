from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import httpx
from datetime import datetime
from dotenv import load_dotenv
from xai_sdk import AsyncClient
from xai_sdk.chat import user, system
import subprocess
import tempfile
import time
import re

load_dotenv()

app = FastAPI(title="Sentinel Assessment API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (use database in production)
assessments_db: Dict[str, Any] = {}
feedback_data: List[Dict[str, Any]] = []

# Grok API configuration
# Grok API configuration
GROK_API_KEY = os.getenv("GROK_API_KEY")

# Create global xAI client
# We explicitly pass the key to maintain compatibility with GROK_API_KEY env var
xai_client = AsyncClient(api_key=GROK_API_KEY)


class CodeSnapshot(BaseModel):
    code: str
    problem: str
    language: str


class InterventionResponse(BaseModel):
    intervention_needed: bool
    type: Optional[str] = None  # 'hint' | 'challenge' | 'warning'
    content: Optional[str] = None


class AssessmentSubmission(BaseModel):
    candidateId: str
    problemId: str
    finalCode: str
    language: str
    snapshots: List[Dict[str, Any]]
    responses: List[Dict[str, Any]]
    elapsedTime: int


class Feedback(BaseModel):
    assessmentId: str
    isPositive: bool
    timestamp: int


class TestCase(BaseModel):
    input: str
    output: str


class RunCodeRequest(BaseModel):
    code: str
    language: str
    testCases: List[TestCase]


class TestResult(BaseModel):
    passed: bool
    input: str
    expectedOutput: str
    actualOutput: Optional[str] = None
    error: Optional[str] = None
    executionTime: Optional[float] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None


class RunCodeResponse(BaseModel):
    success: bool
    results: List[TestResult]
    totalTests: int
    passedTests: int
    error: Optional[str] = None


async def call_grok_api(messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
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
            model="grok-3",
            messages=sdk_messages,
            temperature=temperature
        )
        
        # Get response
        response = await chat.sample()
        return response.content

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grok API error: {str(e)}")


@app.get("/")
async def root():
    return {
        "name": "Sentinel Assessment API",
        "version": "1.0.0",
        "status": "operational",
    }


@app.post("/submit-snapshot", response_model=InterventionResponse)
async def submit_snapshot(snapshot: CodeSnapshot):
    """
    Analyze code snapshot and decide if intervention is needed.
    This is the "Watcher" agent.
    """

    watcher_prompt = f"""You are a technical interviewer AI analyzing a candidate's code in real-time during an assessment.

**Problem:** {snapshot.problem}

**Current Code (in {snapshot.language}):**
```{snapshot.language}
{snapshot.code}
```

**Your Task:**
Analyze this code snippet and determine if intervention is needed. You should intervene if:
1. The candidate appears stuck (no progress, same error repeated)
2. The candidate is going in completely wrong direction
3. The candidate has written significant code and should be challenged to explain their reasoning

**Important Guidelines:**
- For hints: Only suggest if candidate is genuinely stuck
- For challenges: Ask when candidate has made good progress (e.g., "Why did you choose this approach?", "What edge cases haven't you considered?", "What's the time complexity?")
- Don't intervene too frequently - let them code

**Output Format (respond in JSON only):**
{{
    "intervention_needed": true/false,
    "type": "hint" | "challenge" | "warning",
    "content": "Your hint or question here"
}}

Respond ONLY with valid JSON, no other text."""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": watcher_prompt}],
            temperature=0.5
        )

        # Parse JSON response
        # Try to extract JSON if Grok adds extra text
        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
            return InterventionResponse(**result)
        else:
            # No intervention if we can't parse
            return InterventionResponse(intervention_needed=False)

    except Exception as e:
        print(f"Error in submit_snapshot: {e}")
        # Don't fail the assessment if AI fails
        return InterventionResponse(intervention_needed=False)


@app.post("/submit-assessment")
async def submit_assessment(submission: AssessmentSubmission):
    """
    Generate final assessment summary using the "Summarizer" agent.
    """

    # Build timeline of events
    timeline = []
    for snapshot in submission.snapshots:
        timeline.append(f"[{snapshot['timestamp']}] Code update: {len(snapshot['code'])} characters")

    for response in submission.responses:
        timeline.append(
            f"[{response['timestamp']}] Response to intervention: {response['response'][:100]}..."
        )

    timeline_str = "\n".join(sorted(timeline))

    summarizer_prompt = f"""You are an expert technical recruiter evaluating a candidate's coding assessment.

**Problem ID:** {submission.problemId}
**Assessment Duration:** {submission.elapsedTime} seconds
**Language:** {submission.language}

**Code Evolution Timeline:**
{timeline_str}

**Final Submitted Code:**
```{submission.language}
{submission.finalCode}
```

**AI Interventions & Candidate Responses:**
{json.dumps(submission.responses, indent=2)}

**Your Task:**
Analyze the candidate's performance across multiple dimensions:
1. Code quality and correctness
2. Problem-solving approach
3. Communication skills (based on responses to questions)
4. Handling of edge cases and complexity
5. Overall engineering competency

**Output Format (JSON only):**
{{
    "overallRating": 1-10,
    "strengths": ["strength 1", "strength 2", ...],
    "weaknesses": ["weakness 1", "weakness 2", ...],
    "recommendation": "strong_hire" | "hire" | "maybe" | "no_hire",
    "summary": "Brief 2-3 sentence summary of the candidate's performance"
}}

Respond ONLY with valid JSON, no other text."""

    try:
        response = await call_grok_api(
            [{"role": "user", "content": summarizer_prompt}],
            temperature=0.3
        )

        # Parse JSON
        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            summary = json.loads(json_str)
        else:
            # Fallback summary
            summary = {
                "overallRating": 5,
                "strengths": ["Completed the assessment"],
                "weaknesses": ["Unable to generate detailed analysis"],
                "recommendation": "maybe",
                "summary": "Assessment completed but detailed analysis unavailable."
            }

        # Store assessment
        assessment_id = f"assess_{datetime.now().timestamp()}"
        assessments_db[assessment_id] = {
            "candidateId": submission.candidateId,
            "problemId": submission.problemId,
            "startTime": datetime.now().timestamp() * 1000 - submission.elapsedTime * 1000,
            "endTime": datetime.now().timestamp() * 1000,
            "codeEvolution": submission.snapshots,
            "interventions": [],  # Could be enhanced to store actual intervention objects
            "responses": submission.responses,
            "finalCode": submission.finalCode,
            **summary,
        }

        return {"assessmentId": assessment_id, "summary": summary}

    except Exception as e:
        print(f"Error in submit_assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate assessment: {str(e)}")


@app.get("/assessment/{assessment_id}")
async def get_assessment(assessment_id: str):
    """Get assessment summary for recruiter dashboard"""
    if assessment_id not in assessments_db:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return assessments_db[assessment_id]


@app.post("/feedback")
async def submit_feedback(feedback: Feedback):
    """
    Store recruiter feedback for model improvement.
    This is the "learning" component - feedback is saved for future training.
    """
    feedback_entry = {
        "assessmentId": feedback.assessmentId,
        "isPositive": feedback.isPositive,
        "timestamp": feedback.timestamp,
        "assessment_data": assessments_db.get(feedback.assessmentId),
    }

    feedback_data.append(feedback_entry)

    # Save to file for future training
    with open("training_data.json", "a") as f:
        f.write(json.dumps(feedback_entry) + "\n")

    return {
        "status": "success",
        "message": "Feedback recorded. This will be used to improve our AI model via reinforcement learning."
    }


@app.post("/run-code", response_model=RunCodeResponse)
async def run_code(request: RunCodeRequest):
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

    return RunCodeResponse(
        success=True,
        results=results,
        totalTests=len(request.testCases),
        passedTests=passed_count
    )


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
                stdout=stdout,
                stderr=stderr
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
                stdout=stdout,
                stderr=stderr
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


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "grok_api_configured": bool(GROK_API_KEY),
        "assessments_count": len(assessments_db),
        "feedback_count": len(feedback_data),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
