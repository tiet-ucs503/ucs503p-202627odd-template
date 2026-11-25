'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Paper,
  Stack,
  Chip,
  Avatar,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedIcon from '@mui/icons-material/Verified';
import MasksIcon from '@mui/icons-material/Masks';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import SchoolIcon from '@mui/icons-material/School';
import PublicIcon from '@mui/icons-material/Public';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';
import { getAuthHeaders } from '@/lib/authStorage';

export interface DoubtReply {
  id: string;
  doubt_post_id: string;
  author_id: string | null;
  author_display_name: string;
  author_real_name?: string | null;
  author_role?: string;
  body: string;
  is_anonymous: boolean;
  pseudonym?: string;
  is_teacher_endorsed: boolean;
  is_solution: boolean;
  helpful_count: number;
  user_has_marked_helpful: boolean;
  created_at: string;
}

export interface DoubtPostDetail {
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
  author_email?: string;
  audience_scope: 'CLASSROOM' | 'COURSE' | 'APP';
  title: string;
  body: string;
  is_anonymous: boolean;
  pseudonym?: string;
  status: 'OPEN' | 'RESOLVED' | 'FLAGGED';
  helpful_count: number;
  user_has_marked_helpful: boolean;
  created_at: string;
}

interface DoubtDetailModalProps {
  open: boolean;
  doubtId: string | null;
  onClose: () => void;
  onPostUpdated: () => void;
  currentUserRole?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const DoubtDetailModal: React.FC<DoubtDetailModalProps> = ({
  open,
  doubtId,
  onClose,
  onPostUpdated,
  currentUserRole = 'teacher',
}) => {
  const [post, setPost] = useState<DoubtPostDetail | null>(null);
  const [replies, setReplies] = useState<DoubtReply[]>([]);
  const [canRevealAuthor, setCanRevealAuthor] = useState(false);
  const [revealedAuthor, setRevealedAuthor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isTeacher = currentUserRole === 'teacher' || user?.role === 'teacher';
  const [deleteDialogTarget, setDeleteDialogTarget] = useState<{ type: 'post' | 'reply'; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Question State
  const [editingPostOpen, setEditingPostOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isSavingPost, setIsSavingPost] = useState(false);

  // Edit Reply State
  const [editingReply, setEditingReply] = useState<DoubtReply | null>(null);
  const [editReplyBody, setEditReplyBody] = useState('');
  const [isSavingReply, setIsSavingReply] = useState(false);

  // Reply Composer
  const [replyBody, setReplyBody] = useState('');
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // In-flight action tracking (so controls can be disabled per action)
  const [pendingPostHelpful, setPendingPostHelpful] = useState(false);
  const [pendingReplyActions, setPendingReplyActions] = useState<string[]>([]);
  const [revealingAuthorLoading, setRevealingAuthorLoading] = useState(false);

  const isReplyActionPending = (replyId: string) => pendingReplyActions.includes(replyId);

  const beginReplyAction = (replyId: string) =>
    setPendingReplyActions((prev) => (prev.includes(replyId) ? prev : [...prev, replyId]));

  const endReplyAction = (replyId: string) =>
    setPendingReplyActions((prev) => prev.filter((id) => id !== replyId));

  const handleOpenEditPost = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditingPostOpen(true);
  };

  const handleSaveEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !editTitle.trim() || !editBody.trim()) return;
    setIsSavingPost(true);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPost({
          ...post,
          title: editTitle.trim(),
          body: editBody.trim(),
        });
        setEditingPostOpen(false);
        onPostUpdated();
      } else {
        setError(data.error || 'Failed to update question');
      }
    } catch {
      setError('Network error updating question');
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleOpenEditReply = (reply: DoubtReply) => {
    setEditingReply(reply);
    setEditReplyBody(reply.body);
  };

  const handleSaveEditReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReply || !editReplyBody.trim()) return;
    setIsSavingReply(true);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/replies/${editingReply.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          body: editReplyBody.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplies((prev) =>
          prev.map((r) =>
            r.id === editingReply.id ? { ...r, body: editReplyBody.trim() } : r
          )
        );
        setEditingReply(null);
        onPostUpdated();
      } else {
        setError(data.error || 'Failed to update reply');
      }
    } catch {
      setError('Network error updating reply');
    } finally {
      setIsSavingReply(false);
    }
  };

  useEffect(() => {
    if (open && doubtId) {
      fetchDoubtDetails();
    }
  }, [open, doubtId]);

  const handleConfirmDelete = async () => {
    if (!deleteDialogTarget) return;
    setIsDeleting(true);
    try {
      if (deleteDialogTarget.type === 'post') {
        const res = await fetch(`${API_BASE_URL}/doubts/${deleteDialogTarget.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          setDeleteDialogTarget(null);
          onPostUpdated();
          onClose();
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to delete question');
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/doubts/replies/${deleteDialogTarget.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          setDeleteDialogTarget(null);
          fetchDoubtDetails();
          onPostUpdated();
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to delete reply');
        }
      }
    } catch {
      setError('Network error while deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchDoubtDetails = async () => {
    setLoading(true);
    setError(null);
    setRevealedAuthor(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/${doubtId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setPost(data.post);
        setReplies(data.replies || []);
        setCanRevealAuthor(data.canRevealAuthor || false);
      } else {
        setError(data.error || 'Failed to load question thread');
      }
    } catch {
      setError('Network error loading discussion');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePostHelpful = async () => {
    if (!post || pendingPostHelpful) return;
    setPendingPostHelpful(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ target_type: 'POST', target_id: post.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to update helpful vote. Please try again.');
        return;
      }
      setPost({
        ...post,
        user_has_marked_helpful: data.marked,
        helpful_count: data.helpful_count,
      });
      onPostUpdated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPendingPostHelpful(false);
    }
  };

  const handleToggleReplyHelpful = async (replyId: string) => {
    if (isReplyActionPending(replyId)) return;
    beginReplyAction(replyId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ target_type: 'REPLY', target_id: replyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to update helpful vote. Please try again.');
        return;
      }
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { ...r, user_has_marked_helpful: data.marked, helpful_count: data.helpful_count }
            : r
        )
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      endReplyAction(replyId);
    }
  };

  const handleRevealAuthor = async () => {
    if (!post || revealingAuthorLoading) return;
    setRevealingAuthorLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/${post.id}/reveal-author`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to reveal author. Please try again.');
        return;
      }
      if (!data.author) {
        setError('Failed to reveal author. Please try again.');
        return;
      }
      setRevealedAuthor(data.author);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRevealingAuthorLoading(false);
    }
  };

  const handleAcceptSolution = async (replyId: string) => {
    if (isReplyActionPending(replyId)) return;
    beginReplyAction(replyId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/replies/${replyId}/accept-solution`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to update the accepted solution. Please try again.');
        return;
      }
      fetchDoubtDetails();
      onPostUpdated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      endReplyAction(replyId);
    }
  };

  const handleEndorseReply = async (replyId: string) => {
    if (isReplyActionPending(replyId)) return;
    beginReplyAction(replyId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/replies/${replyId}/endorse`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to update endorsement. Please try again.');
        return;
      }
      if (!data?.reply) {
        setError('Failed to update endorsement. Please try again.');
        return;
      }
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId ? { ...r, is_teacher_endorsed: data.reply.is_teacher_endorsed } : r
        )
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      endReplyAction(replyId);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !post) return;

    setSubmittingReply(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/doubts/${post.id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          body: replyBody.trim(),
          is_anonymous: replyAnonymous,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        setError(data?.error || 'Failed to post your answer. Please try again.');
        return;
      }
      setReplyBody('');
      setReplyAnonymous(false);
      fetchDoubtDetails();
      onPostUpdated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}`, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
            Discussion Thread
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !post ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error || 'Question not found'}
          </Alert>
        ) : (
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: '8px' }}>
                {error}
              </Alert>
            )}

            {/* Post Card */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              {/* Badges row */}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5, gap: 1 }}>
                <Chip
                  label={post.status}
                  color={post.status === 'RESOLVED' ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 800, height: 22, fontSize: '0.7rem' }}
                />
                <Chip
                  icon={
                    post.audience_scope === 'APP' ? (
                      <PublicIcon sx={{ fontSize: '0.85rem !important' }} />
                    ) : post.audience_scope === 'COURSE' ? (
                      <SchoolIcon sx={{ fontSize: '0.85rem !important' }} />
                    ) : (
                      <MeetingRoomIcon sx={{ fontSize: '0.85rem !important' }} />
                    )
                  }
                  label={post.audience_scope}
                  size="small"
                  sx={{ fontWeight: 800, height: 22, fontSize: '0.7rem', bgcolor: m3Tokens.color.primaryContainer }}
                />
                {post.topic_name && (
                  <Chip
                    label={post.topic_name}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem' }}
                  />
                )}
                <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, ml: 'auto' }}>
                  {new Date(post.created_at).toLocaleDateString()} at {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Stack>

              {/* Title */}
              <Typography variant="h5" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 2 }}>
                {post.title}
              </Typography>

              {/* Body */}
              <Typography
                variant="body1"
                sx={{
                  color: m3Tokens.color.onSurface,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.65,
                  mb: 3,
                }}
              >
                {post.body}
              </Typography>

              {/* Author & Action footer */}
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: post.is_anonymous ? m3Tokens.color.tertiary : m3Tokens.color.primary,
                      fontSize: '0.85rem',
                      fontWeight: 800,
                    }}
                  >
                    {post.is_anonymous ? <MasksIcon sx={{ fontSize: 18 }} /> : post.author_display_name?.[0] || '?'}
                  </Avatar>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
                        {post.author_display_name || 'Anonymous'}
                      </Typography>
                      {post.is_anonymous && (
                        <Chip
                          label="Pseudonym"
                          size="small"
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                      {post.course_code}: {post.course_name}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  {/* Teacher reveal button */}
                  {canRevealAuthor && post.is_anonymous && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<VisibilityIcon />}
                      onClick={handleRevealAuthor}
                      disabled={revealingAuthorLoading}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Reveal Real Name
                    </Button>
                  )}

                  {/* Edit Post Button (Author or Teacher) */}
                  {(isTeacher || (!!post.author_id && post.author_id === user?.id)) && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      startIcon={<EditOutlinedIcon />}
                      onClick={handleOpenEditPost}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Edit
                    </Button>
                  )}

                  {/* Delete Post Button (Author or Teacher) */}
                  {(isTeacher || (!!post.author_id && post.author_id === user?.id)) && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => setDeleteDialogTarget({ type: 'post', id: post.id })}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                    >
                      Delete
                    </Button>
                  )}

                  {/* Helpful Button */}
                  <Button
                    size="small"
                    variant={post.user_has_marked_helpful ? 'contained' : 'outlined'}
                    color="primary"
                    startIcon={post.user_has_marked_helpful ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
                    onClick={handleTogglePostHelpful}
                    disabled={pendingPostHelpful}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                  >
                    Helpful ({post.helpful_count})
                  </Button>
                </Stack>
              </Stack>

              {/* Revealed Author banner for teachers */}
              {revealedAuthor && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: '8px' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Instructor Reveal (Academic Integrity Record):
                  </Typography>
                  <Typography variant="body2">
                    Student: <strong>{revealedAuthor.full_name}</strong> ({revealedAuthor.email}) &bull; Roll: {revealedAuthor.roll_number || 'N/A'}
                  </Typography>
                </Alert>
              )}
            </Paper>

            {/* Replies Header */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                {replies.length} {replies.length === 1 ? 'Answer' : 'Answers & Replies'}
              </Typography>

              {/* Replies List */}
              {replies.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: '12px',
                    border: `1px dashed ${m3Tokens.color.outlineVariant}`,
                    bgcolor: '#FFFFFF',
                  }}
                >
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                    No answers posted yet. Be the first to answer this doubt!
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {replies.map((reply) => (
                    <Paper
                      key={reply.id}
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: '12px',
                        border: reply.is_solution
                          ? '2px solid #2E7D32'
                          : `1px solid ${m3Tokens.color.outlineVariant}`,
                        bgcolor: reply.is_solution ? '#F1F8E9' : '#FFFFFF',
                      }}
                    >
                      {/* Top Badges */}
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        {reply.is_solution && (
                          <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: '0.85rem !important' }} />}
                            label="ACCEPTED SOLUTION"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 800, height: 22, fontSize: '0.68rem' }}
                          />
                        )}
                        {reply.is_teacher_endorsed && (
                          <Chip
                            icon={<VerifiedIcon sx={{ fontSize: '0.85rem !important' }} />}
                            label="INSTRUCTOR ENDORSED"
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 800, height: 22, fontSize: '0.68rem' }}
                          />
                        )}
                        <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant, ml: 'auto' }}>
                          {new Date(reply.created_at).toLocaleDateString()}
                        </Typography>
                      </Stack>

                      {/* Reply Body */}
                      <Typography
                        variant="body1"
                        sx={{
                          color: m3Tokens.color.onSurface,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                          mb: 2,
                        }}
                      >
                        {reply.body}
                      </Typography>

                      {/* Reply Footer */}
                      <Divider sx={{ mb: 1.5 }} />
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              bgcolor: reply.is_anonymous ? m3Tokens.color.tertiary : m3Tokens.color.primary,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                            }}
                          >
                            {reply.is_anonymous ? <MasksIcon sx={{ fontSize: 16 }} /> : reply.author_display_name?.[0] || '?'}
                          </Avatar>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {reply.author_display_name || 'Anonymous'}
                          </Typography>
                          {reply.author_role === 'teacher' && (
                            <Chip
                              label="Instructor"
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                            />
                          )}
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                          {/* Solution Toggle Button (Author or Teacher) */}
                          <Button
                            size="small"
                            variant={reply.is_solution ? 'contained' : 'outlined'}
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleAcceptSolution(reply.id)}
                            disabled={isReplyActionPending(reply.id)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                          >
                            {reply.is_solution ? 'Accepted' : 'Accept Solution'}
                          </Button>

                          {/* Endorse Toggle Button (Teacher only) */}
                          {currentUserRole === 'teacher' && (
                            <Button
                              size="small"
                              variant={reply.is_teacher_endorsed ? 'contained' : 'outlined'}
                              color="primary"
                              startIcon={<VerifiedIcon />}
                              onClick={() => handleEndorseReply(reply.id)}
                              disabled={isReplyActionPending(reply.id)}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                            >
                              {reply.is_teacher_endorsed ? 'Endorsed' : 'Endorse'}
                            </Button>
                          )}

                          {/* Helpful Button */}
                          <IconButton
                            size="small"
                            color={reply.user_has_marked_helpful ? 'primary' : 'default'}
                            onClick={() => handleToggleReplyHelpful(reply.id)}
                            disabled={isReplyActionPending(reply.id)}
                          >
                            {reply.user_has_marked_helpful ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
                            <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>
                              {reply.helpful_count}
                            </Typography>
                          </IconButton>

                          {/* Edit Reply Button (Author or Teacher) */}
                          {(isTeacher || (!!reply.author_id && reply.author_id === user?.id)) && (
                            <Tooltip title="Edit this reply">
                              <IconButton
                                size="small"
                                color="inherit"
                                onClick={() => handleOpenEditReply(reply)}
                                sx={{ ml: 0.5 }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Delete Reply Button (Author or Teacher) */}
                          {(isTeacher || (!!reply.author_id && reply.author_id === user?.id)) && (
                            <Tooltip title="Delete this reply">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialogTarget({ type: 'reply', id: reply.id })}
                                sx={{ ml: 0.5 }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Reply Composer Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '16px',
                border: `1px solid ${m3Tokens.color.outlineVariant}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface, mb: 1.5 }}>
                Your Answer
              </Typography>
              <form onSubmit={handlePostReply}>
                <TextField
                  placeholder="Type your explanation, solution steps, or code snippet..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  required
                  sx={{ bgcolor: m3Tokens.color.background, mb: 2 }}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={replyAnonymous}
                        onChange={(e) => setReplyAnonymous(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 700, color: m3Tokens.color.onSurfaceVariant }}>
                        Reply with Pseudonym
                      </Typography>
                    }
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={submittingReply || !replyBody.trim()}
                    startIcon={submittingReply ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 2.5 }}
                  >
                    {submittingReply ? 'Posting...' : 'Post Answer'}
                  </Button>
                </Stack>
              </form>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Close Thread
        </Button>
      </DialogActions>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog
      open={Boolean(deleteDialogTarget)}
      onClose={() => !isDeleting && setDeleteDialogTarget(null)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        {deleteDialogTarget?.type === 'post' ? 'Delete Question?' : 'Delete Reply?'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
          {deleteDialogTarget?.type === 'post'
            ? 'Are you sure you want to permanently delete this question and all of its replies? This action cannot be undone.'
            : 'Are you sure you want to permanently delete this reply? This action cannot be undone.'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={() => setDeleteDialogTarget(null)}
          disabled={isDeleting}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirmDelete}
          variant="contained"
          color="error"
          disabled={isDeleting}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>

    {/* Edit Question Dialog */}
    <Dialog
      open={editingPostOpen}
      onClose={() => !isSavingPost && setEditingPostOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Edit Question</DialogTitle>
      <form onSubmit={handleSaveEditPost}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Question Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Question Details / Description"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              fullWidth
              multiline
              rows={4}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setEditingPostOpen(false)}
            disabled={isSavingPost}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSavingPost || !editTitle.trim() || !editBody.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isSavingPost ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>

    {/* Edit Reply Dialog */}
    <Dialog
      open={Boolean(editingReply)}
      onClose={() => !isSavingReply && setEditingReply(null)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Edit Answer / Reply</DialogTitle>
      <form onSubmit={handleSaveEditReply}>
        <DialogContent dividers>
          <TextField
            label="Your Answer / Solution"
            value={editReplyBody}
            onChange={(e) => setEditReplyBody(e.target.value)}
            fullWidth
            multiline
            rows={4}
            required
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setEditingReply(null)}
            disabled={isSavingReply}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSavingReply || !editReplyBody.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {isSavingReply ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
    </>
  );
};
