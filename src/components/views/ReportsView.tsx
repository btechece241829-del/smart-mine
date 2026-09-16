import React, { useState, useMemo } from 'react';
import { DatasetBundle, DerivedMineMetrics, RuleDerivedAlert } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { FileSpreadsheet, Printer, Download, FileText, CheckCircle2 } from 'lucide-react';

interface ReportsViewProps {
  data: DatasetBundle;
  metrics: DerivedMineMetrics[];
  alerts: RuleDerivedAlert[];
  selectedMineId: string;
}

const REPORT_TYPES = [
  { id: 'EXECUTIVE_SUMMARY', title: 'Executive Mine Governance & Risk Summary', desc: 'Overall risk score breakdown, compliance index, and top 5 risk drivers across all mines.' },
  { id: 'DGMS_STATUTORY', title: 'DGMS Statutory Compliance & Inspection Report', desc: 'Detailed compliance status for DGMS Act/CMR rules, pending licenses, and checklist scores.' },
  { id: 'MOEFCC_ENV', title: 'MoEFCC Environmental Monitoring Audit', desc: 'Air quality (PM2.5, PM10), water pH discharge, and noise limit exceedances log.' },
  { id: 'CAPA_AGING', title: 'CAPA Aging & Overdue Action Items Board', desc: 'Kanban audit of open, overdue, and pending verification corrective actions.' },
  { id: 'SAFETY_INCIDENT', title: 'Safety Incidents & Telemetry Anomaly Summary', desc: 'Historical accident classification, root causes, and IoT sensor anomaly events.' },
  { id: 'CONTRACTOR_PERF', title: 'Contractor Risk Tier & Worker Fitness Audit', desc: 'Outsourced contractor safety audit scores and worker vocational/medical status.' },
  { id: 'FLEET_HEALTH', title: 'Heavy Equipment Maintenance & Breakdown Summary', desc: 'Machinery health scores, 24-hour breakdown hours, and operational status.' },
  { id: 'DOCUMENT_OCR', title: 'Statutory Clearance Ingestion & OCR Audit', desc: 'Document verification queue, OCR confidence scores, and upcoming expiry dates.' }
];

export const ReportsView: React.FC<ReportsViewProps> = ({ data, metrics, alerts, selectedMineId }) => {
  const [generated, setGenerated] = useState<string | null>(null);

  const filteredMines = selectedMineId === 'ALL'
    ? metrics
    : metrics.filter(m => m.mine.mine_id === selectedMineId);

  const criticalAlertCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length;

  const handleGenerate = (reportId: string) => {
    setGenerated(reportId);
    setTimeout(() => setGenerated(null), 3000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <FileText className="w-6 h-6 text-copper-light" />
            Governance Reports & Intelligence Packs
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Pre-built compliance intelligence reports, statutory regulatory submissions, and operational analytics.
          </p>
        </div>
        <DemoSourceBadge source="Aggregated from all datasets" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold text-copper-light">{data.mines.length}</div>
          <div className="text-[10px] text-warm-slate font-mono mt-1">TOTAL MINES</div>
        </div>
        <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold text-emerald-400">{filteredMines.length}</div>
          <div className="text-[10px] text-warm-slate font-mono mt-1">REPORTS SCOPE</div>
        </div>
        <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold text-rose-400">{criticalAlertCount}</div>
          <div className="text-[10px] text-warm-slate font-mono mt-1">CRITICAL ALERTS</div>
        </div>
        <div className="bg-carbon-850 p-3 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold text-amber-400">{data.correctiveActions.length}</div>
          <div className="text-[10px] text-warm-slate font-mono mt-1">CAPA ITEMS</div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TYPES.map(report => (
          <div key={report.id} className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-white">{report.title}</h3>
              {generated === report.id && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Generated
                </span>
              )}
            </div>
            <p className="text-[11px] text-warm-slate leading-relaxed">{report.desc}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleGenerate(report.id)}
                className="px-3 py-1.5 bg-copper hover:bg-copper-dark text-white rounded text-[10px] font-mono font-bold transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3 h-3" /> Generate CSV
              </button>
              <button className="px-3 py-1.5 bg-carbon-800 hover:bg-carbon-700 text-warm-sand border border-carbon-700 rounded text-[10px] font-mono transition-colors flex items-center gap-1.5">
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
