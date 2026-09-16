// Conversational AI Engine for MineGov Copilot
import { DerivedMineMetrics, DatasetBundle } from '../types/minegov';

export interface CopilotResponse {
  answer: string;
  sources: Array<{ table: string; recordId: string; description: string }>;
  confidence: number;
}

export type SupportedLanguage = 'EN' | 'HI' | 'BN' | 'OR';

export function queryMineGovCopilot(
  userQuery: string,
  metrics: DerivedMineMetrics[],
  data: DatasetBundle,
  lang: SupportedLanguage = 'EN'
): CopilotResponse {
  const queryLower = userQuery.toLowerCase();
  const sources: Array<{ table: string; recordId: string; description: string }> = [];

  // Sort mines by overall risk
  const sortedMines = [...metrics].sort((a, b) => b.domainRisk.overallRisk - a.domainRisk.overallRisk);
  const highestRiskMine = sortedMines[0];

  // 1. Highest Risk Query
  if (queryLower.includes('highest risk') || queryLower.includes('risk score') || queryLower.includes('top risk')) {
    if (!highestRiskMine) {
      return { answer: 'No mine metrics available.', sources: [], confidence: 1.0 };
    }

    const drivers = highestRiskMine.domainRisk.topDrivers.map(d => `• ${d.domain}: ${d.factor}`).join('\n');
    sources.push({
      table: '01_mines.csv',
      recordId: highestRiskMine.mine.mine_id,
      description: `Mine ${highestRiskMine.mine.mine_name} (Risk Score: ${highestRiskMine.domainRisk.overallRisk})`
    });

    let ans = `The mine with the highest prioritization risk score is **${highestRiskMine.mine.mine_name} (${highestRiskMine.mine.mine_id})** with an overall risk score of **${highestRiskMine.domainRisk.overallRisk}/100** (${highestRiskMine.domainRisk.riskBand} Risk Band).\n\n**Primary Contributing Risk Drivers:**\n${drivers}\n\n**Domain Risk Breakdown:**\n• Safety Risk: ${highestRiskMine.domainRisk.safetyRisk}\n• Compliance Risk: ${highestRiskMine.domainRisk.complianceRisk}\n• Environment Risk: ${highestRiskMine.domainRisk.environmentRisk}\n• Equipment Risk: ${highestRiskMine.domainRisk.equipmentRisk}\n• Contractor Risk: ${highestRiskMine.domainRisk.contractorRisk}\n• Operations Risk: ${highestRiskMine.domainRisk.operationsRisk >= 0 ? highestRiskMine.domainRisk.operationsRisk : 'N/A (Closed/Developing Mine)'}`;

    if (lang === 'HI') {
      ans = `सबसे अधिक जोखिम वाला खदान **${highestRiskMine.mine.mine_name} (${highestRiskMine.mine.mine_id})** है, जिसका कुल जोखिम स्कोर **${highestRiskMine.domainRisk.overallRisk}/100** है।`;
    }

    return { answer: ans, sources, confidence: 0.98 };
  }

  // 2. Overdue Compliance & CAPA Query
  if (queryLower.includes('overdue') || queryLower.includes('capa') || queryLower.includes('compliance gap')) {
    const overdueCompliances = data.compliances.filter(c => c.status === 'OVERDUE');
    const overdueCAPA = data.correctiveActions.filter(ca => ca.status === 'OVERDUE');

    overdueCompliances.slice(0, 3).forEach(c => {
      sources.push({ table: '02_compliances.csv', recordId: c.compliance_id, description: `${c.compliance_code} - ${c.regulation_name}` });
    });
    overdueCAPA.slice(0, 3).forEach(ca => {
      sources.push({ table: '05_corrective_actions.csv', recordId: ca.action_id, description: `CAPA ${ca.action_id} assigned to ${ca.assigned_to_role}` });
    });

    const ans = `There are currently **${overdueCompliances.length} overdue compliance statutory items** and **${overdueCAPA.length} overdue CAPA corrective actions** across all monitored mines.\n\n**Top Overdue Statutory Items:**\n${overdueCompliances.slice(0, 4).map(c => `• [${c.mine_id}] ${c.compliance_code}: ${c.regulation_name} (Due: ${c.due_date})`).join('\n')}\n\n**Top Overdue CAPA Actions:**\n${overdueCAPA.slice(0, 4).map(ca => `• [${ca.mine_id}] ${ca.action_id}: ${ca.corrective_action} (Assigned to ${ca.assigned_to_role})`).join('\n')}`;

    return { answer: ans, sources, confidence: 0.96 };
  }

  // 3. Sensors / Anomaly Query
  if (queryLower.includes('sensor') || queryLower.includes('telemetry') || queryLower.includes('abnormal')) {
    const criticalSensors = data.sensorReadings.filter(s => s.status === 'CRITICAL' || s.anomaly_score > 0.7);
    criticalSensors.slice(0, 5).forEach(s => {
      sources.push({ table: '08_sensor_readings.csv', recordId: s.reading_id, description: `Sensor ${s.sensor_id} in ${s.zone} (${s.value} ${s.unit})` });
    });

    const ans = `Found **${criticalSensors.length} abnormal sensor telemetry readings** exceeding critical safety thresholds.\n\n**High Anomaly Telemetry Signals:**\n${criticalSensors.slice(0, 5).map(s => `• Mine ${s.mine_id} | Zone: ${s.zone} | Sensor: ${s.sensor_type} (${s.sensor_id}) = ${s.value} ${s.unit} (Anomaly Score: ${(s.anomaly_score * 100).toFixed(0)}%)`).join('\n')}`;

    return { answer: ans, sources, confidence: 0.97 };
  }

  // 4. Contractor Query
  if (queryLower.includes('contractor') || queryLower.includes('vendor')) {
    const highRiskCtrs = data.contractors.filter(c => c.status === 'HIGH_RISK' || c.status === 'CRITICAL_RISK');
    highRiskCtrs.forEach(c => {
      sources.push({ table: '10_contractors.csv', recordId: c.contractor_id, description: `${c.contractor_name} (Risk: ${c.contractor_risk_score})` });
    });

    const ans = `There are **${highRiskCtrs.length} high-risk contractor firms** requiring immediate governance review:\n\n${highRiskCtrs.map(c => `• **${c.contractor_name} (${c.contractor_id})** - Mine: ${c.mine_id} | Risk Score: ${c.contractor_risk_score} | PPE Compliance: ${c.ppe_compliance_pct}% | Overdue Actions: ${c.overdue_actions}`).join('\n')}`;

    return { answer: ans, sources, confidence: 0.95 };
  }

  // 5. Document / OCR Review Queue
  if (queryLower.includes('ocr') || queryLower.includes('document') || queryLower.includes('verification')) {
    const lowConfDocs = data.documents.filter(d => d.extraction_confidence < 0.82 || d.source_status === 'PENDING_REVIEW');
    lowConfDocs.forEach(d => {
      sources.push({ table: '13_documents.csv', recordId: d.document_id, description: `${d.file_name} (Confidence: ${(d.extraction_confidence * 100).toFixed(1)}%)` });
    });

    const ans = `There are **${lowConfDocs.length} statutory documents** in the OCR Human Verification Queue (<82% confidence threshold):\n\n${lowConfDocs.map(d => `• **${d.file_name} (${d.document_id})** - Type: ${d.document_type} | Confidence: ${(d.extraction_confidence * 100).toFixed(1)}% | Uploaded by: ${d.uploaded_by_role}`).join('\n')}`;

    return { answer: ans, sources, confidence: 0.94 };
  }

  // General Summary Answer
  const totalMines = metrics.length;
  const totalIncidents = data.incidents.length;
  const totalViolations = data.violations.length;

  return {
    answer: `MineGov AI Platform Monitoring Summary:\n\n• Monitored Coal Mines: ${totalMines}\n• Highest Risk Mine: ${highestRiskMine?.mine.mine_name} (${highestRiskMine?.domainRisk.overallRisk}/100)\n• Total Statutory Compliances Tracked: ${data.compliances.length}\n• Total Incidents & Near-Misses: ${totalIncidents}\n• Total Violations: ${totalViolations}\n• Total Sensor Readings Ingested: ${data.sensorReadings.length.toLocaleString()}\n\nAsk me specifically about: "highest risk mine", "overdue compliance & CAPA", "abnormal telemetry sensors", "high risk contractors", or "document OCR queue".`,
    sources: [{ table: '01_mines.csv', recordId: 'ALL', description: 'Aggregated mine datasets' }],
    confidence: 0.90
  };
}
