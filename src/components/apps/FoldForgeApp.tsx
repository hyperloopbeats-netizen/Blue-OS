import { clusterBus } from '../../kernel/ClusterBus';
import { hyperFlowEngine } from '../../kernel/HyperFlowEngine';
import type { BinaryFoldResult, FoldAlgorithm } from '../../kernel/types';

interface FoldForgeAppProps {
  foldResult: BinaryFoldResult;
}

const ALGORITHMS: { id: FoldAlgorithm; label: string }[] = [
  { id: 'xor-rotate', label: 'XOR-Rotate Fold' },
  { id: 'golden-mix', label: 'Golden-Mix Fold' },
  { id: 'parity-collapse', label: 'Parity Collapse' },
];

export function FoldForgeApp({ foldResult }: FoldForgeAppProps) {
  const handleFoldNow = () => {
    const next = hyperFlowEngine.computeBinaryFold(true);
    clusterBus.publish('fold-forge', 'fold-runner', 'fold.seed_update', `Gen ${next.foldGeneration} -> ${next.foldedSeedHex}`, 96);
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Fold Forge — Hyper Binary Folding System</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Compresses 24-module MGE1 image ({foldResult.compressionRatio}:1) into live deterministic game &amp; shader entropy
          </p>
        </div>

        <button
          type="button"
          onClick={handleFoldNow}
          className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
        >
          Fold &amp; Broadcast Seed
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ALGORITHMS.map((alg) => (
          <button
            key={alg.id}
            type="button"
            onClick={() => hyperFlowEngine.setFoldAlgorithm(alg.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              foldResult.algorithm === alg.id
                ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-300'
            }`}
          >
            {alg.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-sky-300 tabular-nums">
          Gen #{foldResult.foldGeneration} · Seed {foldResult.foldedSeedHex}
        </span>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-semibold text-slate-200">Folding Pyramid Stages</h4>
        <div className="space-y-2">
          {foldResult.stages.map((st) => {
            const widthPct = Math.max(8, Math.round(100 - st.stage * 20));
            return (
              <div key={st.stage} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-200">{st.label}</span>
                  <span className="text-slate-400 tabular-nums">{st.bytes.toLocaleString()} B</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-sky-400/80" style={{ width: `${widthPct}%` }} />
                </div>
                <div className="font-mono text-[11px] text-slate-400">{st.previewHex}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-200 mb-2">8×32-Bit Folded Entropy Words (Kernel Registers 32–39)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          {foldResult.foldedWords.map((word, idx) => (
            <div key={idx} className="p-2.5 rounded bg-black/50 border border-white/[0.08] flex justify-between">
              <span className="text-slate-500">W{idx}</span>
              <span className="text-sky-300 tabular-nums">0x{(word >>> 0).toString(16).padStart(8, '0').toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
