'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { m3Tokens } from '@/theme/tokens';
import type { Classroom } from '@/lib/studentTypes';

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export default function ClassroomCard({
  classroom,
  onOpen,
  onLeave,
}: {
  classroom: Classroom;
  onOpen: () => void;
  onLeave: () => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Card
      sx={{
        borderRadius: m3Tokens.shape.large,
        border: `1px solid ${m3Tokens.color.outlineVariant}`,
        boxShadow: 'none',
        overflow: 'hidden',
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ alignItems: 'stretch' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  label={classroom.course_code || 'COURSE'}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    bgcolor: m3Tokens.color.primaryContainer,
                    color: m3Tokens.color.onPrimaryContainer,
                  }}
                />
                <Chip
                  label={classroom.section_name || 'Section'}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                />
              </Stack>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, lineHeight: 1.25 }}
                noWrap
              >
                {classroom.course_name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}
              >
                <PersonOutlineIcon sx={{ fontSize: 15 }} />
                {classroom.teacher_name || 'Instructor'}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Classroom actions"
              onClick={(event) => {
                event.stopPropagation();
                setMenuAnchor(event.currentTarget);
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Attendance
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 900, color: m3Tokens.color.primary, lineHeight: 1.1 }}
              >
                {formatPercent(classroom.attendance_avg_rate)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1.25}>
              <Metric
                icon={<SpeedOutlinedIcon sx={{ fontSize: 16 }} />}
                value={classroom.pulsemeter_count ?? 0}
                label="Pulse"
              />
              <Metric
                icon={<QuizOutlinedIcon sx={{ fontSize: 16 }} />}
                value={classroom.quiz_count ?? 0}
                label="Quizzes"
              />
              <Metric
                icon={<ForumOutlinedIcon sx={{ fontSize: 16 }} />}
                value={classroom.open_doubts_count ?? 0}
                label="Doubts"
              />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onOpen();
          }}
        >
          Open classroom
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onLeave();
          }}
          sx={{ color: m3Tokens.color.error }}
        >
          Unenroll
        </MenuItem>
      </Menu>
    </Card>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Stack alignItems="center" spacing={0.1} sx={{ minWidth: 34 }}>
      <Box sx={{ color: m3Tokens.color.onSurfaceVariant }}>{icon}</Box>
      <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
        {label}
      </Typography>
    </Stack>
  );
}
