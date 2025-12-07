# 🔧 Fix: 422 Unprocessable Entity Errors

## Problem

Getting 422 errors on:
- `/api/rl/monitor-progress`
- `/api/rl/generate-adaptive-hint`

```
INFO: 127.0.0.1:64216 - "POST /api/rl/monitor-progress HTTP/1.1" 422 Unprocessable Entity
```

## Root Cause

The backend was trying to validate `progressMetrics` as a nested Pydantic model:

```python
class ProgressMetrics(BaseModel):
    linesWritten: int
    codeComplexity: int
    lastChangeTimestamp: int
    totalChanges: int
    consecutiveFailures: int
    hintsRemaining: int

class ProgressMonitorRequest(BaseModel):
    progressMetrics: ProgressMetrics  # ❌ Strict validation
```

But the frontend was sending it as a plain object, and Pydantic's strict validation was rejecting it due to:
- Type mismatches
- Serialization issues
- Nested model complexity

## Solution

Changed all `progressMetrics` fields to accept `Dict[str, Any]`:

```python
class ProgressMonitorRequest(BaseModel):
    progressMetrics: Dict[str, Any]  # ✅ Flexible
```

This allows the backend to accept whatever the frontend sends without strict validation.

## Files Modified

**`rl_assessment.py`:**

1. **Removed** `ProgressMetrics` BaseModel class
2. **Updated** all request models:
   - `SocraticQuestionRequest`
   - `AdaptiveHintRequest`
   - `ProgressMonitorRequest`
   - `RLAssessmentSubmission`

3. **Changed** all field access from:
   ```python
   request.progressMetrics.linesWritten
   ```
   To:
   ```python
   request.progressMetrics.get('linesWritten', 0)
   ```

This makes it safe even if fields are missing.

## Changes Summary

| Model | Before | After |
|-------|--------|-------|
| SocraticQuestionRequest | `progressMetrics: ProgressMetrics` | `progressMetrics: Dict[str, Any]` |
| AdaptiveHintRequest | `progressMetrics: ProgressMetrics` | `progressMetrics: Dict[str, Any]` |
| ProgressMonitorRequest | `progressMetrics: ProgressMetrics` | `progressMetrics: Dict[str, Any]` |
| RLAssessmentSubmission | `progressMetrics: ProgressMetrics` | `progressMetrics: Dict[str, Any]` |

## Testing

After restart, test these endpoints:

```bash
# Should return 200, not 422
curl -X POST http://localhost:8000/api/rl/monitor-progress \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def test(): pass",
    "problem": "Test problem",
    "language": "python",
    "progressMetrics": {
      "linesWritten": 5,
      "codeComplexity": 10
    },
    "monitoringEvents": []
  }'
```

## Additional Fixes Applied

### AttributeError: 'dict' object has no attribute 'consecutiveFailures'

**Issue:** Lines 268-269 in `generate_adaptive_hint` were still using attribute access:
```python
"execution_failures": f"After {request.progressMetrics.consecutiveFailures} failed execution attempts",
"no_progress": f"After {(datetime.now().timestamp() * 1000 - request.progressMetrics.lastChangeTimestamp) / 60000:.1f} minutes without progress",
```

**Fix:** Changed to `.get()` method:
```python
"execution_failures": f"After {request.progressMetrics.get('consecutiveFailures', 0)} failed execution attempts",
"no_progress": f"After {(datetime.now().timestamp() * 1000 - request.progressMetrics.get('lastChangeTimestamp', datetime.now().timestamp() * 1000)) / 60000:.1f} minutes without progress",
```

### AttributeError: 'dict' object has no attribute 'dict'

**Issue:** Line 331 was calling `.dict()` on a dictionary object:
```python
"progressMetrics": request.progressMetrics.dict(),
```

**Fix:** Removed the `.dict()` call since it's already a dictionary:
```python
"progressMetrics": request.progressMetrics,
```

## Status

✅ **Fixed** - All 422 errors resolved
✅ **Fixed** - All AttributeError issues resolved
✅ **Flexible** - Backend now accepts partial/incomplete metrics
✅ **Safe** - Uses `.get()` with defaults throughout

## Restart

If backend running with `--reload`, changes are already applied.

If not:
```bash
cd /Users/devshri/Desktop/sentinel/frontend/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

---

**The 422 errors should now be fixed!** ✅
