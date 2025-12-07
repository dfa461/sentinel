import { BookOpen, Clock, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Problem } from '../types';

interface ProblemPanelProps {
  problem: Problem;
  elapsedTime: number;
}

export function ProblemPanel({ problem, elapsedTime }: ProblemPanelProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const difficultyColors = {
    easy: 'text-green-400 bg-green-400/10 border-green-400/30',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    hard: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="glass-effect border-b border-slate-700 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2.5 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {problem.title}
            </h2>
          </div>

          <span className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border",
            difficultyColors[problem.difficulty]
          )}>
            {problem.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(elapsedTime)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingUp className="w-4 h-4" />
            <span>AI is watching</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {problem.description}
          </div>
        </div>

        {/* Test Cases */}
        {problem.testCases && problem.testCases.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
              Example Test Cases
            </h3>
            {problem.testCases.map((testCase, idx) => (
              <div key={idx} className="glass-effect rounded-lg p-4 border border-slate-700">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Input:</span>
                    <pre className="mt-1 text-sm text-blue-300 font-mono bg-slate-800/50 p-2 rounded">
                      {testCase.input}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Output:</span>
                    <pre className="mt-1 text-sm text-green-300 font-mono bg-slate-800/50 p-2 rounded">
                      {testCase.output}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Coaching Notice */}
        <div className="glass-effect rounded-xl p-4 border-l-4 border-purple-500">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-purple-400 mb-1">
                AI-Assisted Assessment
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                This assessment uses AI to provide real-time hints and ask follow-up questions.
                The AI monitors your progress to help you succeed while evaluating your problem-solving approach.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
