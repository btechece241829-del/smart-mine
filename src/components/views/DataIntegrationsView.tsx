import React, { useState, useEffect, useCallback } from 'react';
import { AuditLogEntry } from '../../types/minegov';
import {
  fetchMLHealth, fetchMLRiskScores, fetchAnomalies, uploadDatasetForML,
  MineRiskResult, MLHealthStatus, AnomalyResult, UploadResult
} from '../../services/mlClient';
import { Database, Upload, Cpu, AlertTriangle, TrendingUp, RefreshCw, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Risk3DVisualization } from '../visualizations/Risk3DVisualization';
import { Anomaly3DVisualization } from '../visualizations/Anomaly3DVisualization';
import { Box } from 'lucide-react';

interface DataIntegrationsViewProps {
  logs: AuditLogEntry[];
}

type MLTab = 'predictions' | 'anomalies' | 'upload' | 'audit';

export const DataIntegrationsView: React.FC<DataIntegrationsViewProps> = ({ logs }) => {
  const [activeTab, setActiveTab] = useState<MLTab>('predictions');
  const [mlStatus, setMlStatus] = useState<MLHealthStatus | null>(null);
  const [riskScores, setRiskScores] = useState<MineRiskResult[]>([]);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<'sensor' | 'environment'>('sensor');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  const loadRiskScores = useCallback(async () => {
    setLoading(true);
    const r = await fetchMLRiskScores();
    if (r) setRiskScores(r.mines);
    setLoading(false);
  }, []);

  const loadAnomalies = useCallback(async () => {
    setLoading(true);
    const a = await fetchAnomalies(selectedDataset);
    setAnomalyResult(a);
    setLoading(false);
  }, [selectedDataset]);

  useEffect(() => {
    fetchMLHealth().then(h => setMlStatus(h));
    loadRiskScores();
  }, [loadRiskScores]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setLoading(true);
    const res = await uploadDatasetForML(uploadFile);
    setUploadResult(res);
    setLoading(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return;
    setUploadFile(file);
    setLoading(true);
    const res = await uploadDatasetForML(file);
    setUploadResult(res);
    setLoading(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadResult(null);
    setIsDragOver(false);
  };

  const riskChartData = riskScores.map(r => ({
    name: r.mine_name.length > 18 ? r.mine_name.substring(0, 16) + '...' : r.mine_name,
    risk: r.overall_risk,
    band: r.risk_band,
  }));

  const filteredLogs = logs.filter(l =>
    l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Cpu className="w-6 h-6 text-copper-light" />
            AI/ML Analytics & Data Integrations
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Python-powered IsolationForest anomaly detection, composite risk scoring, user CSV dataset upload, and governance audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mlStatus && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              mlStatus.sklearn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              ML Backend: {mlStatus.sklearn ? 'IsolationForest' : 'Z-Score'} ACTIVE
            </span>
          )}
          <button onClick={loadRiskScores} className="p-1.5 rounded bg-carbon-800 border border-carbon-700 text-warm-sand hover:text-copper-light transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-carbon-700 pb-2 flex-wrap">
        {([
          { id: 'predictions' as MLTab, label: 'ML Risk Predictions', icon: TrendingUp },
          { id: 'anomalies' as MLTab, label: 'Anomaly Detection', icon: AlertTriangle },
          { id: 'upload' as MLTab, label: 'Dataset Upload', icon: Upload },
          { id: 'audit' as MLTab, label: 'Audit Trail', icon: Database },
        ]).map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'anomalies') loadAnomalies(); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === tab.id ? 'bg-copper text-white shadow-copper-glow' : 'bg-carbon-850 text-warm-sand hover:bg-carbon-800'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: ML Risk Predictions */}
      {activeTab === 'predictions' && (
        <div className="space-y-4">
          {loading && <div className="text-xs text-warm-slate font-mono">Loading ML predictions...</div>}
          <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-warm-pale">Composite Risk Score per Mine (ML Pipeline)</h3>
              <div className="flex items-center gap-1 bg-carbon-900 rounded-lg p-0.5 border border-carbon-700">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all ${viewMode === '3d' ? 'bg-copper text-white shadow-copper-glow' : 'text-warm-slate hover:text-warm-sand'}`}
                >
                  <Box className="w-3 h-3" /> 3D View
                </button>
                <button
                  onClick={() => setViewMode('2d')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${viewMode === '2d' ? 'bg-copper text-white shadow-copper-glow' : 'text-warm-slate hover:text-warm-sand'}`}
                >
                  2D Chart
                </button>
              </div>
            </div>
            {viewMode === '3d' ? (
              <Risk3DVisualization mines={riskScores} />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
                    <XAxis dataKey="name" stroke="#727976" fontSize={10} angle={-30} textAnchor="end" height={60} />
                    <YAxis stroke="#727976" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#17100E', borderColor: 'rgba(212,180,163,0.3)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="risk" radius={[4, 4, 0, 0]} fill="#9E5839" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
            <h3 className="text-sm font-bold text-warm-pale mb-3">ML Risk Breakdown ({riskScores.length} mines)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                  <tr>
                    <th className="p-2.5">Mine</th><th className="p-2.5">Overall</th><th className="p-2.5">Band</th>
                    <th className="p-2.5">Safety</th><th className="p-2.5">Compliance</th><th className="p-2.5">Env</th>
                    <th className="p-2.5">Equipment</th><th className="p-2.5">Contractor</th><th className="p-2.5">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-800">
                  {riskScores.map(r => (
                    <tr key={r.mine_id} className="hover:bg-carbon-800/80">
                      <td className="p-2.5 font-medium text-warm-pale"><div>{r.mine_name}</div><div className="text-[10px] font-mono text-warm-slate">{r.mine_id}</div></td>
                      <td className="p-2.5 font-mono font-bold text-white">{r.overall_risk}</td>
                      <td className="p-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        r.risk_band === 'Critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        r.risk_band === 'High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        r.risk_band === 'Moderate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>{r.risk_band}</span></td>
                      <td className="p-2.5 font-mono text-copper-light">{r.safety_risk}</td>
                      <td className="p-2.5 font-mono">{r.compliance_risk}</td>
                      <td className="p-2.5 font-mono">{r.environment_risk}</td>
                      <td className="p-2.5 font-mono">{r.equipment_risk}</td>
                      <td className="p-2.5 font-mono">{r.contractor_risk}</td>
                      <td className="p-2.5 font-mono">{r.operations_risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Anomaly Detection */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex flex-wrap items-center gap-4">
            <span className="text-xs text-warm-slate">Dataset:</span>
            <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value as any)}
              className="bg-carbon-900 border border-carbon-700 rounded px-2 py-1 text-xs text-warm-sand outline-none font-mono">
              <option value="sensor">IoT Sensor Telemetry</option>
              <option value="environment">Environment Readings</option>
            </select>
            <button onClick={loadAnomalies}
              className="px-3 py-1.5 bg-copper hover:bg-copper-dark text-white rounded-lg text-xs font-semibold shadow-copper-glow transition-all">
              Run ML Anomaly Detection
            </button>
            {anomalyResult && (
              <span className="text-xs font-mono text-warm-slate">
                <span className="text-rose-400 font-bold">{anomalyResult.anomaly_count}</span> anomalies in <span className="text-white font-bold">{anomalyResult.total}</span> rows
              </span>
            )}
          </div>
          {anomalyResult && (
            <>
              {/* 3D Anomaly Scatter Plot */}
              <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> IsolationForest Anomaly — 3D Scatter Plot
                  </h3>
                  <div className="flex items-center gap-1 bg-carbon-900 rounded-lg p-0.5 border border-carbon-700">
                    <button
                      onClick={() => setViewMode('3d')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all ${viewMode === '3d' ? 'bg-copper text-white shadow-copper-glow' : 'text-warm-slate hover:text-warm-sand'}`}
                    >
                      <Box className="w-3 h-3" /> 3D View
                    </button>
                    <button
                      onClick={() => setViewMode('2d')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${viewMode === '2d' ? 'bg-copper text-white shadow-copper-glow' : 'text-warm-slate hover:text-warm-sand'}`}
                    >
                      Table
                    </button>
                  </div>
                </div>
                {viewMode === '3d' ? (
                  <Anomaly3DVisualization
                    detections={anomalyResult.detections}
                    totalCount={anomalyResult.total}
                    anomalyCount={anomalyResult.anomaly_count}
                  />
                ) : (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700 sticky top-0">
                        <tr><th className="p-2.5">Row</th><th className="p-2.5">Status</th><th className="p-2.5">Score</th></tr>
                      </thead>
                      <tbody className="divide-y divide-carbon-800">
                        {anomalyResult.detections.filter(d => d.is_anomaly).slice(0, 200).map(d => (
                          <tr key={d.index} className="hover:bg-carbon-800/80">
                            <td className="p-2.5 font-mono text-warm-slate">Row {d.index + 1}</td>
                            <td className="p-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ANOMALY</span></td>
                            <td className="p-2.5 font-mono font-bold text-white">{d.anomaly_score.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Anomaly Score Distribution Chart */}
              <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
                <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-copper-light" /> Anomaly Score Distribution
                </h3>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const buckets = [
                        { range: '0.0-0.2', low: 0, high: 0 },
                        { range: '0.2-0.4', low: 0, high: 0 },
                        { range: '0.4-0.6', low: 0, high: 0 },
                        { range: '0.6-0.8', low: 0, high: 0 },
                        { range: '0.8-1.0', low: 0, high: 0 },
                      ];
                      anomalyResult.detections.forEach(d => {
                        const idx = Math.min(Math.floor(d.anomaly_score / 0.2), 4);
                        if (d.is_anomaly) buckets[idx].high++;
                        else buckets[idx].low++;
                      });
                      return buckets;
                    })()}>
                      <XAxis dataKey="range" stroke="#727976" fontSize={9} />
                      <YAxis stroke="#727976" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#17100E', borderColor: 'rgba(212,180,163,0.3)', borderRadius: '8px', fontSize: '11px' }} />
                      <Bar dataKey="low" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} name="Normal" />
                      <Bar dataKey="high" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Anomaly" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-warm-slate">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Normal</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Anomaly</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Dataset Upload — Drag & Drop */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div
            className={`relative bg-carbon-850 rounded-xl border-2 border-dashed shadow-panel transition-all duration-300 overflow-hidden ${
              isDragOver ? 'border-copper-light bg-copper/5 scale-[1.01]' : uploadResult ? 'border-emerald-500/50' : 'border-carbon-600 hover:border-copper/60'
            }`}
            onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            {isDragOver && <div className="absolute inset-0 pointer-events-none"><div className="absolute inset-0 bg-gradient-to-br from-copper/5 via-transparent to-copper-light/5 animate-pulse" /></div>}
            <div className="relative p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-warm-pale flex items-center gap-2">
                  <Upload className="w-4 h-4 text-copper-light" /> Upload Your CSV Dataset for ML Analysis
                </h3>
                {uploadResult && (
                  <button onClick={resetUpload} className="px-3 py-1.5 bg-carbon-900 hover:bg-carbon-800 border border-carbon-700 rounded-lg text-xs text-warm-sand font-semibold transition-all flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" /> Upload Another
                  </button>
                )}
              </div>
              <div className={`relative flex flex-col items-center justify-center py-12 px-6 rounded-lg border transition-all duration-300 ${isDragOver ? 'border-copper-light/60 bg-copper/5' : uploadFile && !uploadResult ? 'border-copper/40 bg-copper/5' : 'border-carbon-700/60 bg-carbon-900/50'}`}>
                {loading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-carbon-700" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-copper-light animate-spin" />
                      <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-copper animate-spin" style={{ animationDuration: '1.5s' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-warm-pale">Processing ML Analysis...</p>
                      <p className="text-xs text-warm-slate mt-1">IsolationForest analyzing {uploadFile?.name}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`mb-4 transition-all duration-300 ${isDragOver ? 'scale-110' : ''}`}>
                      {uploadResult ? (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><CheckCircle className="w-8 h-8 text-emerald-400" /></div>
                      ) : isDragOver ? (
                        <div className="w-16 h-16 rounded-2xl bg-copper/15 border border-copper/40 flex items-center justify-center animate-bounce"><FileSpreadsheet className="w-8 h-8 text-copper-light" /></div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-carbon-800 border border-carbon-700 flex items-center justify-center"><FileSpreadsheet className="w-8 h-8 text-carbon-500" /></div>
                      )}
                    </div>
                    {uploadResult ? (
                      <div className="text-center">
                        <p className="text-sm font-bold text-emerald-400">Analysis Complete</p>
                        <p className="text-xs text-warm-slate mt-1">{uploadResult.filename} — {uploadResult.rows.toLocaleString()} rows processed</p>
                      </div>
                    ) : isDragOver ? (
                      <div className="text-center">
                        <p className="text-sm font-bold text-copper-light">Drop your CSV file here</p>
                        <p className="text-xs text-copper/70 mt-1">Release to start ML analysis</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-bold text-warm-pale">Drag & drop your CSV file here</p>
                        <p className="text-xs text-warm-slate mt-1">The Python ML backend will auto-detect numeric columns and run IsolationForest anomaly detection</p>
                        <div className="mt-4 flex items-center gap-2 justify-center">
                          <label className="px-4 py-2 bg-copper hover:bg-copper-dark text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-2">
                            <Upload className="w-3.5 h-3.5" /> Browse Files
                            <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                          </label>
                          <span className="text-[10px] text-carbon-500 font-mono">.csv only</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {!uploadResult && !loading && (
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-carbon-500 font-mono">
                  <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Accepts: sensor readings, equipment logs, environment data, worker records, compliance data, or any structured CSV</span>
                </div>
              )}
            </div>
          </div>

          {uploadResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center shadow-panel">
                  <div className="text-2xl font-bold font-mono text-white">{uploadResult.rows.toLocaleString()}</div>
                  <div className="text-[10px] text-warm-slate mt-0.5 uppercase tracking-wider">Rows</div>
                </div>
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center shadow-panel">
                  <div className="text-2xl font-bold font-mono text-copper-light">{uploadResult.columns.length}</div>
                  <div className="text-[10px] text-warm-slate mt-0.5 uppercase tracking-wider">Columns</div>
                </div>
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center shadow-panel">
                  <div className={`text-2xl font-bold font-mono ${uploadResult.anomaly_count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{uploadResult.anomaly_count}</div>
                  <div className="text-[10px] text-warm-slate mt-0.5 uppercase tracking-wider">Anomalies</div>
                </div>
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center shadow-panel">
                  <div className="text-2xl font-bold font-mono text-emerald-400">{uploadResult.numeric.length}</div>
                  <div className="text-[10px] text-warm-slate mt-0.5 uppercase tracking-wider">Numeric Features</div>
                </div>
              </div>

              {/* Anomaly Score Distribution Chart */}
              {uploadResult.anomalies.length > 0 && (
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
                  <h4 className="text-xs font-bold text-warm-pale mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Anomaly Score Distribution
                    <span className="ml-auto text-[10px] font-normal text-warm-slate">{uploadResult.anomaly_count} flagged / {uploadResult.anomalies.length} rows</span>
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={(() => {
                      const buckets: Record<string, { normal: number; anomaly: number }> = {};
                      uploadResult.anomalies.forEach(a => {
                        const bucket = (Math.floor(a.anomaly_score / 0.1) * 0.1).toFixed(1);
                        if (!buckets[bucket]) buckets[bucket] = { normal: 0, anomaly: 0 };
                        if (a.is_anomaly) buckets[bucket].anomaly++; else buckets[bucket].normal++;
                      });
                      return Object.entries(buckets).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([range, counts]) => ({
                        range: parseFloat(range).toFixed(1), normal: counts.normal, anomaly: counts.anomaly,
                      }));
                    })()}>
                      <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#8a8a8a' }} stroke="#333" />
                      <YAxis tick={{ fontSize: 9, fill: '#8a8a8a' }} stroke="#333" />
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #444', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#ccc' }} />
                      <Bar dataKey="normal" stackId="a" fill="#22c55e" fillOpacity={0.7} name="Normal" />
                      <Bar dataKey="anomaly" stackId="a" fill="#f87171" fillOpacity={0.9} name="Anomaly" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Column Tags */}
              <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
                <h4 className="text-xs font-bold text-warm-pale mb-2 uppercase tracking-wider">Detected Columns ({uploadResult.columns.length})</h4>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {uploadResult.columns.map(col => (
                    <span key={col} className={`px-2 py-0.5 rounded text-[10px] font-mono border ${uploadResult.numeric.includes(col) ? 'bg-copper/10 text-copper-light border-copper/30' : 'bg-carbon-900 text-warm-slate border-carbon-700'}`}>
                      {col}{uploadResult.numeric.includes(col) && <span className="ml-1 text-[8px] opacity-60">#</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Summary Statistics Table */}
              {Object.keys(uploadResult.stats).length > 0 && (
                <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
                  <h4 className="text-xs font-bold text-warm-pale mb-3 uppercase tracking-wider">Summary Statistics</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                        <tr><th className="p-2.5">Column</th><th className="p-2.5 text-right">Mean</th><th className="p-2.5 text-right">Std Dev</th><th className="p-2.5 text-right">Min</th><th className="p-2.5 text-right">Max</th><th className="p-2.5 text-right">Range</th></tr>
                      </thead>
                      <tbody className="divide-y divide-carbon-800">
                        {Object.entries(uploadResult.stats).map(([col, s]) => (
                          <tr key={col} className="hover:bg-carbon-800/80">
                            <td className="p-2.5 font-mono font-bold text-copper-light">{col}</td>
                            <td className="p-2.5 font-mono text-right">{s.mean}</td>
                            <td className="p-2.5 font-mono text-right">{s.std}</td>
                            <td className="p-2.5 font-mono text-right text-sky-400">{s.min}</td>
                            <td className="p-2.5 font-mono text-right text-rose-400">{s.max}</td>
                            <td className="p-2.5 font-mono text-right text-warm-slate">{(s.max - s.min).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Anomaly Detail Table */}
              {uploadResult.anomaly_count > 0 && (
                <div className="bg-carbon-850 p-4 rounded-xl border border-rose-500/30 shadow-panel">
                  <h4 className="text-xs font-bold text-warm-pale mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Detected Anomalies ({uploadResult.anomaly_count} of {uploadResult.anomalies.length})
                  </h4>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700 sticky top-0">
                        <tr><th className="p-2.5">#</th><th className="p-2.5">Row Index</th><th className="p-2.5 text-right">Anomaly Score</th><th className="p-2.5">Severity</th></tr>
                      </thead>
                      <tbody className="divide-y divide-carbon-800">
                        {uploadResult.anomalies.filter(a => a.is_anomaly).sort((a, b) => b.anomaly_score - a.anomaly_score).slice(0, 50).map((a, i) => (
                          <tr key={i} className="hover:bg-rose-500/5">
                            <td className="p-2.5 font-mono text-warm-slate">{i + 1}</td>
                            <td className="p-2.5 font-mono text-copper-light">Row {a.index}</td>
                            <td className="p-2.5 font-mono text-right">
                              <span className={`font-bold ${a.anomaly_score >= 0.7 ? 'text-rose-400' : a.anomaly_score >= 0.6 ? 'text-amber-400' : 'text-warm-slate'}`}>{a.anomaly_score.toFixed(4)}</span>
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.anomaly_score >= 0.7 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                {a.anomaly_score >= 0.7 ? 'SEVERE' : 'MODERATE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {uploadResult.anomalies.filter(a => a.is_anomaly).length > 50 && (
                      <p className="text-[10px] text-warm-slate text-center py-2 font-mono">Showing top 50 of {uploadResult.anomaly_count} anomalies (sorted by score)</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel flex items-center justify-between gap-4">
            <input type="text" placeholder="Search audit logs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-carbon-900 border border-carbon-700 rounded px-3 py-1.5 text-xs text-warm-sand outline-none font-mono w-80" />
            <span className="text-xs font-mono text-warm-slate">Total: <span className="text-copper-light font-bold">{logs.length}</span></span>
          </div>
          <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
                  <tr><th className="p-2.5">Timestamp</th><th className="p-2.5">ID</th><th className="p-2.5">Role</th><th className="p-2.5">Action</th><th className="p-2.5">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-carbon-800">
                  {filteredLogs.map(l => (
                    <tr key={l.id} className="hover:bg-carbon-800/80">
                      <td className="p-2.5 font-mono text-warm-slate whitespace-nowrap">{l.timestamp}</td>
                      <td className="p-2.5 font-mono text-copper-light font-bold">{l.id}</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 font-mono text-[10px] text-warm-pale">{l.userRole}</span></td>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">{l.action}</td>
                      <td className="p-2.5 text-warm-sand font-mono text-[11px]">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

