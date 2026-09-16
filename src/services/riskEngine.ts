import {
  Mine, StatutoryCompliance, Inspection, Violation,
  CAPAItem, Incident, EnvironmentReading, SensorReading, Equipment,
  Contractor, Worker, ProductionRecord, Document, DatasetBundle,
  DomainRiskScore, DerivedMineMetrics
} from '../types/minegov';

export function calculateComplianceScore(compliances: StatutoryCompliance[]) {
  const applicable = compliances.filter(c => c.status !== 'NOT_APPLICABLE');
  if (applicable.length === 0) {
    return { score: 100, applicableCount: 0, compliantCount: 0, dueSoonCount: 0, overdueCount: 0, nonCompliantCount: 0 };
  }

  let totalWeightedPoints = 0, totalApplicableWeights = 0;
  let compliantCount = 0, dueSoonCount = 0, overdueCount = 0, nonCompliantCount = 0;

  applicable.forEach(c => {
    let pWeight = c.priority === 'CRITICAL' ? 3.0 : c.priority === 'HIGH' ? 2.0 : c.priority === 'MEDIUM' ? 1.5 : 1.0;
    let sPoints = c.status === 'COMPLIANT' ? 1.0 : c.status === 'DUE_SOON' ? 0.7 : c.status === 'OVERDUE' ? 0.2 : 0.0;
    if (c.status === 'COMPLIANT') compliantCount++;
    else if (c.status === 'DUE_SOON') dueSoonCount++;
    else if (c.status === 'OVERDUE') overdueCount++;
    else if (c.status === 'NON_COMPLIANT') nonCompliantCount++;

    totalWeightedPoints += sPoints * pWeight;
    totalApplicableWeights += pWeight;
  });

  const score = totalApplicableWeights > 0 ? (totalWeightedPoints / totalApplicableWeights) * 100 : 100;
  return {
    score: Math.round(score * 10) / 10,
    applicableCount: applicable.length,
    compliantCount, dueSoonCount, overdueCount, nonCompliantCount
  };
}

export function calculateDomainRiskScore(
  mine: Mine, compliances: StatutoryCompliance[],
  inspections: Inspection[], violations: Violation[], capaActionItems: CAPAItem[],
  incidents: Incident[], envMonitoring: EnvironmentReading[], sensorTelemetry: SensorReading[],
  equipment: Equipment[], contractors: Contractor[], workforce: Worker[],
  productionLogs: ProductionRecord[], statutoryDocuments: Document[]
): DomainRiskScore {
  const compStat = calculateComplianceScore(compliances);
  const complianceRisk = Math.min(100, Math.max(0, 100 - compStat.score));

  const openVio = violations.filter(v => v.status === 'OPEN' || v.status === 'IN_PROGRESS');
  const criticalVio = openVio.filter(v => v.severity === 'CRITICAL').length;
  const severeIncidents = incidents.filter(i =>
    i.severity === 'FATAL' || i.severity === 'SERIOUS' || i.severity === 'CRITICAL' || i.severity === 'HIGH'
  ).length;
  const criticalSensors = sensorTelemetry.filter(s => s.status === 'CRITICAL').length;
  const safetyRisk = Math.min(100, Math.round(criticalVio * 20 + severeIncidents * 25 + criticalSensors * 15 + openVio.length * 5));

  // CSV col: compliance_status (COMPLIANT / EXCEEDED / NORMAL)
  const exceedances = envMonitoring.filter(e => e.compliance_status === 'EXCEEDED');
  const environmentRisk = Math.min(100, Math.round(exceedances.length * 12));

  // CSV col: status (AVAILABLE / MAINTENANCE_DUE / BREAKDOWN), health_score (0-100)
  const breakdowns = equipment.filter(e => e.status === 'BREAKDOWN');
  const avgEqHealth = equipment.length > 0
    ? equipment.reduce((acc, e) => acc + (e.health_score ?? 85), 0) / equipment.length : 85;
  const equipmentRisk = Math.min(100, Math.round((100 - avgEqHealth) + breakdowns.length * 15));

  const avgContractorRisk = contractors.length > 0
    ? contractors.reduce((acc, c) => acc + (c.contractor_risk_score ?? 30), 0) / contractors.length : 30;
  const expiredFitness = workforce.filter(w => w.fitness_status === 'EXPIRED').length;
  const contractorRisk = Math.min(100, Math.round(avgContractorRisk + expiredFitness * 5));

  const avgProdAch = productionLogs.length > 0
    ? productionLogs.reduce((acc, p) => acc + (p.achievement_percentage ?? 85), 0) / productionLogs.length : 85;
  const operationsRisk = Math.min(100, Math.round(Math.max(0, 100 - avgProdAch) + breakdowns.length * 10));

  const overallRisk = Math.round(
    safetyRisk * 0.25 + complianceRisk * 0.20 + environmentRisk * 0.15 +
    equipmentRisk * 0.15 + contractorRisk * 0.15 + operationsRisk * 0.10
  );

  const riskBand: DomainRiskScore['riskBand'] =
    overallRisk >= 70 ? 'Critical' : overallRisk >= 50 ? 'High' :
    overallRisk >= 30 ? 'Moderate' : 'Low';

  const topDrivers: DomainRiskScore['topDrivers'] = [];
  if (safetyRisk >= 40) topDrivers.push({ domain: 'Safety', factor: `${criticalVio} critical violations, ${criticalSensors} critical sensors`, impact: safetyRisk >= 70 ? 'CRITICAL' : 'HIGH' });
  if (complianceRisk >= 25) topDrivers.push({ domain: 'Compliance', factor: `Score ${compStat.score.toFixed(0)}% — ${compStat.overdueCount} overdue`, impact: complianceRisk >= 60 ? 'CRITICAL' : 'HIGH' });
  if (environmentRisk >= 20) topDrivers.push({ domain: 'Environment', factor: `${exceedances.length} parameter exceedances`, impact: environmentRisk >= 50 ? 'CRITICAL' : 'HIGH' });
  if (equipmentRisk >= 20) topDrivers.push({ domain: 'Equipment', factor: `${breakdowns.length} breakdowns, avg health ${avgEqHealth.toFixed(0)}%`, impact: equipmentRisk >= 50 ? 'CRITICAL' : 'HIGH' });
  if (contractorRisk >= 25) topDrivers.push({ domain: 'Contractor', factor: `Avg risk ${avgContractorRisk.toFixed(0)}, ${expiredFitness} expired fitness`, impact: contractorRisk >= 60 ? 'CRITICAL' : 'HIGH' });

  return { safetyRisk, complianceRisk, environmentRisk, equipmentRisk, contractorRisk, operationsRisk, overallRisk, riskBand, topDrivers: topDrivers.slice(0, 5) };
}

export function calculateAllMinesRisk(bundle: DatasetBundle): DerivedMineMetrics[] {
  return bundle.mines.map(mine => {
    const mineCompliances = bundle.compliances.filter(c => c.mine_id === mine.mine_id);
    const mineInspections = bundle.inspections.filter(i => i.mine_id === mine.mine_id);
    const mineViolations = bundle.violations.filter(v => v.mine_id === mine.mine_id);
    const mineCapa = bundle.correctiveActions.filter(c => c.mine_id === mine.mine_id);
    const mineIncidents = bundle.incidents.filter(i => i.mine_id === mine.mine_id);
    const mineEnv = bundle.environmentReadings.filter(e => e.mine_id === mine.mine_id);
    const mineSensors = bundle.sensorReadings.filter(s => s.mine_id === mine.mine_id);
    const mineEquipment = bundle.equipment.filter(e => e.mine_id === mine.mine_id);
    const mineContractors = bundle.contractors.filter(c => c.mine_id === mine.mine_id);
    const mineWorkforce = bundle.workers.filter(w => w.mine_id === mine.mine_id);
    const mineProd = bundle.production.filter(p => p.mine_id === mine.mine_id);
    const mineDocs = bundle.documents.filter(d => d.mine_id === mine.mine_id);

    const compStat = calculateComplianceScore(mineCompliances);
    const domainRisk = calculateDomainRiskScore(
      mine, mineCompliances, mineInspections, mineViolations,
      mineCapa, mineIncidents, mineEnv, mineSensors, mineEquipment,
      mineContractors, mineWorkforce, mineProd, mineDocs
    );

    const openViolations = mineViolations.filter(v => v.status === 'OPEN' || v.status === 'IN_PROGRESS').length;
    const criticalViolations = mineViolations.filter(v => v.severity === 'CRITICAL').length;
    const openCAPA = mineCapa.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length;
    const overdueCAPA = mineCapa.filter(c => c.status === 'OVERDUE').length;
    const completedCAPA = mineCapa.filter(c => c.status === 'COMPLETED').length;
    const capaClosureRate = mineCapa.length > 0 ? Math.round((completedCAPA / mineCapa.length) * 100) : 100;
    const severeIncidents = mineIncidents.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;

    const avgEquipmentHealth = mineEquipment.length > 0
      ? Math.round(mineEquipment.reduce((acc, e) => acc + (e.health_score_pct ?? e.health_score), 0) / mineEquipment.length)
      : 85;

    const avgProductionAchievement = mineProd.length > 0
      ? Math.round(mineProd.reduce((acc, p) => acc + (p.efficiency_pct ?? p.achievement_percentage), 0) / mineProd.length)
      : 85;

    return {
      mine,
      complianceScore: compStat.score,
      applicableCompliances: compStat.applicableCount,
      compliantCount: compStat.compliantCount,
      dueSoonCount: compStat.dueSoonCount,
      overdueCount: compStat.overdueCount,
      nonCompliantCount: compStat.nonCompliantCount,
      inspectionCount: mineInspections.length,
      openViolations,
      criticalViolations,
      recurringViolations: mineViolations.filter(v => v.recurrence_flag === 'YES').length,
      totalCAPA: mineCapa.length,
      openCAPA,
      overdueCAPA,
      capaClosureRate,
      incidents30d: mineIncidents.length,
      nearMisses30d: mineIncidents.filter(i => i.incident_type === 'Near Miss').length,
      severeIncidents,
      sensorAnomalyRate: mineSensors.length > 0 ? Math.round((mineSensors.filter(s => s.status !== 'NORMAL').length / mineSensors.length) * 100) : 0,
      criticalSensorsCount: mineSensors.filter(s => s.status === 'CRITICAL').length,
      envExceedanceRate: mineEnv.length > 0 ? Math.round((mineEnv.filter(e => e.exceedance_status !== 'NORMAL').length / mineEnv.length) * 100) : 0,
      maxEnvExceedancePct: 15,
      avgEquipmentHealth,
      overdueMaintenanceCount: mineEquipment.filter(e => e.operational_status === 'MAINTENANCE_DUE').length,
      breakdownHours24h: mineEquipment.reduce((acc, e) => acc + e.breakdown_hours_24h, 0),
      avgContractorRisk: mineContractors.length > 0 ? Math.round(mineContractors.reduce((acc, c) => acc + c.contractor_risk_score, 0) / mineContractors.length) : 30,
      highRiskContractors: mineContractors.filter(c => c.status === 'HIGH_RISK' || c.status === 'CRITICAL_RISK').length,
      workerTrainingExpiryCount: mineWorkforce.filter(w => w.training_status === 'EXPIRED').length,
      workerFitnessExpiryCount: mineWorkforce.filter(w => w.fitness_status === 'EXPIRED').length,
      avgProductionAchievement,
      totalProductionLoss: mineProd.reduce((acc, p) => acc + (p.idle_hours ?? 0) * 50, 0),
      lowConfidenceDocsCount: mineDocs.filter(d => (d.ocr_confidence_pct ?? d.extraction_confidence * 100) < 82).length,
      docExpiryCount: mineDocs.filter(d => d.verification_status === 'EXPIRED').length,
      domainRisk
    };
  });
}
