import { useEffect, useState } from 'react';
import { clusterLibraryEngine } from '../../kernel/ClusterLibraryEngine';
import type { ClusterLibraryEntry } from '../../kernel/types';

interface ClusterWriterAppProps {
  entries: ClusterLibraryEntry[];
  selectedId?: string;
  onSelectEntry?: (id: string) => void;
}

const DEFAULT_SYNTH_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Synthetic Cluster Expansion Module</title>
</head>
<body style="margin:0;background:#04070d;color:#e2e8f0;font-family:sans-serif;padding:24px;">
  <canvas id="synth-canvas" width="640" height="360"></canvas>
  <script>
    function runSyntheticField() {
      const canvas = document.getElementById('synth-canvas');
      const ctx = canvas.getContext('2d');
      let t = 0;
      function loop() {
        t += 0.03;
        ctx.fillStyle = 'rgba(4,7,13,0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 8) {
          const y = canvas.height / 2 + Math.sin(x * 0.02 + t) * 64;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
    runSyntheticField();
  </script>
</body>
</html>`;

export function ClusterWriterApp({ entries, selectedId, onSelectEntry }: ClusterWriterAppProps) {
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [internalId, setInternalId] = useState<string>(() => entries[0]?.id ?? '');
  const activeId = selectedId || internalId || entries[0]?.id || '';
  const activeEntry = entries.find((e) => e.id === activeId) ?? entries[0] ?? null;

  const [editTitle, setEditTitle] = useState('');
  const [editSource, setEditSource] = useState('');

  const [newName, setNewName] = useState(() => `SynthMod_${entries.length + 1}`);
  const [newTitle, setNewTitle] = useState('Synthetic Wave Expansion');
  const [newKind, setNewKind] = useState<'html' | 'typescript' | 'json'>('html');
  const [newSegment, setNewSegment] = useState<1 | 2 | 3>(3);
  const [newSource, setNewSource] = useState(DEFAULT_SYNTH_TEMPLATE);
  const [statusNote, setStatusNote] = useState<string>('');

  useEffect(() => {
    if (activeEntry && mode === 'edit') {
      setEditTitle(activeEntry.title);
      setEditSource(activeEntry.sourceCode);
    }
  }, [activeEntry?.id, activeEntry?.version, mode]);

  const handleSaveEdit = () => {
    if (!activeEntry) return;
    const updated = clusterLibraryEngine.writeModuleSource(activeEntry.id, editSource, editTitle);
    if (updated) {
      setStatusNote(`Saved ${updated.name} v${updated.version} · ${updated.fnvHex} · ${updated.sizeBytes.toLocaleString()}B`);
    }
  };

  const handleGrowLibrary = () => {
    const created = clusterLibraryEngine.createSyntheticModule({
      name: newName,
      title: newTitle,
      kind: newKind,
      segment: newSegment,
      sourceCode: newSource,
    });
    setStatusNote(`Expanded cluster library to ${entries.length + 1} modules (+${created.name})`);
    onSelectEntry?.(created.id);
    setInternalId(created.id);
    setNewName(`SynthMod_${entries.length + 2}`);
    setMode('edit');
  };

  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Cluster Library Writer ({entries.length} Total Modules)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Modify any existing repository module or create new synthetic modules to grow the cluster past 24
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'edit' ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Edit Existing Module
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'create'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Grow Library (+New #25+)
          </button>
        </div>
      </div>

      {statusNote && (
        <div className="px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.1] font-mono text-xs text-sky-200 tabular-nums">
          {statusNote}
        </div>
      )}

      {mode === 'edit' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Target Library Module</span>
              <select
                value={activeEntry?.id ?? ''}
                onChange={(e) => {
                  setInternalId(e.target.value);
                  onSelectEntry?.(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100 focus:outline-none focus:border-sky-400/50"
              >
                {entries.map((entry, idx) => (
                  <option key={entry.id} value={entry.id}>
                    #{idx + 1} {entry.name} ({entry.origin} · {entry.sizeBytes.toLocaleString()}B)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-400">Module Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100 focus:outline-none focus:border-sky-400/50"
              />
            </label>
          </div>

          <textarea
            value={editSource}
            onChange={(e) => setEditSource(e.target.value)}
            rows={13}
            spellCheck={false}
            aria-label="Module source editor"
            className="w-full p-3.5 rounded-lg bg-black/50 border border-white/[0.12] font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-sky-400/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400 tabular-nums">
              {activeEntry
                ? `FNV ${activeEntry.fnvHex} · v${activeEntry.version} · ${editSource.length.toLocaleString()} chars`
                : 'Select a module'}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeEntry?.origin === 'modified' && (
                <button
                  type="button"
                  onClick={() => {
                    clusterLibraryEngine.resetBaseModule(activeEntry.id);
                    setStatusNote(`Restored ${activeEntry.name} to base MGE1 binary image`);
                  }}
                  className="px-3 py-2 text-xs font-medium rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  Restore Base MGE1
                </button>
              )}
              {activeEntry?.origin === 'synthetic' && (
                <button
                  type="button"
                  onClick={() => {
                    clusterLibraryEngine.deleteSyntheticModule(activeEntry.id);
                    setStatusNote(`Removed synthetic module ${activeEntry.name}`);
                  }}
                  className="px-3 py-2 text-xs font-medium rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 whitespace-nowrap cursor-pointer"
                >
                  Delete Synthetic
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-medium rounded bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 whitespace-nowrap cursor-pointer"
              >
                Write to Cluster Library
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Module Name</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Title</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Format</span>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as 'html' | 'typescript' | 'json')}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
              >
                <option value="html">HTML5 Applet</option>
                <option value="typescript">TypeScript Module</option>
                <option value="json">JSON Dataset</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Segment</span>
              <select
                value={newSegment}
                onChange={(e) => setNewSegment(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
              >
                <option value={1}>Segment 1 (Engines)</option>
                <option value={2}>Segment 2 (Worlds)</option>
                <option value={3}>Segment 3 (AI / OS)</option>
              </select>
            </label>
          </div>

          <textarea
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            rows={12}
            spellCheck={false}
            aria-label="New synthetic module source"
            className="w-full p-3.5 rounded-lg bg-black/50 border border-white/[0.12] font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-400/50"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              Library will expand from {entries.length} to {entries.length + 1} modules
            </span>
            <button
              type="button"
              onClick={handleGrowLibrary}
              className="px-4 py-2 text-xs font-medium rounded bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-100 whitespace-nowrap cursor-pointer"
            >
              Append Module to Cluster Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
