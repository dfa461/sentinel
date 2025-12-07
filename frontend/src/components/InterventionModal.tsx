import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Mic, MicOff, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import type { Intervention } from '../types';

interface InterventionModalProps {
  intervention: Intervention | null;
  onSubmit: (response: string, isVoice: boolean) => void;
  isOpen: boolean;
}

export function InterventionModal({ intervention, onSubmit, isOpen }: InterventionModalProps) {
  const [response, setResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [useVoice, setUseVoice] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setResponse('');
      setIsRecording(false);
      setUseVoice(false);
    }
  }, [isOpen]);

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

  const handleSubmit = () => {
    if (!response.trim()) return;
    onSubmit(response, useVoice);
  };

  if (!intervention) return null;

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
            className="glass-effect rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border-2 border-purple-500/30"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-white/10">
              <div className="flex items-start gap-4">
                <div className="bg-purple-500/20 p-3 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {intervention.title}
                  </h3>
                  <p className="text-sm text-purple-300">
                    Please answer to continue coding
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-200 leading-relaxed">
                  {intervention.content}
                </p>
              </div>

              {/* Response Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">
                    Your Response
                  </label>
                  {intervention.voiceResponse && (
                    <button
                      onClick={() => setUseVoice(!useVoice)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg transition-all",
                        useVoice
                          ? "bg-purple-500 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      )}
                    >
                      {useVoice ? 'Voice Mode' : 'Text Mode'}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder={useVoice ? "Click microphone to record..." : "Type your answer..."}
                    className={cn(
                      "w-full h-32 px-4 py-3 rounded-xl resize-none",
                      "bg-slate-900/50 border border-slate-700",
                      "text-slate-100 placeholder-slate-500",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                      "transition-all duration-200"
                    )}
                    disabled={isRecording}
                  />

                  {useVoice && (
                    <button
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={cn(
                        "absolute bottom-3 right-3 p-3 rounded-lg transition-all",
                        isRecording
                          ? "bg-red-500 hover:bg-red-600 animate-pulse"
                          : "bg-purple-500 hover:bg-purple-600"
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
                  <p className="text-xs text-purple-400 animate-pulse">
                    Recording... Speak clearly into your microphone
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!response.trim()}
                className={cn(
                  "w-full py-3 px-6 rounded-xl font-semibold",
                  "bg-gradient-to-r from-purple-600 to-pink-600",
                  "hover:from-purple-500 hover:to-pink-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-200",
                  "flex items-center justify-center gap-2",
                  "shadow-lg hover:shadow-purple-500/50"
                )}
              >
                <span>Submit Response</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
