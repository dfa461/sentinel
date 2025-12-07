import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Sparkles, TrendingUp, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AdaptiveHint } from '../types/monitoring';

interface HintSystemProps {
  hints: AdaptiveHint[];
  hintsRemaining: number;
  currentHint: AdaptiveHint | null;
  onDismiss: () => void;
  onRequestHint: () => void;
  canRequestHint: boolean;
  isRequestingHint?: boolean;
}

export function HintSystem({
  hints,
  hintsRemaining,
  currentHint,
  onDismiss,
  onRequestHint,
  canRequestHint,
  isRequestingHint = false,
}: HintSystemProps) {
  return (
    <>
      {/* Hint Request Display - Always visible */}
      <div className="fixed top-24 right-6 z-40 w-80">
        <div className="glass-effect rounded-xl p-4 border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-semibold text-slate-200">
              AI Hints
            </span>
          </div>

          {canRequestHint && (
            <button
              onClick={onRequestHint}
              disabled={isRequestingHint}
              className="w-full py-2 px-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRequestingHint && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isRequestingHint ? 'Generating Hint...' : 'Request Hint'}
            </button>
          )}
        </div>

        {/* Hints History */}
        {hints.length > 0 && (
          <div className="mt-3 glass-effect rounded-xl p-3 border border-slate-700 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">
                Previous Hints
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {hints.map((hint, idx) => (
                <div
                  key={hint.id}
                  className="bg-slate-800/50 rounded-lg p-2 border border-slate-700"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-yellow-400 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <p className="text-xs text-slate-300 flex-1 break-words">
                      {hint.content}
                    </p>
                  </div>
                  {hint.effectiveness !== undefined && (
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">
                        {Math.round(hint.effectiveness * 100)}% helpful
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Hint Modal */}
      <AnimatePresence>
        {currentHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-effect rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border-2 border-yellow-500/30"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 p-6 border-b border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-yellow-500/20 p-3 rounded-xl">
                      <Lightbulb className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        AI-Generated Hint
                      </h3>
                      <p className="text-sm text-yellow-300">
                        {currentHint.context}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Hint Content */}
              <div className="p-6 space-y-4">
                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-6 border border-yellow-500/20">
                  <p className="text-lg text-slate-100 leading-relaxed">
                    {currentHint.content}
                  </p>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">
                    This hint was generated based on your code and current progress. Try applying this suggestion and continue coding!
                  </p>
                </div>

                <button
                  onClick={onDismiss}
                  className="w-full py-3 px-6 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-yellow-500/50"
                >
                  Got it, let me try!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
