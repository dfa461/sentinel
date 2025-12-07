import { useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface CandidateSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCandidatesFound: (candidates: any[]) => void;
}

export function CandidateSearchModal({ isOpen, onClose, onCandidatesFound }: CandidateSearchModalProps) {
  const [roleDescription, setRoleDescription] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [isSearching, setIsSearching] = useState(false);

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
        const data = await response.json();
        onCandidatesFound(data.candidates);
        setRoleDescription('');
        onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-effect rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Discover Candidates</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Role Description
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="e.g., Senior ML Engineer with PyTorch and transformers experience"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Max Results: {maxResults}
            </label>
            <input
              type="range"
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              min="5"
              max="50"
              step="5"
              className="w-full"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSearch}
              disabled={isSearching || !roleDescription.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching X...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search Candidates
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
