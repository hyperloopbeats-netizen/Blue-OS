import { useState } from 'react';
import { clusterLibraryEngine } from '../../kernel/ClusterLibraryEngine';
import { liquidKernel } from '../../kernel/LiquidKernel';
import type {
  ClusterFusionHealth,
  ClusterLibraryEntry,
  DaemonSnapshot,
  LibraryValidationReport,
  SyntheticAssemblyBuild,
} from '../../kernel/types';
import { ClusterReaderApp } from './ClusterReaderApp';
import { ClusterWriterApp } from './ClusterWriterApp';
import { LibraryValidatorApp } from './LibraryValidatorApp';
import { SyntheticAssemblerApp } from './SyntheticAssemblerApp';
import { SyntheticLexerApp } from './SyntheticLexerApp';

interface SynthesisCoreAppProps {
  entries: ClusterLibraryEntry[];
  health: ClusterFusionHealth;
  validationReport: LibraryValidationReport;
  lastBuild: SyntheticAssemblyBuild | null;
  daemons: DaemonSnapshot[];
}

type FusedStage = 'reader' | 'writer' | 'lexer' | 'assembler' | 'validator' | 'daemons';

export function SynthesisCoreApp({
  entries,
  health,
  validationReport,
  lastBuild,
  daemons,
}: SynthesisCoreAppProps) {
  const [stage, setStage] = useState<FusedStage>('reader');
  const [selectedId, setSelectedId] = useState<string>(() => entries[0]?.id ?? '');
  const [queuedIds, setQueuedIds] = useState<string[]>(() => entries.map((e) => e.id));
  const [daemonFilter, setDaemonFilter] = useState<'all' | 'read' | 'write' | 'lex' | 'bld' | 'val'>('all');

  const assemblyDaemons = daemons.filter((d) => d.group === 'assembly');
  const activeAsmCount = assemblyDaemons.filter((d) => d.state !== 'paused').length;

  const filteredDaemons = assemblyDaemons.filter((d) => {
    if (daemonFilter === 'all') return true;
    return d.id.startsWith(`asm-${daemonFilter}-`);
  });

  const handleQueueModule = (id: string) => {
    setQueuedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setStage('assembler');
  };

  return (
    <div className="p-5 space-y-4 text-slate-100">
      {/* Fused Core Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Synthesis Core — 5-App Fused Engine Sustained by 50 Daemons
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Unifies Cluster Reader, Writer, Synthetic Lexer, Assembler &amp; Validator across {entries.length} modules ({health.syntheticGrowthCount} grown)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => clusterLibraryEngine.injectFusionFault()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 whitespace-nowrap cursor-pointer"
          >
            Inject Core Fault
          </button>
          <button
            type="button"
            onClick={() => clusterLibraryEngine.boostFusionSustain()}
            className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-200 whitespace-nowrap cursor-pointer"
          >
            Boost 50-Daemon Sustain
          </button>
        </div>
      </div>

      {/* Shared Fused Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Fusion Coherence</div>
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              health.healthPct >= 95 ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {health.healthPct}%
          </div>
        </div>

        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Cluster Library</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-sky-300">
            {entries.length} Modules
          </div>
        </div>

        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Sustaining Daemons</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-100">
            {activeAsmCount}/50 Active
          </div>
        </div>

        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Writes / Assemblies</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-100">
            {health.totalWrites} / {health.totalAssemblies}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-400">Latest Status</div>
          <div className="mt-1 font-mono text-[11px] text-slate-300 truncate">{health.lastAction}</div>
        </div>
      </div>

      {/* Fused Stage Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full">
          {(
            [
              ['reader', '01. Reader'],
              ['writer', '02. Writer'],
              ['lexer', '03. Lexer & AST'],
              ['assembler', '04. Assembler'],
              ['validator', '05. Validator'],
              ['daemons', `50 Sustaining Daemons (${activeAsmCount}/50)`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStage(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                stage === key
                  ? 'bg-sky-500/25 text-sky-100 border border-sky-400/35'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            clusterLibraryEngine.health.autoSustainEnabled = !clusterLibraryEngine.health.autoSustainEnabled;
          }}
          className="text-xs font-mono text-sky-300 hover:text-sky-200 whitespace-nowrap cursor-pointer"
        >
          Auto-Sustain: {health.autoSustainEnabled ? 'On' : 'Paused'}
        </button>
      </div>

      {/* Fused Stage Body */}
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.015] overflow-hidden">
        {stage === 'reader' && (
          <ClusterReaderApp
            entries={entries}
            selectedId={selectedId}
            onSelectEntry={setSelectedId}
            onSendToWriter={(id) => {
              setSelectedId(id);
              setStage('writer');
            }}
            onAddToAssembly={handleQueueModule}
          />
        )}

        {stage === 'writer' && (
          <ClusterWriterApp entries={entries} selectedId={selectedId} onSelectEntry={setSelectedId} />
        )}

        {stage === 'lexer' && (
          <SyntheticLexerApp
            entries={entries}
            selectedIds={queuedIds}
            onInspectModule={(id) => {
              setSelectedId(id);
              setStage('reader');
            }}
          />
        )}

        {stage === 'assembler' && (
          <SyntheticAssemblerApp
            entries={entries}
            selectedIds={queuedIds}
            onChangeSelectedIds={setQueuedIds}
            lastBuild={lastBuild}
          />
        )}

        {stage === 'validator' && (
          <LibraryValidatorApp
            entries={entries}
            report={validationReport}
            onSelectForFix={(id) => {
              setSelectedId(id);
              setStage('writer');
            }}
          />
        )}

        {stage === 'daemons' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full">
                {(
                  [
                    ['all', `All 50 (${assemblyDaemons.length})`],
                    ['read', '10 Reader'],
                    ['write', '10 Writer'],
                    ['lex', '10 Lexer'],
                    ['bld', '10 Assembler'],
                    ['val', '10 Validator'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDaemonFilter(key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                      daemonFilter === key
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredDaemons.map((d) => (
                <div key={d.id} className="p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.07] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-slate-100 truncate">{d.name}</span>
                    <span
                      className={`font-mono text-[10px] shrink-0 tabular-nums ${
                        d.state === 'running'
                          ? 'text-emerald-400'
                          : d.state === 'healing'
                            ? 'text-amber-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {d.targetHz}Hz
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{d.role}</div>
                  <div className="flex items-center justify-between pt-0.5 text-[10px] font-mono text-slate-500">
                    <span className="truncate tabular-nums">{d.ticks}t</span>
                    <button
                      type="button"
                      onClick={() => liquidKernel.toggleDaemon(d.id)}
                      className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 shrink-0 cursor-pointer"
                    >
                      {d.state === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
