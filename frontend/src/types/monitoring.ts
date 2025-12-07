/**
 * Advanced monitoring and RL types for interactive assessment
 */

export type MonitoringEventType =
  | 'pause_detected'
  | 'code_execution_failed'
  | 'no_progress'
  | 'quality_check'
  | 'hint_used'
  | 'thought_process_verified';

export interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface PauseEvent extends MonitoringEvent {
  type: 'pause_detected';
  metadata: {
    pauseDuration: number; // seconds
    lastCodeSnapshot: string;
    lineCount: number;
  };
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  testsPassed?: number;
  testsTotal?: number;
}

export interface ExecutionFailureEvent extends MonitoringEvent {
  type: 'code_execution_failed';
  metadata: {
    error: string;
    attemptNumber: number;
    code: string;
  };
}

export interface ProgressMetrics {
  linesWritten: number;
  codeComplexity: number; // 0-100 scale
  lastChangeTimestamp: number;
  totalChanges: number;
  consecutiveFailures: number;
  hintsRemaining: number;
}

export interface ThoughtProcessQuery {
  id: string;
  question: string;
  context: string; // What triggered this question
  timestamp: number;
  responseRequired: boolean;
}

export interface ThoughtProcessResponse {
  queryId: string;
  response: string;
  isVoice: boolean;
  timestamp: number;
  grokEvaluation?: {
    isOnRightTrack: boolean;
    feedback: string;
    confidence: number; // 0-1
  };
}

export interface AdaptiveHint {
  id: string;
  content: string;
  context: string; // Why this hint was given
  timestamp: number;
  used: boolean;
  effectiveness?: number; // 0-1, measured by subsequent progress
}

export interface SocraticQuestion {
  id: string;
  question: string;
  expectedInsights: string[]; // What we hope they'll realize
  difficulty: 'guiding' | 'probing' | 'challenging';
  timestamp: number;
}

export interface RLFeedbackSignal {
  eventId: string;
  eventType: MonitoringEventType;
  action: string; // What intervention was taken
  reward: number; // -1 to 1, based on outcome
  state: {
    codeQuality: number;
    progressRate: number;
    engagementLevel: number;
  };
  nextState?: {
    codeQuality: number;
    progressRate: number;
    engagementLevel: number;
  };
}

export interface ChallengeTodo {
  id: string;
  question: string;
  timestamp: number;
  completed: boolean;
  response?: string;
  codeSnapshot: string; // Code state when challenge was created
}

export interface AssessmentState {
  currentCode: string;
  progressMetrics: ProgressMetrics;
  monitoringEvents: MonitoringEvent[];
  thoughtProcessHistory: ThoughtProcessResponse[];
  hintsUsed: AdaptiveHint[];
  executionAttempts: CodeExecutionResult[];
  rlSignals: RLFeedbackSignal[];
  challengeTodos: ChallengeTodo[];
}
