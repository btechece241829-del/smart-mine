import React from 'react';
import { UserRole, Mine } from '../../types/minegov';
import { Shield, Bell, Bot, UserCheck, FileSpreadsheet } from 'lucide-react';

interface TopbarProps {
  mines: Mine[];
  selectedMineId: string;
  currentRole: UserRole;
  unacknowledgedAlertsCount: number;
  onSelectMine: (mineId: string) => void;
  onSelectRole: (role: UserRole) => void;
  onToggleCopilot: () => void;
  onToggleAlerts: () => void;
  onOpenReports: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  mines,
  selectedMineId,
  currentRole,
  unacknowledgedAlertsCount,
  onSelectMine,
  onSelectRole,
  onToggleCopilot,
  onToggleAlerts,
  onOpenReports
}) => {
  const roles: Array<{ id: UserRole; label: string }> = [
    { id: 'CORPORATE_MGMT', label: 'Corporate Management' },
    { id: 'MINE_MANAGER', label: 'Mine Manager' },
    { id: 'SAFETY_OFFICER', label: 'Safety Officer' },
    { id: 'ENV_OFFICER', label: 'Environment Officer' },
    { id: 'PRODUCTION_OFFICER', label: 'Production Officer' },
    { id: 'CONTRACTOR_MGMT', label: 'Contractor Manager' },
    { id: 'REGULATORY_VIEWER', label: 'Regulatory Viewer' },
    { id: 'SUPER_ADMIN', label: 'Super Admin' }
  ];

  return (
    <header className="bg-carbon-900 border-b border-carbon-700/60 sticky top-0 z-30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-panel">
      {/* Title & Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-copper flex items-center justify-center text-white shadow-copper-glow">
          <Shield className="w-5.5 h-5.5 text-warm-pale" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            MineGov AI
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-copper/20 text-copper-light border border-copper/30">
              v1.0 STATUTORY
            </span>
          </h1>
          <p className="text-[11px] text-warm-slate hidden sm:block">
            Coal Mine Statutory Compliance & Multi-Domain Risk Intelligence
          </p>
        </div>
      </div>

      {/* Global Mine Selector & Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mine Selector */}
        <div className="flex items-center gap-2 bg-carbon-850 px-3 py-1 rounded-lg border border-copper/40">
          <span className="text-xs text-warm-slate font-medium hidden md:inline">Focus Mine:</span>
          <select
            value={selectedMineId}
            onChange={(e) => onSelectMine(e.target.value)}
            className="bg-transparent border-none text-xs font-mono font-bold text-copper-light outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-carbon-900 text-white">All Monitored Mines ({mines.length})</option>
            {mines.map(m => (
              <option key={m.mine_id} value={m.mine_id} className="bg-carbon-900 text-white">
                {m.mine_id} — {m.mine_name}
              </option>
            ))}
          </select>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-1.5 bg-carbon-850 px-2.5 py-1 rounded-lg border border-carbon-700/60">
          <UserCheck className="w-3.5 h-3.5 text-copper-light" />
          <select
            value={currentRole}
            onChange={(e) => onSelectRole(e.target.value as UserRole)}
            className="bg-transparent text-xs font-medium text-warm-sand outline-none cursor-pointer"
          >
            {roles.map(r => <option key={r.id} value={r.id} className="bg-carbon-900 text-gray-200">{r.label}</option>)}
          </select>
        </div>

        {/* Quick Report Generator Trigger */}
        <button
          onClick={onOpenReports}
          className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-warm-sand hover:text-copper-light transition-colors"
          title="Generate Statutory PDF/CSV Report"
        >
          <FileSpreadsheet className="w-4.5 h-4.5" />
        </button>

        {/* Rule-Derived Alerts Drawer Toggle */}
        <button
          onClick={onToggleAlerts}
          className="relative p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-warm-sand transition-colors"
          title="Rule-Derived Alert Center"
        >
          <Bell className="w-4.5 h-4.5 text-amber-400" />
          {unacknowledgedAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse">
              {unacknowledgedAlertsCount}
            </span>
          )}
        </button>

        {/* Multilingual AI Copilot Trigger */}
        <button
          onClick={onToggleCopilot}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-copper hover:bg-copper-dark text-white text-xs font-semibold shadow-copper-glow transition-all active:scale-95"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">Copilot AI</span>
        </button>
      </div>
    </header>
  );
};
