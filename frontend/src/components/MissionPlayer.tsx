import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, CheckCircle2, ShieldAlert, Cpu, AlertTriangle, Clock, TrendingUp, Camera, CameraOff } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { api, AnswerResponse, Question, SessionState } from '@/lib/api';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import CameraConsent from '@/components/CameraConsent';
import { AttentionTracker } from '@/lib/attention/tracker';
import { getCameraChoice, setCameraChoice } from '@/lib/attention/preference';
import { formatMastery } from '@/lib/mastery';

interface MissionPlayerProps {
  bossId: string;
  onExit: () => void;
  onNextLevel?: (bossId: string) => void;
  /** How long the result of an answer stays on screen. Tests shorten it. */
  feedbackMs?: number;
}

// Full class names are written out so Tailwind can see them at build time.
const BOSS_UI: Record<string, { name: string; index: number; gif?: string; text: string; border: string; bg: string; health: string }> = {
  goblin: { name: 'GREEN GOBLIN', index: 1, gif: '/goblin-gif.gif', text: 'text-green-400', border: 'border-green-500', bg: 'bg-green-950/50', health: 'from-green-700 via-green-500 to-green-300' },
  'doc-ock': { name: 'DOCTOR OCTOPUS', index: 2, gif: '/doc-ock-spider-man.gif', text: 'text-slate-400', border: 'border-slate-500', bg: 'bg-slate-950/50', health: 'from-slate-700 via-slate-500 to-slate-300' },
  mysterio: { name: 'MYSTERIO', index: 3, text: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-950/50', health: 'from-purple-700 via-purple-500 to-purple-300' },
  venom: { name: 'VENOM', index: 4, text: 'text-slate-100', border: 'border-slate-300', bg: 'bg-black/50', health: 'from-black via-slate-700 to-slate-400' },
  lizard: { name: 'THE LIZARD', index: 5, text: 'text-lime-400', border: 'border-lime-500', bg: 'bg-lime-950/50', health: 'from-lime-700 via-lime-500 to-lime-300' },
  kingpin: { name: 'KINGPIN', index: 6, text: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950/50', health: 'from-red-800 via-red-600 to-red-400' },
};

const NEXT_BOSS: Record<string, string> = {
  goblin: 'doc-ock', 'doc-ock': 'mysterio', mysterio: 'venom', venom: 'lizard', lizard: 'kingpin',
};

const QUESTION_TIME_LIMIT = 300; // seconds
const FEEDBACK_MS = 2200;

// off: not in use · starting: waiting for permission/model · on: measuring ·
// unavailable: the student asked for it but it could not be used
type CameraState = 'off' | 'starting' | 'on' | 'unavailable';

/** A short "whoosh" for a correct answer, made in the browser so no sound file is fetched. */
function playStrikeSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    /* no audio available: the sound is optional */
  }
}

type Phase = 'loading' | 'combat' | 'victory' | 'defeat' | 'error';
type Feedback = { kind: 'strike' | 'counter' | 'timeout'; text: string };

export default function MissionPlayer({ bossId, onExit, onNextLevel, feedbackMs = FEEDBACK_MS }: MissionPlayerProps) {
  const { progress, setProgress } = useGame();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const boss = BOSS_UI[bossId] ?? BOSS_UI.goblin;

  // Everything about the mission comes from the server: the questions, whether an
  // answer was right, the points, and when the mission is won or lost.
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState<SessionState | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);

  const [locked, setLocked] = useState(false); // true from answering until the next question
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [mastery, setMastery] = useState<number | null>(null); // display percentage (5-95), not the raw value
  const [bestStreak, setBestStreak] = useState(0);

  // ── Optional camera ────────────────────────────────────────────────────────
  // The game below never waits for, or depends on, any of this.
  const [consentNeeded, setConsentNeeded] = useState(() => getCameraChoice(userId) === null);
  const [camera, setCamera] = useState<CameraState>('off');
  const tracker = useRef<AttentionTracker | null>(null);

  const enableCamera = useCallback(async () => {
    if (!tracker.current) tracker.current = new AttentionTracker();
    const t = tracker.current;
    t.onEnded = () => setCamera('unavailable'); // unplugged, or permission taken away
    setCamera('starting');
    try {
      await t.start();
      if (t.running) {
        setCamera('on');
        setCameraChoice(userId, 'enabled');
      }
    } catch {
      // Denied, no camera, camera busy, or the model failed to load: carry on without it.
      setCamera('unavailable');
      setCameraChoice(userId, 'declined'); // do not ask again every mission; the toggle can retry
    }
  }, [userId]);

  const disableCamera = useCallback(() => {
    tracker.current?.stop(); // stops the webcam immediately
    setCamera('off');
    setCameraChoice(userId, 'declined');
  }, [userId]);

  // A student who chose the camera before on this device gets it switched on again.
  useEffect(() => {
    if (getCameraChoice(userId) === 'enabled') enableCamera();
    return () => tracker.current?.stop();
  }, [userId, enableCamera]);

  const questionShownAt = useRef(performance.now());
  const advanceTimer = useRef<number>();
  const started = useRef(false);

  const laughAudio = useRef<HTMLAudioElement>(null);
  const drottoAudio = useRef<HTMLAudioElement>(null);
  const drottoLosingAudio = useRef<HTMLAudioElement>(null);
  const victoryAudio = useRef<HTMLAudioElement>(null);

  const playSound = (ref: React.RefObject<HTMLAudioElement>) => {
    if (!ref.current) return;
    ref.current.currentTime = 0;
    ref.current.play().catch(() => { /* autoplay blocked: sound is optional */ });
  };

  const showQuestion = (q: Question) => {
    setQuestion(q);
    setLocked(false);
    setSelected(null);
    setResult(null);
    setFeedback(null);
    setHint(null);
    setHintOpen(false);
    setTimeSpent(0);
    questionShownAt.current = performance.now();
    tracker.current?.beginQuestion();
  };

  const startMission = useCallback(async () => {
    setPhase('loading');
    setBestStreak(0);
    setMastery(null);
    try {
      const data = await api<{ session: SessionState; question: Question }>('/sessions', {
        body: { boss_id: bossId },
      });
      setSession(data.session);
      showQuestion(data.question);
      setPhase('combat');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start the mission.');
      setPhase('error');
    }
  }, [bossId]);

  useEffect(() => {
    if (consentNeeded || started.current) return; // start exactly once, after the camera choice
    started.current = true;
    startMission();
  }, [startMission, consentNeeded]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  // The victory jingle plays for a few seconds once the victory screen is showing.
  useEffect(() => {
    if (phase !== 'victory') return;
    playSound(victoryAudio);
    const stop = window.setTimeout(() => victoryAudio.current?.pause(), 6000);
    return () => window.clearTimeout(stop);
  }, [phase]);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    return () => { document.body.style.backgroundColor = ''; };
  }, []);

  const submitAnswer = useCallback(async (index: number | null) => {
    if (!question || locked) return;
    setLocked(true);
    setSelected(index);
    const responseMs = Math.round(performance.now() - questionShownAt.current);

    try {
      const res = await api<AnswerResponse>(`/attempts/${question.attempt_id}/answer`, {
        body: {
          selected_index: index, // null = ran out of time
          response_time_ms: responseMs,
          hint_used: hint !== null,
          // Numbers only, and only if the camera is on. null = not measured.
          attention: tracker.current?.takeSummary() ?? null,
        },
      });
      setResult(res);
      setSession(res.session);
      setProgress(res.progress);
      setMastery(res.mastery_display_pct);
      setBestStreak((best) => Math.max(best, res.session.streak));

      if (res.correct) {
        playStrikeSound();
        if (bossId === 'doc-ock') playSound(drottoLosingAudio);
        setFeedback({
          kind: 'strike',
          text: res.session.streak > 1 ? `+${res.points_awarded} COMBO x${res.session.streak}!` : `+${res.points_awarded} WEB STRIKE!`,
        });
      } else {
        playSound(bossId === 'doc-ock' ? drottoAudio : laughAudio);
        setFeedback(index === null ? { kind: 'timeout', text: 'TIME OUT!' } : { kind: 'counter', text: 'COUNTER ATTACK!' });
      }

      advanceTimer.current = window.setTimeout(() => {
        if (res.session_status === 'victory') {
          setPhase('victory');
        } else if (res.session_status === 'defeat' || !res.next_question) {
          setPhase('defeat');
        } else {
          showQuestion(res.next_question);
        }
      }, feedbackMs);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send your answer.');
      setPhase('error');
    }
  }, [question, locked, hint, bossId, setProgress, feedbackMs]);

  // Per-question countdown. Running out of time is sent as "no answer".
  useEffect(() => {
    if (phase !== 'combat' || locked) return;
    const interval = window.setInterval(() => setTimeSpent((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, [phase, locked, question]);

  useEffect(() => {
    if (phase === 'combat' && !locked && timeSpent >= QUESTION_TIME_LIMIT) submitAnswer(null);
  }, [timeSpent, phase, locked, submitAnswer]);

  const requestHint = async () => {
    setHintOpen(true);
    if (hint !== null || !question) return;
    try {
      const data = await api<{ hint: string }>(`/attempts/${question.attempt_id}/hint`);
      setHint(data.hint);
    } catch {
      setHint('Gwen cannot reach you right now. Try breaking the problem into smaller steps.');
    }
  };

  // ── Screens ────────────────────────────────────────────────────────────────
  if (consentNeeded) {
    return (
      <CameraConsent
        onEnable={() => {
          setConsentNeeded(false);
          enableCamera();
        }}
        onDecline={() => {
          setCameraChoice(userId, 'declined');
          setConsentNeeded(false);
        }}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-hero-400 font-mono text-sm tracking-widest">
        <Cpu className="w-5 h-5 animate-spin mr-2" /> PREPARING MISSION...
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
        <div role="alert" className="max-w-md w-full text-center bg-ink-950/90 border border-red-600/50 rounded-3xl p-8">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="font-comic text-2xl text-white mb-2">Mission interrupted</h2>
          <p className="text-sm text-gray-300 mb-6">{errorMsg}</p>
          <div className="flex gap-3">
            <button onClick={startMission} className="flex-1 py-3 bg-hero-600 hover:bg-hero-500 text-white font-bold rounded-xl">Try again</button>
            <button onClick={onExit} className="flex-1 py-3 bg-ink-800 hover:bg-ink-700 text-white font-bold rounded-xl border border-white/10">Back to HQ</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'victory') {
    const nextBoss = NEXT_BOSS[bossId];
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
        <audio ref={victoryAudio} src="/spiderman-meme-song.mp3" preload="auto" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-hero-600/30 via-black to-black" />
        <Reveal className="relative text-center max-w-md w-full bg-ink-950/80 backdrop-blur-xl border border-hero-600/50 rounded-3xl p-8 comic-shadow-red">
          <div className="w-24 h-24 mx-auto bg-green-500/20 border-4 border-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(34,197,94,0.4)]">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-comic text-white mb-4 uppercase tracking-wide">THREAT NEUTRALIZED</h2>

          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-black/50 rounded-xl p-5 border border-hero-500/30">
              <div className="text-hero-400 font-comic text-4xl mb-1">+{session?.points_awarded ?? 0}</div>
              <div className="text-sm text-hero-500 uppercase tracking-widest font-bold">Spider Points</div>
            </div>
            <div className="bg-black/50 rounded-xl p-5 border border-green-500/30">
              <div className="text-green-400 font-comic text-4xl mb-1">{bestStreak}</div>
              <div className="text-sm text-green-500 uppercase tracking-widest font-bold">Best Streak</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={startMission} className="flex-1 py-5 bg-hero-600 text-white font-comic text-[15px] sm:text-xl tracking-wider rounded-xl hover:bg-hero-500 transition-all whitespace-nowrap">
              PLAY AGAIN
            </button>
            {nextBoss && onNextLevel && progress.unlocked_bosses.includes(nextBoss) && (
              <button onClick={() => onNextLevel(nextBoss)} className="flex-1 py-5 bg-blue-600 text-white font-comic text-[15px] sm:text-xl tracking-wider rounded-xl hover:bg-blue-500 transition-all whitespace-nowrap">
                NEXT LEVEL
              </button>
            )}
            <button onClick={onExit} className="flex-1 py-5 bg-ink-800 text-white font-comic text-[15px] sm:text-xl tracking-wider rounded-xl hover:bg-ink-700 transition-all border-2 border-hero-600/50 whitespace-nowrap">
              HQ
            </button>
          </div>
        </Reveal>
      </div>
    );
  }

  if (phase === 'defeat') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/40 via-black to-black" />
        <Reveal className="relative text-center max-w-md w-full bg-ink-950/80 backdrop-blur-xl border border-red-600/50 rounded-3xl p-8 comic-shadow-red">
          <div className="w-24 h-24 mx-auto bg-red-500/20 border-4 border-red-500 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-12 h-12 text-red-400" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-comic text-white mb-4 uppercase tracking-wide">MISSION FAILED</h2>
          <p className="text-red-400 font-comic text-2xl mb-10">The villain escaped this time...</p>
          <div className="flex gap-4">
            <button onClick={startMission} className="flex-1 py-5 bg-red-600 text-white font-comic text-xl tracking-wider rounded-xl hover:bg-red-500 transition-all">TRY AGAIN</button>
            <button onClick={onExit} className="flex-1 py-5 bg-ink-800 text-white font-comic text-xl tracking-wider rounded-xl hover:bg-ink-700 transition-all border-2 border-red-600/50">RETREAT</button>
          </div>
        </Reveal>
      </div>
    );
  }

  if (!session || !question) return null;

  const villainHealth = Math.max(0, 100 - (100 * session.correct_count) / session.questions_to_win);
  const playerHealth = Math.max(0, 100 - (100 * session.wrong_count) / session.max_wrong);
  const timeLeft = Math.max(0, QUESTION_TIME_LIMIT - timeSpent);
  const questionNumber = session.correct_count + session.wrong_count + (result ? 0 : 1);

  const optionClasses = (idx: number) => {
    if (!locked) return 'bg-red-950/10 border-red-500/20 text-white hover:bg-red-900/30 hover:border-hero-500/80 hover:-translate-y-1';
    if (!result) return idx === selected ? 'bg-white/10 border-white/40 text-white' : 'bg-black/50 border-white/5 text-gray-500 opacity-50';
    if (idx === result.correct_index) return 'bg-green-500/20 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] text-green-400 scale-[1.02] z-10';
    if (idx === selected) return 'bg-red-600/30 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.6)] text-red-400 scale-[0.98]';
    return 'bg-black/50 border-white/5 text-gray-700 opacity-30';
  };

  const feedbackStyle = {
    strike: { wrap: 'bg-hero-600/10', box: 'text-white border-hero-500 rotate-[-10deg]' },
    counter: { wrap: 'bg-red-900/20', box: 'text-red-400 border-red-500 rotate-[5deg]' },
    timeout: { wrap: 'bg-yellow-900/40', box: 'text-yellow-400 border-yellow-500' },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden font-sans">
      <audio ref={laughAudio} src="/green_goblin_laugh.mp3" preload="auto" />
      <audio ref={drottoAudio} src="/drotto.wav" preload="auto" />
      <audio ref={drottoLosingAudio} src="/drottoloosing.wav" preload="auto" />
      <audio ref={victoryAudio} src="/spiderman-meme-song.mp3" preload="auto" />

      <div className="absolute inset-0 bg-gradient-to-b from-hero-900/40 via-ink-950/80 to-black" />
      <div className="absolute inset-0 halftone opacity-30 pointer-events-none" />

      {/* Top combat HUD */}
      <div className="relative z-20 flex justify-between items-start p-2 max-w-[1400px] mx-auto w-full pt-2">
        <div className="flex items-center gap-4 w-1/3">
          <div className="relative shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] border-hero-600 bg-ink-900 overflow-hidden relative z-10 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
              <img src="/spiderman-gif.gif" alt="" className="w-full h-full object-cover scale-110" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-black border-2 border-hero-500 text-hero-400 font-comic text-xs px-2 py-0.5 rounded-lg z-20">
              LVL {progress.level}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <h1 className="text-xl sm:text-2xl font-comic text-white tracking-widest italic whitespace-nowrap mb-1.5">SPIDER-MAN</h1>
            <div className="h-3 bg-ink-950/80 rounded-full border-2 border-white/10 overflow-hidden" role="progressbar" aria-label="Your health" aria-valuenow={Math.round(playerHealth)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gradient-to-r from-red-700 via-hero-500 to-red-400 transition-all duration-500 ease-out" style={{ width: `${playerHealth}%` }} />
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-1.5 text-hero-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-hero-950/50 px-2 py-1 rounded border border-hero-500/30 whitespace-nowrap">
                <Zap className="w-3 h-3 text-yellow-400" /> {progress.points} SP
              </div>
              <div className="text-white font-comic text-lg sm:text-xl">
                COMBO <span className="text-yellow-400 text-xl sm:text-2xl">{session.streak}x</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center mt-2">
          <div className="font-comic text-4xl sm:text-5xl text-white italic tracking-tighter opacity-80">VS</div>
        </div>

        <div className="flex items-center gap-4 w-1/3 flex-row-reverse text-right">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] ${boss.border} bg-ink-900 overflow-hidden relative z-10 flex items-center justify-center`}>
              {boss.gif ? (
                <img src={boss.gif} alt="" className="w-full h-full object-cover scale-110 object-top" />
              ) : (
                <ShieldAlert className={`w-8 h-8 ${boss.text}`} />
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <h1 className={`text-xl sm:text-2xl font-comic ${boss.text} tracking-widest italic whitespace-nowrap uppercase mb-1.5`}>{boss.name}</h1>
            <div className="h-3 bg-ink-950/80 rounded-full border-2 border-white/10 overflow-hidden" role="progressbar" aria-label="Boss health" aria-valuenow={Math.round(villainHealth)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full transition-all duration-500 ease-out bg-gradient-to-l ${boss.health}`} style={{ width: `${villainHealth}%`, marginLeft: 'auto' }} />
            </div>
            <div className="flex justify-end items-center mt-2">
              <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${boss.text} ${boss.bg} px-2 py-1 rounded border ${boss.border} whitespace-nowrap`}>
                {session.correct_count} / {session.questions_to_win} hits landed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main combat area */}
      <div className="relative z-10 flex flex-col items-center justify-center p-2 w-full">
        <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 mb-2 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-[11px] sm:text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
            Topic mastery:{' '}
            <span className="text-yellow-400 font-bold">{mastery === null ? 'answer a question to see it' : `about ${formatMastery(mastery)}`}</span>
          </div>
          <div>Mistakes: <span className="text-white font-bold">{session.wrong_count} / {session.max_wrong}</span></div>
          <button
            onClick={camera === 'on' || camera === 'starting' ? disableCamera : enableCamera}
            aria-pressed={camera === 'on'}
            title="Optional. Checks if you are looking at the screen. Nothing is recorded and it never changes your score."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border transition-colors ${
              camera === 'on'
                ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                : 'bg-white/5 border-white/20 text-slate-300 hover:text-white'
            }`}
          >
            {camera === 'on' ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
            {camera === 'on' ? 'Camera on (tap to turn off)' : camera === 'starting' ? 'Camera starting...' : 'Camera off'}
          </button>
        </div>

        {camera === 'unavailable' && (
          <div role="status" className="w-full max-w-3xl mb-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
            Camera unavailable, carrying on without it. Your game and score are not affected.
          </div>
        )}

        <div className="w-full max-w-3xl relative mt-2">
          <div className="bg-black/60 backdrop-blur-2xl border border-red-500/20 rounded-3xl p-4 sm:p-5 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 border-b border-red-500/20 pb-2">
                <div>
                  <div className="text-red-500 font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> THREAT DETECTED
                  </div>
                  <div className="text-white font-comic text-lg sm:text-xl tracking-widest uppercase">MISSION 0{boss.index}: {boss.name} ATTACK</div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className={`flex flex-col items-end ${timeLeft < 60 ? 'text-red-500' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-sm">
                      <Clock className="w-4 h-4" />
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider">Time left</div>
                  </div>
                  <div className="hidden sm:block border-l border-white/10 pl-4 text-gray-500 font-mono text-[10px] uppercase">
                    Question {questionNumber}
                    <div className="text-hero-400 font-bold mt-0.5">Level: {question.difficulty}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4 text-sm sm:text-base text-white font-medium leading-tight whitespace-pre-line font-mono">
                {question.text}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {question.options.map((opt, idx) => (
                  <button
                    key={`${question.attempt_id}-${idx}`}
                    disabled={locked}
                    onClick={() => submitAnswer(idx)}
                    className={`relative overflow-hidden p-3 rounded-xl border-2 text-left font-comic text-lg sm:text-xl transition-all duration-300 ${optionClasses(idx)}`}
                  >
                    <div className="relative z-10 flex items-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black/40 border border-white/10 text-hero-400 text-xs mr-3 font-mono shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {feedback && (
            <div role="status" className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none backdrop-blur-sm overflow-hidden ${feedbackStyle[feedback.kind].wrap}`}>
              <div className={`font-comic text-4xl md:text-6xl italic tracking-tighter p-6 md:p-8 bg-black/70 border-4 rounded-3xl ${feedbackStyle[feedback.kind].box}`}>
                {feedback.text}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 left-4 z-30 flex items-end gap-3 max-w-sm">
        {hintOpen ? (
          <div className="bg-pink-950/80 backdrop-blur-md border border-pink-500/40 p-4 rounded-2xl rounded-bl-none relative">
            <div className="flex justify-between items-center mb-2 gap-4">
              <span className="text-pink-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1"><Cpu className="w-3 h-3" /> Gwen&apos;s hint</span>
              <button onClick={() => setHintOpen(false)} aria-label="Close hint" className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-white text-sm leading-relaxed font-mono">{hint ?? 'Thinking...'}</p>
          </div>
        ) : (
          <button
            onClick={requestHint}
            disabled={locked}
            className="bg-black/50 border border-pink-500/30 backdrop-blur-sm px-4 py-2 rounded-full text-pink-400 font-bold text-sm flex items-center gap-2 hover:bg-pink-500/20 hover:border-pink-500 transition-all disabled:opacity-40"
          >
            <Cpu className="w-4 h-4" /> Ask Gwen for a hint
          </button>
        )}
        <img src="/gwen.jpeg" alt="" className="relative z-10 w-14 h-14 rounded-full border-2 border-pink-500 object-cover shrink-0" />
      </div>

      <button
        onClick={onExit}
        className="absolute bottom-10 right-4 z-50 text-gray-500 hover:text-white font-bold text-[10px] sm:text-xs tracking-widest uppercase transition-colors"
      >
        Abort Mission
      </button>
    </div>
  );
}
