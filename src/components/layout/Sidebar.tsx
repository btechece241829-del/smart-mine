import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileCheck2,
  ClipboardList,
  ShieldAlert,
  Map,
  Leaf,
  Pickaxe,
  Users,
  FileText,
  Workflow,
  BellRing,
  UserCheck,
  FileSpreadsheet,
  Layers,
  Boxes,
  Database
} from 'lucide-react';

export type NavView =
  | 'command_center'
  | 'compliance'
  | 'inspections_capa'
  | 'safety_ai'
  | 'gis'
  | 'environment'
  | 'operations'
  | 'workforce_contractors'
  | 'documents_ocr'
  | 'workflow_automation'
  | 'alerts_escalation'
  | 'role_views'
  | 'reports'
  | 'subsidiary_comparative'
  | 'blockchain_audit'
  | 'data_integrations';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  counts?: {
    overdueCompliance?: number;
    overdueCAPA?: number;
    sensorAnomalies?: number;
    lowConfidenceDocs?: number;
    criticalAlerts?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  counts = {}
}) => {
  const navItems: Array<{
    id: NavView;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: 'red' | 'amber' | 'copper';
  }> = [
    { id: 'command_center', label: 'Command Center', icon: LayoutDashboard },
    { id: 'compliance', label: 'Statutory Compliance', icon: FileCheck2, badge: counts.overdueCompliance, badgeColor: 'amber' },
    { id: 'inspections_capa', label: 'Inspections & CAPA', icon: ClipboardList, badge: counts.overdueCAPA, badgeColor: 'red' },
    { id: 'safety_ai', label: 'Safety & AI Risk', icon: ShieldAlert, badge: counts.sensorAnomalies, badgeColor: 'red' },
    { id: 'gis', label: 'GIS Intelligence', icon: Map },
    { id: 'environment', label: 'Environment', icon: Leaf },
    { id: 'operations', label: 'Operations & Assets', icon: Pickaxe },
    { id: 'workforce_contractors', label: 'Workforce & Contractors', icon: Users },
    { id: 'documents_ocr', label: 'Documents & OCR', icon: FileText, badge: counts.lowConfidenceDocs, badgeColor: 'amber' },
    { id: 'workflow_automation', label: 'Workflow & Approvals', icon: Workflow },
    { id: 'alerts_escalation', label: 'Alerts & Escalation', icon: BellRing, badge: counts.criticalAlerts, badgeColor: 'red' },
    { id: 'role_views', label: 'Role Scoped Views', icon: UserCheck },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'subsidiary_comparative', label: 'Subsidiary Comparison', icon: Layers },
    { id: 'blockchain_audit', label: 'Blockchain Audit Trail', icon: Boxes },
    { id: 'data_integrations', label: 'Data & Audit Trail', icon: Database },
  ];

  return (
    <aside className="w-64 bg-carbon-900 border-r border-carbon-700/60 flex flex-col shrink-0 min-h-[calc(100vh-57px)] select-none">
      <div className="px-3 py-3 text-[11px] font-semibold font-mono tracking-wider text-warm-slate uppercase border-b border-carbon-700/40">
        Navigation Domains
      </div>

      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all relative group ${
                isActive
                  ? 'text-white bg-carbon-800 border border-copper/40 shadow-copper-glow font-semibold'
                  : 'text-warm-sand/80 hover:text-white hover:bg-carbon-850'
              }`}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-copper rounded-r"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <div className="flex items-center gap-2.5 z-10 pl-1">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-copper-light' : 'text-warm-slate group-hover:text-copper-light'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && item.badge > 0 ? (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    item.badgeColor === 'red'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : item.badgeColor === 'amber'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-copper/20 text-copper-light border border-copper/40'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer Lineage & Platform Note */}
      <div className="p-3 border-t border-carbon-700/50 bg-carbon-850/60 text-[10px] text-warm-slate space-y-1">
        <div className="flex items-center justify-between font-mono">
          <span>DATA LAYER:</span>
          <span className="text-copper-light font-semibold">13 CSV FILES</span>
        </div>
        <p className="leading-tight text-[9.5px]">
          Deterministic Rule Engine + ML Anomaly & Risk Scoring Engine.
        </p>
      </div>
    </aside>
  );
};
