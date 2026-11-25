'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockClockIcon from '@mui/icons-material/LockClock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { useRequireRole } from '@/hooks/useRequireRole';
import { usePolling } from '@/hooks/usePolling';
import {
  getActiveActivity,
  getQuizResults,
  submitQuizAnswer,
  StudentApiError,
} from '@/lib/studentApi';
import type {
  ActiveActivity,
  QuizAnswer,
  QuizQuestion,
  QuizResults,
} from '@/lib/studentTypes';
import { m3Tokens } from '@/theme/tokens';

function optionLabel(question: QuizQuestion | null, optionId: string | null) {
  if (!optionId) return '—';
  const option = question?.options.find((item) => item.id === optionId);
  return option ? `${option.id.toUpperCase()} — ${option.text}` : optionId.toUpperCase();
}

export default function LiveQuizPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId;

  const [classroomId, setClassroomId] = useState('');
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [localClosed, setLocalClosed] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inactive, setInactive] = useState(false);
  const [inactiveMessage, setInactiveMessage] = useState(
    'This quiz is no longer active. It may have ended or been replaced.'
  );
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastQuestionKey = useRef('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setClassroomId(query.get('classroom') || '');
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const finishQuiz = useCallback(async () => {
    setFinished(true);
    setResultsLoading(true);
    setResultsError(null);
    try {
      setResults(await getQuizResults(activityId));
    } catch (err) {
      setResultsError(
        err instanceof Error ? err.message : 'Could not load your results.'
      );
    } finally {
      setResultsLoading(false);
    }
  }, [activityId]);

  const applyActivity = useCallback((next: ActiveActivity) => {
    setActivity(next);
    const serverAnswers = next.user_answers ?? next.user_response?.answered_questions ?? [];
    if (serverAnswers.length > 0) {
      setAnswers((current) => {
        const merged = { ...current };
        for (const answer of serverAnswers) {
          merged[answer.question_id] = answer;
        }
        return merged;
      });
    }
    setScore((current) =>
      Math.max(current, Number(next.score_so_far ?? next.user_response?.cumulative_score ?? 0))
    );

    const question = next.current_question;
    const key = question ? `${question.question_id}:${question.question_index}` : '';
    if (key !== lastQuestionKey.current) {
      lastQuestionKey.current = key;
      setSelected(null);
      setError(null);
      setRetryable(false);
    }
  }, []);

  const checkActive = useCallback(async () => {
    if (!classroomId || !activityId || finished || inactive) return;
    try {
      const data = await getActiveActivity(classroomId);
      if (
        data.active &&
        data.activity &&
        data.activity.id === activityId &&
        data.activity.activity_type === 'QUIZ'
      ) {
        applyActivity(data.activity);
        setError(null);
      } else {
        await finishQuiz();
      }
    } catch (err) {
      if (err instanceof StudentApiError) {
        if (err.status === 403 || err.status === 404) {
          setInactive(true);
          setInactiveMessage(err.message);
          return;
        }
      }
      setError(
        err instanceof Error ? err.message : 'Could not refresh the live quiz.'
      );
      setRetryable(true);
    } finally {
      setLoading(false);
    }
  }, [activityId, applyActivity, classroomId, finishQuiz, finished, inactive]);

  usePolling(checkActive, 2000, !!classroomId && !!user && !finished && !inactive);

  const current = activity?.current_question ?? null;
  const quiz = activity?.quiz ?? null;
  const questions = quiz?.questions ?? [];
  const currentQuestion = useMemo(() => {
    if (!current) return null;
    const byId = questions.find((question) => question.id === current.question_id);
    if (byId) return byId;
    if (
      current.question_index !== null &&
      current.question_index >= 0 &&
      current.question_index < questions.length
    ) {
      return questions[current.question_index];
    }
    return null;
  }, [current, questions]);

  const answer = current ? answers[current.question_id] : undefined;
  const selectedOptionId = selected ?? answer?.selected_option_id ?? null;
  const revealed = current?.revealed === true;
  const correctOptionId = revealed ? current?.correct_option_id ?? null : null;
  const remainingMs = current ? Math.max(0, current.end_time_ms - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const durationMs = current ? Math.max(0, current.end_time_ms - current.start_time_ms) : 0;
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0;
  const questionNumber =
    (current?.question_index ?? questions.findIndex((q) => q.id === current?.question_id)) + 1;
  const questionCount = quiz?.question_count || questions.length;
  const isOpen =
    !!current &&
    !revealed &&
    !answer &&
    !localClosed.has(current.question_id) &&
    remainingMs > 0;

  const handleSubmit = async (optionId: string) => {
    if (!current || !isOpen || submitting) return;
    const questionId = current.question_id;
    setSelected(optionId);
    setSubmitting(true);
    setError(null);
    setRetryable(false);

    try {
      const result = await submitQuizAnswer(activityId, questionId, optionId);
      setAnswers((existing) => ({
        ...existing,
        [questionId]: {
          question_id: questionId,
          selected_option_id: optionId,
          is_correct: result.is_correct === true,
          score_awarded: Number(result.score_awarded ?? 0),
        },
      }));
      setScore((existing) => existing + Number(result.score_awarded ?? 0));
      void checkActive();
    } catch (err) {
      if (err instanceof StudentApiError && (err.status === 409 || err.status === 400)) {
        setLocalClosed((existing) => new Set(existing).add(questionId));
        setError(err.message);
        setRetryable(false);
        void checkActive();
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not submit your answer.'
        );
        setRetryable(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    if (retryable && selected && isOpen) {
      void handleSubmit(selected);
      return;
    }
    void checkActive();
  };

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!classroomId) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Open this quiz from the Quizzes tab so ClassPulse knows which classroom
        it belongs to.
      </Alert>
    );
  }

  if (inactive) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <EventBusyIcon sx={{ fontSize: 52, color: m3Tokens.color.outline, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Quiz no longer active
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {inactiveMessage}
        </Typography>
        <Button component={Link} href="/student/quizzes" variant="contained">
          Back to Quizzes
        </Button>
      </Box>
    );
  }

  if (finished) {
    if (resultsLoading) {
      return (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading your results…
          </Typography>
        </Box>
      );
    }

    if (resultsError) {
      return (
        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
            Could not load results
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {resultsError}
          </Typography>
          <Button variant="contained" onClick={() => void finishQuiz()}>
            Retry
          </Button>
        </Box>
      );
    }

    if (!results) return null;
    return <QuizResultsView results={results} questions={questions} />;
  }

  if (loading) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!activity) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        This quiz could not be loaded. Return to the Quizzes tab and try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {quiz?.title || 'Live Quiz'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {score} pts so far
          </Typography>
        </Box>
        <Chip
          label={`Question ${Math.max(1, questionNumber)} of ${questionCount}`}
          size="small"
          sx={{
            fontWeight: 800,
            bgcolor: m3Tokens.color.primaryContainer,
            color: m3Tokens.color.onPrimaryContainer,
          }}
        />
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 1.5, borderRadius: 2 }}
          action={
            retryable ? (
              <Button color="inherit" size="small" onClick={retry}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}

      {!current ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 5, px: 2 }}>
          <CircularProgress sx={{ mb: 1.5 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            Waiting for the teacher to start the first question…
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This screen updates automatically.
          </Typography>
        </Card>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
            <TimerOutlinedIcon
              sx={{ fontSize: 18, color: remainingSeconds <= 5 ? 'error.main' : 'text.secondary' }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 900,
                color: remainingSeconds <= 5 ? 'error.main' : 'text.primary',
              }}
            >
              {remainingSeconds}s
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress * 100}
            color={revealed ? 'secondary' : remainingSeconds <= 5 ? 'error' : 'primary'}
            sx={{ height: 7, borderRadius: 4, mb: 2 }}
          />

          <Card
            sx={{
              borderRadius: m3Tokens.shape.large,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              boxShadow: 'none',
              mb: 2,
            }}
          >
            <CardContent sx={{ p: 2.25 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.35 }}>
                {currentQuestion?.question_text || 'Question'}
              </Typography>
            </CardContent>
          </Card>

          <Stack spacing={1.25}>
            {(currentQuestion?.options ?? []).map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrect = revealed && correctOptionId === option.id;
              const isWrong = revealed && isSelected && !isCorrect;
              const disabled = !isOpen || submitting;

              return (
                <Button
                  key={option.id}
                  onClick={() => void handleSubmit(option.id)}
                  disabled={disabled}
                  variant={isSelected ? 'contained' : 'outlined'}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    textTransform: 'none',
                    py: 1.5,
                    px: 1.75,
                    borderRadius: 2.5,
                    fontWeight: isSelected ? 800 : 600,
                    borderWidth: isSelected ? 2 : 1,
                    ...(isCorrect
                      ? {
                          bgcolor: '#E8F5E9',
                          color: '#1B5E20',
                          borderColor: '#2E7D32',
                        }
                      : {}),
                    ...(isWrong
                      ? {
                          bgcolor: '#FFEBEE',
                          color: '#B71C1C',
                          borderColor: '#C62828',
                        }
                      : {}),
                  }}
                  startIcon={
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: isSelected
                          ? 'rgba(255,255,255,0.25)'
                          : m3Tokens.color.surfaceVariant,
                        color: isSelected ? '#fff' : m3Tokens.color.onSurface,
                        fontSize: '0.78rem',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {option.id.toUpperCase()}
                    </Box>
                  }
                  endIcon={
                    submitting && isSelected ? (
                      <CircularProgress size={18} />
                    ) : isCorrect ? (
                      <CheckCircleIcon sx={{ color: '#2E7D32' }} />
                    ) : isWrong ? (
                      <CancelIcon sx={{ color: '#C62828' }} />
                    ) : undefined
                  }
                >
                  {option.text}
                </Button>
              );
            })}
          </Stack>

          {revealed && (
            <Card
              sx={{
                mt: 2,
                borderRadius: 2.5,
                bgcolor: answer?.is_correct ? '#E8F5E9' : '#FFEBEE',
                border: `1px solid ${answer?.is_correct ? '#A5D6A7' : '#FFCDD2'}`,
                boxShadow: 'none',
              }}
            >
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 900, color: answer?.is_correct ? '#1B5E20' : '#B71C1C' }}
                >
                  {!answer
                    ? 'You did not answer this question'
                    : answer.is_correct
                      ? `Correct! +${answer.score_awarded ?? 0} pts`
                      : 'Incorrect (+0 pts)'}
                </Typography>
                {correctOptionId && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Correct answer: {optionLabel(currentQuestion, correctOptionId)}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Waiting for the teacher to open the next question…
                </Typography>
              </CardContent>
            </Card>
          )}

          {!revealed && answer && (
            <Card sx={{ mt: 2, borderRadius: 2.5, bgcolor: m3Tokens.color.primaryContainer }}>
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <LockClockIcon sx={{ color: m3Tokens.color.onPrimaryContainer, mb: 0.5 }} />
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 900, color: m3Tokens.color.onPrimaryContainer }}
                >
                  Answer submitted
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: m3Tokens.color.onPrimaryContainer, display: 'block' }}
                >
                  Waiting for the teacher to reveal the correct answer…
                </Typography>
              </CardContent>
            </Card>
          )}

          {!revealed && !answer && remainingMs <= 0 && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              Time is up for this question. Waiting for the teacher…
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

function QuizResultsView({
  results,
  questions,
}: {
  results: QuizResults;
  questions: QuizQuestion[];
}) {
  const byId = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );

  return (
    <Box>
      <Card
        sx={{
          borderRadius: 3,
          border: `2px solid ${m3Tokens.color.primary}`,
          textAlign: 'center',
          boxShadow: 'none',
          mb: 2,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <EmojiEventsIcon sx={{ fontSize: 56, color: '#FFC107', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Quiz completed
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, color: m3Tokens.color.primary, mt: 0.5 }}>
            {results.score} pts
          </Typography>
          {results.rank > 0 && results.participants > 0 && (
            <Typography variant="body2" color="text.secondary">
              Ranked #{results.rank} of {results.participants} participants
            </Typography>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 2 }}>
        <Stat label="Correct" value={`${results.correct_count}/${results.total_questions}`} />
        <Stat label="Answered" value={`${results.answered_count}/${results.total_questions}`} />
        <Stat label="Rank" value={results.rank > 0 ? `#${results.rank}` : '—'} />
        <Stat
          label="Participants"
          value={results.participants > 0 ? String(results.participants) : '—'}
        />
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
        Question review
      </Typography>
      <Stack spacing={1}>
        {(results.questions ?? []).map((item) => {
          const question = byId.get(item.question_id) ?? null;
          return (
            <Card
              key={item.question_id}
              sx={{
                borderRadius: 2.5,
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                boxShadow: 'none',
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  {item.is_correct ? (
                    <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                  ) : item.selected_option_id ? (
                    <CancelIcon sx={{ color: '#C62828', fontSize: 20 }} />
                  ) : (
                    <Box sx={{ width: 20 }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {item.question_text || question?.question_text || 'Question'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Your answer: {optionLabel(question, item.selected_option_id ?? null)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Correct answer: {optionLabel(question, item.correct_option_id ?? null)}
                    </Typography>
                  </Box>
                  <Chip
                    label={`+${item.score_awarded ?? 0}`}
                    size="small"
                    sx={{
                      height: 22,
                      fontWeight: 900,
                      bgcolor: m3Tokens.color.primaryContainer,
                      color: m3Tokens.color.onPrimaryContainer,
                    }}
                  />
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Button
        component={Link}
        href="/student/quizzes"
        fullWidth
        variant="contained"
        size="large"
        sx={{ mt: 2.5, fontWeight: 800, textTransform: 'none' }}
      >
        Back to Quizzes
      </Button>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${m3Tokens.color.outlineVariant}`,
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
