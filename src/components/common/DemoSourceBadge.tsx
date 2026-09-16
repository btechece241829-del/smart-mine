import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface DemoSourceBadgeProps {
  source?: string;
  note?: string;
  className?: string;
}

export const DemoSourceBadge: React.FC<DemoSourceBadgeProps> = ({
  source = 'DEMO_SYNTHETIC',
  note,
  className = ''
}) => {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-carbon-700/60 border border-warm-slate/30 text-warm-sand ${className}`}>
      <ShieldAlert className="w-3 h-3 text-copper-light" />
      <span>{source}</span>
      {note && <span className="text-warm-slate max-w-[200px] truncate" title={note}>| {note}</span>}
    </div>
  );
};
