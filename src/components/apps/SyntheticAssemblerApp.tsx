import { useMemo, useState } from 'react';
import { clusterLibraryEngine } from '../../kernel/ClusterLibraryEngine';
import type { AssemblyTargetMode, ClusterLibraryEntry, SyntheticAssemblyBuild } from '../../kernel/types';

interface SyntheticAssemblerAppProps {
  entries: ClusterLibraryEntry[];
  selectedIds?: string[];
  onChangeSelectedIds?: (ids: string[]) => void;
  lastBuild: SyntheticAssemblyBuild | null;
}

export function SyntheticAssemblerApp({
  entries,
  selectedIds,
  onChangeSelectedIds,
  lastBuild,
}: SyntheticAssemblerAppProps) {
  const [internalIds, setInternalIds] = useState<string[]>(() => entries.map((e) => e.id));
  const activeIds = selectedIds ?? (internalIds.length > 0 ? internalIds : entries.map((e) => e.id));

  const setActiveIds = (next: string[]) => {
    setInternalIds(next);
    onChangeSelectedIds?.(next);
  };

  const [targetName, setTargetName] = useState('FusedClusterArtifact');
  const [mode, setMode] = useState<AssemblyTargetMode>('html-cluster');
  const [includeShim, setIncludeShim] = useState(true);
  const [viewTab, setViewTab] = useState<'code' | 'preview'>('code');
  const [localBuild, setLocalBuild] = useState<SyntheticAssemblyBuild | null>(lastBuild);
  const [publishedNote, setPublishedNote] = useState('');

  const effectiveBuild = localBuild ?? lastBuild;

  const previewUrl = useMemo(() => {
    if (!effectiveBuild || effectiveBuild.mode !== 'html-cluster') return null;
    return effectiveBuild.assembledCode;
  }, [effectiveBuild]);

  const toggleId = (id: string) => {
    if (activeIds.includes(id)) {
      setActiveIds(activeIds.filter((x) => x !== id));
    } else {
      setActiveIds([...activeIds, id]);
    }
  };

  const handleAssemble = () => {
    const built = clusterLibraryEngine.assembleCluster({
      targetName,
      mode,
      moduleIds: activeIds,
      includeRuntimeShim: includeShim,
    });
    setLocalBuild(built);
    setPublishedNote('');
  };

  const handlePublishToLibrary = () => {
    const built =
      effectiveBuild ??
      clusterLibraryEngine.assembleCluster({
        targetName,
        mode,
        moduleIds: activeIds,
        includeRuntimeShim: includeShim,
      });

    const kindMap: Record<AssemblyTargetMode, 'html' | 'typescript' | 'json'> = {
      'html-cluster': 'html',
      'ts-kernel-bundle': 'typescript',
      'json-manifest': 'json',
    };

    const created = clusterLibraryEngine.createSyntheticModule({
      name: built.targetName,
      title: `${built.targetName} (${built.sourceModuleNames.length}-Module Composite)`,
      kind: kindMap[built.mode],
      segment: 3,
      sourceCode: built.assembledCode,
    });

    setPublishedNote(`Published ${created.name} — library now contains ${entries.length + 1} modules`);
  };

  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Synthetic Assembler ({activeIds.length}/{entries.length} Modules Selected)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Fuses any subset or all {entries.length} cluster library modules into a runnable synthetic build or new library module
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAssemble}
            className="px-4 py-1.5 text-xs font-medium rounded bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Synthesize Assembly
          </button>
          <button
            type="button"
            onClick={handlePublishToLibrary}
            className="px-3.5 py-1.5 text-xs font-medium rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Publish to Library (+1)
          </button>
        </div>
      </div>

      {publishedNote && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-400/30 font-mono text-xs text-emerald-200 tabular-nums">
          {publishedNote}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Artifact Name</span>
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-400">Assembly Target</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AssemblyTargetMode)}
            className="w-full px-3 py-2 text-xs rounded bg-black/50 border border-white/[0.12] text-slate-100"
          >
            <option value="html-cluster">Unified HTML5 Cluster Applet</option>
            <option value="ts-kernel-bundle">TypeScript Kernel Module</option>
            <option value="json-manifest">JSON Synthesis Graph</option>
          </select>
        </label>

        <div className="space-y-1 sm:col-span-2">
          <span className="text-xs text-slate-400">Quick Cluster Presets</span>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setActiveIds(entries.map((e) => e.id))}
              className="px-2.5 py-1.5 text-xs rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] whitespace-nowrap cursor-pointer"
            >
              All ({entries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveIds(entries.filter((e) => e.segment === 1).map((e) => e.id))}
              className="px-2.5 py-1.5 text-xs rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] whitespace-nowrap cursor-pointer"
            >
              Seg 1 Engines
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIds(
                  entries.filter((e) => e.capabilities.includes('WebGL2') || e.capabilities.includes('Three.js')).map((e) => e.id)
                )
              }
              className="px-2.5 py-1.5 text-xs rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] whitespace-nowrap cursor-pointer"
            >
              WebGL + 3D
            </button>
            <button
              type="button"
              onClick={() => setIncludeShim((v) => !v)}
              className={`px-2.5 py-1.5 text-xs rounded border whitespace-nowrap cursor-pointer ${
                includeShim
                  ? 'bg-sky-500/20 border-sky-400/35 text-sky-200'
                  : 'bg-white/[0.05] border-white/[0.1] text-slate-400'
              }`}
            >
              Bridge Shim: {includeShim ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 border border-white/[0.08] rounded-lg bg-white/[0.02] p-2.5 max-h-[320px] overflow-y-auto space-y-1">
          {entries.map((entry) => {
            const checked = activeIds.includes(entry.id);
            return (
              <label
                key={entry.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer ${
                  checked ? 'bg-sky-500/15 text-slate-100' : 'text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleId(entry.id)}
                    className="accent-sky-400 cursor-pointer"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">S{entry.segment}</span>
              </label>
            );
          })}
        </div>

        <div className="lg:col-span-8 border border-white/[0.08] rounded-lg bg-black/40 flex flex-col min-h-[320px]">
          <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-2">
            <div className="font-mono text-xs text-slate-300 tabular-nums truncate">
              {effectiveBuild
                ? `${effectiveBuild.targetName} · ${effectiveBuild.outputBytes.toLocaleString()}B · ${effectiveBuild.fnvHex} · ${effectiveBuild.sourceModuleNames.length} modules`
                : 'Click "Synthesize Assembly" to compile selected cluster modules'}
            </div>

            {effectiveBuild?.mode === 'html-cluster' && (
              <div className="flex items-center gap-1 p-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setViewTab('code')}
                  className={`px-2.5 py-1 text-[11px] rounded cursor-pointer ${
                    viewTab === 'code' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'
                  }`}
                >
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('preview')}
                  className={`px-2.5 py-1 text-[11px] rounded cursor-pointer ${
                    viewTab === 'preview' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            )}
          </div>

          {effectiveBuild ? (
            viewTab === 'preview' && previewUrl ? (
              <iframe
                title={effectiveBuild.targetName}
                srcDoc={previewUrl}
                sandbox="allow-scripts"
                className="w-full h-[275px] bg-[#04070d] border-0"
              />
            ) : (
              <pre className="p-3.5 font-mono text-[11px] text-slate-300 overflow-auto max-h-[275px] leading-relaxed whitespace-pre-wrap">
                {effectiveBuild.assembledCode}
              </pre>
            )
          ) : (
            <div className="p-6 text-xs text-slate-400">
              Select any subset or all {entries.length} cluster library modules and click Synthesize Assembly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
