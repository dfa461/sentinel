import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Mail, User, Loader2, Upload } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export function AssessmentTokenPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async () => {
    if (!email || !name || !resumeFile) {
      alert('Please fill in all fields and upload your resume');
      return;
    }

    setIsVerifying(true);
    try {
      // Verify token and candidate info
      const response = await fetch(`${API_BASE}/verify-assessment-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          name
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Generate custom question from resume by uploading the file
        let customQuestion = null;
        try {
          const formData = new FormData();
          formData.append('file', resumeFile);

          const questionResponse = await fetch(`${API_BASE}/generate-question-from-resume`, {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header - browser will set it with boundary
          });

          if (questionResponse.ok) {
            const questionData = await questionResponse.json();
            customQuestion = questionData.question;
            console.log('[Assessment] Generated custom question from resume:', customQuestion);
          } else {
            const errorData = await questionResponse.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('[Assessment] Failed to generate question:', errorData.detail);
            // Continue with assessment even if question generation fails
          }
        } catch (error) {
          console.error('[Assessment] Error generating question from resume:', error);
          // Continue with assessment even if question generation fails
        }

        // Navigate to interactive assessment with token, resume, and custom question
        navigate('/interactive', {
          state: {
            assessmentToken: token,
            username: data.username,
            verifiedEmail: email,
            verifiedName: name,
            customQuestion: customQuestion
          }
        });
      } else {
        alert('Invalid or expired assessment link');
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Failed to verify. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full glass-effect rounded-2xl p-8 border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Sentinel</h1>
          <p className="text-slate-400">Please verify your information to begin the assessment</p>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Resume
            </label>
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setResumeFile(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="resume-file"
              />
              <label htmlFor="resume-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-500" />
                <p className="text-sm text-slate-300">
                  {resumeFile ? resumeFile.name : 'Click to upload resume'}
                </p>
                <p className="text-xs text-slate-500">PDF or TXT</p>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isVerifying || !email || !name || !resumeFile}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Begin Assessment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
