'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { m3Tokens } from '@/theme/tokens';
import { PulseMeter } from './PulseMeterAuthoringView';
import { getAuthHeaders } from '@/lib/authStorage';

interface CreatePulseMeterDialogProps {
  open: boolean;
  onClose: () => void;
  classroomId: string;
  onSuccess: () => void;
  pulseMeterToEdit?: PulseMeter | null;
}

type PulseMeterType = 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const CreatePulseMeterDialog: React.FC<CreatePulseMeterDialogProps> = ({
  open,
  onClose,
  classroomId,
  onSuccess,
  pulseMeterToEdit,
}) => {
  const isEditing = Boolean(pulseMeterToEdit);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PulseMeterType>('WORD_CLOUD');
  
  // Word Cloud state
  const [wcPrompt, setWcPrompt] = useState('');

  // MCQ state
  const [mcqOptions, setMcqOptions] = useState<string[]>(['Option A', 'Option B', 'Option C']);

  // Rating Scale state
  const [scaleMax, setScaleMax] = useState<number>(5);
  const [lowLabel, setLowLabel] = useState('Poor understanding');
  const [highLabel, setHighLabel] = useState('Crystal clear');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when dialog opens or pulseMeterToEdit changes
  React.useEffect(() => {
    if (open) {
      setError(null);
      if (pulseMeterToEdit) {
        setTitle(pulseMeterToEdit.title || '');
        setType(pulseMeterToEdit.type || 'WORD_CLOUD');

        if (pulseMeterToEdit.type === 'WORD_CLOUD') {
          setWcPrompt(pulseMeterToEdit.config?.prompt || pulseMeterToEdit.title || '');
        } else if (pulseMeterToEdit.type === 'MCQ') {
          const opts = pulseMeterToEdit.config?.options;
          if (Array.isArray(opts) && opts.length >= 2) {
            setMcqOptions(opts.map((o: any) => (typeof o === 'string' ? o : o.text || '')));
          } else {
            setMcqOptions(['Option A', 'Option B', 'Option C']);
          }
        } else if (pulseMeterToEdit.type === 'RATING_SCALE') {
          setScaleMax(Number(pulseMeterToEdit.config?.max) || 5);
          setLowLabel(pulseMeterToEdit.config?.low_label || 'Poor understanding');
          setHighLabel(pulseMeterToEdit.config?.high_label || 'Crystal clear');
        }
      } else {
        // Reset to clean create state
        setTitle('');
        setType('WORD_CLOUD');
        setWcPrompt('');
        setMcqOptions(['Option A', 'Option B', 'Option C']);
        setScaleMax(5);
        setLowLabel('Poor understanding');
        setHighLabel('Crystal clear');
      }
    }
  }, [open, pulseMeterToEdit]);

  const handleAddOption = () => {
    if (mcqOptions.length < 6) {
      setMcqOptions([...mcqOptions, `Option ${String.fromCharCode(65 + mcqOptions.length)}`]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (mcqOptions.length > 2) {
      setMcqOptions(mcqOptions.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...mcqOptions];
    updated[index] = value;
    setMcqOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a title for the PulseMeter.');
      return;
    }

    let config: any = {};

    if (type === 'WORD_CLOUD') {
      config = {
        prompt: wcPrompt.trim() || title.trim(),
      };
    } else if (type === 'MCQ') {
      const validOptions = mcqOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setError('Multiple choice PulseMeters must have at least 2 non-empty options.');
        return;
      }
      config = {
        options: validOptions.map((text, idx) => ({
          id: String.fromCharCode(97 + idx), // 'a', 'b', 'c'...
          text,
        })),
      };
    } else if (type === 'RATING_SCALE') {
      config = {
        min: 1,
        max: scaleMax,
        low_label: lowLabel.trim() || 'Lowest',
        high_label: highLabel.trim() || 'Highest',
      };
    }

    setLoading(true);

    try {
      const url = isEditing
        ? `${API_BASE_URL}/pulsemeters/${pulseMeterToEdit!.id}`
        : `${API_BASE_URL}/pulsemeters`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          classroom_id: classroomId,
          title: title.trim(),
          type,
          config,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} PulseMeter`);
      }
    } catch {
      setError(`Network error ${isEditing ? 'updating' : 'creating'} PulseMeter. Please check your connection.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, bgcolor: '#FFFFFF', borderBottom: `1px solid ${m3Tokens.color.outlineVariant}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
            {isEditing ? 'Edit PulseMeter' : 'Create Reusable PulseMeter'}
          </Typography>
          <IconButton size="small" onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3, bgcolor: m3Tokens.color.background }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2.5}>
            {/* Title */}
            <TextField
              label="PulseMeter Title"
              placeholder="e.g. End of Lecture Concept Check or Today's Takeaway"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              disabled={loading}
              helperText="Authored once and reusable across any session in this classroom"
            />

            {/* Type Selector Cards */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: m3Tokens.color.onSurface }}>
                Select Response Type
              </Typography>
              <RadioGroup
                value={type}
                onChange={(e) => setType(e.target.value as PulseMeterType)}
              >
                <Stack spacing={1.5}>
                  {/* Option 1: Word Cloud */}
                  <Paper
                    elevation={0}
                    onClick={() => setType('WORD_CLOUD')}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1.5px solid ${type === 'WORD_CLOUD' ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: type === 'WORD_CLOUD' ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <FormControlLabel
                      value="WORD_CLOUD"
                      control={<Radio size="small" color="primary" />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CloudQueueIcon sx={{ fontSize: 18, color: m3Tokens.color.primary }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              Word Cloud
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            Students submit single-word or short thoughts; sized dynamically by frequency
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>

                  {/* Option 2: Multiple Choice (MCQ) */}
                  <Paper
                    elevation={0}
                    onClick={() => setType('MCQ')}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1.5px solid ${type === 'MCQ' ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: type === 'MCQ' ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <FormControlLabel
                      value="MCQ"
                      control={<Radio size="small" color="primary" />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CheckCircleOutlineIcon sx={{ fontSize: 18, color: m3Tokens.color.primary }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              Multiple Choice Poll (MCQ)
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            Single-choice selection with real-time live distribution bar chart
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>

                  {/* Option 3: Rating Scale */}
                  <Paper
                    elevation={0}
                    onClick={() => setType('RATING_SCALE')}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1.5px solid ${type === 'RATING_SCALE' ? m3Tokens.color.primary : m3Tokens.color.outlineVariant}`,
                      bgcolor: type === 'RATING_SCALE' ? m3Tokens.color.primaryContainer : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <FormControlLabel
                      value="RATING_SCALE"
                      control={<Radio size="small" color="primary" />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <LinearScaleIcon sx={{ fontSize: 18, color: m3Tokens.color.primary }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              Rating Scale
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                            Numeric Likert rating (1-5 or 1-10) with custom anchor labels
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>
                </Stack>
              </RadioGroup>
            </Box>

            <Divider />

            {/* Dynamic Config Area */}
            {type === 'WORD_CLOUD' && (
              <TextField
                label="Student Prompt / Question"
                placeholder="e.g. Describe today's lecture in one word"
                value={wcPrompt}
                onChange={(e) => setWcPrompt(e.target.value)}
                fullWidth
                multiline
                rows={2}
                disabled={loading}
                helperText="Prompt displayed on the student's mobile screen during submission"
              />
            )}

            {type === 'MCQ' && (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Poll Options (Min: 2, Max: 6)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddOption}
                    disabled={mcqOptions.length >= 6 || loading}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Add Option
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {mcqOptions.map((opt, idx) => (
                    <Stack direction="row" spacing={1} key={idx} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, width: 24, textAlign: 'center', color: m3Tokens.color.primary }}>
                        {String.fromCharCode(65 + idx)}.
                      </Typography>
                      <TextField
                        size="small"
                        placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        fullWidth
                        required
                        disabled={loading}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={mcqOptions.length <= 2 || loading}
                        color="error"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {type === 'RATING_SCALE' && (
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="scale-range-label">Scale Range</InputLabel>
                  <Select
                    labelId="scale-range-label"
                    value={scaleMax}
                    label="Scale Range"
                    onChange={(e) => setScaleMax(Number(e.target.value))}
                    disabled={loading}
                  >
                    <MenuItem value={5}>1 to 5 Scale (Standard Likert)</MenuItem>
                    <MenuItem value={10}>1 to 10 Scale (Detailed Granularity)</MenuItem>
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={2}>
                  <TextField
                    size="small"
                    label="Lowest Rating Label (1)"
                    value={lowLabel}
                    onChange={(e) => setLowLabel(e.target.value)}
                    fullWidth
                    disabled={loading}
                  />
                  <TextField
                    size="small"
                    label={`Highest Rating Label (${scaleMax})`}
                    value={highLabel}
                    onChange={(e) => setHighLabel(e.target.value)}
                    fullWidth
                    disabled={loading}
                  />
                </Stack>
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#FFFFFF', borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}
          >
            {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create PulseMeter')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
