import { useEffect, useRef, useState } from 'react';
import { audioDSP } from '../../kernel/AudioDSP';
import { clusterBus } from '../../kernel/ClusterBus';
import { liquidKernel } from '../../kernel/LiquidKernel';
import type { ShaderPreset } from '../../kernel/types';

interface LiquidStudioAppProps {
  activePreset: ShaderPreset;
  dprScale: number;
}

const PRESETS: { id: ShaderPreset; label: string; origin: string }[] = [
  { id: 'obsidian-wave', label: 'Obsidian Wave', origin: 'Cometic Engine Core' },
  { id: 'solar-fractal', label: 'Solar Fractal', origin: 'The Sun / Sun2' },
  { id: 'quantum-lattice', label: 'Quantum Lattice', origin: 'Quantum City / 1000agi' },
  { id: 'cad-wireframe', label: 'CAD Wireframe', origin: 'AutoCAD SDF Kernel' },
];

const CHORDS = [
  { label: 'Obsidian A1 (110 Hz)', freq: 110 },
  { label: 'Quantum D2 (146.8 Hz)', freq: 146.83 },
  { label: 'Solar F#3 (185 Hz)', freq: 185 },
  { label: 'Lattice A3 (220 Hz)', freq: 220 },
  { label: 'Crown E4 (329.6 Hz)', freq: 329.63 },
];

export function LiquidStudioApp({ activePreset, dprScale }: LiquidStudioAppProps) {
  const spectrumRef = useRef<HTMLCanvasElement | null>(null);
  const [droneOn, setDroneOn] = useState(audioDSP.isDroneActive);
  const [cutoff, setCutoff] = useState(audioDSP.cutoffHz);
  const [drive, setDrive] = useState(audioDSP.driveAmount);
  const [volume, setVolume] = useState(Math.round(audioDSP.masterVolume * 100));

  useEffect(() => {
    const canvas = spectrumRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const unsub = liquidKernel.subscribeFrame(() => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bins = audioDSP.bins;
      const barW = w / bins.length;
      for (let i = 0; i < bins.length; i++) {
        const amp = bins[i] / 255;
        const bh = Math.max(2, amp * (h - 10));
        ctx.fillStyle = amp > 0.55 ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)';
        ctx.fillRect(i * barW + 1, h - bh, Math.max(2, barW - 2), bh);
      }
    });

    return () => unsub();
  }, []);

  const handleToggleDrone = async () => {
    const active = await audioDSP.toggleDrone();
    setDroneOn(active);
    clusterBus.publish('liquid-studio', 'audio-dsp', 'dsp.drone', active ? 'Ambient sub drone active' : 'Drone stopped', 64);
  };

  const handleTriggerChord = async (freq: number, label: string) => {
    await audioDSP.playHarmonicPulse(freq, 0.65);
    clusterBus.publish('liquid-studio', 'gl-compositor', 'dsp.pulse', `${label} -> shader resonance`, 72);
  };

  return (
    <div className="p-5 space-y-6 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Liquid Shader &amp; Audio DSP Studio</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Fused WebGL2 kernel backdrop &amp; real-time Web Audio synthesizer · DPR {dprScale.toFixed(2)}x
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleDrone}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            droneOn
              ? 'bg-sky-500/25 border-sky-400/40 text-sky-100'
              : 'bg-white/[0.07] hover:bg-white/[0.12] border-white/[0.1] text-slate-100'
          }`}
        >
          {droneOn ? 'Stop Kernel Drone' : 'Start Kernel Drone'}
        </button>
      </div>

      <div className="space-y-2.5">
        <h4 className="text-xs font-semibold text-slate-200">Active Kernel GLSL Surface</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((preset) => {
            const selected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => liquidKernel.setShaderPreset(preset.id)}
                className={`p-3 rounded-lg text-left border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-sky-500/15 border-sky-400/40 text-slate-100'
                    : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/[0.08] text-slate-300'
                }`}
              >
                <div className="text-xs font-semibold">{preset.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{preset.origin}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-4">
          <h4 className="text-xs font-semibold text-slate-200">DSP Filter &amp; Saturation Matrix</h4>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Low-Pass Cutoff</span>
              <span className="font-mono tabular-nums text-sky-300">{cutoff} Hz</span>
            </div>
            <input
              type="range"
              min={200}
              max={16000}
              step={50}
              value={cutoff}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCutoff(v);
                audioDSP.setCutoff(v);
              }}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </label>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">WaveShaper Drive</span>
              <span className="font-mono tabular-nums text-sky-300">{drive}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={drive}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDrive(v);
                audioDSP.setDrive(v);
              }}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </label>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Master Gain</span>
              <span className="font-mono tabular-nums text-sky-300">{volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={75}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                audioDSP.setVolume(v / 100);
              }}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </label>
        </div>

        <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200">64-Bin FFT Hybrid Audio Stream</h4>
              <span className="text-[11px] font-mono text-slate-400">Synced to GLSL u_energy</span>
            </div>
            <canvas ref={spectrumRef} width={440} height={110} className="w-full h-28 rounded bg-black/50 border border-white/[0.06]" />
          </div>

          <div className="flex flex-wrap gap-2">
            {CHORDS.map((c) => (
              <button
                key={c.freq}
                type="button"
                onClick={() => handleTriggerChord(c.freq, c.label)}
                className="px-2.5 py-1.5 text-[11px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-slate-200 whitespace-nowrap cursor-pointer"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
