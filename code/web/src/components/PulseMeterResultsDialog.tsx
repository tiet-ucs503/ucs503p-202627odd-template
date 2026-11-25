'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  Avatar,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SpeedIcon from '@mui/icons-material/Speed';
import PeopleIcon from '@mui/icons-material/People';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ShieldIcon from '@mui/icons-material/Shield';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

type PulseMeterType = 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';

export interface PulseMeterResultsDialogProps {
  open: boolean;
  onClose: () => void;
  activityId: string | null;
  title?: string;
  type?: PulseMeterType;
}

interface AnalyticsPayload {
  pulsemeter?: { id?: string; title?: string; type?: PulseMeterType; config?: any };
  liveActivity?: { id?: string; status?: string; started_at?: string; ended_at?: string };
  responseCount?: number;
  visibleResponseCount?: number;
  presentCount?: number | null;
  attendancePending?: boolean;
  distribution?: any[];
  blockedCount?: number;
}

interface SubmissionRow {
  id: string;
  student_id?: string;
  student_name?: string;
  student_email?: string;
  response_value?: string;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  submitted_at?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const typeLabel = (type?: string) => {
  switch (type) {
    case 'WORD_CLOUD':
      return 'Word Cloud';
    case 'MCQ':
      return 'Multiple Choice';
    case 'RATING_SCALE':
      return 'Rating Scale';
    default:
      return type || 'PulseMeter';
  }
};

export const PulseMeterResultsDialog: React.FC<PulseMeterResultsDialogProps> = ({
  open,
  onClose,
  activityId,
  title,
  type,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [filterWord, setFilterWord] = useState<string | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const effectiveType: PulseMeterType | undefined = analytics?.pulsemeter?.type || type;
  const effectiveTitle = analytics?.pulsemeter?.title || title || 'PulseMeter Results';
  const distribution = analytics?.distribution || [];
  const responseCount = analytics?.responseCount || 0;
  const presentCount = analytics?.presentCount ?? null;
  const attendancePending = Boolean(analytics?.attendancePending);
  const blockedCount = analytics?.blockedCount || 0;

  const totalVotes = useMemo(
    () => distribution.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    [distribution]
  );

  const mcqChartData = useMemo(
    () =>
      distribution.map((item, index) => {
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
      }),
    [distribution]
  );

  const maxWordCount = useMemo(
    () =>
      distribution.length > 0
        ? Math.max(...distribution.map((d: any) => Number(d.count) || 1))
        : 1,
    [distribution]
  );

  const getWordFontSize = (count: number) => {
    if (maxWordCount <= 1) return 20;
    const minSize = 14;
    const maxSize = 38;
    return Math.round(minSize + ((count - 1) / (maxWordCount - 1)) * (maxSize - minSize));
  };

  const responseRate =
    presentCount && presentCount > 0
      ? Math.min(100, Math.round((responseCount / presentCount) * 100))
      : null;

  const fetchAnalytics = async (showSpinner = true) => {
    if (!activityId) return;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/live-activities/${activityId}/analytics`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnalytics(data as AnalyticsPayload);
      } else {
        setError((data as any)?.error || 'Failed to load PulseMeter results');
      }
    } catch {
      setError('Network error loading PulseMeter results');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!activityId) return;
    setSubmissionsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/live-activities/${activityId}/word-cloud-submissions`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmissions((data as any)?.submissions || []);
      } else {
        setError((data as any)?.error || 'Failed to load word cloud submissions');
      }
    } catch {
      setError('Network error loading word cloud submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (open && activityId) {
      setAnalytics(null);
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId]);

  useEffect(() => {
    if (!open || !activityId) return;
    if (effectiveType === 'WORD_CLOUD') {
      fetchSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId, effectiveType]);

  const handleModeration = async (responseId: string, action: 'approve' | 'delete') => {
    if (!activityId) return;
    setActionLoading(responseId);
    setError(null);
    try {
      const url =
        action === 'approve'
          ? `${API_BASE_URL}/live-activities/${activityId}/responses/${responseId}/approve`
          : `${API_BASE_URL}/live-activities/${activityId}/responses/${responseId}`;
      const res = await fetch(url, {
        method: action === 'approve' ? 'POST' : 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any)?.error || `Failed to ${action} submission`);
        return;
      }
      await Promise.all([fetchAnalytics(false), fetchSubmissions()]);
    } catch {
      setError(`Network error trying to ${action} submission`);
    } finally {
      setActionLoading(null);
    }
  };

  const openSubmissions = (word: string | null, onlyBlocked: boolean) => {
    setFilterWord(word);
    setBlockedOnly(onlyBlocked);
    setSubmissionsOpen(true);
  };

  const visibleSubmissions = submissions.filter((sub) => {
    if (filterWord && (sub.response_value || '').toLowerCase().trim() !== filterWord.toLowerCase().trim()) {
      return false;
    }
    if (!filterWord && blockedOnly && !sub.is_blocked) {
      return false;
    }
    return true;
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle
          sx={{
            bgcolor: '#FFFFFF',
            borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`,
            p: 2,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1.5}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SpeedIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                    {effectiveTitle}
                  </Typography>
                  <Chip
                    label="ENDED"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                  />
                  <Chip
                    label={typeLabel(effectiveType)}
                    size="small"
                    sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem', bgcolor: m3Tokens.color.surfaceVariant }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  {analytics?.liveActivity?.started_at
                    ? `Started ${new Date(analytics.liveActivity.started_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'Historical run'}
                  {activityId ? ` • Activity ${activityId.slice(0, 8)}...` : ''}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={<PeopleIcon sx={{ fontSize: '1rem !important' }} />}
                label={`${responseCount} Responded`}
                color="primary"
                sx={{ fontWeight: 700 }}
              />
              <Tooltip title="Refresh results">
                <span>
                  <IconButton size="small" onClick={() => fetchAnalytics()} disabled={loading}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ mt: 1.5, color: m3Tokens.color.onSurfaceVariant }}>
                Loading preserved results...
              </Typography>
            </Box>
          ) : !analytics ? (
            <Alert severity="info" sx={{ borderRadius: '8px' }}>
              No result data is available for this run.
            </Alert>
          ) : (
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
              <Box sx={{ flex: 1 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                    minHeight: 340,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                    Final Response Distribution
                  </Typography>

                  {effectiveType === 'MCQ' && (
                    <Box>
                      {distribution.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            No multiple-choice responses were recorded for this run.
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={2}>
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
                                      const row = payload[0].payload;
                                      const pct = totalVotes > 0 ? Math.round(((row.count || 0) / totalVotes) * 100) : 0;
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
                                          <Typography variant="caption" sx={{ fontWeight: 800, color: row.color, display: 'block' }}>
                                            {row.displayLabel}
                                          </Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 600, color: m3Tokens.color.onSurface, my: 0.5 }}>
                                            {row.option_text}
                                          </Typography>
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                                            {row.count} {row.count === 1 ? 'vote' : 'votes'} ({pct}%)
                                          </Typography>
                                        </Box>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                  {mcqChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>

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
                              Options Breakdown
                            </Typography>
                            <Stack spacing={1}>
                              {mcqChartData.map((item) => {
                                const pct = totalVotes > 0 ? Math.round(((item.count || 0) / totalVotes) * 100) : 0;
                                return (
                                  <Box
                                    key={item.option_id || item.shortCode}
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
                                      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurface, fontWeight: 600, wordBreak: 'break-word' }}>
                                        {item.option_text}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      size="small"
                                      label={`${item.count || 0} (${pct}%)`}
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
                        </Stack>
                      )}
                    </Box>
                  )}

                  {effectiveType === 'RATING_SCALE' && (
                    <Box sx={{ width: '100%', height: 320 }}>
                      {distribution.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            No rating responses were recorded for this run.
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

                  {(!effectiveType || effectiveType === 'WORD_CLOUD') && (
                    <Box>
                      {distribution.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            No word cloud submissions were recorded for this run.
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
                            {distribution.map((item: any, idx: number) => (
                              <Tooltip
                                key={item.word || idx}
                                title={`"${item.word}" mentioned ${item.count} time${item.count > 1 ? 's' : ''} • Click to inspect contributors`}
                                arrow
                              >
                                <Typography
                                  component="span"
                                  onClick={() => openSubmissions(item.word, false)}
                                  sx={{
                                    fontSize: `${getWordFontSize(Number(item.count))}px`,
                                    fontWeight: 800,
                                    color: chartTokens.palette[idx % chartTokens.palette.length],
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    userSelect: 'none',
                                    '&:hover': { transform: 'scale(1.15)', textDecoration: 'underline' },
                                  }}
                                >
                                  {item.word}
                                </Typography>
                              </Tooltip>
                            ))}
                          </Box>
                          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<VisibilityIcon fontSize="small" />}
                              onClick={() => openSubmissions(null, false)}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                            >
                              Inspect All Submissions ({submissions.length})
                            </Button>
                          </Box>
                        </>
                      )}
                    </Box>
                  )}
                </Paper>
              </Box>

              <Box sx={{ width: { xs: '100%', lg: 320 } }}>
                <Stack spacing={2}>
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
                              Attendance was not finalized when this activity ended. Response totals are still preserved below.
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ) : (
                      <Box sx={{ mb: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                          <Typography variant="h4" sx={{ fontWeight: 900, color: m3Tokens.color.primary }}>
                            {responseRate !== null ? `${responseRate}%` : '--'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            response rate
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={responseRate ?? 0}
                          sx={{ height: 8, borderRadius: 4, mb: 1 }}
                        />
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          <strong>{responseCount}</strong> of <strong>{presentCount}</strong> present students responded
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
                          Present Students:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800 }}>
                          {attendancePending ? 'Pending Resolution' : presentCount ?? '--'}
                        </Typography>
                      </Stack>
                      {effectiveType === 'WORD_CLOUD' && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            Auto-Blocked:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: blockedCount > 0 ? 'error.main' : 'text.primary' }}>
                            {blockedCount}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>

                  {effectiveType === 'WORD_CLOUD' && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '16px',
                        border: `1px solid ${blockedCount > 0 ? m3Tokens.color.error : m3Tokens.color.outlineVariant}`,
                        bgcolor: blockedCount > 0 ? '#FDF2F2' : '#FFFFFF',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <ShieldIcon sx={{ color: blockedCount > 0 ? m3Tokens.color.error : m3Tokens.color.onSurfaceVariant, fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                          Moderation
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 1.25 }}>
                        {blockedCount > 0
                          ? `${blockedCount} submission${blockedCount === 1 ? ' was' : 's were'} auto-blocked. Approve false positives or delete permanently.`
                          : 'Review every word submitted during this run and remove anything inappropriate.'}
                      </Typography>
                      <Stack spacing={1}>
                        {blockedCount > 0 && (
                          <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<ShieldIcon />}
                            onClick={() => openSubmissions(null, true)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                          >
                            Review & Approve ({blockedCount})
                          </Button>
                        )}
                        <Button
                          fullWidth
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openSubmissions(null, false)}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                        >
                          Inspect Submissions ({submissions.length})
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Read-only historical results — this run has ended.
          </Typography>
          <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Word Cloud Submissions Inspector */}
      <Dialog
        open={submissionsOpen}
        onClose={() => {
          setSubmissionsOpen(false);
          setFilterWord(null);
          setBlockedOnly(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <CloudQueueIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, fontSize: '1.1rem' }}>
                {filterWord
                  ? `Submissions for "${filterWord}"`
                  : blockedOnly
                  ? `Auto-Blocked Submissions (${blockedCount})`
                  : 'Word Cloud Submissions Audit'}
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={() => {
                setSubmissionsOpen(false);
                setFilterWord(null);
                setBlockedOnly(false);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#FAFAFA' }}>
          {filterWord && (
            <Alert
              severity="info"
              sx={{ mb: 2, borderRadius: '8px' }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setFilterWord(null)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Show All
                </Button>
              }
            >
              Filtering by submissions matching: <strong>&quot;{filterWord}&quot;</strong>
            </Alert>
          )}

          {submissionsLoading ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : visibleSubmissions.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: '12px',
                bgcolor: '#FFFFFF',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
              }}
            >
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {blockedOnly
                  ? 'No auto-blocked submissions found for this run.'
                  : 'No matching submissions found.'}
              </Typography>
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
                  {visibleSubmissions.map((item) => {
                    const isBusy = actionLoading === item.id;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: m3Tokens.color.primary }}>
                              {item.student_name ? item.student_name[0].toUpperCase() : '?'}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                {item.student_name || 'Unknown student'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                                {item.student_email || '--'}
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
                            {item.is_blocked && (
                              <Tooltip title="Approve this submission as a false positive">
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    disabled={isBusy}
                                    startIcon={isBusy ? <CircularProgress size={12} color="inherit" /> : <CheckCircleIcon />}
                                    onClick={() => handleModeration(item.id, 'approve')}
                                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', borderRadius: '6px' }}
                                  >
                                    Approve
                                  </Button>
                                </span>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete submission permanently">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={isBusy}
                                  onClick={() => handleModeration(item.id, 'delete')}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
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
              setSubmissionsOpen(false);
              setFilterWord(null);
              setBlockedOnly(false);
            }}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
