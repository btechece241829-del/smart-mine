// ────────────────────────────────────────────────────────────────
// Coal Mine Compliance Management — shared type definitions
// ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'worker'
  | 'mining_mate'
  | 'overman'
  | 'safety_officer'
  | 'mine_manager'
  | 'super_admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  worker: 'Worker / Miner',
  mining_mate: 'Mining Mate / Sirdar',
  overman: 'Overman',
  safety_officer: 'Safety Officer',
  mine_manager: 'Mine Manager',
  super_admin: 'Super Admin / Agent',
};

export const ROLE_HIERARCHY: UserRole[] = [
  'worker',
  'mining_mate',
  'overman',
  'safety_officer',
  'mine_manager',
  'super_admin',
];

/** Human-readable descriptions shown during Google sign-in role selection */
export const ROLE_DESCRIPTIONS: Record<UserRole, { title: string; description: string; icon: string }> = {
  worker: {
    title: 'Worker / Miner',
    description: 'Frontline mine worker responsible for day-to-day operations. Report safety issues and track your own complaints.',
    icon: 'pickaxe',
  },
  mining_mate: {
    title: 'Mining Mate / Sirdar',
    description: 'Supervises ground-level operations. Handles assigned complaints and conducts inspections.',
    icon: 'hardhat',
  },
  overman: {
    title: 'Overman',
    description: 'Senior underground supervisor. Manages assigned complaints, inspections, and escalations.',
    icon: 'shield',
  },
  safety_officer: {
    title: 'Safety Officer',
    description: 'Responsible for safety compliance, incident investigations, risk assessments, and safety-related reports.',
    icon: 'shield-check',
  },
  mine_manager: {
    title: 'Mine Manager',
    description: 'Oversees all mine operations. Reviews all complaints, compliance analytics, escalations, and generates reports.',
    icon: 'crown',
  },
  super_admin: {
    title: 'Super Admin / Agent',
    description: 'Full system access. Manages users, mines, departments, escalation rules, system settings, and audit logs.',
    icon: 'star',
  },
};

/** Pages/features each role can access — mirrors permissions.ts NAV_BY_ROLE */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  worker: [
    'View personal dashboard with KPIs',
    'Report safety issues with photos & location',
    'Track your own complaints',
    'Receive notifications',
    'Manage your profile',
  ],
  mining_mate: [
    'View dashboard with team KPIs',
    'Handle assigned complaints',
    'Conduct and record inspections',
    'Receive notifications',
    'Manage your profile',
  ],
  overman: [
    'View dashboard with team KPIs',
    'Manage assigned complaints',
    'Conduct and record inspections',
    'Handle escalation requests',
    'Receive notifications',
    'Manage your profile',
  ],
  safety_officer: [
    'View dashboard with safety KPIs',
    'Manage all safety-related complaints',
    'Conduct and record inspections',
    'Perform risk assessments',
    'Handle escalation requests',
    'Generate safety reports',
    'Receive notifications',
    'Manage your profile',
  ],
  mine_manager: [
    'View comprehensive dashboard with analytics',
    'Review all mine-wide complaints',
    'Manage critical escalation issues',
    'Access compliance analytics & trends',
    'Generate operational reports',
    'Receive notifications',
    'Manage your profile',
  ],
  super_admin: [
    'Full dashboard with system-wide KPIs',
    'Manage all mines',
    'Manage all users & roles',
    'Access all complaints across mines',
    'Manage all departments',
    'Full compliance analytics',
    'Generate all report types',
    'View audit logs',
    'Configure escalation rules',
    'Manage system settings',
    'Receive notifications',
    'Manage your profile',
  ],
};

export type ComplaintStatus =
  | 'Draft'
  | 'Submitted'
  | 'Acknowledged'
  | 'Under Investigation'
  | 'Action Assigned'
  | 'Action In Progress'
  | 'Verification'
  | 'Resolved'
  | 'Closed'
  // Legacy statuses — preserved for records created by earlier app versions
  | 'Under Review'
  | 'Assigned'
  | 'Inspection Required'
  | 'Verified'
  | 'Rejected'
  | 'Escalated';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

/** Standard priority scale used for SLA/deadline scheduling. */
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export const COMPLAINT_CATEGORIES = [
  'Safety',
  'Mining Operation',
  'Machinery',
  'Electrical',
  'Mechanical',
  'Ventilation',
  'Environment',
  'Fire',
  'Ground Control',
  'Worker Welfare',
  'Other',
] as const;

export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

/** Shifts a complaint can be logged against. */
export const WORK_SHIFTS = ['Day', 'Night', 'General'] as const;
export type WorkShift = (typeof WORK_SHIFTS)[number];

/**
 * Standard work-area taxonomy. Registered against a custom work area, the form
 * also accepts a free-text area name which is stored on the complaint.
 */
export const WORK_AREAS = [
  'Shaft Top',
  'Shaft Bottom',
  'Surface Workshop',
  'Coal Handling Plant',
  'Conveyor Belt 1',
  'Conveyor Belt 2',
  'Conveyor Belt 3',
  'Dozer Section',
  'Dragline Section',
  'Shovel / Dumper Section',
  'Blasting Site',
  'Explosive Magazine',
  'Ventilation District 1',
  'Ventilation District 2',
  'Seam 1 (Underground)',
  'Seam 2 (Underground)',
  'Main Development Gallery',
  'Longwall Face',
  'Continuous Miner Panel',
  'Pump House',
  'Workshop / Bay',
  'Store / Warehouse',
  'First-Aid Room',
  'Escape Route',
  'Canteen / Welfare',
  'Surface Haul Road',
  'Other',
] as const;

export const DEPARTMENT_OPTIONS = [
  'Mining',
  'Electrical',
  'Mechanical',
  'Ventilation',
  'Survey',
  'Geology',
  'Explosives & Blasting',
  'Environment',
  'Safety',
  'Transport / Haulage',
  'Workshop',
  'Welfare',
  'Administration',
] as const;

export interface Mine {
  id: string;
  mine_name: string;
  mine_code: string;
  location: string | null;
  state: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  mine_type: string | null;
  status: string;
  created_at: string;
  // ── Complaint module map overlays (optional; set by Super Admin) ──
  boundary?: Array<[number, number]> | null;
  work_areas?: WorkArea[] | null;
}

/** A named operational area inside a mine, drawn as a polygon on the map. */
export interface WorkArea {
  id: string;
  name: string;
  category: string | null; // e.g. 'Surface' | 'Underground' | 'Workshop'
  boundary?: Array<[number, number]> | null;
  center?: { lat: number; lng: number } | null;
}

export interface Profile {
  id: string;
  auth_user_id: string | null;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  mine_id: string | null;
  department: string | null;
  designation: string | null;
  profile_photo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Employee-master / assignment fields (used by the Attendance module)
  work_area: string | null;             // operational section within the mine
  shift: AttendanceShift | null;        // default shift for this employee
  joining_date: string | null;          // YYYY-MM-DD
  assigned_overman_id: string | null;   // profile id of the assigned Overman
  assigned_overman_name: string | null;
  assigned_manager_id: string | null;   // profile id of the assigned Manager
  assigned_manager_name: string | null;
  // joined (not stored)
  mine_name?: string;
}

export interface Complaint {
  id: string;
  complaint_number: string;
  title: string;
  description: string | null;
  category: string;
  severity: Severity;
  reported_by: string | null;
  reported_by_name: string;
  reported_employee_id: string | null;
  reported_at: string;
  mine_id: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  video_url: string | null;
  assigned_to: string | null;
  assigned_role: UserRole | null;
  assigned_by: string | null;
  assigned_at: string | null;
  due_date: string | null;
  status: ComplaintStatus;
  priority: Severity;
  is_critical?: boolean;
  immediate_danger?: boolean;
  verified_by: string | null;
  verified_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  escalation_count: number;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
  // ── Complaint module (v2) extended fields ──────────────────────
  category_id: string | null;
  subcategory: string | null;
  priority_label: Priority | null;
  department: string | null;          // responsible department
  work_area: string | null;           // named operational area
  shift: WorkShift | null;
  expected_date: string | null;       // expected correction date
  is_draft?: boolean;                 // true while saved as draft (kept in Firestore for cross-device resume)
  draft_updated_at?: string | null;
  gps_latitude: number | null;        // captured device GPS (may differ from pinned map point)
  gps_longitude: number | null;
  gps_accuracy: number | null;
  gps_timestamp: string | null;
  location_name: string | null;       // reverse-geocoded / user-set place name
  location_address: string | null;
  witnesses: string | null;
  immediate_action_taken: string | null; // what the reporter did right away
  // ── workflow timestamps ────────────────────────────────────────
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  investigation_id: string | null;
  investigation_started_at: string | null;
  verification_requested_at: string | null;
  verification_requested_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closed_note: string | null;
  // joined
  mine_name?: string | null;
  assigned_to_name?: string;
  assigned_to_designation?: string;
  verified_by_name?: string;
  reported_by_email?: string;
}

export interface ComplaintEvent {
  id: string;
  complaint_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_designation: string | null;
  actor_role: UserRole | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
}

export interface ComplaintComment {
  id: string;
  complaint_id: string;
  author_id: string | null;
  author_name: string;
  author_role: UserRole | null;
  body: string;
  created_at: string;
}

export type InspectionStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Action Required'
  | 'Verified'
  | 'Closed';

export type FindingStatus = 'Open' | 'Action Required' | 'Verified' | 'Closed';

export type RiskBand = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface Finding {
  id: string;
  category: string;
  fault_type: string;
  description: string;
  severity: Severity;
  immediate_danger: boolean;
  workers_affected: number | null;
  risk_score: number;
  risk_level: RiskBand;
  legal_reference: string | null;
  inspector_remarks: string | null;
  status: FindingStatus;
}

export type EvidenceKind = 'photo' | 'video' | 'document' | 'voice';

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  storage_path: string;
  download_url: string | null;
  description: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
}

export type CorrectiveActionStatus =
  | 'Pending'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Rejected'
  | 'Requires Rework'
  | 'Verified'
  | 'Closed';

export interface InspectionLocation {
  pit: string | null;
  shaft: string | null;
  seam: string | null;
  level_depth: string | null;
  panel: string | null;
  section: string | null;
  gallery: string | null;
  face: string | null;
  bench: string | null;
  workshop: string | null;
  conveyor_area: string | null;
  other: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CorrectiveAction {
  id: string;
  inspection_id?: string | null;
  complaint_id?: string | null;
  finding_id: string | null;
  responsible_department: string | null;
  responsible_employee: string | null;
  action_description: string;
  priority: string;
  deadline: string | null;
  status: CorrectiveActionStatus;
  completion_date: string | null;
  completion_evidence_urls: string[];
  verification_date: string | null;
  verification_remarks: string | null;
  created_at: string;
  // legacy-compatible fields
  assigned_to: string | null;
  assigned_to_role: UserRole | null;
  assigned_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  verification_notes: string | null;
}

export interface Inspection {
  id: string;
  inspection_number: string;
  complaint_id: string | null;
  mine_id: string | null;
  mine_name: string | null;
  mine_code: string | null;
  mine_type: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  inspector_role: string | null;
  inspection_type: string;
  inspection_date: string; // YYYY-MM-DD
  shift: string | null;
  status: InspectionStatus;
  location: InspectionLocation | null;
  findings: Finding[];
  evidence: EvidenceItem[];
  corrective_actions: CorrectiveAction[];
  follow_up_of: string | null;
  submission_notes: string | null;
  verified_by_id: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskAssessment {
  id: string;
  mine_id: string | null;
  mine_name: string | null;
  complaint_id: string | null;
  complaint_number: string | null;
  assessed_by_id: string;
  assessed_by_name: string;
  risk_band: RiskBand;
  risk_score: number;
  likelihood: number;   // 1..5
  severity: Severity;
  findings_summary: string | null;
  controls_recommended: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  complaint_id: string | null;
  title: string;
  body: string | null;
  severity: Severity | null;
  action_required: string | null;
  deadline: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_status: string | null;
  new_status: string | null;
  description: string | null;
  timestamp: string;
  ip_address: string | null;
}

export interface EscalationRule {
  id: string;
  category: string | null;
  severity: Severity | null;
  from_role: UserRole;
  to_role: UserRole;
  hours_until_escalation: number;
  reminder_hours: number;
  is_critical: boolean;
  active: boolean;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  updated_at: string;
}

// ── Risk Alerts (realtime broadcast from Super Admin) ──
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface RiskAlert {
  id: string;
  mine_id: string;
  mine_name: string;
  latitude: number;
  longitude: number;
  risk_level: RiskLevel;
  title: string;
  description: string | null;
  category: string; // e.g. 'Gas Leak', 'Floor Collapse', 'Fire', 'Flooding', 'Structural', 'Environmental'
  broadcast_by: string; // user id
  broadcast_by_name: string;
  is_active: boolean;
  acknowledged_by: string[]; // user ids who acknowledged
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface DashboardStats {
  total: number;
  open: number;
  critical: number;
  overdue: number;
  resolved: number;
  pendingVerification: number;
  compliancePct: number;
  avgResolutionHours: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Record<string, number>;
  resolvedVsPending: { resolved: number; pending: number };
}

// ── Worker Attendance (marked by field officers, corrected only by Super Admin) ──
export type AttendanceShift = 'Day' | 'Night' | 'General';
export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'On Leave'
  | 'Half Day'
  | 'Off Day'
  | 'Holiday'
  | 'Other Duty';

/** Where an attendance record originated. */
export type AttendanceSource = 'Manual' | 'OCR';

/** Lifecycle state of an attendance record. */
export type AttendanceVerificationStatus =
  | 'Draft'         // Marked but not yet submitted for verification
  | 'Submitted'     // Overman submitted (awaiting review)
  | 'Verified'      // Manager/Admin approved
  | 'Rejected'      // Manager/Admin rejected with a reason
  | 'Rework';       // Management requested a correction (re-opened)

export type EmployeeStatus = 'active' | 'inactive';

export interface AttendanceRecord {
  id: string;
  mine_id: string;
  mine_name: string;
  worker_id: string;              // profile id or employee_id; 'adhoc_...' for unregistered workers
  worker_name: string;
  worker_role: string | null;     // designation / role on the roster
  work_area: string | null;       // operational area (section) within the mine
  department: string | null;      // department the worker belongs to
  shift: AttendanceShift;
  status: AttendanceStatus;
  attendance_date: string;        // YYYY-MM-DD
  check_in: string | null;        // HH:MM 24h when recorded
  check_out: string | null;       // HH:MM 24h when recorded
  // Who created/edited the record
  marked_by_id: string;
  marked_by_name: string;
  marked_by_role: UserRole;
  // Verification workflow
  verification_status: AttendanceVerificationStatus;
  submitted_at: string | null;    // when the overman submitted for review
  verified_by_id: string | null;
  verified_by_name: string | null;
  verified_by_role: UserRole | null;
  verified_at: string | null;
  rejection_reason: string | null;
  // Source of the record
  source: AttendanceSource;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  // correction trail — set whenever management changes an existing record
  corrected_by_id: string | null;
  corrected_by_name: string | null;
  corrected_by_role: UserRole | null;
  correction_note: string | null;
}

// ════════════════════════════════════════════════════════════════════
// Complaint & Safety Issue Management module (v2) — data model
// ════════════════════════════════════════════════════════════════════

/** Complaints collection (database-equivalent: `complaints`). */
export interface ComplaintCategory {
  id: string;
  name: string;
  subcategories: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AttachmentKind = 'photo' | 'video';

export interface ComplaintAttachment {
  id: string;
  complaint_id: string;
  file_name: string;
  file_type: string;            // MIME type
  file_size: number;            // bytes
  kind: AttachmentKind;
  storage_path: string;         // Storage object path
  download_url: string | null;
  description: string | null;
  uploaded_by: string | null;   // profile id
  uploaded_by_name: string;
  created_at: string;
}

export interface ComplaintStatusHistory {
  id: string;
  complaint_id: string;
  complaint_number: string | null;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: UserRole | null;
  note: string | null;
  created_at: string;
}

export interface ComplaintInvestigation {
  id: string;
  complaint_id: string;
  complaint_number: string | null;
  investigator_id: string;
  investigator_name: string;
  investigator_role: UserRole | null;
  investigation_date: string;   // ISO timestamp
  findings: string;
  root_cause: string | null;
  contributing_factors: string | null;
  risk_assessment: string | null;
  immediate_action_taken: string | null;
  recommended_actions: string | null;
  created_at: string;
  updated_at: string;
}

export type VerificationStatus = 'Requested' | 'Verified' | 'Rejected' | 'Rework Required';

export interface ComplaintVerification {
  id: string;
  complaint_id: string;
  complaint_number: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;    // profile id
  verified_by_name: string;
  verified_by_role: UserRole | null;
  verification_date: string;     // ISO timestamp
  comments: string | null;
  completion_details: string | null;
  photo_urls?: string[];
  created_at: string;
}

/** Complaint-module local draft held on the device (offline-first). */
export interface ComplaintLocalDraft {
  id: string;
  saved_at: string;
  updated_at: string;
  complaint_id?: string;         // set when saving a Firestore-backed draft
  title: string;
  description: string;
  category_id: string;
  category: string;
  subcategory: string;
  severity: Severity;
  priority: Priority;
  department: string;
  work_area: string;
  shift: string;
  mine_id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  expected_date: string;
  witnesses: string;
  immediate_action_taken: string;
  attachmentCount: number;
}
