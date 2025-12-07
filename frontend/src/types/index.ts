export type InterventionType = 'challenge';

export interface Intervention {
  id: string;
  type: InterventionType;
  title: string;
  content: string;
  timestamp: number;
  mandatory?: boolean;
  voiceResponse?: boolean;
}

export interface CodeSnapshot {
  code: string;
  timestamp: number;
  language: string;
}

export interface CandidateResponse {
  interventionId: string;
  response: string;
  isVoice: boolean;
  timestamp: number;
}

export interface AssessmentSummary {
  candidateId: string;
  problemId: string;
  startTime: number;
  endTime: number;
  codeEvolution: CodeSnapshot[];
  interventions: Intervention[];
  responses: CandidateResponse[];
  finalCode: string;
  overallRating: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  starterCode: Record<string, string>; // Python code only
  testCases?: Array<{
    input: string;
    output: string;
  }>;
}
