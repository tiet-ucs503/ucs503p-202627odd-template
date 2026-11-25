'use client';

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { joinClassroom } from '@/lib/studentApi';

export default function JoinClassroomDialog({
  open,
  initialCode = '',
  onClose,
  onJoined,
}: {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open) setCode(initialCode);
  }, [open, initialCode]);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('Enter the 6-character join code from your instructor.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinClassroom(trimmed);
      onJoined();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Join a classroom</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the 6-character code your instructor shared. Letters are not
          case-sensitive.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          label="Join code"
          placeholder="ABC234"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/\s/g, '').slice(0, 6))
          }
          inputProps={{
            maxLength: 6,
            style: {
              fontFamily: 'monospace',
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '6px',
              textTransform: 'uppercase',
            },
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleJoin();
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleJoin}
          disabled={loading || code.trim().length !== 6}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          {loading ? 'Joining…' : 'Join'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
