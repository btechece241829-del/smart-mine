// DB Client for interfacing with the persistence backend

const DB_API_URL = 'http://localhost:5004/api/db';
const DB_HEALTH_URL = `${DB_API_URL}/health`;

export interface DBClientResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isDegraded?: boolean;
}

// Global flag to track if the DB is known to be down, so we don't spam errors
let isDegradedMode = false;

export const dbClient = {
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch(DB_HEALTH_URL);
      const data = await res.json();
      isDegradedMode = data.status === 'degraded';
      return !isDegradedMode;
    } catch {
      isDegradedMode = true; // Connection refused = degraded
      return false;
    }
  },

  getAll: async <T>(entity: string): Promise<DBClientResponse<T[]>> => {
    if (isDegradedMode) return { success: false, isDegraded: true };
    try {
      const res = await fetch(`${DB_API_URL}/${entity}`);
      if (!res.ok) {
        if (res.status === 503) isDegradedMode = true;
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, data: data.items as T[] };
    } catch (e: any) {
      isDegradedMode = true;
      return { success: false, error: e.message, isDegraded: true };
    }
  },

  upsert: async <T>(entity: string, item: T): Promise<DBClientResponse<T>> => {
    if (isDegradedMode) return { success: false, isDegraded: true };
    try {
      const res = await fetch(`${DB_API_URL}/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!res.ok) {
        if (res.status === 503) isDegradedMode = true;
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { success: true, data: data as T };
    } catch (e: any) {
      isDegradedMode = true;
      return { success: false, error: e.message, isDegraded: true };
    }
  }
};
