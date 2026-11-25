// The one place the frontend talks to the backend.
// Set VITE_API_URL in frontend/.env to point somewhere other than localhost.

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the server says the token is missing or expired. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function describeError(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors arrive as a list of {loc, msg}
  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
    const field = Array.isArray(detail[0].loc) ? detail[0].loc[detail[0].loc.length - 1] : '';
    return field ? `${field}: ${detail[0].msg}` : detail[0].msg;
  }
  return `Request failed (${status})`;
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the MathVerse server. Is the backend running?');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, describeError(data?.detail, res.status));
  }
  return res.json() as Promise<T>;
}

// ── Shapes returned by the backend (see backend/schemas.py) ──────────────────
export type Role = 'student' | 'parent' | 'teacher';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  points: number;
  level: number;
  link_code: string | null;
  is_demo: boolean;
}

export interface TokenResponse {
  access_token: string;
  user: User;
}

/** Sign-up reply: the account waits until the emailed 6-digit code is entered. */
export interface VerificationPending {
  verification_required: true;
  email: string;
  email_sent: boolean;
  resend_after_seconds: number;
}

export interface MessageOut {
  message: string;
  resend_after_seconds: number;
}

export interface Progress {
  points: number;
  level: number;
  unlocked_bosses: string[];
  missions_won: number;
  link_code: string | null;
}

export interface Question {
  attempt_id: number;
  text: string;
  options: string[];
  topic: string;
  difficulty: string;
}

export interface SessionState {
  id: number;
  boss_id: string;
  status: 'active' | 'victory' | 'defeat' | 'abandoned';
  correct_count: number;
  wrong_count: number;
  streak: number;
  questions_to_win: number;
  max_wrong: number;
  points_awarded: number;
}

/** Numbers only. Phase B fills this in when the camera is on; null means not measured. */
export interface AttentionSummary {
  face_present_pct: number;
  on_screen_pct: number;
  blink_rate_per_min: number | null;
  sample_seconds: number;
}

export interface AnswerResponse {
  correct: boolean;
  correct_index: number;
  points_awarded: number;
  bonus_points: number;
  mastery: number; // raw stored value; do not show it
  mastery_display_pct: number; // what to show: limited to 5-95
  session_status: SessionState['status'];
  session: SessionState;
  progress: Progress;
  next_question: Question | null;
}

export interface LinkedStudent {
  id: number;
  name: string;
  level: number;
  points: number;
  is_demo: boolean;
  questions_answered: number;
  accuracy_pct: number | null;
  last_active: string | null;
}

export interface TopicMastery {
  topic: string;
  label: string;
  mastery_pct: number | null; // display value, limited to 5-95; null = not started
  mastery_band: 'needs_practice' | 'developing' | 'strong' | null;
  questions_answered: number;
  correct_answers: number;
}

export interface RecentAttempt {
  id: number;
  boss_name: string;
  topic_label: string;
  difficulty: string;
  is_correct: boolean;
  response_time_s: number;
  hint_used: boolean;
  points_awarded: number;
  answered_at: string;
  attention_label: string | null;
}

/** One calendar day. Days without practice have zero questions and null accuracy. */
export interface DailyPoint {
  date: string; // YYYY-MM-DD
  questions: number;
  correct: number;
  accuracy_pct: number | null;
  practice_minutes: number;
  attention_measured: number;
  avg_on_screen_pct: number | null;
}

export interface TopicHistory {
  topic: string;
  label: string;
  points: { date: string; mastery_pct: number }[];
}

export interface Badge {
  id: string;
  label: string;
  description: string;
}

export interface StudentReport {
  student_id: number;
  student_name: string;
  is_demo: boolean;
  points: number;
  level: number;
  last_active: string | null;
  questions_answered: number;
  correct_answers: number;
  accuracy_pct: number | null;
  practice_minutes: number;
  missions_played: number;
  missions_won: number;
  bosses_defeated: number;
  total_bosses: number;
  topic_mastery: TopicMastery[];
  needs_practice: TopicMastery[];
  daily: DailyPoint[];
  mastery_history: TopicHistory[];
  observations: string[];
  badges: Badge[];
  recent_attempts: RecentAttempt[];
  attention: {
    measured_questions: number;
    total_questions: number;
    avg_on_screen_pct: number | null;
  };
}

/** Report URL including the viewer's clock offset, so daily trends follow their calendar day. */
export function reportPath(studentId: number): string {
  return `/students/${studentId}/report?tz_offset_minutes=${-new Date().getTimezoneOffset()}`;
}
