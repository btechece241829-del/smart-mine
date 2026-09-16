// ────────────────────────────────────────────────────────────────
// Dataset Ingestion & Processing Service
// Ingests sample and user-uploaded CSVs into shared database collections.
// ────────────────────────────────────────────────────────────────
import Papa from 'papaparse';
import { saveLocalCollection, getLocalCollection } from './firebaseDb';

export type CollectionTab = 'complaints' | 'mines' | 'inspections' | 'profiles';

export function detectTargetCollection(fileName: string): CollectionTab {
  const fn = fileName.toLowerCase();
  if (fn.includes('mine')) return 'mines';
  if (fn.includes('incident') || fn.includes('complaint') || fn.includes('nearmiss') || fn.includes('violation')) return 'complaints';
  if (fn.includes('inspection')) return 'inspections';
  if (fn.includes('worker') || fn.includes('user') || fn.includes('profile')) return 'profiles';
  return 'complaints';
}

export async function ingestSampleDatasets(): Promise<{
  minesCount: number;
  complaintsCount: number;
  inspectionsCount: number;
  profilesCount: number;
}> {
  // 1. Mines
  const minesRes = await fetch('/data/01_mines.csv');
  const minesCsv = await minesRes.text();
  const parsedMines = Papa.parse(minesCsv, { header: true, skipEmptyLines: true }).data as any[];
  const formattedMines = parsedMines.map((m: any, idx: number) => ({
    id: m.mine_id || `M${String(idx + 1).padStart(3, '0')}`,
    mine_name: m.mine_name || `Mine ${idx + 1}`,
    mine_code: m.mine_id || `M${String(idx + 1).padStart(3, '0')}`,
    state: m.state || 'Chhattisgarh',
    location: m.district ? `${m.district}, ${m.state}` : m.state,
    latitude: parseFloat(m.latitude) || null,
    longitude: parseFloat(m.longitude) || null,
    mine_type: m.mining_method || 'OPENCAST',
    status: m.operational_status === 'OPERATING' ? 'Active' : (m.operational_status || 'Active'),
    created_at: new Date().toISOString(),
  }));
  saveLocalCollection('mines', formattedMines);

  // 2. Incidents & Complaints — merge into existing collection,
  //    preserving previously reported complaints forever (no replacement).
  const incRes = await fetch('/data/06_incidents_nearmiss.csv');
  const incCsv = await incRes.text();
  const parsedInc = Papa.parse(incCsv, { header: true, skipEmptyLines: true }).data as any[];
  const existingComplaints = getLocalCollection('complaints');
  const existingIds = new Set(existingComplaints.map((c: any) => c.id ?? c.complaint_number));
  const now = new Date().toISOString();
  const formattedComplaints = parsedInc.slice(0, 50).map((inc: any, i: number) => {
    const rawSev = inc.severity ? (inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1).toLowerCase()) : 'Medium';
    const sev = ['Low', 'Medium', 'High', 'Critical'].includes(rawSev) ? rawSev : 'Medium';
    let status = 'Submitted';
    if (inc.investigation_status === 'CLOSED') status = 'Resolved';
    else if (inc.investigation_status === 'UNDER_INVESTIGATION') status = 'Under Review';
    else if (inc.corrective_action_status === 'OPEN') status = 'Action In Progress';

    const id = inc.incident_id || `CM-SAMPLE-${i + 1}`;
    return {
      id,
      complaint_number: inc.incident_id || `CM-2026-${1000 + i}`,
      title: `${inc.incident_type || 'Safety'}: ${inc.root_cause || 'Hazard'} in ${inc.zone || 'Work Area'}`,
      description: inc.description || `Field incident logged in ${inc.zone || 'mine site'}. Root cause: ${inc.root_cause || 'Pending'}.`,
      category: inc.incident_type?.includes('FIRE') ? 'Fire' : inc.incident_type?.includes('EQUIPMENT') ? 'Mechanical' : 'Safety',
      severity: sev,
      priority: sev,
      mine_id: inc.mine_id || formattedMines[0]?.id || 'M001',
      location: inc.zone ? `Zone ${inc.zone}` : 'Main Incline',
      latitude: inc.latitude ? parseFloat(inc.latitude) : null,
      longitude: inc.longitude ? parseFloat(inc.longitude) : null,
      reported_by: 'super_admin_seed',
      reported_by_name: 'Safety Telemetry',
      reported_employee_id: 'SYS-SEED',
      reported_at: inc.date ? `${inc.date}T${inc.time || '10:00:00'}Z` : now,
      status,
      is_archived: false,
      archived_at: null,
      archived_by: null,
      created_at: now,
      updated_at: now,
    };
  }).filter((c: any) => !existingIds.has(c.id ?? c.complaint_number));
  saveLocalCollection('complaints', [...existingComplaints, ...formattedComplaints]);

  // 3. Inspections
  const inspRes = await fetch('/data/03_inspections.csv');
  const inspCsv = await inspRes.text();
  const parsedInsp = Papa.parse(inspCsv, { header: true, skipEmptyLines: true }).data as any[];
  const formattedInspections = parsedInsp.slice(0, 35).map((ins: any, i: number) => ({
    id: ins.inspection_id || `INSP-${1000 + i}`,
    inspection_number: ins.inspection_id || `INSP-${1000 + i}`,
    mine_id: ins.mine_id || 'M001',
    inspection_type: ins.inspection_type || 'Safety Audit',
    inspector_role: ins.inspector_role || 'Safety Officer',
    checklist_score_pct: parseFloat(ins.checklist_score_pct) || 85,
    observation_summary: ins.observation_summary || 'Inspection completed without major deviation.',
    severity: ins.severity || 'LOW',
    status: ins.inspection_status || 'COMPLETED',
    date: ins.inspection_date || new Date().toISOString().split('T')[0],
  }));
  saveLocalCollection('inspections', formattedInspections);

  // 4. Workers & Profiles
  const wrkRes = await fetch('/data/11_workers.csv');
  const wrkCsv = await wrkRes.text();
  const parsedWrk = Papa.parse(wrkCsv, { header: true, skipEmptyLines: true }).data as any[];
  const existingProfiles = getLocalCollection('profiles');
  const newProfiles = parsedWrk.slice(0, 25).map((w: any, i: number) => ({
    id: `usr_${w.worker_id || i}`,
    email: `${(w.name || `worker${i}`).toLowerCase().replace(/\s+/g, '.')}@minegov.demo`,
    full_name: w.name || `Demo Worker ${w.worker_id}`,
    employee_id: w.worker_id || `WRK-${1000 + i}`,
    role: w.role?.toLowerCase().includes('safety') ? 'safety_officer' :
          w.role?.toLowerCase().includes('foreman') || w.role?.toLowerCase().includes('overman') ? 'overman' :
          w.role?.toLowerCase().includes('mate') ? 'mining_mate' :
          w.role?.toLowerCase().includes('manager') ? 'mine_manager' : 'worker',
    department: w.department || 'Operations',
    mine_id: w.mine_id || 'M001',
    is_active: w.fitness_status !== 'EXPIRED',
    created_at: new Date().toISOString(),
  }));
  const mergedProfiles = [...existingProfiles];
  newProfiles.forEach((np: any) => {
    if (!mergedProfiles.some((ep: any) => ep.employee_id === np.employee_id || ep.email === np.email)) {
      mergedProfiles.push(np);
    }
  });
  saveLocalCollection('profiles', mergedProfiles);

  return {
    minesCount: formattedMines.length,
    complaintsCount: formattedComplaints.length,
    inspectionsCount: formattedInspections.length,
    profilesCount: newProfiles.length,
  };
}
export async function processUploadedFile(file: File, target: CollectionTab): Promise<number> {
  const text = await file.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[];

  if (target === 'mines') {
    const formatted = parsed.map((m: any, idx: number) => ({
      id: m.mine_id || m.id || `M_${Date.now()}_${idx}`,
      mine_name: m.mine_name || m.name || `Mine ${idx + 1}`,
      mine_code: m.mine_code || m.mine_id || `M${idx + 1}`,
      state: m.state || 'India',
      location: m.location || m.district || 'Mining Area',
      latitude: parseFloat(m.latitude) || null,
      longitude: parseFloat(m.longitude) || null,
      mine_type: m.mine_type || m.mining_method || 'OPENCAST',
      status: m.status || m.operational_status || 'Active',
      created_at: new Date().toISOString(),
    }));
    const cur = getLocalCollection('mines');
    saveLocalCollection('mines', [...formatted, ...cur.filter((c: any) => !formatted.some((f: any) => f.id === c.id))]);
    return formatted.length;
  }

  if (target === 'complaints') {
    const now = new Date().toISOString();
    const formatted = parsed.map((c: any, idx: number) => ({
      id: c.incident_id || c.id || `CM-${Date.now()}-${idx}`,
      complaint_number: c.complaint_number || c.incident_id || `CM-${Date.now().toString().slice(-5)}-${idx}`,
      title: c.title || c.incident_type || 'Safety Issue',
      description: c.description || c.root_cause || 'Reported hazard',
      category: c.category || 'Safety',
      severity: c.severity || 'Medium',
      priority: c.priority || c.severity || 'Medium',
      mine_id: c.mine_id || null,
      location: c.location || c.zone || 'Work area',
      latitude: c.latitude ? parseFloat(c.latitude) : null,
      longitude: c.longitude ? parseFloat(c.longitude) : null,
      reported_by: 'super_admin_import',
      reported_by_name: 'Admin Batch Import',
      reported_employee_id: 'ADM-IMPORT',
      reported_at: c.reported_at || (c.date ? `${c.date}T10:00:00Z` : now),
      status: c.status || 'Submitted',
      is_archived: false,
      archived_at: null,
      archived_by: null,
      created_at: now,
      updated_at: now,
    }));
    const cur = getLocalCollection('complaints');
    saveLocalCollection('complaints', [...formatted, ...cur]);
    return formatted.length;
  }

  if (target === 'inspections') {
    const formatted = parsed.map((ins: any, idx: number) => ({
      id: ins.inspection_id || ins.id || `INSP-${Date.now()}-${idx}`,
      inspection_number: ins.inspection_id || `INSP-${Date.now().toString().slice(-4)}`,
      mine_id: ins.mine_id || 'M001',
      inspection_type: ins.inspection_type || 'Safety Audit',
      inspector_role: ins.inspector_role || 'Inspector',
      checklist_score_pct: parseFloat(ins.checklist_score_pct) || 80,
      observation_summary: ins.observation_summary || 'Inspection record ingested.',
      severity: ins.severity || 'LOW',
      status: ins.inspection_status || ins.status || 'COMPLETED',
      date: ins.inspection_date || new Date().toISOString().split('T')[0],
    }));
    const cur = getLocalCollection('inspections');
    saveLocalCollection('inspections', [...formatted, ...cur]);
    return formatted.length;
  }

  if (target === 'profiles') {
    const formatted = parsed.map((u: any, idx: number) => ({
      id: u.id || `usr_${Date.now()}_${idx}`,
      email: u.email || `user${idx}@minegov.demo`,
      full_name: u.full_name || u.name || `User ${idx + 1}`,
      employee_id: u.employee_id || u.worker_id || `EMP-${Date.now().toString().slice(-4)}`,
      role: u.role || 'worker',
      mine_id: u.mine_id || null,
      is_active: u.is_active !== false,
      created_at: new Date().toISOString(),
    }));
    const cur = getLocalCollection('profiles');
    saveLocalCollection('profiles', [...formatted, ...cur]);
    return formatted.length;
  }

  return 0;
}
