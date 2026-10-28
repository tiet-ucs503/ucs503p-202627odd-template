'use client';
import axios from 'axios';

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function LoginSignUpSection({ initialTab = 'login' }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
const [loginPassword, setLoginPassword] = useState('');

const [signupName, setSignupName] = useState('');
const [signupEmail, setSignupEmail] = useState('');
const [signupPassword, setSignupPassword] = useState('');

const [authError, setAuthError] = useState('');
const [authMessage, setAuthMessage] = useState('');
const [loading, setLoading] = useState(false);

  // Sync tab with initialTab prop when URL route changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (val) => {
    setActiveTab(val);
    navigate(`/${val}`, { replace: true });
  };

  // Subtle monochrome particles
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let ps = [];

    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const makeParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });

    const init = () => {
      ps = [];
      const count = Math.min(Math.floor((width * height) / 10000), 80);
      for (let i = 0; i < count; i++) {
        ps.push(makeParticle());
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * width;
          p.y = height + Math.random() * 40;
          p.v = Math.random() * 0.25 + 0.05;
          p.o = Math.random() * 0.35 + 0.15;
        }
        ctx.fillStyle = `rgba(250, 250, 250, ${p.o})`;
        ctx.fillRect(p.x, p.y, 0.7, 2.2);
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    const onResize = () => {
      setSize();
      init();
    };

    setSize();
    init();
    draw();

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  
const handleLoginSubmit = async (e) => {
  e.preventDefault();
  setAuthError('');
  setAuthMessage('');
  setLoading(true);

  try {
    const response = await axios.post(
      'http://localhost:3000/api/auth/login',
      {
        email: loginEmail,
        password: loginPassword,
      }
    );

    const { token, user } = response.data;

    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('authUser', JSON.stringify(user));

    setAuthMessage(`Welcome, ${user.name}!`);
navigate('/dashboard', { replace: true });
    // Keep the current page until we verify the app's dashboard route.
  } catch (error) {
    setAuthError(
      error.response?.data?.message ||
      'Login failed. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};

const handleSignupSubmit = async (e) => {
  e.preventDefault();
  setAuthError('');
  setAuthMessage('');
  setLoading(true);

  try {
    await axios.post(
      'http://localhost:3000/api/auth/signup',
      {
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      }
    );

    setAuthMessage('Account created successfully! Please log in.');
    setActiveTab('login');
    navigate('/login', { replace: true });
  } catch (error) {
    setAuthError(
      error.response?.data?.message ||
      'Signup failed. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};


  return (
    <section className="fixed inset-0 bg-zinc-950 text-zinc-50 select-none overflow-y-auto">
      <style>{`
        /* card fade-up on mount */
        .card-animate {
          opacity: 0;
          transform: translateY(12px);
          animation: fadeUp .6s ease .25s forwards;
          transition: all 0.6s ease;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* accent lines */
        .accent-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .7;
        }
        .hline, .vline {
          position: absolute;
          background: #27272a;
        }
        .hline {
          left: 0;
          right: 0;
          height: 1px;
          transform: scaleX(0);
          transform-origin: 50% 50%;
          animation: drawX .6s ease forwards;
        }
        .vline {
          top: 0;
          bottom: 0;
          width: 1px;
          transform: scaleY(0);
          transform-origin: 50% 0%;
          animation: drawY .7s ease forwards;
        }
        .hline:nth-child(1) { top: 18%; animation-delay: .08s; }
        .hline:nth-child(2) { top: 50%; animation-delay: .16s; }
        .hline:nth-child(3) { top: 82%; animation-delay: .24s; }
        .vline:nth-child(4) { left: 22%; animation-delay: .20s; }
        .vline:nth-child(5) { left: 50%; animation-delay: .28s; }
        .vline:nth-child(6) { left: 78%; animation-delay: .36s; }
        @keyframes drawX { to { transform: scaleX(1); } }
        @keyframes drawY { to { transform: scaleY(1); } }

        /* Tabs styling */
        .auth-tabs [role="tablist"] {
          background: #0f0f10;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 4px;
        }
        .auth-tabs [role="tab"] {
          font-size: 13px;
          letter-spacing: .02em;
        }
        .auth-tabs [role="tab"][data-state="active"] {
          background: #18181b;
          border-radius: 8px;
          box-shadow: inset 0 0 0 1px #27272a;
          color: #fafafa;
        }
        /* Tab transition animation */
        .auth-tabs [role="tabpanel"] {
          animation: tabFadeIn 0.4s ease;
        }
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Particles canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-50 mix-blend-screen pointer-events-none"
      />

      {/* Accent lines */}
      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      {/* Header */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-2xl font-bold font-mono tracking-tight uppercase text-zinc-50">
            VerHire
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 cursor-pointer font-mono text-xs"
        >
          <span className="mr-2">Home</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      {/* Centered card with tabs */}
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-20 relative z-10">
        <Card className="card-animate w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/70 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-mono uppercase tracking-tight text-zinc-50">
              VerHire Console
            </CardTitle>
            <CardDescription className="text-zinc-400 font-mono text-xs">
              Sign in or create an account to verify internship offers & track fraud flags
            </CardDescription>
          </CardHeader>

          <CardContent>
          {authError && (
  <p role="alert" className="mb-3 text-sm text-red-400">
    {authError}
  </p>
)}

{authMessage && (
  <p role="status" className="mb-3 text-sm text-green-400">
    {authMessage}
  </p>
)}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="auth-tabs w-full">
              <TabsList className="grid w-full grid-cols-2 font-mono">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* LOGIN TAB */}
              <TabsContent value="login" className="mt-6 space-y-4">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="login-email" className="text-zinc-300 font-mono text-xs uppercase">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@company.com"
                        className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                        value={loginEmail} and onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="login-password" className="text-zinc-300 font-mono text-xs uppercase">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="login-password"
                        type={showLoginPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                        value={loginPassword} and onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        onClick={() => setShowLoginPw((v) => !v)}
                        aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900"
                      />
                      <Label htmlFor="remember" className="text-zinc-400 font-mono text-xs cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    <a href="#" className="text-zinc-400 hover:text-zinc-200">
                      Forgot password?
                    </a>
                  </div>

                <Button
  type="submit"
  disabled={loading}
  className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200 cursor-pointer uppercase font-mono font-bold tracking-wider">

  {loading ? 'Please wait...' : 'Sign in'}
</Button>
                </form>
              </TabsContent>

              {/* SIGN UP TAB */}
              <TabsContent value="signup" className="mt-6 space-y-4">
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-zinc-300 font-mono text-xs uppercase">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={signupName} and onChange={(e) => setSignupName(e.target.value)}
                        className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="signup-email" className="text-zinc-300 font-mono text-xs uppercase">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        value={signupEmail} and onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="signup-password" className="text-zinc-300 font-mono text-xs uppercase">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        id="signup-password"
                        type={showSignupPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signupPassword} and onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10 pr-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        onClick={() => setShowSignupPw((v) => !v)}
                        aria-label={showSignupPw ? 'Hide password' : 'Show password'}
                      >
                        {showSignupPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <Checkbox
                      id="terms"
                      className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900"
                      required
                    />
                    <Label htmlFor="terms" className="text-zinc-400 font-mono text-xs cursor-pointer">
                      I agree to the Terms & Privacy
                    </Label>
                  </div>

<Button
  type="submit"
  disabled={loading}
  className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200 cursor-pointer uppercase"
>
                 {loading ? 'Please wait...' : 'Create account'}   
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center pt-2 pb-6 text-center text-xs font-mono text-zinc-500">
            <span>VerHire Security & Verification System</span>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
