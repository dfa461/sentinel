import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Code2, MessageSquare, Trophy, Filter, ChevronDown, BarChart3, Brain, Zap, Trash2, ThumbsUp, ThumbsDown, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const RL_API_BASE = 'http://localhost:8000/api/rl';

// Helper function to get color based on recommendation
const getRecommendationColor = (recommendation: string): string => {
  const rec = recommendation.toLowerCase().replace('_', ' ');
  if (rec.includes('strong hire') || rec === 'strong_hire') return 'text-green-400';
  if (rec === 'hire') return 'text-cyan-400';
  if (rec === 'maybe') return 'text-yellow-400';
  if (rec.includes('no hire') || rec === 'no_hire') return 'text-orange-400';
  return 'text-red-400';
};

// Helper function to format recommendation text
const formatRecommendation = (recommendation: string): string => {
  const rec = recommendation.replace('_', ' ');
  return rec.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

interface Assessment {
  id: string;
  name: string;
  email: string;
  problem: string;
  codeScore: number;
  responseScore: number;
  overallScore: number;
  recommendation: string;
  timestamp: number;
  hintsUsed: number;
  questionsAnswered: number;
  elapsedTime: number;
}

export function RecruiterDashboard() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Assessment | null>(null);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Code' | 'Responses' | 'Analytics' | 'AI Evaluation'>('Overview');
  const [codeWeight, setCodeWeight] = useState(60);
  const [responseWeight, setResponseWeight] = useState(40);
  const [sortBy, setSortBy] = useState('Final Score');
  const [sortOrder] = useState('Highest First');
  const [topK, setTopK] = useState('All');
  const [detailedData, setDetailedData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch assessments from backend
  useEffect(() => {
    fetchAssessments();
  }, []);

  // Fetch detailed data when a candidate is selected
  useEffect(() => {
    if (selectedCandidate) {
      fetchAssessmentDetail(selectedCandidate.id);
    }
  }, [selectedCandidate]);

  const fetchAssessments = async () => {
    try {
      const response = await fetch(`${RL_API_BASE}/assessments/list`);
      if (response.ok) {
        const data = await response.json();
        setCandidates(data.assessments || []);
      }
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessmentDetail = async (assessmentId: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`${RL_API_BASE}/assessment/${assessmentId}`);
      if (response.ok) {
        const data = await response.json();
        setDetailedData(data);
      }
    } catch (error) {
      console.error('Error fetching assessment detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCodeWeightChange = (value: number) => {
    setCodeWeight(value);
    setResponseWeight(100 - value);
  };

  const handleResponseWeightChange = (value: number) => {
    setResponseWeight(value);
    setCodeWeight(100 - value);
  };

  // Calculate weighted scores dynamically
  const candidatesWithWeightedScores = useMemo(() => {
    return candidates.map(candidate => ({
      ...candidate,
      finalScore: Math.round((candidate.codeScore * codeWeight / 100) + (candidate.responseScore * responseWeight / 100)),
      color: getRecommendationColor(candidate.recommendation)
    }));
  }, [candidates, codeWeight, responseWeight]);

  // Process real data from backend - MUST be at top level (React Rules of Hooks)
  const codeSnapshots = useMemo(() => {
    if (!detailedData || !detailedData.codeSnapshots) return [];

    return detailedData.codeSnapshots.map((snapshot: any, index: number) => {
      const elapsed = snapshot.timestamp - detailedData.startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      return {
        time: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        label: snapshot.label || `Snapshot ${index + 1}`,
        code: snapshot.code,
      };
    });
  }, [detailedData]);

  const questions = useMemo(() => {
    // Prefer evaluated responses with Grok feedback
    if (detailedData?.evaluatedResponses && detailedData.evaluatedResponses.length > 0) {
      return detailedData.evaluatedResponses.map((resp: any) => {
        const elapsed = resp.timestamp - detailedData.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return {
          time: `${minutes}:${seconds.toString().padStart(2, '0')}`,
          question: resp.question,
          answer: resp.response,
          score: resp.score,
          feedback: resp.feedback,
          quality: resp.quality,
        };
      });
    }

    // Fallback to challengeTodos if no evaluated responses
    if (!detailedData || !detailedData.challengeTodos) return [];

    return detailedData.challengeTodos
      .filter((todo: any) => todo.completed && todo.response)
      .map((todo: any) => {
        const elapsed = todo.timestamp - detailedData.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return {
          time: `${minutes}:${seconds.toString().padStart(2, '0')}`,
          question: todo.question,
          answer: todo.response,
          score: 3,
          feedback: "Response recorded (detailed evaluation unavailable)",
          quality: "adequate",
        };
      });
  }, [detailedData]);

  const chartData = useMemo(() => {
    if (!detailedData) {
      return [{ time: '0:00', linesOfCode: 0, charactersTyped: 0, deletions: 0, netCharacters: 0 }];
    }

    // Use code snapshots for accurate line count tracking
    if (detailedData.codeSnapshots && detailedData.codeSnapshots.length > 0) {
      const analytics = detailedData.analyticsData || { charactersTyped: 0, deletions: 0, keystrokes: 0 };
      const totalTime = detailedData.endTime - detailedData.startTime;

      return detailedData.codeSnapshots.map((snapshot: any) => {
        const elapsed = snapshot.timestamp - detailedData.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const progress = totalTime > 0 ? elapsed / totalTime : 0;

        return {
          time: `${minutes}:${seconds.toString().padStart(2, '0')}`,
          linesOfCode: snapshot.linesOfCode || (snapshot.code ? snapshot.code.split('\n').length : 0),
          charactersTyped: Math.round(analytics.charactersTyped * progress),
          deletions: Math.round(analytics.deletions * progress),
          netCharacters: Math.round((analytics.charactersTyped - analytics.deletions) * progress),
        };
      });
    }

    // Fallback: use analytics data to estimate
    if (detailedData.analyticsData) {
      const analytics = detailedData.analyticsData;
      const duration = detailedData.endTime - detailedData.startTime;
      const minutes = Math.floor(duration / 60000);
      const dataPoints = [];
      const steps = Math.min(minutes + 1, 10);

      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        dataPoints.push({
          time: `${i}:00`,
          linesOfCode: Math.round((detailedData.progressMetrics?.linesWritten || 0) * progress),
          charactersTyped: Math.round(analytics.charactersTyped * progress),
          deletions: Math.round(analytics.deletions * progress),
          netCharacters: Math.round((analytics.charactersTyped - analytics.deletions) * progress),
        });
      }

      return dataPoints;
    }

    return [{ time: '0:00', linesOfCode: 0, charactersTyped: 0, deletions: 0, netCharacters: 0 }];
  }, [detailedData]);

  // Detail view rendering
  if (selectedCandidate) {
    // Calculate weighted final score for selected candidate
    const weightedFinalScore = Math.round(
      (selectedCandidate.codeScore * codeWeight / 100) +
      (selectedCandidate.responseScore * responseWeight / 100)
    );

    const finalCode = detailedData?.finalCode || 'Loading...';

    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white">
        {/* Header */}
        <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setSelectedCandidate(null);
                    setActiveTab('Overview');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">{selectedCandidate.name}</h1>
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', getRecommendationColor(selectedCandidate.recommendation), 'bg-green-600/10 border border-green-600/30')}>
                      {formatRecommendation(selectedCandidate.recommendation)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                    <span>✉ {selectedCandidate.email}</span>
                    <span>•</span>
                    <span>{selectedCandidate.problem}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="border-b border-[#2a2a2a] bg-[#0f0f0f] px-8 py-6">
          <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">Code Score</span>
              </div>
              <div className="text-3xl font-bold text-white">{selectedCandidate.codeScore}</div>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-slate-400">Response Score</span>
              </div>
              <div className="text-3xl font-bold text-white">{selectedCandidate.responseScore}</div>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400">Overall Score</span>
              </div>
              <div className="text-3xl font-bold text-white">{weightedFinalScore}</div>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400">Questions Answered</span>
              </div>
              <div className="text-3xl font-bold text-white">{questions.length}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-8">
          <div className="max-w-7xl mx-auto flex gap-1">
            {(['Overview', 'Code', 'Responses', 'Analytics', 'AI Evaluation'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-8 py-8">
          {!detailedData ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading assessment details...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                    <h2 className="text-xl font-bold mb-6">Assessment Timeline</h2>
                    {codeSnapshots.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        No code snapshots recorded for this assessment.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {codeSnapshots.map((snapshot: any, idx: number) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-sm text-slate-400 mb-2">{snapshot.time}</span>
                        <div className="w-px h-full bg-[#2a2a2a]"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a]">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Code2 className="w-4 h-4 text-blue-400" />
                              <span className="font-semibold">Code Update</span>
                            </div>
                            <span className="text-xs bg-[#2a2a2a] px-2 py-1 rounded">Code Update</span>
                          </div>
                          <p className="text-sm text-slate-400 mb-3">Candidate modified their solution</p>
                          <pre className="bg-[#1a1a1a] rounded p-3 text-xs text-slate-300 font-mono overflow-x-auto">
                            {snapshot.code}
                          </pre>
                        </div>
                      </div>
                    </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'Code' && (
            <div className="space-y-6">
              {/* Test Cases Summary */}
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Code Evaluation</h2>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{detailedData?.codeScore || 0}<span className="text-slate-400 text-xl">/5</span></div>
                      <div className="text-xs text-slate-400">Code Score</div>
                    </div>
                  </div>
                </div>

                {/* Test Cases */}
                {detailedData?.executionAttempts && detailedData.executionAttempts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-medium">
                          {detailedData.executionAttempts.filter((attempt: any) =>
                            attempt.results?.every((r: any) => r.passed)
                          ).length} Passed
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Circle className="w-5 h-5 text-red-400" />
                        <span className="text-sm font-medium">
                          {detailedData.executionAttempts.filter((attempt: any) =>
                            attempt.results?.some((r: any) => !r.passed)
                          ).length} Failed
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm text-slate-400">
                          Total Attempts: {detailedData.executionAttempts.length}
                        </span>
                      </div>
                    </div>

                    {/* Latest Test Results */}
                    {detailedData.executionAttempts.length > 0 && detailedData.executionAttempts[detailedData.executionAttempts.length - 1].results && (
                      <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a]">
                        <h3 className="text-sm font-semibold mb-3">Latest Test Results</h3>
                        <div className="space-y-2">
                          {detailedData.executionAttempts[detailedData.executionAttempts.length - 1].results.map((result: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-2 rounded bg-[#1a1a1a]">
                              {result.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">Test Case {idx + 1}</span>
                                  <span className={cn(
                                    "text-xs px-2 py-0.5 rounded",
                                    result.passed ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                  )}>
                                    {result.passed ? 'Passed' : 'Failed'}
                                  </span>
                                </div>
                                <div className="text-slate-400 space-y-1">
                                  <div>Input: <span className="text-slate-300">{result.input}</span></div>
                                  <div>Expected: <span className="text-slate-300">{result.expectedOutput}</span></div>
                                  {result.actualOutput && (
                                    <div>Output: <span className={result.passed ? "text-green-400" : "text-red-400"}>{result.actualOutput}</span></div>
                                  )}
                                  {result.error && (
                                    <div className="text-red-400 mt-1">Error: {result.error}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No test execution data available
                  </div>
                )}
              </div>

              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h2 className="text-xl font-bold mb-4">Final Submitted Code</h2>
                <pre className="bg-[#0f0f0f] rounded-lg p-4 text-sm text-slate-300 font-mono overflow-x-auto border border-[#2a2a2a]">
                  {finalCode}
                </pre>
              </div>

              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h2 className="text-xl font-bold mb-6">Code Evolution</h2>
                <div className="space-y-4">
                  {codeSnapshots.map((snapshot: any, idx: number) => (
                    <div key={idx}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs bg-[#2a2a2a] px-2 py-1 rounded font-mono">{snapshot.time}</span>
                        <span className="text-sm text-slate-400">{snapshot.label}</span>
                      </div>
                      <pre className="bg-[#0f0f0f] rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto border border-[#2a2a2a]">
                        {snapshot.code}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Responses' && (
            <div className="space-y-6">
              {questions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No challenge questions were answered during this assessment.
                </div>
              ) : (
                questions.map((q: any, idx: number) => {
                  // Determine border and background color based on quality
                  const getBorderColor = (quality: string) => {
                    if (quality === 'excellent' || quality === 'good') return 'border-green-500/50';
                    if (quality === 'adequate') return 'border-yellow-500/50';
                    return 'border-red-500/50';
                  };

                  const getBgColor = (quality: string) => {
                    if (quality === 'excellent' || quality === 'good') return 'bg-green-500/5';
                    if (quality === 'adequate') return 'bg-yellow-500/5';
                    return 'border-red-500/5';
                  };

                  const getScoreColor = (score: number) => {
                    if (score >= 4) return 'text-green-400';
                    if (score >= 3) return 'text-yellow-400';
                    return 'text-red-400';
                  };

                  return (
                    <div key={idx} className={cn("rounded-xl p-6 border-2", getBorderColor(q.quality), getBgColor(q.quality))}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs bg-[#2a2a2a] px-2 py-1 rounded font-mono">{q.time}</span>
                          <h3 className="text-lg font-semibold">Question {idx + 1}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">Score:</span>
                          <span className={cn("text-2xl font-bold", getScoreColor(q.score))}>{q.score}</span>
                          <span className="text-sm text-slate-400">/5</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-slate-400 mb-2">Question:</p>
                          <p className="text-white">{q.question}</p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400 mb-2">Candidate's Answer:</p>
                          <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a]">
                            <p className="text-slate-300">{q.answer}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-slate-400 mb-2">AI Feedback:</p>
                          <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a]">
                            <p className="text-slate-300 italic">{q.feedback}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'Analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400">Lines of Code</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {detailedData?.finalCode ? detailedData.finalCode.split('\n').length : 0}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-400 text-sm font-bold">T</span>
                    <span className="text-xs text-slate-400">Characters Typed</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {detailedData?.analyticsData?.charactersTyped || 0}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-slate-400">Chars/min</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {(() => {
                      const chars = detailedData?.analyticsData?.charactersTyped || 0;
                      const duration = (detailedData?.endTime - detailedData?.startTime) / 60000; // minutes
                      return duration > 0 ? Math.round(chars / duration) : 0;
                    })()}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400">Deletion Rate</span>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {(() => {
                      const chars = detailedData?.analyticsData?.charactersTyped || 0;
                      const deletions = detailedData?.analyticsData?.deletions || 0;
                      return chars > 0 ? Math.round((deletions / chars) * 100) : 0;
                    })()}%
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h3 className="text-lg font-semibold mb-4">Coding Progress Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="linesOfCode"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLines)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-center text-sm text-blue-400 mt-2">Lines of Code</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h3 className="text-lg font-semibold mb-4">Typing Activity</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="charactersTyped" stroke="#3b82f6" strokeWidth={2} name="Characters Typed" />
                    <Line type="monotone" dataKey="deletions" stroke="#ef4444" strokeWidth={2} name="Deletions" />
                    <Line type="monotone" dataKey="netCharacters" stroke="#10b981" strokeWidth={2} name="Net Characters" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'AI Evaluation' && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
                    {selectedCandidate.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{selectedCandidate.name}</h3>
                    <p className="text-sm text-slate-400">AI-Powered Assessment Summary</p>
                  </div>
                  <span className={cn("px-3 py-1 rounded text-sm font-medium", getRecommendationColor(selectedCandidate.recommendation), 'bg-opacity-10 border')}>
                    {formatRecommendation(selectedCandidate.recommendation)}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="text-4xl font-bold text-white">{detailedData?.finalScore?.toFixed(1) || 0}</div>
                  <div className="text-sm text-slate-400">/5</div>
                  <div className="flex-1">
                    <div className="h-3 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${((detailedData?.finalScore || 0) / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Code Score</span>
                      </div>
                      <span className="text-sm font-bold">{detailedData?.codeScore || 0}/5</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((detailedData?.codeScore || 0) / 5) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Based on test cases passed</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Response Score</span>
                      </div>
                      <span className="text-sm font-bold">{detailedData?.responseScore || 0}/5</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((detailedData?.responseScore || 0) / 5) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400">AI-evaluated communication</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Overall Rating</span>
                      </div>
                      <span className="text-sm font-bold">{detailedData?.overallRating || 0}/10</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((detailedData?.overallRating || 0) / 10) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Comprehensive AI evaluation</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Weighted Final</span>
                      </div>
                      <span className="text-sm font-bold">{detailedData?.finalScore?.toFixed(1) || 0}/5</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((detailedData?.finalScore || 0) / 5) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Code + Response combined</p>
                  </div>
                </div>

                {detailedData?.strengths && detailedData.strengths.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3 text-green-400">Strengths</h4>
                    <ul className="space-y-2">
                      {detailedData.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailedData?.weaknesses && detailedData.weaknesses.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3 text-orange-400">Areas for Improvement</h4>
                    <ul className="space-y-2">
                      {detailedData.weaknesses.map((weakness: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-orange-400">•</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-[#2a2a2a] pt-6">
                  <h4 className="text-sm font-semibold mb-3">Grok AI Summary</h4>
                  {detailedData?.rlInsights && (
                    <div className="mb-4">
                      <p className="text-sm text-slate-300 mb-2">{detailedData.rlInsights}</p>
                    </div>
                  )}
                  {detailedData?.learningTrajectory && (
                    <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a] mb-4">
                      <p className="text-xs text-slate-400 mb-1">Learning Trajectory:</p>
                      <p className="text-sm text-slate-300">{detailedData.learningTrajectory}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">Was this assessment helpful?</p>
                    <p className="text-xs text-slate-400 mb-3">Your feedback helps improve the AI</p>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg text-sm transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                        Helpful
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg text-sm transition-colors">
                        <ThumbsDown className="w-4 h-4" />
                        Not Helpful
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Navbar */}
      <div className="border-b border-[#2a2a2a] bg-[#0f0f0f] px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity group"
          >
            <img src="/sentinel-logo.png" alt="Sentinel" className="w-14 h-14 group-hover:scale-105 transition-transform" />
            <span className="text-xl font-bold">Sentinel</span>
          </button>
          <h1 className="text-lg font-semibold text-slate-300">Recruiter Dashboard</h1>
        </div>
      </div>

      {/* Custom Scoring Weights */}
      <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-300">Custom Scoring Weights</h2>
          </div>

          <div className="flex items-end gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-300">Code Score Weight</label>
                <span className="text-sm font-semibold text-white">{codeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={codeWeight}
                onChange={(e) => handleCodeWeightChange(parseInt(e.target.value))}
                className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${codeWeight}%, #2a2a2a ${codeWeight}%, #2a2a2a 100%)`
                }}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-slate-300">Response Score Weight</label>
                <span className="text-sm font-semibold text-white">{responseWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={responseWeight}
                onChange={(e) => handleResponseWeightChange(parseInt(e.target.value))}
                className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${responseWeight}%, #2a2a2a ${responseWeight}%, #2a2a2a 100%)`
                }}
              />
            </div>

            <div className="px-6 py-2.5 bg-green-600/20 border border-green-600/30 rounded-lg text-sm font-medium text-green-400 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              Auto-Applied
            </div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Final Score</option>
                <option>Code Score</option>
                <option>Response Score</option>
              </select>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-sm hover:bg-[#3a3a3a] transition-colors">
              <ChevronDown className="w-4 h-4" />
              <span>{sortOrder}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Top K:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All</option>
              <option>Top 3</option>
              <option>Top 5</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate List */}
      <div className="max-w-7xl mx-auto p-8">
        {candidatesWithWeightedScores.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-300 mb-2">No Assessments Yet</h2>
            <p className="text-slate-500 mb-6">Complete an assessment to see results here</p>
            <button
              onClick={() => navigate('/interactive')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Start Assessment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {candidatesWithWeightedScores.map((candidate, idx) => (
          <div
            key={candidate.id}
            onClick={() => setSelectedCandidate(candidate)}
            className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] cursor-pointer hover:border-[#3a3a3a] transition-all"
          >
            <div className="flex items-center gap-6">
              {/* Rank Circle */}
              <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center text-lg font-semibold text-slate-400">
                {idx + 1}
              </div>

              {/* Candidate Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-semibold text-white">{candidate.name}</h3>
                  <span className={cn('text-sm font-medium', candidate.color)}>
                    {formatRecommendation(candidate.recommendation)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-400 mb-0.5">
                  <span>✉</span>
                  <span>{candidate.email}</span>
                </div>
                <p className="text-sm text-slate-500">{candidate.problem}</p>
              </div>

              {/* Scores */}
              <div className="flex gap-12">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">
                    {candidate.codeScore}
                  </div>
                  <div className="text-xs text-slate-500">Code</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">
                    {candidate.responseScore}
                  </div>
                  <div className="text-xs text-slate-500">Response</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-1">
                    {candidate.finalScore}
                  </div>
                  <div className="text-xs text-slate-500">Final</div>
                </div>
              </div>
            </div>
          </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
