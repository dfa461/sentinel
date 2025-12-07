import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Github, ExternalLink, Sparkles, ArrowLeft, Loader2, Trophy } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface CandidateResult {
  username: string;
  post_text: string;
  post_url: string;
  github_links: string[];
  relevance_score: number | null;
}

interface SearchResponse {
  role_description: string;
  jd_keywords: string[];
  search_queries_used: string[];
  candidates_found: number;
  total_users_discovered: number;
  users_with_github: number;
  candidates: CandidateResult[];
}

export function CandidateSearchPage() {
  const navigate = useNavigate();
  const [roleDescription, setRoleDescription] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  const handleSearch = async () => {
    if (!roleDescription.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE}/search-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_description: roleDescription,
          max_results: maxResults,
        }),
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        setSearchResults(data);
      } else {
        alert('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Make sure the backend is running.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="glass-effect border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Candidate Discovery</h1>
                <p className="text-xs text-slate-400">AI-powered X search for developers</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Form */}
        <div className="glass-effect rounded-xl p-6 border border-slate-700 mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Role Description
          </label>
          <textarea
            value={roleDescription}
            onChange={(e) => setRoleDescription(e.target.value)}
            placeholder="e.g., Senior ML Engineer with PyTorch and transformers experience, open source contributions preferred"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
          />

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Max Results:</label>
              <input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 10)}
                min="1"
                max="50"
                className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching || !roleDescription.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search Candidates
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Stats */}
        {searchResults && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass-effect rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-blue-400">{searchResults.total_users_discovered}</div>
              <div className="text-xs text-slate-400">Users Discovered</div>
            </div>
            <div className="glass-effect rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-green-400">{searchResults.users_with_github}</div>
              <div className="text-xs text-slate-400">With GitHub</div>
            </div>
            <div className="glass-effect rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-purple-400">{searchResults.candidates_found}</div>
              <div className="text-xs text-slate-400">Top Matches</div>
            </div>
            <div className="glass-effect rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-yellow-400">{searchResults.search_queries_used.length}</div>
              <div className="text-xs text-slate-400">Search Queries</div>
            </div>
          </div>
        )}

        {/* Keywords Used */}
        {searchResults && searchResults.jd_keywords.length > 0 && (
          <div className="glass-effect rounded-lg p-4 border border-slate-700 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-slate-300">Extracted Keywords</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchResults.jd_keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs border border-blue-500/30"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {searchResults && searchResults.candidates.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Top Candidates</h2>
            {searchResults.candidates.map((candidate, idx) => (
              <div
                key={idx}
                className="glass-effect rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <a
                        href={candidate.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-blue-400 hover:text-blue-300 flex items-center gap-2"
                      >
                        @{candidate.username}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {candidate.relevance_score && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30">
                          <Trophy className="w-3 h-3" />
                          {candidate.relevance_score.toFixed(1)}/10
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                      {candidate.post_text}
                    </p>

                    {/* GitHub Links */}
                    <div className="space-y-2">
                      {candidate.github_links.map((link, linkIdx) => (
                        <a
                          key={linkIdx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-fit"
                        >
                          <Github className="w-4 h-4" />
                          <span className="font-mono text-xs">{link}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchResults && searchResults.candidates.length === 0 ? (
          <div className="glass-effect rounded-xl p-12 border border-slate-700 text-center">
            <p className="text-slate-400">
              No candidates found with GitHub links. Try a broader role description or check back later.
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Searched {searchResults.total_users_discovered} users, found {searchResults.users_with_github} with GitHub.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
