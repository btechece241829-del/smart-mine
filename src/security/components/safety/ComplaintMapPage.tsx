// ──────────────────────────────────────────────────────────────────────
// Complaint Map — Leaflet map showing all complaints as circle markers
// colored by severity/status, with filter controls and click-to-open.
// ──────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Layers } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { listComplaints, isOverdue } from '../../lib/complaintModule';
import { Complaint, PRIORITIES } from '../../lib/types';
import { Card, Button, Spinner } from '../ui/primitives';
import { Select } from '../ui/inputs';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f59e0b',
  Medium: '#eab308',
  Low: '#22c55e',
};

interface Props {
  onView: (id: string) => void;
}

function MapBounds({ items }: { items: Complaint[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = items
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => [c.latitude!, c.longitude!] as [number, number]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.15));
  }, [items, map]);
  return null;
}

export const ComplaintMapPage: React.FC<Props> = ({ onView }) => {
  const { profile, role } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [heatmapMode, setHeatmapMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const opts: Parameters<typeof listComplaints>[0] = {};
      if (profile?.mine_id) opts.mineId = profile.mine_id;
      if (role === 'worker') opts.userId = profile?.id ?? '';
      else if (role === 'mining_mate' || role === 'overman') opts.assignedTo = profile?.id ?? '';
      setItems(await listComplaints(opts));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.mine_id, role]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  let visible = items.filter((c) => c.latitude != null && c.longitude != null);
  if (severityFilter) visible = visible.filter((c) => c.severity === severityFilter);
  if (statusFilter) visible = visible.filter((c) => c.status === statusFilter);

  const center: [number, number] = visible.length > 0 && visible[0].latitude
    ? [visible[0].latitude!, visible[0].longitude!]
    : [23.8739, 86.4374];

  return (
    <div className="max-w-7xl mx-auto space-y-4 p-2">
      <Card title="Complaint Map" icon={<MapPin className="w-4 h-4" />} subtitle={`${visible.length} complaints with GPS · ${items.length} total`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} options={[{ value: '', label: 'All severities' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...['Submitted', 'Acknowledged', 'Under Investigation', 'Action Assigned', 'Action In Progress', 'Verification', 'Resolved', 'Closed', 'Escalated'].map((s) => ({ value: s, label: s })),
            ]}
          />
          <Button variant={heatmapMode ? 'primary' : 'ghost'} onClick={() => setHeatmapMode(!heatmapMode)}><Layers className="w-3.5 h-3.5" />{heatmapMode ? 'Heatmap on' : 'Heatmap off'}</Button>
          <div className="flex items-center gap-2 ml-2">
            {Object.entries(SEVERITY_COLOR).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-warm-slate">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" label="Loading map…" /></div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-warm-slate text-sm">No complaints with GPS coordinates found.</div>
        ) : (
          <div className="h-[600px] rounded-lg overflow-hidden border border-carbon-700 relative z-0">
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%', background: '#1b1714' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <MapBounds items={visible} />
              {visible.map((c) => {
                const color = SEVERITY_COLOR[c.severity] ?? '#94a3b8';
                const clusterCount = visible.filter(
                  (x) => x.latitude != null && c.latitude != null && Math.abs(x.latitude - c.latitude) < 0.01
                    && x.longitude != null && c.longitude != null && Math.abs(x.longitude - c.longitude) < 0.01
                ).length;
                const r = heatmapMode ? Math.max(8, Math.min(30, clusterCount * 3)) : 8;
                return (
                  <CircleMarker
                    key={c.id}
                    center={[c.latitude!, c.longitude!]}
                    radius={r}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: isOverdue(c) ? 3 : 1 }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1 min-w-[180px]">
                        <div className="font-bold text-gray-900">{c.complaint_number}</div>
                        <div className="text-gray-700">{c.title}</div>
                        <div><span className="font-semibold">Status:</span> {c.status}</div>
                        <div><span className="font-semibold">Severity:</span> {c.severity}</div>
                        {c.mine_name && <div><span className="font-semibold">Mine:</span> {c.mine_name}</div>}
                        <button className="text-blue-600 underline mt-1" onClick={() => onView(c.id)}>Open detail →</button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </Card>
    </div>
  );
};