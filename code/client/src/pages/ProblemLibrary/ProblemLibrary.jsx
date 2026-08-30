import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ChevronDown, 
  X,
  Target,
  RotateCcw,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { PATTERNS, getLeetCodeUrl, formatDueDate } from '../../services/utils';
import DifficultyBadge from '../../components/common/DifficultyBadge';
import PatternTag from '../../components/common/PatternTag';
import MasteryBar from '../../components/common/MasteryBar';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

export default function ProblemLibrary() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const initialPattern = searchParams.get('pattern') || 'ALL';
  const initialStatus = searchParams.get('status')?.toUpperCase() || 'ALL';

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedPattern, setSelectedPattern] = useState(initialPattern);
  const [page, setPage] = useState(1);
  const [totalProblems, setTotalProblems] = useState(0);
  const limit = 20;

  // Sync with URL params
  useEffect(() => {
    const p = searchParams.get('pattern');
    if (p) setSelectedPattern(p);
    const s = searchParams.get('status');
    if (s) setSelectedStatus(s.toUpperCase());
  }, [searchParams]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedDifficulty, selectedStatus, selectedPattern]);

  useEffect(() => {
    async function loadProblems() {
      setLoading(true);
      setError(null);
      try {
        const filters = {
          limit,
          offset: (page - 1) * limit
        };
        
        if (selectedDifficulty !== 'ALL') filters.difficulty = selectedDifficulty;
        if (selectedStatus === 'SOLVED') filters.status = 'solved';
        if (selectedStatus === 'UNSOLVED') filters.status = 'unsolved';
        if (selectedStatus === 'RECALL') filters.status = 'recall';
        if (selectedStatus === 'SCHEDULED') filters.status = 'scheduled';
        if (selectedPattern !== 'ALL') filters.pattern = selectedPattern;
        if (search.trim()) filters.search = search.trim();

        const data = await api.getProblems(filters);
        setProblems(data.problems || []);
        setTotalProblems(data.total || 0);
      } catch (err) {
        console.error('Failed to load problems:', err);
        setError(err.message || 'Failed to load problems');
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadProblems();
    }, 150);

    return () => clearTimeout(timer);
  }, [search, selectedDifficulty, selectedStatus, selectedPattern, page]);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedDifficulty('ALL');
    setSelectedStatus('ALL');
    setSelectedPattern('ALL');
    setSearchParams({});
    setPage(1);
  };

  const hasActiveFilters = search || selectedDifficulty !== 'ALL' || selectedStatus !== 'ALL' || selectedPattern !== 'ALL';
  const totalPages = Math.ceil(totalProblems / limit) || 1;

  return (
    <div className="space-y-6 page-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Problem <span className="gradient-text-primary">Library</span>
            </h1>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)]">
              4,000+ Questions Indexed
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Browse all LeetCode questions, inspect individual session mastery scores, and filter by FSRS recall status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="btn-ghost text-xs text-[var(--brand-primary)] hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
          <span className="text-xs font-mono font-bold bg-[var(--bg-elevated)] text-[var(--text-primary)] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] shadow-xs">
            {totalProblems.toLocaleString()} {totalProblems === 1 ? 'problem' : 'problems'}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="panel-card p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--brand-primary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search problems by title, topic or LeetCode number (e.g. 'Two Sum', 'Binary Tree', '#42')..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-control pl-10 pr-9 text-xs sm:text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1">
          {/* Difficulty Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px] mr-1">Difficulty:</span>
            {['ALL', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedDifficulty === diff
                    ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px] mr-1">Status:</span>
            {[
              { key: 'ALL', label: 'All', desc: 'View all questions' },
              { key: 'SOLVED', label: 'Solved', desc: 'Questions you have solved' },
              { key: 'UNSOLVED', label: 'Unsolved', desc: 'Questions you have not attempted' },
              { key: 'RECALL', label: 'Recall Due', desc: 'New unsolved recall challenges due for review today' },
              { key: 'SCHEDULED', label: 'Scheduled Recall', desc: 'New unsolved recall challenges scheduled for future review' },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                title={desc}
                onClick={() => setSelectedStatus(key)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedStatus === key
                    ? 'bg-[var(--brand-secondary)] text-white shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Pattern Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px]">Pattern:</span>
            <div className="relative">
              <select
                value={selectedPattern}
                onChange={(e) => setSelectedPattern(e.target.value)}
                className="input-control text-xs pr-8 appearance-none cursor-pointer py-1.5 font-semibold"
              >
                <option value="ALL">All Patterns (15)</option>
                {PATTERNS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Problems Display (Desktop Table / Mobile Cards) */}
      <div className="panel-card overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingState text="Loading matching problems..." skeleton={true} />
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-4">
            <p className="text-[var(--status-danger)] font-bold">{error}</p>
          </div>
        ) : problems.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No matching problems found"
            description="No LeetCode problems match your search criteria. Try relaxing active filters."
            actionText="Reset All Filters"
            onAction={clearAllFilters}
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-20">#ID</th>
                    <th>Problem Title</th>
                    <th>Difficulty</th>
                    <th>DSA Patterns</th>
                    <th className="w-48">Problem Mastery</th>
                    <th>FSRS State</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((problem) => (
                    <tr key={problem.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="font-mono text-xs text-[var(--text-muted)] font-bold">
                        #{problem.leetcodeId || problem.id?.slice(-4)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/problems/${problem.id}`}
                            className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors"
                          >
                            {problem.title}
                          </Link>
                          {problem.userState?.reviewDue ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger-border)] font-bold flex items-center gap-0.5">
                              <Target className="w-2.5 h-2.5" /> Recall Due
                            </span>
                          ) : problem.originalDueProblemId ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] font-bold flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> Scheduled Recall
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {problem.patterns.map((pat) => (
                            <PatternTag
                              key={pat}
                              name={pat}
                              size="xs"
                            />
                          ))}
                        </div>
                      </td>
                      <td>
                        {problem.userState?.solved ? (
                          <div className="w-40">
                            <MasteryBar
                              value={problem.userState.mastery}
                              showLabel={true}
                              height="h-1.5"
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            Unsolved
                          </span>
                        )}
                      </td>
                      <td>
                        {problem.userState?.reviewDue ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--status-danger)]">
                            <Clock className="w-3.5 h-3.5" /> Due Today
                          </span>
                        ) : problem.userState?.nextReviewDate && !problem.userState?.solved ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-primary)]">
                            <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary)]" /> 
                            {formatDueDate(problem.userState.nextReviewDate)}
                          </span>
                        ) : problem.userState?.solved ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-success)]" /> 
                            {formatDueDate(problem.userState.nextReviewDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Unattempted</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={getLeetCodeUrl(problem.titleSlug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost text-xs p-1.5 hover:text-[var(--brand-primary)]"
                            title="Open on LeetCode"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <Link
                            to={`/problems/${problem.id}`}
                            className="btn-secondary text-xs py-1 px-3 font-semibold"
                          >
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Card View (< 1024px) */}
            <div className="lg:hidden divide-y divide-[var(--border-subtle)]">
              {problems.map((problem) => (
                <div key={problem.id} className="p-4 space-y-3 hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold block">
                        #{problem.leetcodeId || problem.id?.slice(-4)}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/problems/${problem.id}`}
                          className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--brand-primary)]"
                        >
                          {problem.title}
                        </Link>
                        {problem.userState?.reviewDue ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger-border)] font-bold flex items-center gap-0.5">
                            <Target className="w-2.5 h-2.5" /> Recall Due
                          </span>
                        ) : problem.originalDueProblemId ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] font-bold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Scheduled Recall
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                  </div>

                  {/* Patterns */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {problem.patterns.map((pat) => (
                      <PatternTag
                        key={pat}
                        name={pat}
                        size="xs"
                      />
                    ))}
                  </div>

                  {/* Mastery & Actions Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)] text-xs">
                    <div>
                      {problem.userState?.reviewDue ? (
                        <span className="font-mono text-[var(--status-danger)] font-bold text-xs">
                          Recall Due Today
                        </span>
                      ) : problem.userState?.nextReviewDate && !problem.userState?.solved ? (
                        <span className="font-mono font-bold text-[var(--brand-primary)] text-xs flex flex-col">
                          <span>Scheduled Recall</span>
                          <span className="text-[10px] text-[var(--text-secondary)]">{formatDueDate(problem.userState.nextReviewDate)}</span>
                        </span>
                      ) : problem.userState?.solved ? (
                        <span className="font-mono font-bold text-[var(--status-success)] text-xs flex flex-col">
                          <span>{problem.userState.mastery}% mastery</span>
                          <span className="text-[10px] text-[var(--text-secondary)]">{formatDueDate(problem.userState.nextReviewDate)}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Unsolved</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={getLeetCodeUrl(problem.titleSlug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs p-1.5"
                        title="Solve on LeetCode"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link
                        to={`/problems/${problem.id}`}
                        className="btn-secondary text-xs py-1 px-3 font-semibold"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalProblems > limit && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between panel-card p-4 gap-4">
          <span className="text-xs text-[var(--text-secondary)] font-semibold text-center sm:text-left font-mono">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalProblems)} of {totalProblems.toLocaleString()} problems (Page {page} of {totalPages})
          </span>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= totalProblems}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
