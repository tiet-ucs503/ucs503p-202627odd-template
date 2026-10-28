import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import {
  KPI_METRICS,
  RECENT_VERIFICATIONS,
  RISK_DISTRIBUTION,
  VERIFICATION_ACTIVITY,
  ACTION_REQUIRED_ITEMS,
  FREQUENTLY_DETECTED_SIGNALS,
  SYSTEM_STATUS,
} from '@/services/verificationData';
import {
  Plus,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activityTimeframe, setActivityTimeframe] = useState('30 DAYS');
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);

  // Risk Badge helper
  const renderRiskBadge = (risk) => {
    switch (risk) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[11px] font-mono font-bold tracking-wider uppercase">
            <ShieldAlert className="w-3 h-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-[11px] font-mono font-bold tracking-wider uppercase">
            <AlertTriangle className="w-3 h-3" />
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1E90FF]/10 border border-[#1E90FF]/30 text-[#1E90FF] text-[11px] font-mono font-bold tracking-wider uppercase">
            <ShieldCheck className="w-3 h-3" />
            LOW
          </span>
        );
      default:
        return null;
    }
  };

  const activityData = VERIFICATION_ACTIVITY[activityTimeframe] || [];
  const maxActivityValue = Math.max(...activityData.map((d) => d.checks), 10);

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans selection:bg-[#1E90FF]/30 selection:text-white">
      {/* Desktop Left Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header pageTitle="OVERVIEW" breadcrumb="VERIFICATION CONTROL" />

        {/* Scrollable Dashboard Body */}
        <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
          {/* PAGE HEADER */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#242424]">
            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-[#1E90FF] uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1E90FF] animate-pulse" />
                VERIFICATION CONTROL
              </span>
              <h1 className="text-3xl md:text-4xl font-mono font-black tracking-tight text-[#F5F5F5] uppercase">
                Know what you&apos;re applying to.
              </h1>
              <p className="text-sm font-mono text-[#8A8A8A] max-w-2xl leading-relaxed">
                Analyze job and internship postings, detect suspicious signals, and review your verification activity in real-time.
              </p>
            </div>

            {/* Primary CTA */}
            <Button
              onClick={() => navigate('/check')}
              className="bg-[#1E90FF] hover:bg-[#05a858] text-[#050505] font-mono font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-lg shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Check a New Posting
            </Button>
          </div>

          {/* KPI SECTION (4 Cards in 1 Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_METRICS.map((kpi) => (
              <div
                key={kpi.id}
                className="p-5 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-3 hover:border-[#333333] transition-all"
              >
                <div className="text-[10px] font-mono font-bold tracking-widest text-[#8A8A8A] uppercase">
                  {kpi.title}
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className="text-3xl font-mono font-black tracking-tight"
                    style={{ color: kpi.accentColor }}
                  >
                    {kpi.value}
                  </span>
                  <span className="text-xs font-mono text-[#555555]">
                    {kpi.subtext}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN CONTENT GRID: Recent Verifications (Left) & Risk Distribution (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* RECENT VERIFICATIONS (Left 2 Columns) */}
            <div className="lg:col-span-2 p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-mono font-bold text-[#F5F5F5] uppercase tracking-wide">
                    Recent Verifications
                  </h2>
                  <p className="text-xs font-mono text-[#8A8A8A]">
                    Your latest analyzed job postings.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/history')}
                  className="text-xs font-mono text-[#1E90FF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dark Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#242424] text-[#555555] uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Posting</th>
                      <th className="py-3 px-3">Company</th>
                      <th className="py-3 px-3">Risk</th>
                      <th className="py-3 px-3">Confidence</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]">
                    {RECENT_VERIFICATIONS.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#141414] transition-colors group cursor-pointer"
                        onClick={() => navigate(`/check?id=${item.id}`)}
                      >
                        <td className="py-3.5 px-3 font-semibold text-[#F5F5F5] group-hover:text-[#1E90FF] transition-colors">
                          {item.posting}
                        </td>
                        <td className="py-3.5 px-3 text-[#8A8A8A]">
                          {item.company}
                        </td>
                        <td className="py-3.5 px-3">
                          {renderRiskBadge(item.risk)}
                        </td>
                        <td className="py-3.5 px-3 text-[#F5F5F5] font-mono">
                          {item.confidence}
                        </td>
                        <td className="py-3.5 px-3 text-[#555555]">
                          {item.date}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/check?id=${item.id}`);
                            }}
                            className="px-3 py-1 rounded bg-[#141414] border border-[#242424] text-[#F5F5F5] hover:bg-[#1E90FF] hover:text-[#050505] transition-all text-[11px] font-mono uppercase cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RISK DISTRIBUTION (Right Column) */}
            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-mono font-bold text-[#F5F5F5] uppercase tracking-wide">
                  Risk Distribution
                </h2>
                <p className="text-xs font-mono text-[#8A8A8A]">
                  Breakdown of analyzed postings.
                </p>
              </div>

              {/* Clean Monochromatic Donut Chart */}
              <div className="flex flex-col items-center justify-center my-4">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Circle Background */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#242424"
                      strokeWidth="10"
                      fill="none"
                    />
                    {/* LOW RISK Segment (17%) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#1E90FF"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray="42.7 251.2"
                      strokeDashoffset="0"
                    />
                    {/* MEDIUM RISK Segment (57%) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#F59E0B"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray="143.2 251.2"
                      strokeDashoffset="-42.7"
                    />
                    {/* HIGH RISK Segment (26%) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#EF4444"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray="65.3 251.2"
                      strokeDashoffset="-185.9"
                    />
                  </svg>
                  {/* Donut Center Text */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-mono font-black text-[#F5F5F5]">
                      42
                    </span>
                    <span className="text-[10px] font-mono tracking-widest text-[#555555] uppercase">
                      CHECKS
                    </span>
                  </div>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#242424] text-center font-mono text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[#1E90FF]">
                    <span className="w-2 h-2 rounded-full bg-[#1E90FF]" />
                    LOW
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5]">17%</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[#F59E0B]">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    MEDIUM
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5]">57%</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[#EF4444]">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                    HIGH
                  </div>
                  <div className="text-sm font-bold text-[#F5F5F5]">26%</div>
                </div>
              </div>
            </div>
          </div>

          {/* VERIFICATION ACTIVITY (Full Width Line Graph) */}
          <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-mono font-bold text-[#F5F5F5] uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1E90FF]" />
                  Verification Activity
                </h2>
                <p className="text-xs font-mono text-[#8A8A8A]">
                  Postings analyzed over the selected timeframe.
                </p>
              </div>

              {/* Timeframe Controls */}
              <div className="flex items-center gap-1 p-1 bg-[#050505] border border-[#242424] rounded-md font-mono text-[11px]">
                {['7 DAYS', '30 DAYS', '90 DAYS', 'ALL TIME'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setActivityTimeframe(tf)}
                    className={`px-3 py-1 rounded transition-all cursor-pointer ${
                      activityTimeframe === tf
                        ? 'bg-[#141414] text-[#F5F5F5] font-bold border border-[#242424]'
                        : 'text-[#8A8A8A] hover:text-[#F5F5F5]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean SVG Line Chart */}
            <div className="relative h-48 w-full pt-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="#242424" strokeDasharray="3 3" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="#242424" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2="500" y2="120" stroke="#242424" strokeDasharray="3 3" />

                {/* Trend line path */}
                {activityData.length > 0 && (
                  <>
                    {/* Area gradient under curve */}
                    <polygon
                      points={`0,140 ${activityData
                        .map(
                          (d, idx) =>
                            `${(idx / (activityData.length - 1)) * 500},${
                              140 - (d.checks / maxActivityValue) * 110
                            }`
                        )
                        .join(' ')} 500,140`}
                      fill="url(#blueGradient)"
                      opacity="0.15"
                    />

                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1E90FF" />
                        <stop offset="100%" stopColor="#050505" />
                      </linearGradient>
                    </defs>

                    {/* Line path */}
                    <polyline
                      fill="none"
                      stroke="#1E90FF"
                      strokeWidth="2.5"
                      points={activityData
                        .map(
                          (d, idx) =>
                            `${(idx / (activityData.length - 1)) * 500},${
                              140 - (d.checks / maxActivityValue) * 110
                            }`
                        )
                        .join(' ')}
                    />

                    {/* Data Points */}
                    {activityData.map((d, idx) => {
                      const cx = (idx / (activityData.length - 1)) * 500;
                      const cy = 140 - (d.checks / maxActivityValue) * 110;
                      return (
                        <g key={d.label}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r="4"
                            className="fill-[#050505] stroke-[#1E90FF] stroke-2 hover:r-6 transition-all cursor-pointer"
                            onMouseEnter={() => setHoveredDataPoint({ ...d, cx, cy })}
                            onMouseLeave={() => setHoveredDataPoint(null)}
                          />
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>

              {/* Data point tooltip hover */}
              {hoveredDataPoint && (
                <div
                  className="absolute bg-[#141414] border border-[#242424] px-2.5 py-1 rounded text-[11px] font-mono text-[#F5F5F5] pointer-events-none shadow-lg -translate-x-1/2 -translate-y-8"
                  style={{
                    left: `${(hoveredDataPoint.cx / 500) * 100}%`,
                    top: `${(hoveredDataPoint.cy / 150) * 100}%`,
                  }}
                >
                  {hoveredDataPoint.label}: {hoveredDataPoint.checks} checks
                </div>
              )}
            </div>

            {/* Labels beneath X Axis */}
            <div className="flex justify-between font-mono text-[10px] text-[#555555] uppercase pt-2">
              {activityData.map((d) => (
                <span key={d.label}>{d.label}</span>
              ))}
            </div>
          </div>

          {/* LOWER TWO COLUMNS: Action Required (Left) & Frequently Detected Signals (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ACTION REQUIRED SECTION */}
            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-mono font-bold text-[#F5F5F5] uppercase tracking-wide">
                    Action Required
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-mono font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                    REVIEW QUEUE
                  </span>
                </div>
                <span className="text-xs font-mono text-[#555555]">
                  3 postings require review
                </span>
              </div>

              <div className="space-y-3">
                {ACTION_REQUIRED_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-[#141414] border border-[#242424] rounded-md flex items-center justify-between gap-4 hover:border-[#333333] transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderRiskBadge(item.risk)}
                        <span className="text-xs font-mono font-semibold text-[#F5F5F5]">
                          {item.posting}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#8A8A8A]">
                        {item.description}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/check?id=${item.id}`)}
                      className="text-xs font-mono text-[#1E90FF] hover:underline flex items-center gap-1 shrink-0 cursor-pointer uppercase font-bold"
                    >
                      View Result →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* FREQUENTLY DETECTED SIGNALS SECTION */}
            <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-4">
              <div>
                <h2 className="text-base font-mono font-bold text-[#F5F5F5] uppercase tracking-wide">
                  Frequently Detected Signals
                </h2>
                <p className="text-xs font-mono text-[#8A8A8A]">
                  Most common suspicious patterns across your analyzed postings.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {FREQUENTLY_DETECTED_SIGNALS.map((sig) => (
                  <div key={sig.name} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-[#8A8A8A]">
                      <span>{sig.name}</span>
                      <span className="text-[#F5F5F5] font-semibold">{sig.percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#050505] rounded-full overflow-hidden border border-[#242424]">
                      <div
                        className="h-full bg-gradient-to-r from-[#1E90FF] to-[#38BDF8] rounded-full transition-all duration-500"
                        style={{ width: `${sig.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS & CONSTELLATION SIGNAL MOTIF */}
          <div className="p-5 bg-[#0F0F0F] border border-[#242424] rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6 font-mono text-xs">
            {/* Metadata status fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div>
                <span className="text-[10px] text-[#555555] uppercase tracking-wider block">
                  SIGNAL ENGINE
                </span>
                <span className="text-[#1E90FF] font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
                  {SYSTEM_STATUS.signalEngine}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#555555] uppercase tracking-wider block">
                  RISK MODEL
                </span>
                <span className="text-[#1E90FF] font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
                  {SYSTEM_STATUS.riskModel}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#555555] uppercase tracking-wider block">
                  ANALYSIS ENGINE
                </span>
                <span className="text-[#38BDF8] font-bold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                  {SYSTEM_STATUS.analysisEngine}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#555555] uppercase tracking-wider block">
                  LAST ANALYSIS
                </span>
                <span className="text-[#F5F5F5] font-bold block mt-0.5">
                  {SYSTEM_STATUS.lastAnalysis}
                </span>
              </div>
            </div>

            {/* Subtle Constellation Network Signal Motif */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#050505] border border-[#242424] rounded-md shrink-0">
              <div className="relative w-8 h-8 flex items-center justify-center">
                {/* Micro constellation nodes & connecting lines */}
                <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#1E90FF] rounded-full animate-ping" />
                <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-[#1E90FF] rounded-full" />
                <div className="absolute bottom-1 right-2 w-1.5 h-1.5 bg-[#38BDF8] rounded-full" />
                <div className="absolute top-3 right-1 w-1 h-1 bg-[#F5F5F5] rounded-full opacity-60" />
                <svg className="w-full h-full" viewBox="0 0 32 32">
                  <line x1="5" y1="5" x2="24" y2="24" stroke="#242424" strokeWidth="1" />
                  <line x1="5" y1="5" x2="26" y2="12" stroke="#242424" strokeWidth="1" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#1E90FF] font-bold tracking-widest uppercase">
                  SIGNAL NETWORK
                </span>
                <span className="text-[9px] text-[#555555] tracking-wider uppercase">
                  0x7A : ONLINE
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
