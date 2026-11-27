import React, { useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import {
  runDSATURSolver,
  runHeuristicRepairSolver,
  runFastGreedySolver,
  buildConflictGraph,
  SolverBenchmarkResult,
  ConflictGraphData
} from '../../lib/solvers';
import {
  Cpu,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  Network,
  Activity,
  Layers,
  Terminal,
  Zap
} from 'lucide-react';

export function SolverBenchmarkView() {
  const { courses, sections, facultyMembers, rooms, sessions } = useTimetable();

  const [benchmarkResult, setBenchmarkResult] = useState<SolverBenchmarkResult | null>(null);
  const [activeSolverType, setActiveSolverType] = useState<'DSATUR' | 'REPAIR' | 'GREEDY'>('REPAIR');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<ConflictGraphData>(() =>
    buildConflictGraph(courses, sections, facultyMembers, rooms)
  );

  const handleRunSolver = (type: 'DSATUR' | 'REPAIR' | 'GREEDY') => {
    setIsRunning(true);
    setActiveSolverType(type);

    setTimeout(() => {
      let res: { benchmark: SolverBenchmarkResult };
      if (type === 'DSATUR') {
        res = runDSATURSolver(courses, sections, facultyMembers, rooms, sessions);
      } else if (type === 'REPAIR') {
        res = runHeuristicRepairSolver(courses, sections, facultyMembers, rooms, sessions);
      } else {
        res = runFastGreedySolver(courses, sections, facultyMembers, rooms);
      }

      setBenchmarkResult(res.benchmark);
      setGraphData(buildConflictGraph(courses, sections, facultyMembers, rooms));
      setIsRunning(false);
    }, 200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#E5E2D9] dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-[#8C1B2E] dark:text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Cpu className="h-4 w-4" />
          <span>Core Algorithms · Multi-Solver Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-zinc-100 tracking-tight">
          Conflict Graph & Constraint Optimization Benchmarks
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
          Compares Heuristic Local Repair (Incremental Soft Re-Optimization) with DSATUR Graph Coloring (Saturation Degree Heuristic) and Fast Greedy construction. Evaluated against institutional academic timetabling standards.
        </p>
      </div>

      {/* Solver Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local Heuristic Repair Card */}
        <div className={`p-5 rounded-xl border transition-all ${
          activeSolverType === 'REPAIR'
            ? 'bg-red-50/60 border-[#8C1B2E] shadow-xs dark:bg-red-950/20 dark:border-red-600'
            : 'bg-[#FAF9F5] dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-[#8C1B2E] dark:text-red-400 uppercase">
              Incremental Local Repair
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#8C1B2E] dark:bg-red-950/60 dark:text-red-300 font-mono font-semibold">
              solver_repair.ts
            </span>
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100 mb-1">Heuristic Local Repair</h3>
          <p className="text-xs text-stone-600 dark:text-zinc-400 mb-4 leading-relaxed">
            Local neighbourhood search. Incrementally reallocates cancelled or unassigned sessions into feasible slots respecting room and faculty limits.
          </p>
          <button
            onClick={() => handleRunSolver('REPAIR')}
            disabled={isRunning}
            className="w-full py-2 bg-[#8C1B2E] hover:bg-[#731625] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Execute Heuristic Repair</span>
          </button>
        </div>

        {/* DSATUR Card */}
        <div className={`p-5 rounded-xl border transition-all ${
          activeSolverType === 'DSATUR'
            ? 'bg-red-50/60 border-[#8C1B2E] shadow-xs dark:bg-red-950/20 dark:border-red-600'
            : 'bg-[#FAF9F5] dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-sky-700 dark:text-cyan-400 uppercase">
              Heuristic Graph Coloring
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 font-mono font-semibold">
              solver_dsatur.py
            </span>
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100 mb-1">DSATUR Degree of Saturation</h3>
          <p className="text-xs text-stone-600 dark:text-zinc-400 mb-4 leading-relaxed">
            Orders nodes by saturation degree (uniquely colored adjacent nodes) with vertex degree tie-breaking. Sub-50ms search space reduction.
          </p>
          <button
            onClick={() => handleRunSolver('DSATUR')}
            disabled={isRunning}
            className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Execute DSATUR Heuristic</span>
          </button>
        </div>

        {/* Fast Greedy Card */}
        <div className={`p-5 rounded-xl border transition-all ${
          activeSolverType === 'GREEDY'
            ? 'bg-red-50/60 border-[#8C1B2E] shadow-xs dark:bg-red-950/20 dark:border-red-600'
            : 'bg-[#FAF9F5] dark:bg-zinc-900 border-[#E5E2D9] dark:border-zinc-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 uppercase">
              Baseline Construction
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-mono font-semibold">
              solver_fast.py
            </span>
          </div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-zinc-100 mb-1">Fast Greedy Packing</h3>
          <p className="text-xs text-stone-600 dark:text-zinc-400 mb-4 leading-relaxed">
            Greedy slot-filler for instant initial feasibility. Used as starting seed for incremental local replanning.
          </p>
          <button
            onClick={() => handleRunSolver('GREEDY')}
            disabled={isRunning}
            className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Execute Fast Greedy</span>
          </button>
        </div>
      </div>

      {/* Benchmark Output Radar */}
      {benchmarkResult && (
        <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-[#8C1B2E] dark:text-red-400 font-semibold uppercase tracking-wider">
                Benchmark Benchmark Output
              </span>
              <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-zinc-100 mt-0.5">
                {benchmarkResult.solverName} Results
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-semibold">
                {benchmarkResult.solutionQuality}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 text-center text-xs">
            <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
              <span className="text-stone-500 dark:text-zinc-400 block mb-1">Execution Wall Clock</span>
              <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {benchmarkResult.executionTimeMs} ms
              </span>
              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Real-time compute</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
              <span className="text-stone-500 dark:text-zinc-400 block mb-1">Hard Constraint Breaches</span>
              <span className="text-2xl font-bold font-mono text-stone-900 dark:text-zinc-100 tabular-nums">
                {benchmarkResult.hardConstraintViolations}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mt-1">
                {benchmarkResult.hardConstraintViolations === 0 ? 'Zero Collisions Verified' : 'Violations Detected'}
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
              <span className="text-stone-500 dark:text-zinc-400 block mb-1">Iterations / Branches</span>
              <span className="text-2xl font-bold font-mono text-[#8C1B2E] dark:text-red-400 tabular-nums">
                {benchmarkResult.iterations}
              </span>
              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Search nodes pruned</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
              <span className="text-stone-500 dark:text-zinc-400 block mb-1">Soft Optimization Score</span>
              <span className="text-2xl font-bold font-mono text-sky-700 dark:text-cyan-400 tabular-nums">
                {benchmarkResult.softScore}
              </span>
              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Objective value</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 shadow-xs">
              <span className="text-stone-500 dark:text-zinc-400 block mb-1">Timetable Health</span>
              <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {benchmarkResult.healthScore}%
              </span>
              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block mt-1">Overall rating</span>
            </div>
          </div>

          {/* Solver Log Terminal */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-stone-600 dark:text-zinc-400 border-b border-[#E5E2D9] dark:border-zinc-800 pb-2">
              <Terminal className="h-3.5 w-3.5 text-[#8C1B2E] dark:text-red-400" />
              <span>Solver Execution Log Stream</span>
            </div>
            <div className="font-mono text-[11px] text-stone-700 dark:text-zinc-300 space-y-1 max-h-36 overflow-y-auto">
              {benchmarkResult.logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-stone-400 select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visual Conflict Graph Engine */}
      <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E2D9] dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              <Network className="h-4 w-4 text-[#8C1B2E] dark:text-red-400" />
              <span>Academic Conflict Graph Representation</span>
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
              Nodes represent scheduling units; Edges represent physical resource contention (same teacher, same student group, same lab).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-2.5 py-1 rounded bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300">
              Nodes: <span className="text-stone-900 dark:text-zinc-100 font-bold">{graphData.nodes.length}</span>
            </div>
            <div className="px-2.5 py-1 rounded bg-white dark:bg-zinc-950 border border-[#E5E2D9] dark:border-zinc-800 text-stone-700 dark:text-zinc-300">
              Edges: <span className="text-stone-900 dark:text-zinc-100 font-bold">{graphData.edges.length}</span>
            </div>
            <div className="px-2.5 py-1 rounded bg-red-50 text-[#8C1B2E] border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
              Clique Size (χ Lower Bound): <span className="font-bold">{graphData.maxCliqueSize}</span>
            </div>
          </div>
        </div>

        {/* Nodes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {graphData.nodes.map(node => (
            <div
              key={node.id}
              className="p-3 bg-white dark:bg-zinc-950/70 border border-[#E5E2D9] dark:border-zinc-800 rounded-xl space-y-1.5 text-xs shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold font-mono text-[#8C1B2E] dark:text-red-400 text-xs">{node.courseCode}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-[#E5E2D9] dark:border-zinc-700">
                  {node.sectionName}
                </span>
              </div>
              <div className="text-[11px] text-stone-600 dark:text-zinc-400 truncate">{node.facultyName}</div>
              <div className="flex items-center justify-between pt-1 border-t border-[#E5E2D9] dark:border-zinc-800/80 text-[10px] font-mono">
                <span className="text-stone-500">Degree (Edges):</span>
                <span className="text-[#8C1B2E] dark:text-red-400 font-bold">{node.degree}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Edges Breakdown */}
        <div className="p-4 bg-white dark:bg-zinc-950/60 rounded-xl border border-[#E5E2D9] dark:border-zinc-800 text-xs space-y-2 shadow-xs">
          <span className="font-semibold text-stone-800 dark:text-zinc-300 block">Conflict Edge Types Breakdown:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="font-bold text-sky-800 dark:text-cyan-400">Student Section Contention:</span>
              <p className="text-stone-600 dark:text-zinc-400 mt-0.5">Classes with the same student group cannot overlap.</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="font-bold text-amber-800 dark:text-amber-400">Faculty Overlap:</span>
              <p className="text-stone-600 dark:text-zinc-400 mt-0.5">Instructors teaching multiple sections (e.g. Prof. Sharma).</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-zinc-900 border border-[#E5E2D9] dark:border-zinc-800">
              <span className="font-bold text-[#8C1B2E] dark:text-red-400">Shared Hardware Labs:</span>
              <p className="text-stone-600 dark:text-zinc-400 mt-0.5">Courses competing for Lab 301 GPU workstations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
