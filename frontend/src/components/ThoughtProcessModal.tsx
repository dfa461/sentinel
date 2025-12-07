import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Mic, MicOff, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import type { ThoughtProcessQuery, ThoughtProcessResponse } from '../types/monitoring';

interface ThoughtProcessModalProps {
  query: ThoughtProcessQuery | null;
  onSubmit: (response: string, isVoice: boolean) => Promise<void>;
  isOpen: boolean;
  isEvaluating?: boolean;
  evaluation?: {
    isOnRightTrack: boolean;
    feedback: string;
    confidence: number;
  };
}

export function ThoughtProcessModal({
  query,
  onSubmit,
  isOpen,
  isEvaluating = false,
  evaluation,
}: ThoughtProcessModalProps) {
  const [response, setResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [useVoice, setUseVoice] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setResponse('');
      setIsRecording(false);
      setUseVoice(false);
      setShowEvaluation(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (evaluation) {
      setShowEvaluation(true);
    }
  }, [evaluation]);

  const handleStartRecording = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setResponse(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      alert('Error occurred during speech recognition');
    };

    recognition.onend = () => setIsRecording(false);

    recognition.start();
    (window as any).currentRecognition = recognition;
  };

  const handleStopRecording = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
    }
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (!response.trim()) return;
    await onSubmit(response, useVoice);
  };

  if (!query) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="glass-effect rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border-2 border-blue-500/30"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 p-6 border-b border-white/10">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500/20 p-3 rounded-xl">
                  <Brain className="w-6 h-6 text-blue-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    I notice you paused...
                  </h3>
                  <p className="text-sm text-blue-300">
                    {query.context}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Question */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-lg text-slate-100 leading-relaxed font-medium">
                  {query.question}
                </p>
              </div>

              {/* Evaluation Feedback */}
              <AnimatePresence>
                {showEvaluation && evaluation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "rounded-xl p-4 border-l-4",
                      evaluation.isOnRightTrack
                        ? "bg-green-500/10 border-green-500"
                        : "bg-yellow-500/10 border-yellow-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {evaluation.isOnRightTrack ? (
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Brain className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className={cn(
                          "font-semibold mb-1",
                          evaluation.isOnRightTrack ? "text-green-400" : "text-yellow-400"
                        )}>
                          {evaluation.isOnRightTrack ? "You're on the right track! ✓" : "Let me help guide you..."}
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {evaluation.feedback}
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          Confidence: {Math.round(evaluation.confidence * 100)}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Response Input */}
              {!showEvaluation && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">
                        Share your thought process
                      </label>
                      <button
                        onClick={() => setUseVoice(!useVoice)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-lg transition-all",
                          useVoice
                            ? "bg-blue-500 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        )}
                      >
                        {useVoice ? 'Voice Mode' : 'Text Mode'}
                      </button>
                    </div>

                    <div className="relative">
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder={useVoice ? "Click microphone to record..." : "Explain what you're thinking..."}
                        className={cn(
                          "w-full h-32 px-4 py-3 rounded-xl resize-none",
                          "bg-slate-900/50 border border-slate-700",
                          "text-slate-100 placeholder-slate-500",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                          "transition-all duration-200"
                        )}
                        disabled={isRecording || isEvaluating}
                      />

                      {useVoice && (
                        <button
                          onClick={isRecording ? handleStopRecording : handleStartRecording}
                          disabled={isEvaluating}
                          className={cn(
                            "absolute bottom-3 right-3 p-3 rounded-lg transition-all",
                            isRecording
                              ? "bg-red-500 hover:bg-red-600 animate-pulse"
                              : "bg-blue-500 hover:bg-blue-600"
                          )}
                        >
                          {isRecording ? (
                            <MicOff className="w-5 h-5 text-white" />
                          ) : (
                            <Mic className="w-5 h-5 text-white" />
                          )}
                        </button>
                      )}
                    </div>

                    {isRecording && (
                      <p className="text-xs text-blue-400 animate-pulse flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                        Recording... Speak your thought process
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!response.trim() || isEvaluating}
                    className={cn(
                      "w-full py-3 px-6 rounded-xl font-semibold",
                      "bg-gradient-to-r from-blue-600 to-cyan-600",
                      "hover:from-blue-500 hover:to-cyan-500",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all duration-200",
                      "flex items-center justify-center gap-2",
                      "shadow-lg hover:shadow-blue-500/50"
                    )}
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI is evaluating...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit & Get Feedback</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Auto-close message after evaluation */}
              {showEvaluation && (
                <div className="text-center">
                  <p className="text-sm text-slate-400">
                    Closing automatically in 3 seconds...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
