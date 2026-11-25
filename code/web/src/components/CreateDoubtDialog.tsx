'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Switch,
  Typography,
  Box,
  Stack,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  InputLabel,
  Paper,
  Chip,
} from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import PublicIcon from '@mui/icons-material/Public';
import SchoolIcon from '@mui/icons-material/School';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import MasksIcon from '@mui/icons-material/Masks';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface CreateDoubtDialogProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  classroomId?: string;
  onSuccess: () => void;
}

interface Topic {
  id: string;
  name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const CreateDoubtDialog: React.FC<CreateDoubtDialogProps> = ({
  open,
  onClose,
  courseId,
  classroomId,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceScope, setAudienceScope] = useState<'CLASSROOM' | 'COURSE' | 'APP'>('CLASSROOM');
  const [topicId, setTopicId] = useState<string>('');
  const [newTopicName, setNewTopicName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && courseId) {
      fetchTopics();
    }
  }, [open, courseId]);

  const fetchTopics = async () => {
    setLoadingTopics(true);
    try {
      const res = await fetch(`${API_BASE_URL}/courses/${courseId}/topics`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.topics) {
        setTopics(data.topics);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Please provide both a title and question description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // If user typed a new custom topic, create it first
      let resolvedTopicId = topicId || null;
      if (!resolvedTopicId && newTopicName.trim()) {
        const topicRes = await fetch(`${API_BASE_URL}/courses/${courseId}/topics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ name: newTopicName.trim() }),
        });
        const topicData = await topicRes.json();
        if (topicRes.ok && topicData.topic) {
          resolvedTopicId = topicData.topic.id;
        }
      }

      const res = await fetch(`${API_BASE_URL}/doubts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          course_id: courseId,
          classroom_id: audienceScope === 'CLASSROOM' ? classroomId : null,
          topic_id: resolvedTopicId,
          audience_scope: audienceScope,
          title: title.trim(),
          body: body.trim(),
          is_anonymous: isAnonymous,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Reset form
        setTitle('');
        setBody('');
        setAudienceScope('CLASSROOM');
        setTopicId('');
        setNewTopicName('');
        setIsAnonymous(false);
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to post question.');
      }
    } catch {
      setError('Network error submitting question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ForumIcon sx={{ color: m3Tokens.color.primary, fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                Ask a Doubt
              </Typography>
              <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Post a question to your section, the entire course, or the global student forum.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2.5}>
            {/* Title */}
            <TextField
              label="Question Title"
              placeholder="e.g. Why does Dijkstra's algorithm fail on negative edge weights?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              sx={{ bgcolor: '#FFFFFF' }}
            />

            {/* Audience Scope Selector */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${m3Tokens.color.outlineVariant}`, bgcolor: '#FFFFFF' }}>
              <FormLabel component="legend" sx={{ fontWeight: 700, fontSize: '0.85rem', color: m3Tokens.color.onSurface, mb: 1 }}>
                Audience Scope (Who can see this question?)
              </FormLabel>
              <RadioGroup
                value={audienceScope}
                onChange={(e) => setAudienceScope(e.target.value as any)}
              >
                <FormControlLabel
                  value="CLASSROOM"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MeetingRoomIcon sx={{ fontSize: 16, color: m3Tokens.color.primary }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Section Only (Classroom)
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Visible only to students and instructor in this specific classroom section.
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1 }}
                />
                <FormControlLabel
                  value="COURSE"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SchoolIcon sx={{ fontSize: 16, color: m3Tokens.color.secondary }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Course-Wide
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Visible across all sections and instructors enrolled in this course.
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1 }}
                />
                <FormControlLabel
                  value="APP"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PublicIcon sx={{ fontSize: 16, color: m3Tokens.color.tertiary }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          Global App
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                        Visible to all ClassPulse users across the university.
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </Paper>

            {/* Topic Selector */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small" sx={{ bgcolor: '#FFFFFF' }}>
                <InputLabel id="topic-select-label">Course Topic (Optional)</InputLabel>
                <Select
                  labelId="topic-select-label"
                  value={topicId}
                  label="Course Topic (Optional)"
                  onChange={(e) => setTopicId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>No specific topic</em>
                  </MenuItem>
                  {topics.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Or create new topic"
                placeholder="e.g. Graph Algorithms"
                value={newTopicName}
                onChange={(e) => {
                  setNewTopicName(e.target.value);
                  if (e.target.value) setTopicId('');
                }}
                fullWidth
                sx={{ bgcolor: '#FFFFFF' }}
              />
            </Stack>

            {/* Body */}
            <TextField
              label="Question Description & Context"
              placeholder="Describe what you tried, any code snippets, or error traces..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              rows={5}
              fullWidth
              required
              sx={{ bgcolor: '#FFFFFF' }}
            />

            {/* Pseudonymity Switch */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${m3Tokens.color.outlineVariant}`, bgcolor: '#FFFFFF' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MasksIcon sx={{ color: m3Tokens.color.primary }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                      Post with Anonymous Pseudonym
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, display: 'block', mt: 0.5 }}>
                    Your identity will be masked behind a consistent per-course pseudonym (e.g. <em>QuantumFalcon24</em>). Course instructors retain reveal capability for academic integrity.
                  </Typography>
                </Box>
                <Switch
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  color="primary"
                />
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={submitting}
            startIcon={submitting && <CircularProgress size={16} color="inherit" />}
            sx={{ textTransform: 'none', fontWeight: 700, px: 3, borderRadius: '8px' }}
          >
            {submitting ? 'Posting...' : 'Post Question'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
