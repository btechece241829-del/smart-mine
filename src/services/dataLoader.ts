// Data Loader Service for MineGov AI
import Papa from 'papaparse';
import {
  Mine,
  Compliance,
  Inspection,
  Violation,
  CorrectiveAction,
  Incident,
  EnvironmentReading,
  SensorReading,
  Equipment,
  Contractor,
  Worker,
  ProductionRecord,
  Document,
  DatasetBundle
} from '../types/minegov';

export type DatasetSlotName =
  | 'mines' | 'compliances' | 'inspections' | 'violations'
  | 'correctiveActions' | 'incidents' | 'environmentReadings' | 'sensorReadings'
  | 'equipment' | 'contractors' | 'workers' | 'production' | 'documents';

const parseCSV = <T>(csvText: string, parseNumbers: (key: string, val: string) => any): T[] => {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return (parsed.data as any[]).map((row) => {
    const cleaned: any = {};
    for (const key of Object.keys(row)) {
      const val = row[key] ? row[key].trim() : '';
      cleaned[key] = parseNumbers(key, val);
    }
    return cleaned as T;
  });
};

const statusFor = (count: number) => (count > 0 ? 'VALIDATED' : 'WARNING') as 'VALIDATED' | 'WARNING';

// ---------------------------------------------------------------------------
// Per-dataset parsing helpers (shared by bundled fetch and user upload)
// ---------------------------------------------------------------------------
const parseMines = (csv: string) =>
  parseCSV<Mine>(csv || '', (k, v) => {
    if (['latitude', 'longitude', 'lease_area_ha', 'production_capacity_mtpa'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseCompliances = (csv: string) => parseCSV<Compliance>(csv || '', (k, v) => v);

const parseInspections = (csv: string) =>
  parseCSV<Inspection>(csv || '', (k, v) => {
    if (['latitude', 'longitude', 'checklist_score_pct', 'photo_count', 'video_count'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseViolations = (csv: string) =>
  parseCSV<Violation>(csv || '', (k, v) => {
    if (['latitude', 'longitude', 'repeat_count_90d'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseCorrectiveActions = (csv: string) =>
  parseCSV<CorrectiveAction>(csv || '', (k, v) => {
    if (['evidence_before_count', 'evidence_after_count', 'escalation_level'].includes(k)) {
      return parseInt(v, 10) || 0;
    }
    return v;
  });

const parseIncidents = (csv: string) =>
  parseCSV<Incident>(csv || '', (k, v) => {
    if (['latitude', 'longitude', 'people_affected'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseEnvironmentReadings = (csv: string) =>
  parseCSV<EnvironmentReading>(csv || '', (k, v) => {
    if (['value', 'configured_min', 'configured_max', 'latitude', 'longitude', 'exceedance_pct'].includes(k)) {
      return v !== '' ? parseFloat(v) : undefined;
    }
    return v;
  });

const parseSensorReadings = (csv: string) =>
  parseCSV<SensorReading>(csv || '', (k, v) => {
    if (['value', 'warning_threshold', 'critical_threshold', 'anomaly_score', 'latitude', 'longitude'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseEquipment = (csv: string) =>
  parseCSV<Equipment>(csv || '', (k, v) => {
    if (['operating_hours_24h', 'idle_hours_24h', 'breakdown_hours_24h', 'fuel_consumption_l_24h', 'health_score', 'latitude', 'longitude'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseContractors = (csv: string) =>
  parseCSV<Contractor>(csv || '', (k, v) => {
    if (['worker_count', 'training_compliance_pct', 'ppe_compliance_pct', 'medical_compliance_pct', 'open_violations', 'incidents', 'overdue_actions', 'contractor_risk_score'].includes(k)) {
      return parseFloat(v) || 0;
    }
    return v;
  });

const parseWorkers = (csv: string) => parseCSV<Worker>(csv || '', (k, v) => v);

const parseProduction = (csv: string) =>
  parseCSV<ProductionRecord>(csv || '', (k, v) => {
    if (['production_target_t', 'actual_production_t', 'coal_dispatch_t', 'opening_stock_t', 'closing_stock_t', 'overburden_removed_or_development_qty', 'production_loss_t', 'downtime_hours', 'achievement_percentage'].includes(k)) {
      return v !== '' ? parseFloat(v) : 0;
    }
    return v;
  });

const parseDocuments = (csv: string) =>
  parseCSV<Document>(csv || '', (k, v) => {
    if (k === 'extraction_confidence') {
      return parseFloat(v) || 0;
    }
    return v;
  });


const SLOT_FILE_KEYS: Record<DatasetSlotName, string[]> = {
  mines: ['01_mines.csv', 'mines.csv', 'mine.csv'],
  compliances: ['02_compliances.csv', 'compliances.csv', 'compliance.csv'],
  inspections: ['03_inspections.csv', 'inspections.csv', 'inspection.csv'],
  violations: ['04_violations.csv', 'violations.csv', 'violation.csv'],
  correctiveActions: ['05_corrective_actions.csv', 'corrective_actions.csv', 'capa.csv'],
  incidents: ['06_incidents_nearmiss.csv', 'incidents.csv', 'incidents_nearmiss.csv', 'incident.csv', 'nearmiss.csv'],
  environmentReadings: ['07_environment_readings.csv', 'environment_readings.csv', 'environment.csv'],
  sensorReadings: ['08_sensor_readings.csv', 'sensor_readings.csv', 'sensors.csv', 'telemetry.csv'],
  equipment: ['09_equipment.csv', 'equipment.csv', 'assets.csv'],
  contractors: ['10_contractors.csv', 'contractors.csv', 'contractor.csv'],
  workers: ['11_workers.csv', 'workers.csv', 'workers_records.csv', 'workforce_records.csv'],
  production: ['12_production.csv', 'production.csv', 'production_records.csv'],
  documents: ['13_documents.csv', 'documents.csv', 'statutory_documents.csv'],
};
const SLOT_COLUMN_HINTS: Record<DatasetSlotName, string[]> = {
  mines: ['lease_area_ha', 'production_capacity_mtpa'],
  compliances: ['law_code', 'compliance_status', 'act_section'],
  inspections: ['inspection_id', 'checklist_score_pct', 'inspection_type'],
  violations: ['violation_id', 'repeat_count_90d', 'penalty_amount'],
  correctiveActions: ['action_id', 'evidence_before_count', 'target_date'],
  incidents: ['incident_id', 'accident_classification', 'incident_type'],
  environmentReadings: ['pollutant', 'exceedance_pct', 'configured_max'],
  sensorReadings: ['sensor_id', 'anomaly_score', 'warning_threshold'],
  equipment: ['equipment_id', 'health_score', 'operating_hours_24h'],
  contractors: ['contractor_id', 'contractor_risk_score', 'training_compliance_pct'],
  workers: ['worker_id', 'designation', 'training_status'],
  production: ['production_target_t', 'achievement_percentage', 'actual_production_t'],
  documents: ['document_id', 'extraction_confidence', 'document_type'],
};
const inferSlotFromContent = (csvText: string): DatasetSlotName | null => {
  const headerLine = (csvText || '').split('\n')[0] || '';
  const low = headerLine.toLowerCase();
  for (const slot of Object.keys(SLOT_COLUMN_HINTS) as DatasetSlotName[]) {
    const hints = SLOT_COLUMN_HINTS[slot];
    if (hints.some((h) => low.includes(h.toLowerCase()))) return slot;
  }
  return null;
};
const slotFromFileName = (fileName: string): DatasetSlotName | null => {
  const base = fileName.toLowerCase();
  for (const slot of Object.keys(SLOT_FILE_KEYS) as DatasetSlotName[]) {
    if (SLOT_FILE_KEYS[slot].some((k) => base.endsWith(k))) return slot;
  }
  return null;
};

export async function loadAllDatasets(): Promise<DatasetBundle> {
  const fileList = [
    '01_mines.csv',
    '02_compliances.csv',
    '03_inspections.csv',
    '04_violations.csv',
    '05_corrective_actions.csv',
    '06_incidents_nearmiss.csv',
    '07_environment_readings.csv',
    '08_sensor_readings.csv',
    '09_equipment.csv',
    '10_contractors.csv',
    '11_workers.csv',
    '12_production.csv',
    '13_documents.csv'
  ];

  const rawTexts: Record<string, string> = {};

  for (const fileName of fileList) {
    try {
      const res = await fetch(`/data/${fileName}`);
      if (res.ok) {
        rawTexts[fileName] = await res.text();
      }
    } catch (e) {
      console.error(`Error loading ${fileName}:`, e);
    }
  }

  const bundle = await parseDatasetsFromFiles(
    fileList
      .filter((f) => rawTexts[f])
      .map((f) => new File([rawTexts[f]], f, { type: 'text/csv' }))
  );

  const sourceMap: Record<string, string> = {};
  const metadata: Record<string, { count: number; status: 'VALIDATED' | 'WARNING'; errorCount: number }> = {};
  const slots: Array<[string, DatasetSlotName]> = [
    ['01_mines.csv', 'mines'], ['02_compliances.csv', 'compliances'],
    ['03_inspections.csv', 'inspections'], ['04_violations.csv', 'violations'],
    ['05_corrective_actions.csv', 'correctiveActions'], ['06_incidents_nearmiss.csv', 'incidents'],
    ['07_environment_readings.csv', 'environmentReadings'], ['08_sensor_readings.csv', 'sensorReadings'],
    ['09_equipment.csv', 'equipment'], ['10_contractors.csv', 'contractors'],
    ['11_workers.csv', 'workers'], ['12_production.csv', 'production'],
    ['13_documents.csv', 'documents'],
  ];
  for (const [fileName, slot] of slots) {
    sourceMap[slot] = fileName;
    const rows = (bundle as any)[slot] as any[];
    metadata[fileName] = { count: rows.length, status: statusFor(rows.length), errorCount: 0 };
  }

  return { ...bundle, metadata: { ...bundle.metadata, ...metadata }, sourceMap };
}

/**
 * Builds a DatasetBundle purely from user-supplied File objects (drag & drop).
 * Only the files the user provides are parsed; missing slots become empty arrays
 * (marked WARNING in metadata). No bundled sample data is pulled in here, so the
 * dashboard analyses strictly the dropped dataset.
 */
export async function parseDatasetsFromFiles(files: File[]): Promise<DatasetBundle> {
  const rawTexts: Record<DatasetSlotName, string> = {} as Record<DatasetSlotName, string>;
  const sourceMap: Record<string, string> = {};

  for (const file of files) {
    if (!/\.(csv|txt)$/i.test(file.name)) continue;
    const text = await file.text();
    const byName = slotFromFileName(file.name);
    const byContent = inferSlotFromContent(text);
    const slot = byName || byContent;
    if (slot && !rawTexts[slot]) {
      rawTexts[slot] = text;
      sourceMap[slot] = file.name;
    }
  }

  const bundle: DatasetBundle = {
    mines: parseMines(rawTexts.mines),
    compliances: parseCompliances(rawTexts.compliances),
    inspections: parseInspections(rawTexts.inspections),
    violations: parseViolations(rawTexts.violations),
    correctiveActions: parseCorrectiveActions(rawTexts.correctiveActions),
    incidents: parseIncidents(rawTexts.incidents),
    environmentReadings: parseEnvironmentReadings(rawTexts.environmentReadings),
    sensorReadings: parseSensorReadings(rawTexts.sensorReadings),
    equipment: parseEquipment(rawTexts.equipment),
    contractors: parseContractors(rawTexts.contractors),
    workers: parseWorkers(rawTexts.workers),
    production: parseProduction(rawTexts.production),
    documents: parseDocuments(rawTexts.documents),
    metadata: {},
    sourceMap,
  };

  (Object.keys(bundle) as Array<keyof DatasetBundle>).forEach((key) => {
    const rows = (bundle as any)[key] as any[];
    if (Array.isArray(rows)) {
      bundle.metadata[key] = { count: rows.length, status: statusFor(rows.length), errorCount: 0 };
    }
  });

  return bundle;
}


