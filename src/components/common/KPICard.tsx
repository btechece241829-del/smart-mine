import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    isGood?: boolean;
  };
  icon: LucideIcon;
  badge?: React.ReactNode;
  statusColor?: 'green' | 'amber' | 'orange' | 'red' | 'copper' | 'neutral';
  onClick?: () => void;
  index?: number;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtext,
  trend,
  icon: Icon,
  badge,
  statusColor = 'copper',
  onClick,
  index = 0,
}) => {
  const colorBorders = {
    green: 'border-emerald-500/30 hover:border-emerald-500/60',
    amber: 'border-amber-500/30 hover:border-amber-500/60',
    orange: 'border-orange-500/30 hover:border-orange-500/60',
    red: 'border-rose-500/40 hover:border-rose-500/80 animate-copper-glow',
    copper: 'border-copper/30 hover:border-copper',
    neutral: 'border-warm-slate/20 hover:border-warm-slate/40',
  };

  const iconBg = {
    green: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-rose-500/15 text-rose-400',
    copper: 'bg-copper/15 text-copper-light',
    neutral: 'bg-carbon-700 text-warm-sand',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.26, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-carbon-800/80 backdrop-blur-sm rounded-xl p-4 border ${colorBorders[statusColor]} cursor-pointer transition-all duration-200 shadow-panel relative overflow-hidden group`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-warm-slate group-hover:text-warm-sand transition-colors">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${iconBg[statusColor]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold font-mono text-warm-pale group-hover:text-white transition-colors">
          {value}
        </span>
        {badge}
      </div>

      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-carbon-700/50">
        <span className="text-warm-slate text-[11px] truncate max-w-[170px]">{subtext}</span>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 font-mono text-[11px] ${
              trend.direction === 'neutral'
                ? 'text-warm-slate'
                : trend.isGood
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {trend.direction === 'up' && <ArrowUpRight className="w-3 h-3" />}
            {trend.direction === 'down' && <ArrowDownRight className="w-3 h-3" />}
            {trend.direction === 'neutral' && <Minus className="w-3 h-3" />}
            {trend.value}
          </span>
        )}
      </div>
    </motion.div>
  );
};
