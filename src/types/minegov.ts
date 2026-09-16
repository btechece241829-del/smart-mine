// MineGov AI - Unified Data Models and Type Definitions
// Field names match CSV column headers for type-safe Papa.parse integration

// 01_mines.csv
export interface Mine {
  mine_id: string;
  mine_name: string;
  company: string;
  subsidiary: string;
  state: string;
  district: string;
  mining_method: string;
  operational_status: string;
  latitude: number;
  longitude: number;
  lease_area_ha: number;
  production_capacity_mtpa: number;
  manager_role: string;
  data_source: string;
  data_note?: string;
}

// 02_compliances.csv
export interface Compliance {
  compliance_id: string;
  mine_id: string;
  compliance_code: string;
  category: string;
  authority: string;
  regulation_name: string;
  requirement: string;
  applicability: string;
  frequency: string;
  issue_date: string;
  due_date: string;
  expiry_date: string;
  responsible_officer_role: string;
  status: string;
  priority: string;
  evidence_required: string;
  source_rule_reference: string;
  data_source: string;
  data_note?: string;
  // backward-compat alias used by ComplianceView
  statutory_reference?: string;
  item_name?: string;
}

export type StatutoryCompliance = Compliance;

// 03_inspections.csv
export interface Inspection {
  inspection_id: string;
  mine_id: string;
  inspection_type: string;
  inspector_role: string;
  department: string;
  inspection_date: string;
  inspection_time: string;
  latitude: number;
  longitude: number;
  zone: string;
  checklist_score_pct: number;
  observation_summary: string;
  photo_count: number;
  video_count: number;
  severity: string;
  inspection_status: string;
  geo_tagged: string;
  time_stamped: string;
  data_source: string;
}

// 04_violations.csv
export interface Violation {
  violation_id: string;
  mine_id: string;
  inspection_id: string;
  violation_type: string;
  description: string;
  severity: string;
  zone: string;
  latitude: number;
  longitude: number;
  reported_at: string;
  responsible_department: string;
  status: string;
  recurrence_flag: string;
  repeat_count_90d: number;
  data_source: string;
}

// 05_corrective_actions.csv
export interface CorrectiveAction {
  action_id: string;
  mine_id: string;
  violation_id: string;
  corrective_action: string;
  assigned_to_role: string;
  assigned_by_role: string;
  created_at: string;
  due_date: string;
  completed_at: string;
  status: string;
  evidence_before_count: number;
  evidence_after_count: number;
  verification_required: string;
  verified_by_role: string;
  data_source: string;
}

// 06_incidents_nearmiss.csv
export interface Incident {
  incident_id: string;
  mine_id: string;
  incident_type: string;
  accident_classification: string;
  date: string;
  time: string;
  shift: string;
  zone: string;
  latitude: number;
  longitude: number;
  people_affected: number;
  equipment_involved: string;
  contractor_id: string;
  root_cause: string;
  severity: string;
  description: string;
  investigation_status: string;
  corrective_action_status: string;
  data_source: string;
}

// 07_environment_readings.csv
export interface EnvironmentReading {
  reading_id: string;
  mine_id: string;
  station_id: string;
  parameter: string;
  value: number;
  unit: string;
  configured_min: number;
  configured_max: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  source: string;
  compliance_status: string;
  exceedance_pct: number;
  threshold_source: string;
  data_note?: string;
  exceedance_status?: string;
  prescribed_limit?: number;
}

// 08_sensor_readings.csv
export interface SensorReading {
  reading_id: string;
  mine_id: string;
  sensor_id: string;
  sensor_type: string;
  zone: string;
  latitude: number;
  longitude: number;
  value: number;
  unit: string;
  timestamp: string;
  warning_threshold: number;
  critical_threshold: number;
  threshold_direction: string;
  anomaly_score: number;
  status: string;
  data_source: string;
  data_note?: string;
}

// 09_equipment.csv
export interface Equipment {
  equipment_id: string;
  mine_id: string;
  equipment_name: string;
  equipment_type: string;
  status: string;
  operating_hours_24h: number;
  idle_hours_24h: number;
  breakdown_hours_24h: number;
  fuel_consumption_l_24h: number;
  last_service: string;
  next_service: string;
  maintenance_status: string;
  health_score: number;
  latitude: number;
  longitude: number;
  assigned_operator_worker_id: string;
  telemetry_enabled: string;
  data_source: string;
  health_score_pct?: number;
  operational_status?: string;
}

// 10_contractors.csv
export interface Contractor {
  contractor_id: string;
  mine_id: string;
  contractor_name: string;
  work_type: string;
  contract_start: string;
  contract_end: string;
  licence_expiry: string;
  insurance_expiry: string;
  worker_count: number;
  training_compliance_pct: number;
  ppe_compliance_pct: number;
  medical_compliance_pct: number;
  open_violations: number;
  incidents: number;
  overdue_actions: number;
  contractor_risk_score: number;
  status: string;
  data_source: string;
  risk_tier?: string;
  statutory_clearance?: string;
}

// 11_workers.csv
export interface Worker {
  worker_id: string;
  mine_id: string;
  contractor_id: string;
  employee_type: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  competency: string;
  training_valid_until: string;
  training_status: string;
  fitness_valid_until: string;
  fitness_status: string;
  ppe_status: string;
  attendance_status: string;
  work_area: string;
  created_at: string;
  data_source: string;
  worker_name?: string;
  contractor_or_department?: string;
  vocational_training_status?: string;
  medical_fitness_status?: string;
  ppe_compliance_pct?: number;
}

// 12_production.csv
export interface ProductionRecord {
  production_id: string;
  mine_id: string;
  date: string;
  production_target_t: number;
  actual_production_t: number;
  coal_dispatch_t: number;
  opening_stock_t: number;
  closing_stock_t: number;
  overburden_removed_or_development_qty: number;
  production_loss_t: number;
  downtime_hours: number;
  loss_reason: string;
  achievement_percentage: number;
  data_source: string;
  log_id?: string;
  efficiency_pct?: number;
  idle_hours?: number;
  target_tonnes?: number;
  actual_tonnes?: number;
}

export type ProductionLog = ProductionRecord;

// 13_documents.csv
export interface Document {
  document_id: string;
  mine_id: string;
  document_type: string;
  file_name: string;
  authority: string;
  issue_date: string;
  expiry_date: string;
  uploaded_by_role: string;
  uploaded_at: string;
  file_path: string;
  extracted_text_excerpt: string;
  ocr_used: string;
  extraction_confidence: number;
  source_status: string;
  linked_compliance_id: string;
  data_source: string;
  data_note?: string;
  document_name?: string;
  issuing_authority?: string;
  valid_until?: string;
  ocr_confidence_pct?: number;
  verification_status?: string;
  extracted_key_phrases?: string;
  file_url?: string;
  upload_timestamp?: string;
  upload_date?: string;
}

export type StatutoryDocument = Document;

// DatasetBundle - matches dataLoader field names
export interface DatasetBundle {
  mines: Mine[];
  compliances: Compliance[];
  inspections: Inspection[];
  violations: Violation[];
  correctiveActions: CorrectiveAction[];
  incidents: Incident[];
  environmentReadings: EnvironmentReading[];
  sensorReadings: SensorReading[];
  equipment: Equipment[];
  contractors: Contractor[];
  workers: Worker[];
  production: ProductionRecord[];
  documents: Document[];
  metadata: Record<string, { count: number; status: 'VALIDATED' | 'WARNING'; errorCount: number }>;
  /** Maps dataset slot -> originating source file (uploaded filename or bundled sample). */
  sourceMap?: Record<string, string>;
}

// DomainRiskScore
export interface DomainRiskScore {
  safetyRisk: number;
  complianceRisk: number;
  environmentRisk: number;
  equipmentRisk: number;
  contractorRisk: number;
  operationsRisk: number;
  overallRisk: number;
  riskBand: 'Low' | 'Moderate' | 'High' | 'Critical';
  topDrivers: Array<{ domain: string; factor: string; impact: 'HIGH' | 'CRITICAL' | 'MEDIUM' }>;
}

// DerivedMineMetrics
export interface DerivedMineMetrics {
  mine: Mine;
  complianceScore: number;
  applicableCompliances: number;
  compliantCount: number;
  dueSoonCount: number;
  overdueCount: number;
  nonCompliantCount: number;
  inspectionCount: number;
  openViolations: number;
  criticalViolations: number;
  recurringViolations: number;
  totalCAPA: number;
  openCAPA: number;
  overdueCAPA: number;
  capaClosureRate: number;
  incidents30d: number;
  nearMisses30d: number;
  severeIncidents: number;
  sensorAnomalyRate: number;
  criticalSensorsCount: number;
  envExceedanceRate: number;
  maxEnvExceedancePct: number;
  avgEquipmentHealth: number;
  overdueMaintenanceCount: number;
  breakdownHours24h: number;
  avgContractorRisk: number;
  highRiskContractors: number;
  workerTrainingExpiryCount: number;
  workerFitnessExpiryCount: number;
  avgProductionAchievement: number;
  totalProductionLoss: number;
  lowConfidenceDocsCount: number;
  docExpiryCount: number;
  domainRisk: DomainRiskScore;
}

export type UserRole =
  | 'CORPORATE_MGMT'
  | 'MINE_MANAGER'
  | 'SAFETY_OFFICER'
  | 'ENV_OFFICER'
  | 'PRODUCTION_OFFICER'
  | 'CONTRACTOR_MGMT'
  | 'REGULATORY_VIEWER'
  | 'SUPER_ADMIN';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: UserRole;
  action: string;
  details: string;
}

export interface RuleDerivedAlert {
  alertId: string;
  id?: string;
  mineId: string;
  mineName?: string;
  category: string;
  severity: string;
  title: string;
  description?: string;
  actionRequired: string;
  sourceTable?: string;
  sourceId?: string;
  timestamp?: string;
  status?: string;
  escalationLevel: string;
  acknowledged: boolean;
}

// DGMS Checklists (derived data; kept for riskEngine compatibility)
export interface DGMSChecklist {
  checklist_id: string;
  mine_id: string;
  checklist_type: string;
  parameter: string;
  standard_ref: string;
  frequency: string;
  score_pct: number;
  threshold_pct: number;
  compliance_status: string;
  last_inspected_date: string;
  data_source: string;
}

export type CAPAItem = CorrectiveAction;

// ── Mobile Field Report Types ──────────────────────────────────
export interface FieldReport {
  report_id: string;
  mine_id: string;
  reporter_name: string;
  reporter_role: string;
  report_type: 'INSPECTION' | 'SAFETY_OBSERVATION' | 'INCIDENT' | 'ATTENDANCE' | 'ENVIRONMENTAL';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  location_label: string;
  timestamp: string;
  status: 'SYNCED' | 'PENDING_SYNC' | 'OFFLINE_QUEUED';
  photo_count: number;
  gps_accuracy_m: number;
  device_info: string;
}

// ── Workflow / Approval Types ──────────────────────────────────
export interface WorkflowStep {
  step_id: string;
  workflow_id: string;
  title: string;
  assigned_to_role: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  created_at: string;
  due_at: string;
  completed_at?: string;
  sla_remaining_hrs: number;
  is_overdue: boolean;
}

// ── Blockchain Audit Entry ─────────────────────────────────────
export interface BlockchainAuditEntry {
  block_index: number;
  timestamp: string;
  action: string;
  actor_role: UserRole;
  details: string;
  previous_hash: string;
  current_hash: string;
  verified: boolean;
  chain_valid: boolean;
}

// ── Subsidiary Aggregated Metrics ──────────────────────────────
export interface SubsidiaryMetrics {
  subsidiary: string;
  mine_count: number;
  mine_names: string[];
  avg_risk_score: number;
  avg_compliance_score: number;
  total_violations: number;
  total_incidents: number;
  total_overdue_capa: number;
  avg_equipment_health: number;
  risk_band: 'Low' | 'Moderate' | 'High' | 'Critical';
}