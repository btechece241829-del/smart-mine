import React from 'react';
import { UserRole } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { UserCheck, ShieldCheck, Lock, Eye, CheckCircle2 } from 'lucide-react';

interface RoleViewsViewProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

const ROLES_INFO: Array<{
  id: UserRole;
  title: string;
  scope: string;
  permissions: string[];
  restricted: string[];
}> = [
  {
    id: 'CORPORATE_MGMT',
    title: 'Corporate Management',
    scope: 'Multi-Mine Enterprise Portfolio',
    permissions: ['View Enterprise Risk Map', 'Generate Board Reports', 'Access All Mines Data', 'View Escalation Chains'],
    restricted: ['Direct Field Inspection Edit']
  },
  {
    id: 'MINE_MANAGER',
    title: 'Mine Manager',
    scope: 'Assigned Single Mine Operational Unit',
    permissions: ['Approve CAPA Resolution', 'Acknowledge Mine Alerts', 'Submit Statutory Compliance Responses'],
    restricted: ['Cross-mine Corporate Config']
  },
  {
    id: 'SAFETY_OFFICER',
    title: 'Safety Officer',
    scope: 'Mine Safety & Incident Prevention',
    permissions: ['Log Inspections & Violations', 'Track Sensor Anomalies', 'Assign CAPA Work Orders'],
    restricted: ['Financial & Commercial Telemetry']
  },
  {
    id: 'ENV_OFFICER',
    title: 'Environmental Officer',
    scope: 'Air, Water & Noise Quality Stations',
    permissions: ['Review Exceedance Telemetry', 'File PCB Compliance Submissions', 'Update Station Limits'],
    restricted: ['Workforce HR Data']
  },
  {
    id: 'PRODUCTION_OFFICER',
    title: 'Production Officer',
    scope: 'Mining Operations & Equipment Fleet',
    permissions: ['Track Tonnage Achievement', 'Log Equipment Breakdown Hours', 'Monitor Fleet Telemetry'],
    restricted: ['Regulatory Audit Signoff']
  },
  {
    id: 'CONTRACTOR_MGMT',
    title: 'Contractor Manager',
    scope: 'Outsourced Workforce & Equipment',
    permissions: ['View Contractor Audit Scores', 'Verify Worker Fitness Cards', 'Submit Vocational Proof'],
    restricted: ['Mine Statutory Licenses']
  },
  {
    id: 'REGULATORY_VIEWER',
    title: 'Regulatory Viewer (DGMS / MoEFCC)',
    scope: 'Statutory Compliance Audit Read-Only',
    permissions: ['Inspect Audit Lineage', 'Export Statutory PDFs', 'View Verified Documents'],
    restricted: ['All State-Changing Mutations']
  },
  {
    id: 'SUPER_ADMIN',
    title: 'Super Admin',
    scope: 'System Systemic Control & Data Lineage',
    permissions: ['Full Access & RBAC Controls', 'Direct CSV Pipeline Re-sync', 'Override Risk Weights'],
    restricted: ['None']
  }
];
export const RoleViewsView: React.FC<RoleViewsViewProps> = ({
  currentRole,
  onRoleChange
}) => {
  const activeRoleInfo = ROLES_INFO.find(r => r.id === currentRole) || ROLES_INFO[0];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-copper-light" />
            Role-Based Access Control (RBAC) & Persona Scope Switcher
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Dynamic governance scope switching supporting 8 statutory role personas with strict privilege boundaries.
          </p>
        </div>
        <DemoSourceBadge source="13 CSV DATA LAYER" note="Role-Filtered RBAC Engine" />
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES_INFO.map(r => {
          const isSelected = r.id === currentRole;
          return (
            <button
              key={r.id}
              onClick={() => onRoleChange(r.id)}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                isSelected
                  ? 'bg-copper/15 border-copper shadow-copper-glow ring-1 ring-copper'
                  : 'bg-carbon-850 border-carbon-700 hover:border-carbon-600'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                    isSelected ? 'bg-copper text-white' : 'bg-carbon-800 text-warm-slate'
                  }`}>
                    {isSelected ? 'ACTIVE ROLE' : 'SWITCH'}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-copper-light" />}
                </div>

                <div className="font-bold text-sm text-warm-pale">{r.title}</div>
                <div className="text-[11px] text-warm-slate">{r.scope}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Role Detailed Permissions Matrix */}
      <div className="bg-carbon-850 p-5 rounded-xl border border-carbon-700/60 shadow-panel space-y-4">
        <div className="flex items-center gap-3 border-b border-carbon-700 pb-3">
          <div className="w-10 h-10 rounded-xl bg-copper flex items-center justify-center text-white font-bold shadow-copper-glow">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">{activeRoleInfo.title} Permissions</h3>
            <p className="text-xs text-warm-slate">Scope: {activeRoleInfo.scope}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Granted Privileges */}
          <div className="space-y-2">
            <span className="text-xs font-bold font-mono uppercase text-emerald-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Granted Access Capabilities
            </span>
            <div className="space-y-2">
              {activeRoleInfo.permissions.map((perm, idx) => (
                <div key={idx} className="p-2.5 bg-carbon-900 rounded-lg border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {perm}
                </div>
              ))}
            </div>
          </div>

          {/* Restricted Operations */}
          <div className="space-y-2">
            <span className="text-xs font-bold font-mono uppercase text-warm-slate flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-warm-slate" /> Restricted Governance Boundaries
            </span>
            <div className="space-y-2">
              {activeRoleInfo.restricted.map((rest, idx) => (
                <div key={idx} className="p-2.5 bg-carbon-900/60 rounded-lg border border-carbon-700 text-xs font-mono text-warm-slate flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  {rest}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

