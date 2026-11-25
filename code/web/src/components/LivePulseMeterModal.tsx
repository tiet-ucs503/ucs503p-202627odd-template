'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Avatar,
  TextField,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { WordCloudMuteDialog } from './WordCloudMuteDialog';
import { getAuthHeaders, getAuthToken } from '@/lib/authStorage';

export interface LiveActivity {
  id: string;
  classroom_id: string;
  activity_type: 'PULSEMETER' | 'QUIZ';
  activity_ref_id: string;
  status: 'ACTIVE' | 'ENDED';
  started_at: string;
  attendance_session_id?: string | null;
  attendance_pending: boolean;
}

export interface PulseMeterInfo {
  id: string;
  title: string;
  type: 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';
  config: any;
}

interface LivePulseMeterModalProps {
  open: boolean;
  activityId: string;
  classroomId: string;
  pulsemeter: PulseMeterInfo;
  onClose: () => void;
  onActivityEnded: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const LivePulseMeterModal: React.FC<LivePulseMeterModalProps> = ({
  open,
  activityId,
  classroomId,
  pulsemeter,
  onClose,
  onActivityEnded,
}) => {
  const [responseCount, setResponseCount] = useState<number>(0);
  const [presentCount, setPresentCount] = useState<number | null>(null);
  const [attendancePending, setAttendancePending] = useState<boolean>(true);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isConcluded, setIsConcluded] = useState(false);

  const totalMcqVotes = useMemo(() => {
    return distribution.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  }, [distribution]);

  const mcqChartData = useMemo(() => {
    return distribution.map((item, index) => {
      const shortCode =
        item.option_id && item.option_id.toString().length <= 2
          ? item.option_id.toString().toUpperCase()
          : String.fromCharCode(65 + index);
      return {
        ...item,
        shortCode,
        displayLabel: `Option ${shortCode}`,
        color: chartTokens.palette[index % chartTokens.palette.length],
      };
    });
  }, [distribution]);

  // Mute Dialog State
  const [muteDialogOpen, setMuteDialogOpen] = useState(false);
  const [muteTargetStudentId, setMuteTargetStudentId] = useState<string | undefined>(undefined);
  const [muteTargetStudentName, setMuteTargetStudentName] = useState<string | undefined>(undefined);
  const [muteDefaultReason, setMuteDefaultReason] = useState<string | undefined>(undefined);

  // Word Cloud Moderation & Submissions State
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);
  const [selectedFilterWord, setSelectedFilterWord] = useState<string | null>(null);
  const [moderationTab, setModerationTab] = useState<'ALL' | 'BLOCKED'>('ALL');
  const [submissionActionLoading, setSubmissionActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const socketRef = useRef<Socket | null>(null);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/word-cloud-submissions`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to fetch word cloud submissions:', err);
    }
  };

  const handleApproveSubmission = async (responseId: string) => {
    setSubmissionActionLoading(responseId);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/responses/${responseId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.aggregated) {
          if (data.aggregated.distribution) setDistribution(data.aggregated.distribution);
          if (data.aggregated.blockedCount !== undefined) setBlockedCount(data.aggregated.blockedCount);
        }
        await fetchSubmissions();
      }
    } catch (err) {
      console.error('Failed to approve submission:', err);
    } finally {
      setSubmissionActionLoading(null);
    }
  };

  const handleDeleteSubmission = async (responseId: string) => {
    setSubmissionActionLoading(responseId);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/responses/${responseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.aggregated) {
          if (data.aggregated.distribution) setDistribution(data.aggregated.distribution);
          if (data.aggregated.blockedCount !== undefined) setBlockedCount(data.aggregated.blockedCount);
        }
        await fetchSubmissions();
      }
    } catch (err) {
      console.error('Failed to delete submission:', err);
    } finally {
      setSubmissionActionLoading(null);
    }
  };

  const handleOpenMuteForStudent = (studentId: string, studentName: string, word: string) => {
    setMuteTargetStudentId(studentId);
    setMuteTargetStudentName(studentName);
    setMuteDefaultReason(`Inappropriate word cloud submission: "${word}"`);
    setMuteDialogOpen(true);
  };

  // Fetch initial analytics & connect Socket.io
  useEffect(() => {
    if (!open || !activityId) return;

    fetchAnalytics();
    if (pulsemeter.type === 'WORD_CLOUD') {
      fetchSubmissions();
    }

    const socket = io(API_BASE_URL, {
      auth: { token: getAuthToken() },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_activity_teacher', activityId, (result: { ok?: boolean; error?: string } | undefined) => {
        if (!result?.ok) {
          setError(result?.error || 'The server denied access to this live activity room.');
        }
      });
    });

    socket.on('auth:error', (data: { error?: string } | undefined) => {
      setError(data?.error || 'Socket authentication failed. Please sign in again.');
    });

    socket.on('pulsemeter:results', (data: any) => {
      if (data.activityId === activityId) {
        setResponseCount(data.responseCount || 0);
        if (data.presentCount !== undefined) setPresentCount(data.presentCount);
        if (data.attendancePending !== undefined) setAttendancePending(data.attendancePending);
        if (data.distribution) setDistribution(data.distribution);
        if (data.blockedCount !== undefined) setBlockedCount(data.blockedCount);
        if (pulsemeter.type === 'WORD_CLOUD') {
          fetchSubmissions();
        }
      }
    });

    socket.on('activity:response_count', (data: any) => {
      if (data.activityId === activityId) {
        setResponseCount(data.responseCount || 0);
        if (data.presentCount !== undefined) setPresentCount(data.presentCount);
        if (data.attendancePending !== undefined) setAttendancePending(data.attendancePending);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_activity', activityId);
        socketRef.current.disconnect();
      }
    };
  }, [open, activityId]);

  const fetchAnalytics = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/analytics`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setResponseCount(data.responseCount || 0);
        setPresentCount(data.presentCount);
        setAttendancePending(data.attendancePending);
        setDistribution(data.distribution || []);
        if (data.blockedCount !== undefined) setBlockedCount(data.blockedCount);
        if (data.liveActivity?.status === 'ENDED') {
          setIsConcluded(true);
        }
      } else {
        setError(data.error || 'Failed to load live activity analytics');
      }
    } catch {
      setError('Network error loading activity analytics');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleEndActivity = async () => {
    setEnding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        // Keep the projector open so the teacher can discuss the final charts.
        // The parent's Past Runs list is refreshed only when the modal is closed.
        setIsConcluded(true);
        await fetchAnalytics(false);
      } else {
        setError(data.error || 'Failed to end live activity');
      }
    } catch {
      setError('Network error ending live activity');
    } finally {
      setEnding(false);
    }
  };

  // Compute Word Cloud font sizes
  const maxWordCount = distribution.length > 0
    ? Math.max(...distribution.map((d: any) => Number(d.count) || 1))
    : 1;

  const getWordFontSize = (count: number) => {
    if (maxWordCount <= 1) return 18;
    const minSize = 14;
    const maxSize = 38;
    return Math.round(minSize + ((count - 1) / (maxWordCount - 1)) * (maxSize - minSize));
  };

  // Donut chart data for Present-vs-Responded
  const responded = responseCount;
  const nonResponded = presentCount !== null && presentCount > responded ? presentCount - responded : 0;
  const donutData = [
    { name: 'Responded', value: responded, color: chartTokens.primary },
    { name: 'Pending / Not Responded', value: nonResponded, color: '#E7E0EC' },
  ];

  const responseRate = presentCount && presentCount > 0
    ? Math.min(100, Math.round((responded / presentCount) * 100))
    : null;

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="lg" fullWidth disableEscapeKeyDown>
      {/* Modal Header */}
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SpeedIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                  {pulsemeter.title}
                </Typography>
                <Chip
                  label={isConcluded ? 'CONCLUDED (FINAL RESULTS)' : 'LIVE'}
                  color={isConcluded ? 'success' : 'error'}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    height: 20,
                    fontSize: '0.65rem',
                    animation: isConcluded ? 'none' : 'pulse 1.5s infinite',
                  }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Type: <strong>{pulsemeter.type.replace('_', ' ')}</strong> &bull; Activity ID: {activityId.slice(0, 8)}...
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              icon={<PeopleIcon sx={{ fontSize: '1rem !important' }} />}
              label={`${responseCount} Responded`}
              color="primary"
              variant="filled"
              sx={{ fontWeight: 700, fontSize: '0.85rem' }}
            />
            {isConcluded ? (
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onActivityEnded}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
              >
                Close &amp; Keep Results
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={ending ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon />}
                onClick={handleEndActivity}
                disabled={ending}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: '8px' }}
              >
                {ending ? 'Ending...' : 'End Activity'}
              </Button>
            )}
          </Stack>
        </Stack>
      </DialogTitle>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
        {isConcluded && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: '8px' }}>
            <strong>PulseMeter Concluded:</strong> Student response collection has ended. You can keep these final charts on the projector for class discussion as long as you'd like.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={36} />
            <Typography variant="body2" sx={{ mt: 1.5, color: m3Tokens.color.onSurfaceVariant }}>
              Connecting to live activity session...
            </Typography>
          </Box>
        ) : (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            {/* Left/Center Panel: Primary Live Chart */}
            <Box sx={{ flex: 1 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  border: `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  minHeight: 380,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                  Live Response Distribution
                </Typography>

                {/* 1. MCQ Bar Chart */}
                {pulsemeter.type === 'MCQ' && (
                  <Box sx={{ width: '100%' }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for first student response...
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mcqChartData} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                              <XAxis
                                dataKey="displayLabel"
                                stroke={chartTokens.axis}
                                tick={{ fill: chartTokens.axis, fontSize: 13, fontWeight: 700 }}
                                interval={0}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={chartTokens.axis}
                                tick={{ fill: chartTokens.axis, fontSize: 12 }}
                              />
                              <RechartsTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const pct = totalMcqVotes > 0 ? Math.round(((data.count || 0) / totalMcqVotes) * 100) : 0;
                                    return (
                                      <Box
                                        sx={{
                                          bgcolor: chartTokens.tooltipBg,
                                          border: `1px solid ${chartTokens.tooltipBorder}`,
                                          borderRadius: '8px',
                                          p: 1.5,
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                          maxWidth: 320,
                                        }}
                                      >
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: data.color, display: 'block' }}>
                                          {data.displayLabel}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface, my: 0.5 }}>
                                          {data.option_text}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                                          {data.count} {data.count === 1 ? 'vote' : 'votes'} ({pct}%)
                                        </Typography>
                                      </Box>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {mcqChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>

                        {/* Options Breakdown / Legend */}
                        <Box sx={{ pt: 1, borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: m3Tokens.color.onSurfaceVariant,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              mb: 1.5,
                              display: 'block',
                            }}
                          >
                            Options Legend
                          </Typography>
                          <Stack spacing={1}>
                            {mcqChartData.map((item) => {
                              const pct = totalMcqVotes > 0 ? Math.round(((item.count || 0) / totalMcqVotes) * 100) : 0;
                              return (
                                <Box
                                  key={item.option_id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 1.25,
                                    borderRadius: '10px',
                                    bgcolor: '#F8F9FA',
                                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 1, minWidth: 0 }}>
                                    <Box
                                      sx={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        bgcolor: item.color,
                                        color: '#FFFFFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: 13,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {item.shortCode}
                                    </Box>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: m3Tokens.color.onSurface,
                                        fontWeight: 600,
                                        wordBreak: 'break-word',
                                      }}
                                    >
                                      {item.option_text}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    size="small"
                                    label={`${item.count} ${item.count === 1 ? 'vote' : 'votes'} (${pct}%)`}
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      bgcolor: item.count > 0 ? '#E8F0FE' : '#F1F3F4',
                                      color: item.count > 0 ? '#1967D2' : '#5F6368',
                                      borderRadius: '6px',
                                      flexShrink: 0,
                                    }}
                                  />
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                {/* 2. Rating Scale Histogram */}
                {pulsemeter.type === 'RATING_SCALE' && (
                  <Box sx={{ width: '100%', height: 320 }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for first student response...
                        </Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribution} margin={{ top: 15, right: 20, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                          <XAxis
                            dataKey="rating"
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 13, fontWeight: 700 }}
                          />
                          <YAxis
                            allowDecimals={false}
                            stroke={chartTokens.axis}
                            tick={{ fill: chartTokens.axis, fontSize: 12 }}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: chartTokens.tooltipBg,
                              borderColor: chartTokens.tooltipBorder,
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <Bar dataKey="count" fill={chartTokens.primary} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                )}

                {/* 3. Word Cloud Interactive View */}
                {pulsemeter.type === 'WORD_CLOUD' && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {distribution.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          Waiting for students to submit word cloud thoughts...
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            p: 3,
                            borderRadius: '12px',
                            bgcolor: m3Tokens.color.background,
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            minHeight: 240,
                          }}
                        >
                          {distribution.map((item: any, idx: number) => {
                            const size = getWordFontSize(Number(item.count));
                            const color = chartTokens.palette[idx % chartTokens.palette.length];
                            return (
                              <Tooltip
                                key={idx}
                                title={`"${item.word}" mentioned ${item.count} time${item.count > 1 ? 's' : ''} • Click to inspect student contributors`}
                                arrow
                              >
                                <Typography
                                  component="span"
                                  onClick={() => {
                                    setSelectedFilterWord(item.word);
                                    setModerationTab('ALL');
                                    setSubmissionsModalOpen(true);
                                  }}
                                  sx={{
                                    fontSize: `${size}px`,
                                    fontWeight: 800,
                                    color,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    userSelect: 'none',
                                    '&:hover': {
                                      transform: 'scale(1.15)',
                                      textDecoration: 'underline',
                                    },
                                  }}
                                >
                                  {item.word}
                                </Typography>
                              </Tooltip>
                            );
                          })}
                        </Box>
                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            💡 Click on any word in the cloud to view which students submitted it and mute offenders.
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<VisibilityIcon fontSize="small" />}
                            onClick={() => {
                              setSelectedFilterWord(null);
                              setModerationTab('ALL');
                              setSubmissionsModalOpen(true);
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                          >
                            View All Submissions ({submissions.length})
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Right Panel: Present-vs-Responded Resolution & Moderation */}
            <Box sx={{ width: { xs: '100%', lg: 320 } }}>
              <Stack spacing={2}>
                {/* Present vs Responded Resolution Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                    Participation & Turnout
                  </Typography>

                  {attendancePending ? (
                    <Box sx={{ p: 2, borderRadius: '10px', bgcolor: m3Tokens.color.primaryContainer, mb: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <HourglassEmptyIcon sx={{ color: m3Tokens.color.onPrimaryContainer, fontSize: 18, mt: 0.2 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onPrimaryContainer, fontSize: '0.82rem' }}>
                            Present Count: Pending
                          </Typography>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onPrimaryContainer, display: 'block', mt: 0.5, lineHeight: 1.3 }}>
                            Attendance has not been finalized yet. Present-vs-responded metrics will resolve automatically once today's attendance session ends.
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <Box sx={{ width: '100%', height: 140, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={donutData}
                              dataKey="value"
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={58}
                              startAngle={90}
                              endAngle={-270}
                            >
                              {donutData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ fontWeight: 900, color: m3Tokens.color.primary, lineHeight: 1 }}>
                            {responseRate !== null ? `${responseRate}%` : '--'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: m3Tokens.color.onSurfaceVariant }}>
                            RATE
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        <strong>{responded}</strong> of <strong>{presentCount}</strong> present students responded
                      </Typography>
                    </Box>
                  )}

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Total Responses:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {responseCount}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Attendance Linked:
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {attendancePending ? 'Pending Resolution' : `${presentCount} Present`}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>

                {/* Word Cloud Moderation & Auto-Blocked Submissions Card */}
                {pulsemeter.type === 'WORD_CLOUD' && (
                  <Stack spacing={2}>
                    {/* Auto-Blocked Alert Banner if blocked submissions exist */}
                    {blockedCount > 0 && (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          border: `1px solid ${m3Tokens.color.error}`,
                          bgcolor: '#FDF2F2',
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                          <GppMaybeIcon color="error" fontSize="small" />
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.error }}>
                            {blockedCount} Auto-Blocked {blockedCount === 1 ? 'Response' : 'Responses'}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                          Offensive words were auto-filtered and hidden from the public word cloud.
                        </Typography>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          size="small"
                          startIcon={<ShieldIcon />}
                          onClick={() => {
                            setSelectedFilterWord(null);
                            setModerationTab('BLOCKED');
                            setSubmissionsModalOpen(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          Review & Approve ({blockedCount})
                        </Button>
                      </Paper>
                    )}

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '16px',
                        border: `1px solid ${m3Tokens.color.outlineVariant}`,
                        bgcolor: '#FFFFFF',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <BlockIcon sx={{ color: m3Tokens.color.error, fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                          Word Cloud Moderation
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.5 }}>
                        Inspect student contributors, review auto-blocked entries, or mute students.
                      </Typography>
                      <Stack spacing={1}>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => {
                            setSelectedFilterWord(null);
                            setModerationTab('ALL');
                            setSubmissionsModalOpen(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          Inspect Submissions ({submissions.length})
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<BlockIcon />}
                          onClick={() => {
                            setMuteTargetStudentId(undefined);
                            setMuteTargetStudentName(undefined);
                            setMuteDefaultReason(undefined);
                            setMuteDialogOpen(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          Mute Student by ID
                        </Button>
                      </Stack>
                    </Paper>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}`, justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
          {isConcluded ? 'PulseMeter is concluded. Final aggregate results are preserved above.' : 'Live Socket.io analytics feed connected.'}
        </Typography>
        <Button
          onClick={isConcluded ? onActivityEnded : onClose}
          variant={isConcluded ? 'contained' : 'outlined'}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {isConcluded ? 'Close & Keep Results' : 'Minimize Window'}
        </Button>
      </DialogActions>

      {/* Word Cloud Student Submissions Audit & Moderation Modal */}
      <Dialog
        open={submissionsModalOpen}
        onClose={() => {
          setSubmissionsModalOpen(false);
          setSelectedFilterWord(null);
          setSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <VisibilityIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, fontSize: '1.1rem' }}>
                {selectedFilterWord
                  ? `Submissions for "${selectedFilterWord}"`
                  : moderationTab === 'BLOCKED'
                  ? `Auto-Blocked Submissions (${blockedCount})`
                  : 'Word Cloud Submissions Audit'}
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={() => {
                setSubmissionsModalOpen(false);
                setSelectedFilterWord(null);
                setSearchQuery('');
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#FAFAFA' }}>
          {selectedFilterWord ? (
            <Alert
              severity="info"
              sx={{ mb: 2, borderRadius: '8px' }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setSelectedFilterWord(null)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Show All Submissions
                </Button>
              }
            >
              Filtering by submissions matching word: <strong>"{selectedFilterWord}"</strong>
            </Alert>
          ) : (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs
                value={moderationTab}
                onChange={(_, val) => setModerationTab(val)}
                sx={{ minHeight: 40 }}
              >
                <Tab
                  label={`All Submissions (${submissions.length})`}
                  value="ALL"
                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }}
                />
                <Tab
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>Auto-Blocked</span>
                      {blockedCount > 0 && (
                        <Chip
                          size="small"
                          label={blockedCount}
                          color="error"
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800 }}
                        />
                      )}
                    </Box>
                  }
                  value="BLOCKED"
                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40 }}
                />
              </Tabs>
            </Box>
          )}

          {/* Search Box */}
          <TextField
            placeholder="Search by student name, email, or submitted word..."
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: m3Tokens.color.outline }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2, bgcolor: '#FFFFFF', borderRadius: '8px' }}
          />

          {/* Submissions Table */}
          {submissions.filter((sub) => {
            if (selectedFilterWord && sub.response_value.toLowerCase().trim() !== selectedFilterWord.toLowerCase().trim()) {
              return false;
            }
            if (!selectedFilterWord && moderationTab === 'BLOCKED' && !sub.is_blocked) {
              return false;
            }
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase().trim();
              const mName = sub.student_name?.toLowerCase().includes(q);
              const mEmail = sub.student_email?.toLowerCase().includes(q);
              const mWord = sub.response_value?.toLowerCase().includes(q);
              return mName || mEmail || mWord;
            }
            return true;
          }).length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '12px', bgcolor: '#FFFFFF', border: `1px solid ${m3Tokens.color.outlineVariant}` }}>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {moderationTab === 'BLOCKED'
                  ? 'No auto-blocked submissions found. All words passed profanity moderation!'
                  : 'No matching submissions found.'}
              </Typography>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${m3Tokens.color.outlineVariant}`, overflow: 'hidden', bgcolor: '#FFFFFF' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#F8F9FA' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      STUDENT
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      SUBMITTED WORD
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      TIME
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.75rem', color: m3Tokens.color.onSurfaceVariant }}>
                      ACTIONS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissions
                    .filter((sub) => {
                      if (selectedFilterWord && sub.response_value.toLowerCase().trim() !== selectedFilterWord.toLowerCase().trim()) {
                        return false;
                      }
                      if (!selectedFilterWord && moderationTab === 'BLOCKED' && !sub.is_blocked) {
                        return false;
                      }
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        const mName = sub.student_name?.toLowerCase().includes(q);
                        const mEmail = sub.student_email?.toLowerCase().includes(q);
                        const mWord = sub.response_value?.toLowerCase().includes(q);
                        return mName || mEmail || mWord;
                      }
                      return true;
                    })
                    .map((item: any) => {
                      const isActionBusy = submissionActionLoading === item.id;
                      return (
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: m3Tokens.color.primary }}>
                                {item.student_name ? item.student_name[0].toUpperCase() : '?'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                  {item.student_name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                                  {item.student_email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 700,
                                  color: item.is_blocked ? m3Tokens.color.error : m3Tokens.color.onSurface,
                                  textDecoration: item.is_blocked ? 'line-through' : 'none',
                                }}
                              >
                                {item.response_value}
                              </Typography>
                              {item.is_blocked && (
                                <Tooltip title={item.blocked_reason || 'Auto-blocked by profanity filter'}>
                                  <Chip
                                    size="small"
                                    color="error"
                                    label="Auto-Blocked"
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                              {item.submitted_at
                                ? new Date(item.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '--'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                              {/* Approve Button for false positives */}
                              {item.is_blocked && (
                                <Tooltip title="Approve if this was a false positive. Word will be added to the live cloud immediately.">
                                  <span>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      disabled={isActionBusy}
                                      startIcon={isActionBusy ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon />}
                                      onClick={() => handleApproveSubmission(item.id)}
                                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', borderRadius: '6px' }}
                                    >
                                      Approve
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}

                              {/* Delete Submission */}
                              {item.is_blocked && (
                                <Tooltip title="Delete submission permanently">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      disabled={isActionBusy}
                                      onClick={() => handleDeleteSubmission(item.id)}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}

                              {/* Mute Student */}
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<BlockIcon />}
                                onClick={() => handleOpenMuteForStudent(item.student_id, item.student_name, item.response_value)}
                                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', borderRadius: '6px' }}
                              >
                                Mute Student
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Paper>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button
            onClick={() => {
              setSubmissionsModalOpen(false);
              setSelectedFilterWord(null);
              setSearchQuery('');
            }}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mute Dialog */}
      <WordCloudMuteDialog
        open={muteDialogOpen}
        onClose={() => {
          setMuteDialogOpen(false);
          setMuteTargetStudentId(undefined);
          setMuteTargetStudentName(undefined);
          setMuteDefaultReason(undefined);
        }}
        classroomId={classroomId}
        studentId={muteTargetStudentId}
        studentName={muteTargetStudentName}
        defaultReason={muteDefaultReason}
        onSuccess={() => {
          fetchSubmissions();
          fetchAnalytics();
        }}
      />
    </Dialog>
  );
};
