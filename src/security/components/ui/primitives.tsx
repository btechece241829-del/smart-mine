// ────────────────────────────────────────────────────────────────
// Reusable UI primitives (dark mining theme)
// ────────────────────────────────────────────────────────────────
import React from 'react';
import { Severity, ComplaintStatus } from '../../lib/types';
import { SEVERITY_COLORS, STATUS_COLORS } from '../../lib/analytics';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; label?: string }> = ({ size = 'md', label }) => {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <div className="flex items-center justify-center gap-2">
      <div className={`${sz} border-2 border-copper/30 border-t-copper-light rounded-full animate-spin`} />
      {label && <span className="text-xs text-warm-slate">{label}</span>}
    </div>
  );
};

export const SeverityBadge: React.FC<{ value: Severity; size?: 'sm' | 'md' }> = ({ value, size = 'sm' }) => {
  const cls = SEVERITY_COLORS[value] ?? SEVERITY_COLORS.Medium;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${cls} ${size === 'md' ? 'px-2.5 py-1 text-xs' : ''}`}>
      {value}
    </span>
  );
};

export const StatusBadge: React.FC<{ value: ComplaintStatus | string; size?: 'sm' | 'md' }> = ({ value, size = 'sm' }) => {
  const cls = STATUS_COLORS[value] ?? STATUS_COLORS.Submitted;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${cls} ${size === 'md' ? 'px-2.5 py-1 text-xs' : ''}`}>
      {value}
    </span>
  );
};

export const Card: React.FC<{ title?: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }> = ({
  title, subtitle, icon, actions, children, className = '', padded = true,
}) => (
  <div className={`bg-carbon-800/70 border border-carbon-700/60 rounded-xl shadow-panel ${className}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-carbon-700/60">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-warm-pale">{title}</h3>
            {subtitle && <p className="text-[11px] text-warm-slate">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
    )}
    <div className={padded ? 'p-4' : ''}>{children}</div>
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'; loading?: boolean }> = ({
  variant = 'primary', loading, children, className = '', disabled, ...rest
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-copper hover:bg-copper-dark text-white border-copper/40 shadow-copper-glow',
    secondary: 'bg-carbon-850 hover:bg-carbon-700 text-warm-sand border-carbon-700',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/50',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50',
    ghost: 'bg-transparent hover:bg-carbon-700 text-warm-sand border-transparent',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
};

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    {icon && <div className="text-warm-slate mb-3">{icon}</div>}
    <p className="text-sm font-semibold text-warm-pale">{title}</p>
    {subtitle && <p className="text-xs text-warm-slate mt-1 max-w-sm">{subtitle}</p>}
  </div>
);
