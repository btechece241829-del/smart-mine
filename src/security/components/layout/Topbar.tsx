// Topbar — notification bell, profile dropdown, logout, search
import React, { useEffect, useState } from 'react';
import { Menu, Search, Bell, User, LogOut, CheckCheck } from 'lucide-react';
import { Profile, Notification } from '../../lib/types';
import { notificationsService } from '../../lib/notifications';
import { fbSubscribe } from '../../lib/firebaseDb';
import { where } from 'firebase/firestore';
import { timeAgo } from '../../lib/analytics';
import { PageKey } from '../../lib/permissions';

interface TopbarProps {
  profile: Profile | null;
  roleLabel: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onNavigate: (page: PageKey) => void;
  onSearch: (q: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ profile, roleLabel, onToggleSidebar, onLogout, onNavigate, onSearch }) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const list = await notificationsService.list(profile.id);
      setNotifications(list);
      setUnread(list.filter((n) => !n.is_read).length);
    };
    load();
  }, [profile]);

  // Refresh the panel whenever local data changes — a risk broadcast writes the
  // notifications locally first (see fbBatchInsert), so they appear here even
  // if Firestore is slow/offline, and across tabs in the same browser.
  useEffect(() => {
    if (!profile) return;
    const handler = async () => {
      const list = await notificationsService.list(profile.id);
      setNotifications(list);
      setUnread(list.filter((n) => !n.is_read).length);
    };
    window.addEventListener('smartmine_db_change', handler);
    return () => window.removeEventListener('smartmine_db_change', handler);
  }, [profile]);

  // Real-time subscription: live notifications for the current user
  useEffect(() => {
    if (!profile) return;
    const unsubscribe = fbSubscribe(
      'notifications',
      (docs) => {
        const latest = docs as unknown as Notification[];
        setNotifications(latest);
        setUnread(latest.filter((n) => !n.is_read).length);
      },
      (err) => console.error(err),
      where('user_id', '==', profile.id),
    );
    return () => { unsubscribe(); };
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await notificationsService.markAllRead(profile.id);
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <header className="bg-carbon-900 border-b border-carbon-700/60 sticky top-0 z-20 px-3 sm:px-4 py-2.5 flex items-center gap-3">
      <button className="lg:hidden text-warm-sand" onClick={onToggleSidebar}>
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden md:flex items-center gap-2 bg-carbon-850 px-3 py-1.5 rounded-lg border border-carbon-700/60 flex-1 max-w-md">
        <Search className="w-4 h-4 text-warm-slate" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); onSearch(e.target.value); }}
          placeholder="Search complaints, IDs..."
          className="bg-transparent text-xs text-warm-pale outline-none w-full placeholder-warm-slate/60"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            className="relative p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-warm-sand"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-carbon-900 border border-carbon-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-carbon-700/60">
                <span className="text-xs font-bold text-warm-pale">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-copper-light hover:underline flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="p-6 text-center text-xs text-warm-slate">No notifications yet</div>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-carbon-700/40 hover:bg-carbon-850 ${!n.is_read ? 'bg-carbon-850/60' : 'opacity-70'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-copper' : 'bg-carbon-700'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-warm-pale">{n.title}</p>
                        {n.body && <p className="text-[11px] text-warm-slate mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-warm-slate/60 font-mono mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700"
          >
            <div className="w-7 h-7 rounded-full bg-copper flex items-center justify-center text-white text-xs font-bold">
              {profile?.full_name?.charAt(0) ?? 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-warm-pale leading-tight">{profile?.full_name}</div>
              <div className="text-[10px] text-warm-slate">{roleLabel}</div>
            </div>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-carbon-900 border border-carbon-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-carbon-700/60">
                <div className="text-xs font-bold text-warm-pale">{profile?.full_name}</div>
                <div className="text-[11px] text-warm-slate">{profile?.email}</div>
                <div className="text-[11px] text-copper-light font-mono mt-1">{profile?.employee_id}</div>
              </div>
              <button
                onClick={() => { onNavigate('profile'); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-warm-sand hover:bg-carbon-850 text-left"
              >
                <User className="w-4 h-4" /> My Profile
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 text-left"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

