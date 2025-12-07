# Project Structure

## Overview

```
sentinel/
├── README.md                 # Main documentation
├── QUICKSTART.md            # 5-minute setup guide
├── PROJECT_STRUCTURE.md     # This file
├── .gitignore              # Git ignore rules
├── start-backend.sh        # Backend startup script
├── start-frontend.sh       # Frontend startup script
│
└── frontend/               # React application
    ├── package.json        # Frontend dependencies
    ├── vite.config.ts      # Vite configuration
    ├── tsconfig.json       # TypeScript configuration
    ├── tailwind.config.js  # Tailwind CSS configuration
    ├── postcss.config.js   # PostCSS configuration
    │
    ├── public/             # Static assets
    │
    ├── src/                # Source code
    │   ├── main.tsx        # Application entry point
    │   ├── App.tsx         # Root component with routing
    │   ├── index.css       # Global styles
    │   ├── vite-env.d.ts   # TypeScript declarations
    │   │
    │   ├── components/     # Reusable UI components
    │   │   ├── CodeEditor.tsx          # Monaco editor wrapper
    │   │   ├── ProblemPanel.tsx        # Problem description display
    │   │   ├── HintToast.tsx           # Hint notification component
    │   │   └── InterventionModal.tsx   # Mandatory question modal
    │   │
    │   ├── pages/          # Page components
    │   │   ├── AssessmentPage.tsx      # Main candidate assessment page
    │   │   └── RecruiterDashboard.tsx  # Recruiter summary page
    │   │
    │   ├── lib/            # Utility functions
    │   │   └── utils.ts    # Helper functions (cn, debounce, etc.)
    │   │
    │   └── types/          # TypeScript type definitions
    │       └── index.ts    # Shared types and interfaces
    │
    └── backend/            # FastAPI backend
        ├── requirements.txt    # Python dependencies
        ├── .env.example       # Environment variables template
        ├── .env               # Environment variables (gitignored)
        ├── __init__.py
        │
        └── app/
            ├── __init__.py
            └── main.py        # API endpoints and Grok integration
```

## Key Files Explained

### Frontend

#### Components
- **`CodeEditor.tsx`** - Monaco editor with VS Code features (syntax highlighting, IntelliSense)
- **`ProblemPanel.tsx`** - Displays problem description, test cases, timer, and AI status
- **`HintToast.tsx`** - Animated toast notification for AI hints
- **`InterventionModal.tsx`** - Modal for mandatory AI questions with voice/text input

#### Pages
- **`AssessmentPage.tsx`** - Main candidate interface
  - Manages code state and snapshots
  - Sends code to backend every 5 seconds
  - Handles interventions and responses
  - Timer and language switching

- **`RecruiterDashboard.tsx`** - Recruiter summary view
  - Fetches assessment data from backend
  - Displays metrics, timeline, strengths/weaknesses
  - Shows intervention history
  - Feedback collection for AI improvement

#### Libraries
- **`utils.ts`** - Helper functions
  - `cn()` - Merge Tailwind classes with clsx
  - `formatTime()` - Format seconds to MM:SS
  - `debounce()` - Debounce function calls

#### Types
- **`index.ts`** - TypeScript interfaces
  - `Intervention` - AI intervention data
  - `CodeSnapshot` - Code state at a point in time
  - `CandidateResponse` - Candidate's answer to question
  - `AssessmentSummary` - Complete evaluation data
  - `Problem` - Problem definition

### Backend

#### `main.py` - FastAPI Application

**Endpoints:**
- `POST /submit-snapshot` - Receive code snapshot, return intervention decision
- `POST /submit-assessment` - Receive final submission, return evaluation
- `GET /assessment/{id}` - Retrieve assessment summary
- `POST /feedback` - Record recruiter feedback

**AI Integration:**
- `call_grok_api()` - Wrapper for Grok API calls
- **Watcher Prompt** - Analyzes code, decides on interventions
- **Summarizer Prompt** - Generates final candidate evaluation

**Data Storage:**
- `assessments_db` - In-memory storage (use database in production)
- `feedback_data` - Recruiter feedback for model training
- `training_data.json` - Persistent feedback log

## Data Flow

### Candidate Assessment Flow

```
1. User opens /assessment
   ↓
2. AssessmentPage loads problem
   ↓
3. User types code
   ↓
4. Code snapshot sent to backend every 5s (debounced)
   ↓
5. Backend calls Grok with "Watcher" prompt
   ↓
6. Grok decides: hint, challenge, or nothing
   ↓
7. If hint → HintToast appears
   If challenge → InterventionModal appears
   ↓
8. User responds to challenges
   ↓
9. User submits assessment
   ↓
10. Backend calls Grok with "Summarizer" prompt
    ↓
11. Assessment stored with unique ID
    ↓
12. Redirect to /results/{assessmentId}
```

### Recruiter Review Flow

```
1. Recruiter opens /results/{assessmentId}
   ↓
2. RecruiterDashboard fetches assessment data
   ↓
3. Display:
   - Metrics (duration, interventions, rating)
   - Recommendation (strong_hire, hire, maybe, no_hire)
   - Progress chart
   - Strengths & weaknesses
   - Intervention timeline
   - Final code
   ↓
4. Recruiter clicks 👍 or 👎
   ↓
5. Feedback sent to backend
   ↓
6. Saved to training_data.json for model improvement
```

## State Management

### AssessmentPage State
- `problem` - Current problem data
- `language` - Selected programming language
- `code` - Current code content
- `elapsedTime` - Time spent on assessment
- `currentHint` - Active hint (if any)
- `currentIntervention` - Active challenge question
- `snapshots` - History of code states
- `responses` - Candidate's answers to questions

### RecruiterDashboard State
- `summary` - Complete assessment data
- `loading` - Loading state

## API Communication

All frontend-backend communication uses `fetch()` with JSON:

```typescript
// Example: Submit snapshot
const response = await fetch(`${API_BASE}/submit-snapshot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, problem, language }),
});
const data = await response.json();
```

## Styling System

### Tailwind Classes
- **Glass effect:** `glass-effect` - Glassmorphism UI
- **Gradient text:** `text-gradient` - Animated gradient text
- **Glow effect:** `glow-effect` - Subtle glow for buttons

### Color Palette
- **Primary:** Blue (accents, links, highlights)
- **Secondary:** Purple (interventions, AI branding)
- **Accent:** Pink (gradients, CTAs)
- **Background:** Slate 900-800 gradient
- **Text:** Slate 100-400

### Components Style Guide
- All components use dark theme
- Consistent border-radius: `rounded-xl` (12px)
- Glassmorphism for panels: `bg-white/5 backdrop-blur-xl`
- Smooth animations: Framer Motion
- Icons: Lucide React

## Extension Points

### Adding New Problems
Edit `MOCK_PROBLEM` in `AssessmentPage.tsx`

### Customizing AI Behavior
Edit prompts in `backend/app/main.py`:
- Line ~100: Watcher prompt
- Line ~200: Summarizer prompt

### Adding New Languages
1. Add to `MOCK_PROBLEM.starterCode`
2. Add option to language selector in `AssessmentPage.tsx`
3. Monaco editor automatically supports most languages

### Changing Intervention Frequency
Modify debounce timeout in `AssessmentPage.tsx`:
```typescript
debounce(async (currentCode: string) => {
  // ...
}, 5000) // Change this value (milliseconds)
```

## Performance Optimizations

1. **Debounced snapshots** - Only send code every 5s, not on every keystroke
2. **Lazy loading** - React Router code-splitting
3. **Monaco editor** - Only loads when needed
4. **Async API calls** - Non-blocking backend requests
5. **In-memory storage** - Fast data access (use Redis in production)

## Security Considerations

### Current (Hackathon)
- CORS enabled for all origins
- No authentication
- In-memory data storage

### Production Recommendations
- [ ] Add authentication (JWT, OAuth)
- [ ] Restrict CORS to frontend domain
- [ ] Use PostgreSQL/MongoDB for data persistence
- [ ] Rate limiting on API endpoints
- [ ] Input validation and sanitization
- [ ] Secure Grok API key (environment variables, secret manager)
- [ ] HTTPS only
- [ ] Add request logging and monitoring

## Testing Strategy

### Manual Testing
1. Test hint system (intentional errors)
2. Test challenge questions (good code)
3. Test voice recording (Chrome/Edge)
4. Test language switching
5. Test recruiter dashboard
6. Test feedback system

### Future Automated Testing
- Unit tests: Utilities, type validators
- Integration tests: API endpoints
- E2E tests: Cypress/Playwright for user flows

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy dist/ folder
```

### Backend (Railway/Render)
```bash
cd frontend/backend
# Set GROK_API_KEY environment variable
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

### Backend `.env`
```bash
GROK_API_KEY=xai-xxxxxxxxxxxxx
GROK_API_URL=https://api.x.ai/v1/chat/completions
```

### Frontend
Update `API_BASE` in:
- `AssessmentPage.tsx`
- `RecruiterDashboard.tsx`

```typescript
const API_BASE = 'https://your-backend.com';
```

## Troubleshooting

See QUICKSTART.md for common issues and solutions.

---

**Last Updated:** December 2024
**Version:** 1.0.0 (Hackathon MVP)
