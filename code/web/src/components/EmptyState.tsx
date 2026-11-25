'use client';

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { m3Tokens } from '@/theme/tokens';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon = <InboxOutlinedIcon sx={{ fontSize: 64, color: m3Tokens.color.secondary }} />,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 6,
        textAlign: 'center',
        borderRadius: m3Tokens.shape.large,
        backgroundColor: m3Tokens.color.surfaceVariant,
        border: `1px dashed ${m3Tokens.color.outline}`,
        my: 2,
      }}
    >
      <Box sx={{ mb: 2 }}>{icon}</Box>
      <Typography variant="h6" sx={{ color: m3Tokens.color.onSurface, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, maxW: 400, mb: actionLabel ? 3 : 0 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" color="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};
