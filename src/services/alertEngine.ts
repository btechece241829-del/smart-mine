// Rule-Derived Alert & Escalation Engine for MineGov AI
import { DatasetBundle, RuleDerivedAlert } from '../types/minegov';

export function generateRuleDerivedAlerts(data: DatasetBundle): RuleDerivedAlert[] {
  const alerts: RuleDerivedAlert[] = [];
  const mineMap = new Map(data.mines.map(m => [m.mine_id, m.mine_name]));

  // 1. Compliance Alerts
  data.compliances.forEach(c => {
    if (c.status === 'OVERDUE' || c.status === 'NON_COMPLIANT') {
      const mineName = mineMap.get(c.mine_id) || c.mine_id;
      const alertId = `ALT-CMP-${c.compliance_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: c.mine_id,
        mineName,
        category: 'COMPLIANCE',
        severity: c.priority === 'CRITICAL' || c.status === 'OVERDUE' ? 'CRITICAL' : 'HIGH',
        title: `Compliance ${c.status}: ${c.compliance_code}`,
        description: `${c.regulation_name} (${c.category}) is ${c.status.toLowerCase()}. Due date: ${c.due_date}. Authority: ${c.authority}`,
        actionRequired: `Review and resolve ${c.compliance_code} compliance with ${c.authority}. Assign responsible officer.`,
        sourceTable: '02_compliances.csv',
        sourceId: c.compliance_id,
        timestamp: c.due_date || new Date().toISOString().split('T')[0],
        status: 'NEW',
        escalationLevel: c.status === 'OVERDUE' ? 'Level 2: Mine Manager' : 'Level 1: Safety Officer',
        acknowledged: false,
      });
    }
  });

  // 2. Violation Alerts
  data.violations.forEach(v => {
    if (v.status !== 'CLOSED' && (v.severity === 'CRITICAL' || v.severity === 'HIGH')) {
      const mineName = mineMap.get(v.mine_id) || v.mine_id;
      const alertId = `ALT-VIO-${v.violation_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: v.mine_id,
        mineName,
        category: 'VIOLATION',
        severity: v.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        title: `Open ${v.severity} Violation: ${v.violation_type}`,
        description: `Zone ${v.zone}: ${v.description}. Responsible dept: ${v.responsible_department}`,
        actionRequired: `Immediately address ${v.violation_type} in ${v.zone}. Assign CAPA and schedule re-inspection.`,
        sourceTable: '04_violations.csv',
        sourceId: v.violation_id,
        timestamp: v.reported_at.split('T')[0],
        status: 'NEW',
        escalationLevel: v.severity === 'CRITICAL' ? 'Level 3: DGMS Executive' : 'Level 2: Mine Manager',
        acknowledged: false,
      });
    }
  });

  // 3. Overdue CAPA Alerts
  data.correctiveActions.forEach(ca => {
    if (ca.status === 'OVERDUE') {
      const mineName = mineMap.get(ca.mine_id) || ca.mine_id;
      const alertId = `ALT-CAPA-${ca.action_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: ca.mine_id,
        mineName,
        category: 'CAPA',
        severity: 'CRITICAL',
        title: `Overdue CAPA Action ${ca.action_id}`,
        description: `Action assigned to ${ca.assigned_to_role} is overdue since ${ca.due_date}. Escalation level 2`,
        actionRequired: `Follow up with ${ca.assigned_to_role} to close CAPA ${ca.action_id}. Escalate if not resolved within 24h.`,
        sourceTable: '05_corrective_actions.csv',
        sourceId: ca.action_id,
        timestamp: ca.created_at,
        status: 'NEW',
        escalationLevel: 'Level 2: Mine Manager',
        acknowledged: false,
      });
    }
  });
  // 4. Critical Sensor Anomalies
  data.sensorReadings.forEach(sr => {
    if (sr.status === 'CRITICAL' || sr.anomaly_score > 0.7) {
      const mineName = mineMap.get(sr.mine_id) || sr.mine_id;
      const alertId = `ALT-SEN-${sr.reading_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: sr.mine_id,
        mineName,
        category: 'SENSOR',
        severity: 'CRITICAL',
        title: `Telemetry Anomaly: ${sr.sensor_type} (${sr.sensor_id})`,
        description: `Value ${sr.value} ${sr.unit} in ${sr.zone} exceeded threshold ${sr.critical_threshold}. Anomaly score: ${(sr.anomaly_score * 100).toFixed(0)}%`,
        actionRequired: `Immediate investigation of ${sr.sensor_type} sensor ${sr.sensor_id} in ${sr.zone}. Evacuate if gas/structural sensor.`,
        sourceTable: '08_sensor_readings.csv',
        sourceId: sr.sensor_id,
        timestamp: sr.timestamp.split('T')[0],
        status: 'NEW',
        escalationLevel: 'Level 3: DGMS Executive',
        acknowledged: false,
      });
    }
  });

  // 5. Environment Exceedance Alerts
  data.environmentReadings.forEach(er => {
    if (er.compliance_status === 'EXCEEDED' || (er.exceedance_pct && er.exceedance_pct > 0)) {
      const mineName = mineMap.get(er.mine_id) || er.mine_id;
      const alertId = `ALT-ENV-${er.reading_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: er.mine_id,
        mineName,
        category: 'ENVIRONMENT',
        severity: (er.exceedance_pct && er.exceedance_pct > 30) ? 'CRITICAL' : 'HIGH',
        title: `Environmental Exceedance: ${er.parameter}`,
        description: `Station ${er.station_id}: ${er.parameter} = ${er.value} ${er.unit} (+${er.exceedance_pct?.toFixed(1)}% above threshold)`,
        actionRequired: `File environmental exceedance report with SPCB. Halt operations in affected zone pending remediation.`,
        sourceTable: '07_environment_readings.csv',
        sourceId: er.reading_id,
        timestamp: er.timestamp.split('T')[0],
        status: 'NEW',
        escalationLevel: 'Level 2: Mine Manager',
        acknowledged: false,
      });
    }
  });

  // 6. Equipment Maintenance / Breakdown Alerts
  data.equipment.forEach(eq => {
    if (eq.status === 'BREAKDOWN' || eq.status === 'MAINTENANCE_DUE' || eq.maintenance_status === 'OVERDUE') {
      const mineName = mineMap.get(eq.mine_id) || eq.mine_id;
      const alertId = `ALT-EQP-${eq.equipment_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: eq.mine_id,
        mineName,
        category: 'EQUIPMENT',
        severity: eq.status === 'BREAKDOWN' ? 'CRITICAL' : 'WARNING',
        title: `Equipment Issue: ${eq.equipment_name} (${eq.equipment_type})`,
        description: `Status: ${eq.status}. Breakdown hours: ${eq.breakdown_hours_24h}h. Health Score: ${eq.health_score}%`,
        actionRequired: `Schedule immediate maintenance for ${eq.equipment_name}. Do not operate until health score >70%.`,
        sourceTable: '09_equipment.csv',
        sourceId: eq.equipment_id,
        timestamp: eq.last_service || new Date().toISOString().split('T')[0],
        status: 'NEW',
        escalationLevel: eq.status === 'BREAKDOWN' ? 'Level 3: DGMS Executive' : 'Level 1: Safety Officer',
        acknowledged: false,
      });
    }
  });

  // 7. Worker Training / Fitness Expiry
  data.workers.forEach(w => {
    if (w.training_status === 'EXPIRED' || w.fitness_status === 'EXPIRED') {
      const mineName = mineMap.get(w.mine_id) || w.mine_id;
      const alertId = `ALT-WRK-${w.worker_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: w.mine_id,
        mineName,
        category: 'WORKFORCE',
        severity: 'HIGH',
        title: `Worker License/Fitness Expired: ${w.name ?? w.worker_id}`,
        description: `Role: ${w.role} (${w.department ?? w.contractor_or_department}). Training: ${w.training_status}, Fitness: ${w.fitness_status}`,
        actionRequired: `Suspend ${w.name ?? w.worker_id} from operations until statutory renewal is complete. Schedule renewal within 7 days.`,
        sourceTable: '11_workers.csv',
        sourceId: w.worker_id,
        timestamp: new Date().toISOString().split('T')[0],
        status: 'NEW',
        escalationLevel: 'Level 2: Mine Manager',
        acknowledged: false,
      });
    }
  });

  // 8. Document OCR Confidence Review < 82%
  data.documents.forEach(doc => {
    if ((doc.ocr_confidence_pct !== undefined && doc.ocr_confidence_pct < 82) || doc.verification_status === 'HUMAN_VERIFICATION_REQUIRED') {
      const mineName = mineMap.get(doc.mine_id) || doc.mine_id;
      const alertId = `ALT-DOC-${doc.document_id}`;
      alerts.push({
        alertId,
        id: alertId,
        mineId: doc.mine_id,
        mineName,
        category: 'DOCUMENT',
        severity: 'WARNING',
        title: `OCR Verification Needed: ${doc.document_name}`,
        description: `OCR confidence is ${doc.ocr_confidence_pct?.toFixed(1) ?? 'N/A'}% (<82% threshold). Human review required for statutory validity.`,
        actionRequired: `Human verification of document ${doc.document_id}. Confirm issuing authority, validity dates, and statutory reference.`,
        sourceTable: '13_statutory_documents.csv',
        sourceId: doc.document_id,
        timestamp: doc.upload_date || new Date().toISOString().split('T')[0],
        status: 'NEW',
        escalationLevel: 'Level 1: Safety Officer',
        acknowledged: false,
      });
    }
  });

  return alerts.sort((a, b) => {
    const sevOrder: Record<string, number> = { CRITICAL: 3, HIGH: 2, WARNING: 1 };
    return (sevOrder[b.severity] ?? 0) - (sevOrder[a.severity] ?? 0);
  });
}

