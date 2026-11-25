'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import MasksOutlinedIcon from '@mui/icons-material/MasksOutlined';
import { useRequireRole } from '@/hooks/useRequireRole';
import { createDoubt, createTopic, getTopics } from '@/lib/studentApi';
import type { DoubtScope, Topic } from '@/lib/studentTypes';
import { m3Tokens } from '@/theme/tokens';

const SCOPES: Array<{ value: DoubtScope; label: string }> = [
  { value: 'CLASSROOM', label: 'Section' },
  { value: 'COURSE', label: 'Course' },
  { value: 'APP', label: 'Global' },
];

export default function NewDoubtPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const router = useRouter();

  const [courseId, setCourseId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<DoubtScope>('CLASSROOM');
  const [topicId, setTopicId] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const course = query.get('course_id') || '';
    const classroom = query.get('classroom_id') || '';
    setCourseId(course);
    setClassroomId(classroom);
    setScope(classroom ? 'CLASSROOM' : 'COURSE');
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getTopics(courseId);
        if (!cancelled) setTopics(list);
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const submit = async () => {
    setError(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!courseId) {
      setError('Open this page from a classroom to choose a course.');
      return;
    }
    if (!trimmedTitle || !trimmedBody) {
      setError('Please enter a title and description.');
      return;
    }
    if (scope === 'CLASSROOM' && !classroomId) {
      setError('Section-scoped doubts need a classroom. Choose Course or Global.');
      return;
    }

    setSubmitting(true);
    try {
      let resolvedTopicId: string | null = topicId || null;
      if (!resolvedTopicId && newTopic.trim()) {
        const topic = await createTopic(courseId, newTopic);
        resolvedTopicId = topic.id || null;
      }

      const post = await createDoubt({
        course_id: courseId,
        classroom_id: scope === 'CLASSROOM' ? classroomId : null,
        topic_id: resolvedTopicId,
        audience_scope: scope,
        title: trimmedTitle,
        body: trimmedBody,
        is_anonymous: anonymous,
      });

      if (post?.id) {
        router.replace(`/student/doubts/${post.id}`);
      } else {
        router.replace(
          `/student/doubts${classroomId ? `?classroom=${classroomId}` : ''}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your doubt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Ask a doubt
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Be specific. Include what you tried or the concept that is confusing.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
        }}
      >
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <TextField
              label="Question title"
              fullWidth
              required
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 255))}
              placeholder="e.g. Why do we need virtual destructors in C++?"
            />

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                Audience scope
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
                {SCOPES.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    clickable
                    color={scope === item.value ? 'primary' : 'default'}
                    variant={scope === item.value ? 'filled' : 'outlined'}
                    onClick={() => setScope(item.value)}
                    sx={{ fontWeight: 800 }}
                  />
                ))}
              </Box>
            </Box>

            <TextField
              select
              label="Course topic (optional)"
              fullWidth
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <MenuItem value="">No specific topic</MenuItem>
              {topics.map((topic) => (
                <MenuItem key={topic.id} value={topic.id}>
                  {topic.name}
                </MenuItem>
              ))}
            </TextField>

            {!topicId && (
              <TextField
                label="Or create a new topic"
                fullWidth
                value={newTopic}
                onChange={(event) => setNewTopic(event.target.value.slice(0, 80))}
                helperText="Optional. A new course topic will be created."
              />
            )}

            <TextField
              label="Description & code snippet"
              fullWidth
              required
              multiline
              minRows={6}
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, 10000))}
              placeholder="What have you tried? What exactly is confusing?"
            />

            <Card
              variant="outlined"
              sx={{ borderRadius: 2.5, borderColor: m3Tokens.color.outlineVariant }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <MasksOutlinedIcon color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                      Post with a pseudonym
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Masks your real name with a consistent per-course pseudonym.
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={anonymous}
                        onChange={(event) => setAnonymous(event.target.checked)}
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
                  />
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1.25}>
              <Button
                component={Link}
                href={`/student/doubts${
                  classroomId ? `?classroom=${encodeURIComponent(classroomId)}` : ''
                }`}
                variant="outlined"
                fullWidth
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={submit}
                disabled={submitting}
                sx={{ fontWeight: 800, textTransform: 'none' }}
              >
                {submitting ? 'Posting…' : 'Post doubt'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
