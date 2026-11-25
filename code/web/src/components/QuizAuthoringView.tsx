'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import QuizIcon from '@mui/icons-material/Quiz';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { CreateQuizDialog } from './CreateQuizDialog';
import { LiveQuizModal, QuizInfo, QuizResumeState } from './LiveQuizModal';
import { QuizResultsDialog } from './QuizResultsDialog';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';
import { apiJson } from '@/lib/api';

interface QuizAuthoringViewProps {
  classroomId: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  order_index: number;
  time_limit_seconds: number;
}

export interface Quiz {
  id: string;
  classroom_id: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  scoring_mode: 'WIDE' | 'NARROW';
  question_count: number;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizPastRun {
  id: string;
  activity_type: 'PULSEMETER' | 'QUIZ';
  status: 'ACTIVE' | 'ENDED';
  started_at: string;
  ended_at?: string | null;
  title: string;
  type?: string | null;
  scoring_mode?: 'WIDE' | 'NARROW' | string | null;
  question_count?: number;
  response_count?: number;
  participant_count?: number;
  present_count?: number;
  blocked_count?: number;
  avg_score?: number | null;
}

interface ActiveQuizActivity {
  id: string;
  activity_type?: 'PULSEMETER' | 'QUIZ';
  activity_ref_id?: string;
  quiz_id?: string;
  title?: string;
  started_at?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const QuizAuthoringView: React.FC<QuizAuthoringViewProps> = ({ classroomId }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Library / Past Runs tabs
  const [viewTab, setViewTab] = useState(0);
  const [pastRuns, setPastRuns] = useState<QuizPastRun[]>([]);
  const [loadingPastRuns, setLoadingPastRuns] = useState(false);

  // Historical results dialog
  const [resultsActivity, setResultsActivity] = useState<QuizPastRun | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  // Live Quiz Modal State
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [activeActivityModalOpen, setActiveActivityModalOpen] = useState(false);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizInfo | null>(null);
  const [resumeState, setResumeState] = useState<QuizResumeState | null>(null);

  // Stranded ACTIVE quiz recovery
  const [activeQuizActivity, setActiveQuizActivity] = useState<ActiveQuizActivity | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [endingActive, setEndingActive] = useState(false);

  // Delete Quiz State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (classroomId) {
      fetchQuizzes();
      fetchPastRuns();
      checkActiveQuiz();
    }
  }, [classroomId]);

  const handleDeleteQuiz = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchQuizzes();
      } else if (res.status === 409) {
        // The quiz has live-run history and must be kept for analytics.
        setDeleteConfirmId(null);
        setError(
          (data as any)?.error ||
            'This quiz has live-run history and cannot be deleted. Its past results must be preserved.'
        );
      } else {
        setError((data as any)?.error || 'Failed to delete Quiz');
      }
    } catch {
      setError('Network error deleting Quiz');
    } finally {
      setDeleting(false);
    }
  };

  const handleLaunchQuiz = async (quiz: Quiz) => {
    setLaunchingId(quiz.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${quiz.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      const data = await res.json();
      if (res.ok && data.activity) {
        setResumeState(null);
        setActiveActivityId(data.activity.id);
        setActiveQuiz({
          id: quiz.id,
          title: quiz.title,
          scoring_mode: quiz.scoring_mode,
          question_count: quiz.questions?.length || quiz.question_count || 0,
          questions: quiz.questions || [],
        });
        setActiveActivityModalOpen(true);
      } else {
        setError(data.error || 'Failed to launch live quiz');
      }
    } catch {
      setError('Network error launching quiz');
    } finally {
      setLaunchingId(null);
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes?classroom_id=${classroomId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setQuizzes(data.quizzes || []);
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch {
      setError('Network error fetching quizzes');
    } finally {
      setLoading(false);
    }
  };

  const fetchPastRuns = async () => {
    if (!classroomId) return;
    setLoadingPastRuns(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/live-activities?classroom_id=${classroomId}&activity_type=QUIZ&status=ENDED&limit=50`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPastRuns((data as any)?.activities || []);
      } else {
        setError((data as any)?.error || 'Failed to fetch past quiz runs');
      }
    } catch {
      setError('Network error fetching past quiz runs');
    } finally {
      setLoadingPastRuns(false);
    }
  };

  const checkActiveQuiz = async () => {
    if (!classroomId) return;
    setCheckingActive(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/live-activities/active?classroom_id=${classroomId}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const activity = (data as any)?.active ? (data as any)?.activity : null;
        if (activity && (!activity.activity_type || activity.activity_type === 'QUIZ')) {
          setActiveQuizActivity(activity);
        } else {
          setActiveQuizActivity(null);
        }
      } else {
        setError((data as any)?.error || 'Failed to check for an active quiz session');
      }
    } catch {
      setError('Network error checking for an active quiz session');
    } finally {
      setCheckingActive(false);
    }
  };

  const handleOpenResults = (run: QuizPastRun) => {
    setResultsActivity(run);
    setResultsOpen(true);
  };

  const activeQuizDefinition = activeQuizActivity
    ? quizzes.find(
        (quiz) => quiz.id === (activeQuizActivity.activity_ref_id || activeQuizActivity.quiz_id)
      )
    : undefined;

  const handleResumeActiveQuiz = async () => {
    if (!activeQuizActivity) return;
    const found = activeQuizDefinition;
    if (!found) {
      setError(
        'Could not find the quiz definition for the live session. End the live activity to unblock new launches.'
      );
      return;
    }

    setCheckingActive(true);
    setError(null);
    try {
      // Ask the server where the quiz actually is before showing the projector.
      const { res, data } = await apiJson<QuizResumeState & { error?: string }>(
        `/live-activities/${activeQuizActivity.id}/quiz/state`
      );
      if (!res.ok || !data || !data.stage) {
        setError(data?.error || 'Failed to load the live quiz state');
        return;
      }

      setActiveActivityId(activeQuizActivity.id);
      setActiveQuiz({
        id: found.id,
        title: found.title,
        scoring_mode: found.scoring_mode,
        question_count: found.questions?.length || found.question_count || 0,
        questions: found.questions || [],
      });
      setResumeState(data);
      setActiveActivityModalOpen(true);
    } catch {
      setError('Network error loading the live quiz state');
    } finally {
      setCheckingActive(false);
    }
  };

  const handleEndActiveQuiz = async () => {
    if (!activeQuizActivity) return;
    setEndingActive(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activeQuizActivity.id}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActiveQuizActivity(null);
        await Promise.all([fetchQuizzes(), fetchPastRuns()]);
      } else {
        setError((data as any)?.error || 'Failed to end the active quiz session');
      }
    } catch {
      setError('Network error ending the active quiz session');
    } finally {
      setEndingActive(false);
    }
  };

  const renderScoringModeChip = (mode: 'WIDE' | 'NARROW') => {
    if (mode === 'WIDE') {
      return (
        <Chip
          icon={<FlashOnIcon sx={{ fontSize: '1rem !important' }} />}
          label="WIDE (300–1000 pts)"
          size="small"
          sx={{
            bgcolor: m3Tokens.color.primaryContainer,
            color: m3Tokens.color.onPrimaryContainer,
            fontWeight: 800,
            fontSize: '0.72rem',
          }}
        />
      );
    }
    return (
      <Chip
        icon={<SchoolIcon sx={{ fontSize: '1rem !important' }} />}
        label="NARROW (700–1000 pts)"
        size="small"
        sx={{
          bgcolor: m3Tokens.color.secondaryContainer,
          color: m3Tokens.color.onSecondaryContainer,
          fontWeight: 800,
          fontSize: '0.72rem',
        }}
      />
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              Live Quizzes
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Author reusable multi-question quizzes with WIDE (speed) or NARROW (accuracy) scoring formulas.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            Create Quiz
          </Button>
          <IconButton
            size="small"
            onClick={() => {
              fetchQuizzes();
              fetchPastRuns();
              checkActiveQuiz();
            }}
            title="Refresh Quizzes"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {activeQuizActivity && !activeActivityModalOpen && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3, borderRadius: '8px', alignItems: 'center' }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={handleResumeActiveQuiz}
                disabled={checkingActive}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Resume
              </Button>
              <Button
                color="error"
                size="small"
                variant="contained"
                startIcon={endingActive ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
                onClick={handleEndActiveQuiz}
                disabled={endingActive}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {endingActive ? 'Ending...' : 'End it'}
              </Button>
            </Stack>
          }
        >
          <strong>A quiz session is still live</strong> — &quot;
          {activeQuizActivity.title || activeQuizDefinition?.title || 'Untitled quiz'}&quot; is blocking new
          launches. Resume it or end it.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, mb: 3 }}>
        <Tabs value={viewTab} onChange={(_, val) => setViewTab(val)}>
          <Tab label={`Library (${quizzes.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label={`Past Runs (${pastRuns.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
      </Box>

      {viewTab === 0 && (loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
            Loading authored quizzes...
          </Typography>
        </Box>
      ) : quizzes.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            bgcolor: '#FFFFFF',
          }}
        >
          <QuizIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
            No Quizzes Authored Yet
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
            Live Quizzes feature synchronized countdown questions, time-weighted scoring formulas, and real-time leaderboards.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Create Your First Quiz
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {quizzes.map((quiz) => {
            const totalSeconds = quiz.questions?.reduce((acc, q) => acc + (q.time_limit_seconds || 20), 0) || 0;
            return (
              <Grid item xs={12} md={6} key={quiz.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '12px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease',
                    '&:hover': {
                      borderColor: m3Tokens.color.primary,
                    },
                  }}
                >
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                      {renderScoringModeChip(quiz.scoring_mode)}
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        {new Date(quiz.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </Stack>

                    <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 1, fontSize: '1.05rem' }}>
                      {quiz.title}
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Chip
                        icon={<QuizIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={`${quiz.question_count || quiz.questions?.length || 0} Questions`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                      />
                      <Chip
                        icon={<TimerIcon sx={{ fontSize: '0.9rem !important' }} />}
                        label={`~${totalSeconds}s Total Time`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                      />
                    </Stack>

                    {/* Questions Accordion Preview */}
                    {quiz.questions && quiz.questions.length > 0 && (
                      <Accordion
                        elevation={0}
                        sx={{
                          border: `1px solid ${m3Tokens.color.surfaceVariant}`,
                          borderRadius: '8px !important',
                          '&:before': { display: 'none' },
                          mb: 2,
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary }}>
                            VIEW QUESTIONS ({quiz.questions.length})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
                          <Stack spacing={1.5}>
                            {quiz.questions.map((q, qIdx) => (
                              <Box key={q.id || qIdx} sx={{ p: 1.25, borderRadius: '6px', bgcolor: m3Tokens.color.background }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary }}>
                                    Q{qIdx + 1} ({q.time_limit_seconds}s)
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>
                                  {q.question_text}
                                </Typography>
                                <Stack spacing={0.5}>
                                  {q.options?.map((opt, optIdx) => {
                                    const isCorrect = q.correct_option_id === opt.id;
                                    return (
                                      <Stack direction="row" spacing={0.75} key={opt.id} alignItems="center">
                                        {isCorrect ? (
                                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                        ) : (
                                          <Box sx={{ width: 14, textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary' }}>
                                            &bull;
                                          </Box>
                                        )}
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: isCorrect ? 800 : 500,
                                            color: isCorrect ? 'success.dark' : m3Tokens.color.onSurfaceVariant,
                                          }}
                                        >
                                          {String.fromCharCode(65 + optIdx)}. {opt.text}
                                        </Typography>
                                      </Stack>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Box>

                  <Box sx={{ pt: 1.5, borderTop: `1px solid ${m3Tokens.color.surfaceVariant}` }}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={launchingId === quiz.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                        onClick={() => handleLaunchQuiz(quiz)}
                        disabled={launchingId !== null}
                        fullWidth
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                      >
                        {launchingId === quiz.id ? 'Launching...' : 'Launch Live Quiz Session'}
                      </Button>
                      <Tooltip title="Delete Quiz">
                        <IconButton
                          color="error"
                          onClick={() => setDeleteConfirmId(quiz.id)}
                          sx={{
                            border: `1px solid ${m3Tokens.color.outlineVariant}`,
                            borderRadius: '8px',
                            p: 1,
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      ))}

      {viewTab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                Past Quiz Runs
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Ended live sessions keep full per-question and per-student analytics.
              </Typography>
            </Box>
            <IconButton size="small" onClick={fetchPastRuns} title="Refresh past runs">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>

          {loadingPastRuns ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
                Loading past runs...
              </Typography>
            </Box>
          ) : pastRuns.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: 'center',
                borderRadius: '12px',
                border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <HistoryIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                No quiz runs yet
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
                No quiz runs yet — launch one from the Library.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => setViewTab(0)}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Go to Library
              </Button>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                borderRadius: '12px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                overflow: 'hidden',
                bgcolor: '#FFFFFF',
              }}
            >
              <Table>
                <TableHead sx={{ bgcolor: '#F8F9FA' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      DATE / TIME
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      TITLE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      SCORING MODE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      PARTICIPANTS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      AVG SCORE
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      RESULTS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pastRuns.map((run) => (
                    <TableRow key={run.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          {run.started_at
                            ? new Date(run.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                            : '--'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {run.started_at
                            ? new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          {run.title || 'Untitled Quiz'}
                        </Typography>
                        {!!run.question_count && (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            {run.question_count} questions
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.scoring_mode === 'WIDE' || run.scoring_mode === 'NARROW' ? (
                          renderScoringModeChip(run.scoring_mode)
                        ) : (
                          <Chip label={run.scoring_mode || '--'} size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface }}>
                          {run.participant_count ?? 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.primary }}>
                          {run.avg_score === null || run.avg_score === undefined
                            ? '--'
                            : Number(run.avg_score).toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => handleOpenResults(run)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          View Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onClose={() => !deleting && setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Quiz?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Are you sure you want to delete this live quiz and all of its questions? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteConfirmId && handleDeleteQuiz(deleteConfirmId)}
            variant="contained"
            color="error"
            disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <CreateQuizDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        classroomId={classroomId}
        onSuccess={fetchQuizzes}
      />

      {/* Live Quiz Modal */}
      {activeActivityId && activeQuiz && (
        <LiveQuizModal
          open={activeActivityModalOpen}
          activityId={activeActivityId}
          classroomId={classroomId}
          quiz={activeQuiz}
          resumeState={resumeState}
          onClose={() => setActiveActivityModalOpen(false)}
          onActivityEnded={() => {
            setActiveActivityModalOpen(false);
            setActiveActivityId(null);
            setActiveQuiz(null);
            setResumeState(null);
            setActiveQuizActivity(null);
            fetchQuizzes();
            fetchPastRuns();
          }}
        />
      )}

      {/* Historical Results Dialog (Past Runs) */}
      <QuizResultsDialog
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        activityId={resultsActivity?.id || null}
        title={resultsActivity?.title}
      />
    </Box>
  );
};
