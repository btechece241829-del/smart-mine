const fs = require('fs');

const part1 = [
  "import React, { useState, useMemo } from 'react';",
  "import { DatasetBundle, DerivedMineMetrics, RuleDerivedAlert } from '../../types/minegov';",
  "import { DemoSourceBadge } from '../common/DemoSourceBadge';",
  "import { exportReportToCSV, triggerPrintReport } from '../../services/reportGenerator';",
  "import { FileSpreadsheet, Printer, Download, FileText, CheckCircle2 } from 'lucide-react';",
  "",
  "interface ReportsViewProps {",
  "  data: DatasetBundle;",
  "  metrics: DerivedMineMetrics[];",
  "  alerts: RuleDerivedAlert[];",
  "  selectedMineId: string;",
  "}",
  "",
  "const REPORT_TYPES = [",
  "  { id: 'EXECUTIVE_SUMMARY', title: 'Executive Mine Governance & Risk Summary', desc: 'Overall risk score breakdown, compliance index, and top 5 risk drivers across all mines.' },",
  "  { id: 'DGMS_STATUTORY', title: 'DGMS Statutory Compliance & Inspection Report', desc: 'Detailed compliance status for DGMS Act/CMR rules, pending licenses, and checklist scores.' },",
  "  { id: 'MOEFCC_ENV', title: 'MoEFCC Environmental Monitoring Audit', desc: 'Air quality (PM2.5, PM10), water pH discharge, and noise limit exceedances log.' },",
  "  { id: 'CAPA_AGING', title: 'CAPA Aging & Overdue Action Items Board', desc: 'Kanban audit of open, overdue, and pending verification corrective actions.' },",
  "  { id: 'SAFETY_INCIDENT', title: 'Safety Incidents & Telemetry Anomaly Summary', desc: 'Historical accident classification, root causes, and IoT sensor anomaly events.' },",
  "  { id: 'CONTRACTOR_PERF', title: 'Contractor Risk Tier & Worker Fitness Audit', desc: 'Outsourced contractor safety audit scores and worker vocational/medical status.' },",
  "  { id: 'FLEET_HEALTH', title: 'Heavy Equipment Maintenance & Breakdown Summary', desc: 'Machinery health scores, 24-hour breakdown hours, and operational status.' },",
  "  { id: 'DOCUMENT_OCR', title: 'Statutory Clearance Ingestion & OCR Audit', desc: 'Document verification queue, OCR confidence scores, and upcoming expiry dates.' }",
  "];",
  "",
].join('\n');

fs.writeFileSync('D:/smart-mine/src/components/views/ReportsView.tsx', part1);
console.log('part1', part1.length);