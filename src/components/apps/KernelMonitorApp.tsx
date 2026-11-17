import { useEffect, useRef } from 'react';
import { liquidKernel } from '../../kernel/LiquidKernel';
import type { KernelMetrics, PacingMode } from '../../kernel/types';

interface KernelMonitorAppProps {
  metrics: KernelMetrics;
}

const PACING_OPTIONS: { id: PacingMode; label: string }[] = [
  { id: 'hybrid-120', label: 'Hybrid 120Hz Lock' },
  { id: 'vsync-lock', label: 'VSync Step' },
  { id: 'burst-test', label: 'Burst Overdrive' },
];

export function KernelMonitorApp({ metrics }: KernelMonitorAppProps) {
  const scopeRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = scopeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Reference 8.33ms (120Hz) and 16.67ms (60Hz) guide lines
    const y8 = h - (8.333 / 24) * h;
    const y16 = h - (16.667 / 24) * h;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y8);
    ctx.lineTo(w, y8);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, y16);
    ctx.lineTo(w, y16);
    ctx.stroke();
    ctx.setLineDash([]);

    const hist = metrics.frameHistory;
    if (hist.length < 2) return;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const x = (i / (hist.length - 1)) * w;
      const clamped = Math.min(24, Math.max(1, hist[i]));
      const y = h - (clamped / 24) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [metrics.frameHistory, metrics.totalTicks]);

  return (
    <div className="p-5 space-y-6 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">120Hz Fixed-Quantum Kernel</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            8.333ms hybrid sub-frame scheduler · DPR {metrics.dprScale.toFixed(2)}x · {metrics.totalTicks.toLocaleString()} ticks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
            {PACING_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => liquidKernel.setPacingMode(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metrics.pacingMode === opt.id
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => liquidKernel.triggerManualHeal()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Run Self-Heal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Kernel Frequency</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">
            {metrics.kernelTickHz} Hz
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">Target 120 Hz</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Compositor Render</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {metrics.renderFps} FPS
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">{metrics.lastFrameMs} ms frame</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Quantum Jitter</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {metrics.jitterUs} us
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">Budget {metrics.budgetUsedPct}%</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <div className="text-xs text-slate-400">Cluster Throughput</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {metrics.busMessagesPerSec} msg/s
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">{metrics.healEvents} heals applied</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-4 rounded-lg bg-white/[0.025] border border-white/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-200">Frame-Time Oscilloscope</h4>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">8.33ms dashed · 0–24ms</span>
          </div>
          <canvas ref={scopeRef} width={480} height={110} className="w-full h-28 rounded bg-black/40 border border-white/[0.05]" />
        </div>

        <div className="p-4 rounded-lg bg-white/[0.025] border border-white/[0.07]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-200">Pure Hybrid Stream Multiplexer</h4>
            <span className="text-[11px] font-mono text-slate-400">4 locked channels</span>
          </div>
          <div className="space-y-2.5">
            {metrics.streams.map((stream) => (
              <div key={stream.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">{stream.label}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {stream.active ? 'Active' : 'Standby'} · {stream.rateHz} Hz · {stream.throughputKBps} KB/s
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${stream.active ? 'bg-sky-400' : 'bg-slate-600'}`}
                    style={{ width: `${stream.bufferFillPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-200">Kernel Daemons ({metrics.daemons.length})</h4>
          <span className="text-xs text-slate-400">Deterministic tick-divider schedule</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03] text-slate-400">
                <th className="py-2.5 px-3 font-medium">Daemon</th>
                <th className="py-2.5 px-3 font-medium">State</th>
                <th className="py-2.5 px-3 font-medium text-right">Rate</th>
                <th className="py-2.5 px-3 font-medium text-right">Ticks</th>
                <th className="py-2.5 px-3 font-medium text-right">Exec</th>
                <th className="py-2.5 px-3 font-medium">Last Telemetry</th>
                <th className="py-2.5 px-3 font-medium text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {metrics.daemons.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.025]">
                  <td className="py-2 px-3">
                    <div className="font-mono font-medium text-slate-100">{d.name}</div>
                    <div className="text-[11px] text-slate-500">{d.role}</div>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-mono text-[11px] ${
                        d.state === 'running'
                          ? 'text-emerald-400'
                          : d.state === 'healing'
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {d.state}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">{d.targetHz} Hz</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">
                    {d.ticks.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">{d.lastExecUs} us</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-300 max-w-[220px] truncate">
                    {d.lastSummary}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => liquidKernel.toggleDaemon(d.id)}
                      className="px-2 py-1 text-[11px] rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 mr-1.5 cursor-pointer"
                    >
                      {d.state === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => liquidKernel.stepDaemon(d.id)}
                      className="px-2 py-1 text-[11px] rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 cursor-pointer"
                    >
                      Step
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
