'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { useRequireRole } from '@/hooks/useRequireRole';
import { usePolling } from '@/hooks/usePolling';
import { getActiveActivity, getClassrooms } from '@/lib/studentApi';
import type { ActiveActivity, Classroom } from '@/lib/studentTypes';
import { formatPercent } from '@/lib/attendanceFormat';
import { m3Tokens } from '@/theme/tokens';

export default function ClassroomDetailPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const params = useParams<{ id: string }>();
  const classroomId = params.id;
  const router = useRouter();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await getClassrooms();
        if (cancelled) return;
        const match = list.find((item) => item.id === classroomId) ?? null;
        setClassroom(match);
        if (!match) {
          setError('You are not enrolled in this classroom, or it no longer exists.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load the classroom'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classroomId, user]);

  const checkActive = useCallback(async () => {
    if (!classroomId) return;
    try {
      const data = await getActiveActivity(classroomId);
      setActivity(data.active ? data.activity : null);
    } catch {
      setActivity(null);
    }
  }, [classroomId]);

  usePolling(checkActive, 4000, !!classroom && !!user);

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!classroom) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Classroom unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error || 'This classroom could not be loaded.'}
        </Typography>
        <Button component={Link} href="/student" variant="contained">
          Back to classrooms
        </Button>
      </Box>
    );
  }

  const pulse = activity?.activity_type === 'PULSEMETER' ? activity : null;
  const quiz = activity?.activity_type === 'QUIZ' ? activity : null;

  return (
    <Box>
      <Button
        component={Link}
        href="/student"
        size="small"
        sx={{ mb: 1, textTransform: 'none', fontWeight: 700 }}
      >
        ← All classrooms
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        {classroom.course_code}: {classroom.course_name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {classroom.section_name} · {classroom.teacher_name}
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 800,
            minHeight: 40,
            fontSize: '0.82rem',
          },
        }}
      >
        <Tab label="Overview" />
        <Tab label="PulseMeter" />
        <Tab label="Quizzes" />
        <Tab label="Forum" />
      </Tabs>

      {tab === 0 && (
        <Stack spacing={1.5}>
          <Card
            sx={{
              borderRadius: m3Tokens.shape.large,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              boxShadow: 'none',
            }}
          >
            <CardContent sx={{ p: 2.25 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.primary, lineHeight: 1 }}>
                    {formatPercent(classroom.attendance_avg_rate)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Attendance
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Stack spacing={0.25}>
                  <Typography variant="body2" color="text.secondary">
                    {classroom.student_count} students enrolled
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {classroom.pulsemeter_count ?? 0} PulseMeters ·{' '}
                    {classroom.quiz_count ?? 0} quizzes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {classroom.open_doubts_count ?? 0} open doubts
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Button
            component={Link}
            href="/student/scan"
            variant="contained"
            size="large"
            startIcon={<QrCodeScannerIcon />}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Scan attendance QR
          </Button>
          <Button
            component={Link}
            href="/student/attendance"
            variant="outlined"
            size="large"
            startIcon={<EventAvailableIcon />}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            View attendance history
          </Button>
        </Stack>
      )}

      {tab === 1 && (
        <Card sx={{ borderRadius: 3, border: `1px solid ${m3Tokens.color.outlineVariant}`, boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>
              PulseMeter
            </Typography>
            {pulse ? (
              <>
                <Chip label="LIVE NOW" size="small" color="error" sx={{ fontWeight: 900, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {pulse.pulsemeter?.title || 'Live PulseMeter'}
                </Typography>
                <Button
                  component={Link}
                  href={`/student/pulse/${pulse.id}?classroom=${classroomId}`}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  sx={{ mt: 2, fontWeight: 800, textTransform: 'none' }}
                >
                  Join now
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No live PulseMeter for this section right now.
                </Typography>
                <Button
                  component={Link}
                  href={`/student/pulse?classroom=${classroomId}`}
                  variant="outlined"
                  sx={{ fontWeight: 800, textTransform: 'none' }}
                >
                  Open PulseMeter
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ borderRadius: 3, border: `1px solid ${m3Tokens.color.outlineVariant}`, boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>
              Quizzes
            </Typography>
            {quiz ? (
              <>
                <Chip label="LIVE NOW" size="small" color="error" sx={{ fontWeight: 900, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {quiz.quiz?.title || 'Live Quiz'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {quiz.quiz?.question_count ?? 0} questions
                </Typography>
                <Button
                  component={Link}
                  href={`/student/quizzes/${quiz.id}?classroom=${classroomId}`}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  sx={{ mt: 2, fontWeight: 800, textTransform: 'none' }}
                >
                  Join now
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No live quiz for this section right now.
                </Typography>
                <Button
                  component={Link}
                  href={`/student/quizzes?classroom=${classroomId}`}
                  variant="outlined"
                  sx={{ fontWeight: 800, textTransform: 'none' }}
                >
                  Open Quizzes
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card sx={{ borderRadius: 3, border: `1px solid ${m3Tokens.color.outlineVariant}`, boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>
              Doubt forum
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {classroom.open_doubts_count ?? 0} open doubts in this classroom
              and its course.
            </Typography>
            <Stack direction="row" spacing={1.25}>
              <Button
                component={Link}
                href={`/student/doubts?classroom=${classroomId}`}
                variant="contained"
                startIcon={<ForumOutlinedIcon />}
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Open forum
              </Button>
              <Button
                component={Link}
                href={`/student/doubts/new?course_id=${encodeURIComponent(
                  classroom.course_id
                )}&classroom_id=${encodeURIComponent(classroomId)}`}
                variant="outlined"
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Ask a doubt
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button
          size="small"
          color="error"
          onClick={() => router.push('/student')}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Manage enrollment
        </Button>
      </Box>
    </Box>
  );
}
