// ────────────────────────────────────────────────────────────────
// Notifications View — full inbox with mark all read, filter unread
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { notificationsService } from '../lib/notifications';
import { Notification } from '../lib/types';
import { formatDate, timeAgo } from '../lib/analytics';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';

export const NotificationsView: React.FC<{ onSelectComplaint?: (id: string) => void }> = ({ onSelectComplaint }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const list = await notificationsService.list(profile.id, 100);
    setNotifications(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const handleMarkRead = async (id: string) => {
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAll = async () => {
    if (!profile) return;
    await notificationsService.markAllRead(profile.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const filtered = filterUnreadOnly ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <Spinner size="lg" label="Loading notifications..." />;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-copper-light" />
          <div>
            <h1 className="text-lg font-extrabold text-warm-pale">Notifications</h1>
            <p className="text-xs text-warm-slate">{unreadCount} unread · {notifications.length} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setFilterUnreadOnly((v) => !v)}
            className={`text-xs ${filterUnreadOnly ? 'text-copper-light font-bold' : 'text-warm-slate'}`}
          >
            {filterUnreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAll} className="text-xs">
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={filterUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
          subtitle="System and safety alerts assigned to you will appear here."
        />
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-carbon-700/40">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                  !n.is_read ? 'bg-carbon-850/70' : 'hover:bg-carbon-850/40'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${!n.is_read ? 'bg-copper' : 'bg-carbon-700'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-warm-pale">{n.title}</p>
                      {n.severity && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                          {n.severity}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-warm-slate/60">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-xs text-warm-slate mt-1 leading-relaxed">{n.body}</p>}
                    {n.action_required && (
                      <p className="text-[11px] text-amber-400/90 mt-1 font-mono">
                        Action: {n.action_required}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {n.complaint_id && onSelectComplaint && (
                    <button
                      onClick={() => {
                        if (!n.is_read) handleMarkRead(n.id);
                        onSelectComplaint(n.complaint_id!);
                      }}
                      className="p-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-warm-sand text-xs flex items-center gap-1"
                      title="View Complaint"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-copper-light" />
                      <span className="hidden sm:inline">View</span>
                    </button>
                  )}
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="p-1.5 rounded-lg hover:bg-carbon-700 text-warm-slate hover:text-copper-light"
                      title="Mark as Read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};