import { useState, useEffect, useCallback, useRef } from 'react';
import { Code2, Send, Activity, Brain } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { CodeEditor } from '../components/CodeEditor';
import { ProblemPanel } from '../components/ProblemPanel';
import { HintToast } from '../components/HintToast';
import { InterventionModal } from '../components/InterventionModal';
import { ThoughtProcessModal } from '../components/ThoughtProcessModal';
import { HintSystem } from '../components/HintSystem';
import { CodeExecutionPanel } from '../components/CodeExecutionPanel';
import { debounce } from '../lib/utils';
import type { Problem, Intervention } from '../types';
import type {
  AssessmentState,
  ProgressMetrics,
  ThoughtProcessQuery,
  AdaptiveHint,
  CodeExecutionResult,
  MonitoringEvent,
  RLFeedbackSignal,
} from '../types/monitoring';
import { MERGE_INTERVALS } from '../data/problems';

const API_BASE = 'http://localhost:8000';
const RL_API_BASE = 'http://localhost:8000/api/rl';
const PAUSE_THRESHOLD = 15000; // 15 seconds
const LONG_PAUSE_THRESHOLD = 30000; // 30 seconds
const NO_PROGRESS_THRESHOLD = 300000; // 5 minutes
const PAUSE_COOLDOWN = 300000; // 5 minutes between pause interventions
const ASSESSMENT_GRACE_PERIOD = 300000; // 5 minutes before starting pause detection

export function InteractiveAssessmentPage() {
  const [problem] = useState<Problem>(MERGE_INTERVALS);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(MERGE_INTERVALS.starterCode.python);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Original intervention states
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [currentIntervention, setCurrentIntervention] = useState<Intervention | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New interactive states
  const [thoughtProcessQuery, setThoughtProcessQuery] = useState<ThoughtProcessQuery | null>(null);
  const [isThoughtModalOpen, setIsThoughtModalOpen] = useState(false);
  const [isEvaluatingThought, setIsEvaluatingThought] = useState(false);
  const [thoughtEvaluation, setThoughtEvaluation] = useState<any>(null);

  // Hint system states
  const [hintsUsed, setHintsUsed] = useState<AdaptiveHint[]>([]);
  const [currentAdaptiveHint, setCurrentAdaptiveHint] = useState<AdaptiveHint | null>(null);
  const [hintsRemaining, setHintsRemaining] = useState(3);

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
    hintsRemaining: 3,
  });

  // Monitoring states
  const [monitoringEvents, setMonitoringEvents] = useState<MonitoringEvent[]>([]);
  const [rlSignals, setRlSignals] = useState<RLFeedbackSignal[]>([]);

  // Refs for tracking
  const startTimeRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const lastPauseInterventionRef = useRef<number>(0); // Track last pause intervention time
  const pauseCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noProgressCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const codeBeforePauseRef = useRef(code);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Pause Detection System
  useEffect(() => {
    // Check for pauses every 2 seconds
    pauseCheckIntervalRef.current = setInterval(() => {
      const timeSinceStart = Date.now() - startTimeRef.current;
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      const timeSinceLastPauseIntervention = Date.now() - lastPauseInterventionRef.current;
      const codeChanged = code !== codeBeforePauseRef.current;

      // Only start pause detection after grace period (5 minutes)
      if (timeSinceStart < ASSESSMENT_GRACE_PERIOD) {
        return;
      }

      // Cooldown check - don't trigger if less than 5 minutes since last intervention
      if (lastPauseInterventionRef.current > 0 && timeSinceLastPauseIntervention < PAUSE_COOLDOWN) {
        return;
      }

      // Significant pause detected (15-30 seconds)
      if (
        timeSinceLastActivity >= PAUSE_THRESHOLD &&
        timeSinceLastActivity < LONG_PAUSE_THRESHOLD &&
        !isThoughtModalOpen &&
        !isModalOpen &&
        code.trim().length > 50 // Only if some code written
      ) {
        handlePauseDetected(timeSinceLastActivity / 1000);
      }

      // Long pause without changes (30+ seconds)
      if (
        timeSinceLastActivity >= LONG_PAUSE_THRESHOLD &&
        !codeChanged &&
        !isThoughtModalOpen &&
        code.trim().length > 50
      ) {
        handleLongPauseDetected();
      }
    }, 2000);

    return () => {
      if (pauseCheckIntervalRef.current) {
        clearInterval(pauseCheckIntervalRef.current);
      }
    };
  }, [code, isThoughtModalOpen, isModalOpen]);

  // No Progress Detection
  useEffect(() => {
    noProgressCheckIntervalRef.current = setInterval(() => {
      const timeSinceLastChange = Date.now() - progressMetrics.lastChangeTimestamp;

      if (
        timeSinceLastChange >= NO_PROGRESS_THRESHOLD &&
        hintsRemaining > 0 &&
        !currentAdaptiveHint
      ) {
        handleNoProgressDetected();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (noProgressCheckIntervalRef.current) {
        clearInterval(noProgressCheckIntervalRef.current);
      }
    };
  }, [progressMetrics.lastChangeTimestamp, hintsRemaining, currentAdaptiveHint]);

  const handlePauseDetected = async (pauseDuration: number) => {
    console.log('Pause detected:', pauseDuration, 'seconds');

    // Record the time of this intervention
    lastPauseInterventionRef.current = Date.now();

    // Record monitoring event
    const event: MonitoringEvent = {
      id: Date.now().toString(),
      type: 'pause_detected',
      timestamp: Date.now(),
      metadata: {
        pauseDuration,
        lastCodeSnapshot: code,
        lineCount: code.split('\n').length,
      },
    };
    setMonitoringEvents((prev) => [...prev, event]);

    // Generate Socratic question
    try {
      const response = await fetch(`${RL_API_BASE}/generate-socratic-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          problem: problem.description,
          language,
          pauseDuration,
          progressMetrics,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const query: ThoughtProcessQuery = {
          id: Date.now().toString(),
          question: data.question,
          context: `You paused for ${Math.round(pauseDuration)} seconds`,
          timestamp: Date.now(),
          responseRequired: true,
        };
        setThoughtProcessQuery(query);
        setIsThoughtModalOpen(true);
        codeBeforePauseRef.current = code;
      }
    } catch (error) {
      console.error('Error generating Socratic question:', error);
    }
  };

  const handleLongPauseDetected = () => {
    console.log('Long pause detected - might be stuck');
    // Could trigger hint or different intervention
  };

  const handleNoProgressDetected = async () => {
    console.log('No progress detected - offering hint');
    await requestHint('no_progress');
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);

    // Update activity tracking
    lastActivityRef.current = Date.now();

    // Update progress metrics
    setProgressMetrics((prev) => ({
      ...prev,
      linesWritten: newCode.split('\n').length,
      lastChangeTimestamp: Date.now(),
      totalChanges: prev.totalChanges + 1,
      codeComplexity: calculateComplexity(newCode),
    }));

    // Send snapshot for monitoring
    debouncedSnapshot(newCode);
  };

  const calculateComplexity = (code: string): number => {
    // Simple complexity heuristic
    const lines = code.split('\n').filter((l) => l.trim().length > 0).length;
    const keywords = (code.match(/\b(if|else|for|while|def|class|return)\b/g) || []).length;
    return Math.min(100, (lines + keywords * 2) / 2);
  };

  const debouncedSnapshot = useCallback(
    debounce(async (currentCode: string) => {
      try {
        const response = await fetch(`${RL_API_BASE}/monitor-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            problem: problem.description,
            language,
            progressMetrics,
            monitoringEvents,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Handle quality check interventions
          if (data.intervention_needed && data.type === 'quality_feedback') {
            setCurrentHint(data.content);
          }
        }
      } catch (error) {
        console.error('Error monitoring progress:', error);
      }
    }, 5000),
    [language, problem, progressMetrics, monitoringEvents]
  );

  const handleThoughtProcessSubmit = async (response: string, isVoice: boolean) => {
    if (!thoughtProcessQuery) return;

    setIsEvaluatingThought(true);

    try {
      // Send to Grok for evaluation
      const apiResponse = await fetch(`${RL_API_BASE}/evaluate-thought-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: thoughtProcessQuery.question,
          response,
          code,
          problem: problem.description,
        }),
      });

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        setThoughtEvaluation(data.evaluation);

        // Record RL signal
        const rlSignal: RLFeedbackSignal = {
          eventId: thoughtProcessQuery.id,
          eventType: 'pause_detected',
          action: 'asked_thought_process',
          reward: data.evaluation.isOnRightTrack ? 0.8 : 0.3,
          state: {
            codeQuality: progressMetrics.codeComplexity,
            progressRate: progressMetrics.totalChanges / elapsedTime,
            engagementLevel: 0.8,
          },
        };
        setRlSignals((prev) => [...prev, rlSignal]);

        // Auto-close modal after 3 seconds of showing feedback
        setTimeout(() => {
          setIsThoughtModalOpen(false);
          setThoughtEvaluation(null);
          setThoughtProcessQuery(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error evaluating thought process:', error);
    } finally {
      setIsEvaluatingThought(false);
    }
  };

  const requestHint = async (context: string = 'manual_request') => {
    if (hintsRemaining <= 0) {
      alert('No hints remaining!');
      return;
    }

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
        setHintsRemaining((prev) => prev - 1);

        // Update metrics
        setProgressMetrics((prev) => ({
          ...prev,
          hintsRemaining: prev.hintsRemaining - 1,
        }));

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
    }
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
          if (progressMetrics.consecutiveFailures >= 2 && hintsRemaining > 0) {
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

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCode(MERGE_INTERVALS.starterCode[newLang] || '');
  };

  const handleSubmit = async () => {
    // Submit assessment with all RL data
    try {
      const response = await fetch(`${RL_API_BASE}/submit-rl-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: 'demo-candidate',
          problemId: problem.id,
          finalCode: code,
          language,
          progressMetrics,
          monitoringEvents,
          hintsUsed,
          executionAttempts: lastExecutionResult ? [lastExecutionResult] : [],
          rlSignals,
          elapsedTime,
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
      <header className="glass-effect border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl relative">
              <Code2 className="w-6 h-6 text-white" />
              <Activity className="w-3 h-3 text-white absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Interactive AI Assessment
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                  RL-Powered
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Socratic Learning + Real-time Monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass-effect px-4 py-2 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-300">
                  AI actively monitoring
                </span>
              </div>
            </div>

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
              <Panel defaultSize={60} minSize={30} className="p-4">
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
        hintsRemaining={hintsRemaining}
        currentHint={currentAdaptiveHint}
        onDismiss={() => setCurrentAdaptiveHint(null)}
        onRequestHint={() => requestHint('manual_request')}
        canRequestHint={true}
      />

      {/* Simple Hint Toast */}
      <HintToast hint={currentHint || ''} onDismiss={() => setCurrentHint(null)} isVisible={!!currentHint} />

      {/* Thought Process Modal */}
      <ThoughtProcessModal
        query={thoughtProcessQuery}
        onSubmit={handleThoughtProcessSubmit}
        isOpen={isThoughtModalOpen}
        isEvaluating={isEvaluatingThought}
        evaluation={thoughtEvaluation}
      />

      {/* Original Intervention Modal */}
      <InterventionModal
        intervention={currentIntervention}
        onSubmit={(response, isVoice) => {
          setIsModalOpen(false);
          setCurrentIntervention(null);
        }}
        isOpen={isModalOpen}
      />
    </div>
  );
}
