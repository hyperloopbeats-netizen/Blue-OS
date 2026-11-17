import { useEffect, useMemo, useRef, useState } from 'react';
import { clusterBus } from '../../kernel/ClusterBus';
import type { ClusterPacket, DaemonSnapshot, MountedLegacyState, RepoModuleDescriptor } from '../../kernel/types';

interface ClusterMeshAppProps {
  daemons: DaemonSnapshot[];
  upgradedModules: RepoModuleDescriptor[];
  packets: ClusterPacket[];
  legacyNodes: MountedLegacyState[];
}

interface PulseAnim {
  from: string;
  to: string;
  progress: number;
  topic: string;
}

const CORE_NODES = [
  { id: 'cluster-mesh', label: 'Main Brain', group: 'core' },
  { id: 'kernel-monitor', label: 'Kernel Monitor', group: 'core' },
  { id: 'liquid-studio', label: 'Liquid Studio', group: 'core' },
  { id: 'binary-vault', label: 'Binary Vault', group: 'core' },
  { id: 'build-pipeline', label: 'Build Pipeline', group: 'core' },
  { id: 'flow-sniffer', label: 'Flow Sniffer', group: 'core' },
  { id: 'fold-forge', label: 'Fold Forge', group: 'core' },
  { id: 'self-matrix', label: 'Self Matrix', group: 'core' },
  { id: 'phase-harmonizer', label: 'Phase Lock', group: 'core' },
  { id: 'final-sequencer', label: 'Final Seq', group: 'core' },
  { id: 'fold-runner', label: 'FoldRunner', group: 'core' },
  { id: 'swarm-ingestor', label: 'Ingestor', group: 'core' },
  { id: 'swarm-decoder', label: 'Decoder', group: 'core' },
  { id: 'swarm-consensus', label: 'Consensus', group: 'core' },
  { id: 'swarm-healer', label: 'Healer', group: 'core' },
  { id: 'swarm-streamer', label: 'Streamer', group: 'core' },
  { id: 'swarm-sustainer', label: 'Sustainer', group: 'core' },
  { id: 'cluster-reader', label: 'Reader', group: 'core' },
  { id: 'cluster-writer', label: 'Writer', group: 'core' },
  { id: 'synthetic-lexer', label: 'Lexer', group: 'core' },
  { id: 'synthetic-assembler', label: 'Assembler', group: 'core' },
  { id: 'library-validator', label: 'Validator', group: 'core' },
  { id: 'synthesis-core', label: 'Synthesis Core', group: 'core' },
];

export function ClusterMeshApp({
  daemons,
  upgradedModules,
  packets,
  legacyNodes,
}: ClusterMeshAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulsesRef = useRef<PulseAnim[]>([]);
  const lastSeenPacketId = useRef<number>(0);

  const [selectedNodeId, setSelectedNodeId] = useState<string>('kclock-120');
  const [fromNode, setFromNode] = useState<string>('liquid-studio');
  const [toNode, setToNode] = useState<string>('gl-compositor');
  const [topic, setTopic] = useState<string>('cluster.sync');
  const [payloadText, setPayloadText] = useState<string>('Synchronize 120Hz shader phase');

  const allNodes = useMemo(() => {
    const daemonNodes = daemons.map((d) => ({
      key: `daemon:${d.id}`,
      id: d.id,
      label: d.name,
      group: 'daemon' as const,
    }));
    const moduleNodes = upgradedModules.slice(0, 12).map((m) => {
      const group = legacyNodes.some((l) => l.moduleName === m.name && l.status === 'linked')
        ? ('mounted' as const)
        : ('upgraded' as const);
      return {
        key: `${group}:${m.id}`,
        id: m.name,
        label: m.name,
        group,
      };
    });
    return [
      ...CORE_NODES.map((c) => ({ key: `core:${c.id}`, ...c, group: 'core' as const })),
      ...daemonNodes,
      ...moduleNodes,
    ];
  }, [daemons, upgradedModules, legacyNodes]);

  useEffect(() => {
    const newest = packets[0];
    if (!newest || newest.id === lastSeenPacketId.current) return;
    lastSeenPacketId.current = newest.id;
    pulsesRef.current.push({
      from: newest.from,
      to: newest.to === '*' ? 'ipc-router' : newest.to,
      progress: 0,
      topic: newest.topic,
    });
    if (pulsesRef.current.length > 36) {
      pulsesRef.current.shift();
    }
  }, [packets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const posMap = new Map<string, { id: string; x: number; y: number; group: string; label: string }>();
      const idLookup = new Map<string, { x: number; y: number }>();

      const cores = allNodes.filter((n) => n.group === 'core');
      const dems = allNodes.filter((n) => n.group === 'daemon');
      const mods = allNodes.filter((n) => n.group === 'upgraded' || n.group === 'mounted');

      cores.forEach((node, i) => {
        const ang = (i / Math.max(1, cores.length)) * Math.PI * 2 - Math.PI / 2;
        const pt = {
          id: node.id,
          x: cx + Math.cos(ang) * 72,
          y: cy + Math.sin(ang) * 62,
          group: node.group,
          label: node.label,
        };
        posMap.set(node.key, pt);
        idLookup.set(node.id, pt);
      });

      dems.forEach((node, i) => {
        const ang = (i / Math.max(1, dems.length)) * Math.PI * 2;
        const pt = {
          id: node.id,
          x: cx + Math.cos(ang) * 145,
          y: cy + Math.sin(ang) * 116,
          group: node.group,
          label: node.label,
        };
        posMap.set(node.key, pt);
        if (!idLookup.has(node.id)) idLookup.set(node.id, pt);
      });

      mods.forEach((node, i) => {
        const ang = (i / Math.max(1, mods.length)) * Math.PI * 2 + 0.25;
        const pt = {
          id: node.id,
          x: cx + Math.cos(ang) * 225,
          y: cy + Math.sin(ang) * 155,
          group: node.group,
          label: node.label,
        };
        posMap.set(node.key, pt);
        idLookup.set(node.id, pt);
      });

      // Draw structural cluster mesh edges through ipc-router
      const hub = idLookup.get('ipc-router') || { x: cx, y: cy };
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (const [key, pt] of posMap.entries()) {
        if (key === 'daemon:ipc-router') continue;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }

      // Draw active animated packet pulses
      const activePulses = pulsesRef.current;
      for (let i = activePulses.length - 1; i >= 0; i--) {
        const p = activePulses[i];
        p.progress += 0.045;
        if (p.progress >= 1) {
          activePulses.splice(i, 1);
          continue;
        }
        const a = idLookup.get(p.from) || hub;
        const b = idLookup.get(p.to) || hub;
        const px = a.x + (b.x - a.x) * p.progress;
        const py = a.y + (b.y - a.y) * p.progress;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw nodes
      for (const [, pt] of posMap.entries()) {
        const isSelected = pt.id === selectedNodeId;
        const radius = pt.group === 'core' ? 7 : pt.group === 'mounted' ? 6.5 : 4.8;
        ctx.fillStyle =
          pt.group === 'mounted'
            ? '#34d399'
            : pt.group === 'core'
              ? '#38bdf8'
              : pt.group === 'upgraded'
                ? '#f59e0b'
                : '#94a3b8';

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pt.label, pt.x, pt.y + radius + 12);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [allNodes, selectedNodeId]);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    clusterBus.publish(fromNode, toNode, topic.trim(), payloadText.trim() || 'signal', 112);
    if (toNode === '*' || legacyNodes.length > 0) {
      clusterBus.pingAllLegacyFrames();
    }
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Main Brain System — Unified Cluster Bus</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            5 Main Apps · {daemons.length} Sustaining Daemons · {upgradedModules.length} Upgraded Repo Nodes · {legacyNodes.length} Active Bridges
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clusterBus.publish('main-brain', '*', 'brain.sync', 'Synchronize all 5 apps & 10 daemons', 128);
              clusterBus.pingAllLegacyFrames();
            }}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sync All Nodes
          </button>
          <button
            type="button"
            onClick={() => {
              clusterBus.publish('main-brain', 'audio-dsp', 'brain.harmonic', 'Trigger brain-to-DSP pulse', 96);
              clusterBus.publish('main-brain', 'gl-compositor', 'brain.shader', 'Align obsidian shader phase', 96);
              clusterBus.publish('main-brain', 'binary-indexer', 'brain.verify', 'Verify MGE1 state integrity', 96);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Broadcast Brain Pulse
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 p-3 rounded-lg bg-black/45 border border-white/[0.08] flex flex-col">
          <div className="flex items-center justify-between px-1 pb-2 text-[11px] text-slate-400 font-mono">
            <span>Blue: Core Apps · Gray: Daemons · Amber: Upgraded · Green: Live Mounted</span>
            <span className="tabular-nums">{packets.length} buffered</span>
          </div>
          <canvas ref={canvasRef} width={600} height={350} className="w-full h-[330px] rounded bg-[#03050a]" />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <form onSubmit={handleBroadcast} className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-3">
            <h4 className="text-xs font-semibold text-slate-200">Inject Cluster IPC Packet</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-[11px] text-slate-400 space-y-1">
                <span>Source Node</span>
                <select
                  value={fromNode}
                  onChange={(e) => {
                    setFromNode(e.target.value);
                    setSelectedNodeId(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-black/60 border border-white/[0.1] text-slate-100"
                >
                  {allNodes.map((n) => (
                    <option key={n.key} value={n.id}>
                      {n.group === 'daemon' ? `${n.label} (daemon)` : n.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] text-slate-400 space-y-1">
                <span>Target Node</span>
                <select
                  value={toNode}
                  onChange={(e) => setToNode(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-black/60 border border-white/[0.1] text-slate-100"
                >
                  <option value="*">* (All Nodes)</option>
                  {allNodes.map((n) => (
                    <option key={n.key} value={n.id}>
                      {n.group === 'daemon' ? `${n.label} (daemon)` : n.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="col-span-1 text-[11px] text-slate-400 space-y-1">
                <span>Topic</span>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-black/60 border border-white/[0.1] text-slate-100"
                />
              </label>
              <label className="col-span-2 text-[11px] text-slate-400 space-y-1">
                <span>Payload Summary</span>
                <input
                  type="text"
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded bg-black/60 border border-white/[0.1] text-slate-100"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2 text-xs font-medium rounded-md bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 cursor-pointer"
            >
              Emit IPC Message
            </button>
          </form>

          <div className="flex-1 min-h-[160px] p-3.5 rounded-lg bg-white/[0.025] border border-white/[0.08] flex flex-col">
            <h4 className="text-xs font-semibold text-slate-200 mb-2">Live Inter-App Message Stream</h4>
            <div className="flex-1 max-h-[165px] overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {packets.slice(0, 20).map((pkt) => (
                <div
                  key={pkt.id}
                  className="flex items-baseline justify-between gap-2 py-1 border-b border-white/[0.04] text-slate-300"
                >
                  <div className="truncate">
                    <span className="text-sky-300">{pkt.from}</span>
                    <span className="text-slate-500"> → </span>
                    <span className="text-slate-200">{pkt.to}</span>
                    <span className="text-slate-500"> · </span>
                    <span className="text-amber-300/90">{pkt.topic}</span>
                  </div>
                  <span className="text-slate-400 truncate max-w-[160px]">{pkt.payloadSummary}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
