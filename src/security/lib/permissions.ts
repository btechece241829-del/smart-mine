// ────────────────────────────────────────────────────────────────
// Permissions — frontend navigation + action gating per role.
// NOTE: This is a UX layer only. The REAL enforcement lives in the
// Supabase RLS policies (see supabase/schema.sql). Never rely on this
// file alone for security.
// ────────────────────────────────────────────────────────────────
import { UserRole } from './types';

export type PageKey =
  | 'dashboard'
  | 'data_upload'
  | 'report_issue'
  | 'my_complaints'
  | 'assigned_complaints'
  | 'safety_complaints'
  | 'all_mine_complaints'
  | 'inspection'
  | 'escalations'
  | 'risk_assessment'
  | 'compliance_analytics'
  | 'reports'
  | 'mines'
  | 'users'
  | 'all_complaints'
  | 'departments'
  | 'audit_logs'
  | 'escalation_rules'
  | 'system_settings'
  | 'notifications'
  | 'gis_mapping'
  | 'attendance_mark'
  | 'attendance_register'
  | 'attendance_review'
  | 'profile'
  // ── Safety Complaint Module ──
  | 'complaint_register'
  | 'complaint_explorer'
  | 'complaint_map'
  | 'complaint_analytics'
  | 'complaint_categories'
  | 'ocr_attendance'
  // ── Blockchain Module ──
  | 'blockchain_dashboard'
  | 'blockchain_verify'
  | 'blockchain_audit_explorer'
  | 'blockchain_qr'
  // ── Predictive Analytics Module ──
  | 'predictive_analytics';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}

// Role → allowed navigation
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  worker: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'my_complaints', label: 'My Complaints', icon: 'list' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    // Blockchain module
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
  ],
  mining_mate: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'assigned_complaints', label: 'Assigned Complaints', icon: 'list' },
    { key: 'inspection', label: 'Inspection', icon: 'search' },
    { key: 'attendance_mark', label: 'Mark Attendance', icon: 'attendance' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    // Blockchain module
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
  ],
  overman: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'assigned_complaints', label: 'Complaints', icon: 'list' },
    { key: 'inspection', label: 'Inspections', icon: 'search' },
    { key: 'attendance_mark', label: 'Mark Attendance', icon: 'attendance' },
    { key: 'escalations', label: 'Escalations', icon: 'arrow' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    // Blockchain module
    { key: 'blockchain_dashboard', label: 'Blockchain Dashboard', icon: 'blocks' },
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
  ],
  safety_officer: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'safety_complaints', label: 'Safety Complaints', icon: 'shield' },
    { key: 'inspection', label: 'Inspections', icon: 'search' },
    { key: 'attendance_mark', label: 'Mark Attendance', icon: 'attendance' },
    { key: 'risk_assessment', label: 'Risk Assessment', icon: 'alert' },
    { key: 'escalations', label: 'Escalations', icon: 'arrow' },
    { key: 'reports', label: 'Reports', icon: 'report' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    { key: 'complaint_analytics', label: 'Safety Analytics', icon: 'chart' },
    { key: 'complaint_categories', label: 'Manage Categories', icon: 'settings' },
    // Blockchain module
    { key: 'blockchain_dashboard', label: 'Blockchain Dashboard', icon: 'blocks' },
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_audit_explorer', label: 'Audit Trail', icon: 'fingerprint' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
  ],
  mine_manager: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'all_mine_complaints', label: 'All Mine Complaints', icon: 'list' },
    { key: 'escalations', label: 'Critical Issues', icon: 'alert' },
    { key: 'compliance_analytics', label: 'Compliance Analytics', icon: 'chart' },
    { key: 'attendance_register', label: 'Attendance Register', icon: 'register' },
    { key: 'attendance_review', label: 'Attendance Review', icon: 'clipboard' },
    { key: 'reports', label: 'Reports', icon: 'report' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    { key: 'complaint_analytics', label: 'Safety Analytics', icon: 'chart' },
    { key: 'complaint_categories', label: 'Manage Categories', icon: 'settings' },
    // Blockchain module
    { key: 'blockchain_dashboard', label: 'Blockchain Dashboard', icon: 'blocks' },
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_audit_explorer', label: 'Audit Trail', icon: 'fingerprint' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
  ],
  super_admin: [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'gis_mapping', label: 'GIS Mapping', icon: 'map' },
    { key: 'report_issue', label: 'Report Issue', icon: 'plus' },
    { key: 'data_upload', label: 'Data Hub & Upload', icon: 'upload' },
    { key: 'ocr_attendance', label: 'OCR Attendance', icon: 'scan' },
    { key: 'mines', label: 'Mines', icon: 'mine' },
    { key: 'attendance_register', label: 'Attendance Register', icon: 'register' },
    { key: 'attendance_review', label: 'Attendance Review', icon: 'clipboard' },
    { key: 'users', label: 'Users', icon: 'users' },
    { key: 'all_complaints', label: 'Complaints', icon: 'list' },
    { key: 'departments', label: 'All Departments', icon: 'dept' },
    { key: 'compliance_analytics', label: 'Compliance', icon: 'chart' },
    { key: 'reports', label: 'Reports', icon: 'report' },
    { key: 'audit_logs', label: 'Audit Logs', icon: 'log' },
    { key: 'escalation_rules', label: 'Escalation Rules', icon: 'arrow' },
    { key: 'system_settings', label: 'System Settings', icon: 'settings' },
    { key: 'notifications', label: 'Notifications', icon: 'bell' },
    { key: 'profile', label: 'Profile', icon: 'user' },
    // Safety module
    { key: 'complaint_register', label: 'Report Safety Issue', icon: 'plus' },
    { key: 'complaint_explorer', label: 'Complaint Explorer', icon: 'search' },
    { key: 'complaint_map', label: 'Complaint Map', icon: 'map' },
    { key: 'complaint_analytics', label: 'Safety Analytics', icon: 'chart' },
    { key: 'complaint_categories', label: 'Manage Categories', icon: 'settings' },
    // Blockchain module
    { key: 'blockchain_dashboard', label: 'Blockchain Dashboard', icon: 'blocks' },
    { key: 'blockchain_verify', label: 'Verify Records', icon: 'shieldcheck' },
    { key: 'blockchain_audit_explorer', label: 'Audit Trail', icon: 'fingerprint' },
    { key: 'blockchain_qr', label: 'QR Verification', icon: 'qr' },
    // Predictive Analytics
    { key: 'predictive_analytics', label: 'Predictive Analytics', icon: 'chart' },
  ],
};

export function navForRole(role: UserRole): NavItem[] {
  return NAV_BY_ROLE[role] ?? [];
}

export function canAccessPage(role: UserRole | null, page: PageKey): boolean {
  if (!role) return false;
  return navForRole(role).some((n) => n.key === page);
}
