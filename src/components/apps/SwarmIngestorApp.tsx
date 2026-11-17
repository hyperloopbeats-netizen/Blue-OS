import { useState } from 'react';
import { binaryStateEngine } from '../../kernel/BinaryStateEngine';
import { clusterBus } from '../../kernel/ClusterBus';
import { swarmDecoderEngine } from '../../kernel/SwarmDecoderEngine';
import type { DecodedFrame } from '../../kernel/types';

interface SwarmIngestorAppProps {
  frames: DecodedFrame[];
  onOpenDecoder: () => void;
}

const SAMPLES: { label: string; payload: string }[] = [
  {
    label: 'Base64',
    payload: 'TGlxdWlkIE9TIDEyMEh6IFN3YXJtIERlY29kZXI', // intentionally missing '=' padding so healer repairs it!
  },
  {
    label: 'Hex',
    payload: '4d 47 45 31 20 53 77 61 72 6d 20 44 65 63 6f 64 65 72',
  },
  {
    label: 'Binary Bits',
    payload: '01001100 01101001 01110001 01110101 01101001 01100100',
  },
  {
    label: 'Broken JSON',
    payload: '{"engine":"matrix-game-engine","fps":120,"nodes":["brain","swarm",],',
  },
  {
    label: 'CSV Stream',
    payload: 'node,hz,status\nkclock-120,120,locked\nsh-ingest-guard,60,nominal\nfold-runner,120,active',
  },
];

export function SwarmIngestorApp({ frames, onOpenDecoder }: SwarmIngestorAppProps) {
  const [rawInput, setRawInput] = useState(
    '{"signal":"hyper-awareness","radix":"auto","payload":"4d474531"}'
  );
  const [sourceTag, setSourceTag] = useState('user-stream');

  const handleDecode = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!rawInput.trim()) return;
    swarmDecoderEngine.decodeInput(rawInput, sourceTag.trim() || 'manual-input');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    swarmDecoderEngine.decodeBinaryBytes(new Uint8Array(buf), `file:${file.name}`);
    e.target.value = '';
  };

  const handlePullMgeChunk = () => {
    const buf = binaryStateEngine.rawBuffer;
    if (!buf) return;
    const slice = new Uint8Array(buf, 0, Math.min(256, buf.byteLength));
    swarmDecoderEngine.decodeBinaryBytes(slice, 'MGE1-header-block');
  };

  const handleSniffPacket = () => {
    const pkt = clusterBus.getRecentPackets(1)[0];
    if (!pkt) return;
    const json = JSON.stringify(pkt);
    setRawInput(json);
    setSourceTag(`bus:#${pkt.id}`);
    swarmDecoderEngine.decodeInput(json, `bus:${pkt.from}`);
  };

  const latest = frames[0];

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Swarm Ingestor — Universal Data Intake</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Accepts JSON, Hex, Base64, Binary bitstreams, CSV, code, or any uploaded binary file
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePullMgeChunk}
            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 cursor-pointer"
          >
            Pull MGE1 Binary
          </button>
          <button
            type="button"
            onClick={handleSniffPacket}
            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 cursor-pointer"
          >
            Sniff Bus Packet
          </button>
          <button
            type="button"
            onClick={onOpenDecoder}
            className="px-3 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 cursor-pointer"
          >
            Open Decoder View
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">Load sample:</span>
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setRawInput(s.payload);
              setSourceTag(`sample:${s.label.toLowerCase()}`);
              swarmDecoderEngine.decodeInput(s.payload, `sample:${s.label}`);
            }}
            className="px-2.5 py-1 text-xs rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 cursor-pointer"
          >
            {s.label}
          </button>
        ))}

        <label className="ml-auto px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200 cursor-pointer">
          Decode Any File
          <input type="file" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      <form onSubmit={handleDecode} className="space-y-3">
        <textarea
          rows={5}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Paste any raw text, hex, base64, binary bits, CSV, or broken JSON..."
          className="w-full p-3 rounded-lg bg-black/55 border border-white/[0.1] font-mono text-xs text-slate-100 focus:outline-none focus:border-sky-400/50"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Source Tag</span>
            <input
              type="text"
              value={sourceTag}
              onChange={(e) => setSourceTag(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono rounded bg-black/50 border border-white/[0.1] text-slate-100 w-40"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-md bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 cursor-pointer"
          >
            Decode &amp; Process Payload
          </button>
        </div>
      </form>

      {latest && (
        <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-100">
              Latest Decoded Frame #{latest.id} · {latest.detectedFormat.toUpperCase()}
            </span>
            <span className="font-mono text-slate-400 tabular-nums">
              {latest.decodedByteLength} B · Entropy {latest.entropyBits} b/B · {latest.fnvHex}
            </span>
          </div>
          <pre className="p-3 rounded bg-black/50 border border-white/[0.06] font-mono text-[11px] text-sky-200 overflow-x-auto max-h-36">
            {latest.decodedText || '(binary buffer)'}
          </pre>
        </div>
      )}
    </div>
  );
}
