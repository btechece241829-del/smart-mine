import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, HardHat, Loader2, Layers, FlaskConical, ArrowRight } from 'lucide-react';

interface DatasetUploadViewProps {
  /** Invoked with the raw dropped File objects once the user confirms upload. */
  onFilesSelected: (files: File[]) => void;
  /** Invoked to load the bundled sample dataset instead of an upload. */
  onLoadSample: () => void;
  /** True while the parent is parsing + running analysis engines. */
  processing: boolean;
}

export const DatasetUploadView: React.FC<DatasetUploadViewProps> = ({
  onFilesSelected,
  onLoadSample,
  processing,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    setFiles(list);
  }, []);

  /** Recursively gathers CSV files from dropped files AND dropped folders. */
  const gatherFromItems = useCallback(
    async (items: DataTransferItemList | null): Promise<File[]> => {
      if (!items) return [];
      const collected: File[] = [];
      const entryQueue: Array<FileSystemEntry | null> = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) {
            entryQueue.push(entry);
          } else {
            const f = item.getAsFile();
            if (f) collected.push(f);
          }
        }
      }

      const readDir = async (dir: FileSystemDirectoryEntry) => {
        const reader = dir.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          const acc: FileSystemEntry[] = [];
          const readBatch = () => {
            reader.readEntries((batch) => {
              if (batch.length === 0) { resolve(acc); return; }
              acc.push(...batch);
              readBatch();
            }, () => resolve(acc));
          };
          readBatch();
        });
        for (const e of entries) {
          if (e.isDirectory) await readDir(e as FileSystemDirectoryEntry);
          else {
            const file = await new Promise<File | null>((resolve) =>
              (e as FileSystemFileEntry).file(resolve, () => resolve(null))
            );
            if (file) collected.push(file);
          }
        }
      };

      for (const entry of entryQueue) {
        if (entry) await readDir(entry as FileSystemDirectoryEntry);
      }

      return collected;
    },
    []
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      // Prefer recursive folder reading for "drop the entire dataset" scenarios.
      if (e.dataTransfer.items && e.dataTransfer.items.length) {
        const gathered = await gatherFromItems(e.dataTransfer.items);
        if (gathered.length > 0) {
          setFiles(gathered);
          return;
        }
      }
      handleFiles(e.dataTransfer.files);
    },
    [gatherFromItems, handleFiles]
  );

  const matchedCount = files.length;
  const csvCount = files.filter((f) => /\.(csv|txt)$/i.test(f.name)).length;
  const launchEnabled = csvCount > 0 && !processing;

  return (
    <div className="min-h-screen bg-carbon-900 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-copper/20 border border-copper/40 text-copper-light text-[11px] font-mono">
            <HardHat className="w-3.5 h-3.5" /> DATA-ONBOARDING GATE • v1.0 STATUTORY
          </div>
          <h1 className="mt-3 text-3xl font-bold text-white tracking-tight">
            Ingest Your Dataset to Begin Analysis
          </h1>
          <p className="text-sm text-warm-slate mt-2 max-w-2xl mx-auto">
            Drag-and-drop your CSV datasets below. The governance dashboard will parse,
            validate, and run the multi-domain risk engines <span className="text-copper-light font-semibold">only after</span> your data has been ingested.
          </p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-copper bg-copper/10 shadow-copper-glow'
              : 'border-carbon-600 bg-carbon-850 hover:border-copper/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dragActive ? 'bg-copper text-white' : 'bg-copper/20 text-copper-light'}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="text-lg font-bold text-white">
              {dragActive ? 'Release to ingest' : 'Drag & drop the dataset here'}
            </div>
            <div className="text-xs text-warm-slate">
              …or <span className="text-copper-light underline">browse files</span> · CSV / TXT · drop a whole dataset folder
            </div>
          </div>
        </div>

        {/* Sample dataset shortcut */}
        <div className="mt-3 text-center">
          <button
            onClick={onLoadSample}
            className="text-xs text-warm-slate hover:text-copper-light transition-colors underline underline-offset-2"
          >
            No dataset handy? Load the included 13-file sample dataset instead
          </button>
        </div>

        {/* Selected Files Pane */}
        {files.length > 0 && (
          <div className="mt-6 rounded-xl border border-carbon-700 bg-carbon-850 overflow-hidden">
            <div className="px-4 py-2.5 bg-carbon-900 border-b border-carbon-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-warm-sand">
                <Layers className="w-4 h-4 text-copper-light" /> STAGED DATASET FILES ({matchedCount})
              </div>
              <button
                onClick={() => setFiles([])}
                className="text-[11px] text-warm-slate hover:text-rose-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto divide-y divide-carbon-800">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-copper-light shrink-0" />
                    <span className="text-xs font-mono text-warm-pale truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-warm-slate">{(f.size / 1024).toFixed(1)} KB</span>
                    {/\.(csv|txt)$/i.test(f.name) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {csvCount < matchedCount && (
              <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30 text-[11px] text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Non-CSV files will be ignored during parsing.
              </div>
            )}
          </div>
        )}

        {/* Launch CTA */}
        <div className="mt-6">
          <button
            disabled={!launchEnabled}
            onClick={() => launchEnabled && onFilesSelected(files.filter((f) => /\.(csv|txt)$/i.test(f.name)))}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
              launchEnabled
                ? 'bg-copper hover:bg-copper-dark text-white shadow-copper-glow active:scale-[0.99]'
                : 'bg-carbon-800 text-warm-slate/50 cursor-not-allowed'
            }`}
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Parsing {csvCount} files & running risk engines…
              </>
            ) : (
              <>
                <FlaskConical className="w-5 h-5" />
                Analyze Dataset & Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          {!csvCount && (
            <p className="text-center text-[11px] text-warm-slate mt-2">
              Drop at least one CSV file to enable analysis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatasetUploadView;
