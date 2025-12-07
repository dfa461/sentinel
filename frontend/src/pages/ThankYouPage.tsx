import { CheckCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function ThankYouPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <div className="glass-effect rounded-3xl p-12 border-2 border-green-500/30 text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle className="w-14 h-14 text-white" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold text-white mb-4"
          >
            Assessment Complete!
          </motion.h1>

          {/* Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <p className="text-xl text-slate-300 leading-relaxed">
              Thank you for completing your technical assessment.
            </p>
            <p className="text-lg text-slate-400">
              Our team will carefully review your submission and reach out if your skills align with what we're looking for.
            </p>
          </motion.div>

          {/* Decorative Element */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 flex items-center justify-center gap-2 text-slate-500"
          >
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="text-sm">Powered by Sentinel AI</span>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 pt-8 border-t border-slate-700"
          >
            <p className="text-sm text-slate-500">
              You can close this window. We'll be in touch soon!
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
