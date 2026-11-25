'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  LinearProgress,
  Collapse,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import QuizIcon from '@mui/icons-material/Quiz';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SchoolIcon from '@mui/icons-material/School';
import PeopleIcon from '@mui/icons-material/People';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

export interface QuizResultsDialogProps {
  open: boolean;
  onClose: () => void;
  activityId: string | null;
  title?: string;
}

interface QuizResultsSession {
  id?: string;
  quiz_id?: string;
  title?: string;
  scoring_mode?: 'WIDE' | 'NARROW' | string;
  status?: string;
  started_at?: string;
  ended_at?: string | null;
  question_count?: number;
  participant_count?: number;
  total_responses?: number;
  avg_score?: number | null;
}

interface ResultOption {
  id: string;
  text: string;
}

interface DistributionRow {
  option_id?: string;
  option_text?: string;
  count?: number;
  pct?: number;
  is_correct?: boolean;
}

interface QuizQuestionResult {
  question_id: string;
  order_index?: number;
  question_text?: string;
  options?: ResultOption[];
  correct_option_id?: string | null;
  time_limit_seconds?: number;
  response_count?: number;
  correct_count?: number;
  pct_correct?: number;
  distribution?: DistributionRow[];
}

interface QuizStudentAnswer {
  question_id: string;
  selected_option_id?: string | null;
  is_correct?: boolean;
  response_time_ms?: number | null;
  score_awarded?: number | null;
  answered_at?: string | null;
}

interface QuizStudentResult {
  student_id: string;
  student_name?: string;
  student_email?: string;
  rank?: number;
  total_score?: number;
  correct_count?: number;
  answered_count?: number;
  avg_response_time_ms?: number | null;
  answers?: QuizStudentAnswer[];
}

interface QuizResultsPayload {
  session?: QuizResultsSession;
  questions?: QuizQuestionResult[];
  students?: QuizStudentResult[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const formatMs = (ms?: number | null) => {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const value = Number(ms);
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
};

const formatScore = (score?: number | null) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return '--';
  const value = Number(score);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export const QuizResultsDialog: React.FC<QuizResultsDialogProps> = ({
  open,
  onClose,
  activityId,
  title,
}) => {
  const [payload, setPayload] = useState<QuizResultsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const fetchResults = async () => {
    if (!activityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/quiz/results`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPayload(data as QuizResultsPayload);
      } else {
        setError((data as any)?.error || 'Failed to load quiz results');
      }
    } catch {
      setError('Network error loading quiz results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && activityId) {
      setPayload(null);
      setExpandedStudentId(null);
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId]);

  const session = payload?.session;
  const questions = useMemo(
    () =>
      [...(payload?.questions || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [payload]
  );
  const students = payload?.students || [];

  const questionById = useMemo(() => {
    const map = new Map<string, QuizQuestionResult>();
    questions.forEach((q) => map.set(q.question_id, q));
    return map;
  }, [questions]);

  const getOptionText = (question: QuizQuestionResult | undefined, optionId?: string | null) => {
    if (!optionId) return '—';
    const option = question?.options?.find((opt) => opt.id === optionId);
    return option?.text || optionId.toUpperCase();
  };

  const questionCount = session?.question_count ?? questions.length;
  const participantCount = session?.participant_count ?? students.length;
  const totalResponses = session?.total_responses ?? 0;
  const sessionTitle = session?.title || title || 'Quiz Results';
  const scoringMode = session?.scoring_mode;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: '#FFFFFF',
          borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
          p: 2,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1.5}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QuizIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  {sessionTitle}
                </Typography>
                <Chip
                  label="ENDED"
                  color="success"
                  size="small"
                  sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                />
                {scoringMode && (
                  <Chip
                    icon={
                      scoringMode === 'WIDE' ? (
                        <FlashOnIcon sx={{ fontSize: '0.9rem !important' }} />
                      ) : (
                        <SchoolIcon sx={{ fontSize: '0.9rem !important' }} />
                      )
                    }
                    label={scoringMode === 'WIDE' ? 'WIDE (300–1000)' : 'NARROW (700–1000)'}
                    size="small"
                    sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', bgcolor: m3Tokens.color.primaryContainer }}
                  />
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {session?.started_at
                  ? new Date(session.started_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Historical quiz run'}
                {activityId ? ` • Activity ${activityId.slice(0, 8)}...` : ''}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Tooltip title="Refresh results">
              <span>
                <IconButton size="small" onClick={fetchResults} disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ mt: 1.5, color: m3Tokens.color.onSurfaceVariant }}>
              Loading detailed quiz results...
            </Typography>
          </Box>
        ) : !payload ? (
          <Alert severity="info" sx={{ borderRadius: '8px' }}>
            No result data is available for this quiz run.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Session summary */}
            <Box>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip
                  icon={<QuizIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`${questionCount} Questions`}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  icon={<PeopleIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`${participantCount} Participants`}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`${totalResponses} Total Responses`}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  icon={<EmojiEventsIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`Avg Score ${formatScore(session?.avg_score)}`}
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
              </Stack>
            </Box>

            {totalResponses === 0 && (
              <Alert severity="info" sx={{ borderRadius: '8px' }}>
                No student responses were recorded during this run.
              </Alert>
            )}

            {/* Per-question breakdown */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                Per-Question Breakdown
              </Typography>

              {questions.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: '12px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                    No question breakdown is available for this run.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {questions.map((question, qIdx) => {
                    const responseCount = question.response_count ?? 0;
                    const correctCount = question.correct_count ?? 0;
                    const pctCorrect =
                      question.pct_correct ??
                      (responseCount > 0 ? Math.round((correctCount / responseCount) * 100) : 0);
                    const distribution =
                      question.distribution && question.distribution.length > 0
                        ? question.distribution
                        : (question.options || []).map((opt) => ({
                            option_id: opt.id,
                            option_text: opt.text,
                            count: 0,
                            pct: 0,
                            is_correct: opt.id === question.correct_option_id,
                          }));

                    return (
                      <Paper
                        key={question.question_id || qIdx}
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: '16px',
                          border: `1px solid ${m3Tokens.color.outlineVariant}`,
                          bgcolor: '#FFFFFF',
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          spacing={1}
                          sx={{ mb: 1.5 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary }}>
                              QUESTION {qIdx + 1}
                              {question.time_limit_seconds ? ` • ${question.time_limit_seconds}s` : ''}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                              {question.question_text || 'Untitled question'}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              label={`${responseCount} / ${participantCount || '--'} answered`}
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                            />
                            <Chip
                              size="small"
                              label={`${Math.round(pctCorrect)}% correct`}
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                bgcolor: pctCorrect >= 50 ? '#E6F4EA' : '#FDECEA',
                                color: pctCorrect >= 50 ? chartTokens.success : chartTokens.error,
                              }}
                            />
                          </Stack>
                        </Stack>

                        <Stack spacing={1.25}>
                          {distribution.map((row, rowIdx) => {
                            const optionId = row.option_id || `option-${rowIdx}`;
                            const isCorrect =
                              row.is_correct ?? optionId === question.correct_option_id;
                            const pct = row.pct ?? 0;
                            const count = row.count ?? 0;
                            return (
                              <Box key={optionId}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                    <Box
                                      sx={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        bgcolor: isCorrect ? chartTokens.success : m3Tokens.color.surfaceVariant,
                                        color: isCorrect ? '#FFFFFF' : m3Tokens.color.onSurfaceVariant,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: 11,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {String.fromCharCode(65 + rowIdx)}
                                    </Box>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: isCorrect ? 800 : 500,
                                        color: isCorrect ? chartTokens.success : m3Tokens.color.onSurface,
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {row.option_text || getOptionText(question, row.option_id)}
                                    </Typography>
                                    {isCorrect && (
                                      <Chip
                                        label="Correct"
                                        size="small"
                                        sx={{
                                          height: 18,
                                          fontSize: '0.62rem',
                                          fontWeight: 800,
                                          bgcolor: '#CEEAD6',
                                          color: '#0D652D',
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="caption" sx={{ fontWeight: 700, flexShrink: 0 }}>
                                    {count} ({Math.round(pct)}%)
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.max(0, Math.min(100, pct))}
                                  sx={{
                                    mt: 0.5,
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: '#F1F3F4',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: isCorrect ? chartTokens.success : chartTokens.primary,
                                    },
                                  }}
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* Per-student table */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                Student Results
              </Typography>

              {students.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: '12px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                    No student attempts are available for this run.
                  </Typography>
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
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#F8F9FA' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          RANK
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          STUDENT
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          SCORE
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          CORRECT / ANSWERED
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          AVG RESPONSE TIME
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.72rem', color: m3Tokens.color.onSurfaceVariant }}>
                          DETAILS
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {students.map((student, idx) => {
                        const rank = student.rank ?? idx + 1;
                        const answers = student.answers || [];
                        const isExpanded = expandedStudentId === student.student_id;
                        return (
                          <React.Fragment key={student.student_id || idx}>
                            <TableRow hover>
                              <TableCell sx={{ fontWeight: 800 }}>
                                {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                  <Avatar sx={{ width: 30, height: 30, fontSize: '0.8rem', bgcolor: m3Tokens.color.primary }}>
                                    {student.student_name ? student.student_name[0].toUpperCase() : '?'}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                      {student.student_name || 'Unknown student'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                                      {student.student_email || '--'}
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={`${formatScore(student.total_score)} pts`}
                                  size="small"
                                  color="primary"
                                  sx={{ fontWeight: 800, height: 22, fontSize: '0.72rem' }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {student.correct_count ?? 0} / {student.answered_count ?? answers.length}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2">
                                  {formatMs(student.avg_response_time_ms)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => setExpandedStudentId(isExpanded ? null : student.student_id)}>
                                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </IconButton>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ py: 2, px: 1 }}>
                                    {answers.length === 0 ? (
                                      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', py: 2 }}>
                                        No answers recorded for this student.
                                      </Typography>
                                    ) : (
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.7rem' }}>QUESTION</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.7rem' }}>SELECTED</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.7rem' }}>CORRECT</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>RESULT</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>SCORE</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>TIME</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {answers.map((answer, aIdx) => {
                                            const question = questionById.get(answer.question_id);
                                            return (
                                              <TableRow key={answer.question_id || aIdx}>
                                                <TableCell sx={{ fontSize: '0.78rem' }}>
                                                  <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, display: 'block' }}>
                                                    Q{(question?.order_index ?? aIdx) + 1}
                                                  </Typography>
                                                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
                                                    {question?.question_text || 'Question'}
                                                  </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem' }}>
                                                  {getOptionText(question, answer.selected_option_id)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem', fontWeight: 700, color: chartTokens.success }}>
                                                  {getOptionText(question, question?.correct_option_id)}
                                                </TableCell>
                                                <TableCell align="center">
                                                  {answer.is_correct ? (
                                                    <CheckCircleIcon sx={{ fontSize: 18, color: chartTokens.success }} />
                                                  ) : (
                                                    <CancelIcon sx={{ fontSize: 18, color: chartTokens.error }} />
                                                  )}
                                                </TableCell>
                                                <TableCell align="center">
                                                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                    {formatScore(answer.score_awarded)}
                                                  </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                  <Typography variant="caption">
                                                    {formatMs(answer.response_time_ms)}
                                                  </Typography>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
          Read-only historical results — this quiz run has ended.
        </Typography>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
