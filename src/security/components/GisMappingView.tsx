// ────────────────────────────────────────────────────────────────
// GisMappingView — ALL-role GIS Map with Realtime Risk Alerts
// Shows mine locations, active risk zones, and live risk broadcasts.
// Super Admin can create risk alerts; all users see them in realtime.
// ────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin, AlertTriangle, Radio, CheckCircle2,
  ChevronDown, ChevronUp, Shield,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { fb, fbInsertInto, fbUpdateOf, fbSubscribe, fbBatchInsert } from '../lib/firebaseDb';
import { ensureMinesSeeded } from '../lib/mines';
import { RiskAlert, RiskLevel, ROLE_LABELS } from '../lib/types';
import { Card, Button, Spinner } from './ui/primitives';
import { TextInput, Select, TextArea, Modal } from './ui/inputs';

// Leaflet default icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Risk level colors
const RISK_COLORS: Record<RiskLevel, { fill: string; stroke: string; glow: string }> = {
  Low:      { fill: '#22C55E', stroke: '#15803D', glow: 'rgba(34,197,94,0.3)' },
  Moderate: { fill: '#F59E0B', stroke: '#B45309', glow: 'rgba(245,158,11,0.3)' },
  High:     { fill: '#F97316', stroke: '#C2410C', glow: 'rgba(249,115,22,0.4)' },
  Critical: { fill: '#EF4444', stroke: '#B91C1C', glow: 'rgba(239,68,68,0.5)' },
};

// Complaint severity -> marker color
const COMPLAINT_COLORS: Record<string, string> = {
  Critical: '#EF4444',
  High: '#F97316',
  Medium: '#F59E0B',
  Low: '#22C55E',
};

const RISK_LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Critical'];
const RISK_CATEGORIES = [
  'Gas Leak', 'Floor Collapse', 'Fire', 'Flooding', 'Structural',
  'Environmental', 'Equipment Failure', 'Roof Fall', 'Blast Risk', 'Other',
];

// Map fly-to controller — ONLY flies when the user explicitly changes the
// target view (clicked a mine, or clicked "All Mines Overview"). The target
// is a stable state object, so ordinary re-renders (loading complaints,
// receiving risk alerts, toggling layers, opening the modal) never move the
// map or undo the user's manual pan/zoom.
const INDIA_CENTER: [number, number] = [22.352, 82.69];

function MapFlyToController({ target }: { target: { center: [number, number]; zoom: number } }) {
  const map = useMap();
  const lastTarget = React.useRef(target);
  React.useEffect(() => {
    if (
      target.center[0] === lastTarget.current.center[0] &&
      target.center[1] === lastTarget.current.center[1] &&
      target.zoom === lastTarget.current.zoom
    ) {
      return; // same view as before — don't disturb what the user is looking at
    }
    lastTarget.current = target;
    map.flyTo(target.center, target.zoom, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// Pulsing risk marker overlay
function PulsingRiskMarker({ alert: a }: { alert: RiskAlert }) {
  const c = RISK_COLORS[a.risk_level] ?? RISK_COLORS.Moderate;
  return (
    <CircleMarker
      center={[a.latitude, a.longitude]}
      radius={a.risk_level === 'Critical' ? 18 : a.risk_level === 'High' ? 14 : 10}
      pathOptions={{
        fillColor: c.fill, color: c.stroke, fillOpacity: 0.35, weight: 2, className: 'risk-pulse',
      }}
    >
      <Popup>
        <div className="p-1 space-y-1 text-xs min-w-[200px]">
          <div className="font-bold text-sm" style={{ color: c.fill }}>{a.risk_level.toUpperCase()} RISK</div>
          <div className="font-semibold">{a.title}</div>
          <div>Mine: {a.mine_name}</div>
          <div>Category: {a.category}</div>
          {a.description && <div className="mt-1">{a.description}</div>}
          <div className="text-[10px] opacity-60 font-mono mt-1">By {a.broadcast_by_name} - {new Date(a.created_at).toLocaleString()}</div>
          <div className="text-[10px] font-mono mt-1">{a.acknowledged_by.length} acknowledged</div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// Risk Alert List Item
const RiskAlertItem: React.FC<{
  alert: RiskAlert;
  currentUserId: string;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  userRole: string | null;
}> = ({ alert: a, currentUserId, onAcknowledge, onDismiss, userRole }) => {
  const c = RISK_COLORS[a.risk_level] ?? RISK_COLORS.Moderate;
  const acknowledged = a.acknowledged_by.includes(currentUserId);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${acknowledged ? 'opacity-60' : ''}`}
      style={{ borderColor: c.stroke + '80', backgroundColor: c.glow.replace('0.3', '0.08') }}
    >
      <div className="flex items-start gap-2">
        <div className="w-3 h-3 rounded-full mt-0.5 shrink-0 animate-pulse" style={{ backgroundColor: c.fill }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold" style={{ color: c.fill }}>{a.risk_level}</span>
            <span className="text-[10px] text-warm-slate font-mono">{a.category}</span>
          </div>
          <div className="text-xs font-semibold text-warm-pale mt-0.5 truncate">{a.title}</div>
          <div className="text-[10px] text-warm-slate font-mono">{a.mine_name}</div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-copper-light hover:underline mt-1 flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1 text-[11px] text-warm-slate">
              {a.description && <div>{a.description}</div>}
              <div>By: {a.broadcast_by_name}</div>
              <div>{new Date(a.created_at).toLocaleString()}</div>
              <div>{a.acknowledged_by.length} acknowledged</div>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            {!acknowledged ? (
              <Button variant="success" onClick={() => onAcknowledge(a.id)} className="text-[10px] px-2 py-1">
                <CheckCircle2 className="w-3 h-3" /> Acknowledge
              </Button>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Acknowledged
              </span>
            )}
            {(userRole === 'super_admin' || a.broadcast_by === currentUserId) && (
              <Button variant="danger" onClick={() => onDismiss(a.id)} className="text-[10px] px-2 py-1">
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// Main GIS Mapping View
export const GisMappingView: React.FC = () => {
  const { profile, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [mines, setMines] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [showComplaints, setShowComplaints] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [selectedMineId, setSelectedMineId] = useState<string>('ALL');
  const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number }>({
    center: INDIA_CENTER,
    zoom: 6,
  });
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(true);

  const loadMines = useCallback(async () => {
    try {
      await ensureMinesSeeded().catch(() => {});
      const { data } = await fb('mines').select('*').order('mine_name').run<any[]>();
      setMines((data ?? []) as any[]);
    } catch (e) {
      console.warn('Failed to load mines:', e);
    }
  }, []);

  const loadComplaints = useCallback(async () => {
    try {
      const { data } = await fb('complaints').select('*').order('reported_at', { ascending: false }).run<any[]>();
      setComplaints(((data ?? []) as any[]).filter((c) => !c.is_archived));
    } catch (e) {
      console.warn('Failed to load complaints:', e);
    }
  }, []);

  // Subscribe to risk_alerts in realtime via Firestore
  useEffect(() => {
    setLoading(true);
    loadMines().then(() => setLoading(false));
    loadComplaints();

    const unsubscribe = fbSubscribe(
      'risk_alerts',
      (docs) => {
        const alerts = (docs as unknown as RiskAlert[]).filter((a) => a.is_active);
        setRiskAlerts(alerts.sort((a, b) => {
          const order: Record<string, number> = { Critical: 0, High: 1, Moderate: 2, Low: 3 };
          return (order[a.risk_level] ?? 9) - (order[b.risk_level] ?? 9);
        }));
      },
      (err) => console.error('Risk alerts subscription error:', err),
    );

    return () => { unsubscribe(); };
  }, [loadMines, loadComplaints]);

  // Refresh mines & complaints on cross-tab localStorage changes
  useEffect(() => {
    const handler = () => { loadMines(); loadComplaints(); };
    window.addEventListener('smartmine_db_change', handler);
    return () => window.removeEventListener('smartmine_db_change', handler);
  }, [loadMines, loadComplaints]);

  const handleAcknowledge = async (alertId: string) => {
    if (!profile) return;
    const alert = riskAlerts.find((a) => a.id === alertId);
    if (!alert) return;
    const updatedAck = [...alert.acknowledged_by, profile.id];
    await fbUpdateOf('risk_alerts', { acknowledged_by: updatedAck }).eq('id', alertId).run();
  };

  const handleDismiss = async (alertId: string) => {
    await fbUpdateOf('risk_alerts', { is_active: false }).eq('id', alertId).run();
  };

  const visibleAlerts = filterLevel === 'all'
    ? riskAlerts
    : riskAlerts.filter((a) => a.risk_level === filterLevel);

  const minesWithCoords = mines.filter((m: any) => m.latitude && m.longitude);

  // Reported issues plotted on the map — use their own GPS when available,
  // otherwise fall back to the coordinates of the mine they were filed against
  // so a reported zone/location always "locates" on the map.
  const complaintsWithCoords = complaints
    .map((c: any) => {
      if (c.latitude && c.longitude) return { ...c, locatedBy: 'gps' as const };
      const mine = minesWithCoords.find((m: any) => m.id === c.mine_id);
      if (mine) return { ...c, latitude: mine.latitude, longitude: mine.longitude, locatedBy: 'mine' as const };
      return { ...c, latitude: null, longitude: null };
    })
    .filter((c: any) => c.latitude && c.longitude);

  // mapView (state) drives both the MapContainer's initial view and the fly-to
  // controller. It is only changed when the user clicks a mine or
  // "All Mines Overview", so ordinary re-renders never move or zoom the map.

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Loading GIS Map..." />
      </div>
    );
  }


  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <MapPin className="w-6 h-6 text-copper-light" />
            GIS Mapping & Risk Monitoring
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Real-time geospatial view of all mine locations with live risk alert broadcasting.
            {isSuperAdmin && ' Click "Broadcast Risk" to alert all users instantly.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {riskAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="text-xs font-bold text-rose-400">
                {riskAlerts.length} Active Risk{riskAlerts.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {isSuperAdmin && (
            <Button variant="danger" onClick={() => setShowBroadcastModal(true)}>
              <AlertTriangle className="w-4 h-4" /> Broadcast Risk
            </Button>
          )}
        </div>
      </div>

      {/* Main layout: Sidebar + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: '600px' }}>
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <Card title="Mine Selector" subtitle={`${minesWithCoords.length} mines · ${complaintsWithCoords.length} reported issues on map`}>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              <button
                onClick={() => { setSelectedMineId('ALL'); setMapView({ center: INDIA_CENTER, zoom: 6 }); }}
                className={`w-full text-left p-2 rounded-lg border text-xs font-medium transition-colors ${
                  selectedMineId === 'ALL'
                    ? 'bg-copper text-white border-copper shadow-copper-glow'
                    : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
                }`}
              >
                All Mines Overview
              </button>
              {minesWithCoords.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMineId(m.id); setMapView({ center: [m.latitude, m.longitude], zoom: 12 }); }}
                  className={`w-full text-left p-2 rounded-lg border text-xs font-medium transition-colors ${
                    selectedMineId === m.id
                      ? 'bg-copper text-white border-copper shadow-copper-glow'
                      : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
                  }`}
                >
                  <div className="font-bold truncate">{m.mine_name}</div>
                  <div className="text-[10px] font-mono opacity-70">{m.mine_code || m.id}</div>
                </button>
              ))}
              {minesWithCoords.length === 0 && (
                <p className="text-[11px] text-warm-slate text-center py-2">
                  No mines with GPS coordinates. Add mines via Data Hub.
                </p>
              )}
            </div>
          </Card>


          <Card title="Risk Filter">
            <div className="space-y-1.5">
              <button
                onClick={() => setFilterLevel('all')}
                className={`w-full text-left p-2 rounded-lg border text-xs font-medium transition-colors ${
                  filterLevel === 'all'
                    ? 'bg-carbon-700 text-white border-carbon-600'
                    : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
                }`}
              >
                All Levels ({riskAlerts.length})
              </button>
              {RISK_LEVELS.map((level) => {
                const rc = RISK_COLORS[level];
                const count = riskAlerts.filter((a) => a.risk_level === level).length;
                return (
                  <button
                    key={level}
                    onClick={() => setFilterLevel(level)}
                    className={`w-full text-left p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${
                      filterLevel === level
                        ? 'bg-carbon-700 text-white border-carbon-600'
                        : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rc.fill }} />
                    {level} ({count})
                  </button>
                );
              })}
            </div>
          </Card>

          <Card
            title="Active Risk Alerts"
            actions={
              <button onClick={() => setAlertsPanelOpen(!alertsPanelOpen)} className="text-warm-slate hover:text-warm-pale">
                {alertsPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            }
          >
            {alertsPanelOpen && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {visibleAlerts.length === 0 && (
                  <div className="text-center py-4">
                    <Shield className="w-6 h-6 text-emerald-500/50 mx-auto mb-1" />
                    <p className="text-[11px] text-warm-slate">
                      {filterLevel === 'all' ? 'No active risk alerts' : `No ${filterLevel} risks`}
                    </p>
                  </div>
                )}
                {visibleAlerts.map((a) => (
                  <RiskAlertItem
                    key={a.id}
                    alert={a}
                    currentUserId={profile?.id ?? ''}
                    onAcknowledge={handleAcknowledge}
                    onDismiss={handleDismiss}
                    userRole={role}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>


        {/* Right: GIS Map */}
        <div className="lg:col-span-3">
          <div className="relative z-0 rounded-xl overflow-hidden border border-carbon-700 shadow-panel bg-carbon-900" style={{ height: '600px' }}>
            <div className="absolute top-3 right-3 z-[1000] bg-carbon-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-carbon-700/80 shadow-2xl flex items-center gap-2 text-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">LIVE</span>
              <span className="text-warm-slate font-mono">{riskAlerts.length} risk{riskAlerts.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Layer toggle */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-carbon-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-carbon-700/80 shadow-2xl flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-warm-pale font-medium">
                <input
                  type="checkbox"
                  checked={showComplaints}
                  onChange={(e) => setShowComplaints(e.target.checked)}
                  className="accent-copper"
                />
                Issues ({complaintsWithCoords.length})
              </label>
              <span className="text-[10px] font-mono text-warm-slate">Mines & Risk Alerts always shown</span>
            </div>

            <MapContainer center={mapView.center} zoom={mapView.zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} zoomControl={true}>
              <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapFlyToController target={mapView} />

              {minesWithCoords.map((mine: any) => {
                const hasRisk = visibleAlerts.some((a) => a.mine_name === mine.mine_name);
                return (
                  <CircleMarker
                    key={mine.id}
                    center={[mine.latitude, mine.longitude]}
                    radius={hasRisk ? 10 : 7}
                    pathOptions={{
                      fillColor: hasRisk ? '#F59E0B' : '#C87A4D',
                      color: hasRisk ? '#B45309' : '#9B6B4A',
                      fillOpacity: 0.85,
                      weight: hasRisk ? 2 : 1,
                    }}
                  >
                    <Popup>
                      <div className="p-1 space-y-1 text-xs min-w-[180px]">
                        <div className="font-bold" style={{ color: hasRisk ? '#F59E0B' : '#C87A4D' }}>{mine.mine_name}</div>
                        <div>{mine.mine_code || mine.id}</div>
                        <div>{mine.location || ''} {mine.state || ''}</div>
                        <div>Type: {mine.mine_type || 'N/A'} | Status: {mine.status || 'N/A'}</div>
                        <div className="text-[10px] font-mono opacity-60">{mine.latitude.toFixed(4)}, {mine.longitude.toFixed(4)}</div>
                        {hasRisk && <div className="mt-1 text-amber-400 font-bold text-[10px]">ACTIVE RISK ALERT(S)</div>}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {visibleAlerts.map((a) => (
                <PulsingRiskMarker key={a.id} alert={a} />
              ))}

              {showComplaints && complaintsWithCoords.map((c: any) => {
                const cc = COMPLAINT_COLORS[c.severity] ?? COMPLAINT_COLORS.Medium;
                return (
                  <CircleMarker
                    key={c.id ?? c.complaint_number}
                    center={[c.latitude, c.longitude]}
                    radius={c.severity === 'Critical' ? 7 : 5}
                    pathOptions={{ fillColor: cc, color: '#78350F', fillOpacity: 0.9, weight: 1.5 }}
                  >
                    <Popup>
                      <div className="p-1 space-y-1 text-xs min-w-[200px]">
                        <div className="font-bold text-warm-pale">{c.title}</div>
                        <div className="font-mono text-copper-light font-semibold">{c.complaint_number}</div>
                        <div>Category: {c.category} | Severity: <span style={{ color: cc }}>{c.severity}</span></div>
                        <div>Zone / Location: <span className="text-warm-sand font-medium">{c.location || '—'}</span></div>
                        <div>Status: {c.status}</div>
                        <div>Reported by {c.reported_by_name} · {c.reported_at ? new Date(c.reported_at).toLocaleString() : ''}</div>
                        {c.locatedBy === 'mine' && (
                          <div className="text-[10px] text-warm-slate/80 italic">Positioned at its mine's coordinates (no GPS in report)</div>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <BroadcastRiskModal open={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} mines={minesWithCoords} profile={profile} />
      )}
    </div>
  );
};


// Broadcast Risk Modal (Super Admin)
const BroadcastRiskModal: React.FC<{
  open: boolean;
  onClose: () => void;
  mines: any[];
  profile: any;
}> = ({ open, onClose, mines, profile }) => {
  const [mineId, setMineId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('High');
  const [category, setCategory] = useState('Gas Leak');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selectedMine = mines.find((m) => m.id === mineId);

  const handleBroadcast = async () => {
    if (!selectedMine || !title.trim() || !profile) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await fbInsertInto('risk_alerts', {
        mine_id: selectedMine.id,
        mine_name: selectedMine.mine_name,
        latitude: selectedMine.latitude,
        longitude: selectedMine.longitude,
        risk_level: riskLevel,
        title: title.trim(),
        description: description.trim() || null,
        category,
        broadcast_by: profile.id,
        broadcast_by_name: profile.full_name,
        is_active: true,
        acknowledged_by: [],
        created_at: now,
        updated_at: now,
        expires_at: null,
      }).run();

      // Notify ALL active users — including the broadcaster — so everyone sees
      // the risk and who raised it in the notification panel.
      try {
        const { data: profiles } = await fb('profiles').select('id, is_active')
          .eq('is_active', true).run<any[]>();
        const activeUserIds = ((profiles ?? []) as any[]).map((p: any) => p.id);
        const notifRows = activeUserIds.map((uid: string) => ({
          user_id: uid,
          title: `${riskLevel.toUpperCase()} RISK ALERT: ${selectedMine.mine_name}`,
          body: `${title.trim()} · ${category} · ${selectedMine.location || selectedMine.state || 'Mine site'}. Broadcast by ${profile.full_name} (${ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role ?? 'User'}). Acknowledge it on the GIS map.`,
          severity: riskLevel,
          action_required: 'Acknowledge the active risk alert on the GIS map.',
          is_read: false,
          created_at: now,
        }));
        if (notifRows.length > 0) {
          for (let i = 0; i < notifRows.length; i += 50) {
            await fbBatchInsert('notifications', notifRows.slice(i, i + 50));
          }
        }
      } catch (e) { console.warn('Notification broadcast failed:', e); }

      setDone(true);
      setTimeout(() => { setDone(false); setTitle(''); setDescription(''); setMineId(''); onClose(); }, 2000);
    } catch (e) { console.error('Risk broadcast failed:', e); } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Broadcast Risk Alert to All Users" wide>
      {done ? (
        <div className="text-center py-8">
          <Radio className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-pulse" />
          <p className="text-lg font-bold text-emerald-400">Risk Alert Broadcast!</p>
          <p className="text-xs text-warm-slate mt-1">All users see this alert on their GIS map in realtime.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-mono text-warm-slate uppercase mb-1 block">Select Mine *</label>
            <Select value={mineId} onChange={(e) => setMineId(e.target.value)}
              options={[{ value: '', label: '-- Select a mine --' }, ...mines.map((m) => ({ value: m.id, label: `${m.mine_name} (${m.mine_code || m.id})` }))]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-warm-slate uppercase mb-1 block">Risk Level *</label>
              <Select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)} options={RISK_LEVELS.map((l) => ({ value: l, label: l }))} />
            </div>
            <div>
              <label className="text-[11px] font-mono text-warm-slate uppercase mb-1 block">Category *</label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} options={RISK_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono text-warm-slate uppercase mb-1 block">Alert Title *</label>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gas concentration detected in Seam-3" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-warm-slate uppercase mb-1 block">Description</label>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details about the risk..." rows={3} />
          </div>
          {selectedMine && (
            <div className="p-3 bg-carbon-850 rounded-lg border border-carbon-700/60 text-xs space-y-1">
              <div className="font-bold text-copper-light flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Broadcast Target
              </div>
              <div className="text-warm-sand font-mono">
                {selectedMine.mine_name} - ({selectedMine.latitude?.toFixed(4)}, {selectedMine.longitude?.toFixed(4)})
              </div>
              <div className="text-[10px] text-warm-slate">
                This alert appears as a pulsing marker on ALL users maps instantly.
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={handleBroadcast} disabled={!mineId || !title.trim()} loading={saving}>
              <AlertTriangle className="w-4 h-4" /> Broadcast Risk Alert
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

