'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import SpeedIcon from '@mui/icons-material/Speed';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { CreatePulseMeterDialog } from './CreatePulseMeterDialog';
import { LivePulseMeterModal, PulseMeterInfo } from './LivePulseMeterModal';
import { PulseMeterResultsDialog } from './PulseMeterResultsDialog';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';
import { apiJson } from '@/lib/api';

interface PulseMeterAuthoringViewProps {
  classroomId: string;
}

export interface PulseMeter {
  id: string;
  classroom_id: string;
  created_by: string;
  created_by_name?: string;
  title: string;
  type: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  config: any;
  created_at: string;
}

export interface PulseMeterPastRun {
  id: string;
  activity_type: 'PULSEMETER' | 'QUIZ';
  status: 'ACTIVE' | 'ENDED';
  started_at: string;
  ended_at?: string | null;
  title: string;
  type: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  scoring_mode?: string | null;
  question_count?: number;
  response_count?: number;
  participant_count?: number;
  present_count?: number;
  blocked_count?: number;
  avg_score?: number | null;
}

interface ActivePulseMeterActivity {
  id: string;
  activity_type?: 'PULSEMETER' | 'QUIZ';
  activity_ref_id?: string;
  pulsemeter_id?: string;
  title?: string;
  started_at?: string;
  type?: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  config?: any;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const PulseMeterAuthoringView: React.FC<PulseMeterAuthoringViewProps> = ({ classroomId }) => {
  const [pulsemeters, setPulsemeters] = useState<PulseMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPulseMeter, setEditingPulseMeter] = useState<PulseMeter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Library / Past Runs tabs
  const [viewTab, setViewTab] = useState(0);
  const [pastRuns, setPastRuns] = useState<PulseMeterPastRun[]>([]);
  const [loadingPastRuns, setLoadingPastRuns] = useState(false);

  // Historical results dialog
  const [resultsActivity, setResultsActivity] = useState<PulseMeterPastRun | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  // Live Activity State
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [activeActivityModalOpen, setActiveActivityModalOpen] = useState(false);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [activePulsemeter, setActivePulsemeter] = useState<PulseMeterInfo | null>(null);

  // Stranded ACTIVE PulseMeter recovery
  const [activePulseActivity, setActivePulseActivity] = useState<ActivePulseMeterActivity | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [endingActive, setEndingActive] = useState(false);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (classroomId) {
      fetchPulsemeters();
      fetchPastRuns();
      checkActiveActivity();
    }
  }, [classroomId]);

  const handleDeletePulseMeter = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pulsemeters/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchPulsemeters();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete PulseMeter');
      }
    } catch {
      setError('Network error deleting PulseMeter');
    } finally {
      setDeleting(false);
    }
  };

  const handleLaunchPulseMeter = async (pm: PulseMeter) => {
    setLaunchingId(pm.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/pulsemeters/${pm.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });

      const data = await res.json();
      if (res.ok && data.activity) {
        setActiveActivityId(data.activity.id);
        setActivePulsemeter({
          id: pm.id,
          title: pm.title,
          type: pm.type,
          config: pm.config,
        });
        // Keep the activity id so "Minimize Window" leaves a resumable banner.
        setActivePulseActivity({
          id: data.activity.id,
          activity_type: 'PULSEMETER',
          activity_ref_id: pm.id,
          title: pm.title,
          type: pm.type,
          config: pm.config,
        });
        setActiveActivityModalOpen(true);
      } else {
        setError(data.error || 'Failed to launch PulseMeter');
      }
    } catch {
      setError('Network error launching PulseMeter');
    } finally {
      setLaunchingId(null);
    }
  };

  const fetchPulsemeters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/pulsemeters?classroom_id=${classroomId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setPulsemeters(data.pulsemeters || []);
      } else {
        setError(data.error || 'Failed to fetch PulseMeters');
      }
    } catch {
      setError('Network error fetching PulseMeters');
    } finally {
      setLoading(false);
    }
  };

  const fetchPastRuns = async () => {
    if (!classroomId) return;
    setLoadingPastRuns(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/live-activities?classroom_id=${classroomId}&activity_type=PULSEMETER&status=ENDED&limit=50`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPastRuns((data as any)?.activities || []);
      } else {
        setError((data as any)?.error || 'Failed to fetch past PulseMeter runs');
      }
    } catch {
      setError('Network error fetching past PulseMeter runs');
    } finally {
      setLoadingPastRuns(false);
    }
  };

  const checkActiveActivity = async () => {
    if (!classroomId) return;
    setCheckingActive(true);
    try {
      const { res, data } = await apiJson<{
        active?: boolean;
        activity?: ActivePulseMeterActivity | null;
        pulsemeter?: { id?: string; title?: string; type?: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE'; config?: any } | null;
        error?: string;
      }>(`/live-activities/active?classroom_id=${classroomId}`);

      if (res.ok) {
        const activity = data?.active ? data?.activity : null;
        if (activity && (!activity.activity_type || activity.activity_type === 'PULSEMETER')) {
          // `/live-activities/active` nests the PulseMeter payload inside the
          // activity object; accept the legacy top-level field too.
          const activityPayload = activity as ActivePulseMeterActivity & {
            pulsemeter?: { id?: string; title?: string; type?: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE'; config?: any } | null;
          };
          const info = activityPayload.pulsemeter || data?.pulsemeter || null;
          setActivePulseActivity({
            ...activity,
            title: activity.title || info?.title,
            type: info?.type || activity.type,
            config: info?.config || activity.config,
            pulsemeter_id: info?.id || activity.activity_ref_id,
          });
        } else {
          setActivePulseActivity(null);
        }
      }
    } catch {
      // Non-blocking: the Library remains usable if active-check fails.
    } finally {
      setCheckingActive(false);
    }
  };

  const handleResumeActivePulseMeter = () => {
    if (!activePulseActivity) return;
    const refId =
      activePulseActivity.activity_ref_id ||
      activePulseActivity.pulsemeter_id ||
      '';
    const found = pulsemeters.find((pm) => pm.id === refId);
    const type = activePulseActivity.type || found?.type;
    const config = activePulseActivity.config || found?.config;
    const title = activePulseActivity.title || found?.title || 'Untitled PulseMeter';

    if (!type || !config) {
      setError(
        'Could not load the PulseMeter definition for the live session. End the live activity to unblock new launches.'
      );
      return;
    }

    setActiveActivityId(activePulseActivity.id);
    setActivePulsemeter({
      id: refId,
      title,
      type,
      config,
    });
    setActiveActivityModalOpen(true);
  };

  const handleEndActivePulseMeter = async () => {
    if (!activePulseActivity) return;
    setEndingActive(true);
    setError(null);
    try {
      const { res, data } = await apiJson<{ error?: string }>(
        `/live-activities/${activePulseActivity.id}/end`,
        { method: 'POST' }
      );
      if (res.ok) {
        setActivePulseActivity(null);
        await Promise.all([fetchPulsemeters(), fetchPastRuns()]);
      } else {
        setError(data?.error || 'Failed to end the active PulseMeter session');
      }
    } catch {
      setError('Network error ending the active PulseMeter session');
    } finally {
      setEndingActive(false);
    }
  };

  const handleOpenResults = (run: PulseMeterPastRun) => {
    setResultsActivity(run);
    setResultsOpen(true);
  };

  const renderRunTypeChip = (type?: string) => {
    switch (type) {
      case 'WORD_CLOUD':
        return (
          <Chip
            icon={<CloudQueueIcon sx={{ fontSize: '1rem !important' }} />}
            label="Word Cloud"
            size="small"
            sx={{ bgcolor: m3Tokens.color.primaryContainer, color: m3Tokens.color.onPrimaryContainer, fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      case 'MCQ':
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />}
            label="MCQ"
            size="small"
            sx={{ bgcolor: m3Tokens.color.secondaryContainer, color: m3Tokens.color.onSecondaryContainer, fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      case 'RATING_SCALE':
        return (
          <Chip
            icon={<LinearScaleIcon sx={{ fontSize: '1rem !important' }} />}
            label="Rating Scale"
            size="small"
            sx={{ bgcolor: m3Tokens.color.tertiaryContainer, color: m3Tokens.color.onTertiaryContainer, fontWeight: 700, fontSize: '0.72rem' }}
          />
        );
      default:
        return <Chip label={type || 'PulseMeter'} size="small" />;
    }
  };

  const renderTypeChip = (type: string, config: any) => {
    switch (type) {
      case 'WORD_CLOUD':
        return (
          <Chip
            icon={<CloudQueueIcon sx={{ fontSize: '1rem !important' }} />}
            label="Word Cloud"
            size="small"
            sx={{
              bgcolor: m3Tokens.color.primaryContainer,
              color: m3Tokens.color.onPrimaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      case 'MCQ':
        return (
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: '1rem !important' }} />}
            label={`MCQ (${config.options?.length || 0} options)`}
            size="small"
            sx={{
              bgcolor: m3Tokens.color.secondaryContainer,
              color: m3Tokens.color.onSecondaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      case 'RATING_SCALE':
        return (
          <Chip
            icon={<LinearScaleIcon sx={{ fontSize: '1rem !important' }} />}
            label={`Rating Scale (1–${config.max || 5})`}
            size="small"
            sx={{
              bgcolor: m3Tokens.color.tertiaryContainer,
              color: m3Tokens.color.onTertiaryContainer,
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          />
        );
      default:
        return <Chip label={type} size="small" />;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <SpeedIcon sx={{ color: m3Tokens.color.primary, fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              PulseMeter Activities
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Author reusable live feedback questions and polls. Launch them during any class session.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            Create PulseMeter
          </Button>
          <IconButton
            size="small"
            onClick={() => {
              fetchPulsemeters();
              fetchPastRuns();
              checkActiveActivity();
            }}
            title="Refresh PulseMeters"
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {activePulseActivity && !activeActivityModalOpen && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3, borderRadius: '8px', alignItems: 'center' }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={handleResumeActivePulseMeter}
                disabled={checkingActive}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Resume
              </Button>
              <Button
                color="error"
                size="small"
                variant="contained"
                startIcon={endingActive ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
                onClick={handleEndActivePulseMeter}
                disabled={endingActive}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {endingActive ? 'Ending...' : 'End it'}
              </Button>
            </Stack>
          }
        >
          <strong>A PulseMeter session is still live</strong> — &quot;
          {activePulseActivity.title || 'Untitled PulseMeter'}&quot; is blocking new launches. Resume it or end it.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, mb: 3 }}>
        <Tabs value={viewTab} onChange={(_, val) => setViewTab(val)}>
          <Tab label={`Library (${pulsemeters.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label={`Past Runs (${pastRuns.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
      </Box>

      {viewTab === 0 && (loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
            Loading authored PulseMeters...
          </Typography>
        </Box>
      ) : pulsemeters.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            bgcolor: '#FFFFFF',
          }}
        >
          <SpeedIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
            No PulseMeters Authored Yet
          </Typography>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
            PulseMeters let you collect real-time student sentiment via Word Clouds, Multiple Choice polls, or Rating Scales during lectures.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Create Your First PulseMeter
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {pulsemeters.map((pm) => (
            <Grid item xs={12} md={6} key={pm.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '12px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.15s ease',
                  '&:hover': {
                    borderColor: m3Tokens.color.primary,
                  },
                }}
              >
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                    {renderTypeChip(pm.type, pm.config)}
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                      {new Date(pm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Stack>

                  <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 1, fontSize: '1.05rem' }}>
                    {pm.title}
                  </Typography>

                  {/* Config Details Preview */}
                  {pm.type === 'WORD_CLOUD' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.25 }}>
                        STUDENT PROMPT
                      </Typography>
                      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface }}>
                        "{pm.config?.prompt || pm.title}"
                      </Typography>
                    </Box>
                  )}

                  {pm.type === 'MCQ' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.5 }}>
                        POLL OPTIONS
                      </Typography>
                      <Stack spacing={0.75}>
                        {pm.config?.options?.map((opt: any, idx: number) => (
                          <Stack direction="row" spacing={1} key={idx} alignItems="center">
                            <Chip
                              label={opt.id ? opt.id.toUpperCase() : String.fromCharCode(65 + idx)}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: m3Tokens.color.surfaceVariant }}
                            />
                            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface, fontSize: '0.85rem' }}>
                              {opt.text}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {pm.type === 'RATING_SCALE' && (
                    <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: m3Tokens.color.background, mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.secondary, display: 'block', mb: 0.5 }}>
                        SCALE RANGE (1 to {pm.config?.max || 5})
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          1: {pm.config?.low_label || 'Lowest'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {pm.config?.max || 5}: {pm.config?.high_label || 'Highest'}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Box sx={{ pt: 1.5, borderTop: `1px solid ${m3Tokens.color.surfaceVariant}` }}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={launchingId === pm.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                      onClick={() => handleLaunchPulseMeter(pm)}
                      disabled={launchingId !== null}
                      fullWidth
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
                    >
                      {launchingId === pm.id ? 'Launching...' : 'Launch Live Activity'}
                    </Button>
                    <Tooltip title="Edit PulseMeter">
                      <IconButton
                        color="primary"
                        onClick={() => setEditingPulseMeter(pm)}
                        sx={{
                          border: `1px solid ${m3Tokens.color.outlineVariant}`,
                          borderRadius: '8px',
                          p: 1,
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete PulseMeter">
                      <IconButton
                        color="error"
                        onClick={() => setDeleteConfirmId(pm.id)}
                        sx={{
                          border: `1px solid ${m3Tokens.color.outlineVariant}`,
                          borderRadius: '8px',
                          p: 1,
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      ))}

      {viewTab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                Past PulseMeter Runs
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Every ended live activity keeps its responses and moderation history.
              </Typography>
            </Box>
            <IconButton size="small" onClick={fetchPastRuns} title="Refresh past runs">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>

          {loadingPastRuns ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
                Loading past runs...
              </Typography>
            </Box>
          ) : pastRuns.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                textAlign: 'center',
                borderRadius: '12px',
                border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <HistoryIcon sx={{ fontSize: 48, color: m3Tokens.color.primary, opacity: 0.6, mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                No Past Runs
              </Typography>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxWidth: 450, mx: 'auto', mb: 2.5 }}>
                No PulseMeter runs yet — launch one from the Library.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => setViewTab(0)}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Go to Library
              </Button>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                borderRadius: '12px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                overflow: 'hidden',
                bgcolor: '#FFFFFF',
              }}
            >
              <Table>
                <TableHead sx={{ bgcolor: '#F8F9FA' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      DATE / TIME
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      TITLE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      TYPE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      RESPONDED
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      STATUS
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      RESULTS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pastRuns.map((run) => (
                    <TableRow key={run.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          {run.started_at
                            ? new Date(run.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                            : '--'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {run.started_at
                            ? new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          {run.title || 'Untitled PulseMeter'}
                        </Typography>
                      </TableCell>
                      <TableCell>{renderRunTypeChip(run.type)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface }}>
                          Responded <strong>{run.participant_count ?? run.response_count ?? 0}</strong> / {run.present_count ?? '--'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label="ENDED"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => handleOpenResults(run)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          View Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onClose={() => !deleting && setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete PulseMeter?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Are you sure you want to delete this PulseMeter activity? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteConfirmId && handleDeletePulseMeter(deleteConfirmId)}
            variant="contained"
            color="error"
            disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create / Edit Dialog */}
      <CreatePulseMeterDialog
        open={createDialogOpen || Boolean(editingPulseMeter)}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingPulseMeter(null);
        }}
        classroomId={classroomId}
        onSuccess={fetchPulsemeters}
        pulseMeterToEdit={editingPulseMeter}
      />

      {/* Live PulseMeter Modal */}
      {activeActivityId && activePulsemeter && (
        <LivePulseMeterModal
          open={activeActivityModalOpen}
          activityId={activeActivityId}
          classroomId={classroomId}
          pulsemeter={activePulsemeter}
          onClose={() => setActiveActivityModalOpen(false)}
          onActivityEnded={() => {
            setActiveActivityModalOpen(false);
            setActiveActivityId(null);
            setActivePulsemeter(null);
            setActivePulseActivity(null);
            fetchPulsemeters();
            fetchPastRuns();
          }}
        />
      )}

      {/* Historical Results Dialog (Past Runs) */}
      <PulseMeterResultsDialog
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        activityId={resultsActivity?.id || null}
        title={resultsActivity?.title}
        type={resultsActivity?.type}
      />
    </Box>
  );
};
