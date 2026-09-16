// ────────────────────────────────────────────────────────────────
// Security App Entry — AuthProvider, auth gate, role-based routing
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { AuthProvider, useAuth } from './lib/authContext';
import { PageKey, canAccessPage } from './lib/permissions';
import { UserRole } from './lib/types';
import { ensureMinesSeeded } from './lib/mines';
import { LoginPage } from './components/LoginPage';
import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { ReportIssueForm } from './components/ReportIssueForm';
import { ComplaintList } from './components/ComplaintList';
import {
  SafeComplaintRegisterPage,
  ComplaintExplorerPage,
  ComplaintMapPage,
  ComplaintAnalyticsPage,
  ComplaintDetailPage,
  CategoriesAdminPage,
} from './components/safety';
import { UserManagement } from './components/UserManagement';
import { AuditLogsView } from './components/AuditLogsView';
import { EscalationRulesView } from './components/EscalationRulesView';
import { SystemSettingsView } from './components/SystemSettingsView';
import { MinesView } from './components/MinesView';
import { ComplianceAnalyticsView } from './components/ComplianceAnalyticsView';
import { DataHubView } from './components/DataHubView';
import { GisMappingView } from './components/GisMappingView';
import { ReportsView } from './components/ReportsView';
import { AttendanceMarkView } from './components/AttendanceMarkView';
import { AttendanceAdminView } from './components/AttendanceAdminView';
import { ManagerAttendanceDashboard } from './components/ManagerAttendanceDashboard';
import { InspectionView } from './components/InspectionView';
import { EscalationsView } from './components/EscalationsView';
import { RiskAssessmentView } from './components/RiskAssessmentView';
import { DepartmentsView } from './components/DepartmentsView';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { OcrAttendanceView } from './components/OcrAttendanceView';
import { Spinner } from './components/ui/primitives';
import {
  BlockchainDashboardPage,
  BlockchainVerifyPage,
  BlockchainAuditExplorerPage,
  BlockchainQrPage,
} from './components/blockchain';
import { PredictiveAnalyticsView } from './components/PredictiveAnalyticsView';

const SecurityApp: React.FC = () => {
  const { session, profile, role, loading, needsRoleSelection } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [complaintPage, setComplaintPage] = useState<PageKey>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  // Topbar search lands on the role-appropriate complaints list page.
  const complaintsPageFor = (r: UserRole): PageKey => {
    switch (r) {
      case 'worker': return 'my_complaints';
      case 'mining_mate':
      case 'overman': return 'assigned_complaints';
      case 'safety_officer': return 'safety_complaints';
      case 'mine_manager': return 'all_mine_complaints';
      case 'super_admin': return 'all_complaints';
    }
  };

  const navigate = (p: PageKey) => {
    setSelectedComplaintId(null);
    setGlobalSearch('');
    setPage(p);
  };

  // Auto-provision the Indian coal-mine catalogue as soon as a
  // manager/admin signs in — every role then shares the same mine list.
  useEffect(() => {
    if (role === 'mine_manager' || role === 'super_admin') {
      ensureMinesSeeded().catch(() => {});
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C0605]">
        <Spinner size="lg" label="Checking session..." />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  // First-time OAuth user — no profile row yet, prompt them to pick a role
  if (needsRoleSelection) {
    return <RoleSelectionScreen />;
  }

  if (!profile || !role) {
    return <LoginPage />;
  }

  // Gate page access by role
  const safePage: PageKey = canAccessPage(role, page) ? page : 'dashboard';

  // When a complaint is selected, show detail regardless of nav page
  if (selectedComplaintId) {
    return (
      <AppShell currentPage={complaintPage} onNavigate={navigate}>
        <ComplaintDetailPage
          complaintId={selectedComplaintId}
          onBack={() => { setSelectedComplaintId(null); setPage(complaintPage); }}
        />
      </AppShell>
    );
  }

  const renderPage = () => {
    switch (safePage) {
      case 'dashboard': return (
        <DashboardView
          onNavigate={navigate}
          onSelectComplaint={(id) => {
            setSelectedComplaintId(id);
            setComplaintPage('dashboard');
          }}
        />
      );
      case 'gis_mapping': return <GisMappingView />;
      case 'data_upload': return <DataHubView />;
      case 'report_issue': return <ReportIssueForm onDone={() => setPage('my_complaints')} />;
      case 'my_complaints': return <ComplaintList userId={profile.id} searchQuery={globalSearch} onRegister={() => navigate('complaint_register')} onView={(id) => { setSelectedComplaintId(id); setComplaintPage('my_complaints'); }} />;
      case 'assigned_complaints': return <ComplaintList assignedTo={profile.id} searchQuery={globalSearch} onRegister={() => navigate('complaint_register')} onView={(id) => { setSelectedComplaintId(id); setComplaintPage('assigned_complaints'); }} />;
      case 'safety_complaints': return <ComplaintList mineId={profile.mine_id} safetyOnly searchQuery={globalSearch} onRegister={() => navigate('complaint_register')} onView={(id) => { setSelectedComplaintId(id); setComplaintPage('safety_complaints'); }} />;
      case 'all_mine_complaints': return <ComplaintList mineId={profile.mine_id} searchQuery={globalSearch} onRegister={() => navigate('complaint_register')} onView={(id) => { setSelectedComplaintId(id); setComplaintPage('all_mine_complaints'); }} />;
      case 'all_complaints': return <ComplaintList searchQuery={globalSearch} onRegister={() => navigate('complaint_register')} onView={(id) => { setSelectedComplaintId(id); setComplaintPage('all_complaints'); }} />;
      case 'inspection': return (
        <InspectionView
          onSelectComplaint={(id) => { setSelectedComplaintId(id); setComplaintPage('inspection'); }}
        />
      );
      case 'escalations': return (
        <EscalationsView
          onSelectComplaint={(id) => { setSelectedComplaintId(id); setComplaintPage('escalations'); }}
        />
      );
      case 'risk_assessment': return <RiskAssessmentView />;
      case 'compliance_analytics': return <ComplianceAnalyticsView />;
      case 'attendance_mark': return <AttendanceMarkView />;
      case 'attendance_register': return <AttendanceAdminView />;
      case 'attendance_review': return <ManagerAttendanceDashboard />;
      case 'reports': return <ReportsView />;
      case 'mines': return <MinesView />;
      case 'users': return <UserManagement />;
      case 'departments': return <DepartmentsView />;
      case 'audit_logs': return <AuditLogsView />;
      case 'escalation_rules': return <EscalationRulesView />;
      case 'system_settings': return <SystemSettingsView />;
      case 'notifications': return (
        <NotificationsView
          onSelectComplaint={(id) => { setSelectedComplaintId(id); setComplaintPage('notifications'); }}
        />
      );
      // ── Safety Complaint Module ──
      case 'complaint_register': return (
        <SafeComplaintRegisterPage
          onDone={(id) => {
            if (id) {
              setSelectedComplaintId(id);
              setComplaintPage('complaint_explorer');
            } else {
              setPage('complaint_explorer');
            }
          }}
        />
      );
      case 'complaint_explorer': return (
        <ComplaintExplorerPage
          onRegister={() => navigate('complaint_register')}
          onView={(id) => { setSelectedComplaintId(id); setComplaintPage('complaint_explorer'); }}
        />
      );
      case 'complaint_map': return (
        <ComplaintMapPage
          onView={(id) => { setSelectedComplaintId(id); setComplaintPage('complaint_map'); }}
        />
      );
      case 'complaint_analytics': return <ComplaintAnalyticsPage />;
      case 'complaint_categories': return <CategoriesAdminPage />;
      case 'profile': return <ProfileView />;
      case 'ocr_attendance': return <OcrAttendanceView />;
      // ── Blockchain Module ──
      case 'blockchain_dashboard': return <BlockchainDashboardPage />;
      case 'blockchain_verify': return <BlockchainVerifyPage />;
      case 'blockchain_audit_explorer': return <BlockchainAuditExplorerPage />;
      case 'blockchain_qr': return <BlockchainQrPage />;
      // ── Predictive Analytics Module (super_admin only) ──
      case 'predictive_analytics': return <PredictiveAnalyticsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <AppShell
      currentPage={safePage}
      onNavigate={navigate}
      onSearch={(q) => {
        setGlobalSearch(q);
        if (q.trim()) {
          setSelectedComplaintId(null);
          setPage(complaintsPageFor(role));
        }
      }}
    >
      {renderPage()}
    </AppShell>
  );
};

const rootEl = document.getElementById('security-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AuthProvider>
        <SecurityApp />
      </AuthProvider>
    </React.StrictMode>
  );
}

