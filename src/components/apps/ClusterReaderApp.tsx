import { useMemo, useState } from 'react';
import type { ClusterLibraryEntry } from '../../kernel/types';

interface ClusterReaderAppProps {
  entries: ClusterLibraryEntry[];
  selectedId?: string;
  onSelectEntry?: (id: string) => void;
  onSendToWriter?: (id: string) => void;
  onAddToAssembly?: (id: string) => void;
}

export function ClusterReaderApp({
  entries,
  selectedId,
  onSelectEntry,
  onSendToWriter,
  onAddToAssembly,
}: ClusterReaderAppProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'seg1' | 'seg2' | 'seg3' | 'grown'>('all');
  const [internalSelectedId, setInternalSelectedId] = useState<string>(() => entries[0]?.id ?? '');
  const [viewMode, setViewMode] = useState<'source' | 'hex'>('source');

  const activeId = selectedId || internalSelectedId || entries[0]?.id || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterMode === 'seg1' && e.segment !== 1) return false;
      if (filterMode === 'seg2' && e.segment !== 2) return false;
      if (filterMode === 'seg3' && e.segment !== 3) return false;
      if (filterMode === 'grown' && e.origin === 'repo-base') return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.capabilities.some((c) => c.toLowerCase().includes(q)) ||
        e.symbols.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [entries, search, filterMode]);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeId) ?? filtered[0] ?? entries[0] ?? null,
    [entries, filtered, activeId]
  );

  const hexRows = useMemo(() => {
    if (!activeEntry || viewMode !== 'hex') return [];
    const bytes = new TextEncoder().encode(activeEntry.sourceCode.slice(0, 512));
    const rows: { offset: string; hex: string; ascii: string }[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const slice = bytes.subarray(i, Math.min(i + 16, bytes.length));
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      let ascii = '';
      for (let j = 0; j < slice.length; j++) {
        const b = slice[j];
        ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      }
      rows.push({
        offset: '0x' + i.toString(16).padStart(4, '0').toUpperCase(),
        hex,
        ascii,
      });
    }
    return rows;
  }, [activeEntry, viewMode]);

  const handleSelect = (id: string) => {
    setInternalSelectedId(id);
    onSelectEntry?.(id);
  };

  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Cluster Library Reader ({entries.length} Modules Indexed)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Reads all 24 base repository modules and dynamically grown synthetic entries ({entries.filter((e) => e.origin === 'synthetic').length} synthetic)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, capability, symbol..."
            aria-label="Search cluster library"
            className="px-3 py-1.5 text-xs rounded bg-black/40 border border-white/[0.12] text-slate-100 placeholder:text-slate-500 w-52 focus:outline-none focus:border-sky-400/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full">
          {(
            [
              ['all', `All (${entries.length})`],
              ['seg1', 'Seg 1'],
              ['seg2', 'Seg 2'],
              ['seg3', 'Seg 3'],
              ['grown', `Written / Grown (${entries.filter((e) => e.origin !== 'repo-base').length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === key
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeEntry && (
          <div className="flex items-center gap-2">
            {onSendToWriter && (
              <button
                type="button"
                onClick={() => onSendToWriter(activeEntry.id)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.12] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Edit in Writer
              </button>
            )}
            {onAddToAssembly && (
              <button
                type="button"
                onClick={() => onAddToAssembly(activeEntry.id)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Queue for Assembly
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 border border-white/[0.08] rounded-lg bg-white/[0.02] max-h-[380px] overflow-y-auto divide-y divide-white/[0.05]">
          {filtered.length === 0 ? (
            <div className="p-4 text-xs text-slate-400">No matching cluster modules found.</div>
          ) : (
            filtered.map((entry) => {
              const isSelected = activeEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelect(entry.id)}
                  className={`w-full px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-sky-500/15 text-slate-100' : 'hover:bg-white/[0.04] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{entry.name}</span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                      {entry.kind.toUpperCase()} · {entry.sizeBytes.toLocaleString()}B
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    Seg {entry.segment} · {entry.origin === 'repo-base' ? 'MGE1 Base' : entry.origin === 'modified' ? `Modified v${entry.version}` : 'Synthetic Growth'} · {entry.fnvHex}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8 border border-white/[0.08] rounded-lg bg-black/40 flex flex-col min-h-[380px]">
          {activeEntry ? (
            <>
              <div className="px-4 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{activeEntry.title}</div>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums truncate">
                    {activeEntry.fnvHex} · {activeEntry.symbolCount} symbols ·{' '}
                    {activeEntry.capabilities.join(', ') || 'Generic'}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setViewMode('source')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap cursor-pointer ${
                      viewMode === 'source' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Source Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('hex')}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap cursor-pointer ${
                      viewMode === 'hex' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Hex Slice
                  </button>
                </div>
              </div>

              {viewMode === 'source' ? (
                <pre className="p-3.5 text-[11px] font-mono text-slate-300 overflow-auto max-h-[310px] leading-relaxed whitespace-pre-wrap break-words">
                  {activeEntry.sourceCode.slice(0, 12000)}
                  {activeEntry.sourceCode.length > 12000 ? '\n... [truncated to 12 KB preview]' : ''}
                </pre>
              ) : (
                <div className="p-3.5 font-mono text-[11px] overflow-auto max-h-[310px] space-y-1 tabular-nums">
                  {hexRows.map((row) => (
                    <div key={row.offset} className="grid grid-cols-[64px_1fr_130px] gap-3 text-slate-300">
                      <span className="text-sky-400">{row.offset}</span>
                      <span className="text-slate-300 truncate">{row.hex}</span>
                      <span className="text-slate-500 truncate">{row.ascii}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-xs text-slate-400">Waiting for repository ingestion...</div>
          )}
        </div>
      </div>
    </div>
  );
}
