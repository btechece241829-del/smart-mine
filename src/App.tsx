import React, { useState, useCallback, useMemo } from 'react';
import { dbClient } from './services/dbClient';
import { DatasetBundle, DerivedMineMetrics, RuleDerivedAlert, UserRole, AuditLogEntry, CAPAItem, StatutoryDocument, Mine, WorkflowStep } from './types/minegov';
import { loadAllDatasets, parseDatasetsFromFiles } from './services/dataLoader';
import { calculateAllMinesRisk } from './services/riskEngine';
import { generateRuleDerivedAlerts } from './services/alertEngine';
import { Topbar } from './components/layout/Topbar';
import { Sidebar } from './components/layout/Sidebar';
import { Drawer } from './components/layout/Drawer';
import { CopilotDrawer } from './components/copilot/CopilotDrawer';
import { DatasetUploadView } from './components/views/DatasetUploadView';

import { CommandCenterView } from './components/views/CommandCenterView';
import { ComplianceView } from './components/views/ComplianceView';
import { InspectionsCapaView } from './components/views/InspectionsCapaView';
import { SafetyAiView } from './components/views/SafetyAiView';
import { GisView } from './components/views/GisView';
import { EnvironmentView } from './components/views/EnvironmentView';
import { OperationsView } from './components/views/OperationsView';
import { WorkforceContractorsView } from './components/views/WorkforceContractorsView';
import { DocumentsOcrView } from './components/views/DocumentsOcrView';
import { AlertsEscalationView } from './components/views/AlertsEscalationView';
import { RoleViewsView } from './components/views/RoleViewsView';
import { ReportsView } from './components/views/ReportsView';
import { AuditTrailView } from './components/views/AuditTrailView';
import { DataIntegrationsView } from './components/views/DataIntegrationsView';
import { WorkflowAutomationView } from './components/views/WorkflowAutomationView';
import { BlockchainAuditView } from './components/views/BlockchainAuditView';
import { SubsidiaryComparativeView } from './components/views/SubsidiaryComparativeView';
import { BellRing } from 'lucide-react';

export const App: React.FC = () => {
  const [uploadProcessing, setUploadProcessing] = useState<boolean>(false);
  const [data, setData] = useState<DatasetBundle | null>(null);
  const [selectedMineId, setSelectedMineId] = useState<string>('ALL');
  const [currentRole, setCurrentRole] = useState<UserRole>('MINE_MANAGER');
  const [currentView, setCurrentView] = useState<string>('command_center');

  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [alertsOpen, setAlertsOpen] = useState<boolean>(false);

  const [capaItems, setCapaItems] = useState<CAPAItem[]>([]);
  const [documents, setDocuments] = useState<StatutoryDocument[]>([]);
  const [alerts, setAlerts] = useState<RuleDerivedAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [focusedMine, setFocusedMine] = useState<Mine | null>(null);

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [dbStatus, setDbStatus] = useState<string>('checking');

  React.useEffect(() => {
    async function initDb() {
      const isUp = await dbClient.checkHealth();
      setDbStatus(isUp ? 'connected' : 'degraded');
      if (isUp) {
        const [cap, doc, alt, aud, wf] = await Promise.all([
          dbClient.getAll<CAPAItem>('capa'),
          dbClient.getAll<StatutoryDocument>('documents'),
          dbClient.getAll<RuleDerivedAlert>('alerts'),
          dbClient.getAll<AuditLogEntry>('audit_logs'),
          dbClient.getAll<WorkflowStep>('workflows'),
        ]);
        if (cap.success && cap.data) setCapaItems(cap.data);
        if (doc.success && doc.data) setDocuments(doc.data);
        if (alt.success && alt.data) setAlerts(alt.data);
        if (aud.success && aud.data) setAuditLogs(aud.data);
        if (wf.success && wf.data) setWorkflowSteps(wf.data);
      }
    }
    initDb();
  }, []);

  const handleAuditLog = useCallback((action: string, details: string) => {
    const newLog: AuditLogEntry = {
      id: `LOG-${Math.floor(Math.random()*1000000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userRole: currentRole,
      action,
      details
    };
    if (dbStatus === 'connected') { dbClient.upsert('audit_logs', { ...newLog, log_id: newLog.id } as any); }
    setAuditLogs(prev => [newLog, ...prev]);
  }, [currentRole, dbStatus]);

  /** Called when user drops CSV files onto the upload screen. */
  const handleFilesSelected = useCallback(async (files: File[]) => {
    setUploadProcessing(true);
    try {
      const bundle = await parseDatasetsFromFiles(files);
      setData(bundle);
      setCapaItems(bundle.correctiveActions);
      setDocuments(bundle.documents);
      const derivedAlerts = generateRuleDerivedAlerts(bundle);
      setAlerts(derivedAlerts);
      const initLog: AuditLogEntry = {
        id: 'LOG-0001',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userRole: 'SUPER_ADMIN',
        action: 'SYSTEM_INITIALIZATION',
        details: `Successfully ingested ${files.length} user-supplied CSV files across ${bundle.mines.length} coal mines.`
      };
      setAuditLogs([initLog]);
    } catch (err) {
      console.error('Failed to parse uploaded files:', err);
    } finally {
      setUploadProcessing(false);
    }
  }, []);

  /** Load the bundled sample dataset as a fallback. */
  const handleLoadSample = useCallback(async () => {
    setUploadProcessing(true);
    try {
      const bundle = await loadAllDatasets();
      setData(bundle);
      setCapaItems(bundle.correctiveActions);
      setDocuments(bundle.documents);
      const derivedAlerts = generateRuleDerivedAlerts(bundle);
      setAlerts(derivedAlerts);
      const initLog: AuditLogEntry = {
        id: 'LOG-0001',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userRole: 'SUPER_ADMIN',
        action: 'SYSTEM_INITIALIZATION',
        details: `Successfully loaded 13 synthetic CSV datasets across ${bundle.mines.length} coal mines.`
      };
      setAuditLogs([initLog]);
    } catch (err) {
      console.error('Failed to load sample datasets:', err);
    } finally {
      setUploadProcessing(false);
    }
  }, []);

  const mineMetricsList: DerivedMineMetrics[] = useMemo(() => {
    if (!data) return [];
    const activeBundle = { ...data, correctiveActions: capaItems, documents: documents };
    return calculateAllMinesRisk(activeBundle);
  }, [data, capaItems, documents]);

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    handleAuditLog('ROLE_SWITCH', `Switched active governance role to ${role}`);
  };

  const handleMineSelect = (mineId: string) => {
    setSelectedMineId(mineId);
    if (data && mineId !== 'ALL') {
      const mine = data.mines.find(m => m.mine_id === mineId);
      if (mine) setFocusedMine(mine);
    } else {
      setFocusedMine(null);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => {
      if(a.alertId === alertId) {
        const updated = { ...a, acknowledged: true };
        if (dbStatus === 'connected') dbClient.upsert('alerts', updated);
        return updated;
      }
      return a;
    }));
    handleAuditLog('ALERT_ACKNOWLEDGE', `Acknowledged rule-derived alert #${alertId}`);
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.alertId !== alertId));
    handleAuditLog('ALERT_RESOLVE', `Resolved rule-derived alert #${alertId}`);
  };

  const handleUpdateCapaStatus = (id: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE') => {
    setCapaItems(prev => prev.map(c => c.action_id === id ? { ...c, status: newStatus } : c));
    handleAuditLog('CAPA_STATUS_UPDATE', `Updated CAPA #${id} status to ${newStatus}`);
  };

  const handleVerifyDocument = (docId: string) => {
    setDocuments(prev => prev.map(d => d.document_id === docId ? { ...d, verification_status: 'VERIFIED' } : d));
    handleAuditLog('DOCUMENT_VERIFIED', `Manually approved and verified statutory document #${docId}`);
  };

  const handleAddDocument = (doc: StatutoryDocument) => {
    setDocuments(prev => [doc, ...prev]);
    handleAuditLog('DOCUMENT_UPLOADED', `Ingested & processed new document ${doc.document_name} via OCR`);
  };

  const handleNavigateToGis = (mine: Mine) => {
    setFocusedMine(mine);
    setCurrentView('gis');
  };

  if (!data) {
    return (
      <DatasetUploadView
        onFilesSelected={handleFilesSelected}
        onLoadSample={handleLoadSample}
        processing={uploadProcessing}
      />
    );
  }

  const unacknowledgedAlertsCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-carbon-900 text-warm-pale flex flex-col font-sans selection:bg-copper selection:text-white">
      <Topbar
        mines={data.mines}
        selectedMineId={selectedMineId}
        currentRole={currentRole}
        unacknowledgedAlertsCount={unacknowledgedAlertsCount}
        onSelectMine={handleMineSelect}
        onSelectRole={handleRoleChange}
        onToggleCopilot={() => setCopilotOpen(!copilotOpen)}
        onToggleAlerts={() => setAlertsOpen(!alertsOpen)}
        onOpenReports={() => setCurrentView('reports')}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={currentView as any}
          onSelectView={(view) => setCurrentView(view as string)}
          counts={{ criticalAlerts: unacknowledgedAlertsCount }}
        />

        <main className="flex-1 p-6 overflow-y-auto bg-carbon-900 space-y-6">
          {currentView === 'command_center' && (
            <CommandCenterView
              data={data}
              metrics={mineMetricsList}
              alerts={alerts}
              selectedMineId={selectedMineId}
              onSelectMine={handleMineSelect}
              onNavigateView={setCurrentView}
            />
          )}

          {currentView === 'compliance' && (
            <ComplianceView
              data={data}
              metrics={mineMetricsList}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'inspections_capa' && (
            <InspectionsCapaView
              data={data}
              selectedMineId={selectedMineId}
              onAuditLog={handleAuditLog}
              capaItems={capaItems}
              setCapaItems={setCapaItems}
              dbStatus={dbStatus}
            />
          )}

          {currentView === 'safety_ai' && (
            <SafetyAiView
              data={data}
              metrics={mineMetricsList}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'gis' && (
            <GisView
              data={data}
              selectedMineId={selectedMineId}
              onSelectMine={handleMineSelect}
            />
          )}

          {currentView === 'environment' && (
            <EnvironmentView
              data={data}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'operations' && (
            <OperationsView
              data={data}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'workforce_contractors' && (
            <WorkforceContractorsView
              data={data}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'documents_ocr' && (
            <DocumentsOcrView
              data={data}
              selectedMineId={selectedMineId}
              onAuditLog={handleAuditLog}
              documents={documents}
              setDocuments={setDocuments}
              dbStatus={dbStatus}
            />
          )}

          {currentView === 'workflow_automation' && (
            <WorkflowAutomationView
              data={data}
              selectedMineId={selectedMineId}
              onAuditLog={handleAuditLog}
              workflowSteps={workflowSteps}
              setWorkflowSteps={setWorkflowSteps}
              dbStatus={dbStatus}
            />
          )}

          {currentView === 'alerts_escalation' && (
            <AlertsEscalationView
              alerts={alerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onResolveAlert={handleResolveAlert}
              onAuditLog={handleAuditLog}
            />
          )}

          {currentView === 'role_views' && (
            <RoleViewsView
              currentRole={currentRole}
              onRoleChange={handleRoleChange}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              data={data}
              metrics={mineMetricsList}
              alerts={alerts}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'subsidiary_comparative' && (
            <SubsidiaryComparativeView
              data={data}
              metrics={mineMetricsList}
              selectedMineId={selectedMineId}
            />
          )}

          {currentView === 'blockchain_audit' && (
            <BlockchainAuditView
              logs={auditLogs}
            />
          )}

          {currentView === 'data_integrations' && (
            <DataIntegrationsView
              logs={auditLogs}
            />
          )}

          {currentView === 'audit-trail' && (
            <AuditTrailView
              logs={auditLogs}
            />
          )}
        </main>
      </div>

      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        metrics={mineMetricsList}
        data={data}
      />

      <Drawer
        isOpen={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Rule-Derived Critical Alerts Feed"
      >
        <div className="space-y-4 font-sans">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-400 flex items-center gap-2">
            <BellRing className="w-4 h-4 shrink-0" />
            {alerts.length} Total Derived Alerts ({unacknowledgedAlertsCount} Unacknowledged)
          </div>

          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.alertId} className="p-3 bg-carbon-900 border border-carbon-700 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    a.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {a.severity} • {a.category}
                  </span>
                  <span className="font-mono text-[10px] text-copper-light">{a.mineId}</span>
                </div>
                <div className="font-bold text-white">{a.title}</div>
                <div className="text-[11px] text-warm-slate">{a.escalationLevel}</div>
                <div className="text-[11px] text-warm-sand font-mono bg-carbon-800 p-2 rounded">{a.actionRequired}</div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  {!a.acknowledged ? (
                    <button
                      onClick={() => handleAcknowledgeAlert(a.alertId)}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-mono"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResolveAlert(a.alertId)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-mono"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default App;
