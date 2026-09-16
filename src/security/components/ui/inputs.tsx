// ────────────────────────────────────────────────────────────────
// Form inputs & modal
// ────────────────────────────────────────────────────────────────
import React from 'react';
import { X } from 'lucide-react';

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-carbon-900 border border-carbon-700 rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-carbon-700/70">
          <h3 className="text-sm font-bold text-warm-pale uppercase tracking-wide">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-carbon-700 text-warm-slate">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-carbon-850 border border-carbon-700 text-sm text-warm-pale placeholder-warm-slate/60 outline-none focus:border-copper transition-colors ${props.className ?? ''}`}
  />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-carbon-850 border border-carbon-700 text-sm text-warm-pale placeholder-warm-slate/60 outline-none focus:border-copper transition-colors resize-none ${props.className ?? ''}`}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }> = ({ options, className = '', ...props }) => (
  <select
    {...props}
    className={`w-full px-3 py-2 rounded-lg bg-carbon-850 border border-carbon-700 text-sm text-warm-pale outline-none focus:border-copper transition-colors ${className}`}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value} className="bg-carbon-900 text-warm-pale">{o.label}</option>
    ))}
  </select>
);
