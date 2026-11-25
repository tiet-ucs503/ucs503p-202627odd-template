'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { useRequireRole } from '@/hooks/useRequireRole';
import { usePolling } from '@/hooks/usePolling';
import { getActiveActivity, respondToPulseMeter } from '@/lib/studentApi';
import type { ActiveActivity } from '@/lib/studentTypes';
import { m3Tokens } from '@/theme/tokens';

export default function LivePulseMeterPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId;

  const [classroomId, setClassroomId] = useState('');
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [word, setWord] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setClassroomId(query.get('classroom') || '');
  }, []);

  const checkActive = useCallback(async () => {
    if (!classroomId || !activityId) return;
    try {
      const data = await getActiveActivity(classroomId);
      if (
        data.active &&
        data.activity &&
        data.activity.id === activityId &&
        data.activity.activity_type === 'PULSEMETER'
      ) {
        setActivity(data.activity);
        setEnded(false);
        setError(null);
        if (data.activity.user_response?.has_responded) {
          setSubmitted(true);
        }
      } else {
        setEnded(true);
        setActivity(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not refresh the activity'
      );
    } finally {
      setLoading(false);
    }
  }, [activityId, classroomId]);

  usePolling(checkActive, 4000, !!classroomId && !ended);

  useEffect(() => {
    if (!activity) return;
    const response = activity.user_response;
    const value = response?.response_value;

    if (activity.pulsemeter?.type === 'WORD_CLOUD' && typeof value === 'string') {
      setWord((current) => current || value);
    } else if (
      activity.pulsemeter?.type === 'MCQ' &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      setSelectedOptionId((current) => current || String(value));
    } else if (
      activity.pulsemeter?.type === 'RATING_SCALE' &&
      value !== null &&
      value !== undefined
    ) {
      setRating((current) => current ?? Number(value));
    }
  }, [activity]);

  const pulsemeter = activity?.pulsemeter;
  const type = pulsemeter?.type ?? 'WORD_CLOUD';
  const config = pulsemeter?.config ?? {};
  const options = useMemo(() => config.options ?? [], [config.options]);
  const min = config.min ?? 1;
  const max = config.max ?? 5;
  const ratingValues = useMemo(
    () => Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index),
    [min, max]
  );

  const submittedValue = submitted
    ? type === 'WORD_CLOUD'
      ? word || String(activity?.user_response?.response_value ?? '')
      : type === 'MCQ'
        ? options.find((option) => option.id === selectedOptionId)?.text ||
          selectedOptionId
        : `${rating ?? activity?.user_response?.response_value ?? ''} ★`
    : '';

  const handleSubmit = async () => {
    if (!activity) return;
    setError(null);

    let value: string | number;
    if (type === 'WORD_CLOUD') {
      const trimmed = word.trim();
      if (!trimmed) {
        setError('Please enter a word or short phrase.');
        return;
      }
      value = trimmed;
    } else if (type === 'MCQ') {
      if (!selectedOptionId) {
        setError('Please select an option.');
        return;
      }
      value = selectedOptionId;
    } else {
      if (rating === null) {
        setError('Please select a rating.');
        return;
      }
      value = rating;
    }

    setSubmitting(true);
    try {
      await respondToPulseMeter(activity.id, value);
      setSubmitted(true);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status?: number }).status === 409
      ) {
        setSubmitted(true);
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not submit your response.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!classroomId) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Open this activity from the PulseMeter tab so ClassPulse knows which
        classroom it belongs to.
      </Alert>
    );
  }

  if (ended) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <EventBusyIcon sx={{ fontSize: 52, color: m3Tokens.color.outline, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Activity ended
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This PulseMeter is no longer accepting responses.
        </Typography>
        <Button component={Link} href="/student/pulse" variant="contained">
          Back to PulseMeter
        </Button>
      </Box>
    );
  }

  if (!activity || !pulsemeter) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        This activity could not be loaded. Return to the PulseMeter tab and try
        again.
      </Alert>
    );
  }

  return (
    <Box>
      <Card
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          mb: 2,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Chip
            label={String(type).replaceAll('_', ' ')}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              fontWeight: 900,
              bgcolor: m3Tokens.color.primaryContainer,
              color: m3Tokens.color.onPrimaryContainer,
              mb: 1,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {pulsemeter.title}
          </Typography>
          {config.prompt && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {config.prompt}
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {submitted ? (
        <Card
          sx={{
            borderRadius: m3Tokens.shape.large,
            border: '1px solid #A5D6A7',
            bgcolor: '#F1F8F2',
            boxShadow: 'none',
          }}
        >
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#2E7D32', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Response recorded
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your response was submitted to your instructor.
            </Typography>
            {submittedValue && (
              <Chip
                label={`You submitted: ${submittedValue}`}
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid #A5D6A7',
                  color: '#2E7D32',
                  fontWeight: 800,
                  maxWidth: '100%',
                  '& .MuiChip-label': { whiteSpace: 'normal' },
                }}
              />
            )}
            <Button
              component={Link}
              href="/student/pulse"
              variant="outlined"
              sx={{ mt: 3, fontWeight: 800, textTransform: 'none' }}
            >
              Back to PulseMeter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          sx={{
            borderRadius: m3Tokens.shape.large,
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            boxShadow: 'none',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            {type === 'WORD_CLOUD' && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Enter a word or short phrase
                </Typography>
                <TextField
                  fullWidth
                  value={word}
                  onChange={(event) => setWord(event.target.value.slice(0, 35))}
                  placeholder="Your response"
                  inputProps={{ maxLength: 35 }}
                  helperText={`${word.length}/35`}
                />
              </>
            )}

            {type === 'MCQ' && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Select one option
                </Typography>
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {options.map((option) => {
                    const selected = selectedOptionId === option.id;
                    return (
                      <Button
                        key={option.id}
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => setSelectedOptionId(option.id)}
                        sx={{
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          textTransform: 'none',
                          py: 1.25,
                          fontWeight: selected ? 800 : 600,
                        }}
                      >
                        {option.id.toUpperCase()} — {option.text}
                      </Button>
                    );
                  })}
                </Box>
              </>
            )}

            {type === 'RATING_SCALE' && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Select your rating
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {ratingValues.map((value) => {
                    const selected = rating === value;
                    return (
                      <Button
                        key={value}
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => setRating(value)}
                        sx={{
                          width: 52,
                          height: 52,
                          minWidth: 52,
                          borderRadius: 2,
                          fontWeight: 900,
                          fontSize: '1.05rem',
                        }}
                      >
                        {value}
                      </Button>
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {min}: {config.low_label || 'Lowest'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {max}: {config.high_label || 'Highest'}
                  </Typography>
                </Box>
              </>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{ mt: 3, fontWeight: 800, textTransform: 'none' }}
            >
              {submitting ? 'Submitting…' : 'Submit response'}
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
