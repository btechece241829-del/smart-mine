import React, { useState, useMemo } from 'react';
import { DatasetBundle, WorkflowStep } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import {
  GitBranch, AlarmClock, CheckCircle2, Clock, AlertTriangle,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';

interface WorkflowAutomationViewProps {
  data: DatasetBundle;
  selectedMineId: string;
  onAuditLog?: (action: string, details: string) => void;
  workflowSteps?: WorkflowStep[];
  setWorkflowSteps?: React.Dispatch<React.SetStateAction<WorkflowStep[]>>;
  dbStatus?: string;
}

interface LocalWorkflow {
  workflow_id: string; title: string; category: string; mine_id: string;
  assigned_to_role: string; status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  sla_remaining_hrs: number; is_overdue: boolean; reminder_sent: boolean;
  source_table: string; source_id: string;
}

function buildWorkflows(data: DatasetBundle, mineId: string) {
  const scope = (arr: any[]) => mineId === 'ALL' ? arr : arr.filter((x: any) => x.mine_id === mineId);
  const workflows: Array<{
    workflow_id: string; title: string; category: string; mine_id: string;
    assigned_to_role: string; status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
    sla_remaining_hrs: number; is_overdue: boolean; reminder_sent: boolean;
    source_table: string; source_id: string;
  }> = [];

  scope(data.correctiveActions).slice(0, 30).forEach(ca => {
    const overdue = ca.status === 'OVERDUE';
    workflows.push({
      workflow_id: `WF-CAPA-${ca.action_id}`, mine_id: ca.mine_id,
      title: `CAPA Approval: ${ca.corrective_action.substring(0, 55)}${ca.corrective_action.length > 55 ? '…' : ''}`,
      category: 'CAPA', assigned_to_role: ca.assigned_to_role,
      status: overdue ? 'ESCALATED' : (ca.status === 'COMPLETED' ? 'APPROVED' : ca.status === 'IN_PROGRESS' ? 'IN_REVIEW' : 'PENDING'),
      sla_remaining_hrs: overdue ? 0 : (ca.verification_required === 'YES' ? 18 : 5),
      is_overdue: overdue, reminder_sent: overdue || ca.verification_required === 'YES',
      source_table: '05_corrective_actions.csv', source_id: ca.action_id,
    });
  });

  scope(data.compliances).filter(c => c.status === 'DUE_SOON' || c.status === 'OVERDUE').slice(0, 20).forEach(c => {
    const overdue = c.status === 'OVERDUE';
    workflows.push({
      workflow_id: `WF-CMP-${c.compliance_id}`, mine_id: c.mine_id,
      title: `Compliance Submission: ${c.regulation_name}`,
      category: 'COMPLIANCE', assigned_to_role: c.responsible_officer_role,
      status: overdue ? 'ESCALATED' : 'IN_REVIEW',
      sla_remaining_hrs: overdue ? 0 : 12,
      is_overdue: overdue, reminder_sent: overdue,
      source_table: '02_compliances.csv', source_id: c.compliance_id,
    });
  });

  scope(data.documents).filter(d => (d.ocr_confidence_pct ?? d.extraction_confidence * 100) < 82 || d.verification_status === 'HUMAN_VERIFICATION_REQUIRED').slice(0, 15).forEach(d => {
    workflows.push({
      workflow_id: `WF-DOC-${d.document_id}`, mine_id: d.mine_id,
      title: `OCR Human Verification: ${d.document_name ?? d.document_type}`,
      category: 'DOCUMENT', assigned_to_role: 'Safety Officer',
      status: 'PENDING', sla_remaining_hrs: 24, is_overdue: false, reminder_sent: false,
      source_table: '13_statutory_documents.csv', source_id: d.document_id,
    });
  });

  return workflows;
}

export const WorkflowAutomationView: React.FC<WorkflowAutomationViewProps> = ({
  data, selectedMineId, onAuditLog, workflowSteps: wfProp, setWorkflowSteps, dbStatus
}) => {
  const builtWorkflows = useMemo<LocalWorkflow[]>(() => buildWorkflows(data, selectedMineId) as LocalWorkflow[], [data, selectedMineId]);
  const [localWorkflows, setLocalWorkflows] = useState<LocalWorkflow[]>(builtWorkflows);
  const workflows: LocalWorkflow[] = wfProp && wfProp.length > 0 ? (wfProp as unknown as LocalWorkflow[]) : localWorkflows;
  const [filter, setFilter] = useState('ALL');

  const filtered = workflows.filter(w => filter === 'ALL' || w.category === filter);
  const pending = filtered.filter(w => w.status === 'PENDING').length;
  const inReview = filtered.filter(w => w.status === 'IN_REVIEW').length;
  const approved = filtered.filter(w => w.status === 'APPROVED').length;
  const overdue = filtered.filter(w => w.is_overdue).length;
  const escalated = filtered.filter(w => w.status === 'ESCALATED').length;
  const remindersActive = filtered.filter(w => !w.is_overdue && w.sla_remaining_hrs <= 12).length;

  const handleReview = (id: string, outcome: 'APPROVED' | 'REJECTED') => {
    setLocalWorkflows(prev => prev.map(w => w.workflow_id === id ? { ...w, status: outcome, reminder_sent: true } : w));
    onAuditLog?.(`WORKFLOW_${outcome === 'APPROVED' ? 'APPROVAL' : 'REJECTION'}`, `Workflow #${id} ${outcome.toLowerCase()}`);
  };

  const handleEscalate = (id: string) => {
    setLocalWorkflows(prev => prev.map(w => w.workflow_id === id ? { ...w, status: 'ESCALATED', reminder_sent: true } : w));
    onAuditLog?.('WORKFLOW_ESCALATION', `Workflow #${id} escalated to Corporate HQ`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-copper-light" />
            Automated Workflow & SLA Reminder Engine
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Digital approval workflows, SLA-countdown timers, automated reminders, and multi-tier escalation for CAPA, compliance submissions, and document verification.
          </p>
        </div>
        <DemoSourceBadge source="corrective_actions.csv, compliances.csv, documents.csv" note="Workflow Automation Engine" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { val: filtered.length, label: 'Active Workflows', color: 'text-white' },
          { val: pending, label: 'Pending Start', color: 'text-blue-400' },
          { val: inReview, label: 'In Review', color: 'text-amber-400' },
          { val: approved, label: 'Approved', color: 'text-emerald-400' },
          { val: overdue, label: 'Overdue / Escalated', color: 'text-rose-400' },
          { val: remindersActive, label: 'Upcoming Reminders', color: 'text-copper-light' },
        ].map((kpi, i) => (
          <div key={i} className="bg-carbon-850 p-3.5 rounded-xl border border-carbon-700/60 shadow-panel text-center">
            <div className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.val}</div>
            <div className="text-[11px] text-warm-slate mt-1 font-medium">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Pipeline + Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Visual */}
        <div className="lg:col-span-1 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-4">
          <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-copper-light" /> Automation Pipeline
          </h3>
          {[
            { label: 'Pending Start', count: pending, color: 'bg-blue-500' },
            { label: 'In Review', count: inReview, color: 'bg-amber-500' },
            { label: 'Approved', count: approved, color: 'bg-emerald-500' },
            { label: 'Escalated', count: escalated, color: 'bg-rose-500' },
          ].map(step => (
            <div key={step.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-warm-slate font-medium">{step.label}</span>
                <span className="font-mono font-bold text-white">{step.count}</span>
              </div>
              <div className="h-2 bg-carbon-900 rounded-full overflow-hidden">
                <div className={`h-full ${step.color} rounded-full transition-all`} style={{ width: `${filtered.length ? (step.count / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>


        {/* Approval Inbox */}
        <div className="lg:col-span-2 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-copper-light" /> Digital Approval Inbox ({filtered.length})
            </h3>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-carbon-900 border border-carbon-700 rounded px-2 py-1 text-[10px] text-warm-sand outline-none font-mono">
              <option value="ALL">All Categories</option>
              <option value="CAPA">CAPA</option>
              <option value="COMPLIANCE">Compliance</option>
              <option value="DOCUMENT">Document</option>
            </select>
          </div>
          <div className="overflow-y-auto max-h-[440px] space-y-2.5">
            {filtered.map(w => (
              <div key={w.workflow_id} className="p-3 bg-carbon-900 rounded-lg border border-carbon-700/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    w.category === 'CAPA' ? 'bg-copper/20 text-copper-light' :
                    w.category === 'COMPLIANCE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'}`}>{w.category}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                    w.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' :
                    w.status === 'ESCALATED' ? 'bg-rose-500/30 text-rose-300' :
                    w.is_overdue ? 'bg-rose-500/20 text-rose-400' :
                    w.status === 'IN_REVIEW' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'}`}>{w.status}</span>
                </div>
                <div className="text-[11px] text-warm-pale font-medium">{w.title}</div>
                <div className="flex items-center justify-between text-[10px] font-mono text-warm-slate">
                  <span>{w.mine_id} • {w.assigned_to_role}</span>
                  <span className="text-[9px]">{w.source_table} #{w.source_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 text-[10px] font-mono ${w.is_overdue ? 'text-rose-400' : w.sla_remaining_hrs <= 12 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {w.is_overdue ? <AlertTriangle className="w-3 h-3" /> : w.sla_remaining_hrs <= 12 ? <AlarmClock className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {w.is_overdue ? 'OVERDUE — ESCALATE' : `${w.sla_remaining_hrs}h SLA remaining`}
                    {w.reminder_sent && <span className="text-[9px] text-copper-light ml-1">(reminder sent)</span>}
                  </div>
                  {!['APPROVED', 'REJECTED', 'ESCALATED'].includes(w.status) && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleReview(w.workflow_id, 'APPROVED')}
                        className="px-2 py-1 bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 rounded text-[10px] font-mono hover:bg-emerald-600 hover:text-white flex items-center gap-1 transition-colors">
                        <ThumbsUp className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => handleReview(w.workflow_id, 'REJECTED')}
                        className="px-2 py-1 bg-rose-600/20 border border-rose-600/40 text-rose-400 rounded text-[10px] font-mono hover:bg-rose-600 hover:text-white flex items-center gap-1 transition-colors">
                        <ThumbsDown className="w-3 h-3" /> Reject
                      </button>
                      <button onClick={() => handleEscalate(w.workflow_id)}
                        className="px-2 py-1 bg-amber-600/20 border border-amber-600/40 text-amber-400 rounded text-[10px] font-mono hover:bg-amber-600 hover:text-white flex items-center gap-1 transition-colors">
                        <AlertTriangle className="w-3 h-3" /> Escalate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-warm-slate text-xs py-8 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No workflows match this filter
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

