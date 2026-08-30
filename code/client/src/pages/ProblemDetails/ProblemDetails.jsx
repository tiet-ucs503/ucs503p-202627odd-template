import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ExternalLink, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  Code2, 
  Cpu, 
  HardDrive, 
  HelpCircle, 
  Calendar, 
  Zap,
  Repeat,
  Copy,
  Check,
  FileText,
  BrainCircuit
} from 'lucide-react';
import api from '../../services/api';
import { getLeetCodeUrl } from '../../services/utils';
import DifficultyBadge from '../../components/common/DifficultyBadge';
import PatternTag from '../../components/common/PatternTag';
import MasteryRing from '../../components/common/MasteryRing';
import MasteryBar from '../../components/common/MasteryBar';
import LoadingState from '../../components/common/LoadingState';

export default function ProblemDetails() {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadProblem() {
      setLoading(true);
      setError(null);
      setProblem(null); // Clear previous state on problem switch to prevent cross-contamination
      try {
        const data = await api.getProblem(id);
        setProblem(data);
      } catch (err) {
        setError(err.message || 'Problem not found');
      } finally {
        setLoading(false);
      }
    }
    loadProblem();
  }, [id]);

  const copyCode = () => {
    if (problem?.userState?.acceptedSolution?.code) {
      navigator.clipboard.writeText(problem.userState.acceptedSolution.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <LoadingState text="Loading problem details & algorithmic analysis..." skeleton={true} />;
  if (error || !problem) {
    return (
      <div className="panel-card p-12 text-center space-y-4 max-w-lg mx-auto mt-10">
        <p className="text-[var(--status-danger)] font-bold text-base">{error || 'Problem not found'}</p>
        <Link to="/problems" className="btn-secondary text-xs inline-flex items-center gap-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Problem Library
        </Link>
      </div>
    );
  }

  const p = problem.problem;
  const userState = problem.userState || {};
  
  const title = p.title;
  const leetcodeId = p.leetcodeId;
  const titleSlug = p.titleSlug;
  const difficulty = p.difficulty;
  
  const solved = !!problem.userState;
  const patternsWithMastery = userState.patternsWithMastery || p.patterns.map(name => ({ name }));
  
  const mastery = userState.mastery;
  const masteryBreakdown = userState.masteryBreakdown;
  const solvingData = userState.solvingData;
  const analysis = userState.acceptedSolution?.analysis;
  const fsrs = userState.fsrs;
  const acceptedCode = userState.acceptedSolution?.code;

  return (
    <div className="space-y-6 page-content">
      {/* Top Bar: Back & Solve Action */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/problems"
          className="btn-ghost text-xs text-[var(--text-secondary)] hover:text-[var(--brand-primary)] -ml-2 gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Problem Library</span>
        </Link>

        <a
          href={getLeetCodeUrl(titleSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-xs shadow-sm"
        >
          <span>Solve on LeetCode</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Problem Header Card */}
      <div className="panel-card p-6 sm:p-8 relative overflow-hidden">
        <div 
          className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)' }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[var(--text-muted)] text-sm font-mono font-bold bg-[var(--bg-elevated)] px-2.5 py-0.5 rounded-md border border-[var(--border-subtle)]">
                #{leetcodeId}
              </span>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                {title}
              </h1>
              <DifficultyBadge difficulty={difficulty} />
            </div>

            {/* Pattern Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-[var(--text-muted)] font-mono font-bold uppercase mr-1">DSA Patterns:</span>
              {patternsWithMastery.map((pat) => (
                <PatternTag
                  key={pat.name}
                  name={pat.name}
                  cumulativeMastery={pat.cumulativeMastery}
                  solved={pat.solved}
                  total={pat.total}
                />
              ))}
            </div>
          </div>

          {/* Problem Mastery Gauge */}
          {solved && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] self-start md:self-auto shadow-xs">
              <MasteryRing value={mastery} size={64} strokeWidth={5} />
              <div>
                <span className="label-caps block">
                  Problem Mastery
                </span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">
                  Latest solve session
                </span>
                <span className="text-xs font-mono text-[var(--brand-primary)] font-bold block mt-1">
                  FSRS Rating: {fsrs?.rating ?? '—'}/4
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Problem Description & Constraints */}
        {p.description && (
          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] space-y-2.5">
            <h3 className="label-caps flex items-center gap-1.5 text-[var(--brand-primary)]">
              <FileText className="w-3.5 h-3.5" /> Problem Context & Requirements
            </h3>
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed max-h-48 overflow-y-auto pr-2 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)] font-mono selection:bg-[var(--brand-primary)] selection:text-white">
              {p.description}
            </div>
          </div>
        )}
      </div>

      {/* Solved Problem Analytics */}
      {solved ? (
        <div className="space-y-6">
          {/* 5-Component Mastery Breakdown & Solving Facts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: 5-Component Breakdown */}
            <div className="panel-card p-6 lg:col-span-2 space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h2 className="font-bold text-base text-[var(--text-primary)]">
                    5-Component Mastery Breakdown
                  </h2>
                </div>
                <span className="text-xs font-mono font-extrabold text-[var(--brand-primary)] bg-[var(--brand-light)] px-3 py-1 rounded-lg border border-[var(--border-accent)]">
                  Session Score: {mastery}%
                </span>
              </div>

              <div className="space-y-4 pt-1">
                <MasteryBar
                  label="Solution Efficiency (Runtime & Memory vs Constraints)"
                  value={masteryBreakdown?.solutionEfficiency ?? 0}
                  weight={25}
                />
                <MasteryBar
                  label="Time Complexity Score (Optimal Big-O Alignment)"
                  value={masteryBreakdown?.timeComplexity ?? 0}
                  weight={25}
                />
                <MasteryBar
                  label="Submissions Until Success (Single-attempt Bonus)"
                  value={masteryBreakdown?.submissionsUntilSuccess ?? 0}
                  weight={20}
                />
                <MasteryBar
                  label="Time Taken (Difficulty Normalized Target)"
                  value={masteryBreakdown?.timeTaken ?? 0}
                  weight={15}
                />
                <MasteryBar
                  label="Hints Used Penalty (Unassisted Solving Reward)"
                  value={masteryBreakdown?.hintsUsed ?? 0}
                  weight={15}
                />
              </div>

              <div className="pt-2 text-[11px] text-[var(--text-muted)] bg-[var(--bg-elevated)] p-3.5 rounded-xl border border-[var(--border-subtle)] leading-relaxed">
                💡 <strong className="text-[var(--text-secondary)]">Mastery Formulation:</strong> Score is calculated from the 5 standard CPRecal weights (25% + 25% + 20% + 15% + 15%). Cumulative pattern mastery across all related problems is viewable on the Pattern Dashboard.
              </div>
            </div>

            {/* Right Col: Solving Facts & FSRS State */}
            <div className="space-y-6">
              {/* Session Metrics */}
              <div className="panel-card p-5 space-y-3.5">
                <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                  Session Performance Metrics
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Time Taken</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{solvingData?.timeTaken || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><Repeat className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Submissions</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{solvingData?.submissions || 1} attempt(s)</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Runtime</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{solvingData?.runtime || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><HardDrive className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Memory</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{solvingData?.memory || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Hints Used</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{solvingData?.hintsUsed ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* FSRS Spaced Repetition Info */}
              {fsrs && (
                <div className="panel-card p-5 space-y-3.5">
                  <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <Calendar className="w-4 h-4 text-[var(--brand-secondary)]" />
                    FSRS Memory State
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Recall Interval</span>
                      <span className="font-mono font-bold text-[var(--brand-primary)] text-sm">{fsrs.interval} days</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Ease Factor</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{fsrs.easeFactor}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Review State</span>
                      <span className="font-mono font-bold text-[var(--status-success)] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" /> Active Schedule
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Context-Aware Algorithmic Analysis (Gemini + Problem Understanding) */}
          {analysis && (
            <div className="panel-card p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <BrainCircuit className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h2 className="font-bold text-base sm:text-lg text-[var(--text-primary)]">
                    Problem-Aware Algorithmic Analysis
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-[var(--brand-secondary)] bg-[var(--bg-elevated)] px-3 py-1 rounded-full border border-[var(--border-subtle)] font-bold">
                  Evaluated Against Real Problem Constraints
                </span>
              </div>

              {/* Complexity Comparison Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <span className="label-caps block mb-1.5">
                    Your Time Complexity
                  </span>
                  <span className="font-mono font-extrabold text-base text-[var(--brand-primary)]">
                    {analysis.actualTimeComplexity || analysis.actualTC || "—"}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <span className="label-caps block mb-1.5">
                    Optimal Time Complexity
                  </span>
                  <span className="font-mono font-extrabold text-base text-[var(--status-success)]">
                    {analysis.optimalTimeComplexity || analysis.optimalTC || "—"}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <span className="label-caps block mb-1.5">
                    Your Space Complexity
                  </span>
                  <span className="font-mono font-extrabold text-base text-[var(--brand-secondary)]">
                    {analysis.actualSpaceComplexity || analysis.actualSC || "—"}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <span className="label-caps block mb-1.5">
                    Optimal Space Complexity
                  </span>
                  <span className="font-mono font-extrabold text-base text-[var(--status-success)]">
                    {analysis.optimalSpaceComplexity || analysis.optimalSC || "—"}
                  </span>
                </div>
              </div>

              {/* Rich Pedagogical Cards Breakdown */}
              {analysis.richAnalysis ? (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Problem Requirements & Constraints */}
                    {analysis.richAnalysis.problemUnderstanding && (
                      <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)] block font-mono">
                          📋 Problem Requirements & Constraints
                        </span>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {analysis.richAnalysis.problemUnderstanding}
                        </p>
                      </div>
                    )}

                    {/* Your Approach */}
                    {analysis.richAnalysis.yourApproach && (
                      <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-secondary)] block font-mono">
                          💡 Your Approach
                        </span>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {analysis.richAnalysis.yourApproach}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Correctness & Edge Cases */}
                    {analysis.richAnalysis.correctness && (
                      <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--status-success)] block font-mono">
                          ✅ Correctness & Edge Cases
                        </span>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {analysis.richAnalysis.correctness}
                        </p>
                      </div>
                    )}

                    {/* Expected / Optimal Approach */}
                    {analysis.richAnalysis.optimalApproach && (
                      <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--status-info)] block font-mono">
                          🎯 Expected / Optimal Approach
                        </span>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {analysis.richAnalysis.optimalApproach}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Comparison & Efficiency Assessment */}
                  {(analysis.richAnalysis.comparison || analysis.richAnalysis.efficiencyAssessment) && (
                    <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] block font-mono">
                        ⚖️ Comparison & Efficiency Assessment
                      </span>
                      {analysis.richAnalysis.comparison && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          <strong className="text-[var(--text-primary)]">Approach Comparison: </strong>
                          {analysis.richAnalysis.comparison}
                        </p>
                      )}
                      {analysis.richAnalysis.efficiencyAssessment && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          <strong className="text-[var(--text-primary)]">Efficiency Assessment: </strong>
                          {analysis.richAnalysis.efficiencyAssessment}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Improvement Suggestions */}
                  {analysis.richAnalysis.improvementSuggestions && (
                    <div className="p-4.5 rounded-xl bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-xs text-[var(--status-success)] space-y-1.5 shadow-xs">
                      <strong className="block font-bold text-sm">✨ Key Takeaways & Improvement Suggestions:</strong>
                      <p className="text-xs leading-relaxed opacity-95">{analysis.richAnalysis.improvementSuggestions}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                  <strong className="text-[var(--text-primary)] block mb-1 font-mono">Complexity Breakdown:</strong>
                  {analysis.explanation || "No qualitative explanation available."}
                </div>
              )}
            </div>
          )}

          {/* Accepted Code Block */}
          {acceptedCode && (
            <div className="panel-card p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2.5">
                  <Code2 className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h2 className="font-bold text-base text-[var(--text-primary)]">
                    Accepted Solution Code
                  </h2>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold text-[var(--text-muted)] px-3 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    {solvingData?.language || 'Python3'}
                  </span>
                  <button
                    onClick={copyCode}
                    className="btn-secondary text-xs py-1 px-3"
                    title="Copy code to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                        <span className="text-[var(--status-success)]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="code-block text-xs">
                <code>{acceptedCode}</code>
              </pre>
            </div>
          )}
        </div>
      ) : (
        /* Unsolved Problem State */
        <div className="panel-card p-12 text-center space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-light)] text-[var(--brand-primary)] border border-[var(--border-accent)] flex items-center justify-center mx-auto shadow-[var(--brand-glow)]">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Ready to Master This Problem?</h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto mt-1.5 leading-relaxed">
              You have not solved or logged this problem yet. Open it on LeetCode with the CPRecal Tampermonkey extension active to track your session time, submissions, and mastery score automatically.
            </p>
          </div>
          <div className="pt-2">
            <a
              href={getLeetCodeUrl(titleSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2.5 px-5 shadow-sm"
            >
              <span>Solve on LeetCode</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
