import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, 
  Search, 
  X, 
  ArrowRight, 
  Award,
  AlertTriangle, 
  RotateCcw,
  CircleDashed,
  Clock
} from 'lucide-react';
import api from '../../services/api';
import { formatDueDate } from '../../services/utils';
import MasteryRing from '../../components/common/MasteryRing';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

export default function PatternDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filter & Sort States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'RECALL', 'ATTEMPTED', 'UNSOLVED'
  const [tierFilter, setTierFilter] = useState('ALL'); // 'ALL', 'MASTERED', 'STRONG', 'FOCUS'
  const [sortBy, setSortBy] = useState('mastery_desc'); // 'mastery_desc', 'mastery_asc', 'solved_desc', 'name_asc'

  useEffect(() => {
    async function loadPatterns() {
      try {
        const res = await api.getPatterns();
        setData(res);
      } catch (err) {
        console.error('Failed to load patterns:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPatterns();
  }, []);

  if (loading || !data) {
    return <LoadingState text="Aggregating algorithmic pattern mastery metrics..." skeleton={true} />;
  }

  const { patterns = [], weakPatterns = [], strongPatterns = [] } = data;

  const getStrengthTier = (mastery, solved) => {
    if (solved === 0 || mastery === 0) return { key: 'UNSTARTED', label: 'Unstarted', color: 'text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border-subtle)]' };
    if (mastery >= 80) return { key: 'MASTERED', label: 'Mastered', color: 'text-[var(--status-success)] bg-[var(--status-success-bg)] border-[var(--status-success-border)]' };
    if (mastery >= 60) return { key: 'STRONG', label: 'Strong', color: 'text-[var(--brand-primary)] bg-[var(--brand-light)] border-[var(--border-accent)]' };
    if (mastery >= 40) return { key: 'MODERATE', label: 'Moderate', color: 'text-[var(--status-warning)] bg-[var(--status-warning-bg)] border-[var(--status-warning-border)]' };
    return { key: 'FOCUS', label: 'Needs Focus', color: 'text-[var(--status-danger)] bg-[var(--status-danger-bg)] border-[var(--status-danger-border)]' };
  };

  // Filter patterns
  const filteredPatterns = patterns.filter((pat) => {
    if (search.trim()) {
      if (!pat.pattern.toLowerCase().includes(search.trim().toLowerCase())) return false;
    }
    if (statusFilter === 'RECALL' && !pat.recallDue) return false;
    if (statusFilter === 'SCHEDULED' && !pat.nextReviewDate) return false;
    if (statusFilter === 'ATTEMPTED' && pat.totalProblemsSolved === 0) return false;
    if (statusFilter === 'UNSOLVED' && pat.totalProblemsSolved > 0) return false;

    if (tierFilter !== 'ALL') {
      const tier = getStrengthTier(pat.mastery, pat.totalProblemsSolved);
      if (tier.key !== tierFilter) return false;
    }
    return true;
  });

  // Sort patterns
  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    if (sortBy === 'mastery_desc') return b.mastery - a.mastery;
    if (sortBy === 'mastery_asc') return a.mastery - b.mastery;
    if (sortBy === 'solved_desc') return b.totalProblemsSolved - a.totalProblemsSolved;
    if (sortBy === 'name_asc') return a.pattern.localeCompare(b.pattern);
    return 0;
  });

  const recallDueCount = patterns.filter(p => p.recallDue).length;
  const scheduledCount = patterns.filter(p => p.nextReviewDate).length;
  const attemptedCount = patterns.filter(p => p.totalProblemsSolved > 0).length;
  const unstartedCount = patterns.filter(p => p.totalProblemsSolved === 0).length;
  const masteredCount = patterns.filter(p => p.mastery >= 80 && p.totalProblemsSolved > 0).length;
  const hasActiveFilters = search || statusFilter !== 'ALL' || tierFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTierFilter('ALL');
  };

  return (
    <div className="space-y-8 page-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              DSA Pattern <span className="gradient-text-primary">Mastery</span>
            </h1>
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              15 Core Algorithmic Frameworks
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Cumulative algorithmic mastery aggregated across all completed problems in each category.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex items-center gap-2 text-xs font-mono self-start sm:self-auto flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-bold shadow-xs">
            {patterns.length} Patterns
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger-border)] font-bold shadow-xs">
            {recallDueCount} Recall Due
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] font-bold shadow-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {scheduledCount} Scheduled
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)] font-bold shadow-xs">
            {masteredCount} Mastered
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel-card p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--brand-primary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter DSA pattern by name (e.g. 'Sliding Window', 'Two Pointers', 'Dynamic Programming')..."
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
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px] mr-1">Status:</span>
            {[
              { key: 'ALL', label: `All (${patterns.length})` },
              { key: 'RECALL', label: `Recall Due (${recallDueCount})` },
              { key: 'SCHEDULED', label: `Scheduled (${scheduledCount})` },
              { key: 'ATTEMPTED', label: `Practiced (${attemptedCount})` },
              { key: 'UNSOLVED', label: `Unstarted (${unstartedCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === key
                    ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tier Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px] mr-1">Tier:</span>
            {[
              { key: 'ALL', label: 'All Tiers' },
              { key: 'MASTERED', label: 'Mastered (80%+)' },
              { key: 'STRONG', label: 'Strong (60-79%)' },
              { key: 'FOCUS', label: 'Needs Focus (<40%)' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTierFilter(key)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  tierFilter === key
                    ? 'bg-[var(--brand-secondary)] text-white shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-mono font-bold uppercase text-[10px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-control text-xs py-1.5 cursor-pointer font-semibold"
            >
              <option value="mastery_desc">Mastery: High → Low</option>
              <option value="mastery_asc">Mastery: Low → High</option>
              <option value="solved_desc">Problems Solved: Most → Least</option>
              <option value="name_asc">Name: A → Z</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
            <span className="text-[var(--text-muted)] font-mono">
              Showing <strong className="text-[var(--text-primary)] font-bold">{sortedPatterns.length}</strong> matching patterns
            </span>
            <button
              onClick={clearFilters}
              className="btn-ghost text-xs text-[var(--brand-primary)] py-0.5 hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Pattern Cards Grid */}
      {sortedPatterns.length === 0 ? (
        <div className="panel-card p-10">
          <EmptyState
            icon={Layers}
            title="No patterns match your active filters"
            description="Try relaxing your search keywords or switching to 'All' status."
            actionText="Reset Filters"
            onAction={clearFilters}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedPatterns.map((pat) => {
            const tier = getStrengthTier(pat.mastery, pat.totalProblemsSolved);
            const isUnstarted = pat.totalProblemsSolved === 0;

            return (
              <div
                key={pat.id || pat.pattern}
                className="interactive-card p-5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors truncate">
                        {pat.pattern}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.color}`}>
                          {tier.label}
                        </span>
                        {pat.recallDue ? (
                          <span className="glow-badge-danger text-[9px] py-0 px-2 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {formatDueDate(pat.nextReviewDate) || 'Recall Due'}
                          </span>
                        ) : pat.nextReviewDate ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-[var(--brand-primary)]" />
                            {formatDueDate(pat.nextReviewDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {isUnstarted ? (
                      <div className="w-12 h-12 rounded-full border border-dashed border-[var(--border-strong)] flex items-center justify-center bg-[var(--bg-elevated)] flex-shrink-0">
                        <CircleDashed className="w-5 h-5 text-[var(--text-muted)]" />
                      </div>
                    ) : (
                      <MasteryRing value={pat.mastery} size={50} strokeWidth={4} className="flex-shrink-0" />
                    )}
                  </div>

                  {/* Coverage Progress */}
                  <div className="space-y-2 mt-4 pt-3.5 border-t border-[var(--border-subtle)]">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] font-mono">
                      <span>Solved Volume</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {pat.totalProblemsSolved} problems
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isUnstarted ? 'bg-transparent' : 'bg-[var(--brand-gradient)]'
                        }`}
                        style={{ width: `${Math.min(pat.mastery, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] font-bold">
                    {isUnstarted ? '0 solved' : `${pat.mastery}% mastery`}
                  </span>
                  <Link
                    to={`/problems?pattern=${encodeURIComponent(pat.pattern)}`}
                    className="text-xs font-bold text-[var(--brand-primary)] group-hover:translate-x-0.5 transition-transform flex items-center gap-1"
                  >
                    <span>{isUnstarted ? 'Start Pattern' : 'View Library'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strong vs Weak Pattern Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Strong Patterns */}
        <div className="panel-card p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-[var(--border-subtle)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)] flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Strongest Algorithmic Patterns
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Patterns where your solution optimality, runtime scores, and retention intervals are highest.
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            {strongPatterns.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic p-4 text-center">Solve more questions across different DSA patterns to establish strengths.</p>
            ) : (
              strongPatterns.map((pat, idx) => (
                <div
                  key={pat.id || pat.pattern}
                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs hover:border-[var(--status-success-border)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[var(--status-success-bg)] text-[var(--status-success)] font-mono font-bold flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">{pat.pattern}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[11px]">({pat.totalProblemsSolved} solved)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-sm text-[var(--status-success)]">{pat.mastery}%</span>
                    <Link
                      to={`/problems?pattern=${encodeURIComponent(pat.pattern)}`}
                      className="btn-ghost p-1.5 hover:text-[var(--brand-primary)]"
                      title="Filter problems in library"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Focus Areas (Weak Patterns) */}
        <div className="panel-card p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3.5 border-b border-[var(--border-subtle)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger-border)] flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Focus Areas (Targeted Practice)
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Patterns with lower efficiency scores, higher submissions count, or due recall.
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            {weakPatterns.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic p-4 text-center">No weak patterns identified yet. Keep practicing to surface focus areas.</p>
            ) : (
              weakPatterns.map((pat, idx) => (
                <div
                  key={pat.id || pat.pattern}
                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs hover:border-[var(--status-danger-border)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger)] font-mono font-bold flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">{pat.pattern}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[11px]">({pat.totalProblemsSolved} solved)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-sm text-[var(--status-danger)]">{pat.mastery}%</span>
                    <Link
                      to={`/problems?pattern=${encodeURIComponent(pat.pattern)}`}
                      className="btn-ghost p-1.5 hover:text-[var(--brand-primary)]"
                      title="Filter problems in library"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
