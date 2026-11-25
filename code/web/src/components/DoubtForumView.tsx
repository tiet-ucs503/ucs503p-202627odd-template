'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Grid,
  Divider,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PublicIcon from '@mui/icons-material/Public';
import SchoolIcon from '@mui/icons-material/School';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import MasksIcon from '@mui/icons-material/Masks';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { CreateDoubtDialog } from './CreateDoubtDialog';
import { DoubtDetailModal } from './DoubtDetailModal';
import { EmptyState } from './EmptyState';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

interface DoubtForumViewProps {
  courseId: string;
  classroomId?: string;
  courseCode?: string;
  courseName?: string;
}

export interface DoubtPostListItem {
  id: string;
  course_id: string;
  classroom_id?: string;
  topic_id?: string;
  topic_name?: string;
  course_code: string;
  course_name: string;
  author_id: string | null;
  author_display_name: string;
  author_real_name?: string | null;
  author_role?: string;
  audience_scope: 'CLASSROOM' | 'COURSE' | 'APP';
  title: string;
  body: string;
  is_anonymous: boolean;
  pseudonym?: string;
  status: 'OPEN' | 'RESOLVED' | 'FLAGGED';
  helpful_count: number;
  user_has_marked_helpful: boolean;
  reply_count: number;
  has_accepted_solution: boolean;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  post_count?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const DoubtForumView: React.FC<DoubtForumViewProps> = ({
  courseId,
  classroomId,
  courseCode,
  courseName,
}) => {
  const [posts, setPosts] = useState<DoubtPostListItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingHelpfulIds, setPendingHelpfulIds] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDoubtId, setSelectedDoubtId] = useState<string | null>(null);

  // Identity of the latest posts request, so stale responses cannot overwrite newer ones.
  const fetchSeqRef = useRef(0);

  // Filters
  const [scopeTab, setScopeTab] = useState<string>('ALL');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (courseId) {
      fetchTopics();
      fetchPosts();
    }
  }, [courseId, classroomId, scopeTab, selectedTopicId, statusFilter, sortBy]);

  const fetchTopics = async () => {
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
    }
  };

  const fetchPosts = async (queryOverride?: string) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      let url = '';
      const effectiveQuery = (queryOverride !== undefined ? queryOverride : searchQuery).trim();

      if (effectiveQuery) {
        url = `${API_BASE_URL}/search?q=${encodeURIComponent(effectiveQuery)}&course_id=${courseId}`;
      } else {
        url = `${API_BASE_URL}/doubts?course_id=${courseId}`;
      }

      if (classroomId) url += `&classroom_id=${classroomId}`;
      if (scopeTab !== 'ALL') url += `&scope=${scopeTab}`;
      if (selectedTopicId) url += `&topic_id=${selectedTopicId}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (sortBy && !effectiveQuery) url += `&sort_by=${sortBy}`;

      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) {
        // Keep the last successfully loaded list visible on failure.
        setError(data?.error || 'Failed to load doubts.');
        return;
      }
      setPosts(data.results || data.posts || []);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setError('Network error loading doubts.');
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPosts();
  };

  const handleToggleHelpful = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (pendingHelpfulIds.includes(postId)) return;
    setPendingHelpfulIds((prev) => [...prev, postId]);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ target_type: 'POST', target_id: postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to update helpful vote. Please try again.');
        return;
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_has_marked_helpful: data.marked, helpful_count: data.helpful_count }
            : p
        )
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPendingHelpfulIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header bar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ForumIcon sx={{ color: m3Tokens.color.primary }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
              Doubt & Discussion Forum
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mt: 0.5 }}>
            Audience-scoped Q&A across classrooms, courses, and global student community.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={() => fetchPosts()} size="small" sx={{ border: `1px solid ${m3Tokens.color.outlineVariant}` }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'none', px: 2.5, borderRadius: '8px' }}
          >
            Ask a Doubt
          </Button>
        </Stack>
      </Stack>

      {/* Scope Navigation Tabs */}
      <Paper elevation={0} sx={{ borderRadius: '12px', border: `1px solid ${m3Tokens.color.outlineVariant}`, bgcolor: '#FFFFFF', mb: 2.5 }}>
        <Tabs
          value={scopeTab}
          onChange={(_, val) => setScopeTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 48 },
          }}
        >
          <Tab value="ALL" label="All Visible Doubts" />
          {classroomId && <Tab value="CLASSROOM" icon={<MeetingRoomIcon sx={{ fontSize: '1rem !important' }} />} iconPosition="start" label="Section (Classroom)" />}
          <Tab value="COURSE" icon={<SchoolIcon sx={{ fontSize: '1rem !important' }} />} iconPosition="start" label="Course-Wide" />
          <Tab value="APP" icon={<PublicIcon sx={{ fontSize: '1rem !important' }} />} iconPosition="start" label="Global App" />
        </Tabs>
      </Paper>

      {/* Filter & Search Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${m3Tokens.color.outlineVariant}`, bgcolor: '#FFFFFF', mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search text field */}
          <Grid item xs={12} md={5}>
            <form onSubmit={handleSearchSubmit}>
              <TextField
                size="small"
                placeholder="Search questions by keyword or topic..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val === '') {
                    fetchPosts('');
                  }
                }}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: m3Tokens.color.onSurfaceVariant }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchQuery('');
                          fetchPosts('');
                        }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
            </form>
          </Grid>

          {/* Status Filter */}
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl size="small" fullWidth>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="OPEN">Open</MenuItem>
                <MenuItem value="RESOLVED">Resolved (Solved)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Sort By */}
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl size="small" fullWidth>
              <InputLabel id="sort-filter-label">Sort By</InputLabel>
              <Select
                labelId="sort-filter-label"
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="recent">Newest First</MenuItem>
                <MenuItem value="helpful">Most Helpful</MenuItem>
                <MenuItem value="unanswered">Unanswered First</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Reset Filters button */}
          <Grid item xs={12} sm={6} md={2} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Button
              size="small"
              onClick={() => {
                setSelectedTopicId('');
                setStatusFilter('ALL');
                setSortBy('recent');
                setSearchQuery('');
                fetchPosts('');
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>

        {/* Topic filter chips scroll area */}
        {topics.length > 0 && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${m3Tokens.color.surfaceVariant}`, display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
            <Chip
              label="All Topics"
              size="small"
              clickable
              color={selectedTopicId === '' ? 'primary' : 'default'}
              onClick={() => setSelectedTopicId('')}
              sx={{ fontWeight: 700 }}
            />
            {topics.map((t) => (
              <Chip
                key={t.id}
                label={`${t.name} ${t.post_count ? `(${t.post_count})` : ''}`}
                size="small"
                clickable
                color={selectedTopicId === t.id ? 'primary' : 'default'}
                variant={selectedTopicId === t.id ? 'filled' : 'outlined'}
                onClick={() => setSelectedTopicId(selectedTopicId === t.id ? '' : t.id)}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* List / action error banner (keeps the last successful posts visible) */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 2, borderRadius: '12px', alignItems: 'center' }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => fetchPosts()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Doubts Post List */}
      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : posts.length === 0 && !error ? (
        <EmptyState
          title="No Doubts Found"
          description="No questions match the current audience scope or search filters. Be the first to ask!"
          actionLabel="Ask a Doubt"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <Stack spacing={2}>
          {posts.map((post) => {
            const isResolved = post.status === 'RESOLVED' || post.has_accepted_solution;

            return (
              <Paper
                key={post.id}
                elevation={0}
                onClick={() => setSelectedDoubtId(post.id)}
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  border: isResolved
                    ? '1px solid #2E7D32'
                    : `1px solid ${m3Tokens.color.outlineVariant}`,
                  bgcolor: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  },
                }}
              >
                {/* Top badges */}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1, gap: 0.5 }}>
                  {isResolved && (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
                      label="SOLVED"
                      color="success"
                      size="small"
                      sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                  <Chip
                    icon={
                      post.audience_scope === 'APP' ? (
                        <PublicIcon sx={{ fontSize: '0.8rem !important' }} />
                      ) : post.audience_scope === 'COURSE' ? (
                        <SchoolIcon sx={{ fontSize: '0.8rem !important' }} />
                      ) : (
                        <MeetingRoomIcon sx={{ fontSize: '0.8rem !important' }} />
                      )
                    }
                    label={post.audience_scope}
                    size="small"
                    sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', bgcolor: m3Tokens.color.primaryContainer }}
                  />
                  {post.topic_name && (
                    <Chip
                      label={post.topic_name}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                  <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, ml: 'auto' }}>
                    {new Date(post.created_at).toLocaleDateString()}
                  </Typography>
                </Stack>

                {/* Title */}
                <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 0.5 }}>
                  {post.title}
                </Typography>

                {/* Preview text */}
                <Typography
                  variant="body2"
                  sx={{
                    color: m3Tokens.color.onSurfaceVariant,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.5,
                    mb: 2,
                  }}
                >
                  {post.body}
                </Typography>

                {/* Card footer */}
                <Divider sx={{ mb: 1.5 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        bgcolor: post.is_anonymous ? m3Tokens.color.tertiary : m3Tokens.color.primary,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      {post.is_anonymous ? <MasksIcon sx={{ fontSize: 14 }} /> : post.author_display_name?.[0] || '?'}
                    </Avatar>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                      {post.author_display_name || 'Anonymous'}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {/* Helpful upvote button */}
                    <Button
                      size="small"
                      variant={post.user_has_marked_helpful ? 'contained' : 'outlined'}
                      color="primary"
                      startIcon={post.user_has_marked_helpful ? <ThumbUpIcon sx={{ fontSize: '0.9rem !important' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />}
                      onClick={(e) => handleToggleHelpful(e, post.id)}
                      disabled={pendingHelpfulIds.includes(post.id)}
                      sx={{ height: 26, fontSize: '0.75rem', textTransform: 'none', fontWeight: 700, borderRadius: '6px' }}
                    >
                      {post.helpful_count}
                    </Button>

                    {/* Replies count */}
                    <Chip
                      icon={<ChatBubbleOutlineIcon sx={{ fontSize: '0.85rem !important' }} />}
                      label={`${post.reply_count} ${post.reply_count === 1 ? 'answer' : 'answers'}`}
                      size="small"
                      sx={{ height: 26, fontSize: '0.72rem', fontWeight: 700 }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Create Dialog */}
      <CreateDoubtDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        courseId={courseId}
        classroomId={classroomId}
        onSuccess={() => {
          fetchTopics();
          fetchPosts();
        }}
      />

      {/* Thread Detail Modal */}
      {selectedDoubtId && (
        <DoubtDetailModal
          open={Boolean(selectedDoubtId)}
          doubtId={selectedDoubtId}
          onClose={() => setSelectedDoubtId(null)}
          onPostUpdated={fetchPosts}
        />
      )}
    </Box>
  );
};
