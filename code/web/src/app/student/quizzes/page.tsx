'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import QuizIcon from '@mui/icons-material/Quiz';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useRequireRole } from '@/hooks/useRequireRole';
import { usePolling } from '@/hooks/usePolling';
import { getActiveActivity, getClassrooms } from '@/lib/studentApi';
import type { ActiveActivity, Classroom } from '@/lib/studentTypes';
import ClassroomSelect from '@/components/student/ClassroomSelect';
import { m3Tokens } from '@/theme/tokens';

export default function StudentQuizzesPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingClassrooms(true);
      try {
        const list = await getClassrooms();
        if (cancelled) return;
        setClassrooms(list);
        const requested = new URLSearchParams(window.location.search).get(
          'classroom'
        );
        const initial =
          requested && list.some((item) => item.id === requested)
            ? requested
            : list[0]?.id ?? '';
        setSelectedId(initial);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load classrooms'
          );
        }
      } finally {
        if (!cancelled) setLoadingClassrooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const checkActive = useCallback(async () => {
    if (!selectedId) return;
    setChecking(true);
    try {
      const data = await getActiveActivity(selectedId);
      if (data.active && data.activity?.activity_type === 'QUIZ') {
        setActivity(data.activity);
        setError(null);
      } else {
        setActivity(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check quizzes');
    } finally {
      setChecking(false);
      setLoadedOnce(true);
    }
  }, [selectedId]);

  usePolling(checkActive, 4000, !!selectedId && !!user);

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadingClassrooms) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (classrooms.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <QuizIcon sx={{ fontSize: 48, color: m3Tokens.color.outline, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          No classrooms yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Join a classroom first to participate in live quizzes.
        </Typography>
        <Button component={Link} href="/student" variant="contained">
          Join a classroom
        </Button>
      </Box>
    );
  }

  const quiz = activity?.quiz;
  const title = quiz?.title || 'Live Quiz';

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Quizzes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Live quizzes launched by your instructor appear here automatically.
      </Typography>

      <ClassroomSelect
        classrooms={classrooms}
        value={selectedId}
        onChange={(id) => {
          setSelectedId(id);
          setActivity(null);
          setError(null);
        }}
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={checkActive}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {activity && quiz ? (
        <Card
          sx={{
            borderRadius: m3Tokens.shape.large,
            border: `2px solid ${m3Tokens.color.primary}`,
            boxShadow: '0 8px 24px rgba(103, 80, 164, 0.12)',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Chip
                label="LIVE NOW"
                size="small"
                sx={{
                  bgcolor: '#FFEBEE',
                  color: '#C62828',
                  fontWeight: 900,
                  fontSize: '0.65rem',
                }}
              />
              <Chip
                label={`${quiz.question_count} questions`}
                size="small"
                sx={{
                  bgcolor: m3Tokens.color.primaryContainer,
                  color: m3Tokens.color.onPrimaryContainer,
                  fontWeight: 800,
                  fontSize: '0.65rem',
                }}
              />
            </Stack>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 1.5 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scoring mode: {quiz.scoring_mode || 'WIDE'}. Answer each question
              before its timer runs out.
            </Typography>
            <Button
              component={Link}
              href={`/student/quizzes/${activity.id}?classroom=${selectedId}`}
              fullWidth
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              sx={{ fontWeight: 800, textTransform: 'none' }}
            >
              Join Live Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            py: 5,
            px: 2,
            textAlign: 'center',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            borderRadius: m3Tokens.shape.large,
          }}
        >
          {checking && !loadedOnce ? (
            <CircularProgress />
          ) : (
            <>
              <QuizIcon sx={{ fontSize: 44, color: m3Tokens.color.outline, mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                No active quiz
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                When your instructor starts a quiz, it will appear here
                automatically.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={checkActive}
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Check again
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
