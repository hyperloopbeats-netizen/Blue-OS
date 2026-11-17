import { useEffect, useState } from 'react';
import { binaryStateEngine } from '../../kernel/BinaryStateEngine';
import { clusterBus } from '../../kernel/ClusterBus';
import { swarmDecoderEngine } from '../../kernel/SwarmDecoderEngine';
import type { DecodedFrame } from '../../kernel/types';

interface SwarmStreamerAppProps {
  frames: DecodedFrame[];
}

export function SwarmStreamerApp({ frames }: SwarmStreamerAppProps) {
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!streaming) return;
    let cursor = 0;
    const timer = setInterval(() => {
      const buf = binaryStateEngine.rawBuffer;
      if (buf && buf.byteLength > 64) {
        const offset = (cursor * 96) % Math.max(64, buf.byteLength - 96);
        const slice = new Uint8Array(buf, offset, 96);
        swarmDecoderEngine.decodeBinaryBytes(slice, `mge1-stream@${offset}`);
      } else {
        const pkt = clusterBus.getRecentPackets(1)[0];
        if (pkt) swarmDecoderEngine.decodeInput(JSON.stringify(pkt), `bus-stream#${pkt.id}`);
      }
      cursor++;
    }, 650);

    return () => clearInterval(timer);
  }, [streaming]);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(frames, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swarm-decoded-frames.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Swarm Streamer — Continuous Batch Decoder</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Continuously ingests MGE1 binary segments and Main Brain packets · {frames.length} buffered frames
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStreaming((s) => !s)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded border cursor-pointer ${
              streaming
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/35 text-sky-200'
            }`}
          >
            {streaming ? 'Pause Stream' : 'Start Live Stream'}
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 cursor-pointer"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto rounded-lg border border-white/[0.08]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#080c14] border-b border-white/[0.08] text-slate-400">
            <tr>
              <th className="py-2 px-3">ID</th>
              <th className="py-2 px-3">Source</th>
              <th className="py-2 px-3">Format</th>
              <th className="py-2 px-3 text-right">Bytes</th>
              <th className="py-2 px-3 text-right">Entropy</th>
              <th className="py-2 px-3">Digest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] font-mono">
            {frames.map((f) => (
              <tr key={f.id}>
                <td className="py-2 px-3 tabular-nums text-slate-400">#{f.id}</td>
                <td className="py-2 px-3 text-slate-200 truncate max-w-[160px]">{f.sourceLabel}</td>
                <td className="py-2 px-3 text-sky-300">{f.detectedFormat}</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-300">{f.decodedByteLength}</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-300">{f.entropyBits}</td>
                <td className="py-2 px-3 text-slate-400">{f.fnvHex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
