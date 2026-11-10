import { useState, useEffect } from 'react';
import { 
  Shield, 
  Target, 
  TrendingUp, 
  Clock, 
  Eye, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Printer, 
  UserPlus, 
  ArrowLeft, 
  Zap, 
  Activity,
  Brain,
  BookOpen
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useAuth } from '@/context/AuthContext';

interface TopicMastery {
  topic: string;
  mastery_percent: number;
  status: string;
}

interface CognitiveProfile {
  focused_rate: number;
  drifting_rate: number;
  impulsive_rate: number;
  overwhelmed_rate: number;
  avg_blink_rate: number;
  avg_gaze_stability: number;
  cognitive_load_index: string;
}

interface RecentAttempt {
  attemptId: number;
  villain: string;
  score: number;
  timeTaken: number;
  hintUsed: boolean;
  cognitiveState: string;
  date: string;
}

interface StudentReport {
  student_id: number;
  student_name: string;
  student_code: string;
  role: string;
  points: number;
  level: number;
  total_missions_cleared: number;
  total_questions_attempted: number;
  accuracy_percentage: number;
  total_time_minutes: number;
  cognitive_profile: CognitiveProfile;
  topic_mastery: TopicMastery[];
  recent_attempts: RecentAttempt[];
  badges: string[];
  ai_guardian_summary: string;
  guardian_recommendation: string;
}

export default function ParentDashboard({ setView }: { setView: (view: string) => void }) {
  const { user, token, linkStudent, logout } = useAuth();
  
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState<string>('');
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [showSwitchForm, setShowSwitchForm] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!user.linked_student_id) {
      setReport(null);
      setLoading(false);
      return;
    }
    fetchStudentReport(user.linked_student_id);
  }, [user?.linked_student_id, token]);

  const fetchStudentReport = (id: number) => {
    setLoading(true);
    setErrorMsg(null);
    fetch(`http://localhost:8001/reports/student/${id}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.detail || "Failed to load student analytics");
          });
        }
        return res.json();
      })
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Report fetch error:", err);
        setErrorMsg(err.message || "Failed to fetch student report.");
        setReport(null);
        setLoading(false);
      });
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setIsLinking(true);
    setLinkMsg(null);
    try {
      await linkStudent(linkInput.trim());
      setLinkMsg(`✓ Successfully linked to student!`);
      setLinkInput('');
      setShowSwitchForm(false);
    } catch (err: any) {
      setLinkMsg(`❌ ${err.message || 'Linking failed'}`);
    } finally {
      setIsLinking(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm uppercase tracking-widest text-blue-400">Loading Student Analytics...</div>
        </div>
      </div>
    );
  }

  // If no student is linked to this guardian account yet
  if (!user?.linked_student_id || (!report && !loading)) {
    return (
      <section className="relative py-24 min-h-screen flex items-center justify-center text-white">
        <div className="absolute inset-0 halftone opacity-30 pointer-events-none" />
        <div className="relative max-w-lg w-full mx-auto px-6">
          <div className="p-8 rounded-3xl bg-ink-950/95 border border-blue-500/40 backdrop-blur-xl shadow-[0_0_50px_rgba(37,99,235,0.2)] text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-center mx-auto mb-5 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-400/40 text-blue-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              {user?.role === 'teacher' ? 'Educator Command Deck' : 'Parent & Guardian Portal'}
            </div>
            
            <h2 className="font-comic text-3xl text-white tracking-wide">
              Connect Your Student
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-gray-400 leading-relaxed">
              Enter your student&apos;s registered email to link their profile and access their live ADHD cognitive attention analytics, mission history, and curriculum mastery.
            </p>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono text-left">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="mt-6 space-y-4">
              <div className="text-left">
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 mb-1">
                  Student&apos;s Registered Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. child@mathverse.edu"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full bg-ink-900 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLinking ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Link Student Dashboard
                  </>
                )}
              </button>

              {linkMsg && (
                <div className="p-3 rounded-xl text-xs font-mono bg-blue-950/80 border border-blue-500/40 text-blue-200">
                  {linkMsg}
                </div>
              )}
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 flex justify-between items-center text-xs text-gray-400">
              <span>Signed in as <strong className="text-white">{user?.name}</strong></span>
              <button
                onClick={logout}
                className="text-red-400 hover:text-red-300 font-semibold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const r = report;

  return (
    <section className="relative py-20 min-h-screen text-white font-sans">
      <div className="absolute inset-0 halftone opacity-25 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        
        {/* Top Navigation Bar for Guardians */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-ink-950/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-blue-400 font-mono font-bold uppercase tracking-wider">
                {user?.role === 'teacher' ? 'Educator Command Deck' : 'Parent & Guardian Portal'}
              </div>
              <div className="text-sm font-semibold text-white">
                Authorized Student: <span className="text-hero-400">{r.student_name}</span> ({r.student_code})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSwitchForm(!showSwitchForm)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-900 border border-white/10 hover:border-blue-500/50 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" /> Switch Student Email
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-800 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-gray-300" /> Print Report
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/60 border border-red-500/30 hover:bg-red-900/40 text-xs font-semibold text-red-300 hover:text-white transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Switch student form drawer */}
        {showSwitchForm && (
          <Reveal>
            <form onSubmit={handleLinkSubmit} className="mb-6 p-4 rounded-2xl bg-ink-900/90 border border-blue-500/30 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full text-xs">
                <label className="block text-gray-400 mb-1 font-mono uppercase">Enter New Student Email</label>
                <input
                  type="email"
                  required
                  placeholder="student@mathverse.edu"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                />
              </div>
              <button
                type="submit"
                disabled={isLinking}
                className="w-full sm:w-auto mt-4 sm:mt-5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all whitespace-nowrap"
              >
                {isLinking ? 'Verifying...' : 'Link Student'}
              </button>
            </form>
          </Reveal>
        )}

        {linkMsg && (
          <div className="mb-6 p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-300 text-xs font-mono">
            {linkMsg}
          </div>
        )}

        {/* Guardian Header Banner */}
        <Reveal>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 rounded-3xl bg-ink-950/80 border border-blue-500/30 backdrop-blur-xl shadow-[0_0_40px_rgba(37,99,235,0.15)] mb-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-950/80 border-2 border-blue-500/50 flex items-center justify-center p-3 shadow-[0_0_25px_rgba(37,99,235,0.4)]">
                <Shield className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-blue-950/80 border border-blue-400/40 text-blue-300 text-[11px] font-mono font-bold uppercase tracking-wider mb-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> 
                  {user?.role === 'teacher' ? 'Educator Command Deck' : 'Parent & Guardian Portal'}
                </div>
                <h1 className="font-comic text-3xl sm:text-4xl text-white tracking-wide">
                  {user ? `${user.name}'s Dashboard` : "Guardian Learning Analytics"}
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Monitoring Child: <strong className="text-white font-bold">{r.student_name}</strong> (Code: <span className="font-mono text-hero-400 font-bold">{r.student_code}</span>)
                </p>
              </div>
            </div>

            <div className="p-3 bg-ink-900/80 rounded-2xl border border-white/10 text-xs text-gray-400 flex items-center gap-3">
              <Brain className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white font-bold">ADHD-Calibrated Diagnostics</div>
                <div className="text-[11px] text-gray-400">Real-time eye tracking & cognitive load metrics</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Executive KPI Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Reveal delay={100}>
            <div className="bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Accuracy Rate</span>
                <Target className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-3xl font-comic text-green-400 mb-1">{r.accuracy_percentage}%</div>
              <div className="text-[11px] text-gray-400 font-medium">Hero-Class Precision</div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Missions Cleared</span>
                <Award className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="text-3xl font-comic text-yellow-400 mb-1">{r.total_missions_cleared} / 6</div>
              <div className="text-[11px] text-gray-400 font-medium">Villains Neutralized</div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Focus Engagement</span>
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-comic text-blue-400 mb-1">{r.cognitive_profile.focused_rate}%</div>
              <div className="text-[11px] text-gray-400 font-medium">Sustained Eye Attention</div>
            </div>
          </Reveal>

          <Reveal delay={250}>
            <div className="bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Total Study Time</span>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-comic text-purple-400 mb-1">{r.total_time_minutes}m</div>
              <div className="text-[11px] text-gray-400 font-medium">High Engagement Time</div>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="bg-ink-900/80 rounded-2xl p-5 border border-white/10 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Spider Points</span>
                <Zap className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-3xl font-comic text-pink-400 mb-1">{r.points}</div>
              <div className="text-[11px] text-gray-400 font-medium">Gamified Economy Rank</div>
            </div>
          </Reveal>
        </div>

        {/* Middle Two-Column Grid: Cognitive Attention Diagnostic + Curriculum Domain Mastery */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          
          {/* AI Attention & Focus Diagnostic (from Eye Tracker + LSTM) */}
          <Reveal delay={350}>
            <div className="bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-hero-400" />
                    <h3 className="font-comic text-xl text-white tracking-wide uppercase">
                      Cognitive Attention Diagnostic
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-green-950/60 border border-green-500/40 text-green-400">
                    Load: {r.cognitive_profile.cognitive_load_index}
                  </span>
                </div>

                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  Calculated in real time via MediaPipe webcam telemetry analyzing blink rates, saccade frequency, pupil dilation variance, and gaze stability during math problem solving.
                </p>

                {/* Distribution Progress Bars */}
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1 font-bold">
                      <span className="text-green-400">● Focused (Active Solving)</span>
                      <span className="text-white">{r.cognitive_profile.focused_rate}%</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${r.cognitive_profile.focused_rate}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1 font-bold">
                      <span className="text-yellow-400">● Drifting (Attention Lapses)</span>
                      <span className="text-white">{r.cognitive_profile.drifting_rate}%</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${r.cognitive_profile.drifting_rate}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1 font-bold">
                      <span className="text-red-400">● Impulsive (Rapid Guessing)</span>
                      <span className="text-white">{r.cognitive_profile.impulsive_rate}%</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${r.cognitive_profile.impulsive_rate}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1 font-bold">
                      <span className="text-purple-400">● Overwhelmed (Cognitive Strain)</span>
                      <span className="text-white">{r.cognitive_profile.overwhelmed_rate}%</span>
                    </div>
                    <div className="h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${r.cognitive_profile.overwhelmed_rate}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Eye Telemetry Sensor Footprint */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Avg Blink Rate</div>
                  <div className="text-lg font-bold text-white mt-0.5">{r.cognitive_profile.avg_blink_rate} / min</div>
                  <div className="text-[10px] text-green-400">Normal engaged range</div>
                </div>
                <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Gaze Stability</div>
                  <div className="text-lg font-bold text-white mt-0.5">{r.cognitive_profile.avg_gaze_stability}%</div>
                  <div className="text-[10px] text-green-400">Screen center lock</div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Curriculum Domain Mastery */}
          <Reveal delay={400}>
            <div className="bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <h3 className="font-comic text-xl text-white tracking-wide uppercase">
                      Curriculum Domain Mastery
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-gray-400">Standardized Syllabus</span>
                </div>

                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  Competency levels dynamically updated by the Knowledge Tracing LSTM neural network as problems are solved.
                </p>

                <div className="space-y-4">
                  {r.topic_mastery.map((item, idx) => (
                    <div key={idx} className="bg-black/40 p-3 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-1.5 text-xs">
                        <span className="font-bold text-gray-200">{item.topic}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            item.status === 'Mastered'
                              ? 'bg-green-950/80 text-green-400 border border-green-500/40'
                              : item.status === 'Proficient'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-500/40'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                          }`}>
                            {item.status}
                          </span>
                          <span className="font-mono font-bold text-white">{item.mastery_percent}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                        <div 
                          className={`h-full rounded-full ${
                            item.mastery_percent >= 85 ? 'bg-green-500' : item.mastery_percent >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${item.mastery_percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* AI Guardian Advisory Note (Spider-Gwen / AI Suit) */}
        <Reveal delay={450}>
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-hero-950/60 via-ink-950 to-blue-950/60 border border-hero-500/40 backdrop-blur-xl shadow-[0_0_35px_rgba(220,38,38,0.15)] mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-hero-600/20 border border-hero-500/50 flex items-center justify-center shrink-0 p-2">
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-hero-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <span>Spider-Suit AI & Gwen Stacy Pedagogical Advisory</span>
                </div>
                <h3 className="text-lg font-comic text-white mb-2">Executive Cognitive & Academic Synthesis</h3>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  {r.ai_guardian_summary}
                </p>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-yellow-300 font-mono flex items-start gap-2">
                  <span className="font-bold uppercase tracking-wider text-yellow-400">Recommended Action:</span>
                  <span>{r.guardian_recommendation}</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Recent Mission Attempts Log Table */}
        <Reveal delay={500}>
          <div className="bg-ink-950/80 rounded-3xl p-6 sm:p-7 border border-white/10 backdrop-blur-xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <h3 className="font-comic text-xl text-white tracking-wide uppercase">
                  Recent Mission Combat Logs
                </h3>
              </div>
              <span className="text-xs font-mono text-gray-400">Real-Time Attempt Telemetry</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Threat / Villain</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Time Spent</th>
                    <th className="py-3 px-4">Hint Used</th>
                    <th className="py-3 px-4">Attention State</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {r.recent_attempts.map((att, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors font-mono">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span>{att.villain}</span>
                      </td>
                      <td className="py-3 px-4">
                        {att.score > 0 ? (
                          <span className="text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 100% (+10 SP)
                          </span>
                        ) : (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Defeated (0 SP)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{att.timeTaken}s</td>
                      <td className="py-3 px-4 text-gray-300">{att.hintUsed ? 'Yes (Gwen)' : 'None'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          att.cognitiveState === 'Focused'
                            ? 'bg-green-950/80 text-green-400 border border-green-500/40'
                            : att.cognitiveState === 'Overwhelmed'
                            ? 'bg-purple-950/80 text-purple-400 border border-purple-500/40'
                            : att.cognitiveState === 'Drifting'
                            ? 'bg-yellow-950/80 text-yellow-400 border border-yellow-500/40'
                            : 'bg-red-950/80 text-red-400 border border-red-500/40'
                        }`}>
                          {att.cognitiveState}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{att.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* Badges Earned */}
        <Reveal delay={550}>
          <div className="p-6 rounded-2xl bg-ink-900/60 border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-yellow-400" />
              <span className="font-comic text-sm uppercase tracking-wider text-gray-300">Official Badges Earned:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.badges.map((b, idx) => (
                <span key={idx} className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/5 border border-white/10 text-white flex items-center gap-1">
                  ⭐ {b}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

      </div>
    </section>
  );
}

