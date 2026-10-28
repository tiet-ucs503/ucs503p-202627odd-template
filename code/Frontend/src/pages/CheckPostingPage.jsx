import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  Mail,
  DollarSign,
  Lock,
} from 'lucide-react';

export default function CheckPostingPage() {
  const navigate = useNavigate();
  const [inputUrl, setInputUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setAnalyzing(true);
    setResult(null);

    // Simulate verification analysis engine
    setTimeout(() => {
      setAnalyzing(false);
      setResult({
        title: 'Machine Learning & AI Research Intern',
        company: 'Apex Global Technologies (Unverified)',
        riskLevel: 'HIGH',
        confidenceScore: '92%',
        riskScore: 88,
        flags: [
          {
            type: 'CRITICAL',
            title: 'Upfront Registration Fee Demanded',
            detail: 'Posting requests $150 onboarding document verification fee via Telegram.',
          },
          {
            type: 'HIGH',
            title: 'Unverified Domain & Contact Address',
            detail: 'Domain apex-global-tech.xyz registered 4 days ago with privacy shield.',
          },
          {
            type: 'MEDIUM',
            title: 'Unrealistic Compensation Guarantee',
            detail: 'Promises $4,500/mo guaranteed stipend with zero prerequisite interviews.',
          },
        ],
        verdict: 'HIGH RISK — Do NOT pay fees or submit personal financial documents.',
      });
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#F5F5F5] font-sans selection:bg-[#06C167]/30">
      {/* Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header pageTitle="CHECK POSTING" breadcrumb="VERIFICATION ENGINE" />

        <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-6 border-b border-[#242424]">
            <div>
              <span className="text-[11px] font-mono font-bold tracking-widest text-[#06C167] uppercase">
                SIGNAL ANALYSIS ENGINE
              </span>
              <h1 className="text-2xl md:text-3xl font-mono font-black tracking-tight text-[#F5F5F5] uppercase mt-1">
                Analyze Internship Offer
              </h1>
              <p className="text-xs font-mono text-[#8A8A8A] mt-1">
                Paste a LinkedIn link, job board URL, company website, or email text to run real-time fraud detection.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="border-[#242424] bg-[#0F0F0F] text-[#F5F5F5] hover:bg-[#141414] font-mono text-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Overview
            </Button>
          </div>

          {/* Verification Form Card */}
          <div className="p-6 bg-[#0F0F0F] border border-[#242424] rounded-lg space-y-6 max-w-4xl mx-auto shadow-2xl">
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="posting-url" className="text-xs font-mono text-[#F5F5F5] uppercase tracking-wider">
                  Internship Posting URL or Offer Letter Text
                </Label>
                <div className="relative">
                  <Input
                    id="posting-url"
                    placeholder="e.g., https://linkedin.com/jobs/view/12345678 or paste email offer text..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="pl-10 h-12 bg-[#050505] border-[#242424] text-[#F5F5F5] placeholder:text-[#555555] font-mono text-xs focus-visible:ring-[#06C167]"
                    required
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={analyzing}
                  className="bg-[#06C167] hover:bg-[#05a858] text-[#050505] font-mono font-bold uppercase tracking-wider text-xs px-6 h-11 rounded-lg cursor-pointer"
                >
                  {analyzing ? 'Scanning Signals...' : 'Run Verification Scan'}
                </Button>
              </div>
            </form>

            {/* Analysis Loading State */}
            {analyzing && (
              <div className="p-8 border border-[#242424] rounded-md bg-[#050505] text-center space-y-3 font-mono">
                <div className="w-8 h-8 border-2 border-[#06C167] border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs text-[#06C167] font-bold tracking-widest uppercase">
                  Analyzing Domain, Risk Signals & Contact Patterns...
                </div>
              </div>
            )}

            {/* Analysis Result Output */}
            {result && (
              <div className="p-6 border border-[#EF4444]/40 rounded-lg bg-[#050505] space-y-6 animate-in fade-in duration-300">
                {/* Result Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
                  <div>
                    <span className="text-[10px] font-mono text-[#555555] uppercase tracking-wider">
                      VERIFICATION VERDICT
                    </span>
                    <h2 className="text-xl font-mono font-bold text-[#F5F5F5]">
                      {result.title}
                    </h2>
                    <p className="text-xs font-mono text-[#8A8A8A]">
                      {result.company}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/40 text-[#EF4444] font-mono font-black text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      RISK SCORE: {result.riskScore}/100 ({result.riskLevel})
                    </span>
                  </div>
                </div>

                {/* Detected Flags */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-[#F5F5F5] uppercase tracking-wider">
                    Detected Suspicious Signals ({result.flags.length})
                  </h3>
                  <div className="space-y-2">
                    {result.flags.map((flag, i) => (
                      <div
                        key={i}
                        className="p-3.5 bg-[#141414] border border-[#242424] rounded-md font-mono text-xs space-y-1"
                      >
                        <div className="flex items-center gap-2 text-[#EF4444] font-bold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>[{flag.type}] {flag.title}</span>
                        </div>
                        <p className="text-[#8A8A8A] text-[11px]">
                          {flag.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Recommendation */}
                <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-md font-mono text-xs text-[#EF4444] font-bold flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>{result.verdict}</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
