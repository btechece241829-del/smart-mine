// ────────────────────────────────────────────────────────────────
// Notifications service — create + query + mark-read (Firestore)
// ────────────────────────────────────────────────────────────────
import { fbCount, fbBatchInsert, getLocalCollection } from './firebaseDb';
import { Notification, Severity } from './types';
import { db } from './firebase';
import { collection, query as fsQuery, getDocs, updateDoc, doc, writeBatch, where } from 'firebase/firestore';

export const notificationsService = {
  /**
   * List notifications for a user.
   *
   * IMPORTANT: We deliberately avoid `orderBy` + `where` on Firestore because
   * that requires a composite index that is not auto-created.  A single-field
   * equality `where('user_id','==',...)` works out-of-the-box; sorting is
   * done client-side and any pending-local notifications are merged back so
   * the offline-first flow stays seamless.
   */
  async list(userId: string, limit = 50): Promise<Notification[]> {
    let result: Notification[] = [];
    let firestoreOk = false;
    try {
      const q = fsQuery(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
      );
      const snap = await getDocs(q);
      result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      firestoreOk = true;
    } catch {
      firestoreOk = false;
    }

    const local = getLocalCollection<Notification & { _pendingSync?: boolean }>('notifications')
      .filter((n) => n && n.user_id === userId);
    if (firestoreOk) {
      const fsIds = new Set(result.map((n) => n.id));
      const pendingLocal = local.filter((n) => n._pendingSync === true && !fsIds.has(n.id));
      if (pendingLocal.length > 0) result = [...result, ...pendingLocal];
    } else {
      result = local;
    }

    // Client-side sort: newest first
    result.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    return result.slice(0, limit);
  },

  async unreadCount(userId: string): Promise<number> {
    const list = await this.list(userId, 100);
    return list.filter((n) => !n.is_read).length;
  },

  async markRead(id: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', id), { is_read: true });
  },

  /**
   * Mark all as read — single-field equality only (no composite index needed).
   * Filters `is_read === false` in-memory, then batch-updates in Firestore.
   */
  async markAllRead(userId: string): Promise<void> {
    try {
      const q = fsQuery(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
      );
      const snap = await getDocs(q);
      const unreadDocs = snap.docs.filter((d) => d.data().is_read === false);
      if (unreadDocs.length === 0) return;
      const batch = writeBatch(db);
      unreadDocs.forEach((d) => batch.update(d.ref, { is_read: true }));
      await batch.commit();
    } catch (e) {
      console.warn('[notifications] markAllRead failed:', e);
    }
  },

  async notify(users: { id: string }[], payload: {
    complaint_id?: string | null;
    title: string;
    body?: string | null;
    severity?: Severity | null;
    action_required?: string | null;
    deadline?: string | null;
  }): Promise<void> {
    const rows = users.map((u) => ({
      user_id: u.id,
      complaint_id: payload.complaint_id ?? null,
      title: payload.title,
      body: payload.body ?? null,
      severity: payload.severity ?? null,
      action_required: payload.action_required ?? null,
      deadline: payload.deadline ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    }));
    if (!rows.length) return;
    await fbBatchInsert('notifications', rows);
  },
};

export const notify = notificationsService.notify.bind(notificationsService);
