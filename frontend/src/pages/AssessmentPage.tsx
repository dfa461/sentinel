import { useState, useEffect, useCallback, useRef } from 'react';
import { Code2, Send } from 'lucide-react';
import { CodeEditor } from '../components/CodeEditor';
import { ProblemPanel } from '../components/ProblemPanel';
import { HintToast } from '../components/HintToast';
import { InterventionModal } from '../components/InterventionModal';
import { debounce } from '../lib/utils';
import type { Problem, Intervention, CodeSnapshot, CandidateResponse } from '../types';

// Mock problem for demo
const MOCK_PROBLEM: Problem = {
  id: 'binary-tree-invert',
  title: 'Invert Binary Tree',
  difficulty: 'medium',
  description: `Given the root of a binary tree, invert the tree, and return its root.

Inverting a binary tree means swapping the left and right children of all nodes in the tree.

**Constraints:**
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

**Follow-up:**
Can you solve this both recursively and iteratively?`,
  starterCode: {
    python: `# Definition for a binary tree node.
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def invertTree(root: TreeNode) -> TreeNode:
    # Your code here
    pass`,
    javascript: `// Definition for a binary tree node.
function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val)
    this.left = (left===undefined ? null : left)
    this.right = (right===undefined ? null : right)
}

function invertTree(root) {
    // Your code here
}`,
  },
  testCases: [
    {
      input: 'root = [4,2,7,1,3,6,9]',
      output: '[4,7,2,9,6,3,1]',
    },
    {
      input: 'root = [2,1,3]',
      output: '[2,3,1]',
    },
  ],
};

const API_BASE = 'http://localhost:8000';

export function AssessmentPage() {
  const [problem] = useState<Problem>(MOCK_PROBLEM);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(MOCK_PROBLEM.starterCode.python);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [currentIntervention, setCurrentIntervention] = useState<Intervention | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [responses, setResponses] = useState<CandidateResponse[]>([]);

  const startTimeRef = useRef(Date.now());

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Send code snapshot to backend
  const sendSnapshot = useCallback(
    debounce(async (currentCode: string) => {
      try {
        const snapshot: CodeSnapshot = {
          code: currentCode,
          timestamp: Date.now(),
          language,
        };

        setSnapshots((prev) => [...prev, snapshot]);

        const response = await fetch(`${API_BASE}/submit-snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            problem: problem.description,
            language,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.intervention_needed) {
            if (data.type === 'hint') {
              setCurrentHint(data.content);
            } else if (data.type === 'challenge') {
              const intervention: Intervention = {
                id: Date.now().toString(),
                type: 'challenge',
                title: 'AI Challenge Question',
                content: data.content,
                timestamp: Date.now(),
                mandatory: true,
                voiceResponse: true,
              };
              setCurrentIntervention(intervention);
              setIsModalOpen(true);
            }
          }
        }
      } catch (error) {
        console.error('Error sending snapshot:', error);
      }
    }, 5000),
    [language, problem]
  );

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    sendSnapshot(newCode);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCode(MOCK_PROBLEM.starterCode[newLang] || '');
  };

  const handleInterventionResponse = (response: string, isVoice: boolean) => {
    if (!currentIntervention) return;

    const candidateResponse: CandidateResponse = {
      interventionId: currentIntervention.id,
      response,
      isVoice,
      timestamp: Date.now(),
    };

    setResponses((prev) => [...prev, candidateResponse]);
    setIsModalOpen(false);
    setCurrentIntervention(null);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_BASE}/submit-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: 'demo-candidate',
          problemId: problem.id,
          finalCode: code,
          language,
          snapshots,
          responses,
          elapsedTime,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to results page
        window.location.href = `/results/${data.assessmentId}`;
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="glass-effect border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Sentinel Assessment
              </h1>
              <p className="text-xs text-slate-400">
                AI-Powered Technical Screening
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>

            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-green-500/50"
            >
              <Send className="w-4 h-4" />
              Submit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problem Panel */}
        <div className="w-1/3 border-r border-slate-700">
          <ProblemPanel problem={problem} elapsedTime={elapsedTime} />
        </div>

        {/* Editor */}
        <div className="flex-1 p-4">
          <CodeEditor
            code={code}
            onChange={handleCodeChange}
            language={language}
          />
        </div>
      </div>

      {/* Interventions */}
      <HintToast
        hint={currentHint || ''}
        onDismiss={() => setCurrentHint(null)}
        isVisible={!!currentHint}
      />

      <InterventionModal
        intervention={currentIntervention}
        onSubmit={handleInterventionResponse}
        isOpen={isModalOpen}
      />
    </div>
  );
}
