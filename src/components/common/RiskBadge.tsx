import React from 'react';

interface RiskBadgeProps {
  score: number;
  band?: 'Low' | 'Moderate' | 'High' | 'Critical';
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, band, size = 'md' }) => {
  let computedBand = band;
  if (!computedBand) {
    if (score >= 70) computedBand = 'Critical';
    else if (score >= 50) computedBand = 'High';
    else if (score >= 30) computedBand = 'Moderate';
    else computedBand = 'Low';
  }

  const styles = {
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Moderate: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    Critical: 'bg-rose-500/15 text-rose-400 border-rose-500/40 animate-pulse',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3.5 py-1.5 text-sm font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-md font-mono ${styles[computedBand]} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        computedBand === 'Critical' ? 'bg-rose-400' :
        computedBand === 'High' ? 'bg-orange-400' :
        computedBand === 'Moderate' ? 'bg-amber-400' : 'bg-emerald-400'
      }`} />
      <span>{score.toFixed(1)}</span>
      <span className="opacity-75 font-sans font-normal">({computedBand})</span>
    </span>
  );
};
