// Sidebar navigation — gated by role
import React from 'react';
import {
  LayoutDashboard, Plus, List, Bell, User, Shield, AlertTriangle, Building2,
  Users, BarChart, FileText, ScrollText, Settings, ArrowUpRight, HardHat, X, Boxes, Search,
  UploadCloud, MapPin, UserCheck, ClipboardList, ScanLine, Fingerprint, QrCode, ShieldCheck, Blocks,
} from 'lucide-react';
import { navForRole, PageKey, NavItem } from '../../lib/permissions';
import { UserRole, ROLE_LABELS } from '../../lib/types';

const ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  upload: UploadCloud,
  plus: Plus,
  list: List,
  bell: Bell,
  user: User,
  shield: Shield,
  alert: AlertTriangle,
  arrow: ArrowUpRight,
  report: FileText,
  mine: Building2,
  users: Users,
  dept: Boxes,
  chart: BarChart,
  log: ScrollText,
  settings: Settings,
  search: Search,
  map: MapPin,
  attendance: UserCheck,
  register: ClipboardList,
  scan: ScanLine,
  clipboard: ScrollText,
  // Blockchain module icons
  blocks: Blocks,
  shieldcheck: ShieldCheck,
  fingerprint: Fingerprint,
  qr: QrCode,
};

interface SidebarProps {
  role: UserRole;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, currentPage, onNavigate, mobileOpen, onClose }) => {
  const items = navForRole(role);
  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-carbon-900 border-r border-carbon-700/60 flex flex-col shrink-0 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-carbon-700/60">
        <div className="w-9 h-9 rounded-lg bg-copper flex items-center justify-center shadow-copper-glow">
          <HardHat className="w-5 h-5 text-warm-pale" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white leading-tight">Coal Mine Compliance</div>
          <div className="text-[10px] text-warm-slate font-mono">Safety Issue Management</div>
        </div>
        <button className="lg:hidden text-warm-slate" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      <div className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-warm-slate/70 border-b border-carbon-700/40">
        Navigation · {ROLE_LABELS[role]}
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item: NavItem) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active = currentPage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key as PageKey); onClose(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all relative ${active ? 'text-white bg-carbon-800 border border-copper/40 shadow-copper-glow font-semibold' : 'text-warm-sand/80 hover:text-white hover:bg-carbon-850'}`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-copper rounded-r" />}
              <Icon className={`w-4 h-4 ${active ? 'text-copper-light' : 'text-warm-slate'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-carbon-700/50 bg-carbon-850/60 text-[10px] text-warm-slate">
        <div className="flex items-center justify-between font-mono">
          <span>AUTH:</span>
          <span className="text-copper-light font-semibold">FIREBASE AUTH</span>
        </div>
      </div>
    </aside>
  );
};
