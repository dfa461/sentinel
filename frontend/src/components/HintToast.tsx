import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface HintToastProps {
  hint: string;
  onDismiss: () => void;
  isVisible: boolean;
}

export function HintToast({ hint, onDismiss, isVisible }: HintToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed top-6 right-6 z-50 max-w-md"
        >
          <div className={cn(
            "glass-effect rounded-xl p-4 shadow-2xl",
            "border-l-4 border-blue-400"
          )}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-blue-400" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-blue-400 mb-1">
                  Hint
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {hint}
                </p>
              </div>

              <button
                onClick={onDismiss}
                className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
