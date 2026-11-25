'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface ClassroomJoinDetailsModalProps {
  open: boolean;
  onClose: () => void;
  classroom: {
    id: string;
    course_code: string;
    course_name: string;
    section_name: string;
    join_code: string;
  } | null;
  onCodeRegenerated: (newCode: string) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const ClassroomJoinDetailsModal: React.FC<ClassroomJoinDetailsModalProps> = ({
  open,
  onClose,
  classroom,
  onCodeRegenerated,
}) => {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!classroom) return null;

  const joinLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${classroom.join_code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/classrooms/${classroom.id}/regenerate-join`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        onCodeRegenerated(data.classroom.join_code);
      } else {
        setError(data.error || 'Failed to regenerate code');
      }
    } catch {
      setError('Network error regenerating code');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
        Classroom Join Credentials
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 2 }}>
          {classroom.course_code}: {classroom.course_name} ({classroom.section_name})
        </Typography>

        {/* Big M3 Join Code Card */}
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            borderRadius: m3Tokens.shape.large,
            backgroundColor: m3Tokens.color.primaryContainer,
            color: m3Tokens.color.onPrimaryContainer,
            mb: 3,
          }}
        >
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, display: 'block', mb: 1 }}>
            6-Character Student Join Code
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '6px', fontFamily: 'monospace' }}>
            {classroom.join_code}
          </Typography>
        </Box>

        {/* Shareable Link & Actions */}
        <Stack spacing={2}>
          <Box sx={{ p: 1.5, borderRadius: m3Tokens.shape.medium, border: `1px solid ${m3Tokens.color.outlineVariant}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', fontWeight: 600, color: m3Tokens.color.onSurfaceVariant }}>
              {joinLink}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy Link'}>
              <IconButton size="small" color="primary" onClick={handleCopyLink}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRegenerateCode}
            disabled={regenerating}
            fullWidth
          >
            {regenerating ? 'Regenerating...' : 'Regenerate Code'}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
