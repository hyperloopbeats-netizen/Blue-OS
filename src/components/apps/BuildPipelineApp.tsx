import { useMemo, useState } from 'react';
import { clusterBus } from '../../kernel/ClusterBus';
import type { RepoModuleDescriptor } from '../../kernel/types';

interface BuildPipelineAppProps {
  modules: RepoModuleDescriptor[];
  upgradedIds: Set<string>;
  buildingSegment: number | null;
  buildProgressPct: number;
  onStartSegmentUpgrade: (segment: 1 | 2 | 3) => void;
  onUpgradeSingleModule: (mod: RepoModuleDescriptor) => void;
  onLaunchModule: (mod: RepoModuleDescriptor) => void;
}

const SEGMENT_META: {
  segment: 1 | 2 | 3;
  name: string;
  summary: string;
}[] = [
  {
    segment: 1,
    name: '01. Spatial & Simulation Engines',
    summary: '3D ballistic physics, FPS engine, CAD SDF kernel, and Tauri spatial orchestrator',
  },
  {
    segment: 2,
    name: '02. Quantum & Audio-Visual Synthesizers',
    summary: 'Solar fractal shaders, Web Audio EQ engines, and real-time video synthesis rigs',
  },
  {
    segment: 3,
    name: '03. Cognitive OS & Swarm Matrices',
    summary: 'Visual node graphs, NetSphere browsers, self-healing swarms, and unified shells',
  },
];

export function BuildPipelineApp({
  modules,
  upgradedIds,
  buildingSegment,
  buildProgressPct,
  onStartSegmentUpgrade,
  onUpgradeSingleModule,
  onLaunchModule,
}: BuildPipelineAppProps) {
  const [activeTab, setActiveTab] = useState<'all' | 1 | 2 | 3>('all');
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SEGMENT_META.map((meta) => {
      const segModules = modules.filter((m) => m.segment === meta.segment);
      const upgradedCount = segModules.filter((m) => upgradedIds.has(m.id)).length;
      const visible = segModules.filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q) ||
          m.capabilities.some((c) => c.toLowerCase().includes(q))
      );
      return { ...meta, total: segModules.length, upgradedCount, visible };
    });
  }, [modules, upgradedIds, search]);

  const totalUpgraded = upgradedIds.size;

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Segmented Build Operation</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Core Segment 0 Locked (5 Apps · 10 Daemons) · {totalUpgraded} of {modules.length} Repo Modules Upgraded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter modules or capabilities..."
            className="px-3 py-1.5 text-xs rounded-md bg-black/50 border border-white/[0.1] text-slate-100 w-52"
          />

          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
            {(['all', 1, 2, 3] as const).map((tab) => (
              <button
                key={String(tab)}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab === 'all' ? 'All Segments' : `Seg ${tab}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {grouped.map((seg) => {
          const isBuilding = buildingSegment === seg.segment;
          const allDone = seg.total > 0 && seg.upgradedCount === seg.total;
          return (
            <div key={seg.segment} className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-100">{seg.name}</h4>
                  <span className="font-mono text-[11px] tabular-nums text-sky-300">
                    {seg.upgradedCount}/{seg.total}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{seg.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${allDone ? 'bg-emerald-400' : 'bg-sky-400'}`}
                    style={{
                      width: `${isBuilding ? buildProgressPct : seg.total > 0 ? (seg.upgradedCount / seg.total) * 100 : 0}%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={buildingSegment !== null || allDone}
                  onClick={() => onStartSegmentUpgrade(seg.segment)}
                  className={`w-full py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    allDone
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 cursor-default'
                      : buildingSegment !== null
                        ? 'bg-white/[0.04] text-slate-500 border border-white/[0.06] cursor-not-allowed'
                        : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30'
                  }`}
                >
                  {allDone ? 'Segment Upgraded' : isBuilding ? `Building (${buildProgressPct}%)` : `Upgrade Segment ${seg.segment}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {grouped
          .filter((seg) => activeTab === 'all' || activeTab === seg.segment)
          .map((seg) => (
            <div key={seg.segment} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/[0.06] pb-1.5">
                <span className="font-semibold text-slate-200">{seg.name}</span>
                <span className="font-mono tabular-nums">{seg.visible.length} modules</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {seg.visible.map((mod) => {
                  const isUpgraded = upgradedIds.has(mod.id);
                  return (
                    <div
                      key={mod.id}
                      className="p-3.5 rounded-lg bg-white/[0.025] border border-white/[0.07] flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">{mod.name}</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className={`font-mono text-[11px] ${isUpgraded ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {isUpgraded ? 'Cluster Ready' : 'Binary Staged'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">{mod.title}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate tabular-nums">
                          {mod.fnvHex} · {(mod.sizeBytes / 1024).toFixed(1)} KB · {mod.symbolCount} symbols ·{' '}
                          {mod.capabilities.slice(0, 3).join(' / ') || mod.kind}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isUpgraded ? (
                          <button
                            type="button"
                            onClick={() => {
                              onUpgradeSingleModule(mod);
                              clusterBus.publish('build-pipeline', 'binary-indexer', 'module.upgrade', mod.name, 96);
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-slate-100 whitespace-nowrap cursor-pointer"
                          >
                            Upgrade
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onLaunchModule(mod)}
                            className="px-3 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
                          >
                            Launch Node
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
