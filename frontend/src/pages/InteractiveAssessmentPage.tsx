import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Code2, Send, Activity, CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { CodeEditor } from '../components/CodeEditor';
import { ProblemPanel } from '../components/ProblemPanel';
import { HintToast } from '../components/HintToast';
import { InterventionModal } from '../components/InterventionModal';
import { HintSystem } from '../components/HintSystem';
import { CodeExecutionPanel } from '../components/CodeExecutionPanel';
import { ResumeUploadModal } from '../components/ResumeUploadModal';
import type { Problem, Intervention } from '../types';
import type {
  ProgressMetrics,
  AdaptiveHint,
  CodeExecutionResult,
  MonitoringEvent,
  RLFeedbackSignal,
  ChallengeTodo,
} from '../types/monitoring';
import { TOP_K_FREQUENT_ELEMENTS } from '../data/problems';
import { cn } from '../lib/utils';
import type { CandidateInfo } from '../components/CandidateInfoModal';

const RL_API_BASE = 'http://localhost:8000/api/rl';

export function InteractiveAssessmentPage() {
  const location = useLocation();
  const candidateInfo = (location.state as { candidateInfo?: CandidateInfo })?.candidateInfo;

  // Use default problem (can be randomized if desired)
  const initialProblem = TOP_K_FREQUENT_ELEMENTS;

  const [problem, setProblem] = useState<Problem>(initialProblem);
  const [language, setLanguage] = useState<'python' | 'java'>('python');
  const [code, setCode] = useState(initialProblem.starterCode.python || '');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResumeModal, setShowResumeModal] = useState(true); // Show on load
  const [hasUploadedResume, setHasUploadedResume] = useState(false);

  // Original intervention states
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [currentIntervention, setCurrentIntervention] = useState<Intervention | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  // Hint system states
  const [hintsUsed, setHintsUsed] = useState<AdaptiveHint[]>([]);
  const [currentAdaptiveHint, setCurrentAdaptiveHint] = useState<AdaptiveHint | null>(null);
  const [isRequestingHint, setIsRequestingHint] = useState(false);

  // Execution states
  const [lastExecutionResult, setLastExecutionResult] = useState<CodeExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionAttemptCount, setExecutionAttemptCount] = useState(0);

  // Progress tracking
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetrics>({
    linesWritten: 0,
    codeComplexity: 0,
    lastChangeTimestamp: Date.now(),
    totalChanges: 0,
    consecutiveFailures: 0,
    hintsRemaining: 999, // Effectively unlimited
  });

  // Monitoring states
  const [monitoringEvents, setMonitoringEvents] = useState<MonitoringEvent[]>([]);
  const [rlSignals, setRlSignals] = useState<RLFeedbackSignal[]>([]);

  // Challenge TODO states
  const [challengeTodos, setChallengeTodos] = useState<ChallengeTodo[]>([]);
  const [isTodoDropdownOpen, setIsTodoDropdownOpen] = useState(false);

  // Code snapshots tracking
  const [codeSnapshots, setCodeSnapshots] = useState<Array<{ timestamp: number; code: string; label: string }>>([]);

  // Analytics tracking
  const [analyticsData, setAnalyticsData] = useState({
    charactersTyped: 0,
    deletions: 0,
    keystrokes: 0,
  });

  // Refs for tracking
  const startTimeRef = useRef(Date.now());
  const monitoringEventsRef = useRef<MonitoringEvent[]>(monitoringEvents);
  const lastChallengeCodeRef = useRef<string>(''); // Track code snapshot from last challenge
  const lastChallengeTimeRef = useRef<number>(0); // Track when last challenge was generated
  const previousCodeRef = useRef<string>(''); // Track previous code for analytics

  // Keep ref in sync with state
  useEffect(() => {
    monitoringEventsRef.current = monitoringEvents;
  }, [monitoringEvents]);

  // Close TODO dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isTodoDropdownOpen && !target.closest('.todo-dropdown-container')) {
        setIsTodoDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTodoDropdownOpen]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Code snapshot tracking - capture every 10 seconds
  useEffect(() => {
    const snapshotInterval = setInterval(() => {
      const currentTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const minutes = Math.floor(currentTime / 60);
      const seconds = currentTime % 60;
      const label = `Snapshot at ${minutes}:${seconds.toString().padStart(2, '0')}`;

      setCodeSnapshots((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          code: code,
          label,
          linesOfCode: code.split('\n').length,
        },
      ]);
    }, 10000); // Every 10 seconds

    return () => clearInterval(snapshotInterval);
  }, [code]);


  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    const prevCode = previousCodeRef.current;

    // Track analytics
    const lengthDiff = newCode.length - prevCode.length;
    if (lengthDiff > 0) {
      // Characters added
      setAnalyticsData(prev => ({
        ...prev,
        charactersTyped: prev.charactersTyped + lengthDiff,
        keystrokes: prev.keystrokes + lengthDiff,
      }));
    } else if (lengthDiff < 0) {
      // Characters deleted
      setAnalyticsData(prev => ({
        ...prev,
        deletions: prev.deletions + Math.abs(lengthDiff),
        keystrokes: prev.keystrokes + Math.abs(lengthDiff),
      }));
    }

    previousCodeRef.current = newCode;
    setCode(newCode);

    // Update progress metrics
    setProgressMetrics((prev) => ({
      ...prev,
      linesWritten: newCode.split('\n').length,
      lastChangeTimestamp: Date.now(),
      totalChanges: prev.totalChanges + 1,
      codeComplexity: calculateComplexity(newCode),
    }));
  };

  const calculateComplexity = (code: string): number => {
    // Simple complexity heuristic
    const lines = code.split('\n').filter((l) => l.trim().length > 0).length;
    const keywords = (code.match(/\b(if|else|for|while|def|class|return)\b/g) || []).length;
    return Math.min(100, (lines + keywords * 2) / 2);
  };

  const handleLanguageChange = (newLanguage: 'python' | 'java') => {
    setLanguage(newLanguage);
    // Update code to the new language's starter code
    const newCode = problem.starterCode[newLanguage] || problem.starterCode.python;
    setCode(newCode);
    // Reset execution states
    setLastExecutionResult(null);
    setExecutionAttemptCount(0);
  };

  // Fixed interval monitoring - snapshots code every 15 seconds
  useEffect(() => {
    const MONITORING_INTERVAL = 15000; // 15 seconds
    const CHALLENGE_COOLDOWN = 30000; // 30 seconds between challenges
    const MIN_CODE_CHANGE = 20; // Minimum character change threshold

    const monitoringInterval = setInterval(async () => {
      try {
        // Check if enough time has passed since last challenge (cooldown)
        const timeSinceLastChallenge = Date.now() - lastChallengeTimeRef.current;
        if (lastChallengeTimeRef.current > 0 && timeSinceLastChallenge < CHALLENGE_COOLDOWN) {
          console.log(`[Monitor] Cooldown active: ${Math.round((CHALLENGE_COOLDOWN - timeSinceLastChallenge) / 1000)}s remaining`);
          return;
        }

        // Check if code has changed significantly since last challenge
        const codeChangeAmount = Math.abs(code.length - lastChallengeCodeRef.current.length);
        if (lastChallengeCodeRef.current && codeChangeAmount < MIN_CODE_CHANGE) {
          console.log(`[Monitor] Insufficient code change: ${codeChangeAmount} chars (need ${MIN_CODE_CHANGE})`);
          return;
        }

        // Check if code is substantial enough (at least 80 characters beyond starter code)
        if (code.trim().length < 80) {
          console.log('[Monitor] Code too short, skipping');
          return;
        }

        console.log('[Monitor] Checking for intervention...');

        const response = await fetch(`${RL_API_BASE}/monitor-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            previousChallengeCode: lastChallengeCodeRef.current,
            problem: problem.description,
            language,
            progressMetrics,
            monitoringEvents,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Add challenge questions to TODO list instead of showing immediately
          if (data.intervention_needed && data.type === 'challenge') {
            const challengeTodo: ChallengeTodo = {
              id: Date.now().toString(),
              question: data.content,
              timestamp: Date.now(),
              completed: false,
              codeSnapshot: code,
            };
            setChallengeTodos((prev) => [...prev, challengeTodo]);

            // Update the last challenge code snapshot and timestamp
            lastChallengeCodeRef.current = code;
            lastChallengeTimeRef.current = Date.now();
            console.log('[Monitor] Challenge generated!');
          } else {
            console.log('[Monitor] No intervention needed');
          }
        }
      } catch (error) {
        console.error('Error monitoring progress:', error);
      }
    }, MONITORING_INTERVAL);

    return () => clearInterval(monitoringInterval);
  }, [code, problem.description, language, progressMetrics, monitoringEvents]);


  const requestHint = async (context: string = 'manual_request') => {
    setIsRequestingHint(true);
    try {
      const response = await fetch(`${RL_API_BASE}/generate-adaptive-hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          problem: problem.description,
          language,
          progressMetrics,
          executionAttempts: lastExecutionResult ? [lastExecutionResult] : [],
          context,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const hint: AdaptiveHint = {
          id: Date.now().toString(),
          content: data.hint,
          context: data.reasoning,
          timestamp: Date.now(),
          used: true,
        };

        setHintsUsed((prev) => [...prev, hint]);
        setCurrentAdaptiveHint(hint);

        // Record RL signal
        const rlSignal: RLFeedbackSignal = {
          eventId: hint.id,
          eventType: 'hint_used',
          action: 'provided_hint',
          reward: 0.5, // Will update based on effectiveness
          state: {
            codeQuality: progressMetrics.codeComplexity,
            progressRate: progressMetrics.totalChanges / elapsedTime,
            engagementLevel: 0.6,
          },
        };
        setRlSignals((prev) => [...prev, rlSignal]);
      }
    } catch (error) {
      console.error('Error requesting hint:', error);
    } finally {
      setIsRequestingHint(false);
    }
  };

  const handleChallengeTodoClick = (todo: ChallengeTodo) => {
    // Open the intervention modal with the challenge question
    const intervention: Intervention = {
      id: todo.id,
      type: 'challenge',
      title: 'Challenge Question',
      content: todo.question,
      timestamp: todo.timestamp,
      mandatory: true,
      voiceResponse: true,
    };
    setCurrentIntervention(intervention);
    setIsModalOpen(true);
    setIsTodoDropdownOpen(false);
  };

  const handleInterventionResponse = (response: string, isVoice: boolean) => {
    if (!currentIntervention) return;

    // Mark the challenge TODO as completed
    setChallengeTodos((prev) =>
      prev.map((todo) =>
        todo.id === currentIntervention.id
          ? { ...todo, completed: true, response }
          : todo
      )
    );

    // Record monitoring event
    const event: MonitoringEvent = {
      id: Date.now().toString(),
      type: 'thought_process_verified',
      timestamp: Date.now(),
      metadata: {
        challengeId: currentIntervention.id,
        response,
        isVoice,
      },
    };
    setMonitoringEvents((prev) => [...prev, event]);

    // Close modal
    setIsModalOpen(false);
    setCurrentIntervention(null);
  };

  const handleExecuteCode = async (): Promise<CodeExecutionResult> => {
    setIsExecuting(true);
    setExecutionAttemptCount((prev) => prev + 1);

    try {
      const response = await fetch(`${RL_API_BASE}/execute-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          testCases: problem.testCases || [],
        }),
      });

      if (response.ok) {
        const result: CodeExecutionResult = await response.json();
        setLastExecutionResult(result);

        // Handle failures
        if (!result.success) {
          setProgressMetrics((prev) => ({
            ...prev,
            consecutiveFailures: prev.consecutiveFailures + 1,
          }));

          // After 2-3 failures, suggest hint
          if (progressMetrics.consecutiveFailures >= 2) {
            setTimeout(() => {
              if (confirm('You\'ve had a few failed attempts. Would you like a hint?')) {
                requestHint('execution_failures');
              }
            }, 1000);
          }
        } else {
          // Reset consecutive failures on success
          setProgressMetrics((prev) => ({
            ...prev,
            consecutiveFailures: 0,
          }));
        }

        return result;
      }
    } catch (error) {
      console.error('Error executing code:', error);
    } finally {
      setIsExecuting(false);
    }

    return { success: false, error: 'Execution failed' };
  };

  const handleResumeUploaded = (questionData: any) => {
    // Update problem with generated question
    const customProblem: Problem = {
      id: 'custom-resume-based',
      title: questionData.problem_title,
      description: questionData.problem_description,
      starterCode: {
        python: questionData.starter_code_python,
        java: questionData.starter_code_java || questionData.starter_code_python
      },
      testCases: questionData.test_cases
    };

    setProblem(customProblem);
    setCode(customProblem.starterCode[language]);
    setShowResumeModal(false);
    setHasUploadedResume(true);
  };


  const handleSubmit = async () => {
    // Submit assessment with all RL data including challenge TODOs
    try {
      // Add final snapshot if not already captured
      const finalSnapshot = {
        timestamp: Date.now(),
        code: code,
        label: 'Final Submission',
      };

      const response = await fetch(`${RL_API_BASE}/submit-rl-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidateInfo?.email || 'demo-candidate',
          candidateName: candidateInfo?.name || 'Demo Candidate',
          candidateEmail: candidateInfo?.email || 'demo@example.com',
          contactEmail: candidateInfo?.contactEmail || 'demo@example.com',
          problemId: problem.id,
          problemTitle: problem.title,
          problemDescription: problem.description,
          finalCode: code,
          language,
          progressMetrics,
          monitoringEvents,
          hintsUsed,
          executionAttempts: lastExecutionResult ? [lastExecutionResult] : [],
          rlSignals,
          elapsedTime,
          codeSnapshots: [...codeSnapshots, finalSnapshot],
          analyticsData,
          challengeTodos: challengeTodos.map(todo => ({
            question: todo.question,
            response: todo.response || '',
            timestamp: todo.timestamp,
            completed: todo.completed,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = `/results/${data.assessmentId}`;
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="glass-effect border-b border-slate-700 px-6 py-4 relative z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl relative">
              <Code2 className="w-6 h-6 text-white" />
              <Activity className="w-3 h-3 text-white absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Sentinel
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Challenge TODOs Dropdown */}
            {challengeTodos.length > 0 && (
              <div className="relative todo-dropdown-container">
                <button
                  onClick={() => setIsTodoDropdownOpen(!isTodoDropdownOpen)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    challengeTodos.every((t) => t.completed)
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                  }`}
                >
                  {challengeTodos.filter((t) => !t.completed).length > 0 ? (
                    <Circle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    TODOs ({challengeTodos.filter((t) => !t.completed).length}/
                    {challengeTodos.length})
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {isTodoDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-96 glass-effect rounded-lg border border-slate-700 shadow-2xl z-[100] max-h-96 overflow-y-auto">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">
                        Challenge Questions
                      </h3>
                      <div className="space-y-2">
                        {challengeTodos.map((todo) => (
                          <button
                            key={todo.id}
                            onClick={() => handleChallengeTodoClick(todo)}
                            disabled={todo.completed}
                            className={`w-full text-left p-3 rounded-lg transition-all ${
                              todo.completed
                                ? 'bg-green-500/10 border border-green-500/30 cursor-default'
                                : 'bg-slate-800/50 border border-slate-700 hover:border-blue-500 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {todo.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm ${
                                    todo.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                                  }`}
                                >
                                  {todo.question}
                                </p>
                                {todo.completed && todo.response && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    ✓ Answered
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Language Switcher */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => handleLanguageChange('python')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-all',
                  language === 'python'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Python
              </button>
              <button
                onClick={() => handleLanguageChange('java')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded transition-all',
                  language === 'java'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Java
              </button>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={challengeTodos.some((t) => !t.completed)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all shadow-lg ${
                challengeTodos.some((t) => !t.completed)
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white hover:shadow-green-500/50'
              }`}
              title={
                challengeTodos.some((t) => !t.completed)
                  ? 'Complete all challenge questions first'
                  : 'Submit assessment'
              }
            >
              <Send className="w-4 h-4" />
              Submit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Problem Panel - Resizable */}
          <Panel
            defaultSize={25}
            minSize={15}
            maxSize={40}
            className="border-r border-slate-700"
          >
            <ProblemPanel problem={problem} elapsedTime={elapsedTime} />
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-1 hover:w-2 bg-slate-700 hover:bg-blue-500 transition-all cursor-col-resize active:bg-blue-400" />

          {/* Editor & Execution Panel - Resizable */}
          <Panel defaultSize={75} minSize={30}>
            <PanelGroup direction="vertical">
              {/* Code Editor - Resizable */}
              <Panel defaultSize={60} minSize={30}>
                <CodeEditor code={code} onChange={handleCodeChange} language={language} />
              </Panel>

              {/* Vertical Resize Handle */}
              <PanelResizeHandle className="h-1 hover:h-2 bg-slate-700 hover:bg-blue-500 transition-all cursor-row-resize active:bg-blue-400" />

              {/* Execution Panel - Resizable */}
              <Panel defaultSize={40} minSize={20} className="p-4 overflow-auto">
                <CodeExecutionPanel
                  onExecute={handleExecuteCode}
                  lastResult={lastExecutionResult}
                  isExecuting={isExecuting}
                  attemptCount={executionAttemptCount}
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Hint System - Always Visible */}
      <HintSystem
        hints={hintsUsed}
        hintsRemaining={progressMetrics.hintsRemaining}
        currentHint={currentAdaptiveHint}
        onDismiss={() => setCurrentAdaptiveHint(null)}
        onRequestHint={() => requestHint('manual_request')}
        canRequestHint={true}
        isRequestingHint={isRequestingHint}
      />

      {/* Simple Hint Toast */}
      <HintToast hint={currentHint || ''} onDismiss={() => setCurrentHint(null)} isVisible={!!currentHint} />

      {/* Challenge Intervention Modal */}
      <InterventionModal
        intervention={currentIntervention}
        onSubmit={handleInterventionResponse}
        isOpen={isModalOpen}
      />

      {/* Resume Upload Modal */}
      <ResumeUploadModal
        isOpen={showResumeModal}
        onResumeUploaded={handleResumeUploaded}
      />
    </div>
  );
}
