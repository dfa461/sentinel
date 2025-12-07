# Sentinel - AI-Powered Technical Assessment Platform

**An intelligent coding assessment platform that uses AI to provide real-time interventions, ask follow-up questions, and generate comprehensive candidate evaluations.**

Built for the xAI Hackathon - Grok Recruiter Track

## Features

### For Candidates
- **Beautiful, Distraction-Free IDE** - Monaco editor with syntax highlighting and IntelliSense
- **Real-Time AI Hints** - Get unstuck with contextual hints when you need them
- **Dynamic Challenges** - AI asks follow-up questions to test your understanding
- **Voice & Text Responses** - Answer questions via typing or voice recording
- **Progress Tracking** - Visual feedback on your assessment progress

### For Recruiters
- **Comprehensive Summaries** - AI-generated evaluation of candidate performance
- **Timeline Visualization** - See code evolution and intervention points
- **Strengths & Weaknesses** - Detailed analysis of candidate competencies
- **Response Review** - Review all AI questions and candidate answers
- **Learning System** - Thumbs up/down feedback to improve AI model

### Technical Innovation
- **Online RL Approach** - AI acts like a human interviewer, adapting in real-time
- **Precision/Recall Optimization** - Catches false positives (copy-paste) and saves false negatives (minor errors)
- **Memory System** - Builds comprehensive context database for recruiters
- **Self-Improving** - Feedback loop enables continuous model improvement

## Architecture

```
sentinel/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Assessment & Dashboard pages
│   │   ├── lib/          # Utilities
│   │   └── types/        # TypeScript definitions
│   └── backend/          # FastAPI backend
│       └── app/
│           └── main.py   # API endpoints + Grok integration
```

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Lightning-fast dev server
- **Tailwind CSS** - Utility-first styling
- **Monaco Editor** - VS Code's editor component
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization
- **React Router** - Client-side routing

### Backend
- **FastAPI** - Modern Python web framework
- **Grok API** - xAI's language model
- **Pydantic** - Data validation
- **HTTPX** - Async HTTP client

## Quick Start

### Prerequisites
- Node.js 20+ (for frontend)
- Python 3.9+ (for backend)
- Grok API key from xAI

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 2. Install Backend Dependencies

```bash
cd frontend/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cd frontend/backend
cp .env.example .env
# Edit .env and add your Grok API key
```

**Get your Grok API key:**
1. Go to [xAI Console](https://console.x.ai)
2. Create an API key
3. Add to `.env`: `GROK_API_KEY=your_key_here`

### 4. Run the Application

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

**Open:** http://localhost:5173

## Usage Guide

### Candidate Flow
1. Navigate to `/assessment`
2. Read the problem description
3. Start coding in Python or JavaScript
4. Receive hints when stuck
5. Answer mandatory AI questions
6. Submit when complete

### Recruiter Flow
1. After candidate submits, visit `/results/{assessmentId}`
2. Review comprehensive summary
3. Analyze timeline and interventions
4. Provide feedback (👍/👎) to improve AI

## AI Prompt Engineering

### The "Watcher" Agent
Monitors code in real-time every 5 seconds and decides:
- Is the candidate stuck?
- Are they going in the wrong direction?
- Should we intervene with a hint or challenge?

Returns JSON:
```json
{
  "intervention_needed": true,
  "type": "challenge",
  "content": "Why did you choose a recursive approach here?"
}
```

### The "Summarizer" Agent
Analyzes the complete assessment to generate:
- Overall rating (1-10)
- Strengths and weaknesses
- Hiring recommendation
- Detailed summary

Uses ALL data:
- Code evolution timeline
- AI interventions
- Candidate responses
- Final code quality

## Demo Script

### Showing Precision (Detecting False Positives)
1. Paste a perfect solution from ChatGPT
2. AI asks: "Why did you use this approach?"
3. Fail to explain properly
4. Result: Flagged as suspicious ❌

### Showing Recall (Saving False Negatives)
1. Write good code but make a typo
2. AI sees you're capable but stuck
3. Receive hint: "Check line 14"
4. Fix it and pass ✅

## API Endpoints

### POST `/submit-snapshot`
Submit code snapshot for AI analysis
```json
{
  "code": "def invertTree(root):\n    pass",
  "problem": "Invert a binary tree",
  "language": "python"
}
```

### POST `/submit-assessment`
Submit final assessment for evaluation
```json
{
  "candidateId": "demo-candidate",
  "problemId": "binary-tree-invert",
  "finalCode": "...",
  "language": "python",
  "snapshots": [...],
  "responses": [...],
  "elapsedTime": 1200
}
```

### GET `/assessment/{assessmentId}`
Retrieve assessment summary for recruiter

### POST `/feedback`
Submit recruiter feedback for model improvement
```json
{
  "assessmentId": "assess_123",
  "isPositive": true,
  "timestamp": 1234567890
}
```

## Customization

### Adding New Problems
Edit `frontend/src/pages/AssessmentPage.tsx`:

```typescript
const NEW_PROBLEM: Problem = {
  id: 'your-problem',
  title: 'Your Problem Title',
  difficulty: 'medium',
  description: '...',
  starterCode: {
    python: '# Your starter code',
    javascript: '// Your starter code'
  },
  testCases: [...]
};
```

### Adjusting AI Behavior
Modify prompts in `frontend/backend/app/main.py`:
- `watcher_prompt` - Controls intervention frequency/type
- `summarizer_prompt` - Controls evaluation criteria

### Styling
All styles use Tailwind CSS. Key files:
- `frontend/src/index.css` - Global styles
- `frontend/tailwind.config.js` - Theme configuration

## Production Deployment

### Frontend
```bash
cd frontend
npm run build
# Deploy dist/ to Vercel, Netlify, or any static host
```

### Backend
```bash
cd frontend/backend
# Use Docker or deploy to Railway, Render, or Fly.io
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Environment Variables
- `GROK_API_KEY` - Your xAI API key
- `GROK_API_URL` - Grok API endpoint (default: https://api.x.ai/v1/chat/completions)

## Hackathon Pitch Points

### 1. Addresses Track Requirements
✅ **"Role-specific technical screening bot"** - Our AI acts as an interviewer
✅ **"Online RL approach"** - Real-time adaptation to candidate behavior
✅ **"Generates meaningful questions"** - Dynamic follow-ups on code
✅ **"Measurable precision/recall"** - Detects copy-paste vs genuine errors

### 2. Innovation
- **Not just a test, it's an interview** - AI actively engages
- **Process over correctness** - Evaluates how you think, not just if you pass
- **Learning system** - Feedback loop for continuous improvement

### 3. Impact
- **Recruiters:** Save time with comprehensive AI summaries
- **Candidates:** Better experience with helpful hints
- **Companies:** Hire based on potential, not memorization

## Troubleshooting

### Frontend won't start
```bash
rm -rf node_modules package-lock.json
npm install
```

### Backend errors
```bash
# Check Python version
python --version  # Should be 3.9+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Grok API errors
- Verify API key is set in `.env`
- Check API quota/limits
- Ensure network connectivity

### TypeScript errors
```bash
npm run build  # Check for type errors
```

## Future Enhancements

- [ ] Multi-language support (C++, Java, Go)
- [ ] Live coding sessions with screen sharing
- [ ] Team assessments
- [ ] Custom problem creation UI
- [ ] Integration with ATS systems
- [ ] Video recording of voice responses
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard

## License

MIT License - Built for xAI Hackathon 2024

## Team

Built by a team of 3 engineers in 20 hours for the xAI Hackathon.

## Acknowledgments

- **xAI** for Grok API access
- **Monaco Editor** team for the amazing editor
- **Tailwind CSS** for beautiful styling
- **FastAPI** for the elegant backend framework

---

**Made with ❤️ for the xAI Hackathon - Grok Recruiter Track**
