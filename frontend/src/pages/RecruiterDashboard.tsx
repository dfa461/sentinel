import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Code2, MessageSquare, Trophy, Filter, ChevronDown, Share2, Download, Sun, BarChart3, Brain, Clock, Zap, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_BASE = 'http://localhost:8000';
const RL_API_BASE = 'http://localhost:8000/api/rl';
const CANDIDATES = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    problem: 'Invert Binary Tree',
    codeScore: 9,
    responseScore: 8,
    recommendation: 'Strong Hire',
    color: 'text-green-400',
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    problem: 'Invert Binary Tree',
    codeScore: 7,
    responseScore: 9,
    recommendation: 'Hire',
    color: 'text-cyan-400',
  },
  {
    id: '3',
    name: 'David Kim',
    email: 'dkim@startup.co',
    problem: 'Invert Binary Tree',
    codeScore: 8,
    responseScore: 7,
    recommendation: 'Hire',
    color: 'text-cyan-400',
  },
  {
    id: '4',
    name: 'Emily Rodriguez',
    email: 'emily.r@techcorp.io',
    problem: 'Invert Binary Tree',
    codeScore: 6,
    responseScore: 5,
    recommendation: 'No Hire',
    color: 'text-orange-400',
  },
  {
    id: '5',
    name: 'Alexandra Peters',
    email: 'alex.peters@consulting.com',
    problem: 'Invert Binary Tree',
    codeScore: 4,
    responseScore: 6,
    recommendation: 'Strong No Hire',
    color: 'text-red-400',
  },
];

export function RecruiterDashboard() {
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState<typeof CANDIDATES[0] | null>(null);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Code' | 'Responses' | 'Analytics' | 'AI Evaluation'>('Overview');
  const [codeWeight, setCodeWeight] = useState(60);
  const [responseWeight, setResponseWeight] = useState(40);
  const [sortBy, setSortBy] = useState('Final Score');
  const [sortOrder, setSortOrder] = useState('Highest First');
  const [topK, setTopK] = useState('All');

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
    return CANDIDATES.map(candidate => ({
      ...candidate,
      finalScore: Math.round((candidate.codeScore * codeWeight / 100) + (candidate.responseScore * responseWeight / 100))
    }));
  }, [codeWeight, responseWeight]);

  if (selectedCandidate) {
    // Calculate weighted final score for selected candidate
    const weightedFinalScore = Math.round(
      (selectedCandidate.codeScore * codeWeight / 100) +
      (selectedCandidate.responseScore * responseWeight / 100)
    );

    // Mock data for detailed view
    const codeSnapshots = [
      { time: '1:00', label: 'Snapshot 1', code: 'class Solution:\n    def invertTree(self, root: TreeNode) -> TreeNode:' },
      { time: '2:00', label: 'Snapshot 2', code: 'class Solution:\n    def invertTree(self, root: TreeNode) -> TreeNode:\n        if not root:\n            return None' },
      { time: '4:00', label: 'Snapshot 3', code: 'class Solution:\n    def invertTree(self, root: TreeNode) -> TreeNode:\n        if not root:\n            return None\n        root.left, root.right = root.right, root.left' },
    ];

    const finalCode = 'class Solution:\n    def invertTree(self, root: TreeNode) -> TreeNode:\n        if not root:\n            return None\n        \n        root.left, root.right = root.right, root.left\n        self.invertTree(root.left)\n        self.invertTree(root.right)\n        return root';

    const questions = [
      {
        time: '3:45',
        question: 'Why did you choose recursion over iteration?',
        answer: 'Recursion naturally maps to tree structure. Each node operation is independent and can be expressed as inverting left and right children then recursing. The call stack handles the traversal order automatically.'
      },
      {
        time: '8:12',
        question: "What's the time complexity?",
        answer: 'O(n) where n is the number of nodes, since we visit each node exactly once. Space complexity is O(h) for the recursion stack where h is tree height.'
      }
    ];

    const chartData = [
      { time: '0:00', linesOfCode: 0, charactersTyped: 0, deletions: 0, netCharacters: 0 },
      { time: '1:00', linesOfCode: 1, charactersTyped: 60, deletions: 5, netCharacters: 55 },
      { time: '2:00', linesOfCode: 3, charactersTyped: 120, deletions: 15, netCharacters: 105 },
      { time: '3:00', linesOfCode: 5, charactersTyped: 180, deletions: 20, netCharacters: 160 },
      { time: '4:00', linesOfCode: 6, charactersTyped: 240, deletions: 25, netCharacters: 215 },
      { time: '5:00', linesOfCode: 7, charactersTyped: 300, deletions: 30, netCharacters: 270 },
      { time: '6:00', linesOfCode: 7, charactersTyped: 350, deletions: 35, netCharacters: 315 },
    ];

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
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', selectedCandidate.color, 'bg-green-600/10 border border-green-600/30')}>
                      {selectedCandidate.recommendation}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                    <span>✉ {selectedCandidate.email}</span>
                    <span>•</span>
                    <span>{selectedCandidate.problem}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg text-sm transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg text-sm transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button className="p-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg transition-colors">
                  <Sun className="w-4 h-4" />
                </button>
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
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h2 className="text-xl font-bold mb-6">Assessment Timeline</h2>
                <div className="space-y-6">
                  {codeSnapshots.map((snapshot, idx) => (
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
              </div>
            </div>
          )}

          {activeTab === 'Code' && (
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h2 className="text-xl font-bold mb-4">Final Submitted Code</h2>
                <pre className="bg-[#0f0f0f] rounded-lg p-4 text-sm text-slate-300 font-mono overflow-x-auto border border-[#2a2a2a]">
                  {finalCode}
                </pre>
              </div>

              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                <h2 className="text-xl font-bold mb-6">Code Evolution</h2>
                <div className="space-y-4">
                  {codeSnapshots.map((snapshot, idx) => (
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
              {questions.map((q, idx) => (
                <div key={idx} className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs bg-[#2a2a2a] px-2 py-1 rounded font-mono">{q.time}</span>
                    <h3 className="text-lg font-semibold">Question {idx + 1}</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-400 mb-2">Question:</p>
                      <p className="text-white">{q.question}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-2">Answer:</p>
                      <div className="bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a]">
                        <p className="text-slate-300">{q.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  <div className="text-3xl font-bold text-white">7</div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-400 text-sm font-bold">T</span>
                    <span className="text-xs text-slate-400">Characters Typed</span>
                  </div>
                  <div className="text-3xl font-bold text-white">350</div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-slate-400">Chars/min</span>
                  </div>
                  <div className="text-3xl font-bold text-white">58</div>
                </div>
                <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400">Deletion Rate</span>
                  </div>
                  <div className="text-3xl font-bold text-white">10%</div>
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
                    <p className="text-sm text-slate-400">Assessment Summary</p>
                  </div>
                  <span className="px-3 py-1 rounded text-sm font-medium bg-green-600/10 border border-green-600/30 text-green-400">
                    {selectedCandidate.recommendation}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="text-4xl font-bold text-white">{weightedFinalScore}</div>
                  <div className="text-sm text-slate-400">/100</div>
                  <div className="flex-1">
                    <div className="h-3 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${weightedFinalScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((star) => (
                      <span key={star} className="text-yellow-400 text-xl">★</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Communication</span>
                      </div>
                      <span className="text-sm font-bold">9/10</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Clear communication of approach</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Technical Depth</span>
                      </div>
                      <span className="text-sm font-bold">9/10</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Efficient recursive solution</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Problem Solving</span>
                      </div>
                      <span className="text-sm font-bold">8/10</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '80%' }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Could discuss iterative alternatives</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Edge Case Awareness</span>
                      </div>
                      <span className="text-sm font-bold">7/10</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                    <p className="text-xs text-slate-400">Consider memory optimization for very deep trees</p>
                  </div>
                </div>

                <div className="border-t border-[#2a2a2a] pt-6">
                  <h4 className="text-sm font-semibold mb-3">AI Summary</h4>
                  <p className="text-sm text-slate-300 mb-6">
                    Sarah demonstrated excellent problem-solving skills with a clean recursive solution. She articulated her thought process clearly and handled edge cases well. Her code is concise and follows best practices.
                  </p>

                  <div>
                    <p className="text-sm font-medium mb-2">Was this assessment helpful?</p>
                    <p className="text-xs text-slate-400 mb-3">Your feedback trains the model</p>
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
      <div className="max-w-7xl mx-auto p-8 space-y-4">
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
                    {candidate.recommendation}
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
    </div>
  );
}
