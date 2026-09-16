// ────────────────────────────────────────────────────────────────
// Mines catalogue & auto-configuration
// Idempotently seeds/keeps the Firestore `mines` collection with
// real INDIAN COAL mines (CIL subsidiaries + Singareni) so that
// every role gets a populated mine picker without manual entry.
// Reads are allowed for all signed-in users; the (rare) seed
// writes require mine_manager/super_admin per firestore.rules.
// ────────────────────────────────────────────────────────────────
import { fb, fbUpsertInto } from './firebaseDb';
import { Mine } from './types';

export type MineOperationType = 'OPENCAST' | 'UNDERGROUND' | 'MIXED';
export type MineStatus = 'Active' | 'Maintenance' | 'Inactive';

export interface MineSeed {
  mine_name: string;
  mine_code: string;
  subsidiary: string;
  company?: string; // defaults to 'Coal India Limited'
  state: string;
  district: string;
  location: string; // coalfield / area label
  latitude: number;
  longitude: number;
  mine_type: MineOperationType;
  status: MineStatus;
}

/** Deterministic Firestore document id — slug of the mine name. */
export function mineSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ════════════════════════════════════════════════════════════════
// Indian coal-mine catalogue — Coal India Ltd subsidiaries & SCCL
// ════════════════════════════════════════════════════════════════
export const INDIAN_COAL_MINES: MineSeed[] = [
  // ── BCCL — Bharat Coking Coal (Jharia/Giridih coalfields, Jharkhand) ──
  { mine_name: 'Kustore Colliery', mine_code: 'BCCL-01', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Dhanbad', location: 'Jharia Coalfield', latitude: 23.794, longitude: 86.43, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Kusunda Colliery', mine_code: 'BCCL-02', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Dhanbad', location: 'Jharia Coalfield', latitude: 23.778, longitude: 86.377, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Sudamdih Colliery', mine_code: 'BCCL-03', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Dhanbad', location: 'Jharia Coalfield', latitude: 23.672, longitude: 86.396, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Moonidih Colliery', mine_code: 'BCCL-04', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Dhanbad', location: 'Jharia Coalfield', latitude: 23.683, longitude: 86.479, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Chasnala Colliery', mine_code: 'BCCL-05', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Dhanbad', location: 'Jharia Coalfield', latitude: 23.704, longitude: 86.342, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Bokaro & Kargali OCP', mine_code: 'BCCL-06', subsidiary: 'Bharat Coking Coal Ltd', state: 'Jharkhand', district: 'Bokaro', location: 'Bokaro Coalfield', latitude: 23.74, longitude: 85.94, mine_type: 'OPENCAST', status: 'Active' },

  // ── ECL — Eastern Coalfields (Raniganj, WB + Rajmahal, Jharkhand) ──
  { mine_name: 'Kunustoria Colliery', mine_code: 'ECL-01', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Paschim Bardhaman', location: 'Raniganj Coalfield', latitude: 23.613, longitude: 87.096, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Kajora Area Colliery', mine_code: 'ECL-02', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Paschim Bardhaman', location: 'Raniganj Coalfield', latitude: 23.735, longitude: 87.24, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Jhanjra Colliery', mine_code: 'ECL-03', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Paschim Bardhaman', location: 'Raniganj Coalfield', latitude: 23.667, longitude: 87.017, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Mithapur OCP', mine_code: 'ECL-04', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Paschim Bardhaman', location: 'Raniganj Coalfield', latitude: 23.675, longitude: 87.07, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Sonepur Bazari OCP', mine_code: 'ECL-05', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Paschim Bardhaman', location: 'Raniganj Coalfield', latitude: 23.594, longitude: 87.244, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Shyamsundarpur OCP', mine_code: 'ECL-06', subsidiary: 'Eastern Coalfields Ltd', state: 'West Bengal', district: 'Bankura', location: 'Raniganj Coalfield', latitude: 23.614, longitude: 86.95, mine_type: 'OPENCAST', status: 'Maintenance' },
  { mine_name: 'Rajmahal OCP', mine_code: 'ECL-07', subsidiary: 'Eastern Coalfields Ltd', state: 'Jharkhand', district: 'Godda', location: 'Rajmahal Coalfield', latitude: 25.04, longitude: 87.32, mine_type: 'OPENCAST', status: 'Active' },

  // ── CCL — Central Coalfields (Karanpura/Hazaribagh, Jharkhand) ──
  { mine_name: 'Piparwar OCP', mine_code: 'CCL-01', subsidiary: 'Central Coalfields Ltd', state: 'Jharkhand', district: 'Chatra', location: 'North Karanpura Coalfield', latitude: 24.05, longitude: 84.72, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Barka Sayal OCP', mine_code: 'CCL-02', subsidiary: 'Central Coalfields Ltd', state: 'Jharkhand', district: 'Ramgarh', location: 'Karanpura Coalfield', latitude: 23.635, longitude: 85.5, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Gidi Colliery', mine_code: 'CCL-03', subsidiary: 'Central Coalfields Ltd', state: 'Jharkhand', district: 'Hazaribagh', location: 'Hazaribagh Coalfield', latitude: 23.985, longitude: 85.36, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Saunda D Colliery', mine_code: 'CCL-04', subsidiary: 'Central Coalfields Ltd', state: 'Jharkhand', district: 'Ramgarh', location: 'Karanpura Coalfield', latitude: 23.66, longitude: 85.47, mine_type: 'UNDERGROUND', status: 'Active' },
  // ── SECL — South Eastern Coalfields (Korba/Sohagpur, CG & MP) ──
  { mine_name: 'Gevra OCP', mine_code: 'SECL-01', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.36, longitude: 82.66, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Dipka OCP', mine_code: 'SECL-02', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.42, longitude: 82.53, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Kusmunda OCP', mine_code: 'SECL-03', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.38, longitude: 82.56, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Hasdeo OCP', mine_code: 'SECL-04', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.45, longitude: 82.37, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Balgi OCP', mine_code: 'SECL-05', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.32, longitude: 82.6, mine_type: 'OPENCAST', status: 'Maintenance' },
  { mine_name: 'Tara OCP', mine_code: 'SECL-06', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.4, longitude: 82.64, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Rajgamar Colliery', mine_code: 'SECL-07', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Korba', location: 'Korba Coalfield', latitude: 22.41, longitude: 82.44, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Chirimiri Area', mine_code: 'SECL-08', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Koriya', location: 'North Karanpura Coalfield', latitude: 23.2, longitude: 82.35, mine_type: 'MIXED', status: 'Active' },
  { mine_name: 'Amlori OCP', mine_code: 'SECL-09', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Surguja', location: 'Bisrampur Coalfield', latitude: 23.16, longitude: 83.03, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Chhal OCP', mine_code: 'SECL-10', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Raigarh', location: 'Mand-Raigarh Coalfield', latitude: 21.91, longitude: 83.4, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Jampali OCP', mine_code: 'SECL-11', subsidiary: 'South Eastern Coalfields Ltd', state: 'Chhattisgarh', district: 'Raigarh', location: 'Mand-Raigarh Coalfield', latitude: 21.96, longitude: 83.42, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Churcha Colliery', mine_code: 'SECL-12', subsidiary: 'South Eastern Coalfields Ltd', state: 'Madhya Pradesh', district: 'Shahdol', location: 'Sohagpur Coalfield', latitude: 23.25, longitude: 81.54, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Sohagpur Colliery', mine_code: 'SECL-13', subsidiary: 'South Eastern Coalfields Ltd', state: 'Madhya Pradesh', district: 'Shahdol', location: 'Sohagpur Coalfield', latitude: 23.28, longitude: 81.44, mine_type: 'MIXED', status: 'Active' },

  // ── NCL — Northern Coalfields (Singrauli, MP / UP + Hazaribagh) ──
  { mine_name: 'Jayant OCP', mine_code: 'NCL-01', subsidiary: 'Northern Coalfields Ltd', state: 'Madhya Pradesh', district: 'Singrauli', location: 'Singrauli Coalfield', latitude: 24.17, longitude: 82.58, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Nigahi OCP', mine_code: 'NCL-02', subsidiary: 'Northern Coalfields Ltd', state: 'Madhya Pradesh', district: 'Singrauli', location: 'Singrauli Coalfield', latitude: 24.1, longitude: 82.63, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Dudhichua OCP', mine_code: 'NCL-03', subsidiary: 'Northern Coalfields Ltd', state: 'Madhya Pradesh', district: 'Singrauli', location: 'Singrauli Coalfield', latitude: 24.19, longitude: 82.69, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Krishnashila OCP', mine_code: 'NCL-04', subsidiary: 'Northern Coalfields Ltd', state: 'Uttar Pradesh', district: 'Sonebhadra', location: 'Singrauli Coalfield', latitude: 24.2, longitude: 82.73, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Kakri OCP', mine_code: 'NCL-05', subsidiary: 'Northern Coalfields Ltd', state: 'Uttar Pradesh', district: 'Sonebhadra', location: 'Singrauli Coalfield', latitude: 24.11, longitude: 82.78, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Gorbi OCP', mine_code: 'NCL-06', subsidiary: 'Northern Coalfields Ltd', state: 'Uttar Pradesh', district: 'Sonebhadra', location: 'Singrauli Coalfield', latitude: 24.07, longitude: 82.66, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Khadia OCP', mine_code: 'NCL-07', subsidiary: 'Northern Coalfields Ltd', state: 'Uttar Pradesh', district: 'Sonebhadra', location: 'Singrauli Coalfield', latitude: 24.15, longitude: 82.88, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Pakri-Barwadih OCP', mine_code: 'NCL-08', subsidiary: 'Northern Coalfields Ltd', state: 'Jharkhand', district: 'Hazaribagh', location: 'North Karanpura Coalfield', latitude: 24.01, longitude: 85.47, mine_type: 'OPENCAST', status: 'Active' },
  // ── WCL — Western Coalfields (Wardha/Kamptee/Pench, MH & MP) ──
  { mine_name: 'Mahakali OCP', mine_code: 'WCL-01', subsidiary: 'Western Coalfields Ltd', state: 'Maharashtra', district: 'Chandrapur', location: 'Wardha Valley Coalfield', latitude: 20.05, longitude: 79.33, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Majri OCP', mine_code: 'WCL-02', subsidiary: 'Western Coalfields Ltd', state: 'Maharashtra', district: 'Chandrapur', location: 'Wardha Valley Coalfield', latitude: 20.055, longitude: 79.3, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Ballarpur Colliery', mine_code: 'WCL-03', subsidiary: 'Western Coalfields Ltd', state: 'Maharashtra', district: 'Chandrapur', location: 'Wardha Valley Coalfield', latitude: 19.85, longitude: 79.35, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Saoner Colliery', mine_code: 'WCL-04', subsidiary: 'Western Coalfields Ltd', state: 'Maharashtra', district: 'Nagpur', location: 'Kamptee Coalfield', latitude: 21.36, longitude: 78.9, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Gondegaon Colliery', mine_code: 'WCL-05', subsidiary: 'Western Coalfields Ltd', state: 'Maharashtra', district: 'Nagpur', location: 'Kamptee Coalfield', latitude: 20.98, longitude: 79.0, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'New Kumari Colliery', mine_code: 'WCL-06', subsidiary: 'Western Coalfields Ltd', state: 'Madhya Pradesh', district: 'Chhindwara', location: 'Pench-Kanhan Coalfield', latitude: 22.02, longitude: 78.84, mine_type: 'UNDERGROUND', status: 'Active' },

  // ── MCL — Mahanadi Coalfields (Talcher & Ib Valley, Odisha) ──
  { mine_name: 'Bhubaneswari OCP', mine_code: 'MCL-01', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.86, longitude: 85.41, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Lingaraj OCP', mine_code: 'MCL-02', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.9, longitude: 85.05, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Kaniha OCP', mine_code: 'MCL-03', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.94, longitude: 85.24, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Jagannath OCP', mine_code: 'MCL-04', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.95, longitude: 85.31, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Ananta OCP', mine_code: 'MCL-05', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.9, longitude: 85.09, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Kulda OCP', mine_code: 'MCL-06', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.99, longitude: 85.42, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Hingula OCP', mine_code: 'MCL-07', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Angul', location: 'Talcher Coalfield', latitude: 20.93, longitude: 85.13, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Basundhara OCP', mine_code: 'MCL-08', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Sundargarh', location: 'Talcher Coalfield', latitude: 22.06, longitude: 83.89, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Lajkura OCP', mine_code: 'MCL-09', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Jharsuguda', location: 'Ib Valley Coalfield', latitude: 21.78, longitude: 83.99, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Lilari OCP', mine_code: 'MCL-10', subsidiary: 'Mahanadi Coalfields Ltd', state: 'Odisha', district: 'Jharsuguda', location: 'Ib Valley Coalfield', latitude: 21.83, longitude: 84.02, mine_type: 'OPENCAST', status: 'Active' },

  // ── SCCL — Singareni (Ramagundam & Kothagudem, Telangana) ──
  { mine_name: 'Godavarikhani (GDK) Area', mine_code: 'SCCL-01', subsidiary: 'Singareni Collieries Company Ltd', company: 'Singareni Collieries Company Ltd', state: 'Telangana', district: 'Peddapalli', location: 'Ramagundam Coalfield', latitude: 18.72, longitude: 79.49, mine_type: 'MIXED', status: 'Active' },
  { mine_name: 'Ramagundam OCP', mine_code: 'SCCL-02', subsidiary: 'Singareni Collieries Company Ltd', company: 'Singareni Collieries Company Ltd', state: 'Telangana', district: 'Peddapalli', location: 'Ramagundam Coalfield', latitude: 18.73, longitude: 79.53, mine_type: 'OPENCAST', status: 'Active' },
  { mine_name: 'Kothagudem (KGM) Area', mine_code: 'SCCL-03', subsidiary: 'Singareni Collieries Company Ltd', company: 'Singareni Collieries Company Ltd', state: 'Telangana', district: 'Bhadradri Kothagudem', location: 'Kothagudem Coalfield', latitude: 17.57, longitude: 80.62, mine_type: 'UNDERGROUND', status: 'Active' },
  { mine_name: 'Manuguru OCP', mine_code: 'SCCL-04', subsidiary: 'Singareni Collieries Company Ltd', company: 'Singareni Collieries Company Ltd', state: 'Telangana', district: 'Bhadradri Kothagudem', location: 'Kothagudem Coalfield', latitude: 17.97, longitude: 80.83, mine_type: 'OPENCAST', status: 'Active' },
];

// ── Runtime helpers ────────────────────────────────────────────

let minesListCache: Mine[] | null = null;
let minesSeedAttempted = false;

/**
 * Read all mines sorted by name. The empty result is intentionally NOT
 * cached so a page re-visit re-reads once an admin has seeded the list.
 */
export async function listMines(force = false): Promise<Mine[]> {
  if (minesListCache && !force) return minesListCache;
  const { data } = await fb('mines').select('*').run<Mine[]>();
  const rows = ((data ?? []) as Mine[]).slice();
  rows.sort((a, b) =>
    String(a.mine_name ?? a.mine_code ?? a.id).localeCompare(String(b.mine_name ?? b.mine_code ?? b.id)),
  );
  if (rows.length > 0) minesListCache = rows;
  return rows;
}

/**
 * Idempotently add any catalogue mines that are missing from Firestore.
 * Existing/edited mines are left untouched (merge-by-slug, never clobbers).
 * Writes only succeed for mine_manager/super_admin per firestore.rules;
 * for other roles this resolves silently to whatever is readable.
 */
export async function ensureMinesSeeded(): Promise<void> {
  if (minesSeedAttempted) return;
  try {
    const existing = await listMines(true);
    const have = new Set(existing.map((m) => m.id));
    const now = new Date().toISOString();
    for (const seed of INDIAN_COAL_MINES) {
      const id = mineSlug(seed.mine_name);
      if (have.has(id)) continue;
      await fbUpsertInto('mines', {
        id,
        mine_name: seed.mine_name,
        mine_code: seed.mine_code,
        company: seed.company ?? 'Coal India Limited',
        subsidiary: seed.subsidiary,
        state: seed.state,
        district: seed.district,
        location: seed.location,
        latitude: seed.latitude,
        longitude: seed.longitude,
        mine_type: seed.mine_type,
        status: seed.status,
        created_at: now,
        updated_at: now,
      }).run();
    }
    minesListCache = null; // drop any pre-seed read so callers see freshly written docs
  } catch {
    // User's role cannot write mines (or read failed) — best-effort only.
  } finally {
    minesSeedAttempted = true;
  }
}