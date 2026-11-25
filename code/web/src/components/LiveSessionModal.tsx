'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { m3Tokens } from '@/theme/tokens';
import { getAuthToken } from '@/lib/authStorage';
import { apiFetch, readJson } from '@/lib/api';

export interface LiveSession {
  id: string;
  classroom_id: string;
  course_code: string;
  course_name: string;
  section_name: string;
  started_at: string;
}

interface Attendee {
  id: string;
  student: {
    id: string;
    full_name: string;
    email: string;
  };
  validated_at: string;
  acl_ms?: number | null;
  status: string;
}

interface QrToken {
  session_id: string;
  batch_id: string;
  seq_idx: number;
  timestamp: number;
  token_id: string;
  hash: string;
  qr_payload?: string;
}

interface TokenBatch {
  batch_id: string;
  timestamp: number;
  expires_in_seconds?: number;
  fresh_for_ms?: number;
  tokens: QrToken[];
}

interface LiveSessionModalProps {
  open: boolean;
  session: LiveSession | null;
  onClose: () => void;
  onSessionEnded: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// The backend reuses a token batch for at most 4s. Poll noticeably faster than
// that so a batch is replaced before it can age out of its 10s validity
// window, while still showing each batch long enough to scan all three frames.
const TOKEN_REFRESH_INTERVAL_MS = 1500;

// Each batch is valid for 10s on the server. Used only when the response omits
// `fresh_for_ms`, so the projector can still detect a stale batch.
const TOKEN_VALIDITY_FALLBACK_MS = 10_000;

export const LiveSessionModal: React.FC<LiveSessionModalProps> = ({
  open,
  session,
  onClose,
  onSessionEnded,
}) => {
  const [tokenBatch, setTokenBatch] = useState<TokenBatch | null>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotationSpeedMs, setRotationSpeedMs] = useState<number>(800); // 800ms (Default), 300ms (Fast), 100ms (Ultra-Fast)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  // True once the current token batch has outlived its server-reported
  // freshness window without a successful refresh.
  const [batchExpired, setBatchExpired] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rosterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const batchFreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenFetchSeqRef = useRef(0);
  const tokenFetchInFlightRef = useRef(false);

  // Stable batch identity: same-batch polls must not restart the rotation
  // timer or re-render the QR stream.
  const batchId = tokenBatch?.batch_id;
  const tokenCount = tokenBatch?.tokens?.length ?? 0;

  const clearFreshnessTimer = () => {
    if (batchFreshTimeoutRef.current) {
      clearTimeout(batchFreshTimeoutRef.current);
      batchFreshTimeoutRef.current = null;
    }
  };

  const scheduleFreshnessExpiry = (freshForMs: number) => {
    clearFreshnessTimer();
    if (!Number.isFinite(freshForMs) || freshForMs <= 0) {
      setBatchExpired(true);
      return;
    }
    setBatchExpired(false);
    batchFreshTimeoutRef.current = setTimeout(() => {
      batchFreshTimeoutRef.current = null;
      setBatchExpired(true);
    }, freshForMs);
  };

  // Live session elapsed timer
  useEffect(() => {
    if (!open || !session?.started_at) return;
    const startTime = new Date(session.started_at).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [open, session?.started_at]);

  const formatElapsed = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clear all QR state when the projector closes or the session changes so a
  // previous session's code can never flash on screen.
  useEffect(() => {
    setTokenBatch(null);
    setTokenError(null);
    setBatchExpired(false);
    setCurrentFrameIdx(0);
    clearFreshnessTimer();
  }, [open, session?.id]);

  // 1. Initialize Socket.io & Fetch Existing Roster
  useEffect(() => {
    if (!open || !session) return;

    const socket = io(API_BASE_URL, {
      auth: { token: getAuthToken() },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketError(null);
      socket.emit('join_session', session.id, (result: { ok?: boolean; error?: string } | undefined) => {
        if (!result?.ok) {
          setSocketError(result?.error || 'The server denied access to this session room. Live updates may be delayed.');
        }
      });
    });

    socket.on('connect_error', (err: Error) => {
      setSocketError(`Live updates disconnected: ${err.message}`);
    });

    socket.on('auth:error', (data: { error?: string } | undefined) => {
      setSocketError(data?.error || 'Socket authentication failed. Please sign in again.');
    });

    socket.on('attendance:marked', (data: any) => {
      setAttendees((prev) => {
        if (prev.some((a) => a.student.id === data.student.id)) return prev;
        return [
          {
            id: data.student.id,
            student: data.student,
            validated_at: data.validated_at,
            acl_ms: data.acl_ms,
            status: data.status,
          },
          ...prev,
        ];
      });
    });

    fetchRoster(session.id);
    fetchActiveTokens(session.id);

    // Poll faster than the server's 4s batch-reuse window so a displayed
    // batch is always replaced well before its 10s freshness limit expires.
    fetchIntervalRef.current = setInterval(() => {
      fetchActiveTokens(session.id);
    }, TOKEN_REFRESH_INTERVAL_MS);

    // Roster fallback poll: keeps attendance moving even if the socket drops.
    rosterIntervalRef.current = setInterval(() => {
      fetchRoster(session.id);
    }, 5000);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_session', session.id);
        socketRef.current.disconnect();
      }
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
      if (rosterIntervalRef.current) clearInterval(rosterIntervalRef.current);
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
      clearFreshnessTimer();
      // Invalidate any token request still in flight for this session.
      tokenFetchSeqRef.current += 1;
      tokenFetchInFlightRef.current = false;
    };
  }, [open, session]);

  // 2. Configurable Dynamic 3-QR frame rotation (800ms / 300ms / 100ms)
  // Keyed on the batch identity rather than the object reference so polling
  // the same cached batch does not restart the timer.
  useEffect(() => {
    if (!open || !batchId || tokenCount === 0) return;

    if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);

    rotationIntervalRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % 3);
    }, rotationSpeedMs);

    return () => {
      if (rotationIntervalRef.current) clearInterval(rotationIntervalRef.current);
    };
  }, [open, batchId, tokenCount, rotationSpeedMs]);

  // A genuinely new batch starts at frame 0 ("Frame 1 of 3").
  useEffect(() => {
    setCurrentFrameIdx(0);
  }, [batchId]);

  const fetchRoster = async (sessionId: string) => {
    try {
      const res = await apiFetch(`/attendance/session/${sessionId}`);
      const data = await readJson<{ attendance?: any[] }>(res);
      if (res.ok && data?.attendance) {
        const mapped: Attendee[] = data.attendance.map((ar: any) => ({
          id: ar.id,
          student: {
            id: ar.student_id,
            full_name: ar.full_name,
            email: ar.email,
          },
          validated_at: ar.validated_at,
          acl_ms: ar.acl_ms,
          status: ar.status,
        }));
        setAttendees(mapped);
      }
    } catch (err) {
      console.error('Error fetching session roster:', err);
    }
  };

  const fetchActiveTokens = async (sessionId: string) => {
    // Keep a single request in flight: overlapping polls could return out of
    // order and put an older batch back on the projector.
    if (tokenFetchInFlightRef.current) return;
    tokenFetchInFlightRef.current = true;
    const requestSeq = tokenFetchSeqRef.current;
    try {
      const res = await apiFetch(`/sessions/${sessionId}/active-tokens`);
      const data = await readJson<{ token_batch?: TokenBatch; error?: string }>(res);
      // Ignore a response that belongs to a session that has since closed.
      if (requestSeq !== tokenFetchSeqRef.current) return;
      if (res.ok && data?.token_batch) {
        const nextBatch = data.token_batch;
        // Server-reported remaining freshness; fall back to the batch
        // timestamp + validity window when the field is absent.
        const freshForMs = Math.max(
          0,
          Number(nextBatch.fresh_for_ms) ||
            Number(nextBatch.timestamp) + TOKEN_VALIDITY_FALLBACK_MS - Date.now()
        );
        // Keep the existing object when the server reused the same batch so
        // the rotation effect and QR render stay stable across polls.
        setTokenBatch((prev) =>
          prev?.batch_id === nextBatch.batch_id ? prev : nextBatch
        );
        setTokenError(null);
        scheduleFreshnessExpiry(freshForMs);
      } else {
        setTokenError(data?.error || 'Could not generate the QR code stream');
        // A fatal response (ended, forbidden, or missing session) means no
        // later poll can recover; drop the stale batch immediately.
        if (res.status === 400 || res.status === 403 || res.status === 404) {
          setTokenBatch(null);
          clearFreshnessTimer();
          setBatchExpired(true);
        }
      }
    } catch (err) {
      if (requestSeq !== tokenFetchSeqRef.current) return;
      console.error('Error fetching active tokens:', err);
      setTokenError('Network error while generating the QR code stream');
    } finally {
      if (requestSeq === tokenFetchSeqRef.current) {
        tokenFetchInFlightRef.current = false;
      }
    }
  };

  const handleRetryTokens = () => {
    if (!session) return;
    // A hung poll can leave the in-flight flag stuck; invalidate it so the
    // visible Retry button actually starts a fresh request.
    tokenFetchSeqRef.current += 1;
    tokenFetchInFlightRef.current = false;
    fetchActiveTokens(session.id);
  };

  const handleEndSession = async () => {
    if (!session) return;
    setEnding(true);
    setError(null);
    try {
      const res = await apiFetch(`/sessions/${session.id}/end`, { method: 'POST' });
      const data = await readJson<{ error?: string }>(res);
      if (res.ok) {
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        onSessionEnded();
        onClose();
      } else {
        setError(data?.error || 'Failed to end session');
      }
    } catch {
      setError('Network error ending session');
    } finally {
      setEnding(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  if (!session) return null;

  const currentToken = tokenBatch?.tokens?.[currentFrameIdx] || null;
  // Use compact qr_payload string for maximum dot thickness and scannability
  const qrStringPayload = currentToken
    ? currentToken.qr_payload || JSON.stringify(currentToken)
    : '';
  // A failed poll or an expired batch takes precedence over any cached QR so
  // the teacher can always reach Retry.
  const showTokenError = Boolean(tokenError) || batchExpired;
  const tokenErrorMessage =
    tokenError ||
    'The QR code stream has expired. Click Retry to generate a fresh set of codes.';

  // -------------------------------------------------------------
  // Fullscreen Theater / Projector View (Maximized Top-to-Bottom QR + Side Panels)
  // -------------------------------------------------------------
  if (isFullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          bgcolor: '#FFFFFF',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          p: 1.5,
          gap: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Left Side Panel: Course Info, 3-Frame Tracker & Rotation Speed Selector */}
        <Paper
          elevation={0}
          sx={{
            width: '23%',
            minWidth: 250,
            maxWidth: 310,
            p: 2.5,
            borderRadius: '16px',
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            bgcolor: m3Tokens.color.background,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 'calc(100vh - 24px)',
            boxSizing: 'border-box',
          }}
        >
          <Box>
            <Chip
              label="PROJECTOR STREAM"
              color="error"
              sx={{ fontWeight: 900, fontSize: '0.75rem', mb: 1.5 }}
            />
            {socketError && (
              <Alert severity="warning" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.75rem' }}>
                {socketError}
              </Alert>
            )}
            <Typography variant="h5" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface, lineHeight: 1.2, mb: 0.75 }}>
              {session.course_code}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5, fontSize: '1rem' }}>
              {session.course_name}
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 1.5 }}>
              Section: <strong>{session.section_name}</strong>
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Active Rotating Frames
            </Typography>

            <Stack spacing={1}>
              {[0, 1, 2].map((idx) => {
                const isActive = currentFrameIdx === idx;
                return (
                  <Paper
                    key={idx}
                    elevation={0}
                    sx={{
                      p: 1.25,
                      borderRadius: '10px',
                      border: `2px solid ${isActive ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: isActive ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: isActive ? m3Tokens.color.primary : 'grey.400',
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: isActive ? 800 : 600, color: isActive ? m3Tokens.color.onPrimaryContainer : m3Tokens.color.onSurface, fontSize: '0.85rem' }}>
                        Frame {idx + 1} of 3
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem', color: isActive ? m3Tokens.color.primary : m3Tokens.color.onSurfaceVariant }}>
                      {isActive ? 'TRANSMITTING' : 'QUEUED'}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>

            {/* Rotation Speed Selector */}
            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mt: 2, mb: 1 }}>
              Stream Rotation Speed
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                { label: '800ms', value: 800, desc: 'Normal' },
                { label: '300ms', value: 300, desc: 'Fast' },
                { label: '100ms', value: 100, desc: 'Ultra' },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  size="small"
                  variant={rotationSpeedMs === opt.value ? 'contained' : 'outlined'}
                  onClick={() => setRotationSpeedMs(opt.value)}
                  sx={{
                    flex: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: '8px',
                    minWidth: 0,
                    px: 0.5,
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '10px',
                bgcolor: '#FFFFFF',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <SpeedIcon sx={{ fontSize: 16, color: m3Tokens.color.primary }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.primary, fontSize: '0.75rem' }}>
                  ROTATING AT {rotationSpeedMs}MS
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', fontSize: '0.7rem', lineHeight: 1.3 }}>
                Token batches refresh automatically every 4-6s. Each QR frame stays valid for 10s. Stream flips frames at {rotationSpeedMs}ms for fast camera capture.
              </Typography>
            </Paper>
          </Box>
        </Paper>

        {/* Center: Absolute Maximum Top-to-Bottom QR Code */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100vh - 24px)',
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#FFFFFF',
              borderRadius: '24px',
              border: `4px solid ${m3Tokens.color.primary}`,
              boxShadow: '0px 8px 36px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'calc(100vh - 32px)',
              width: 'calc(100vh - 32px)',
              maxWidth: 'calc(100vw - 640px)',
              maxHeight: 'calc(100vh - 32px)',
              aspectRatio: '1/1',
              boxSizing: 'border-box',
            }}
          >
            {showTokenError ? (
              <Box sx={{ textAlign: 'center', px: 4, maxWidth: 560 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.main', mb: 1 }}>
                  QR stream unavailable
                </Typography>
                <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 2 }}>
                  {tokenErrorMessage}
                </Typography>
                <Button variant="contained" onClick={handleRetryTokens}>
                  Retry
                </Button>
              </Box>
            ) : qrStringPayload ? (
              <QRCodeSVG
                value={qrStringPayload}
                size={850}
                style={{ width: '100%', height: '100%', display: 'block' }}
                level="L" // Low error correction = Biggest, chunkiest dots for long distance
                includeMargin={false} // Outer box padding serves as crisp quiet zone
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            ) : (
              <CircularProgress size={80} />
            )}
          </Box>
        </Box>

        {/* Right Side Panel: Live Real-Time Roster & Session Controls */}
        <Paper
          elevation={0}
          sx={{
            width: '25%',
            minWidth: 260,
            maxWidth: 330,
            p: 2.5,
            borderRadius: '16px',
            border: `1px solid ${m3Tokens.color.outlineVariant}`,
            bgcolor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 'calc(100vh - 24px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Controls */}
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<FullscreenExitIcon />}
                onClick={toggleFullscreen}
                sx={{ borderRadius: '8px', fontSize: '0.8rem' }}
              >
                Exit Fullscreen
              </Button>
              <Button
                fullWidth
                size="small"
                variant="contained"
                color="error"
                onClick={handleEndSession}
                disabled={ending}
                sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem' }}
              >
                {ending ? 'Ending...' : 'End Session'}
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1.5 }}>
              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important' }} />}
                label={`Elapsed: ${formatElapsed(elapsedSeconds)}`}
                size="small"
                color={elapsedSeconds >= 600 ? "warning" : "default"}
                sx={{ fontWeight: 700, fontSize: '0.75rem' }}
              />
              {elapsedSeconds >= 600 && (
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label="10+ min active"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                />
              )}
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1.5,
                borderRadius: '10px',
                bgcolor: 'success.light',
                color: 'success.dark',
                textAlign: 'center',
              }}
            >
              <Typography variant="h3" sx={{ fontWeight: 900, color: 'success.dark', lineHeight: 1 }}>
                {attendees.length}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 0.25, fontSize: '0.85rem' }}>
                Students Marked Present
              </Typography>
            </Paper>

            <Typography variant="caption" sx={{ fontWeight: 800, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Real-Time Feed
            </Typography>
          </Box>

          {/* Real-time Student List */}
          <Box sx={{ flex: 1, overflowY: 'auto', my: 1, pr: 0.5 }}>
            {attendees.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <QrCodeScannerIcon sx={{ fontSize: 36, color: 'grey.400', mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurfaceVariant, fontSize: '0.85rem' }}>
                  Awaiting Scans...
                </Typography>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.75rem' }}>
                  Students scanning with 1x-20x zoom will appear here instantly.
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ p: 0 }}>
                {attendees.map((attendee, idx) => (
                  <React.Fragment key={attendee.id || idx}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        px: 0.75,
                        py: 0.5,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: m3Tokens.color.surfaceVariant },
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 32 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: m3Tokens.color.primary, fontSize: '0.7rem' }}>
                          <PersonIcon sx={{ fontSize: 14 }} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, fontSize: '0.8rem' }}>
                            {attendee.student.full_name}
                          </Typography>
                        }
                        secondary={
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.7rem' }}>
                              {attendee.student.email}
                            </Typography>
                            {attendee.acl_ms != null && (
                              <Chip
                                icon={<FlashOnIcon sx={{ fontSize: '0.65rem !important' }} />}
                                label={`${attendee.acl_ms}ms`}
                                size="small"
                                color="secondary"
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
                              />
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                    {idx < attendees.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', display: 'block', fontSize: '0.7rem' }}>
            Socket.io Live Feed Active
          </Typography>
        </Paper>
      </Box>
    );
  }

  // -------------------------------------------------------------
  // Standard Modal View (With 1-Click Fullscreen Button & Speed Toggle)
  // -------------------------------------------------------------
  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ p: 2.5, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label="LIVE ATTENDANCE STREAM" color="error" size="small" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label={`Elapsed: ${formatElapsed(elapsedSeconds)}`}
                  size="small"
                  color={elapsedSeconds >= 600 ? "warning" : "default"}
                  sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                />
                {elapsedSeconds >= 600 && (
                  <Chip
                    icon={<WarningAmberIcon sx={{ fontSize: '0.85rem !important' }} />}
                    label="10+ min: Remember to end"
                    size="small"
                    color="warning"
                    sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                  />
                )}
                <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  {session.course_code}: {session.course_name}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 0.5 }}>
                Section: <strong>{session.section_name}</strong> • Started at {new Date(session.started_at).toLocaleTimeString()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                color="primary"
                startIcon={<FullscreenIcon />}
                onClick={toggleFullscreen}
                sx={{ fontWeight: 700 }}
              >
                Fullscreen Projector
              </Button>
              <IconButton onClick={onClose} size="small" title="Minimize Projector">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
          {elapsedSeconds >= 600 && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, borderRadius: '10px' }}>
              <strong>Notice:</strong> This attendance session has been running for over 10 minutes ({formatElapsed(elapsedSeconds)}). Please remember to click <strong>End Attendance Session</strong> once all students in the classroom have finished scanning.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {socketError && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setSocketError(null)}>
              {socketError}
            </Alert>
          )}

        <Grid container spacing={3}>
          {/* Left Panel: Rotating 3-QR Stream Projector */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                textAlign: 'center',
                borderRadius: '16px',
                border: `2px solid ${m3Tokens.color.primary}`,
                bgcolor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 480,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.primary, mb: 0.5 }}>
                Anti-Proxy Rotating 3-QR Stream
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 1.5, maxWidth: 420 }}>
                Low-density matrix enabled for high-distance scanning.
              </Typography>

              {/* QR Code Container */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: '#FFFFFF',
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.06)',
                  display: 'inline-block',
                  mb: 1.5,
                }}
              >
                {showTokenError ? (
                  <Box sx={{ textAlign: 'center', width: 300, height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'error.main' }}>
                      QR stream unavailable
                    </Typography>
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                      {tokenErrorMessage}
                    </Typography>
                    <Button size="small" variant="contained" onClick={handleRetryTokens}>
                      Retry
                    </Button>
                  </Box>
                ) : qrStringPayload ? (
                  <QRCodeSVG
                    value={qrStringPayload}
                    size={300}
                    level="L" // Low error correction = Chunky scannable blocks
                    includeMargin={true}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300 }}>
                    <CircularProgress />
                  </Box>
                )}
              </Box>

              {/* Multi-frame sequence tracker chips */}
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                {[0, 1, 2].map((idx) => (
                  <Chip
                    key={idx}
                    label={`Frame ${idx + 1}/3`}
                    size="small"
                    variant={currentFrameIdx === idx ? 'filled' : 'outlined'}
                    color={currentFrameIdx === idx ? 'primary' : 'default'}
                    sx={{
                      fontWeight: currentFrameIdx === idx ? 700 : 500,
                      transform: currentFrameIdx === idx ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  />
                ))}
              </Stack>

              {/* Rotation Speed Selector */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                  Speed:
                </Typography>
                {[
                  { label: '800ms', value: 800 },
                  { label: '300ms', value: 300 },
                  { label: '100ms', value: 100 },
                ].map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    color={rotationSpeedMs === opt.value ? 'primary' : 'default'}
                    variant={rotationSpeedMs === opt.value ? 'filled' : 'outlined'}
                    onClick={() => setRotationSpeedMs(opt.value)}
                    sx={{ fontWeight: 700, cursor: 'pointer' }}
                  />
                ))}
              </Stack>

              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Tip: Click <strong>"Fullscreen Projector"</strong> for large lecture halls
              </Typography>
            </Paper>
          </Grid>

          {/* Right Panel: Live Attendance Roster Feed */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
                height: 480,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                  Live Roster
                </Typography>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`${attendees.length} Present`}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
              <Divider sx={{ mb: 1.5 }} />

              {attendees.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 2 }}>
                  <QrCodeScannerIcon sx={{ fontSize: 44, color: m3Tokens.color.onSurfaceVariant, mb: 1, opacity: 0.6 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                    Awaiting Student Scans...
                  </Typography>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 0.5 }}>
                    Students scanning the QR stream will appear here in real-time.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                  {attendees.map((attendee, idx) => (
                    <React.Fragment key={attendee.id || idx}>
                      <ListItem
                        alignItems="flex-start"
                        sx={{
                          px: 1,
                          py: 1,
                          borderRadius: '8px',
                          '&:hover': { bgcolor: m3Tokens.color.surfaceVariant },
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: m3Tokens.color.primary, fontSize: '0.85rem' }}>
                            <PersonIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                              {attendee.student.full_name}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                                {attendee.student.email}
                              </Typography>
                              {attendee.acl_ms != null && (
                                <Chip
                                  icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                                  label={`${attendee.acl_ms}ms`}
                                  size="small"
                                  color="secondary"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                      {idx < attendees.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}`, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Total Present: <strong>{attendees.length} students</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.outlineVariant }}>•</Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Elapsed: <strong>{formatElapsed(elapsedSeconds)}</strong>
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button onClick={onClose} variant="outlined">
            Minimize
          </Button>
          <Button
            onClick={handleEndSession}
            variant="contained"
            color="error"
            disabled={ending}
          >
            {ending ? 'Ending Session...' : 'End Attendance Session'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  </>
  );
};
