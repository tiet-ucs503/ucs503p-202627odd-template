import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import MobileDrawer from './MobileDrawer';
import { useApi } from '../../hooks/useApi';
import api from '../../services/api';

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: dashboardData } = useApi(api.getDashboard, [], true);

  const dueCount = dashboardData?.todaysRevision?.length || dashboardData?.todaysRecallRecommendations?.length || 0;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col relative overflow-x-hidden selection:bg-[var(--brand-primary)] selection:text-white">
      {/* Background Ambient Lighting Orbs */}
      <div 
        className="fixed -top-40 -right-40 w-96 h-96 rounded-full pointer-events-none opacity-30 dark:opacity-20 blur-3xl z-0"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)' }}
      />
      <div 
        className="fixed top-1/2 -left-40 w-80 h-80 rounded-full pointer-events-none opacity-20 dark:opacity-15 blur-3xl z-0"
        style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)' }}
      />

      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onNavigate={() => setMobileOpen(false)}
      />

      {/* Mobile Drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 relative z-10 ${
        collapsed ? 'lg:ml-[var(--sidebar-collapsed)]' : 'lg:ml-[var(--sidebar-width)]'
      }`}>
        <TopHeader
          onMobileMenuToggle={() => setMobileOpen(true)}
          dueCount={dueCount}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
