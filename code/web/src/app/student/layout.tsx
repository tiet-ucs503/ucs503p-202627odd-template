import type { Metadata, Viewport } from 'next';
import StudentPwaProvider from '@/components/student/StudentPwaProvider';
import StudentShell from '@/components/student/StudentShell';

export const metadata: Metadata = {
  title: {
    default: 'ClassPulse Student',
    template: '%s · ClassPulse',
  },
  description:
    'QR attendance, live classes, quizzes, and the doubt forum for ClassPulse students.',
  applicationName: 'ClassPulse',
  manifest: '/student/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ClassPulse',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: '/icons/student-192.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6750A4',
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentPwaProvider>
      <StudentShell>{children}</StudentShell>
    </StudentPwaProvider>
  );
}
