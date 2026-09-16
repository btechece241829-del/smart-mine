import React, { useState, useEffect } from 'react';
import { DatasetBundle, DerivedMineMetrics } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { ShieldAlert, Activity, Cpu, AlertTriangle, Zap, BrainCircuit } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { fetchAnomalies, AnomalyResult } from '../../services/mlClient';

interface SafetyAiViewProps {
  data: DatasetBundle;
  metrics: DerivedMineMetrics[];
  selectedMineId: string;
}

export const SafetyAiView: React.FC<SafetyAiViewProps> = ({
  data,
  metrics,
  selectedMineId
}) => {
  const [selectedSensorStatus, setSelectedSensorStatus] = useState<string>('ALL');
  const [mlAnomalies, setMlAnomalies] = useState<AnomalyResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMlLoading(true);
    fetchAnomalies('sensor', selectedMineId).then(res => {
      if (!cancelled) setMlAnomalies(res);
      if (!cancelled) setMlLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedMineId]);

  const filteredIncidents = selectedMineId === 'ALL'
    ? data.incidents
    : data.incidents.filter(i => i.mine_id === selectedMineId);

  const filteredSensors = selectedMineId === 'ALL'
    ? data.sensorReadings
    : data.sensorReadings.filter(s => s.mine_id === selectedMineId);

  const criticalSensors = filteredSensors.filter(s => s.status === 'CRITICAL');
  const warningSensors = filteredSensors.filter(s => s.status === 'WARNING');

  const sensorDisplayList = filteredSensors.filter(s => {
    if (selectedSensorStatus === 'ALL') return true;
    return s.status === selectedSensorStatus;
  }).slice(0, 50); // Show top 50 for smooth render

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-copper-light" />
            Safety Risk & IoT Sensor Anomaly Intelligence
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Real-time multi-hazard risk engine analyzing incidents, near misses, and 27,648 IoT telemetry sensor streams.
          </p>
        </div>
        <DemoSourceBadge source="incidents.csv, sensor_readings.csv (27,648 telemetry rows)" />
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{filteredIncidents.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Incidents Logged</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{filteredIncidents.filter(i => i.severity === 'FATAL' || i.severity === 'SERIOUS').length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Fatal / Serious Cases</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-rose-400">{criticalSensors.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Critical Telemetry Sensors</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-amber-400">{warningSensors.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Warning Telemetry Sensors</div>
        </div>
      </div>

      {/* Grid: Incident Register & Telemetry Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Incidents Register */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-copper-light" />
            Statutory Incidents & Near Miss Register
          </h3>

          <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
            {filteredIncidents.map(inc => (
              <div key={inc.incident_id} className="p-3 bg-carbon-900 rounded-lg border border-carbon-700 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-copper-light">{inc.incident_type}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    inc.severity === 'FATAL' || inc.severity === 'SERIOUS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    inc.severity === 'REPORTABLE' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {inc.severity}
                  </span>
                </div>
                <div className="text-[10px] text-warm-slate font-mono">
                  ID: {inc.incident_id} • Mine: {inc.mine_id} • Shift: {inc.shift}
                </div>
                <div className="text-warm-sand">
                  <strong>Root Cause:</strong> {inc.root_cause} | <strong>Class:</strong> {inc.accident_classification}
                </div>
                <div className="text-gray-300 bg-carbon-850 p-2 rounded border border-carbon-700/60 text-[11px]">
                  {inc.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Sensor Stream */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
              <Cpu className="w-4 h-4 text-copper-light" />
              Sensor Telemetry Stream
            </h3>
            <select
              value={selectedSensorStatus}
              onChange={(e) => setSelectedSensorStatus(e.target.value)}
              className="bg-carbon-900 border border-carbon-700 rounded px-2 py-1 text-xs text-warm-sand outline-none font-mono"
            >
              <option value="ALL">All Sensors</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="WARNING">Warning Only</option>
              <option value="NORMAL">Normal Only</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {sensorDisplayList.map((s, idx) => (
              <div key={idx} className="p-2.5 bg-carbon-900 rounded-lg border border-carbon-700 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="font-bold text-warm-pale">{s.sensor_id} ({s.sensor_type})</div>
                  <div className="text-[10px] text-warm-slate">Mine: {s.mine_id} • Zone: {s.zone}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-copper-light">{s.value} {s.unit}</div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    s.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                    s.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {s.status} (Score: {(s.anomaly_score * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Python ML Anomaly Detection Panel */}
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-copper-light" />
              Python ML Anomaly Prediction (IsolationForest)
            </h3>
            {mlAnomalies && (
              <span className="text-[10px] font-mono text-warm-slate">
                {mlLoading ? 'Running...' : `${mlAnomalies.anomaly_count} anomalies / ${mlAnomalies.total} rows`}
              </span>
            )}
          </div>
          {mlLoading ? (
            <div className="text-xs text-warm-slate font-mono py-6 text-center">Contacting Python ML server on :5001...</div>
          ) : mlAnomalies && mlAnomalies.total > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-carbon-900 rounded-lg border border-carbon-700 text-center">
                <div className="text-3xl font-bold font-mono text-rose-400">{mlAnomalies.anomaly_count}</div>
                <div className="text-[10px] text-warm-slate font-mono">ML-DETECTED ANOMALIES</div>
              </div>
              <div className="p-3 bg-carbon-900 rounded-lg border border-carbon-700 text-center">
                <div className="text-3xl font-bold font-mono text-emerald-400">{mlAnomalies.total - mlAnomalies.anomaly_count}</div>
                <div className="text-[10px] text-warm-slate font-mono">NORMAL TELEMETRY ROWS</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-warm-slate font-mono py-6 text-center">
              Python ML server unavailable. Start it with: <span className="text-copper-light">python ml_server.py</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

