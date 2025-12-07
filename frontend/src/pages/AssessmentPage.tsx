import { useState, useEffect, useCallback, useRef } from 'react';
import { Code2, Send, Play } from 'lucide-react';
import { CodeEditor } from '../components/CodeEditor';
import { ProblemPanel } from '../components/ProblemPanel';
import { HintToast } from '../components/HintToast';
import { InterventionModal } from '../components/InterventionModal';
import { TestResults } from '../components/TestResults';
import { debounce } from '../lib/utils';
import type { Problem, Intervention, CodeSnapshot, CandidateResponse } from '../types';

// Mock problem for demo
const MOCK_PROBLEM: Problem = {
  id: 'two-sum',
  title: 'Two Sum',
  description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Constraints:**
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.

**Example 1:**
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

**Example 2:**
Input: nums = [3,2,4], target = 6
Output: [1,2]`,
  starterCode: {
    python: `def twoSum(nums, target):
    # Your code here
    pass`,
    javascript: `function twoSum(nums, target) {
    // Your code here
}`,
  },
  testCases: [
    {
      input: '[2,7,11,15], 9',
      output: '[0, 1]',
    },
    {
      input: '[3,2,4], 6',
      output: '[1, 2]',
    },
    {
      input: '[3,3], 6',
      output: '[0, 1]',
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
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

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

  const handleRunCode = async () => {
    if (!problem.testCases || problem.testCases.length === 0) {
      alert('No test cases available for this problem');
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(`${API_BASE}/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          testCases: problem.testCases,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults(data);
      } else {
        alert('Failed to run code. Please try again.');
      }
    } catch (error) {
      console.error('Error running code:', error);
      alert('Failed to run code. Make sure the backend is running.');
    } finally {
      setIsRunning(false);
    }
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
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Code'}
            </button>

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

      {testResults && (
        <TestResults
          results={testResults.results}
          totalTests={testResults.totalTests}
          passedTests={testResults.passedTests}
          onClose={() => setTestResults(null)}
        />
      )}
    </div>
  );
}
