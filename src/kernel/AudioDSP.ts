export class AudioDSP {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private masterGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  public readonly bins = new Uint8Array(64);
  public isRunning = false;
  public isDroneActive = false;
  public cutoffHz = 3600;
  public driveAmount = 18;
  public masterVolume = 0.22;
  public normalizedEnergy = 0;

  public async ensureContext(): Promise<boolean> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.isRunning = this.ctx.state === 'running';
      return this.isRunning;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.78;

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = this.cutoffHz;
      this.filter.Q.value = 3.2;

      this.shaper = ctx.createWaveShaper();
      this.shaper.curve = this.makeDistortionCurve(this.driveAmount);

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;

      this.shaper.connect(this.filter);
      this.filter.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.isRunning = ctx.state === 'running';
      return this.isRunning;
    } catch {
      return false;
    }
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 44100;
    const buffer = new ArrayBuffer(n * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  public setCutoff(hz: number): void {
    this.cutoffHz = Math.max(180, Math.min(18000, hz));
    if (this.filter && this.ctx) {
      this.filter.frequency.setTargetAtTime(this.cutoffHz, this.ctx.currentTime, 0.03);
    }
  }

  public setDrive(amount: number): void {
    this.driveAmount = Math.max(0, Math.min(100, amount));
    if (this.shaper) {
      this.shaper.curve = this.makeDistortionCurve(this.driveAmount);
    }
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(0.8, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.03);
    }
  }

  public async toggleDrone(): Promise<boolean> {
    const ok = await this.ensureContext();
    if (!ok || !this.ctx || !this.shaper) return false;

    if (this.isDroneActive) {
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      }
      const oldA = this.droneOscA;
      const oldB = this.droneOscB;
      setTimeout(() => {
        try {
          oldA?.stop();
          oldB?.stop();
        } catch {
          // ignore
        }
      }, 220);
      this.droneOscA = null;
      this.droneOscB = null;
      this.droneGain = null;
      this.isDroneActive = false;
      return false;
    }

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.25);

    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(55, now); // A1 obsidian sub

    const oscB = this.ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(110.5, now);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.shaper);

    oscA.start(now);
    oscB.start(now);

    this.droneOscA = oscA;
    this.droneOscB = oscB;
    this.droneGain = gain;
    this.isDroneActive = true;
    return true;
  }

  public async playHarmonicPulse(freqHz = 220, durationSec = 0.45): Promise<void> {
    const ok = await this.ensureContext();
    if (!ok || !this.ctx || !this.shaper) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freqHz, now);
    osc2.frequency.setValueAtTime(freqHz * 1.498, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.shaper);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.02);
    osc2.stop(now + durationSec + 0.02);
  }

  public sampleEnergy(syntheticPulse = 0): number {
    if (this.analyser && this.isRunning) {
      this.analyser.getByteFrequencyData(this.bins);
      let sum = 0;
      for (let i = 0; i < this.bins.length; i++) {
        sum += this.bins[i];
      }
      const realEnergy = sum / (this.bins.length * 255);
      this.normalizedEnergy = Math.max(realEnergy, syntheticPulse * 0.25);
      return this.normalizedEnergy;
    }

    // Deterministic kernel harmonic fallback when Web Audio has not been user-unlocked yet
    for (let i = 0; i < this.bins.length; i++) {
      const wave = Math.sin(syntheticPulse * 0.1 + i * 0.28) * 0.5 + 0.5;
      this.bins[i] = Math.round(wave * 64);
    }
    this.normalizedEnergy = 0.12 + Math.sin(syntheticPulse * 0.05) * 0.04;
    return this.normalizedEnergy;
  }
}

export const audioDSP = new AudioDSP();
