import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Circle,
  ExternalLink, 
  Clock, 
  Layers, 
  BookOpen, 
  Flame,
  ArrowRight, 
  Target, 
  AlertTriangle, 
  Award,
  Zap,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Compass,
  BrainCircuit,
  Check
} from 'lucide-react';
import api from '../../services/api';
import { getLeetCodeUrl } from '../../services/utils';
import MetricCard from '../../components/common/MetricCard';
import DifficultyBadge from '../../components/common/DifficultyBadge';
import PatternTag from '../../components/common/PatternTag';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

export default function Home() {
  const [dashboardData, setDashboardData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedRevisions, setCompletedRevisions] = useState({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [data, recsData] = await Promise.all([
          api.getDashboard(),
          api.getRecommendations().catch(() => ({ recommendations: [] }))
        ]);
        setDashboardData(data);
        setRecommendations(recsData.recommendations || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleRevisionDone = async (problem) => {
    // Optimistic UI update
    setCompletedRevisions(prev => ({
      ...prev,
      [problem.id]: true
    }));
    try {
      // Pass the original FSRS problem ID to push its date forward, and the current UI problem as the satisfiedBy reference
      await api.submitReview(problem.originalDueProblemId || problem.id, 'completed', problem.id);
    } catch (err) {
      console.error('Failed to submit review:', err);
      // Revert on failure
      setCompletedRevisions(prev => ({
        ...prev,
        [problem.id]: false
      }));
    }
  };

  if (loading) {
    return <LoadingState text="Syncing CPRecal Command Center & FSRS Engine..." skeleton={true} />;
  }

  if (error || !dashboardData) {
    return (
      <div className="panel-card p-12 text-center space-y-4 max-w-lg mx-auto mt-10">
        <div className="w-14 h-14 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] flex items-center justify-center mx-auto border border-[var(--status-danger-border)] shadow-[var(--status-danger-glow)]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Unable to initialize dashboard</h2>
        <p className="text-xs text-[var(--status-danger)] font-semibold">{error || 'Dashboard data not found'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-secondary text-xs inline-flex items-center gap-2 mt-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
        </button>
      </div>
    );
  }

  const { stats, todaysRevision = [], weakPatterns = [], strongPatterns = [] } = dashboardData;
  const dueCount = stats.duePatternsCount ?? stats.reviewDue ?? todaysRevision.length;

  return (
    <div className="space-y-8 page-content">
      {/* ── Hero Command Banner ── */}
      <div className="panel-card p-6 sm:p-8 relative overflow-hidden group">
        {/* Background ambient lighting */}
        <div 
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.6) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, transparent 70%)' }}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-[10px] font-mono font-bold uppercase tracking-wider border border-[var(--border-accent)] flex items-center gap-1.5 shadow-xs">
                <BrainCircuit className="w-3 h-3 text-[var(--brand-primary)]" />
                FSRS Spaced Repetition Active
              </span>
              {dueCount > 0 ? (
                <span className="glow-badge-danger text-[10px]">
                  <Target className="w-3 h-3 animate-spin-slow" /> {dueCount} Reviews Due Today
                </span>
              ) : (
                <span className="glow-badge-success text-[10px]">
                  <Check className="w-3 h-3" /> All Intervals Cleared
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Algorithmic <span className="gradient-text-primary">Command Center</span>
            </h1>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Real-time DSA pattern mastery tracking with mathematical FSRS spaced repetition scheduling. Retain algorithms permanently through calculated review intervals.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
            <Link
              to="/problems"
              className="btn-primary py-2.5 px-4 text-xs shadow-sm hover:shadow-[var(--brand-glow)]"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/patterns"
              className="btn-secondary py-2.5 px-4 text-xs"
            >
              <Layers className="w-4 h-4 text-[var(--brand-secondary)]" />
              <span>Pattern Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Primary KPI Bento Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          index={0}
          icon={BookOpen}
          label="Total Problems Solved"
          value={stats.totalSolved ?? 0}
          subtitle="Unique library questions mastered"
          accentColor="primary"
        />
        <MetricCard
          index={1}
          icon={Clock}
          label="Recall Due Today"
          value={dueCount}
          subtitle="Scheduled FSRS retention intervals"
          badge={dueCount > 0 ? `${dueCount} Required` : 'All Clear'}
          badgeType={dueCount > 0 ? 'danger' : 'success'}
          accentColor={dueCount > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          index={2}
          icon={Layers}
          label="Pattern Coverage"
          value={`${stats.patternsCovered ?? stats.patternsAttempted ?? 0}/${stats.totalPatterns ?? 15}`}
          subtitle="DSA categories practiced"
          accentColor="cyan"
        />
        <MetricCard
          index={3}
          icon={Flame}
          label="Average Mastery"
          value={`${stats.averageMastery ?? 0}%`}
          subtitle="Across solved library problems"
          accentColor="warning"
        />
      </div>

      {/* ── Section 1: Today's Pattern Recall Recommendations (FSRS) ── */}
      <section id="recall" className="panel-card p-5 sm:p-7 space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] flex items-center justify-center flex-shrink-0 border border-[var(--status-danger-border)] shadow-[var(--status-danger-glow)]">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  TODAY'S REVIEW: SCHEDULED RECALL
                </h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger-border)]">
                  {todaysRevision.length} Due
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Previously solved problems that are scheduled for FSRS review to prevent memory decay.
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] self-start sm:self-auto font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] flex-shrink-0" />
            High mastery problems return periodically to ensure long-term retention
          </div>
        </div>

        {todaysRevision.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="You're all caught up."
            description="Nothing is due for review right now. Explore the Problem Library for targeted pattern practice."
            actionText="Explore Problem Library"
            onAction={() => window.location.href = '/problems'}
          />
        ) : (
          <div>
            {/* Desktop & Tablet Data Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-20">#ID</th>
                    <th>Problem Title</th>
                    <th>Difficulty</th>
                    <th>Pattern Due</th>
                    <th className="text-center">Mastery Score</th>
                    <th className="text-center">Review Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysRevision.map((problem) => {
                    const isDone = completedRevisions[problem.id];
                    const primaryPattern = problem.patternsWithMastery?.[0] || { name: 'Unknown', cumulativeMastery: 0, solved: 0, total: 0 };

                    return (
                      <tr 
                        key={problem.id}
                        className={`transition-all duration-200 ${isDone ? 'opacity-40 bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-hover)]'}`}
                      >
                        <td className="font-mono text-xs text-[var(--text-muted)] font-bold">
                          #{problem.leetcodeId || problem.id?.slice(-4)}
                        </td>
                        <td>
                          <Link
                            to={`/problems/${problem.id}`}
                            className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition-colors inline-flex items-center gap-1.5 group"
                          >
                            <span>{problem.title}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--brand-primary)]" />
                          </Link>
                        </td>
                        <td>
                          <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                        </td>
                        <td>
                          <PatternTag
                            name={primaryPattern.name}
                            cumulativeMastery={primaryPattern.cumulativeMastery}
                            solved={primaryPattern.solved}
                            total={primaryPattern.total}
                            size="xs"
                          />
                        </td>
                        <td className="text-center font-mono font-bold text-xs">
                          <span className={problem.masteryScore >= 80 ? 'text-[var(--status-success)]' : problem.masteryScore >= 60 ? 'text-[var(--brand-primary)]' : 'text-[var(--status-warning)]'}>
                            {problem.masteryScore !== undefined ? `${problem.masteryScore}%` : '—'}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => toggleRevisionDone(problem)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                              isDone
                                ? 'bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)]'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-success)]" />
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <span>Review Complete</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={getLeetCodeUrl(problem.titleSlug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary text-xs py-1.5 px-3"
                              title="Solve on LeetCode"
                            >
                              <span>Solve</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <Link
                              to={`/problems/${problem.id}`}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              <span>Details</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 768px) */}
            <div className="md:hidden space-y-3">
              {todaysRevision.map((problem) => {
                const isDone = completedRevisions[problem.id];
                const primaryPattern = problem.patternsWithMastery?.[0] || { name: 'Unknown', cumulativeMastery: 0, solved: 0, total: 0 };

                return (
                  <div
                    key={problem.id}
                    className={`p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3 transition-all ${
                      isDone ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold block">
                          #{problem.leetcodeId || problem.id?.slice(-4)}
                        </span>
                        <Link
                          to={`/problems/${problem.id}`}
                          className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--brand-primary)]"
                        >
                          {problem.title}
                        </Link>
                      </div>
                      <DifficultyBadge difficulty={problem.difficulty} size="xs" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                      <span className="text-[var(--text-muted)] text-[10px] uppercase font-mono font-bold">Due Pattern:</span>
                      <PatternTag
                        name={primaryPattern.name}
                        cumulativeMastery={primaryPattern.cumulativeMastery}
                        solved={primaryPattern.solved}
                        total={primaryPattern.total}
                        size="xs"
                      />
                      <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] ml-auto">
                        Score: {problem.masteryScore ?? 0}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => toggleRevisionDone(problem)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          isDone
                            ? 'bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success-border)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        <span>{isDone ? 'Completed' : 'Review Complete'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <a
                          href={getLeetCodeUrl(problem.titleSlug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-xs py-1.5 px-2.5"
                        >
                          <span>Solve</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <Link
                          to={`/problems/${problem.id}`}
                          className="btn-secondary text-xs py-1.5 px-2.5"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Targeted Practice (Fresh Unsolved Problems Matching Weakest Patterns) ── */}
      <section id="targeted-practice" className="panel-card p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] text-[var(--brand-primary)] flex items-center justify-center flex-shrink-0 border border-[var(--border-accent)] shadow-[var(--brand-glow)]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  TARGETED PRACTICE: NEW CHALLENGES
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info-border)]">
                  Fresh Questions
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                New, unsolved problems selected to strengthen your weaker patterns.
              </p>
            </div>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No targeted practice available right now."
            description="Keep solving problems to build your pattern profile."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="interactive-card p-5 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono text-[var(--text-muted)] font-bold">
                      #{rec.problem.leetcodeId}
                    </span>
                    <DifficultyBadge difficulty={rec.problem.difficulty} size="xs" />
                  </div>
                  
                  <a
                    href={getLeetCodeUrl(rec.problem.titleSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors block line-clamp-2"
                  >
                    {rec.problem.title}
                  </a>

                  <div className="text-xs bg-[var(--brand-light)] text-[var(--brand-primary)] p-3 rounded-xl border border-[var(--border-accent)] shadow-[var(--brand-glow)] font-medium leading-relaxed">
                    <span className="block font-bold text-[10px] uppercase font-mono mb-1 flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> ◆ New Challenge
                    </span>
                    <span className="block font-semibold mb-1 text-[var(--text-primary)]">Strengthen: {rec.targetPattern}</span>
                    <span className="text-[10px] opacity-80">{rec.reason}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[var(--border-subtle)]">
                   <a
                    href={getLeetCodeUrl(rec.problem.titleSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs py-2 px-3 w-full justify-center shadow-xs"
                  >
                    <span>Solve Problem</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Pattern Strengths Overview & FSRS Spaced Memory ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pattern Highlights */}
        <div className="panel-card p-5 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-primary)]" />
              Pattern Mastery Highlights
            </h3>
            <Link to="/patterns" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-5">
            {/* Weak Patterns */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--status-danger)] block mb-2.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Focus Areas (Weakest Patterns)
              </span>
              {weakPatterns.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic p-2">No weak patterns identified yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {weakPatterns.map((pat) => (
                    <div key={pat.pattern} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs hover:border-[var(--status-danger-border)] transition-colors">
                      <Link to={`/problems?pattern=${encodeURIComponent(pat.pattern)}`} className="font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)]">
                        {pat.pattern}
                      </Link>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-[var(--text-muted)] text-[11px]">{pat.totalProblemsSolved} solved</span>
                        <span className="font-extrabold text-[var(--status-danger)] text-sm">{pat.mastery}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strong Patterns */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--status-success)] block mb-2.5 flex items-center gap-1.5">
                <Award className="w-3 h-3" /> Strongest Patterns
              </span>
              {strongPatterns.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic p-2">Solve more problems to establish strengths.</p>
              ) : (
                <div className="space-y-2.5">
                  {strongPatterns.map((pat) => (
                    <div key={pat.pattern} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs hover:border-[var(--status-success-border)] transition-colors">
                      <Link to={`/problems?pattern=${encodeURIComponent(pat.pattern)}`} className="font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)]">
                        {pat.pattern}
                      </Link>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-[var(--text-muted)] text-[11px]">{pat.totalProblemsSolved} solved</span>
                        <span className="font-extrabold text-[var(--status-success)] text-sm">{pat.mastery}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FSRS Spaced Memory Architecture Card */}
        <div className="panel-card p-5 sm:p-7 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--brand-secondary)]" />
                Spaced Recall Architecture
              </h3>
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                FSRS Algorithm
              </span>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p>
                CPRecal cleanly separates <strong className="text-[var(--text-primary)]">Targeted Practice</strong> from <strong className="text-[var(--text-primary)]">Spaced Recall</strong>:
              </p>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="font-bold text-[var(--brand-primary)] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Targeted Practice (Fresh Problems)
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Surfaces unvisited LeetCode questions targeting your weakest algorithmic patterns to build breadth.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
                  <div className="font-bold text-[var(--status-success)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> FSRS Spaced Recall (Retention)
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Recalls previously mastered questions exactly when intervals mature to prevent forgetting curve decay.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono text-[var(--brand-primary)] font-bold">
              Mastery: 25% + 25% + 20% + 15% + 15%
            </span>
            <Link to="/patterns" className="btn-secondary text-xs">
              Explore All Patterns
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
