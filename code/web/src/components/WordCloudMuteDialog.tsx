'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface WordCloudMuteDialogProps {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  studentId?: string;
  studentName?: string;
  defaultReason?: string;
  onSuccess?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const WordCloudMuteDialog: React.FC<WordCloudMuteDialogProps> = ({
  open,
  onClose,
  classroomId,
  studentId,
  studentName,
  defaultReason,
  onSuccess,
}) => {
  const [targetStudentId, setTargetStudentId] = useState(studentId || '');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [reason, setReason] = useState(defaultReason || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTargetStudentId(studentId ?? '');
    setReason(defaultReason ?? '');
    setError(null);
    setDurationDays(7);
  }, [open, studentId, defaultReason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId) {
      setError('Please provide a student ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/word-cloud-mutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          student_id: targetStudentId,
          duration_days: durationDays,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTargetStudentId('');
        setReason('');
        setDurationDays(7);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to mute student');
      }
    } catch {
      setError('Network error while muting student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <BlockIcon color="error" fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, fontSize: '1.1rem' }}>
              Mute Word Cloud
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 2.5, bgcolor: m3Tokens.color.background }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Muting prevents this student from submitting word-cloud entries in this classroom for the chosen duration.
            </Typography>

            {studentName ? (
              <Box sx={{ p: 1.5, bgcolor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${m3Tokens.color.outlineVariant}` }}>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontWeight: 700 }}>
                  STUDENT
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  {studentName}
                </Typography>
              </Box>
            ) : (
              <TextField
                label="Student ID"
                size="small"
                value={targetStudentId}
                onChange={(e) => setTargetStudentId(e.target.value)}
                required
                fullWidth
                disabled={loading}
              />
            )}

            {/* Severity-Duration Picker: 7, 14, 30, 90, 180 days */}
            <FormControl size="small" fullWidth>
              <InputLabel id="duration-select-label">Mute Duration</InputLabel>
              <Select
                labelId="duration-select-label"
                value={durationDays}
                label="Mute Duration"
                onChange={(e) => setDurationDays(Number(e.target.value))}
                disabled={loading}
              >
                <MenuItem value={7}>7 Days (Minor offense)</MenuItem>
                <MenuItem value={14}>14 Days (2 Weeks)</MenuItem>
                <MenuItem value={30}>30 Days (1 Month)</MenuItem>
                <MenuItem value={90}>90 Days (Semester)</MenuItem>
                <MenuItem value={180}>180 Days (Full Term)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Reason (Optional)"
              placeholder="e.g. Inappropriate word cloud submission"
              size="small"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              rows={2}
              fullWidth
              disabled={loading}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <BlockIcon />}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {loading ? 'Muting...' : `Mute for ${durationDays} Days`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
