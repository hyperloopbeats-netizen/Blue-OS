import { useMemo, useState } from 'react';
import { binaryStateEngine } from '../../kernel/BinaryStateEngine';
import { clusterBus } from '../../kernel/ClusterBus';
import type { BinaryRecordView, BinaryStateHeader, RepoManifest } from '../../kernel/types';

interface BinaryVaultAppProps {
  manifest: RepoManifest | null;
  header: BinaryStateHeader | null;
  records: BinaryRecordView[];
  upgradedIds: Set<string>;
  onPersistCheckpoint: () => void;
  lastSavedAt: number | null;
}

export function BinaryVaultApp({
  manifest,
  header,
  records,
  upgradedIds,
  onPersistCheckpoint,
  lastSavedAt,
}: BinaryVaultAppProps) {
  const [inspectOffset, setInspectOffset] = useState<number>(0);
  const [selectedName, setSelectedName] = useState<string>('Header (MGE1)');
  const [query, setQuery] = useState<string>('');

  const hexRows = useMemo(() => {
    return binaryStateEngine.readHexSlice(inspectOffset, 192);
  }, [inspectOffset, header]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.name.toLowerCase().includes(q) || r.fnvHex.toLowerCase().includes(q));
  }, [records, query]);

  const handleDownloadBinary = () => {
    const blob = binaryStateEngine.exportBinaryBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matrix-game-engine-state.bin';
    a.click();
    URL.revokeObjectURL(url);
    clusterBus.publish('binary-vault', 'vault-persister', 'binary.export', 'Exported MGE1 binary image', 96);
  };

  if (!manifest || !header) {
    return (
      <div className="p-6 text-xs text-slate-400">
        Ingesting repository source files into packed MGE1 binary state...
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Repository Binary State Image ({header.magic})</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {manifest.repository} · {header.moduleCount} modules · {(manifest.binaryTotalBytes / 1024).toFixed(1)} KB packed · Checksum {header.globalHashHex}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPersistCheckpoint}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Invest Checkpoint
          </button>
          <button
            type="button"
            onClick={handleDownloadBinary}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Export .bin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Packed Binary Footprint</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-100">
            {manifest.binaryTotalBytes.toLocaleString()} B
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500">32B hdr + {header.moduleCount}x64B table</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Global FNV-1a Hash</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-sky-300">{header.globalHashHex}</div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500">Verified by binary-indexer</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Capability Vector</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-100">
            0x{header.combinedCapMask.toString(16).padStart(4, '0').toUpperCase()}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 truncate">{manifest.combinedCapabilities.join(' · ')}</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Invested Upgrades</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-300">
            {upgradedIds.size} / {header.moduleCount}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500">
            {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Live in RAM'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold text-slate-200">Binary Descriptor Table</h4>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter module or hash..."
              className="px-2.5 py-1 text-xs rounded bg-black/50 border border-white/[0.1] text-slate-100 w-48"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-white/[0.08]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#080c14] border-b border-white/[0.08] text-slate-400">
                <tr>
                  <th className="py-2 px-3 font-medium">Module</th>
                  <th className="py-2 px-3 font-medium">FNV-1a</th>
                  <th className="py-2 px-3 font-medium text-right">Offset</th>
                  <th className="py-2 px-3 font-medium text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                <tr
                  onClick={() => {
                    setInspectOffset(0);
                    setSelectedName('Header (MGE1)');
                  }}
                  className="cursor-pointer hover:bg-white/[0.04]"
                >
                  <td className="py-2 px-3 font-mono text-sky-300">00. MGE1 Header &amp; Table</td>
                  <td className="py-2 px-3 font-mono text-slate-400">{header.globalHashHex}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">0x000000</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">
                    {32 + header.moduleCount * 64} B
                  </td>
                </tr>
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.name}
                    onClick={() => {
                      setInspectOffset(rec.payloadOffset);
                      setSelectedName(rec.name);
                    }}
                    className={`cursor-pointer hover:bg-white/[0.04] ${
                      selectedName === rec.name ? 'bg-sky-500/10' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-medium text-slate-200">{rec.name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{rec.fnvHex}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">
                      0x{rec.payloadOffset.toString(16).padStart(6, '0').toUpperCase()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">
                      {(rec.payloadLength / 1024).toFixed(1)} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200">Hex State Inspector — {selectedName}</h4>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              Offset 0x{inspectOffset.toString(16).padStart(6, '0').toUpperCase()}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-black/60 border border-white/[0.08] font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto">
            {hexRows.map((row) => (
              <div key={row.offsetHex} className="flex gap-3 whitespace-nowrap">
                <span className="text-sky-400/80 select-none">{row.offsetHex}</span>
                <span className="text-slate-300">{row.hexBytes.join(' ')}</span>
                <span className="text-slate-500 pl-2 border-l border-white/[0.08]">{row.ascii}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
