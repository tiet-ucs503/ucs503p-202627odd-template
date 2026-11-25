'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import SearchIcon from '@mui/icons-material/Search';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import MasksOutlinedIcon from '@mui/icons-material/MasksOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  getClassrooms,
  getDoubts,
  getTopics,
  toggleHelpful,
} from '@/lib/studentApi';
import type { Classroom, DoubtPost, Topic } from '@/lib/studentTypes';
import ClassroomSelect from '@/components/student/ClassroomSelect';
import { m3Tokens } from '@/theme/tokens';

const SCOPES = [
  { value: '', label: 'All scopes' },
  { value: 'CLASSROOM', label: 'Section' },
  { value: 'COURSE', label: 'Course-wide' },
  { value: 'APP', label: 'Global' },
];

export default function StudentDoubtsPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const router = useRouter();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<DoubtPost[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState('');
  const [topicId, setTopicId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === selectedId) ?? null,
    [classrooms, selectedId]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingClassrooms(true);
      try {
        const list = await getClassrooms();
        if (cancelled) return;
        setClassrooms(list);
        const requested = new URLSearchParams(window.location.search).get(
          'classroom'
        );
        setSelectedId(
          requested && list.some((item) => item.id === requested)
            ? requested
            : list[0]?.id ?? ''
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load classrooms'
          );
        }
      } finally {
        if (!cancelled) setLoadingClassrooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedClassroom) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getTopics(selectedClassroom.course_id);
        if (!cancelled) setTopics(list);
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClassroom]);

  const loadPosts = useCallback(async () => {
    if (!selectedClassroom) return;
    setLoadingPosts(true);
    setError(null);
    try {
      setPosts(
        await getDoubts({
          courseId: selectedClassroom.course_id,
          classroomId: selectedId,
          scope: scope || undefined,
          topicId: topicId || null,
          status,
          sortBy,
          search: debouncedSearch,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load questions');
    } finally {
      setLoadingPosts(false);
    }
  }, [
    debouncedSearch,
    scope,
    selectedClassroom,
    selectedId,
    sortBy,
    status,
    topicId,
  ]);

  useEffect(() => {
    if (!selectedClassroom) return;
    void loadPosts();
  }, [loadPosts, selectedClassroom]);

  const handleHelpful = async (post: DoubtPost) => {
    try {
      const result = await toggleHelpful('POST', post.id);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                user_has_marked_helpful: result.marked,
                helpful_count: result.helpful_count,
              }
            : item
        )
      );
    } catch {
      // Keep the previous count; the next refresh reconciles.
    }
  };

  if (authLoading || !user) {
    return (
      <Box sx={{ minHeight: '50dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadingClassrooms) {
    return (
      <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (classrooms.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <ForumOutlinedIcon sx={{ fontSize: 48, color: m3Tokens.color.outline, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          No classrooms yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Join a classroom to view and ask doubts.
        </Typography>
        <Button component={Link} href="/student" variant="contained">
          Join a classroom
        </Button>
      </Box>
    );
  }

  const createHref = selectedClassroom
    ? `/student/doubts/new?course_id=${encodeURIComponent(
        selectedClassroom.course_id
      )}&classroom_id=${encodeURIComponent(selectedId)}`
    : '/student/doubts/new';

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Doubt forum
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ask questions and help your classmates.
          </Typography>
        </Box>
        <Button
          component={Link}
          href={createHref}
          variant="contained"
          size="small"
          startIcon={<AddCommentIcon />}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          Ask
        </Button>
      </Stack>

      <ClassroomSelect
        classrooms={classrooms}
        value={selectedId}
        onChange={(id) => {
          setSelectedId(id);
          setTopicId('');
          setPosts([]);
        }}
      />

      <TextField
        fullWidth
        size="small"
        placeholder="Search questions, keywords, topics…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        InputProps={{
          startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />,
        }}
        sx={{ mb: 1.5, bgcolor: '#fff' }}
      />

      <Box
        sx={{
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          pb: 0.5,
          mb: 1.25,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {SCOPES.map((item) => (
          <Chip
            key={item.value || 'all'}
            label={item.label}
            size="small"
            clickable
            color={scope === item.value ? 'primary' : 'default'}
            variant={scope === item.value ? 'filled' : 'outlined'}
            onClick={() => setScope(item.value)}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          />
        ))}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          select
          size="small"
          fullWidth
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <MenuItem value="ALL">All statuses</MenuItem>
          <MenuItem value="OPEN">Open</MenuItem>
          <MenuItem value="RESOLVED">Resolved</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          fullWidth
          label="Sort"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <MenuItem value="recent">Recent</MenuItem>
          <MenuItem value="helpful">Most helpful</MenuItem>
          <MenuItem value="unanswered">Unanswered</MenuItem>
        </TextField>
      </Stack>

      {topics.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            pb: 0.5,
            mb: 1.5,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Chip
            label="All topics"
            size="small"
            clickable
            color={!topicId ? 'secondary' : 'default'}
            variant={!topicId ? 'filled' : 'outlined'}
            onClick={() => setTopicId('')}
            sx={{ fontWeight: 700, flexShrink: 0 }}
          />
          {topics.map((topic) => (
            <Chip
              key={topic.id}
              label={topic.name}
              size="small"
              clickable
              color={topicId === topic.id ? 'secondary' : 'default'}
              variant={topicId === topic.id ? 'filled' : 'outlined'}
              onClick={() => setTopicId(topicId === topic.id ? '' : topic.id)}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          ))}
        </Box>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadPosts}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loadingPosts ? (
        <Box sx={{ py: 5, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : posts.length === 0 ? (
        <Box
          sx={{
            py: 5,
            px: 2,
            textAlign: 'center',
            border: `1px dashed ${m3Tokens.color.outlineVariant}`,
            borderRadius: m3Tokens.shape.large,
          }}
        >
          <ForumOutlinedIcon sx={{ fontSize: 44, color: m3Tokens.color.outline, mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            No questions found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Be the first student to post a question in this scope.
          </Typography>
          <Button
            component={Link}
            href={createHref}
            variant="contained"
            sx={{ fontWeight: 800, textTransform: 'none' }}
          >
            Ask a doubt
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {posts.map((post) => {
            const resolved =
              post.status === 'RESOLVED' || post.has_accepted_solution === true;
            const anonymous = post.is_anonymous === true;
            const marked = post.user_has_marked_helpful === true;

            return (
              <Card
                key={post.id}
                sx={{
                  borderRadius: m3Tokens.shape.medium,
                  border: `1px solid ${
                    resolved ? '#A5D6A7' : m3Tokens.color.outlineVariant
                  }`,
                  boxShadow: 'none',
                }}
              >
                <CardActionArea onClick={() => router.push(`/student/doubts/${post.id}`)}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                      {resolved && (
                        <Chip
                          label="SOLVED"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            bgcolor: '#E8F5E9',
                            color: '#2E7D32',
                          }}
                        />
                      )}
                      <Chip
                        label={post.audience_scope}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          bgcolor: m3Tokens.color.primaryContainer,
                          color: m3Tokens.color.onPrimaryContainer,
                        }}
                      />
                      {post.topic_name && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {post.topic_name}
                        </Typography>
                      )}
                    </Stack>

                    <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.3 }}>
                      {post.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {post.body}
                    </Typography>

                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.75}
                      sx={{ mt: 1.25 }}
                    >
                      {anonymous ? (
                        <MasksOutlinedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                      ) : (
                        <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      )}
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                        {post.author_display_name || 'Peer'}
                      </Typography>

                      <IconButton
                        size="small"
                        aria-label={marked ? 'Remove helpful mark' : 'Mark helpful'}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleHelpful(post);
                        }}
                        sx={{ p: 0.25 }}
                      >
                        {marked ? (
                          <ThumbUpIcon sx={{ fontSize: 16, color: m3Tokens.color.primary }} />
                        ) : (
                          <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {post.helpful_count ?? 0}
                      </Typography>
                      <ChatBubbleOutlineIcon sx={{ fontSize: 15, color: 'text.secondary', ml: 1 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {post.reply_count ?? 0}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
