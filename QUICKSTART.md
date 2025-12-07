# Quick Start Guide - Sentinel

Get up and running in 5 minutes!

## Setup (One Time)

### 1. Get Your Grok API Key
1. Visit https://console.x.ai
2. Create an API key
3. Copy it

### 2. Configure Backend
```bash
cd frontend/backend
cp .env.example .env
# Edit .env and paste your API key:
# GROK_API_KEY=your_key_here
```

### 3. Install Dependencies

**Backend:**
```bash
cd frontend/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

## Running the App

### Option 1: Helper Scripts (Easy)

**Terminal 1:**
```bash
./start-backend.sh
```

**Terminal 2:**
```bash
./start-frontend.sh
```

### Option 2: Manual

**Terminal 1 - Backend:**
```bash
cd frontend/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Access

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Testing the Demo

### Test Case 1: False Positive Detection
1. Go to http://localhost:5173/assessment
2. Paste a perfect solution:
```python
def invertTree(root):
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root
```
3. Wait for AI to ask: "Why did you choose this approach?"
4. Type nonsense or nothing
5. Submit → AI should flag as suspicious

### Test Case 2: False Negative Rescue
1. Start coding a solution
2. Make an intentional typo: `retrun` instead of `return`
3. Wait for AI hint
4. Fix the typo
5. Submit → AI should recognize you're capable

## Troubleshooting

### "Module not found" errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Grok API not working
- Check `.env` has correct API key
- Verify API key is active at console.x.ai
- Check network connection

### Port already in use
```bash
# Backend (change 8000 to 8001)
uvicorn app.main:app --reload --port 8001

# Update frontend/src/pages/AssessmentPage.tsx:
# const API_BASE = 'http://localhost:8001';
```

## Next Steps

1. **Read the full README.md** for detailed documentation
2. **Customize the problem** in `AssessmentPage.tsx`
3. **Adjust AI prompts** in `backend/app/main.py`
4. **Style the UI** with Tailwind classes

## Demo for Judges

1. Open assessment page
2. Show the beautiful UI
3. Start coding (show hints appearing)
4. Demonstrate mandatory questions
5. Show voice response feature
6. Submit and show recruiter dashboard
7. Explain the feedback loop for AI improvement

## Key Features to Highlight

✨ **Real-time AI monitoring** - Not just a test, an active interview
🎯 **Precision/Recall** - Catches cheaters, saves genuine candidates
📊 **Rich analytics** - Timeline, metrics, comprehensive summaries
🔄 **Learning system** - Feedback loop for continuous improvement

---

**Questions?** Check README.md or the code comments!
