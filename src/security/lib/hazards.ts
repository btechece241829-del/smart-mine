// ────────────────────────────────────────────────────────────────
// Mine Inspection hazard taxonomy + risk assessment helpers.
// Categories dynamically drive the fault-type options in the
// inspection form (Electrical → exposed cable, ...).
// ────────────────────────────────────────────────────────────────
import { RiskBand, Severity } from './types';

export const INSPECTION_TYPES = [
  'Routine',
  'Surprise',
  'Follow-up',
  'Accident Investigation',
  'Special Inspection',
] as const;

export const INSPECTION_STATUSES = [
  'Submitted',
  'Under Review',
  'Action Required',
  'Verified',
  'Closed',
] as const;

export const FINDING_STATUSES = [
  'Open',
  'Action Required',
  'Verified',
  'Closed',
] as const;

export const CORRECTIVE_ACTION_STATUSES = [
  'Pending',
  'Assigned',
  'In Progress',
  'Completed',
  'Rejected',
  'Requires Rework',
  'Verified',
  'Closed',
] as const;

/** Standard fault/hazard categories with their fault types (dynamically filtered). */
export const FAULT_CATEGORIES: Record<string, string[]> = {
  'Roof & Ground Control': [
    'Roof fall', 'Side wall collapse', 'Overhang', 'Floor heave', 'Fractured strata', 'Open joints', 'Other',
  ],
  Ventilation: [
    'Insufficient airflow', 'Stoppings damaged', 'Ventilation door broken', 'Recirculation', 'Faulty brattice', 'Other',
  ],
  Gas: [
    'Methane accumulation', 'CO build-up', 'Gas detector alarm', 'Gas drainage fault', 'Blast fumes', 'Other',
  ],
  Dust: [
    'Excessive coal dust', 'Respirable dust exceedance', 'Stone dusting incomplete', 'Baghousing fault', 'Other',
  ],
  Electrical: [
    'Exposed cable', 'Damaged cable', 'Electrical spark', 'Poor earthing', 'Faulty switch', 'Equipment failure', 'Other',
  ],
  Machinery: [
    'Gearbox fault', 'Shearer/plow damage', 'Conveyor drive fault', 'Hydraulic leak', 'Brake failure', 'Guarding missing', 'Other',
  ],
  Transportation: [
    'Speed violation', 'Track defect', 'Locomotive fault', 'Signalling failure', 'Manriding issue', 'Other',
  ],
  Conveyor: [
    'Belt misalignment', 'Damaged idler', 'Jamming', 'Fire risk build-up', 'Belt joint failure', 'Other',
  ],
  Fire: [
    'Spontaneous heating', 'Heat source', 'Smoke', 'Fire trapped zone', 'Water spray inoperative', 'Other',
  ],
  'Water/Flooding': [
    'Water ingress', 'Pump failure', 'Dam/barrier breach', 'Water level rise', 'Other',
  ],
  'Explosives & Blasting': [
    'Magazine issue', 'Unused explosive', 'Misfire', 'Blast guarding absent', 'Detonator problem', 'Other',
  ],
  PPE: [
    'Helmet missing', 'Shoe missing', 'Reflective vest missing', 'Self rescuer missing', 'Other',
  ],
  'Emergency Systems': [
    'Siren fault', 'Escape route blocked', 'First aid kit empty', 'Rescue equipment missing', 'Communication failure', 'Other',
  ],
  Environmental: [
    'Air pollution', 'Water pollution', 'Dust emissions', 'Noise exceedance', 'Land degradation', 'Other',
  ],
  'Unsafe Work Practice': [
    'Working under unsupported roof', 'Unauthorized entry', 'Smoking underground', 'Violating blasting window', 'Other',
  ],
  'Safety Management': [
    'Training gap', 'Permit missing', 'Supervision absent', 'Safety meeting not held', 'Other',
  ],
  Other: ['Other'],
};

export function faultTypesFor(category: string): string[] {
  return FAULT_CATEGORIES[category] ?? FAULT_CATEGORIES.Other ?? ['Other'];
}

/** Severity weight used in the risk matrix (Low=1 … Critical=4). */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

/**
 * Standard 4×4 risk matrix: score = severity_weight × exposure.
 * exposure is a 1..4 estimate of how likely the situation is to
 * cause harm (rare 1 … almost certain 4).
 */
export function riskScore(severity: Severity, exposure: number): number {
  const clamped = Math.max(1, Math.min(4, Math.round(exposure || 1)));
  return SEVERITY_WEIGHT[severity] * clamped;
}

export function riskBand(score: number): RiskBand {
  if (score >= 12) return 'Critical';
  if (score >= 8) return 'High';
  if (score >= 4) return 'Moderate';
  return 'Low';
}

export function riskBandColor(band: RiskBand): string {
  switch (band) {
    case 'Critical': return 'text-rose-400 bg-rose-500/20 border-rose-500/50';
    case 'High': return 'text-orange-400 bg-orange-500/15 border-orange-500/40';
    case 'Moderate': return 'text-amber-400 bg-amber-500/15 border-amber-500/40';
    default: return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40';
  }
}

/** Determine whether a finding auto-escalates as a critical hazard. */
export function isCriticalHazard(severity: Severity, immediateDanger: boolean): boolean {
  return severity === 'Critical' || immediateDanger === true;
}

/** Generate a safe, deterministic local id (no random ms collisions). */
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}