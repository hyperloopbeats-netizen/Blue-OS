import { swarmDecoderEngine } from '../../kernel/SwarmDecoderEngine';
import type { DecodedFrame, SwarmProcessorHealth } from '../../kernel/types';

interface SwarmHealerAppProps {
  frames: DecodedFrame[];
  health: SwarmProcessorHealth;
}

export function SwarmHealerApp({ frames, health }: SwarmHealerAppProps) {
  const repairedFrames = frames.filter((f) => f.repairsApplied.length > 0);

  const handleTestBroken = () => {
    swarmDecoderEngine.decodeInput(
      '{"cluster":"liquid-os","daemons":[20,"self-healing",],',
      'broken-json-probe'
    );
  };

  const handleTestBrokenHex = () => {
    swarmDecoderEngine.decodeInput('0x4d4745314', 'odd-nibble-hex-probe');
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Fault &amp; Anomaly Healer</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {health.totalHealed} self-healed payloads · Last action: {health.lastRepairAction}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestBroken}
            className="px-3 py-1.5 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 cursor-pointer"
          >
            Test Broken JSON
          </button>
          <button
            type="button"
            onClick={handleTestBrokenHex}
            className="px-3 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 cursor-pointer"
          >
            Test Odd Hex
          </button>
        </div>
      </div>

      {repairedFrames.length === 0 ? (
        <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-slate-400">
          No corrupted inputs encountered yet. Use &ldquo;Test Broken JSON&rdquo; or &ldquo;Test Odd Hex&rdquo; to observe live self-healing repairs.
        </div>
      ) : (
        <div className="space-y-3">
          {repairedFrames.map((f) => (
            <div key={f.id} className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-100">
                  Frame #{f.id} · {f.sourceLabel} ({f.detectedFormat})
                </span>
                <span className="font-mono text-amber-300">{f.repairsApplied.join(' · ')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-black/50 border border-white/[0.06] text-slate-400 break-all">
                  <div className="text-slate-500 mb-1">Raw Input</div>
                  {f.rawInputPreview}
                </div>
                <div className="p-2.5 rounded bg-black/50 border border-white/[0.06] text-emerald-300 break-all">
                  <div className="text-slate-500 mb-1">Healed Output</div>
                  {f.decodedText}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
