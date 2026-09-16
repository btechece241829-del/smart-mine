import React from 'react';
import { DatasetBundle } from '../../types/minegov';
import { GISMap } from '../gis/GISMap';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { MapPin, Info } from 'lucide-react';

interface GisViewProps {
  data: DatasetBundle;
  selectedMineId: string;
  onSelectMine: (mineId: string) => void;
}

export const GisView: React.FC<GisViewProps> = ({
  data,
  selectedMineId,
  onSelectMine
}) => {
  const currentMine = data.mines.find(m => m.mine_id === selectedMineId);

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <MapPin className="w-6 h-6 text-copper-light" />
            GIS Multi-Layer Spatial Intelligence
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Real-time geospatial overlay of mine lease boundaries, inspections, statutory violations, incidents, environmental monitoring stations, and heavy equipment assets.
          </p>
        </div>
        <DemoSourceBadge source="mines.csv, inspections.csv, violations.csv, incidents.csv, env_monitoring.csv, equipment.csv" />
      </div>

      {/* Main Grid: Mine Selector & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Sidebar Mine Selector & Metadata */}
        <div className="lg:col-span-1 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-4">
          <h3 className="text-xs font-bold font-mono uppercase text-warm-slate border-b border-carbon-700 pb-2">
            Select Focus Mine ({data.mines.length})
          </h3>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <button
              onClick={() => onSelectMine('ALL')}
              className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                selectedMineId === 'ALL'
                  ? 'bg-copper text-white border-copper shadow-copper-glow'
                  : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
              }`}
            >
              All Mines Fleet View
            </button>
            {data.mines.map(m => (
              <button
                key={m.mine_id}
                onClick={() => onSelectMine(m.mine_id)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  selectedMineId === m.mine_id
                    ? 'bg-copper text-white border-copper shadow-copper-glow'
                    : 'bg-carbon-900 border-carbon-700 text-warm-sand hover:bg-carbon-800'
                }`}
              >
                <div className="font-bold">{m.mine_name}</div>
                <div className="text-[10px] font-mono opacity-80">{m.mine_id} • {m.operational_status}</div>
              </button>
            ))}
          </div>

          {currentMine && (
            <div className="p-3 bg-carbon-900 rounded-lg border border-carbon-700/80 space-y-2 text-xs">
              <div className="font-bold text-copper-light flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Selected Mine Focus
              </div>
              <div className="space-y-1 font-mono text-[11px] text-warm-sand">
                <div><strong>Name:</strong> {currentMine.mine_name}</div>
                <div><strong>Company:</strong> {currentMine.company}</div>
                <div><strong>Subsidiary:</strong> {currentMine.subsidiary}</div>
                <div><strong>Method:</strong> {currentMine.mining_method}</div>
                <div><strong>Capacity:</strong> {currentMine.production_capacity_mtpa} MTPA</div>
                <div><strong>Coordinates:</strong> {currentMine.latitude.toFixed(4)}, {currentMine.longitude.toFixed(4)}</div>
              </div>
            </div>
          )}
        </div>

        {/* GIS Map Canvas (3 cols) */}
        <div className="lg:col-span-3">
          <GISMap
            mines={data.mines}
            inspections={data.inspections}
            violations={data.violations}
            incidents={data.incidents}
            environmentReadings={data.environmentReadings}
            equipment={data.equipment}
            selectedMineId={selectedMineId}
            onSelectMine={onSelectMine}
            height="650px"
          />
        </div>
      </div>
    </div>
  );
};
