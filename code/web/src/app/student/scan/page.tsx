'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FlashOffIcon from '@mui/icons-material/FlashOff';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useRequireRole } from '@/hooks/useRequireRole';
import {
  StudentApiError,
  submitAttendanceScan,
} from '@/lib/studentApi';
import {
  createFrameAccumulator,
  type FrameAccumulator,
} from '@/lib/qr/accumulator';
import {
  createQrDecodeLoop,
  type QrDecodeLoop,
  type QrDiagnostics,
} from '@/lib/qr/decoder';
import {
  describeCameraError,
  getCameraCapabilities,
  setTorch,
  setZoom,
  startCamera,
  stopCamera,
  type CameraCapabilities,
  type CameraFacing,
} from '@/lib/qr/camera';
import { parseQrToken } from '@/lib/qr/token';
import { m3Tokens } from '@/theme/tokens';

type ScannerPhase =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'submitting'
  | 'success'
  | 'error';

const ZOOM_LEVELS = [1, 2, 3];

export default function StudentScanPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const decoderRef = useRef<QrDecodeLoop | null>(null);
  const accumulatorRef = useRef<FrameAccumulator | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const submittingRef = useRef(false);
  const completedRef = useRef(false);

  const [phase, setPhase] = useState<ScannerPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState('');
  const [aclMs, setAclMs] = useState(0);
  const [collected, setCollected] = useState<number[]>([]);
  const [diagnostics, setDiagnostics] = useState<QrDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(
    null
  );
  const [multipleCameras, setMultipleCameras] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  if (!accumulatorRef.current) {
    accumulatorRef.current = createFrameAccumulator();
  }

  const stopEverything = useCallback(() => {
    decoderRef.current?.stop();
    decoderRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
    trackRef.current = null;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopEverything();
      audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
    };
  }, [stopEverything]);

  const beep = useCallback((frequency: number, durationSeconds: number) => {
    const context = audioRef.current;
    if (!context) return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.06;
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + durationSeconds);
    } catch {
      // Audio is a nice-to-have; never fail the scan because of it.
    }
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      audioRef.current = new AudioContextClass();
    }
    audioRef.current.resume().catch(() => undefined);
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const wakeLock = (
        navigator as Navigator & {
          wakeLock?: {
            request: (type: 'screen') => Promise<WakeLockSentinel>;
          };
        }
      ).wakeLock;
      if (!wakeLock) return;
      wakeLockRef.current = await wakeLock.request('screen');
    } catch {
      // Screen Wake Lock is optional and not supported everywhere.
    }
  }, []);

  const submitSequence = useCallback(
    async (
      sessionId: string,
      tokens: ReturnType<FrameAccumulator['push']>['tokens'],
      scanStartedAt: string | null
    ) => {
      if (!tokens || submittingRef.current || completedRef.current) return;

      submittingRef.current = true;
      setPhase('submitting');
      decoderRef.current?.stop();
      stopCamera(streamRef.current);
      streamRef.current = null;
      trackRef.current = null;
      releaseWakeLock();

      try {
        const result = await submitAttendanceScan({
          session_id: sessionId,
          tokens,
          scan_started_at: scanStartedAt,
        });
        completedRef.current = true;
        setAclMs(Math.max(0, result.acl_ms ?? 0));
        setSuccessNote('Your attendance was recorded as PRESENT.');
        setPhase('success');
        beep(1250, 0.18);
      } catch (err) {
        if (err instanceof StudentApiError && err.status === 409) {
          completedRef.current = true;
          setAclMs(0);
          setSuccessNote(
            'Attendance was already marked for this session. You are all set.'
          );
          setPhase('success');
          beep(1000, 0.14);
          return;
        }

        setError(
          err instanceof Error ? err.message : 'Could not submit attendance.'
        );
        setPhase('error');
      } finally {
        submittingRef.current = false;
      }
    },
    [beep, releaseWakeLock]
  );

  const handleRawToken = useCallback(
    (rawValue: string) => {
      if (submittingRef.current || completedRef.current) return;
      const token = parseQrToken(rawValue);
      if (!token) return;

      const result = accumulatorRef.current!.push(token);
      setCollected(result.collected);

      if (result.status === 'collecting') {
        beep(880, 0.045);
      }

      if (
        result.status === 'ready' &&
        result.tokens &&
        result.sessionId
      ) {
        void submitSequence(
          result.sessionId,
          result.tokens,
          result.scanStartedAt
        );
      }
    },
    [beep, submitSequence]
  );

  const startScanning = useCallback(
    async (nextFacing: CameraFacing = facing) => {
      if (!videoRef.current) return;

      ensureAudio();
      setFacing(nextFacing);
      setError(null);
      setSuccessNote('');
      setCollected([]);
      setAclMs(0);
      setPhase('starting');
      completedRef.current = false;
      submittingRef.current = false;
      accumulatorRef.current?.reset();
      stopEverything();

      try {
        const session = await startCamera(videoRef.current, nextFacing);
        streamRef.current = session.stream;
        trackRef.current = session.track;
        const caps = getCameraCapabilities(session.track);
        setCapabilities(caps);
        setTorchOn(false);
        setZoomLevel(1);

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setMultipleCameras(
            devices.filter((device) => device.kind === 'videoinput').length > 1
          );
        } catch {
          setMultipleCameras(false);
        }

        const decoder = createQrDecodeLoop({
          video: videoRef.current,
          onToken: handleRawToken,
          onDiagnostics: setDiagnostics,
          onError: (decodeError) => {
            console.warn('[ClassPulse Scanner] decode error:', decodeError);
          },
        });
        decoderRef.current = decoder;
        await decoder.start();
        setPhase('scanning');
        void requestWakeLock();
      } catch (err) {
        stopEverything();
        setError(describeCameraError(err));
        setPhase('error');
      }
    },
    [
      ensureAudio,
      facing,
      handleRawToken,
      requestWakeLock,
      stopEverything,
    ]
  );

  const resetAndRetry = useCallback(() => {
    accumulatorRef.current?.reset();
    setCollected([]);
    setError(null);
    setAutoStart(true);
    setPhase('idle');
  }, []);

  // The error screen unmounts the video element. Wait for the idle screen to
  // commit before restarting the camera, otherwise the ref is still null.
  useEffect(() => {
    if (!autoStart || phase !== 'idle' || !videoRef.current) return;
    setAutoStart(false);
    void startScanning(facing);
  }, [autoStart, facing, phase, startScanning]);

  const handleClose = useCallback(() => {
    stopEverything();
    router.replace('/student');
  }, [router, stopEverything]);

  const cycleZoom = useCallback(async () => {
    const next =
      ZOOM_LEVELS[(ZOOM_LEVELS.indexOf(zoomLevel) + 1) % ZOOM_LEVELS.length];
    setZoomLevel(next);

    const track = trackRef.current;
    if (track && capabilities?.zoom) {
      const { min, max } = capabilities.zoom;
      const ratio = (next - 1) / (ZOOM_LEVELS.length - 1);
      const zoomValue = min + ratio * (max - min);
      const applied = await setZoom(track, zoomValue);
      if (applied) {
        decoderRef.current?.setDigitalZoom(1);
        return;
      }
    }

    decoderRef.current?.setDigitalZoom(next);
  }, [capabilities, zoomLevel]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    const applied = await setTorch(track, next);
    if (applied) setTorchOn(next);
  }, [torchOn]);

  if (authLoading || !user) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: '#000',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (phase === 'success') {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: '#000',
          display: 'grid',
          placeItems: 'center',
          p: 2,
          pb: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <Paper
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 3,
            borderRadius: 4,
            textAlign: 'center',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 64, color: '#2E7D32', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
            Marked PRESENT
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {successNote}
          </Typography>
          {aclMs > 0 && (
            <Chip
              label={`Capture latency: ${aclMs} ms`}
              sx={{
                mb: 2,
                fontWeight: 700,
                bgcolor: m3Tokens.color.secondaryContainer,
                color: m3Tokens.color.onSecondaryContainer,
              }}
            />
          )}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => router.replace('/student')}
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Done
          </Button>
        </Paper>
      </Box>
    );
  }

  if (phase === 'error') {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          bgcolor: '#000',
          display: 'grid',
          placeItems: 'center',
          p: 2,
          pb: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <Paper
          sx={{
            width: '100%',
            maxWidth: 440,
            p: 3,
            borderRadius: 4,
          }}
        >
          <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center' }}>
            <ErrorOutlineIcon sx={{ fontSize: 56, color: m3Tokens.color.error }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Scan not recorded
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          </Stack>
          <Stack spacing={1.25} sx={{ mt: 3 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={resetAndRetry}
              sx={{ fontWeight: 800, textTransform: 'none' }}
            >
              Try again
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleClose}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              Back to ClassPulse
            </Button>
          </Stack>
          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            If the camera does not start, check Settings → Safari → Camera, or
            open ClassPulse in Safari and scan there.
          </Alert>
        </Paper>
      </Box>
    );
  }

  const showVideo = phase === 'scanning' || phase === 'submitting';

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        bgcolor: '#000',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: showVideo ? 1 : 0,
          transform:
            !capabilities?.zoom && showVideo
              ? `scale(${zoomLevel})`
              : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 180ms ease',
        }}
      />

      {phase === 'idle' || phase === 'starting' ? (
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            pt: 'calc(12px + env(safe-area-inset-top))',
            pb: 'calc(18px + env(safe-area-inset-bottom))',
          }}
        >
          <Stack direction="row" alignItems="center">
            <IconButton
              aria-label="Close scanner"
              onClick={handleClose}
              sx={{ color: '#fff' }}
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 800, ml: 1 }}>
              Attendance scanner
            </Typography>
          </Stack>

          <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <Paper
              sx={{
                width: '100%',
                maxWidth: 440,
                p: 3,
                borderRadius: 4,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: m3Tokens.color.primaryContainer,
                  color: m3Tokens.color.onPrimaryContainer,
                  display: 'grid',
                  placeItems: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <CameraAltIcon sx={{ fontSize: 38 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>
                Scan the classroom QR
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Point your camera at the rotating 3-QR stream on the projector.
                ClassPulse needs to see all three frames.
              </Typography>

              {phase === 'starting' ? (
                <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    Starting camera…
                  </Typography>
                </Stack>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<CameraAltIcon />}
                  onClick={() => startScanning(facing)}
                  sx={{ fontWeight: 800, textTransform: 'none' }}
                >
                  Start camera
                </Button>
              )}

              <Alert severity="info" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
                Allow camera access when prompted. iOS may ask again the next
                time you open the installed app.
              </Alert>

              <Typography
                variant="caption"
                component="button"
                onClick={() => router.push('/student/install')}
                sx={{
                  mt: 2,
                  border: 0,
                  background: 'none',
                  color: m3Tokens.color.primary,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
              >
                Camera troubleshooting
              </Typography>
            </Paper>
          </Box>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              pt: 'calc(10px + env(safe-area-inset-top))',
              pb: 'calc(16px + env(safe-area-inset-bottom))',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              sx={{ px: 1, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}
            >
              <IconButton
                aria-label="Close scanner"
                onClick={handleClose}
                sx={{ color: '#fff' }}
              >
                <CloseIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 800, ml: 1, flex: 1 }}>
                Scan attendance
              </Typography>
              {capabilities?.torch && (
                <IconButton
                  aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
                  onClick={toggleTorch}
                  sx={{ color: '#fff' }}
                >
                  {torchOn ? <FlashOnIcon /> : <FlashOffIcon />}
                </IconButton>
              )}
              {multipleCameras && (
                <IconButton
                  aria-label="Switch camera"
                  onClick={() =>
                    startScanning(facing === 'environment' ? 'user' : 'environment')
                  }
                  sx={{ color: '#fff' }}
                >
                  <CameraswitchIcon />
                </IconButton>
              )}
              <Button
                size="small"
                onClick={cycleZoom}
                sx={{
                  color: '#fff',
                  minWidth: 42,
                  fontWeight: 800,
                  textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                }}
              >
                {zoomLevel}x
              </Button>
            </Stack>

            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <Box
                sx={{
                  width: 'min(72vw, 300px)',
                  aspectRatio: '1 / 1',
                  border: '3px solid rgba(255,255,255,0.92)',
                  borderRadius: '22px',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)',
                  position: 'relative',
                }}
              >
                <Typography
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -34,
                    textAlign: 'center',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  }}
                >
                  Hold steady over the rotating QR stream
                </Typography>
              </Box>
            </Box>

            <Box sx={{ px: 2 }}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(30,27,32,0.86)',
                  color: '#fff',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  {[0, 1, 2].map((index) => {
                    const done = collected.includes(index);
                    return (
                      <Box
                        key={index}
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: done
                            ? m3Tokens.color.primary
                            : 'rgba(255,255,255,0.12)',
                          border: `1px solid ${
                            done ? m3Tokens.color.primary : 'rgba(255,255,255,0.2)'
                          }`,
                        }}
                      >
                        <CheckCircleIcon
                          sx={{ fontSize: 16, opacity: done ? 1 : 0.35 }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 800 }}>
                          Frame {index + 1}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>

                {phase === 'submitting' && (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ mt: 1.25 }}
                  >
                    <CircularProgress size={16} sx={{ color: '#fff' }} />
                    <Typography variant="caption">
                      Verifying QR sequence…
                    </Typography>
                  </Stack>
                )}

                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <Button
                    size="small"
                    startIcon={<BugReportIcon />}
                    onClick={() => setShowDiagnostics((value) => !value)}
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: '0.68rem',
                      textTransform: 'none',
                    }}
                  >
                    Scanner diagnostics
                  </Button>
                </Box>

                <Collapse in={showDiagnostics}>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      m: 0,
                      mt: 1,
                      p: 1,
                      bgcolor: 'rgba(0,0,0,0.35)',
                      borderRadius: 1.5,
                      fontFamily: 'monospace',
                      fontSize: '0.68rem',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {diagnostics
                      ? `decode: ${diagnostics.decodeMs} ms\n` +
                        `rate: ~${diagnostics.fps} fps\n` +
                        `frames seen: ${diagnostics.frames}\n` +
                        `last error: ${diagnostics.lastError ?? 'none'}`
                      : 'Starting decoder…'}
                  </Typography>
                </Collapse>
              </Paper>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
