import React from 'react';
import { Layers } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = Layers, 
  title = 'No records found', 
  description = 'Try clearing your active filters or search terms.',
  actionText,
  onAction 
}) {
  return (
    <div className="relative overflow-hidden py-14 px-6 text-center panel-card border-dashed">
      {/* Background glow orb */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)' }}
      />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-accent)] flex items-center justify-center mb-4 text-[var(--brand-primary)] shadow-sm animate-float">
          <Icon className="w-7 h-7" />
        </div>
        
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5 tracking-tight">
          {title}
        </h3>
        
        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mb-5 leading-relaxed">
          {description}
        </p>
        
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="btn-primary text-xs shadow-sm hover:shadow-[var(--brand-glow)]"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}
