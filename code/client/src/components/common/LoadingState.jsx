import React from 'react';
import { Loader2, Zap } from 'lucide-react';

export default function LoadingState({ text = 'Loading data...', skeleton = false }) {
  if (skeleton) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Top Hero Skeleton */}
        <div className="h-32 panel-card skeleton" />
        {/* Bento Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 panel-card skeleton" />
          <div className="h-28 panel-card skeleton" />
          <div className="h-28 panel-card skeleton" />
          <div className="h-28 panel-card skeleton" />
        </div>
        {/* Table/List Skeleton */}
        <div className="h-64 panel-card skeleton" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center py-20 gap-4 panel-card">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)' }}
      />
      
      <div className="relative z-10 flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--brand-light)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--brand-primary)] animate-pulse">
          <Zap className="w-6 h-6 animate-bounce" />
        </div>
        <Loader2 className="w-16 h-16 text-[var(--brand-primary)] animate-spin absolute -inset-2 opacity-50" />
      </div>
      
      <p className="text-xs font-mono font-semibold text-[var(--text-secondary)] tracking-wide z-10 animate-pulse">
        {text}
      </p>
    </div>
  );
}
