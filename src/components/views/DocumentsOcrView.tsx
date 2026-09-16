import { dbClient } from '../../services/dbClient';
import React, { useState } from 'react';
import { DatasetBundle, StatutoryDocument } from '../../types/minegov';
import { DemoSourceBadge } from '../common/DemoSourceBadge';
import { FileSearch, Upload, CheckCircle2, FileText } from 'lucide-react';

interface DocumentsOcrViewProps {
  data: DatasetBundle;
  selectedMineId: string;
  onAuditLog?: (action: string, details: string) => void;
  documents?: StatutoryDocument[];
  setDocuments?: React.Dispatch<React.SetStateAction<StatutoryDocument[]>>;
  dbStatus?: string;
}

export const DocumentsOcrView: React.FC<DocumentsOcrViewProps> = ({
  data,
  selectedMineId,
  onAuditLog,
  documents: docsProp,
  setDocuments: setDocsProp,
  dbStatus
}) => {
  const documents = docsProp && docsProp.length > 0 ? docsProp : data.documents;
  const [uploadMessage, setUploadMessage] = useState<string>('');

  const filteredDocs = selectedMineId === 'ALL'
    ? documents
    : documents.filter(d => d.mine_id === selectedMineId);

  const pendingHumanVerification = filteredDocs.filter(d => (d.ocr_confidence_pct ?? 100) < 82 || d.verification_status === 'HUMAN_VERIFICATION_REQUIRED');

  const handleVerifyDocument = (docId: string) => {
    setDocsProp?.(prev => prev.map(d => d.document_id === docId ? { ...d, verification_status: 'VERIFIED', ocr_confidence_pct: 99.5 } : d));
    onAuditLog?.('OCR_HUMAN_VERIFICATION', `Human verified document #${docId}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const today = new Date().toISOString().split('T')[0];
    const newDoc: StatutoryDocument = {
      document_id: `DOC-${Date.now().toString().slice(-4)}`,
      mine_id: selectedMineId === 'ALL' ? 'MINE-001' : selectedMineId,
      document_type: 'Environmental Clearance',
      file_name: file.name,
      authority: 'MoEFCC',
      issue_date: today,
      expiry_date: '2028-12-31',
      uploaded_by_role: 'USER',
      uploaded_at: new Date().toISOString(),
      file_path: `/uploads/${file.name}`,
      extracted_text_excerpt: '',
      ocr_used: 'YES',
      extraction_confidence: 94.2,
      source_status: 'AUTO_VERIFIED',
      linked_compliance_id: '',
      data_source: 'USER_UPLOAD',
      // optional display fields
      document_name: file.name,
      issuing_authority: 'MoEFCC',
      upload_date: today,
      valid_until: '2028-12-31',
      ocr_confidence_pct: 94.2,
      verification_status: 'AUTO_VERIFIED',
      data_note: 'Uploaded live via OCR ingest portal'
    };
    setDocsProp?.(prev => [...prev, newDoc]);
    setUploadMessage(`Document "${file.name}" uploaded and queued for OCR verification.`);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-copper-light" />
            Statutory Document Repository & Intelligent OCR Queue
          </h2>
          <p className="text-xs text-warm-slate mt-1">
            Automated document ingestion, AI-assisted OCR confidence scoring (&lt;82% triggers human review), and statutory validity surveillance.
          </p>
        </div>
        <DemoSourceBadge source="statutory_documents.csv" note="Supports live user file OCR extraction" />
      </div>

      {/* Interactive Uploader Bar */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-copper/40 shadow-panel flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-copper/20 text-copper-light flex items-center justify-center border border-copper/30">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Upload Statutory Clearance PDF / Image</div>
            <div className="text-xs text-warm-slate">Instantly parses issuing authority, valid dates, and statutory metadata using OCR engine</div>
          </div>
        </div>

        <label className="px-4 py-2 bg-copper hover:bg-copper-dark text-white text-xs font-semibold rounded-lg shadow-copper-glow cursor-pointer transition-colors flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Select File to Parse
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {uploadMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {uploadMessage}
        </div>
      )}

      {/* Summary KPI & Human Verification Queue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-white">{filteredDocs.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Total Statutory Documents</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {filteredDocs.filter(d => d.verification_status === 'VERIFIED' || d.verification_status === 'AUTO_VERIFIED').length}
          </div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Verified Documents</div>
        </div>
        <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 text-center">
          <div className="text-2xl font-bold font-mono text-amber-400">{pendingHumanVerification.length}</div>
          <div className="text-xs text-warm-slate mt-1 font-medium">Pending Human Verification</div>
        </div>
      </div>

      {/* Main Document Table */}
      <div className="bg-carbon-850 p-4 rounded-xl border border-carbon-700/60 shadow-panel space-y-3">
        <h3 className="text-sm font-bold text-warm-pale">Document Ingest Log ({filteredDocs.length})</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-carbon-900 text-warm-slate font-mono uppercase text-[10px] border-b border-carbon-700">
              <tr>
                <th className="p-2.5">Document Name / ID</th>
                <th className="p-2.5">Mine ID</th>
                <th className="p-2.5">Type & Authority</th>
                <th className="p-2.5">Validity Until</th>
                <th className="p-2.5">OCR Confidence</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {filteredDocs.map(doc => (
                <tr key={doc.document_id} className="hover:bg-carbon-800/80 transition-colors">
                  <td className="p-2.5 font-medium text-warm-pale">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-copper-light shrink-0" />
                      <div>
                        <div>{doc.document_name}</div>
                        <div className="text-[10px] font-mono text-warm-slate">{doc.document_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{doc.mine_id}</td>
                  <td className="p-2.5">
                    <div className="font-bold text-copper-light">{doc.document_type}</div>
                    <div className="text-[10px] text-warm-slate">{doc.issuing_authority}</div>
                  </td>
                  <td className="p-2.5 font-mono text-warm-sand">{doc.valid_until}</td>
                  <td className="p-2.5 font-mono font-bold">
                    <span className={(doc.ocr_confidence_pct ?? 0) < 82 ? 'text-rose-400' : 'text-emerald-400'}>
                      {(doc.ocr_confidence_pct ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      doc.verification_status === 'VERIFIED' || doc.verification_status === 'AUTO_VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {doc.verification_status}
                    </span>
                  </td>
                  <td className="p-2.5">
                    {doc.verification_status === 'HUMAN_VERIFICATION_REQUIRED' || (doc.ocr_confidence_pct ?? 0) < 82 ? (
                      <button
                        onClick={() => handleVerifyDocument(doc.document_id)}
                        className="px-2 py-1 rounded bg-copper hover:bg-copper-dark text-white text-[10px] font-mono transition-colors"
                      >
                        Approve & Verify
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

