import { useState } from 'react';
import { Play, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CodeExecutionResult } from '../types/monitoring';

interface CodeExecutionPanelProps {
  onExecute: () => Promise<CodeExecutionResult>;
  lastResult: CodeExecutionResult | null;
  isExecuting: boolean;
  attemptCount: number;
}

export function CodeExecutionPanel({
  onExecute,
  lastResult,
  isExecuting,
  attemptCount,
}: CodeExecutionPanelProps) {
  return (
    <div className="glass-effect rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-slate-200">Test & Run</h3>
          </div>
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className={cn(
              "px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2",
              "bg-gradient-to-r from-green-600 to-emerald-600",
              "hover:from-green-500 hover:to-emerald-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-lg hover:shadow-green-500/50"
            )}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
        {attemptCount > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            Attempt #{attemptCount}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="p-4 flex-1 overflow-y-auto">
        {!lastResult && !isExecuting && (
          <div className="text-center py-8 text-slate-400">
            <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click "Run Code" to test your solution</p>
          </div>
        )}

        {isExecuting && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-300">Executing your code...</p>
          </div>
        )}

        {lastResult && !isExecuting && (
          <div className="space-y-3">
            {/* Overall Status */}
            <div
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border-l-4",
                lastResult.success
                  ? "bg-green-500/10 border-green-500"
                  : "bg-red-500/10 border-red-500"
              )}
            >
              {lastResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4
                  className={cn(
                    "font-semibold mb-1",
                    lastResult.success ? "text-green-400" : "text-red-400"
                  )}
                >
                  {lastResult.success ? "All Tests Passed! ✓" : "Some Tests Failed"}
                </h4>
                {lastResult.testsPassed !== undefined && lastResult.testsTotal !== undefined && (
                  <p className="text-sm text-slate-300">
                    {lastResult.testsPassed} / {lastResult.testsTotal} test cases passed
                  </p>
                )}
              </div>
            </div>

            {/* Individual Test Results */}
            {lastResult.results && lastResult.results.length > 0 && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase">
                  Test Results
                </label>
                {lastResult.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    className={cn(
                      "rounded-lg border p-3 space-y-2",
                      result.passed
                        ? "bg-green-500/5 border-green-500/30"
                        : "bg-red-500/5 border-red-500/30"
                    )}
                  >
                    {/* Test Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={cn(
                          "font-semibold text-sm",
                          result.passed ? "text-green-400" : "text-red-400"
                        )}>
                          Test Case #{index + 1}
                        </span>
                      </div>
                      {result.executionTime && (
                        <span className="text-xs text-slate-400">
                          {(result.executionTime * 1000).toFixed(0)}ms
                        </span>
                      )}
                    </div>

                    {/* Input */}
                    <div>
                      <label className="text-xs text-slate-500 font-medium">Input:</label>
                      <pre className="bg-slate-900/50 rounded p-2 text-xs text-slate-300 font-mono overflow-x-auto mt-1">
                        {result.input}
                      </pre>
                    </div>

                    {/* Expected vs Actual Output */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 font-medium">Expected:</label>
                        <pre className="bg-slate-900/50 rounded p-2 text-xs text-green-300 font-mono overflow-x-auto mt-1">
                          {result.expectedOutput}
                        </pre>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-medium">Actual:</label>
                        <pre className={cn(
                          "bg-slate-900/50 rounded p-2 text-xs font-mono overflow-x-auto mt-1",
                          result.passed ? "text-green-300" : "text-red-300"
                        )}>
                          {result.actualOutput || 'No output'}
                        </pre>
                      </div>
                    </div>

                    {/* Stdout (if any) */}
                    {result.stdout && (
                      <div>
                        <label className="text-xs text-blue-400 font-medium">Console Output:</label>
                        <pre className="bg-slate-900/50 rounded p-2 text-xs text-blue-300 font-mono overflow-x-auto mt-1">
                          {result.stdout}
                        </pre>
                      </div>
                    )}

                    {/* Error (if any) */}
                    {result.error && (
                      <div>
                        <label className="text-xs text-red-400 font-medium">Error:</label>
                        <pre className="bg-red-950/50 rounded p-2 text-xs text-red-300 font-mono overflow-x-auto mt-1">
                          {result.error}
                        </pre>
                      </div>
                    )}

                    {/* Stderr (if any) */}
                    {result.stderr && (
                      <div>
                        <label className="text-xs text-orange-400 font-medium">Stderr:</label>
                        <pre className="bg-orange-950/50 rounded p-2 text-xs text-orange-300 font-mono overflow-x-auto mt-1">
                          {result.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Legacy Output (fallback for old format) */}
            {lastResult.output && !lastResult.results && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">
                  Output
                </label>
                <pre className="bg-slate-900 rounded-lg p-3 text-sm text-green-300 font-mono overflow-x-auto">
                  {lastResult.output}
                </pre>
              </div>
            )}

            {/* Legacy Error (fallback for old format) */}
            {lastResult.error && !lastResult.results && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-red-400 uppercase">
                  Error
                </label>
                <pre className="bg-red-950 rounded-lg p-3 text-sm text-red-300 font-mono overflow-x-auto">
                  {lastResult.error}
                </pre>
              </div>
            )}

            {/* Hint about failures */}
            {!lastResult.success && attemptCount >= 2 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">
                  Having trouble? The AI can provide a hint if you're stuck. Check the hints panel on the right.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
