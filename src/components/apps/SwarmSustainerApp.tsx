import { useState } from 'react';
import { liquidKernel } from '../../kernel/LiquidKernel';
import { swarmDecoderEngine } from '../../kernel/SwarmDecoderEngine';
import type { DaemonSnapshot, SwarmProcessorHealth } from '../../kernel/types';

interface SwarmSustainerAppProps {
  health: SwarmProcessorHealth;
  daemons: DaemonSnapshot[];
}

export function SwarmSustainerApp({ health, daemons }: SwarmSustainerAppProps) {
  const swarmDaemons = daemons.filter((d) => d.group === 'swarm');
  const [autoHeal, setAutoHeal] = useState(health.autoHealEnabled);
  const [budgetMs, setBudgetMs] = useState(health.quantumBudgetMs);

  const handleToggleAutoHeal = () => {
    const next = !autoHeal;
    setAutoHeal(next);
    swarmDecoderEngine.health.autoHealEnabled = next;
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Swarm Sustainer — Processor &amp; 20 Self-Healing Daemons
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Sustains the 5-app Sentient Swarm Decoder within the 120Hz kernel · {swarmDaemons.length} self-healing daemons
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => swarmDecoderEngine.injectFault()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 cursor-pointer"
          >
            Inject Fault
          </button>
          <button
            type="button"
            onClick={() => swarmDecoderEngine.boostSustain()}
            className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-200 cursor-pointer"
          >
            Boost Sustain
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Processor Health</div>
          <div
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              health.healthPct >= 90 ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {health.healthPct}%
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {health.healthPct < 100 ? 'Self-healing active' : 'Nominal'}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Swarm Load</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">{health.loadPct}%</div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">Budget {budgetMs.toFixed(1)} ms</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Total Decoded</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">{health.totalDecoded}</div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">Queue {health.queueDepth}/48</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Self-Healed Faults</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-300">{health.totalHealed}</div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{health.injectedFaults} injected</div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
        <label className="flex-1 min-w-[220px] space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Decode Quantum Slice Budget</span>
            <span className="font-mono tabular-nums text-sky-300">{budgetMs.toFixed(1)} ms / 8.33 ms</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={6.0}
            step={0.2}
            value={budgetMs}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBudgetMs(v);
              swarmDecoderEngine.health.quantumBudgetMs = v;
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </label>

        <button
          type="button"
          onClick={handleToggleAutoHeal}
          className={`px-3.5 py-2 text-xs font-medium rounded border cursor-pointer ${
            autoHeal
              ? 'bg-emerald-500/20 border-emerald-400/35 text-emerald-200'
              : 'bg-white/[0.05] border-white/[0.1] text-slate-300'
          }`}
        >
          {autoHeal ? 'Auto-Heal Sustain: Active' : 'Auto-Heal Sustain: Paused'}
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-semibold text-slate-200">
            20 Self-Healing Swarm Daemons ({swarmDaemons.filter((d) => d.state !== 'paused').length}/20 Active)
          </h4>
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[280px]">
            {health.lastRepairAction}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {swarmDaemons.map((d) => (
            <div key={d.id} className="p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.07] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-slate-100 truncate">{d.name}</span>
                <span
                  className={`font-mono text-[10px] shrink-0 ${
                    d.state === 'running'
                      ? 'text-emerald-400'
                      : d.state === 'healing'
                        ? 'text-amber-300'
                        : 'text-slate-500'
                  }`}
                >
                  {d.state} · {d.targetHz}Hz
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">{d.role}</div>
              <div className="flex items-center justify-between pt-0.5 text-[10px] font-mono text-slate-500">
                <span className="truncate">{d.lastSummary}</span>
                <button
                  type="button"
                  onClick={() => liquidKernel.toggleDaemon(d.id)}
                  className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 shrink-0 ml-1.5 cursor-pointer"
                >
                  {d.state === 'paused' ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
