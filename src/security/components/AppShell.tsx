// AppShell — wraps Sidebar + Topbar + page content
import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { canAccessPage, PageKey } from '../lib/permissions';
import { UserRole, ROLE_LABELS } from '../lib/types';
import { Sidebar } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';

interface AppShellProps {
  children: React.ReactNode;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  onSearch?: (q: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, currentPage, onNavigate, onSearch }) => {
  const { profile, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Navigation gating: if the current page isn't allowed, fall back to dashboard
  if (role && !canAccessPage(role, currentPage)) {
    onNavigate('dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0C0605] flex">
      <Sidebar
        role={role!}
        currentPage={currentPage}
        onNavigate={onNavigate}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          profile={profile}
          roleLabel={role ? ROLE_LABELS[role] : ''}
          onToggleSidebar={() => setMobileOpen((v) => !v)}
          onLogout={() => signOut()}
          onNavigate={onNavigate}
          onSearch={onSearch ?? (() => {})}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};
