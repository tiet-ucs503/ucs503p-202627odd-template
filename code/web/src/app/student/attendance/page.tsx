'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useRequireRole } from '@/hooks/useRequireRole';
import { getAttendance } from '@/lib/studentApi';
import type {
  AttendanceOverview,
  AttendanceSummary,
} from '@/lib/studentTypes';
import {
  formatAcl,
  formatDate,
  formatDateTime,
  formatPercent,
  recordsForClassroom,
} from '@/lib/attendanceFormat';
import { m3Tokens } from '@/theme/tokens';

export default function StudentAttendancePage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );

  const [data, setData] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<AttendanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAttendance());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const overall = data?.overall;
  const drilldownRecords = drilldown
    ? recordsForClassroom(data?.records ?? [], drilldown.classroom_id)
    : [];

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your attendance across every enrolled classroom.
          </Typography>
        </Box>
        <IconButton aria-label="Refresh attendance" onClick={load} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && !data ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : !data ? null : (
        <>
          <Card
            sx={{
              borderRadius: m3Tokens.shape.large,
              border: `1px solid ${m3Tokens.color.outlineVariant}`,
              boxShadow: 'none',
              mb: 2.5,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 74,
                    height: 74,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: m3Tokens.color.primaryContainer,
                    color: m3Tokens.color.onPrimaryContainer,
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ fontSize: '1.35rem', fontWeight: 900 }}>
                    {formatPercent(data.overall.attendance_percentage)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Overall attendance
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.overall.attended_sessions} of{' '}
                    {data.overall.total_sessions} completed sessions attended
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, data.overall.attendance_percentage))}
                    sx={{
                      mt: 1.25,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: m3Tokens.color.surfaceVariant,
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.25 }}>
            By classroom
          </Typography>

          {data.summary.length === 0 ? (
            <EmptyBlock
              icon={<SchoolIcon />}
              title="No classrooms yet"
              body="Join a classroom to start tracking attendance."
            />
          ) : (
            <Stack spacing={1.25}>
              {data.summary.map((summary) => (
                <Card
                  key={summary.classroom_id}
                  sx={{
                    borderRadius: m3Tokens.shape.medium,
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    boxShadow: 'none',
                  }}
                >
                  <CardActionArea onClick={() => setDrilldown(summary)}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap>
                            {summary.course_code}: {summary.course_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {summary.section_name} · {summary.teacher_name}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 900, color: m3Tokens.color.primary, lineHeight: 1.1 }}
                          >
                            {formatPercent(summary.attendance_percentage)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {summary.attended_sessions}/{summary.total_sessions}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          )}

          <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 3, mb: 1.25 }}>
            Recent records
          </Typography>

          {data.records.length === 0 ? (
            <EmptyBlock
              icon={<EventAvailableIcon />}
              title="No attendance records"
              body="Scanned sessions will appear here with their capture latency."
            />
          ) : (
            <Stack spacing={1}>
              {data.records.slice(0, 20).map((record) => (
                <Card
                  key={record.id}
                  sx={{
                    borderRadius: m3Tokens.shape.medium,
                    border: `1px solid ${m3Tokens.color.outlineVariant}`,
                    boxShadow: 'none',
                  }}
                >
                  <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 22 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {record.course_code}: {record.course_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(
                            record.session_started_at ?? record.validated_at
                          )}{' '}
                          · {record.section_name}
                        </Typography>
                      </Box>
                      <Chip
                        label="PRESENT"
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          bgcolor: '#E8F5E9',
                          color: '#2E7D32',
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.75, pl: 4 }}>
                      <Typography variant="caption" color="text.secondary">
                        ACL: {formatAcl(record.acl_ms)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      <Dialog
        open={!!drilldown}
        onClose={() => setDrilldown(null)}
        fullWidth
        maxWidth="sm"
        fullScreen={false}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>
          {drilldown?.course_code}: {drilldown?.course_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            {drilldown?.section_name} · {drilldown?.teacher_name}
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {drilldownRecords.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
              No session logs found for this course yet.
            </Typography>
          ) : (
            <List disablePadding>
              {drilldownRecords.map((record) => (
                <ListItem key={record.id} disableGutters divider>
                  <ListItemText
                    primary={formatDate(
                      record.session_started_at ?? record.validated_at
                    )}
                    secondary={`Teacher: ${record.teacher_name || 'Instructor'} · ACL: ${formatAcl(
                      record.acl_ms
                    )}`}
                    primaryTypographyProps={{ fontWeight: 800, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Chip
                    label={record.status}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.62rem',
                      bgcolor: '#E8F5E9',
                      color: '#2E7D32',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function EmptyBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        border: `1px dashed ${m3Tokens.color.outlineVariant}`,
        borderRadius: m3Tokens.shape.large,
        color: m3Tokens.color.onSurfaceVariant,
      }}
    >
      <Box sx={{ fontSize: 40, mb: 0.5, opacity: 0.7 }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, color: m3Tokens.color.onSurface }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {body}
      </Typography>
    </Box>
  );
}
