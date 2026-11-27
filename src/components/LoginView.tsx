import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { GraduationCap, BookOpen, ShieldCheck, UserPlus, LogIn, CheckCircle2, Sparkles } from "lucide-react";

interface LoginViewProps {
  onLogin: (userData: any) => void;
}

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "coordinator" | "faculty" | "student";
  department?: string;
  batchId?: string;
}

const LOCAL_STORAGE_USERS_KEY = "intelli_registered_users";

export default function LoginView({ onLogin }: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Sign In form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState<"student" | "faculty" | "coordinator">("student");
  const [regDepartment, setRegDepartment] = useState("Computer Science");
  const [regBatch, setRegBatch] = useState("CSE-A");

  // Load custom local accounts from browser storage if present (to support both API & offline/Vercel static)
  const getStoredUsers = (): StoredAccount[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveStoredUser = (user: StoredAccount) => {
    try {
      const existing = getStoredUsers();
      const filtered = existing.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify([...filtered, user]));
    } catch (e) {
      console.error("Failed to save to local storage", e);
    }
  };

  // Sign In Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password;

    try {
      // 1. Try server endpoint first
      let serverSuccess = false;
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            serverSuccess = true;
            onLogin(data.user);
            return;
          }
        }
      } catch {
        // Backend offline or running in pure static Vercel mode, proceed to client fallback
      }

      if (!serverSuccess) {
        // 2. Client-side local verification (checks built-in default accounts + locally registered accounts)
        const builtInUsers: StoredAccount[] = [
          { id: "u1", email: "admin@college.edu", password: "password", role: "coordinator", name: "Dr. Admin" },
          { id: "sharma", email: "sharma@college.edu", password: "password", role: "faculty", name: "Prof. Sharma", department: "Computer Science" },
          { id: "gupta", email: "gupta@college.edu", password: "password", role: "faculty", name: "Prof. Gupta", department: "Computer Science" },
          { id: "csea", email: "student@college.edu", password: "password", role: "student", name: "Student CSE-A", batchId: "CSE-A" },
        ];

        const localUsers = getStoredUsers();
        const allUsers = [...builtInUsers, ...localUsers];

        const match = allUsers.find(
          (u) => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
        );

        if (match) {
          onLogin(match);
        } else {
          setError("Invalid email or password. Please verify your credentials or register a new account.");
        }
      }
    } catch {
      setError("An error occurred while signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Register Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const newUserPayload: StoredAccount = {
      id: `user_${Date.now()}`,
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      role: regRole,
      department: regDepartment,
      batchId: regRole === "student" ? regBatch : undefined,
    };

    try {
      let registeredUser: any = null;

      // 1. Send to server endpoint
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUserPayload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          registeredUser = data.user;
        } else if (res.status === 409) {
          setError(data.message || "An account with this email already exists.");
          setLoading(false);
          return;
        }
      } catch {
        // If server is not responding, register client-side in localStorage
      }

      // 2. Always persist into localStorage for instant resilience & offline/Vercel support
      saveStoredUser(newUserPayload);
      const userToLogin = registeredUser || newUserPayload;

      setSuccessMsg("Account created successfully! Logging you in...");
      setTimeout(() => {
        onLogin(userToLogin);
      }, 600);
    } catch {
      setError("Failed to complete registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Demo autofill helper
  const handleQuickDemo = (demoEmail: string) => {
    setActiveTab("login");
    setEmail(demoEmail);
    setPassword("password");
    setError("");
    setSuccessMsg("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Brand Header */}
      <div className="text-center mb-6 space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 mb-1">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">TimeTable Maker</h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Intelligent Academic Timetable Scheduling, Allocation & Swap Management
        </p>
      </div>

      <Card className="w-full max-w-lg shadow-2xl border-slate-800 bg-slate-950/80 backdrop-blur-sm text-slate-100">
        <CardHeader className="pb-4">
          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-lg border border-slate-800 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setError("");
                setSuccessMsg("");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all ${
                activeTab === "login"
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setError("");
                setSuccessMsg("");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all ${
                activeTab === "register"
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </button>
          </div>
          <CardDescription className="text-center text-slate-400 pt-2 text-xs">
            {activeTab === "login"
              ? "Access your schedule, preferences, or administrative portal"
              : "Register as a Student, Faculty member, or Academic Coordinator"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Notifications */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm p-3 rounded-lg flex items-start gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm p-3 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN VIEW */}
          {activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Email Address
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 h-11 transition shadow-md shadow-indigo-600/20 mt-1"
              >
                {loading ? "Authenticating..." : "Sign In to Account"}
              </Button>

              {/* Demo Accounts Quick Click */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Quick Demo Logins (Click to autofill)
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickDemo("admin@college.edu")}
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-indigo-500 text-left transition"
                  >
                    <div className="font-semibold text-indigo-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Coordinator
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">admin@college.edu</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo("sharma@college.edu")}
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-indigo-500 text-left transition"
                  >
                    <div className="font-semibold text-emerald-400 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> Teacher / Faculty
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">sharma@college.edu</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemo("student@college.edu")}
                    className="p-2 rounded-md bg-slate-900 border border-slate-800 hover:border-indigo-500 text-left transition"
                  >
                    <div className="font-semibold text-sky-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" /> Student
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">student@college.edu</div>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* REGISTER VIEW */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Role Selection Cards */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Select Your Academic Role
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole("student")}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-1 ${
                      regRole === "student"
                        ? "bg-indigo-600/15 border-indigo-500 text-white ring-1 ring-indigo-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <GraduationCap className={`w-4 h-4 ${regRole === "student" ? "text-sky-400" : "text-slate-500"}`} />
                    <span className="text-xs font-semibold">Student</span>
                    <span className="text-[10px] text-slate-400">Class timetable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole("faculty")}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-1 ${
                      regRole === "faculty"
                        ? "bg-indigo-600/15 border-indigo-500 text-white ring-1 ring-indigo-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <BookOpen className={`w-4 h-4 ${regRole === "faculty" ? "text-emerald-400" : "text-slate-500"}`} />
                    <span className="text-xs font-semibold">Teacher / Faculty</span>
                    <span className="text-[10px] text-slate-400">Lectures & swaps</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole("coordinator")}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-1 ${
                      regRole === "coordinator"
                        ? "bg-indigo-600/15 border-indigo-500 text-white ring-1 ring-indigo-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 ${regRole === "coordinator" ? "text-amber-400" : "text-slate-500"}`} />
                    <span className="text-xs font-semibold">Coordinator</span>
                    <span className="text-[10px] text-slate-400">Master scheduler</span>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <Label htmlFor="reg-name" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Full Name
                </Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder={regRole === "faculty" ? "Prof. Alex Johnson" : regRole === "coordinator" ? "Dr. Samantha Reed" : "Jordan Lee"}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Institutional Email
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="yourname@college.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Dynamic details by role */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reg-dept" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Department
                  </Label>
                  <select
                    id="reg-dept"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Tech</option>
                    <option value="Electronics">Electronics (ECE)</option>
                    <option value="Mechanical">Mechanical</option>
                  </select>
                </div>

                {regRole === "student" ? (
                  <div className="space-y-1">
                    <Label htmlFor="reg-batch" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Class Batch / Section
                    </Label>
                    <select
                      id="reg-batch"
                      value={regBatch}
                      onChange={(e) => setRegBatch(e.target.value)}
                      className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="CSE-A">CSE-A</option>
                      <option value="CSE-B">CSE-B</option>
                      <option value="IT-A">IT-A</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Access Level
                    </Label>
                    <div className="h-10 px-3 rounded-md bg-slate-900/60 border border-slate-800 text-slate-400 text-xs flex items-center">
                      {regRole === "coordinator" ? "Full Admin & Generate" : "Teaching & Swaps"}
                    </div>
                  </div>
                )}
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-confirm-password" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Confirm
                  </Label>
                  <Input
                    id="reg-confirm-password"
                    type="password"
                    placeholder="Re-enter"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 h-11 transition shadow-md shadow-indigo-600/20 mt-2"
              >
                {loading ? "Creating Account..." : "Create Account & Sign In"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Footer info */}
      <p className="mt-6 text-xs text-slate-500 text-center">
        Powered by TimeTable Maker • Built with role-based access for Students, Teachers & Coordinators
      </p>
    </div>
  );
}
