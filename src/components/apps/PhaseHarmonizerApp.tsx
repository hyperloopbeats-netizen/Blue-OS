import { useState } from 'react';
import { audioDSP } from '../../kernel/AudioDSP';
import { clusterBus } from '../../kernel/ClusterBus';
import { hyperFlowEngine } from '../../kernel/HyperFlowEngine';
import type { KernelMetrics } from '../../kernel/types';

interface PhaseHarmonizerAppProps {
  metrics: KernelMetrics;
}

export function PhaseHarmonizerApp({ metrics }: PhaseHarmonizerAppProps) {
  const [harmonicLock, setHarmonicLock] = useState(metrics.flowState.harmonicLock);
  const [autoRoute, setAutoRoute] = useState(metrics.flowState.autoHarmonicRoute);
  const [phaseGain, setPhaseGain] = useState(metrics.flowState.phaseGain);

  const toggleLock = () => {
    const next = !harmonicLock;
    setHarmonicLock(next);
    hyperFlowEngine.flowState.harmonicLock = next;
    clusterBus.publish('phase-harmonizer', 'phase-aligner', 'phase.lock', next ? '120Hz Phase Locked' : 'Free Phase', 64);
  };

  const toggleAutoRoute = () => {
    const next = !autoRoute;
    setAutoRoute(next);
    hyperFlowEngine.flowState.autoHarmonicRoute = next;
    clusterBus.publish('phase-harmonizer', 'predictive-router', 'phase.route', next ? 'Auto-Route Enabled' : 'Manual', 64);
  };

  const handlePhasePulse = async () => {
    const baseHz = 110 + (metrics.foldResult.foldedWords[0] % 220);
    await audioDSP.playHarmonicPulse(baseHz, 0.55);
    clusterBus.publish('phase-harmonizer', '*', 'phase.pulse', `Aligned @ ${baseHz}Hz`, 96);
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Phase Harmonizer — Hybrid Flow Sync</h3>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Locks 120Hz Kernel · AudioDSP · GLSL Surface · FoldRunner Micro Game
          </p>
        </div>

        <button
          type="button"
          onClick={handlePhasePulse}
          className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
        >
          Emit Harmonic Lock Pulse
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Phase Angle</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-sky-300">
            {metrics.flowState.phaseAngleRad.toFixed(3)} rad
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Audio Energy</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {Math.round(metrics.audioEnergy * 100)}%
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Shader Surface</div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-100 truncate">{metrics.shaderPreset}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="text-xs text-slate-400">Game Fold Depth</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-300">
            x{metrics.flowState.gameFoldDepth}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-4">
        <label className="block space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Phase Velocity Multiplier</span>
            <span className="font-mono tabular-nums text-sky-300">{phaseGain.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={3.0}
            step={0.05}
            value={phaseGain}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPhaseGain(v);
              hyperFlowEngine.flowState.phaseGain = v;
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleLock}
            className={`px-3.5 py-2 text-xs font-medium rounded border cursor-pointer ${
              harmonicLock
                ? 'bg-sky-500/20 border-sky-400/35 text-sky-200'
                : 'bg-white/[0.05] border-white/[0.1] text-slate-300'
            }`}
          >
            {harmonicLock ? '120Hz Phase Lock: Engaged' : '120Hz Phase Lock: Free'}
          </button>

          <button
            type="button"
            onClick={toggleAutoRoute}
            className={`px-3.5 py-2 text-xs font-medium rounded border cursor-pointer ${
              autoRoute
                ? 'bg-emerald-500/20 border-emerald-400/35 text-emerald-200'
                : 'bg-white/[0.05] border-white/[0.1] text-slate-300'
            }`}
          >
            {autoRoute ? 'Auto-Harmonic Routing: Active' : 'Auto-Harmonic Routing: Off'}
          </button>
        </div>
      </div>
    </div>
  );
}
