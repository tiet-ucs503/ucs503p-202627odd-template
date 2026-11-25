'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Chip,
  Stack,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface RosterStudent {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
}

interface ClassroomRosterDialogProps {
  open: boolean;
  onClose: () => void;
  classroom: {
    id: string;
    course_code: string;
    course_name: string;
    section_name: string;
  } | null;
  onRosterUpdated?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const ClassroomRosterDialog: React.FC<ClassroomRosterDialogProps> = ({
  open,
  onClose,
  classroom,
  onRosterUpdated,
}) => {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Student removal confirmation state
  const [studentToRemove, setStudentToRemove] = useState<RosterStudent | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (open && classroom) {
      setSearchQuery('');
      setError(null);
      setSuccessMsg(null);
      fetchRoster();
    }
  }, [open, classroom]);

  const fetchRoster = async () => {
    if (!classroom) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/classrooms/${classroom.id}/roster`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setRoster(data.roster || []);
      } else {
        setError(data.error || 'Failed to fetch roster');
      }
    } catch {
      setError('Network error fetching student roster');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!classroom || !studentToRemove) return;
    setRemoving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/classrooms/${classroom.id}/roster/${studentToRemove.student_id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(`Removed ${studentToRemove.full_name} from section roster.`);
        setStudentToRemove(null);
        fetchRoster();
        if (onRosterUpdated) {
          onRosterUpdated();
        }
      } else {
        setError(data.error || 'Failed to remove student');
      }
    } catch {
      setError('Network error removing student');
    } finally {
      setRemoving(false);
    }
  };

  if (!classroom) return null;

  const filteredRoster = roster.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Enrolled Roster
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                {classroom.course_code}: {classroom.course_name} ({classroom.section_name})
              </Typography>
            </Box>
            <Chip
              label={`${roster.length} ${roster.length === 1 ? 'Student' : 'Students'}`}
              size="small"
              color="primary"
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
              {successMsg}
            </Alert>
          )}

          {/* Search Bar */}
          {roster.length > 0 && (
            <TextField
              size="small"
              placeholder="Search students by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: m3Tokens.color.onSurfaceVariant }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          )}

          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : roster.length === 0 ? (
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, py: 4, textAlign: 'center' }}>
              No students enrolled in this section yet. Share the 6-character join code with your class!
            </Typography>
          ) : filteredRoster.length === 0 ? (
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, py: 4, textAlign: 'center' }}>
              No students found matching &quot;{searchQuery}&quot;.
            </Typography>
          ) : (
            <List sx={{ pt: 0 }}>
              {filteredRoster.map((student, idx) => (
                <React.Fragment key={student.student_id}>
                  <ListItem
                    alignItems="center"
                    secondaryAction={
                      <Tooltip title="Remove student from section">
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => setStudentToRemove(student)}
                          sx={{
                            '&:hover': {
                              backgroundColor: 'rgba(211, 47, 47, 0.08)',
                            },
                          }}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: m3Tokens.color.primary, width: 36, height: 36, fontSize: '0.9rem', fontWeight: 700 }}>
                        {student.full_name ? student.full_name[0].toUpperCase() : 'S'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {student.full_name}
                        </Typography>
                      }
                      secondary={
                        <Typography component="span" variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                          {student.email} &bull; Joined {new Date(student.joined_at).toLocaleDateString()}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < filteredRoster.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Student Removal */}
      <Dialog
        open={Boolean(studentToRemove)}
        onClose={() => !removing && setStudentToRemove(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Remove Student?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Are you sure you want to remove <strong>{studentToRemove?.full_name}</strong> ({studentToRemove?.email}) from {classroom.course_code}: {classroom.section_name}?
          </Typography>
          <Typography variant="caption" sx={{ color: m3Tokens.color.secondary, display: 'block', mt: 1.5 }}>
            Their past attendance records in this section will be retained.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setStudentToRemove(null)}
            disabled={removing}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRemove}
            variant="contained"
            color="error"
            disabled={removing}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {removing ? 'Removing...' : 'Remove Student'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
