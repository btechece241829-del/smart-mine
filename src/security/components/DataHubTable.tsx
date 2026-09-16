import React from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { Card, SeverityBadge, StatusBadge } from './ui/primitives';
import { CollectionTab } from '../lib/datasetIngestion';

interface Props { activeTab: CollectionTab; items: any[]; onEdit: (item: any) => void; onDelete: (id: string) => void; hideDelete?: boolean; }

export const DataHubTable: React.FC<Props> = ({ activeTab, items, onEdit, onDelete, hideDelete }) => (
  <Card padded={false}>
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-carbon-900 sticky top-0 z-10 border-b border-carbon-700/60 text-warm-slate">
          <tr>
            {activeTab === 'complaints' && (<><th className="text-left px-4 py-3 font-mono">ID</th><th className="text-left px-4 py-3">Title</th><th className="text-center px-4 py-3">Severity</th><th className="text-center px-4 py-3">Status</th><th className="text-left px-4 py-3">Mine</th></>)}
            {activeTab === 'mines' && (<><th className="text-left px-4 py-3 font-mono">Code</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Location</th><th className="text-center px-4 py-3">Type</th><th className="text-center px-4 py-3">Status</th></>)}
            {activeTab === 'inspections' && (<><th className="text-left px-4 py-3 font-mono">ID</th><th className="text-left px-4 py-3">Type</th><th className="text-center px-4 py-3">Score</th><th className="text-center px-4 py-3">Status</th><th className="text-right px-4 py-3">Date</th></>)}
            {activeTab === 'profiles' && (<><th className="text-left px-4 py-3 font-mono">Emp ID</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-center px-4 py-3">Role</th><th className="text-center px-4 py-3">Status</th></>)}
            <th className="text-right px-4 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-carbon-700/40">
          {items.map((item: any) => (
            <tr key={item.id} className="hover:bg-carbon-850/60">
              {activeTab === 'complaints' && (<><td className="px-4 py-3 font-mono text-copper-light font-bold">{item.complaint_number || item.id}</td><td className="px-4 py-3 font-semibold text-warm-pale truncate max-w-xs">{item.title}</td><td className="px-4 py-3 text-center"><SeverityBadge value={item.severity} /></td><td className="px-4 py-3 text-center"><StatusBadge value={item.status} /></td><td className="px-4 py-3 text-warm-slate font-mono text-[11px]">{item.mine_id || '-'}</td></>)}
              {activeTab === 'mines' && (<><td className="px-4 py-3 font-mono text-copper-light font-bold">{item.mine_code}</td><td className="px-4 py-3 font-semibold text-warm-pale">{item.mine_name}</td><td className="px-4 py-3 text-warm-slate">{item.location || item.state}</td><td className="px-4 py-3 text-center font-mono text-[11px]">{item.mine_type}</td><td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400">{item.status}</span></td></>)}
              {activeTab === 'inspections' && (<><td className="px-4 py-3 font-mono text-copper-light font-bold">{item.inspection_number}</td><td className="px-4 py-3 font-semibold text-warm-pale">{item.inspection_type}</td><td className="px-4 py-3 text-center font-mono font-bold text-copper-light">{item.checklist_score_pct}%</td><td className="px-4 py-3 text-center"><StatusBadge value={item.status} /></td><td className="px-4 py-3 text-right text-warm-slate text-[11px]">{item.date}</td></>)}
              {activeTab === 'profiles' && (<><td className="px-4 py-3 font-mono text-copper-light font-bold">{item.employee_id}</td><td className="px-4 py-3 font-semibold text-warm-pale">{item.full_name}</td><td className="px-4 py-3 text-warm-slate">{item.email}</td><td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-mono bg-copper/20 text-copper-light uppercase">{item.role}</span></td><td className="px-4 py-3 text-center"><span className={`text-[10px] font-mono ${item.is_active ? 'text-emerald-400' : 'text-rose-400'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></td></>)}
              <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><button onClick={() => onEdit(item)} className="p-1 text-warm-slate hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>{!hideDelete && <button onClick={() => onDelete(item.id)} className="p-1 text-warm-slate hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
