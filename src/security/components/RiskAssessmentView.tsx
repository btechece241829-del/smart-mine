// ────────────────────────────────────────────────────────────────
// Risk Assessment View — 4×4 matrix risk evaluation persisted to
// the `risk_assessments` collection. Evaluates a real open hazard
// (complaint) with likelihood × severity and stores the result.
// ────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Save } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { fb, fbInsertInto, fbUpdateOf } from '../lib/firebaseDb';
import { Complaint, RiskAssessment, Severity } from '../lib/types';
import { SEVERITIES } from '../lib/types';
import { riskScore, riskBand, riskBandColor } from '../lib/hazards';
import { Card, Spinner, EmptyState, Button } from './ui/primitives';
import { Select, TextArea } from './ui/inputs';

const LIKELIHOODS = [
  { value: '1', label: '1 — Rare (unlikely in my career)' },
  { value: '2', label: '2 — Unlikely (could happen occasionally)' },
  { value: '3', label: '3 — Possible (could happen anytime)' },
  { value: '4', label: '4 — Almost certain (happens frequently)' },
];

export const RiskAssessmentView: React.FC = () => {
  const { profile, role } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const [complaintId, setComplaintId] = useState('');
  const [likelihood, setLikelihood] = useState('2');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [summary, setSummary] = useState('');
  const [controls, setControls] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canAssess = role === 'safety_officer' || role === 'mine_manager' || role === 'super_admin';

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const list = await complaintsService.list({ mineId: profile.mine_id ?? undefined });
    setComplaints(list.filter((c) => !['Resolved', 'Verified', 'Rejected'].includes(c.status)));
    const { data } = await fb('risk_assessments').select('*').run<RiskAssessment[]>();
    setAssessments(((data ?? []) as RiskAssessment[]).sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const score = riskScore(severity, parseInt(likelihood, 10));
  const band = riskBand(score);

  const handleSave = async () => {
    if (!profile) return;
    if (!complaintId) { setMsg('Select a hazard / complaint to assess.'); return; }
    setSaving(true);
    setMsg(null);
    const complaint = complaints.find((c) => c.id === complaintId);
    const doc: RiskAssessment = {
      id: `ra_${Date.now().toString(36)}`,
      mine_id: complaint?.mine_id ?? profile.mine_id ?? null,
      mine_name: complaint?.mine_name ?? null,
      complaint_id: complaintId,
      complaint_number: complaint?.complaint_number ?? null,
      assessed_by_id: profile?.id ?? '',
      assessed_by_name: profile?.full_name ?? '',
      risk_band: band,
      risk_score: score,
      likelihood: parseInt(likelihood, 10),
      severity,
      findings_summary: summary.trim() || null,
      controls_recommended: controls.trim() || null,
      created_at: new Date().toISOString(),
    };
    await fbInsertInto('risk_assessments', doc).run();
    setMsg('Risk assessment saved.');
    setSummary(''); setControls('');
    setTimeout(() => setMsg(null), 3000);
    await load();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (role !== 'super_admin') return;
    await fbUpdateOf('risk_assessments', { is_deleted: true }).eq('id', id).run();
    await load();
  };

  if (loading) return <Spinner size="lg" label="Loading risk assessments..." />;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-warm-pale">Risk Assessment</h1>
          <p className="text-xs text-warm-slate">Evaluate hazards using the standard severity × likelihood matrix.</p>
        </div>
      </div>

      {!canAssess ? (
        <EmptyState title="Read-only" subtitle="Only Safety Officers, Mine Managers and Super Admins can record risk assessments." />
      ) : (
        <Card title="New Assessment" subtitle={`Score ${score} · ${band} risk`}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Hazard / Complaint *</label>
              <Select
                value={complaintId}
                onChange={(e) => setComplaintId(e.target.value)}
                options={[
                  { value: '', label: '— Select an open hazard —' },
                  ...complaints.map((c) => ({ value: c.id, label: `${c.complaint_number} · ${c.title}` })),
                ]}
              />
              {complaints.length === 0 && <p className="text-[11px] text-amber-400 mt-1">No open hazards found in your scope.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Likelihood</label>
                <Select value={likelihood} onChange={(e) => setLikelihood(e.target.value)} options={LIKELIHOODS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Severity</label>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
              </div>
            </div>

            <div className={`p-3 rounded-lg border text-center ${riskBandColor(band)}`}>
              <div className="text-[11px] font-mono uppercase tracking-wider">Resulting Risk</div>
              <div className="text-lg font-extrabold">{score} — {band}</div>
              {band === 'Critical' && <div className="text-[11px] mt-0.5">Immediate control measures required</div>}
            </div>

            <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Findings summary (what was observed)" />
            <TextArea value={controls} onChange={(e) => setControls(e.target.value)} rows={2} placeholder="Recommended control measures" />

            {msg && <p className="text-xs font-mono text-emerald-300">{msg}</p>}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving...' : 'Save Assessment'}
            </Button>
          </div>
        </Card>
      )}

      <Card title="Assessment History" padded={false}>
        {assessments.length === 0 ? (
          <div className="p-6"><EmptyState title="No assessments yet" subtitle="Saved risk assessments will appear here." /></div>
        ) : (
          <div className="divide-y divide-carbon-700/40">
            {assessments.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${riskBandColor(a.risk_band)}`}>
                      {a.risk_score} · {a.risk_band}
                    </span>
                    <span className="text-xs font-bold text-warm-pale">{a.complaint_number ?? a.complaint_id}</span>
                    {a.mine_name && <span className="text-[10px] text-warm-slate font-mono">{a.mine_name}</span>}
                  </div>
                  {a.findings_summary && <p className="text-xs text-warm-slate mt-1 line-clamp-2">{a.findings_summary}</p>}
                  <div className="text-[10px] font-mono text-warm-slate/50 mt-1">
                    by {a.assessed_by_name} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                {role === 'super_admin' && (
                  <button onClick={() => handleDelete(a.id)} className="text-[10px] text-rose-400 hover:text-rose-300 shrink-0">
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};