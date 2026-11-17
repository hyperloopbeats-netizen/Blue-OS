import { useMemo, useState } from 'react';
import { clusterLibraryEngine } from '../../kernel/ClusterLibraryEngine';
import type { ClusterLibraryEntry } from '../../kernel/types';

interface SyntheticLexerAppProps {
  entries: ClusterLibraryEntry[];
  selectedIds?: string[];
  onInspectModule?: (id: string) => void;
}

export function SyntheticLexerApp({ entries, selectedIds, onInspectModule }: SyntheticLexerAppProps) {
  const [scope, setScope] = useState<'all' | 'selected' | 'seg1' | 'seg2' | 'seg3'>('all');

  const targetIds = useMemo(() => {
    if (scope === 'selected' && selectedIds && selectedIds.length > 0) return selectedIds;
    if (scope === 'seg1') return entries.filter((e) => e.segment === 1).map((e) => e.id);
    if (scope === 'seg2') return entries.filter((e) => e.segment === 2).map((e) => e.id);
    if (scope === 'seg3') return entries.filter((e) => e.segment === 3).map((e) => e.id);
    return entries.map((e) => e.id);
  }, [entries, scope, selectedIds]);

  const analysis = useMemo(() => clusterLibraryEngine.analyzeSelection(targetIds), [entries, targetIds]);

  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Synthetic Lexer &amp; AST Topology ({analysis.analyzedCount} Modules Scanned)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Extracts AST declarations, GLSL shaders, Web Audio graphs, and cross-module symbol collisions
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          {(
            [
              ['all', `All (${entries.length})`],
              ['seg1', 'Seg 1'],
              ['seg2', 'Seg 2'],
              ['seg3', 'Seg 3'],
              ...(selectedIds && selectedIds.length > 0
                ? ([['selected', `Queued (${selectedIds.length})`]] as const)
                : []),
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                scope === key
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Source Lines</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {analysis.totalLines.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {(analysis.totalBytes / 1024).toFixed(1)} KB analyzed
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Capabilities Fused</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">
            {analysis.uniqueCapabilities.length}
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            {analysis.uniqueCapabilities.join(', ') || 'None'}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Shader &amp; DSP Nodes</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {analysis.modules.reduce((acc, m) => acc + m.shaderBlocks + m.audioNodes, 0)}
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {analysis.modules.filter((m) => m.hasRenderLoop).length} RAF loops detected
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Symbol Collisions</div>
          <div
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              analysis.symbolCollisions.length > 0 ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {analysis.symbolCollisions.length}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Scoped isolation ready</div>
        </div>
      </div>

      {analysis.symbolCollisions.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-400/25 text-xs">
          <div className="font-medium text-amber-200 mb-1">
            Cross-Module Shared Symbols (Auto-isolated during Synthetic Assembly)
          </div>
          <div className="font-mono text-[11px] text-slate-300 leading-relaxed">
            {analysis.symbolCollisions.join(' · ')}
          </div>
        </div>
      )}

      <div className="border border-white/[0.08] rounded-lg overflow-hidden">
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-white/[0.04] text-slate-400 sticky top-0">
              <tr>
                <th className="py-2 px-3 font-medium">Module</th>
                <th className="py-2 px-3 font-medium text-right">Lines</th>
                <th className="py-2 px-3 font-medium text-right">Functions</th>
                <th className="py-2 px-3 font-medium text-right">Classes</th>
                <th className="py-2 px-3 font-medium text-right">GLSL / DSP</th>
                <th className="py-2 px-3 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {analysis.modules.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => onInspectModule?.(m.id)}
                  className={`hover:bg-white/[0.03] ${onInspectModule ? 'cursor-pointer' : ''}`}
                >
                  <td className="py-2 px-3 font-medium text-slate-100">{m.name}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-300">{m.lines}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-300">{m.functions.length}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-slate-300">{m.classes.length}</td>
                  <td className="py-2 px-3 font-mono tabular-nums text-right text-sky-300">
                    {m.shaderBlocks} / {m.audioNodes}
                  </td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-[200px]">
                    {m.capabilities.join(', ') || m.kind}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
