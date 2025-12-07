import { CheckCircle2, XCircle, Clock, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  error?: string;
  executionTime?: number;
  stdout?: string;
  stderr?: string;
}

interface TestResultsProps {
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  onClose: () => void;
}

export function TestResults({ results, totalTests, passedTests, onClose }: TestResultsProps) {
  const allPassed = passedTests === totalTests;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-2.5 rounded-lg",
              allPassed ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {allPassed ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Test Results</h2>
              <p className="text-sm text-slate-400 mt-1">
                {passedTests} of {totalTests} tests passed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={cn(
                "glass-effect rounded-lg p-4 border",
                result.passed ? "border-green-500/30" : "border-red-500/30"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span className={cn(
                    "font-semibold",
                    result.passed ? "text-green-400" : "text-red-400"
                  )}>
                    Test Case {idx + 1}
                  </span>
                </div>
                {result.executionTime !== undefined && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{(result.executionTime * 1000).toFixed(0)}ms</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Input:</span>
                  <pre className="mt-1 text-sm text-blue-300 font-mono bg-slate-800/50 p-2 rounded overflow-x-auto">
                    {result.input}
                  </pre>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Expected Output:</span>
                  <pre className="mt-1 text-sm text-slate-300 font-mono bg-slate-800/50 p-2 rounded overflow-x-auto">
                    {result.expectedOutput}
                  </pre>
                </div>

                {result.stdout && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Console Output (stdout):</span>
                    <pre className="mt-1 text-sm text-cyan-300 font-mono bg-slate-800/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {result.actualOutput !== undefined && (
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Actual Output (last line):</span>
                    <pre className={cn(
                      "mt-1 text-sm font-mono bg-slate-800/50 p-2 rounded overflow-x-auto",
                      result.passed ? "text-green-300" : "text-red-300"
                    )}>
                      {result.actualOutput}
                    </pre>
                  </div>
                )}

                {result.error && (
                  <div>
                    <span className="text-xs font-semibold text-red-400 uppercase">Error:</span>
                    <pre className="mt-1 text-sm text-red-300 font-mono bg-red-900/20 p-2 rounded overflow-x-auto border border-red-500/30 whitespace-pre-wrap">
                      {result.error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
