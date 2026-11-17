import { clusterBus } from '../../kernel/ClusterBus';
import type { DecodedFrame } from '../../kernel/types';

interface SwarmConsensusAppProps {
  frames: DecodedFrame[];
}

export function SwarmConsensusApp({ frames }: SwarmConsensusAppProps) {
  const latest = frames[0];

  const handleBroadcastConsensus = () => {
    if (!latest) return;
    clusterBus.publish(
      'swarm-consensus',
      'main-brain',
      'swarm.consensus',
      `Frame #${latest.id} (${latest.detectedFormat}) verified by 5 agents`,
      112
    );
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Swarm Consensus — 5-Agent Neural Decoder</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Five autonomous swarm agents validate structure, entropy, self-healing, fold hash, and routing
          </p>
        </div>

        <button
          type="button"
          onClick={handleBroadcastConsensus}
          className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
        >
          Commit Consensus to Brain
        </button>
      </div>

      {latest ? (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {latest.votes.map((vote) => (
            <div key={vote.agent} className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-100">{vote.agent}</span>
                <span
                  className={`font-mono text-[11px] ${
                    vote.verdict === 'valid'
                      ? 'text-emerald-400'
                      : vote.verdict === 'healed'
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }`}
                >
                  {vote.verdict}
                </span>
              </div>
              <div className="font-mono text-lg font-semibold tabular-nums text-sky-300">
                {vote.confidencePct}%
              </div>
              <div className="text-[11px] font-mono text-slate-400 break-words">{vote.note}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400">Awaiting decoded swarm frame.</div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-slate-200 mb-2">Consensus Ledger</h4>
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03] text-slate-400">
                <th className="py-2 px-3">Frame</th>
                <th className="py-2 px-3">Source</th>
                <th className="py-2 px-3">Format</th>
                <th className="py-2 px-3 text-right">Entropy</th>
                <th className="py-2 px-3">Digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] font-mono">
              {frames.slice(0, 10).map((f) => (
                <tr key={f.id}>
                  <td className="py-2 px-3 tabular-nums text-slate-300">#{f.id}</td>
                  <td className="py-2 px-3 text-slate-200">{f.sourceLabel}</td>
                  <td className="py-2 px-3 text-sky-300">{f.detectedFormat}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-300">{f.entropyBits}</td>
                  <td className="py-2 px-3 text-slate-400">{f.fnvHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
