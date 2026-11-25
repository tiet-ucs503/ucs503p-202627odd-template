'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AddIcon from '@mui/icons-material/Add';
import SchoolIcon from '@mui/icons-material/School';
import { useRequireRole } from '@/hooks/useRequireRole';
import {
  getClassrooms,
  leaveClassroom,
} from '@/lib/studentApi';
import type { Classroom } from '@/lib/studentTypes';
import ClassroomCard from '@/components/student/ClassroomCard';
import JoinClassroomDialog from '@/components/student/JoinClassroomDialog';
import { m3Tokens } from '@/theme/tokens';

export default function StudentHomePage() {
  const { user, loading: authLoading } = useRequireRole('student', '/student/login');
  const router = useRouter();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [leaveTarget, setLeaveTarget] = useState<Classroom | null>(null);
  const [leaving, setLeaving] = useState(false);

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClassrooms(await getClassrooms());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load classrooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadClassrooms();
  }, [user, loadClassrooms]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setJoinCode(code.trim().toUpperCase().slice(0, 6));
      setJoinOpen(true);
    }
  }, [user]);

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    try {
      await leaveClassroom(leaveTarget.id);
      setLeaveTarget(null);
      await loadClassrooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unenroll');
    } finally {
      setLeaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const firstName = user.full_name?.split(/\s+/)[0] || 'Student';

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Hi, {firstName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {classrooms.length > 0
          ? `You are enrolled in ${classrooms.length} ${
              classrooms.length === 1 ? 'classroom' : 'classrooms'
            }.`
          : 'Join a classroom with the code from your instructor.'}
      </Typography>

      <Box
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: m3Tokens.shape.large,
          background: `linear-gradient(135deg, ${m3Tokens.color.primaryContainer}, ${m3Tokens.color.secondaryContainer})`,
          color: m3Tokens.color.onPrimaryContainer,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2.5,
              bgcolor: 'rgba(255,255,255,0.65)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <QrCodeScannerIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              Live class right now?
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
              Scan the rotating 3-QR stream on the projector.
            </Typography>
          </Box>
          <Button
            component={Link}
            href="/student/scan"
            variant="contained"
            size="small"
            sx={{
              fontWeight: 800,
              textTransform: 'none',
              flexShrink: 0,
              bgcolor: m3Tokens.color.primary,
            }}
          >
            Scan
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, flex: 1 }}>
          Enrolled classrooms
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            setJoinCode('');
            setJoinOpen(true);
          }}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          Join
        </Button>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadClassrooms}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : classrooms.length === 0 ? (
        <Box
          sx={{
            py: 5,
            px: 3,
            textAlign: 'center',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            borderRadius: m3Tokens.shape.large,
            bgcolor: 'rgba(255,255,255,0.6)',
          }}
        >
          <SchoolIcon sx={{ fontSize: 44, color: m3Tokens.color.outline, mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            No classrooms yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ask your instructor for a 6-character join code.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              setJoinCode('');
              setJoinOpen(true);
            }}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Join a classroom
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {classrooms.map((classroom) => (
            <ClassroomCard
              key={classroom.id}
              classroom={classroom}
              onOpen={() => router.push(`/student/classrooms/${classroom.id}`)}
              onLeave={() => setLeaveTarget(classroom)}
            />
          ))}
        </Stack>
      )}

      <JoinClassroomDialog
        open={joinOpen}
        initialCode={joinCode}
        onClose={() => setJoinOpen(false)}
        onJoined={loadClassrooms}
      />

      <Dialog
        open={!!leaveTarget}
        onClose={leaving ? undefined : () => setLeaveTarget(null)}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Unenroll?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Leave {leaveTarget?.course_code}: {leaveTarget?.course_name} (
            {leaveTarget?.section_name})? Your past attendance records will be
            retained.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLeaveTarget(null)} disabled={leaving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleLeave}
            disabled={leaving}
            sx={{ fontWeight: 800 }}
          >
            {leaving ? 'Leaving…' : 'Unenroll'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
