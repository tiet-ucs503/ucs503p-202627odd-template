'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import MasksOutlinedIcon from '@mui/icons-material/MasksOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useRequireRole } from '@/hooks/useRequireRole';
import {
  acceptSolution,
  createReply,
  deleteDoubt,
  deleteReply,
  getDoubt,
  toggleHelpful,
  updateDoubt,
  updateReply,
} from '@/lib/studentApi';
import type { DoubtPost, DoubtReply } from '@/lib/studentTypes';
import { m3Tokens } from '@/theme/tokens';

export default function DoubtDetailPage() {
  const { user, loading: authLoading } = useRequireRole(
    'student',
    '/student/login'
  );
  const params = useParams<{ id: string }>();
  const doubtId = params.id;

  const [post, setPost] = useState<DoubtPost | null>(null);
  const [replies, setReplies] = useState<DoubtReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [replyBody, setReplyBody] = useState('');
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [postingReply, setPostingReply] = useState(false);

  const [editPostOpen, setEditPostOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [deletePostOpen, setDeletePostOpen] = useState(false);
  const [editReply, setEditReply] = useState<DoubtReply | null>(null);
  const [editReplyBody, setEditReplyBody] = useState('');
  const [deleteReplyTarget, setDeleteReplyTarget] = useState<DoubtReply | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDoubt(doubtId);
      setPost(data.post);
      setReplies(data.replies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this thread');
    } finally {
      setLoading(false);
    }
  }, [doubtId]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  // An anonymous post exposes author_id only to its author. Non-anonymous posts
  // expose it normally. Teachers are not part of this student-only surface.
  const isPostAuthor = !!post && !!user && post.author_id === user.id;

  const handlePostHelpful = async () => {
    if (!post) return;
    try {
      const result = await toggleHelpful('POST', post.id);
      setPost({
        ...post,
        user_has_marked_helpful: result.marked,
        helpful_count: result.helpful_count,
      });
    } catch {
      // Reconcile on the next refresh.
    }
  };

  const handleReplyHelpful = async (reply: DoubtReply) => {
    try {
      const result = await toggleHelpful('REPLY', reply.id);
      setReplies((current) =>
        current.map((item) =>
          item.id === reply.id
            ? {
                ...item,
                user_has_marked_helpful: result.marked,
                helpful_count: result.helpful_count,
              }
            : item
        )
      );
    } catch {
      // Reconcile on the next refresh.
    }
  };

  const handleAccept = async (reply: DoubtReply) => {
    try {
      const result = await acceptSolution(reply.id);
      setNotice(result.message || 'Solution updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the solution');
    }
  };

  const handleReply = async () => {
    if (!post) return;
    const body = replyBody.trim();
    if (!body) return;

    setPostingReply(true);
    setError(null);
    try {
      await createReply(post.id, body, replyAnonymous);
      setReplyBody('');
      setReplyAnonymous(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your reply');
    } finally {
      setPostingReply(false);
    }
  };

  const savePostEdit = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await updateDoubt(post.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
      });
      setEditPostOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the doubt');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePost = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await deleteDoubt(post.id);
      window.location.assign('/student/doubts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the doubt');
      setBusy(false);
      setDeletePostOpen(false);
    }
  };

  const saveReplyEdit = async () => {
    if (!editReply) return;
    setBusy(true);
    try {
      await updateReply(editReply.id, editReplyBody);
      setEditReply(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the reply');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteReply = async () => {
    if (!deleteReplyTarget) return;
    setBusy(true);
    try {
      await deleteReply(deleteReplyTarget.id);
      setDeleteReplyTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the reply');
      setBusy(false);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!post) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Doubt not found
        </Typography>
        {error && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Button component={Link} href="/student/doubts" variant="contained">
          Back to forum
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        component={Link}
        href="/student/doubts"
        size="small"
        sx={{ mb: 1, textTransform: 'none', fontWeight: 700 }}
      >
        ← Back to forum
      </Button>

      {notice && (
        <Alert
          severity="success"
          onClose={() => setNotice(null)}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {notice}
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      <Card
        sx={{
          borderRadius: m3Tokens.shape.large,
          border: `1px solid ${m3Tokens.color.outlineVariant}`,
          boxShadow: 'none',
          mb: 2.5,
        }}
      >
        <CardContent sx={{ p: 2.25 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
            {post.status === 'RESOLVED' && (
              <Chip
                label="SOLVED"
                size="small"
                sx={{
                  height: 21,
                  fontSize: '0.62rem',
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
                height: 21,
                fontSize: '0.62rem',
                fontWeight: 900,
                bgcolor: m3Tokens.color.primaryContainer,
                color: m3Tokens.color.onPrimaryContainer,
              }}
            />
            {post.topic_name && (
              <Typography variant="caption" color="text.secondary">
                {post.topic_name}
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {isPostAuthor && (
              <>
                <IconButton
                  size="small"
                  aria-label="Edit question"
                  onClick={() => {
                    setEditTitle(post.title);
                    setEditBody(post.body);
                    setEditPostOpen(true);
                  }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Delete question"
                  onClick={() => setDeletePostOpen(true)}
                  sx={{ color: m3Tokens.color.error }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Stack>

          <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.3 }}>
            {post.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 1, whiteSpace: 'pre-wrap', color: 'text.primary' }}
          >
            {post.body}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            {post.is_anonymous ? (
              <MasksOutlinedIcon sx={{ fontSize: 17, color: 'secondary.main' }} />
            ) : (
              <PersonOutlineIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {post.author_display_name || 'Peer'}
            </Typography>
            <Button
              size="small"
              onClick={handlePostHelpful}
              startIcon={
                post.user_has_marked_helpful ? (
                  <ThumbUpIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              Helpful · {post.helpful_count ?? 0}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
        {replies.length} {replies.length === 1 ? 'answer' : 'answers'}
      </Typography>

      {replies.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No answers yet. Be the first to help.
        </Typography>
      ) : (
        <Stack spacing={1.25} sx={{ mb: 2 }}>
          {replies.map((reply) => {
            const isReplyAuthor = reply.author_id === user.id;
            return (
              <Card
                key={reply.id}
                sx={{
                  borderRadius: m3Tokens.shape.medium,
                  border: `1px solid ${
                    reply.is_solution ? '#A5D6A7' : m3Tokens.color.outlineVariant
                  }`,
                  boxShadow: 'none',
                  bgcolor: reply.is_solution ? '#F7FCF8' : '#fff',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                    {reply.is_solution && (
                      <Chip
                        icon={<TaskAltIcon />}
                        label="ACCEPTED"
                        size="small"
                        sx={{
                          height: 21,
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          bgcolor: '#E8F5E9',
                          color: '#2E7D32',
                          '& .MuiChip-icon': { fontSize: 14 },
                        }}
                      />
                    )}
                    {reply.is_teacher_endorsed && (
                      <Chip
                        icon={<VerifiedIcon />}
                        label="ENDORSED"
                        size="small"
                        sx={{
                          height: 21,
                          fontSize: '0.6rem',
                          fontWeight: 900,
                          bgcolor: '#E3F2FD',
                          color: '#1565C0',
                          '& .MuiChip-icon': { fontSize: 14 },
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1 }} />
                    {isReplyAuthor && (
                      <>
                        <IconButton
                          size="small"
                          aria-label="Edit answer"
                          onClick={() => {
                            setEditReply(reply);
                            setEditReplyBody(reply.body);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Delete answer"
                          onClick={() => setDeleteReplyTarget(reply)}
                          sx={{ color: m3Tokens.color.error }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Stack>

                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}
                  >
                    {reply.body}
                  </Typography>

                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.25 }}>
                    {reply.is_anonymous ? (
                      <MasksOutlinedIcon sx={{ fontSize: 15, color: 'secondary.main' }} />
                    ) : (
                      <PersonOutlineIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                      {reply.author_display_name || 'Peer'}
                    </Typography>

                    <IconButton
                      size="small"
                      aria-label="Mark answer helpful"
                      onClick={() => void handleReplyHelpful(reply)}
                      sx={{ p: 0.25 }}
                    >
                      {reply.user_has_marked_helpful ? (
                        <ThumbUpIcon sx={{ fontSize: 15, color: m3Tokens.color.primary }} />
                      ) : (
                        <ThumbUpOutlinedIcon sx={{ fontSize: 15 }} />
                      )}
                    </IconButton>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                      {reply.helpful_count ?? 0}
                    </Typography>

                    {isPostAuthor && (
                      <Button
                        size="small"
                        onClick={() => void handleAccept(reply)}
                        sx={{
                          ml: 1,
                          minWidth: 0,
                          px: 1,
                          py: 0.25,
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                        }}
                      >
                        {reply.is_solution ? 'Unaccept' : 'Accept'}
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
        Your answer
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={3}
        value={replyBody}
        onChange={(event) => setReplyBody(event.target.value.slice(0, 10000))}
        placeholder="Explain clearly and kindly…"
        sx={{ bgcolor: '#fff' }}
      />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={replyAnonymous}
              onChange={(event) => setReplyAnonymous(event.target.checked)}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              Answer with a pseudonym
            </Typography>
          }
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          onClick={handleReply}
          disabled={postingReply || !replyBody.trim()}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          {postingReply ? 'Posting…' : 'Post answer'}
        </Button>
      </Stack>

      <Dialog open={editPostOpen} onClose={() => setEditPostOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Edit question</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={4}
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditPostOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={savePostEdit} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deletePostOpen} onClose={() => setDeletePostOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete question?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes the question and all of its answers.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeletePostOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDeletePost} disabled={busy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editReply} onClose={() => setEditReply(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Edit answer</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={editReplyBody}
            onChange={(event) => setEditReplyBody(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditReply(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveReplyEdit} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteReplyTarget} onClose={() => setDeleteReplyTarget(null)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete answer?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteReplyTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDeleteReply} disabled={busy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
