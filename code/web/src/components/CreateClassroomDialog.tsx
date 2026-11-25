'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface Course {
  id: string;
  course_code: string;
  course_name: string;
}

interface CreateClassroomDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const CreateClassroomDialog: React.FC<CreateClassroomDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCourses();
    }
  }, [open]);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/courses`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setCourses(data.courses || []);
        if (data.courses?.length > 0) {
          setSelectedCourseId(data.courses[0].id);
        }
      } else {
        setError(data.error || 'Failed to fetch courses');
      }
    } catch {
      setError('Network error fetching courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !sectionName.trim()) {
      setError('Please select a course and enter section name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/classrooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          course_id: selectedCourseId,
          section_name: sectionName.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSectionName('');
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to create classroom');
      }
    } catch {
      setError('Network error creating classroom');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
        Create New Classroom Section
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loadingCourses ? (
            <Stack direction="row" spacing={2} alignItems="center" justify-content="center" sx={{ py: 3 }}>
              <CircularProgress size={24} />
              <span>Loading course catalog...</span>
            </Stack>
          ) : (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel id="course-select-label">Select Course</InputLabel>
                <Select
                  labelId="course-select-label"
                  value={selectedCourseId}
                  label="Select Course"
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  {courses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <strong>{c.course_code}</strong> — {c.course_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Section Name (e.g. Section 3CSE1, Lab A)"
                fullWidth
                required
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Section 3CSE1"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary" disabled={submitting || loadingCourses}>
            {submitting ? 'Creating...' : 'Create Section'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
