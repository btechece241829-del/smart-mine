import React, { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Mine,
  Inspection,
  Violation,
  Incident,
  EnvironmentReading,
  SensorReading,
  Equipment
} from '../../types/minegov';
import { Layers, Upload } from 'lucide-react';
import { DemoSourceBadge } from '../common/DemoSourceBadge';

// Leaflet default icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GISMapProps {
  mines: Mine[];
  inspections?: Inspection[];
  violations?: Violation[];
  incidents?: Incident[];
  environmentReadings?: EnvironmentReading[];
  sensorReadings?: SensorReading[];
  equipment?: Equipment[];
  selectedMineId?: string;
  onSelectMine?: (mineId: string) => void;
  height?: string;
}

// Controller to animate map fly-to
function MapFlyToController({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 12, { duration: 1.2 });
    }
  }, [center, map]);
  return null;
}

export const GISMap: React.FC<GISMapProps> = ({
  mines,
  inspections = [],
  violations = [],
  incidents = [],
  environmentReadings = [],
  sensorReadings = [],
  equipment = [],
  selectedMineId,
  onSelectMine,
  height = '550px'
}) => {
  // Layer visibility toggles
  const [layers, setLayers] = useState({
    mines: true,
    inspections: true,
    violations: true,
    incidents: true,
    environment: true,
    sensors: false,
    equipment: true,
  });

  const [geoJsonData, setGeoJsonData] = useState<any | null>(null);

  // Handle uploaded GeoJSON file
  const handleGeoJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          setGeoJsonData(parsed);
        } catch (err) {
          alert('Invalid GeoJSON file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const selectedMine = mines.find(m => m.mine_id === selectedMineId) || mines[0];
  const centerPos: [number, number] = selectedMine
    ? [selectedMine.latitude, selectedMine.longitude]
    : [22.352, 82.69];

  return (
    <div className="relative rounded-xl overflow-hidden border border-carbon-700 shadow-panel bg-carbon-900" style={{ height }}>
      {/* Top Map Layer Control Bar */}
      <div className="absolute top-3 left-3 z-[1000] bg-carbon-900/90 backdrop-blur-md p-2.5 rounded-lg border border-carbon-700/80 shadow-2xl flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-warm-pale pr-2 border-r border-carbon-700">
          <Layers className="w-4 h-4 text-copper-light" />
          <span>GIS Layers:</span>
        </div>

        <label className="flex items-center gap-1 cursor-pointer text-gray-200">
          <input
            type="checkbox"
            checked={layers.mines}
            onChange={(e) => setLayers({ ...layers, mines: e.target.checked })}
            className="accent-copper"
          />
          <span>Mines ({mines.length})</span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer text-amber-400">
          <input
            type="checkbox"
            checked={layers.inspections}
            onChange={(e) => setLayers({ ...layers, inspections: e.target.checked })}
            className="accent-amber-500"
          />
          <span>Inspections ({inspections.length})</span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer text-orange-400">
          <input
            type="checkbox"
            checked={layers.violations}
            onChange={(e) => setLayers({ ...layers, violations: e.target.checked })}
            className="accent-orange-500"
          />
          <span>Violations ({violations.length})</span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer text-rose-400">
          <input
            type="checkbox"
            checked={layers.incidents}
            onChange={(e) => setLayers({ ...layers, incidents: e.target.checked })}
            className="accent-rose-500"
          />
          <span>Incidents ({incidents.length})</span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer text-emerald-400">
          <input
            type="checkbox"
            checked={layers.environment}
            onChange={(e) => setLayers({ ...layers, environment: e.target.checked })}
            className="accent-emerald-500"
          />
          <span>Environment ({environmentReadings.length})</span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer text-cyan-400">
          <input
            type="checkbox"
            checked={layers.equipment}
            onChange={(e) => setLayers({ ...layers, equipment: e.target.checked })}
            className="accent-cyan-500"
          />
          <span>Equipment ({equipment.length})</span>
        </label>

        {/* Optional GeoJSON Uploader */}
        <label className="flex items-center gap-1.5 px-2 py-1 bg-carbon-800 hover:bg-carbon-700 border border-carbon-700 rounded cursor-pointer text-copper-light">
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Boundary GeoJSON</span>
          <input type="file" accept=".geojson,.json" onChange={handleGeoJsonUpload} className="hidden" />
        </label>
      </div>

      {/* Map Container */}
      <MapContainer
        center={centerPos}
        zoom={10}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <MapFlyToController center={centerPos} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* 1. Mines Layer */}
        {layers.mines &&
          mines.map((mine) => (
            <CircleMarker
              key={mine.mine_id}
              center={[mine.latitude, mine.longitude]}
              radius={mine.mine_id === selectedMineId ? 14 : 10}
              pathOptions={{
                color: mine.mine_id === selectedMineId ? '#9E5839' : '#CD8D66',
                fillColor: mine.operational_status === 'CLOSED' ? '#727976' : '#9E5839',
                fillOpacity: 0.8,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSelectMine?.(mine.mine_id),
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 font-sans">
                  <div className="font-bold text-sm text-copper-light">{mine.mine_name}</div>
                  <div className="text-xs text-warm-sand">ID: {mine.mine_id} | Status: {mine.operational_status}</div>
                  <div className="text-xs">Company: {mine.company} ({mine.subsidiary})</div>
                  <div className="text-xs">Method: {mine.mining_method} | Capacity: {mine.production_capacity_mtpa} MTPA</div>
                  <div className="text-[10px] font-mono text-warm-slate">Coords: {mine.latitude.toFixed(4)}, {mine.longitude.toFixed(4)}</div>
                  <DemoSourceBadge source={mine.data_source} note={mine.data_note} />
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 2. Inspections Layer */}
        {layers.inspections &&
          inspections.map((insp) => (
            <CircleMarker
              key={insp.inspection_id}
              center={[insp.latitude, insp.longitude]}
              radius={5}
              pathOptions={{ fillColor: '#F59E0B', color: '#B45309', fillOpacity: 0.7, weight: 1 }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-amber-400">Inspection {insp.inspection_id}</div>
                  <div>Type: {insp.inspection_type} | Zone: {insp.zone}</div>
                  <div>Checklist Score: {insp.checklist_score_pct}%</div>
                  <div>Summary: {insp.observation_summary}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 3. Violations Layer */}
        {layers.violations &&
          violations.map((vio) => (
            <CircleMarker
              key={vio.violation_id}
              center={[vio.latitude, vio.longitude]}
              radius={6}
              pathOptions={{ fillColor: '#F97316', color: '#C2410C', fillOpacity: 0.8, weight: 1.5 }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-orange-400">Violation: {vio.violation_type}</div>
                  <div>Severity: {vio.severity} | Zone: {vio.zone}</div>
                  <div>Status: {vio.status}</div>
                  <div>Description: {vio.description}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 4. Incidents Layer */}
        {layers.incidents &&
          incidents.map((inc) => (
            <CircleMarker
              key={inc.incident_id}
              center={[inc.latitude, inc.longitude]}
              radius={7}
              pathOptions={{ fillColor: '#EF4444', color: '#B91C1C', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-rose-400">Incident: {inc.incident_type}</div>
                  <div>Severity: {inc.severity} | Classification: {inc.accident_classification}</div>
                  <div>Root Cause: {inc.root_cause}</div>
                  <div>Description: {inc.description}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 5. Environment Layer */}
        {layers.environment &&
          environmentReadings.map((env) => (
            <CircleMarker
              key={env.reading_id}
              center={[env.latitude, env.longitude]}
              radius={5}
              pathOptions={{
                fillColor: env.compliance_status === 'EXCEEDED' ? '#EF4444' : '#10B981',
                color: '#047857',
                fillOpacity: 0.7,
                weight: 1
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-emerald-400">Station {env.station_id}</div>
                  <div>Parameter: {env.parameter} = {env.value} {env.unit}</div>
                  <div>Status: {env.compliance_status} ({env.exceedance_pct}% over limit)</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* 6. Equipment Layer */}
        {layers.equipment &&
          equipment.map((eq) => (
            <CircleMarker
              key={eq.equipment_id}
              center={[eq.latitude, eq.longitude]}
              radius={5}
              pathOptions={{
                fillColor: eq.status === 'BREAKDOWN' ? '#EF4444' : '#06B6D4',
                color: '#0891B2',
                fillOpacity: 0.7,
                weight: 1
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="font-bold text-cyan-400">{eq.equipment_name}</div>
                  <div>Type: {eq.equipment_type} | Status: {eq.status}</div>
                  <div>Health Score: {eq.health_score}% | Breakdown: {eq.breakdown_hours_24h}h</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
};
