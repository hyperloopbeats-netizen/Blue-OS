import { useMemo, useState } from 'react';
import { clusterBus } from '../../kernel/ClusterBus';
import type { ClusterPacket, SniffedFlowState } from '../../kernel/types';

interface FlowSnifferAppProps {
  flowState: SniffedFlowState;
  packets: ClusterPacket[];
}

export function FlowSnifferApp({ flowState, packets }: FlowSnifferAppProps) {
  const [topicFilter, setTopicFilter] = useState('');

  const filtered = useMemo(() => {
    const q = topicFilter.trim().toLowerCase();
    if (!q) return packets;
    return packets.filter(
      (p) =>
        p.topic.toLowerCase().includes(q) ||
        p.from.toLowerCase().includes(q) ||
        p.to.toLowerCase().includes(q) ||
        p.payloadSummary.toLowerCase().includes(q)
    );
  }, [packets, topicFilter]);

  const topPairs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of packets) {
      const k = `${p.from} → ${p.to}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [packets]);

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Flow Sniffer — Sniffed Flow State</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Live bus inspection · {flowState.sniffedPerSec} pkt/s · Entropy {flowState.packetEntropy}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder="Sniff topic or node..."
            className="px-2.5 py-1.5 text-xs rounded bg-black/50 border border-white/[0.1] text-slate-100 w-44"
          />
          <button
            type="button"
            onClick={() =>
              clusterBus.publish('flow-sniffer', 'main-brain', 'flow.boost', `Sniffed flow ${flowState.flowScore}%`, 96)
            }
            className="px-3 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
          >
            Amplify Flow
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Sniffed Flow Score</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">{flowState.flowScore}%</div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Cluster Coherence</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-300">{flowState.coherencePct}%</div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Active Flow Edges</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">{flowState.activeEdges}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Topic Entropy</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">{flowState.packetEntropy}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 p-4 rounded-lg bg-white/[0.025] border border-white/[0.08] space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-200">Dominant Resonance Pairs</h4>
          <div className="space-y-2">
            {topPairs.map(([pair, count]) => (
              <div key={pair} className="flex items-center justify-between text-xs font-mono border-b border-white/[0.05] pb-1.5">
                <span className="text-slate-300 truncate">{pair}</span>
                <span className="text-sky-300 tabular-nums shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 p-4 rounded-lg bg-black/45 border border-white/[0.08] space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-200">Captured Packet Stream ({filtered.length})</h4>
          <div className="max-h-[260px] overflow-y-auto space-y-1.5 font-mono text-[11px]">
            {filtered.slice(0, 35).map((pkt) => (
              <div key={pkt.id} className="flex items-baseline justify-between gap-3 py-1 border-b border-white/[0.04]">
                <div className="truncate">
                  <span className="text-slate-500">#{pkt.id}</span>{' '}
                  <span className="text-sky-300">{pkt.from}</span>
                  <span className="text-slate-500"> → </span>
                  <span className="text-slate-200">{pkt.to}</span>{' '}
                  <span className="text-amber-300">{pkt.topic}</span>
                </div>
                <span className="text-slate-400 truncate max-w-[200px]">{pkt.payloadSummary}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
