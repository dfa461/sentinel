import { BookOpen, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="glass-effect border-b border-slate-700 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2.5 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {problem.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">{formatTime(elapsedTime)}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="prose prose-invert prose-slate max-w-none">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="text-lg font-bold text-white mt-4 mb-2">{children}</h2>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 text-slate-300 my-2">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="text-slate-300">{children}</li>
              ),
              p: ({ children }) => (
                <p className="text-slate-300 leading-relaxed mb-3">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-white">{children}</strong>
              ),
            }}
          >
            {problem.description}
          </ReactMarkdown>
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
                    <pre className="mt-1 text-sm text-blue-300 font-mono bg-slate-800/50 p-2 rounded overflow-x-auto max-w-full">
                      {testCase.input}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Output:</span>
                    <pre className="mt-1 text-sm text-green-300 font-mono bg-slate-800/50 p-2 rounded overflow-x-auto max-w-full">
                      {testCase.output}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
