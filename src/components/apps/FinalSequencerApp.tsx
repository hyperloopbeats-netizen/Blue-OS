import { hyperFlowEngine } from '../../kernel/HyperFlowEngine';
import type { BinaryStateHeader, KernelMetrics } from '../../kernel/types';

interface FinalSequencerAppProps {
  metrics: KernelMetrics;
  binHeader: BinaryStateHeader | null;
  upgradedCount: number;
  totalModules: number;
  onLaunchGame: () => void;
}

export function FinalSequencerApp({
  metrics,
  binHeader,
  upgradedCount,
  totalModules,
  onLaunchGame,
}: FinalSequencerAppProps) {
  const runningDaemons = metrics.daemons.filter((d) => d.state !== 'paused').length;
  const stages = [
    {
      label: '01. 120Hz Fixed-Quantum Kernel',
      detail: `${metrics.kernelTickHz} Hz locked · ${metrics.jitterUs} us jitter`,
      ready: metrics.kernelTickHz >= 55,
    },
    {
      label: '02. 20 Sustaining Daemons (10 Core + 10 Hyper)',
      detail: `${runningDaemons}/20 daemons executing deterministically`,
      ready: runningDaemons >= 18,
    },
    {
      label: '03. Hyper Binary Folding Engine',
      detail: binHeader
        ? `${binHeader.magic} folded to ${metrics.foldResult.foldedSeedHex} (${metrics.foldResult.compressionRatio}:1)`
        : 'Awaiting MGE1 binary buffer',
      ready: Boolean(binHeader && metrics.foldResult.stages.length > 0),
    },
    {
      label: '04. Sniffed Flow State & Self-Awareness',
      detail: `Flow ${metrics.flowState.flowScore}% · Coherence ${metrics.flowState.coherencePct}% · ${metrics.flowState.activeEdges} edges`,
      ready: metrics.flowState.coherencePct >= 60,
    },
    {
      label: '05. FoldRunner Kernel Micro Game & Repo Cluster',
      detail: `Game Score ${metrics.flowState.gameKernelScore} · ${upgradedCount}/${totalModules} repo modules upgraded`,
      ready: true,
    },
  ];

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Final Sequencer — Cluster Orchestration</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Readiness {metrics.flowState.finalReadinessPct}% · Coordinates all 10 apps, 20 daemons, and FoldRunner kernel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLaunchGame}
            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 whitespace-nowrap cursor-pointer"
          >
            Launch FoldRunner
          </button>
          <button
            type="button"
            onClick={() => hyperFlowEngine.triggerFinalSequence()}
            className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
          >
            Execute Final Sync
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {stages.map((st) => (
          <div
            key={st.label}
            className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <div className="text-sm font-semibold text-slate-100">{st.label}</div>
              <div className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">{st.detail}</div>
            </div>
            <span className={`font-mono text-xs ${st.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
              {st.ready ? 'Ready' : 'Syncing'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
