// ────────────────────────────────────────────────────────────────
// Audit logging — writes to audit_logs collection (Firestore)
// ────────────────────────────────────────────────────────────────
import { addDocToCollection } from './firebaseDb';

export interface AuditPayload {
  user_id?: string | null;
  user_name?: string | null;
  role?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  description?: string | null;
  ip_address?: string | null;
}

/**
 * Record an audit log entry.
 * Note: RLS restricts audit_logs to super_admin reads; the write path is via
 * the security-definer trigger for complaint status changes. For app-driven
 * actions we insert directly (requires the calling user to be super_admin) or
 * via a privileged edge function. To keep the client simple we attempt an
 * insert and ignore failures for non-super-admin (server triggers cover the
 * critical complaint transitions).
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await addDocToCollection('audit_logs', {
      user_id: payload.user_id,
      user_name: payload.user_name,
      role: payload.role,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      old_status: payload.old_status,
      new_status: payload.new_status,
      description: payload.description,
      ip_address: payload.ip_address,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // Non-fatal — server-side triggers cover critical transitions
    console.warn('[audit] insert skipped:', e);
  }
}
