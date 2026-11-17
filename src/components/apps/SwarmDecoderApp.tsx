import { useState } from 'react';
import type { DecodedFrame } from '../../kernel/types';

interface SwarmDecoderAppProps {
  frames: DecodedFrame[];
}

export function SwarmDecoderApp({ frames }: SwarmDecoderAppProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'decoded' | 'hex' | 'csv'>('decoded');

  const active = frames.find((f) => f.id === selectedId) || frames[0] || null;

  if (!active) {
    return (
      <div className="p-6 text-xs text-slate-400">
        No decoded frames yet. Submit data via Swarm Ingestor.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Lexical &amp; Binary Decoder</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
            Frame #{active.id} · {active.sourceLabel} · Format {active.detectedFormat.toUpperCase()} · {active.fnvHex}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          {(['decoded', 'hex', 'csv'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setViewMode(tab)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize cursor-pointer ${
                viewMode === tab
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab === 'hex' ? 'Hex Matrix' : tab === 'csv' ? 'Table' : 'Decoded'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Detected Format</div>
          <div className="mt-1 font-mono text-sm font-semibold text-sky-300">{active.detectedFormat}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Decoded Size</div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{active.decodedByteLength} B</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Shannon Entropy</div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{active.entropyBits} bits/B</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">ASCII Density</div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{active.asciiRatioPct}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-2 max-h-[290px] overflow-y-auto">
          <h4 className="text-xs font-semibold text-slate-300">Recent Frames ({frames.length})</h4>
          {frames.slice(0, 14).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`w-full p-2.5 rounded-lg text-left border transition-colors cursor-pointer ${
                active.id === f.id
                  ? 'bg-sky-500/15 border-sky-400/40'
                  : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/[0.07]'
              }`}
            >
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-slate-200 truncate">#{f.id} {f.sourceLabel}</span>
                <span className="text-sky-300 shrink-0">{f.detectedFormat}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{f.fnvHex}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 p-3.5 rounded-lg bg-black/55 border border-white/[0.08] max-h-[290px] overflow-auto">
          {viewMode === 'decoded' && (
            <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-words">
              {active.structuredJson || active.decodedText || '(empty payload)'}
            </pre>
          )}

          {viewMode === 'hex' && (
            <div className="font-mono text-[11px] space-y-1">
              {active.hexPreviewRows.map((row) => (
                <div key={row.offset} className="flex gap-3 whitespace-nowrap">
                  <span className="text-sky-400/80">{row.offset}</span>
                  <span className="text-slate-300">{row.bytes.join(' ')}</span>
                  <span className="text-slate-500 border-l border-white/[0.08] pl-2">{row.ascii}</span>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'csv' && (
            active.csvPreview ? (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <tbody>
                  {active.csvPreview.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/[0.06]">
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-1.5 px-2 text-slate-200">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-slate-400">
                Tabular view activates when CSV/delimited streams are decoded.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
