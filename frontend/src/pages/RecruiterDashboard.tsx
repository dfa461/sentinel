import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Code2,
  ThumbsUp,
  ThumbsDown,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import type { AssessmentSummary } from '../types';

const API_BASE = 'http://localhost:8000';
const RL_API_BASE = 'http://localhost:8000/api/rl';

export function RecruiterDashboard() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [assessmentId]);

  const fetchSummary = async () => {
    try {
      // Check if this is an RL assessment (starts with "rl_assess_")
      const isRLAssessment = assessmentId?.startsWith('rl_assess_');
      const endpoint = isRLAssessment
        ? `${RL_API_BASE}/assessment/${assessmentId}`
        : `${API_BASE}/assessment/${assessmentId}`;

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isPositive: boolean) => {
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          isPositive,
          timestamp: Date.now(),
        }),
      });
      alert(`Feedback recorded! This will improve our AI model.`);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Assessment Not Found</h2>
          <p className="text-slate-400">The assessment you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const recommendationConfig = {
    strong_hire: {
      label: 'Strong Hire',
      icon: Award,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/30',
    },
    hire: {
      label: 'Hire',
      icon: CheckCircle2,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/30',
    },
    maybe: {
      label: 'Maybe',
      icon: AlertCircle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/30',
    },
    no_hire: {
      label: 'No Hire',
      icon: XCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      borderColor: 'border-red-400/30',
    },
  };

  const config = recommendationConfig[summary.recommendation];
  const Icon = config.icon;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Chart data - handle both regular and RL assessments
  const isRLAssessment = assessmentId?.startsWith('rl_assess_');
  const chartData = isRLAssessment
    ? (summary.monitoringEvents || []).map((event: any, idx: number) => ({
        time: idx,
        progress: ((idx + 1) / (summary.monitoringEvents?.length || 1)) * 100,
      }))
    : (summary.codeEvolution || []).map((snapshot: any, idx: number) => ({
        time: idx,
        progress: (snapshot.code.length / (summary.finalCode?.length || 1)) * 100,
      }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="glass-effect border-b border-slate-700 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Assessment Summary
              </h1>
              <p className="text-slate-400">
                Candidate ID: <span className="text-blue-400 font-mono">{summary.candidateId}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleFeedback(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg border border-green-600/30 transition-all"
              >
                <ThumbsUp className="w-4 h-4" />
                Good Assessment
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30 transition-all"
              >
                <ThumbsDown className="w-4 h-4" />
                Poor Assessment
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-6">
          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">Duration</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatDuration(summary.endTime - summary.startTime)}
            </p>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-400">
                {isRLAssessment ? 'Hints Used' : 'Interventions'}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {isRLAssessment
                ? (summary.hintsUsed?.length || 0)
                : (summary.interventions?.length || 0)
              }
            </p>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Code2 className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-400">
                {isRLAssessment ? 'Monitoring Events' : 'Code Snapshots'}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {isRLAssessment
                ? (summary.monitoringEvents?.length || 0)
                : (summary.codeEvolution?.length || 0)
              }
            </p>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-slate-400">Overall Rating</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {summary.overallRating}/10
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div className={cn(
          "glass-effect rounded-xl p-6 border-2",
          config.borderColor
        )}>
          <div className="flex items-center gap-4">
            <div className={cn("p-4 rounded-xl", config.bgColor)}>
              <Icon className={cn("w-8 h-8", config.color)} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-200 mb-1">
                Recommendation
              </h3>
              <p className={cn("text-2xl font-bold", config.color)}>
                {config.label}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Chart */}
        <div className="glass-effect rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            Code Progress Timeline
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="progress"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {summary.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-effect rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Areas for Improvement</h3>
            </div>
            <ul className="space-y-2">
              {summary.weaknesses.map((weakness, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Interventions & Responses / RL Insights */}
        <div className="glass-effect rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            {isRLAssessment ? 'RL Assessment Insights' : 'AI Interventions & Candidate Responses'}
          </h3>
          <div className="space-y-4">
            {isRLAssessment ? (
              // RL Assessment View
              <>
                {summary.hintsUsed && summary.hintsUsed.length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-semibold text-purple-400 mb-2">Hints Used</h4>
                    <ul className="space-y-2">
                      {summary.hintsUsed.map((hint: any, idx: number) => (
                        <li key={idx} className="text-sm text-slate-300">
                          • {hint.content || hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.rlInsights && (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-semibold text-blue-400 mb-2">RL Insights</h4>
                    <p className="text-sm text-slate-300">{summary.rlInsights}</p>
                  </div>
                )}
                {summary.learningTrajectory && (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-semibold text-green-400 mb-2">Learning Trajectory</h4>
                    <p className="text-sm text-slate-300">{summary.learningTrajectory}</p>
                  </div>
                )}
              </>
            ) : (
              // Regular Assessment View
              (summary.interventions || []).map((intervention: any) => {
                const response = (summary.responses || []).find(
                  (r: any) => r.interventionId === intervention.id
                );

                return (
                  <div
                    key={intervention.id}
                    className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <MessageSquare className="w-4 h-4 text-purple-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-purple-400">
                            {intervention.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatTime(intervention.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{intervention.content}</p>
                      </div>
                    </div>

                    {response && (
                      <div className="ml-7 pl-4 border-l-2 border-blue-500/30">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-blue-400">
                            Candidate Response {response.isVoice ? '(Voice)' : '(Text)'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{response.response}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Final Code */}
        <div className="glass-effect rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Final Submitted Code</h3>
          <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
            <code className="text-sm text-slate-300 font-mono">
              {summary.finalCode}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
