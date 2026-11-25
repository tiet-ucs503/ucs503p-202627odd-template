import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloudOffIcon from '@mui/icons-material/CloudOff';

export const metadata: Metadata = {
  title: 'Offline',
};

export default function StudentOfflinePage() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        textAlign: 'center',
        bgcolor: '#FEF7FF',
      }}
    >
      <Box sx={{ maxWidth: 360 }}>
        <CloudOffIcon sx={{ fontSize: 56, color: '#79747E', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
          You&apos;re offline
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ClassPulse needs an internet connection for attendance, live
          activities, and the forum. Reconnect and reopen the app.
        </Typography>
      </Box>
    </Box>
  );
}
