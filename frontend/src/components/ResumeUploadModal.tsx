import { useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

interface ResumeUploadModalProps {
  isOpen: boolean;
  onResumeUploaded: (questionData: any) => void;
}

const API_BASE = 'http://localhost:8000';

export function ResumeUploadModal({ isOpen, onResumeUploaded }: ResumeUploadModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!resumeFile) return;

    setIsProcessing(true);
    try {
      // For now, generate a generic question
      // TODO: Actually upload and parse resume
      const response = await fetch(`${API_BASE}/generate-question-from-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const data = await response.json();
        onResumeUploaded(data.question);
      } else {
        alert('Failed to generate question from resume');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to process resume');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-effect rounded-2xl shadow-2xl w-full max-w-md border-2 border-blue-500/30">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/20 p-3 rounded-xl">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Your Resume</h2>
              <p className="text-sm text-slate-400">We'll generate a custom question for you</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload className="w-12 h-12 text-slate-500" />
              <div>
                <p className="text-slate-300 font-semibold mb-1">
                  {resumeFile ? resumeFile.name : 'Click to upload resume'}
                </p>
                <p className="text-xs text-slate-500">PDF, DOC, or DOCX</p>
              </div>
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!resumeFile || isProcessing}
            className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Custom Question...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Question
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
