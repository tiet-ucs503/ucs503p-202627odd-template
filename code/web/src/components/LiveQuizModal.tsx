'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  LinearProgress,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import QuizIcon from '@mui/icons-material/Quiz';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import TimerIcon from '@mui/icons-material/Timer';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { getAuthHeaders, getAuthToken } from '@/lib/authStorage';
import { apiJson } from '@/lib/api';
import { QuizResultsDialog } from './QuizResultsDialog';

export interface QuizQuestionItem {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  order_index: number;
  time_limit_seconds: number;
}

export interface QuizInfo {
  id: string;
  title: string;
  scoring_mode: 'WIDE' | 'NARROW';
  question_count: number;
  questions: QuizQuestionItem[];
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  student_email: string;
  total_score: number;
  correct_count: number;
  total_answered: number;
  avg_response_time_ms: number;
}

type QuizStage = 'LOBBY' | 'QUESTION_ACTIVE' | 'QUESTION_RESULTS' | 'FINAL_LEADERBOARD';

export interface QuizResumeQuestion {
  question_id: string;
  question_index: number;
  question_text: string;
  options: { id: string; text: string }[];
  start_time_ms: number;
  end_time_ms: number;
  revealed: boolean;
  correct_option_id: string | null;
}

export interface QuizResumeState {
  activityId?: string;
  title?: string;
  scoring_mode?: 'WIDE' | 'NARROW' | string;
  status?: string;
  question_count?: number;
  stage: QuizStage;
  current_question: QuizResumeQuestion | null;
  answered_count?: number;
  leaderboard?: LeaderboardEntry[];
}

interface LiveQuizModalProps {
  open: boolean;
  activityId: string;
  classroomId: string;
  quiz: QuizInfo;
  onClose: () => void;
  onActivityEnded: () => void;
  resumeState?: QuizResumeState | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const LiveQuizModal: React.FC<LiveQuizModalProps> = ({
  open,
  activityId,
  classroomId,
  quiz,
  onClose,
  onActivityEnded,
  resumeState,
}) => {
  const resumeQuestion = resumeState?.current_question ?? null;
  const resumeIndex = resumeQuestion?.question_index ?? 0;

  const [stage, setStage] = useState<QuizStage>(resumeState?.stage ?? 'LOBBY');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(resumeIndex);
  const [liveAnsweredCount, setLiveAnsweredCount] = useState<number>(resumeState?.answered_count ?? 0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(() => {
    if (resumeState?.stage === 'QUESTION_ACTIVE' && resumeQuestion) {
      return Math.max(0, Math.ceil((resumeQuestion.end_time_ms - Date.now()) / 1000));
    }
    return quiz.questions[resumeIndex]?.time_limit_seconds || 20;
  });
  const [distribution, setDistribution] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ending, setEnding] = useState(false);
  const [startingNext, setStartingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [detailedResultsOpen, setDetailedResultsOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentQuestionIdRef = useRef<string | null>(resumeQuestion?.question_id ?? null);

  const currentQuestion = quiz.questions[currentQuestionIndex] || quiz.questions[0];

  const totalQuizQuestionVotes = useMemo(() => {
    return distribution.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  }, [distribution]);

  const quizDistributionData = useMemo(() => {
    const question = quiz.questions[currentQuestionIndex] || quiz.questions[0];
    const questionOptions = question?.options || [];
    return distribution.map((item, index) => {
      const shortCode =
        item.option_id && item.option_id.toString().length <= 2
          ? item.option_id.toString().toUpperCase()
          : String.fromCharCode(65 + index);
      const fallbackOption = questionOptions.find((opt) => opt.id === item.option_id);
      return {
        ...item,
        shortCode,
        displayLabel: `Option ${shortCode}`,
        // Older payloads may omit option_text; derive it from the authored question.
        option_text: item.option_text || fallbackOption?.text || '',
        // The teacher view must not depend on a correct-answer field in live answers.
        is_correct:
          item.is_correct ??
          (item.option_id && question?.correct_option_id
            ? item.option_id === question.correct_option_id
            : false),
      };
    });
  }, [distribution, quiz.questions, currentQuestionIndex]);

  useEffect(() => {
    if (!open || !activityId) return;

    const socket = io(API_BASE_URL, {
      auth: { token: getAuthToken() },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_activity_teacher', activityId, (result: { ok?: boolean; error?: string } | undefined) => {
        if (!result?.ok) {
          setError(result?.error || 'The server denied access to this live quiz room.');
        }
      });
    });

    socket.on('auth:error', (data: { error?: string } | undefined) => {
      setError(data?.error || 'Socket authentication failed. Please sign in again.');
    });

    socket.on('quiz:live_answers', (data: any) => {
      if (data.activityId !== activityId) return;
      // Ignore late/stale counts from a question the teacher already advanced past.
      if (data.questionId && data.questionId !== currentQuestionIdRef.current) return;
      setLiveAnsweredCount(data.answeredCount || 0);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_activity', activityId);
        socketRef.current.disconnect();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [open, activityId]);

  // Restore a live quiz exactly where the server says it is (resume flow).
  useEffect(() => {
    if (!open || !activityId || !resumeState) return;

    let cancelled = false;

    const startCountdown = (endTimeMs: number) => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
        setTimeRemainingSeconds(remaining);
        if (remaining <= 0 && timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }, 200);
    };

    const applyResumeState = async () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setError(null);

      const question = resumeState.current_question;
      const index = question?.question_index ?? 0;
      setLiveAnsweredCount(resumeState.answered_count ?? 0);
      setCurrentQuestionIndex(index);
      currentQuestionIdRef.current = question?.question_id ?? null;

      if (resumeState.stage === 'LOBBY') {
        currentQuestionIdRef.current = null;
        setCurrentQuestionIndex(0);
        setDistribution([]);
        setStage('LOBBY');
        return;
      }

      if (resumeState.stage === 'QUESTION_ACTIVE') {
        if (!question) {
          setStage('LOBBY');
          return;
        }
        const fallbackLimit = quiz.questions[index]?.time_limit_seconds || 20;
        const endTime = Number.isFinite(question.end_time_ms)
          ? question.end_time_ms
          : Date.now() + fallbackLimit * 1000;
        setTimeRemainingSeconds(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
        setStage('QUESTION_ACTIVE');
        startCountdown(endTime);
        return;
      }

      if (resumeState.stage === 'QUESTION_RESULTS') {
        setStage('QUESTION_RESULTS');
        try {
          const { res, data } = await apiJson<{
            questions?: Array<{ id?: string; question_id?: string; question_index?: number; distribution?: any[] }>;
            leaderboard?: LeaderboardEntry[];
          }>(`/live-activities/${activityId}/quiz/results`);

          if (!cancelled && res.ok && data) {
            const questions = data.questions || [];
            const match =
              questions.find(
                (item) =>
                  (question?.question_id && (item.question_id === question.question_id || item.id === question.question_id)) ||
                  item.question_index === index
              ) || questions[index];
            setDistribution(match?.distribution || []);
            setLeaderboard(data.leaderboard || resumeState.leaderboard || []);
          } else if (!cancelled) {
            setLeaderboard(resumeState.leaderboard || []);
          }
        } catch {
          if (!cancelled) setLeaderboard(resumeState.leaderboard || []);
        }
        return;
      }

      // FINAL_LEADERBOARD
      setStage('FINAL_LEADERBOARD');
      if (resumeState.leaderboard && resumeState.leaderboard.length > 0) {
        setLeaderboard(resumeState.leaderboard);
        return;
      }
      try {
        const { res, data } = await apiJson<{
          leaderboard?: LeaderboardEntry[];
          finalLeaderboard?: LeaderboardEntry[];
        }>(`/live-activities/${activityId}/quiz/leaderboard`);
        if (!cancelled && res.ok && data) {
          setLeaderboard(data.leaderboard || data.finalLeaderboard || []);
        }
      } catch {
        // Keep whatever leaderboard the resume payload provided.
      }
    };

    applyResumeState();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId, resumeState]);

  const startQuestion = async (index: number) => {
    setStartingNext(true);
    setError(null);
    setLiveAnsweredCount(0);
    try {
      const q = quiz.questions[index];
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/start-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ question_id: q.id, question_index: index }),
      });

      const data = await res.json();
      if (res.ok) {
        currentQuestionIdRef.current = q.id;
        setCurrentQuestionIndex(index);
        setStage('QUESTION_ACTIVE');
        const limit = data.timeLimitSeconds || q.time_limit_seconds || 20;
        setTimeRemainingSeconds(limit);

        // Run countdown timer against the server's authoritative window when provided.
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        const endTime = data.endTimeMs ?? Date.now() + (limit * 1000);

        timerIntervalRef.current = setInterval(() => {
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          setTimeRemainingSeconds(remaining);
          if (remaining <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          }
        }, 200);
      } else {
        setError(data.error || 'Failed to start question');
      }
    } catch {
      setError('Network error starting question');
    } finally {
      setStartingNext(false);
    }
  };

  const showQuestionResults = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setError(null);
    try {
      const q = quiz.questions[currentQuestionIndex];
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/show-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ question_id: q.id }),
      });

      const data = await res.json();
      if (res.ok) {
        setDistribution(data.distribution || []);
        setLeaderboard(data.leaderboard || []);
        setStage('QUESTION_RESULTS');
      } else {
        setError(data.error || 'Failed to show results');
      }
    } catch {
      setError('Network error revealing results');
    }
  };

  const handleNextOrFinish = () => {
    if (currentQuestionIndex + 1 < quiz.questions.length) {
      startQuestion(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.finalLeaderboard || []);
        setStage('FINAL_LEADERBOARD');
      } else {
        setError(data.error || 'Failed to finish quiz');
      }
    } catch {
      setError('Network error concluding quiz');
    } finally {
      setEnding(false);
    }
  };

  const handleEmergencyEnd = async (): Promise<boolean> => {
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any)?.error || 'Failed to end the quiz');
        return false;
      }
      onActivityEnded();
      return true;
    } catch {
      setError('Network error ending activity');
      return false;
    } finally {
      setEnding(false);
    }
  };

  const handleCloseWindow = () => {
    if (stage === 'FINAL_LEADERBOARD') {
      // The quiz already ended server-side; just close and refresh the parent's lists.
      onActivityEnded();
      onClose();
      return;
    }
    // Closing before the podium would strand an ACTIVE activity and block future launches.
    setCloseConfirmOpen(true);
  };

  const handleConfirmEndAndClose = async () => {
    const ended = await handleEmergencyEnd();
    if (ended) setCloseConfirmOpen(false);
  };

  const totalTimeLimit = currentQuestion?.time_limit_seconds || 20;
  const progressPercent = Math.max(0, Math.min(100, (timeRemainingSeconds / totalTimeLimit) * 100));

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="lg" fullWidth disableEscapeKeyDown>
      {/* Modal Header */}
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  {quiz.title}
                </Typography>
                <Chip
                  label="LIVE QUIZ"
                  color="error"
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                />
                <Chip
                  icon={quiz.scoring_mode === 'WIDE' ? <FlashOnIcon sx={{ fontSize: '0.9rem !important' }} /> : <SchoolIcon sx={{ fontSize: '0.9rem !important' }} />}
                  label={quiz.scoring_mode === 'WIDE' ? 'WIDE (300-1000)' : 'NARROW (700-1000)'}
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', bgcolor: m3Tokens.color.primaryContainer }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Question <strong>{currentQuestionIndex + 1} of {quiz.questions.length}</strong> &bull; Activity ID: {activityId.slice(0, 8)}...
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {stage === 'QUESTION_ACTIVE' && (
              <Chip
                icon={<TimerIcon sx={{ fontSize: '1rem !important' }} />}
                label={`${timeRemainingSeconds}s Remaining`}
                color={timeRemainingSeconds <= 5 ? 'error' : 'primary'}
                sx={{ fontWeight: 800, fontSize: '0.85rem' }}
              />
            )}
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={ending ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
              onClick={handleEmergencyEnd}
              disabled={ending}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
            >
              {ending ? 'Ending...' : 'End Quiz'}
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background, minHeight: 440 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {/* STAGE 1: LOBBY */}
        {stage === 'LOBBY' && (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: '16px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
              textAlign: 'center',
              maxWidth: 600,
              mx: 'auto',
              my: 3,
            }}
          >
            <QuizIcon sx={{ fontSize: 64, color: m3Tokens.color.primary, mb: 1.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, mb: 1 }}>
              Ready to Start Live Quiz?
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 3 }}>
              This quiz has <strong>{quiz.questions.length} questions</strong>. Students in the classroom will receive questions simultaneously with server-synchronized countdown timers.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => startQuestion(0)}
              disabled={startingNext}
              sx={{ fontWeight: 800, textTransform: 'none', px: 4, py: 1.25, borderRadius: '10px', fontSize: '1rem' }}
            >
              {startingNext ? 'Starting...' : 'Start Question 1'}
            </Button>
          </Paper>
        )}

        {/* STAGE 2: QUESTION ACTIVE */}
        {stage === 'QUESTION_ACTIVE' && (
          <Stack spacing={2.5}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              color={timeRemainingSeconds <= 5 ? 'error' : 'primary'}
              sx={{ height: 8, borderRadius: 4 }}
            />

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Chip
                  label={`Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`}
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
                <Chip
                  label={`${liveAnsweredCount} Student Answers Received`}
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 3 }}>
                {currentQuestion.question_text}
              </Typography>

              <Grid container spacing={2}>
                {currentQuestion.options?.map((opt, idx) => (
                  <Grid item xs={12} sm={6} key={opt.id || idx}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        border: `1px solid ${m3Tokens.color.outlineVariant}`,
                        bgcolor: m3Tokens.color.background,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: m3Tokens.color.primary,
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                        }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </Avatar>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                        {opt.text}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<VisibilityIcon />}
                  onClick={showQuestionResults}
                  sx={{ fontWeight: 800, textTransform: 'none', borderRadius: '8px', px: 3 }}
                >
                  Reveal Results & Leaderboard
                </Button>
              </Box>
            </Paper>
          </Stack>
        )}

        {/* STAGE 3: QUESTION RESULTS & DISTRIBUTION */}
        {stage === 'QUESTION_RESULTS' && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            {/* Left: Distribution BarChart */}
            <Box sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  height: '100%',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1 }}>
                  Question {currentQuestionIndex + 1} Answer Distribution
                </Typography>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 2 }}>
                  Correct Answer:{' '}
                  <strong>
                    {currentQuestion?.correct_option_id
                      ? `Option ${currentQuestion.correct_option_id.toUpperCase()}`
                      : 'Revealed from result data'}
                  </strong>
                </Typography>

                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quizDistributionData} margin={{ top: 15, right: 20, left: -15, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                      <XAxis
                        dataKey="displayLabel"
                        stroke={chartTokens.axis}
                        tick={{ fill: chartTokens.axis, fontSize: 13, fontWeight: 700 }}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke={chartTokens.axis}
                        tick={{ fill: chartTokens.axis, fontSize: 12 }}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const pct = totalQuizQuestionVotes > 0 ? Math.round(((data.count || 0) / totalQuizQuestionVotes) * 100) : 0;
                            return (
                              <Box
                                sx={{
                                  bgcolor: chartTokens.tooltipBg,
                                  border: `1px solid ${chartTokens.tooltipBorder}`,
                                  borderRadius: '8px',
                                  p: 1.5,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  maxWidth: 320,
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: data.is_correct ? chartTokens.success : chartTokens.primary }}>
                                    {data.displayLabel}
                                  </Typography>
                                  {data.is_correct && (
                                    <Chip label="Correct" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#E6F4EA', color: chartTokens.success }} />
                                  )}
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                                  {data.option_text}
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                                  {data.count} {data.count === 1 ? 'student' : 'students'} ({pct}%)
                                </Typography>
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {quizDistributionData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.is_correct ? chartTokens.success : chartTokens.primary}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                {/* Question Options Breakdown */}
                <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: m3Tokens.color.onSurfaceVariant,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      mb: 1.5,
                      display: 'block',
                    }}
                  >
                    Options Breakdown
                  </Typography>
                  <Stack spacing={1}>
                    {quizDistributionData.map((item) => {
                      const pct = totalQuizQuestionVotes > 0 ? Math.round(((item.count || 0) / totalQuizQuestionVotes) * 100) : 0;
                      return (
                        <Box
                          key={item.option_id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.25,
                            borderRadius: '10px',
                            bgcolor: item.is_correct ? '#E6F4EA' : '#F8F9FA',
                            border: `1px solid ${item.is_correct ? '#CEEAD6' : m3Tokens.color.outlineVariant}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 1, minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                bgcolor: item.is_correct ? chartTokens.success : chartTokens.primary,
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              {item.shortCode}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: m3Tokens.color.onSurface,
                                  fontWeight: item.is_correct ? 700 : 500,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {item.option_text}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                            {item.is_correct && (
                              <Chip
                                size="small"
                                label="Correct"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                  bgcolor: '#CEEAD6',
                                  color: '#0D652D',
                                  borderRadius: '6px',
                                }}
                              />
                            )}
                            <Chip
                              size="small"
                              label={`${item.count} (${pct}%)`}
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                bgcolor: item.count > 0 ? '#E8F0FE' : '#F1F3F4',
                                color: item.count > 0 ? '#1967D2' : '#5F6368',
                                borderRadius: '6px',
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>

                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<NavigateNextIcon />}
                    onClick={handleNextOrFinish}
                    disabled={startingNext || ending}
                    sx={{ fontWeight: 800, textTransform: 'none', borderRadius: '8px', px: 3 }}
                  >
                    {currentQuestionIndex + 1 < quiz.questions.length
                      ? `Next: Question ${currentQuestionIndex + 2}`
                      : 'Finish Quiz & View Final Podium'}
                  </Button>
                </Box>
              </Paper>
            </Box>

            {/* Right: Live Cumulative Leaderboard */}
            <Box sx={{ width: { xs: '100%', lg: 380 } }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <LeaderboardIcon sx={{ color: m3Tokens.color.primary }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Live Leaderboard
                  </Typography>
                </Stack>

                {leaderboard.length === 0 ? (
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', py: 4 }}>
                    No answers recorded for this question yet.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>RANK</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem' }}>STUDENT</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>SCORE</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaderboard.slice(0, 6).map((entry) => (
                        <TableRow key={entry.student_id}>
                          <TableCell sx={{ fontWeight: 800 }}>
                            {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : `#${entry.rank}`}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {entry.student_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.7rem' }}>
                              {entry.correct_count} correct &bull; {entry.avg_response_time_ms}ms avg
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${entry.total_score} pts`}
                              size="small"
                              color="primary"
                              sx={{ fontWeight: 800, height: 22, fontSize: '0.72rem' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>
          </Stack>
        )}

        {/* STAGE 4: FINAL PODIUM & LEADERBOARD */}
        {stage === 'FINAL_LEADERBOARD' && (
          <Stack spacing={3}>
            {/* Podium Cards */}
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <EmojiEventsIcon sx={{ fontSize: 48, color: '#FFD700', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                Quiz Finished — Final Podium!
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Cumulative results calculated with {quiz.scoring_mode} scoring formula.
              </Typography>
              <Button
                variant="contained"
                startIcon={<LeaderboardIcon />}
                onClick={() => setDetailedResultsOpen(true)}
                sx={{ mt: 2, textTransform: 'none', fontWeight: 800, borderRadius: '8px', px: 3 }}
              >
                View Detailed Results
              </Button>
            </Box>

            <Grid container spacing={2} justifyContent="center">
              {leaderboard.slice(0, 3).map((podium, idx) => (
                <Grid item xs={12} sm={4} key={podium.student_id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: '16px',
                      border: `2px solid ${idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32'}`,
                      bgcolor: '#FFFFFF',
                      textAlign: 'center',
                      transform: idx === 0 ? 'scale(1.05)' : 'none',
                    }}
                  >
                    <Typography variant="h3" sx={{ mb: 1 }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                      {podium.student_name}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.primary, my: 1 }}>
                      {podium.total_score} pts
                    </Typography>
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block' }}>
                      {podium.correct_count} of {quiz.questions.length} Correct &bull; {podium.avg_response_time_ms}ms avg
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Complete Ranked Leaderboard Table */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                Full Classroom Standings ({leaderboard.length} Participants)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>RANK</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>STUDENT</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>ACCURACY</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>AVG RESPONSE TIME</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>TOTAL SCORE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboard.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell sx={{ fontWeight: 800 }}>#{row.rank}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {row.student_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {row.student_email}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.correct_count} / ${quiz.questions.length}`}
                          size="small"
                          color={row.correct_count === quiz.questions.length ? 'success' : 'default'}
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{row.avg_response_time_ms} ms</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: m3Tokens.color.primary }}>
                          {row.total_score} pts
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Button
          onClick={handleCloseWindow}
          disabled={ending}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Close Window
        </Button>
      </DialogActions>

      {/* Confirm ending an in-progress quiz before closing */}
      <Dialog open={closeConfirmOpen} onClose={() => !ending && setCloseConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>End this quiz?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            This quiz is still live. Closing the window without ending it leaves the session locked and blocks new
            quiz launches. End the quiz now and preserve its results?
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCloseConfirmOpen(false)} disabled={ending} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmEndAndClose}
            disabled={ending}
            startIcon={ending ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {ending ? 'Ending...' : 'End Quiz & Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Durable detailed results for this run */}
      <QuizResultsDialog
        open={detailedResultsOpen}
        onClose={() => setDetailedResultsOpen(false)}
        activityId={activityId}
        title={quiz.title}
      />
    </Dialog>
  );
};
