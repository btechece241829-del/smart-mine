// ────────────────────────────────────────────────────────────────
// Report Issue form — category, severity, GPS, photo/video upload
// ────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { MapPin, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { complaintsService } from '../lib/complaints';
import { fb } from '../lib/firebaseDb';
import { COMPLAINT_CATEGORIES, SEVERITIES, Severity, Mine } from '../lib/types';
import { Card, Button } from './ui/primitives';
import { TextInput, TextArea, Select } from './ui/inputs';

export const ReportIssueForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Safety');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [location, setLocation] = useState('');
  const [selectedMineId, setSelectedMineId] = useState<string>(profile?.mine_id ?? '');
  const [mines, setMines] = useState<Mine[]>([]);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [complaintNumber, setComplaintNumber] = useState<string | null>(null);
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fb('mines')
      .select('*')
      .order('mine_name')
      .run<Mine[]>()
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          const mineArr = data as Mine[];
          setMines(mineArr);
          if (!selectedMineId && mineArr.length > 0) {
            setSelectedMineId(mineArr[0].id);
          }
        }
      });
  }, []);

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported');
      return;
    }
    setGpsStatus('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus(`Got: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => setGpsStatus('Permission denied or unavailable'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      setError('You must be signed in with an assigned role to report an issue.');
      return;
    }
    if (!title.trim()) { setError('Title is required.'); return; }
    if (mines.length > 0 && !selectedMineId) { setError('Please select the mine / colliery where the issue occurred.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      let photoUrl: string | null = null;
      let videoUrl: string | null = null;
      if (photoFile) {
        const uploadPath = `${profile.id}/photo-${Date.now()}-${photoFile.name}`;
        const res = await complaintsService.uploadFile('complaints-photos', uploadPath, photoFile);
        if (res.error) throw new Error(`Photo upload failed: ${res.error}`);
        photoUrl = res.url ?? null;
      }
      if (videoFile) {
        const uploadPath = `${profile.id}/video-${Date.now()}-${videoFile.name}`;
        const res = await complaintsService.uploadFile('complaints-videos', uploadPath, videoFile);
        if (res.error) throw new Error(`Video upload failed: ${res.error}`);
        videoUrl = res.url ?? null;
      }

      const result = await complaintsService.create({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        mine_id: selectedMineId || profile.mine_id || null,
        location: location.trim() || undefined,
        latitude: gps?.lat ?? null,
        longitude: gps?.lng ?? null,
        photo_url: photoUrl,
        video_url: videoUrl,
        reported_by: profile.id,
        reported_by_name: profile.full_name,
        reported_employee_id: profile.employee_id,
        immediateDanger,
      });
      if (result.error) throw new Error(result.error);
      setComplaintNumber(result.complaint?.complaint_number ?? null);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <Card>
        <div className="flex flex-col items-center py-10 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
          <h2 className="text-lg font-bold text-warm-pale">Issue Reported Successfully</h2>
          {complaintNumber && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-sm">
              Complaint #{complaintNumber}
            </div>
          )}
          <p className="text-xs text-warm-slate mt-2 max-w-sm">Your complaint has been submitted and will be reviewed by the appropriate officer. You'll receive notifications as it progresses.</p>
          <Button onClick={onDone} className="mt-6">Back to Dashboard</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-extrabold text-warm-pale">Report a Safety Issue</h1>
      <p className="text-xs text-warm-slate">Fill in the details below. All fields help responders locate and address the issue faster.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Title *</label>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue" />
            </div>

            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Description</label>
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description, conditions, affected area..." rows={4} />
            </div>

            {mines.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Mine / Colliery</label>
                <Select
                  value={selectedMineId}
                  onChange={(e) => setSelectedMineId(e.target.value)}
                  options={mines.map((m) => ({ value: m.id, label: `${m.mine_name} (${m.mine_code || m.id})` }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Category</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Severity</label>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-warm-sand cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={immediateDanger}
                  onChange={(e) => setImmediateDanger(e.target.checked)}
                  className="accent-rose-500 w-4 h-4"
                />
                <span className={immediateDanger ? 'text-rose-400 font-bold' : ''}>Immediate Danger — workers at risk right now</span>
              </label>
              {(severity === 'Critical' || immediateDanger) && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This will be flagged as a <span className="font-bold">critical hazard</span> and auto-escalated.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Location & Evidence">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">Location Description</label>
              <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Shaft 3, Level 2, Near ventilation point" />
            </div>

            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1.5">GPS Coordinates</label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={handleGetGps}>
                  <MapPin className="w-4 h-4" /> Get My Location
                </Button>
                {gpsStatus && <span className="text-[11px] text-warm-slate">{gpsStatus}</span>}
              </div>
              <p className="text-[11px] text-warm-slate/70 mt-1.5">
                The zone / location you enter is plotted on the <span className="text-copper-light font-medium">GIS Mapping</span> map for responders.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Photo</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-850 border border-carbon-700 cursor-pointer hover:bg-carbon-700 text-xs text-warm-sand">
                  <Upload className="w-4 h-4" />
                  {photoFile ? photoFile.name : 'Choose photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1.5">Video</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carbon-850 border border-carbon-700 cursor-pointer hover:bg-carbon-700 text-xs text-warm-sand">
                  <Upload className="w-4 h-4" />
                  {videoFile ? videoFile.name : 'Choose video'}
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
          <Button type="submit" loading={submitting}>
            <Upload className="w-4 h-4" /> Submit Issue
          </Button>
        </div>
      </form>
    </div>
  );
};

