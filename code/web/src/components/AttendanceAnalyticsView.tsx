'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import PeopleIcon from '@mui/icons-material/People';
import EventNoteIcon from '@mui/icons-material/EventNote';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import EmailIcon from '@mui/icons-material/Email';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditIcon from '@mui/icons-material/Edit';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { m3Tokens, chartTokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';
import { apiFetch, readJson } from '@/lib/api';

interface AttendanceAnalyticsViewProps {
  classroomId: string;
}

interface StudentStat {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: string;
  avg_acl_ms: string | null;
  last_attendance_at: string | null;
}

interface SessionRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_live?: boolean;
  present_count: number;
  enrolled_count: number;
  avg_acl_ms: string | null;
}

interface DrilldownSession {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  /** False when the session started before the student enrolled. */
  eligible?: boolean;
  status: string;
  validated_at: string | null;
  acl_ms: number | null;
}

/** A session still counts as live when the backend flags it or it has not ended. */
const isSessionLive = (session: SessionRecord): boolean =>
  session.is_live === true || session.ended_at == null;

interface ClassroomStats {
  total_sessions: number;
  total_enrolled: number;
  average_attendance_percentage: number;
  average_acl_ms: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const AttendanceAnalyticsView: React.FC<AttendanceAnalyticsViewProps> = ({ classroomId }) => {
  const [stats, setStats] = useState<ClassroomStats | null>(null);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [classroomInfo, setClassroomInfo] = useState<any>(null);
  // `loading` is reserved for the initial/full-page load. Background refreshes
  // (for example after an override) must not replace the mounted page or dialog.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request identity guards so a slow response for a previous section/student
  // can never overwrite the current view.
  const analyticsSeqRef = useRef(0);
  const drilldownSeqRef = useRef(0);

  // Export Menu state
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Warning Email Dialog state
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // Student Drilldown Modal state
  const [drilldownStudent, setDrilldownStudent] = useState<StudentStat | null>(null);
  const [drilldownSessions, setDrilldownSessions] = useState<DrilldownSession[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [overridingSessionId, setOverridingSessionId] = useState<string | null>(null);

  // Toast / Snackbar feedback
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('success');

  const fetchAnalytics = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      const seq = ++analyticsSeqRef.current;

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await apiFetch(`/attendance/classroom/${classroomId}/summary`);
        const data = await readJson<{
          stats?: ClassroomStats;
          students?: StudentStat[];
          sessions?: SessionRecord[];
          classroom?: any;
          error?: string;
        }>(res);

        // A newer request (section change or manual refresh) already started.
        if (seq !== analyticsSeqRef.current) return;

        if (res.ok && data) {
          setStats(data.stats || null);
          setStudents(data.students || []);
          setSessions(data.sessions || []);
          setClassroomInfo(data.classroom || null);
        } else if (background) {
          setSnackbarSeverity('error');
          setSnackbarMessage(data?.error || 'Failed to refresh attendance analytics.');
        } else {
          setError(data?.error || 'Failed to load attendance analytics');
        }
      } catch (err) {
        if (seq !== analyticsSeqRef.current) return;
        console.error('Error fetching analytics:', err);
        if (background) {
          setSnackbarSeverity('error');
          setSnackbarMessage('Background refresh failed. Showing the last loaded data.');
        } else {
          setError('Network error loading attendance analytics');
        }
      } finally {
        if (seq === analyticsSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [classroomId]
  );

  useEffect(() => {
    if (classroomId) {
      // Switching sections must not leave the previous student's drill-down open.
      setDrilldownStudent(null);
      setDrilldownSessions([]);
      setLoadingDrilldown(false);
      fetchAnalytics();
    }
    return () => {
      // Ignore any in-flight responses that belong to the previous section.
      analyticsSeqRef.current += 1;
      drilldownSeqRef.current += 1;
    };
  }, [classroomId, fetchAnalytics]);

  const handleOpenStudentDrilldown = async (student: StudentStat) => {
    const seq = ++drilldownSeqRef.current;
    setDrilldownStudent(student);
    // Never show the previous student's sessions while the new request loads.
    setDrilldownSessions([]);
    setLoadingDrilldown(true);

    try {
      const res = await apiFetch(
        `/attendance/classroom/${classroomId}/student/${student.student_id}`
      );
      const data = await readJson<{ sessions?: DrilldownSession[]; error?: string }>(res);
      if (seq !== drilldownSeqRef.current) return;

      if (!res.ok) {
        setSnackbarSeverity('error');
        setSnackbarMessage(data?.error || 'Failed to load student attendance.');
        return;
      }

      setDrilldownSessions(data?.sessions || []);
    } catch (err) {
      if (seq !== drilldownSeqRef.current) return;
      console.error('Error fetching student drilldown:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Network error loading student attendance.');
    } finally {
      if (seq === drilldownSeqRef.current) setLoadingDrilldown(false);
    }
  };

  const handleCloseDrilldown = () => {
    // Invalidate any in-flight drill-down so a late response cannot populate
    // the dialog after it has been dismissed.
    drilldownSeqRef.current += 1;
    setDrilldownStudent(null);
    setDrilldownSessions([]);
    setLoadingDrilldown(false);
  };

  // 1. Export Handlers (CSV & Excel)
  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportAnchorEl(null);
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/export?format=${format}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const courseCode = classroomInfo?.course_code || 'Course';
      const sectionName = classroomInfo?.section_name || 'Section';
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `ClassPulse_${courseCode}_${sectionName}_${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSnackbarSeverity('success');
      setSnackbarMessage(`Successfully downloaded attendance matrix as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export error:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Failed to download attendance export.');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Manual Attendance Override Handler
  const handleToggleOverride = async (sessionId: string, currentStatus: string) => {
    if (!drilldownStudent) return;
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    setOverridingSessionId(sessionId);

    try {
      const res = await fetch(`${API_BASE_URL}/attendance/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          session_id: sessionId,
          student_id: drilldownStudent.student_id,
          status: newStatus,
        }),
      });

      if (res.ok) {
        // Optimistically update the drilldown session list
        setDrilldownSessions((prev) =>
          prev.map((s) =>
            s.session_id === sessionId
              ? {
                  ...s,
                  status: newStatus,
                  validated_at: newStatus === 'PRESENT' ? new Date().toISOString() : null,
                }
              : s
          )
        );

        setSnackbarSeverity('success');
        setSnackbarMessage(`Manually marked ${drilldownStudent.full_name} as ${newStatus} for this session.`);
        // Refresh classroom stats without unmounting the page or this dialog.
        fetchAnalytics({ background: true });
      } else {
        const errorData = await res.json();
        setSnackbarSeverity('error');
        setSnackbarMessage(errorData.error || 'Failed to update attendance status.');
      }
    } catch (err) {
      console.error('Error updating override:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Error connecting to server.');
    } finally {
      setOverridingSessionId(null);
    }
  };

  // 3. Send Email Warnings Handler
  const handleSendEmailWarnings = async () => {
    setIsSendingEmails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attendance/classroom/${classroomId}/send-warnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ threshold: 75.0 }),
      });

      const data = await res.json();
      if (res.ok) {
        setWarningDialogOpen(false);
        setSnackbarSeverity('success');
        setSnackbarMessage(data.message || `Dispatched email warnings to students with <75% attendance.`);
      } else {
        setSnackbarSeverity('error');
        setSnackbarMessage(data.error || 'Failed to dispatch email warnings.');
      }
    } catch (err) {
      console.error('Error sending warning emails:', err);
      setSnackbarSeverity('error');
      setSnackbarMessage('Error sending warning emails.');
    } finally {
      setIsSendingEmails(false);
    }
  };

  // Only students who have had at least one session since enrolling can be
  // below the threshold. This matches the backend warning query, which ignores
  // students who joined after the classroom's sessions took place.
  const lowAttendanceStudents = students.filter(
    (s) =>
      Number(s.total_sessions ?? 0) > 0 &&
      parseFloat(s.attendance_percentage || '0') < 75.0
  );

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 1 }}>
          Loading section attendance metrics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ borderRadius: '10px', alignItems: 'center' }}
        action={
          <Button color="inherit" size="small" onClick={() => fetchAnalytics()} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Retry
          </Button>
        }
      >
        <strong>Could not load attendance analytics.</strong> {error}
      </Alert>
    );
  }

  // PF-1: only completed sessions count toward analytics. The session that is
  // still running stays visible in Session History (with its live headcount)
  // but is excluded from turnout, latency, and the "Sessions Conducted" totals.
  const completedSessions = sessions.filter((s) => !isSessionLive(s));
  const completedSessionCount = completedSessions.length;
  const noSessions = completedSessionCount === 0;

  // Process chronological sessions data for Recharts visualizations
  const chronologicalSessions = [...completedSessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  const attendanceTrendData = chronologicalSessions.map((s, idx) => {
    // Turnout uses the roster that existed when the session started, so a
    // student who enrolled later is not retroactively counted as absent.
    const sessionEnrolledCount = Number(s.enrolled_count ?? stats?.total_enrolled ?? 0);
    const rate = sessionEnrolledCount > 0
      ? Math.min(100, Math.round((s.present_count / sessionEnrolledCount) * 100))
      : 0;
    const dateObj = new Date(s.started_at);
    const shortDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const acl = s.avg_acl_ms ? parseInt(s.avg_acl_ms, 10) : 0;

    return {
      name: `Session #${idx + 1}`,
      label: `S${idx + 1} (${shortDate})`,
      date: shortDate,
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      present: s.present_count,
      total: sessionEnrolledCount,
      rate: rate,
      acl_ms: acl,
    };
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Top Header Controls (Export & Email Warnings) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
            {classroomInfo ? `${classroomInfo.course_code} — ${classroomInfo.section_name}` : 'Section Analytics'}
          </Typography>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Real-time anti-proxy attendance tracking, export reports, and student management
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Email Warning Action Button */}
          <Button
            variant="outlined"
            color="warning"
            startIcon={<EmailIcon />}
            onClick={() => setWarningDialogOpen(true)}
            disabled={students.length === 0 || completedSessionCount === 0}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            Email Warnings ({lowAttendanceStudents.length})
          </Button>

          {/* Export Dropdown Button */}
          <Button
            variant="contained"
            startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
            disabled={isExporting || students.length === 0}
            sx={{
              fontWeight: 700,
              bgcolor: m3Tokens.color.primary,
              borderRadius: '8px',
              textTransform: 'none',
              '&:hover': { bgcolor: '#4F378B' },
            }}
          >
            Export Attendance
          </Button>
          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={() => setExportAnchorEl(null)}
            PaperProps={{
              sx: { borderRadius: '10px', boxShadow: '0px 4px 20px rgba(0,0,0,0.08)', minWidth: 200 },
            }}
          >
            <MenuItem onClick={() => handleExport('xlsx')}>
              <ListItemIcon>
                <TableChartIcon fontSize="small" sx={{ color: '#1B5E20' }} />
              </ListItemIcon>
              <ListItemText primary="Export as Excel (.xlsx)" secondary="Formatted attendance sheet" />
            </MenuItem>
            <MenuItem onClick={() => handleExport('csv')}>
              <ListItemIcon>
                <InsertDriveFileIcon fontSize="small" sx={{ color: m3Tokens.color.primary }} />
              </ListItemIcon>
              <ListItemText primary="Export as CSV" secondary="Universal matrix format" />
            </MenuItem>
          </Menu>

          <IconButton
            size="small"
            onClick={() => fetchAnalytics({ background: true })}
            title="Refresh Data"
            disabled={refreshing}
          >
            {refreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      {/* Low Attendance Warning Alert Banner */}
      {lowAttendanceStudents.length > 0 && completedSessionCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{
            mb: 3,
            borderRadius: '10px',
            border: '1px solid #FFE082',
            bgcolor: '#FFF8E1',
            '& .MuiAlert-message': { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#E65100' }}>
              Attendance Shortage Warning ({lowAttendanceStudents.length} student{lowAttendanceStudents.length > 1 ? 's' : ''} below 75%)
            </Typography>
            <Typography variant="caption" sx={{ color: '#6D4C41' }}>
              These students are at risk of exam debarment. You can notify them immediately via email advisory.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<EmailIcon />}
            onClick={() => setWarningDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none', ml: 2 }}
          >
            Send Emails
          </Button>
        </Alert>
      )}

      {/* 1. Metric Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Class Attendance Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Class Attendance Rate
              </Typography>
              <TrendingUpIcon sx={{ color: m3Tokens.color.primary, fontSize: 20 }} />
            </Stack>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: noSessions
                  ? m3Tokens.color.onSurface
                  : (stats?.average_attendance_percentage ?? 0) >= 75
                  ? 'success.main'
                  : 'warning.main',
              }}
            >
              {noSessions ? '—' : `${stats?.average_attendance_percentage ?? 0}%`}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              {noSessions ? 'No sessions yet' : `Across ${completedSessionCount} total sessions`}
            </Typography>
          </Paper>
        </Grid>

        {/* Total Sessions Conducted */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Sessions Conducted
              </Typography>
              <EventNoteIcon sx={{ color: m3Tokens.color.secondary, fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {noSessions ? '-' : completedSessionCount}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Anti-Proxy QR verified
            </Typography>
          </Paper>
        </Grid>

        {/* Total Enrolled */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Enrolled Students
              </Typography>
              <PeopleIcon sx={{ color: m3Tokens.color.primary, fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {stats?.total_enrolled ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Registered in section
            </Typography>
          </Paper>
        </Grid>

        {/* Avg Capture Latency (ACL) */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: '12px',
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              bgcolor: '#FFFFFF',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textTransform: 'uppercase' }}>
                Avg Capture Latency (ACL)
              </Typography>
              <FlashOnIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              {noSessions || !stats?.average_acl_ms ? '—' : `${stats.average_acl_ms}ms`}
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              {noSessions ? 'No sessions yet' : 'Scan-to-validation speed'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 2. Visual Analytics Charts (Recharts) */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Chart A: Attendance % Trend Across Sessions */}
        <Grid item xs={12} md={7}>
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
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShowChartIcon sx={{ color: chartTokens.primary, fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                    Attendance Turnout Trend
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  Turnout percentage over chronological sessions with 75% threshold
                </Typography>
              </Box>
            </Stack>

            {attendanceTrendData.length === 0 ? (
              <Box sx={{ flexGrow: 1, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  No session attendance history to chart yet.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartTokens.primary} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={chartTokens.primary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={chartTokens.axis}
                      tick={{ fill: chartTokens.axis, fontSize: 11 }}
                      axisLine={{ stroke: chartTokens.tooltipBorder }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      unit="%"
                      stroke={chartTokens.axis}
                      tick={{ fill: chartTokens.axis, fontSize: 11 }}
                      axisLine={{ stroke: chartTokens.tooltipBorder }}
                    />
                    <ReferenceLine
                      y={75}
                      stroke={chartTokens.error}
                      strokeDasharray="4 4"
                      label={{
                        value: '75% Threshold',
                        fill: chartTokens.error,
                        position: 'insideTopRight',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <Paper
                              elevation={3}
                              sx={{
                                p: 1.5,
                                borderRadius: '8px',
                                border: `1px solid ${chartTokens.tooltipBorder}`,
                                bgcolor: chartTokens.tooltipBg,
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                {data.name} • {data.date}
                              </Typography>
                              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 0.5 }}>
                                Time: {data.time}
                              </Typography>
                              <Divider sx={{ my: 0.5 }} />
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: chartTokens.primary }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: chartTokens.primary }}>
                                  Turnout: {data.rate}% ({data.present} / {data.total} students)
                                </Typography>
                              </Stack>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="Attendance Rate"
                      stroke={chartTokens.primary}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#attendanceGradient)"
                      dot={{ r: 4, fill: chartTokens.primary, strokeWidth: 2, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6, fill: chartTokens.primary }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Chart B: ACL (Capture Latency) Distribution Across Sessions */}
        <Grid item xs={12} md={5}>
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
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BarChartIcon sx={{ color: chartTokens.secondary, fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                    Avg Capture Latency (ACL)
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  Scan-to-validation response speed in milliseconds
                </Typography>
              </Box>
            </Stack>

            {attendanceTrendData.length === 0 ? (
              <Box sx={{ flexGrow: 1, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  No session latency metrics recorded yet.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={chartTokens.axis}
                      tick={{ fill: chartTokens.axis, fontSize: 11 }}
                      axisLine={{ stroke: chartTokens.tooltipBorder }}
                    />
                    <YAxis
                      unit="ms"
                      stroke={chartTokens.axis}
                      tick={{ fill: chartTokens.axis, fontSize: 11 }}
                      axisLine={{ stroke: chartTokens.tooltipBorder }}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <Paper
                              elevation={3}
                              sx={{
                                p: 1.5,
                                borderRadius: '8px',
                                border: `1px solid ${chartTokens.tooltipBorder}`,
                                bgcolor: chartTokens.tooltipBg,
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                {data.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mb: 0.5 }}>
                                Date: {data.date} at {data.time}
                              </Typography>
                              <Divider sx={{ my: 0.5 }} />
                              <Stack direction="row" spacing={1} alignItems="center">
                                <FlashOnIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                                <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                                  Avg Latency: {data.acl_ms > 0 ? `${data.acl_ms}ms` : 'No scans recorded'}
                                </Typography>
                              </Stack>
                            </Paper>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="acl_ms"
                      name="Capture Latency"
                      fill={chartTokens.secondary}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 3. Per-Student Attendance Breakdown Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
          mb: 3.5,
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
              Student Attendance Performance
            </Typography>
            <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Individual attendance rate, scan latencies, and manual override controls
            </Typography>
          </Box>
        </Box>
        <Divider />

        {students.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              No students enrolled in this section yet.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="medium">
              <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Attended</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, width: 220 }}>Rate %</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>Avg ACL</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => {
                  const pct = parseFloat(student.attendance_percentage || '0');
                  const studentTotalSessions = Number(student.total_sessions ?? 0);
                  const hasStudentSessions = studentTotalSessions > 0;
                  const isShortage = hasStudentSessions && pct < 75.0;
                  return (
                    <TableRow key={student.student_id} hover>
                      <TableCell sx={{ fontWeight: 600, color: m3Tokens.color.onSurface }}>
                        {student.full_name}
                      </TableCell>
                      <TableCell sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        {student.email}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${student.attended_sessions} / ${studentTotalSessions}`}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: m3Tokens.color.surfaceVariant }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: hasStudentSessions ? (pct >= 75 ? 'success.main' : 'error.main') : m3Tokens.color.onSurfaceVariant,
                              }}
                            >
                              {hasStudentSessions ? `${pct}%` : '—'}
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={hasStudentSessions ? Math.min(100, pct) : 0}
                            color={hasStudentSessions ? (pct >= 75 ? 'success' : 'error') : 'inherit'}
                            sx={{ height: 6, borderRadius: '3px' }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {!hasStudentSessions ? (
                          <Chip
                            label="No sessions since joining"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        ) : isShortage ? (
                          <Chip
                            label="Shortage (<75%)"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            label="Eligible"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {student.avg_acl_ms ? (
                          <Chip
                            icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                            label={`${student.avg_acl_ms}ms`}
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleOpenStudentDrilldown(student)}
                          sx={{ fontWeight: 600, textTransform: 'none' }}
                        >
                          View & Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 3. Past Sessions Timeline */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
            Session History & Latency Log
          </Typography>
          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Chronological log of conducted sessions with headcount and capture latencies
          </Typography>
        </Box>
        <Divider />

        {sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              No attendance sessions conducted yet for this section.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Students Present</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Avg ACL Latency</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s, idx) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      Session #{sessions.length - idx} • {new Date(s.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {isSessionLive(s) ? (
                        <Stack spacing={0.25}>
                          <Chip label="ACTIVE" color="error" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, alignSelf: 'flex-start' }} />
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.65rem', fontWeight: 600 }}>
                            In progress — not yet counted
                          </Typography>
                        </Stack>
                      ) : (
                        <Chip label="COMPLETED" color="default" size="small" sx={{ fontSize: '0.65rem', fontWeight: 700 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${s.present_count} / ${s.enrolled_count ?? stats?.total_enrolled ?? 0} present`}
                        color={s.present_count > 0 ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      {s.avg_acl_ms ? (
                        <Chip
                          icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                          label={`${s.avg_acl_ms}ms`}
                          size="small"
                          color="secondary"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 4. Student Attendance Drilldown & Manual Override Modal */}
      <Dialog
        open={Boolean(drilldownStudent)}
        onClose={handleCloseDrilldown}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {drilldownStudent?.full_name}
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {drilldownStudent?.email} • Attendance History & Manual Status Override
              </Typography>
            </Box>
            <IconButton size="small" onClick={handleCloseDrilldown}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, bgcolor: m3Tokens.color.background }}>
          {loadingDrilldown ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : drilldownSessions.length === 0 ? (
            <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: m3Tokens.color.onSurfaceVariant }}>
              No session records found for this section.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {drilldownSessions.some((s) => s.eligible === false) && (
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                  Sessions that started before this student enrolled are shown for transparency and cannot be overridden.
                </Typography>
              )}
              {drilldownSessions.map((s, idx) => {
                // `eligible === false` means the session started before the
                // student enrolled, so it must not look like an absence.
                const isEligible = s.eligible !== false;
                const isPresent = isEligible && s.status === 'PRESENT';
                const isOverriding = overridingSessionId === s.session_id;

                return (
                  <Paper
                    key={s.session_id || idx}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: '8px',
                      border: `1px solid ${m3Tokens.color.outlineVariant}`,
                      bgcolor: '#FFFFFF',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                          Session #{drilldownSessions.length - idx} • {new Date(s.started_at).toLocaleDateString()} at {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {!isEligible && (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.25, fontWeight: 600 }}>
                            Enrolled after this session
                          </Typography>
                        )}
                        {isPresent && s.validated_at && (
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.25 }}>
                            Validated at {new Date(s.validated_at).toLocaleTimeString()}
                          </Typography>
                        )}
                        {isEligible && !isPresent && (
                          <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.25, fontWeight: 600 }}>
                            Not recorded / Absent
                          </Typography>
                        )}
                      </Box>

                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {isPresent && s.acl_ms != null && (
                          <Chip
                            icon={<FlashOnIcon sx={{ fontSize: '0.75rem !important' }} />}
                            label={`ACL: ${s.acl_ms}ms`}
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}
                        {isEligible ? (
                          <Chip
                            icon={isPresent ? <CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} /> : <CancelIcon sx={{ fontSize: '0.85rem !important' }} />}
                            label={s.status}
                            color={isPresent ? 'success' : 'default'}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            label="NOT ENROLLED"
                            color="default"
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        )}

                        {/* Manual Override Action Button — only for sessions the
                            student was enrolled for. */}
                        {isEligible && (
                          <Button
                            size="small"
                            variant={isPresent ? 'outlined' : 'contained'}
                            color={isPresent ? 'error' : 'success'}
                            startIcon={isOverriding ? <CircularProgress size={14} color="inherit" /> : <EditIcon fontSize="small" />}
                            disabled={isOverriding}
                            onClick={() => handleToggleOverride(s.session_id, s.status)}
                            sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'none', py: 0.5 }}
                          >
                            {isPresent ? 'Mark Absent' : 'Mark Present'}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={handleCloseDrilldown} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* 5. Send Email Warnings Preview Modal */}
      <Dialog
        open={warningDialogOpen}
        onClose={() => !isSendingEmails && setWarningDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Dispatch Attendance Shortage Warning Emails
            </Typography>
            <IconButton size="small" onClick={() => setWarningDialogOpen(false)} disabled={isSendingEmails}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, bgcolor: m3Tokens.color.background }}>
          <Typography variant="body2" sx={{ mb: 2, color: m3Tokens.color.onSurface }}>
            The following <strong>{lowAttendanceStudents.length}</strong> student{lowAttendanceStudents.length === 1 ? '' : 's'} have cumulative attendance below the mandatory <strong>75%</strong> requirement and will receive an official advisory email:
          </Typography>

          {lowAttendanceStudents.length === 0 ? (
            <Alert severity="success" sx={{ borderRadius: '8px' }}>
              All enrolled students currently meet or exceed the 75% attendance threshold!
            </Alert>
          ) : (
            <Paper elevation={0} sx={{ border: `1px solid ${m3Tokens.color.outlineVariant}`, borderRadius: '8px', maxHeight: 260, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: m3Tokens.color.surfaceVariant }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Attendance %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowAttendanceStudents.map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell sx={{ fontWeight: 600 }}>{s.full_name}</TableCell>
                      <TableCell sx={{ color: m3Tokens.color.onSurfaceVariant, fontSize: '0.8rem' }}>{s.email}</TableCell>
                      <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: 'error.main' }}>
                        {s.attendance_percentage}% ({s.attended_sessions}/{s.total_sessions})
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: m3Tokens.color.onSurfaceVariant }}>
            • Emails contain official course details, current attendance statistics, and advisory notices to contact the instructor.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={() => setWarningDialogOpen(false)} disabled={isSendingEmails} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSendEmailWarnings}
            variant="contained"
            color="warning"
            startIcon={isSendingEmails ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
            disabled={isSendingEmails || lowAttendanceStudents.length === 0}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            {isSendingEmails ? 'Dispatching Emails...' : `Send Warning Emails (${lowAttendanceStudents.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={5000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarMessage(null)}
          severity={snackbarSeverity}
          sx={{ width: '100%', borderRadius: '8px', fontWeight: 600 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
