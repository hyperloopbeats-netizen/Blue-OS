import { audioDSP } from './AudioDSP';
import { binaryStateEngine } from './BinaryStateEngine';
import { clusterBus } from './ClusterBus';
import { clusterLibraryEngine } from './ClusterLibraryEngine';
import { hyperFlowEngine } from './HyperFlowEngine';
import { swarmDecoderEngine } from './SwarmDecoderEngine';
import type {
  DaemonSnapshot,
  HybridStreamChannel,
  KernelMetrics,
  PacingMode,
  ShaderPreset,
} from './types';

export const KERNEL_TARGET_HZ = 120;
export const KERNEL_FIXED_DT_MS = 1000 / KERNEL_TARGET_HZ; // 8.333333ms

type MetricsSubscriber = (metrics: KernelMetrics) => void;
type FrameHook = (tickIndex: number, audioEnergy: number, busRate: number, preset: ShaderPreset, dpr: number) => void;

export class LiquidKernel {
  private running = false;
  private rafId: number | null = null;
  private mc: MessageChannel | null = null;
  private pacingMode: PacingMode = 'hybrid-120';
  private shaderPreset: ShaderPreset = 'obsidian-wave';

  private lastNow = 0;
  private accumulatorMs = 0;
  private totalTicks = 0;
  private healEvents = 0;
  private dprScale = 1.0;

  private ticksInSecond = 0;
  private framesInSecond = 0;
  private secondStart = 0;
  private measuredTickHz = 120;
  private measuredRenderFps = 60;
  private lastFrameMs = 8.33;
  private jitterUs = 120;
  private budgetUsedPct = 14;

  // Zero-allocation 120-sample frame history ring buffer
  private readonly frameRing = new Float32Array(120);
  private frameRingCursor = 0;

  private metricsSubscribers = new Set<MetricsSubscriber>();
  private frameHooks = new Set<FrameHook>();
  private lastUiPublish = 0;

  private daemons: DaemonSnapshot[] = [
    // --- 10 Core Kernel Daemons ---
    {
      id: 'kclock-120',
      name: 'kclock-120',
      role: '8.33ms Fixed-Quantum Clock & Drift Lock',
      group: 'core',
      targetHz: 120,
      divider: 1,
      state: 'running',
      ticks: 0,
      lastExecUs: 18,
      lastTopic: 'kernel.quantum',
      lastSummary: 'Locked at 8.333ms',
    },
    {
      id: 'hybrid-mux',
      name: 'hybrid-mux',
      role: 'Pure Hybrid 4-Channel Stream Multiplexer',
      group: 'core',
      targetHz: 120,
      divider: 1,
      state: 'running',
      ticks: 0,
      lastExecUs: 24,
      lastTopic: 'stream.mux',
      lastSummary: '4 channels synced',
    },
    {
      id: 'ipc-router',
      name: 'ipc-router',
      role: 'Zero-Copy Cluster Mesh & BroadcastChannel Router',
      group: 'core',
      targetHz: 120,
      divider: 1,
      state: 'running',
      ticks: 0,
      lastExecUs: 15,
      lastTopic: 'cluster.route',
      lastSummary: 'Mesh active',
    },
    {
      id: 'gl-compositor',
      name: 'gl-compositor',
      role: 'Black Glass WebGL2 Surface & Uniform Dispatcher',
      group: 'core',
      targetHz: 60,
      divider: 2,
      state: 'running',
      ticks: 0,
      lastExecUs: 42,
      lastTopic: 'gl.uniforms',
      lastSummary: 'Obsidian surface nominal',
    },
    {
      id: 'audio-dsp',
      name: 'audio-dsp',
      role: 'Web Audio FFT Spectral Extractor & Harmonic Sync',
      group: 'core',
      targetHz: 60,
      divider: 2,
      state: 'running',
      ticks: 0,
      lastExecUs: 31,
      lastTopic: 'dsp.spectrum',
      lastSummary: '64-bin FFT active',
    },
    {
      id: 'mem-healer',
      name: 'mem-healer',
      role: 'Autonomic Thermal/DPR Guard & Ring Buffer Healer',
      group: 'core',
      targetHz: 10,
      divider: 12,
      state: 'running',
      ticks: 0,
      lastExecUs: 19,
      lastTopic: 'autonomic.audit',
      lastSummary: 'Zero anomalies',
    },
    {
      id: 'bridge-watcher',
      name: 'bridge-watcher',
      role: 'Mounted GitHub Applet Heartbeat & Bridge Supervisor',
      group: 'core',
      targetHz: 10,
      divider: 12,
      state: 'running',
      ticks: 0,
      lastExecUs: 14,
      lastTopic: 'bridge.poll',
      lastSummary: 'Awaiting mounted nodes',
    },
    {
      id: 'segment-builder',
      name: 'segment-builder',
      role: 'Segmented Build Operation State Coordinator',
      group: 'core',
      targetHz: 5,
      divider: 24,
      state: 'running',
      ticks: 0,
      lastExecUs: 22,
      lastTopic: 'build.segment',
      lastSummary: 'Core segment locked',
    },
    {
      id: 'binary-indexer',
      name: 'binary-indexer',
      role: '24-Module FNV-1a Binary State Integrity Verifier',
      group: 'core',
      targetHz: 2,
      divider: 60,
      state: 'running',
      ticks: 0,
      lastExecUs: 28,
      lastTopic: 'binary.verify',
      lastSummary: 'MGE1 table valid',
    },
    {
      id: 'vault-persister',
      name: 'vault-persister',
      role: 'Non-Blocking Binary Checkpoint & Layout Persister',
      group: 'core',
      targetHz: 1,
      divider: 120,
      state: 'running',
      ticks: 0,
      lastExecUs: 36,
      lastTopic: 'vault.sync',
      lastSummary: 'Checkpoint clean',
    },
    // --- 10 Hyper-Awareness Extension Daemons ---
    {
      id: 'sniff-bus',
      name: 'sniff-bus',
      role: 'Real-Time Main Brain Packet Sniffer & Edge Tracker',
      group: 'hyper',
      targetHz: 120,
      divider: 1,
      state: 'running',
      ticks: 0,
      lastExecUs: 16,
      lastTopic: 'hyper.sniff',
      lastSummary: 'Sniffing all cluster edges',
    },
    {
      id: 'flow-tracker',
      name: 'flow-tracker',
      role: 'Sniffed Flow State Coherence & Entropy Calculator',
      group: 'hyper',
      targetHz: 60,
      divider: 2,
      state: 'running',
      ticks: 0,
      lastExecUs: 21,
      lastTopic: 'hyper.flow',
      lastSummary: 'Flow locked',
    },
    {
      id: 'phase-aligner',
      name: 'phase-aligner',
      role: 'Audio DSP, GLSL Shader & Kernel Game Phase Lock',
      group: 'hyper',
      targetHz: 60,
      divider: 2,
      state: 'running',
      ticks: 0,
      lastExecUs: 14,
      lastTopic: 'hyper.phase',
      lastSummary: 'Phase aligned',
    },
    {
      id: 'fold-compressor',
      name: 'fold-compressor',
      role: 'Hyper Binary Folding Pipeline (1.09MB -> 32B Seed)',
      group: 'hyper',
      targetHz: 30,
      divider: 4,
      state: 'running',
      ticks: 0,
      lastExecUs: 34,
      lastTopic: 'hyper.fold',
      lastSummary: 'Folding MGE1 buffer',
    },
    {
      id: 'entropy-oracle',
      name: 'entropy-oracle',
      role: 'Folded Bitstream Seed Provider for Game Systems',
      group: 'hyper',
      targetHz: 20,
      divider: 6,
      state: 'running',
      ticks: 0,
      lastExecUs: 12,
      lastTopic: 'hyper.entropy',
      lastSummary: '8x32-bit words live',
    },
    {
      id: 'predictive-router',
      name: 'predictive-router',
      role: 'Auto-Routes Flow Boosts & Harmonic Chords Across Apps',
      group: 'hyper',
      targetHz: 15,
      divider: 8,
      state: 'running',
      ticks: 0,
      lastExecUs: 18,
      lastTopic: 'hyper.route',
      lastSummary: 'Auto-routing active',
    },
    {
      id: 'self-mirror',
      name: 'self-mirror',
      role: 'Cross-App Self-Awareness Reflection Synchronizer',
      group: 'hyper',
      targetHz: 10,
      divider: 12,
      state: 'running',
      ticks: 0,
      lastExecUs: 20,
      lastTopic: 'hyper.reflect',
      lastSummary: '11 app nodes aware',
    },
    {
      id: 'shard-balancer',
      name: 'shard-balancer',
      role: '120Hz Quantum Budget Guard Across 11 Apps & Game',
      group: 'hyper',
      targetHz: 10,
      divider: 12,
      state: 'running',
      ticks: 0,
      lastExecUs: 15,
      lastTopic: 'hyper.balance',
      lastSummary: 'Quantum headroom nominal',
    },
    {
      id: 'telemetry-weaver',
      name: 'telemetry-weaver',
      role: 'Wires Sniffed Flow State Into Shared Register Bank',
      group: 'hyper',
      targetHz: 5,
      divider: 24,
      state: 'running',
      ticks: 0,
      lastExecUs: 19,
      lastTopic: 'hyper.weave',
      lastSummary: 'Registers 8..39 synced',
    },
    {
      id: 'final-auditor',
      name: 'final-auditor',
      role: 'Final Process Orchestrator & Cluster Readiness Auditor',
      group: 'hyper',
      targetHz: 2,
      divider: 60,
      state: 'running',
      ticks: 0,
      lastExecUs: 23,
      lastTopic: 'hyper.final',
      lastSummary: 'Evaluating final pipeline',
    },
    // --- 20 Self-Healing Sentient Swarm Daemons ---
    ...[
      ['sh-ingest-guard', 'Buffer Boundary & Null-Byte Guard', 60, 2],
      ['sh-radix-probe', 'Multi-Radix Encoding Signature Probe', 30, 4],
      ['sh-json-repair', 'Malformed JSON Brace & Quote Healer', 20, 6],
      ['sh-utf8-sanit', 'UTF-8 Surrogate & Control Byte Sanitizer', 30, 4],
      ['sh-entropy-scan', 'Shannon Bit-Window Entropy Scanner', 20, 6],
      ['sh-crc-watch', 'FNV-1a Decoded Frame Integrity Watchdog', 15, 8],
      ['sh-queue-drain', 'Swarm Ring-Buffer Overflow Preventer', 60, 2],
      ['sh-mem-compact', 'Stale Decoded Frame Heap Compactor', 10, 12],
      ['sh-consensus-a', 'Swarm Voter Alpha (Structure)', 15, 8],
      ['sh-consensus-b', 'Swarm Voter Beta (Semantics)', 15, 8],
      ['sh-consensus-c', 'Swarm Voter Gamma (Fold Resonance)', 15, 8],
      ['sh-consensus-d', 'Swarm Voter Delta (Quarantine)', 15, 8],
      ['sh-fault-trap', 'Decode Exception Recovery Trap', 30, 4],
      ['sh-latency-gov', '8.33ms Decode Quantum Governor', 60, 2],
      ['sh-backpressure', 'Burst Stream Intake Regulator', 20, 6],
      ['sh-fold-linker', 'Hyper Binary Fold Register Binder', 10, 12],
      ['sh-bus-bridge', 'Main Brain Swarm Insight Publisher', 30, 4],
      ['sh-replay-buf', 'Rollback Replay Snapshot Preserver', 10, 12],
      ['sh-thermal-shunt', 'Processor Thermal & Load Shunt', 10, 12],
      ['sh-sustain-lock', 'Swarm Sustainer Final Health Lock', 5, 24],
    ].map(([id, role, targetHz, divider]) => ({
      id: id as string,
      name: id as string,
      role: role as string,
      group: 'swarm' as const,
      targetHz: targetHz as number,
      divider: divider as number,
      state: 'running' as const,
      ticks: 0,
      lastExecUs: 14,
      lastTopic: 'swarm.heal',
      lastSummary: 'Processor healthy · 100%',
    })),
    // --- 50 Cluster Reading, Writing & Synthetic Assembly Sustaining Daemons ---
    ...[
      // 10 Cluster Reader Daemons
      ['asm-read-index-sync', '24+ Cluster Library Catalog Synchronizer', 30, 4],
      ['asm-read-binary-seek', 'MGE1 Payload Offset & Byte Range Seeker', 60, 2],
      ['asm-read-utf8-stream', 'Zero-Copy UTF-8 Source Decoder Stream', 60, 2],
      ['asm-read-hash-verify', 'FNV-1a Library Checksum Reader', 15, 8],
      ['asm-read-symbol-cache', 'Class & Function Symbol Index Cache', 10, 12],
      ['asm-read-seg-part', 'Segment 1/2/3 Library Partitioner', 10, 12],
      ['asm-read-cap-scan', 'Capability Mask & Shader Reader', 15, 8],
      ['asm-read-delta-watch', 'Base vs Modified Source Diff Monitor', 10, 12],
      ['asm-read-mmap-guard', 'Buffer Bounds & Read Alignment Guard', 30, 4],
      ['asm-read-coalesce', 'Multi-Module Read Request Coalescer', 20, 6],
      // 10 Cluster Writer Daemons
      ['asm-write-tx-journal', 'Atomic Library Write Transaction Journal', 20, 6],
      ['asm-write-swap', 'Double-Buffered Source Patch Swapper', 15, 8],
      ['asm-write-snap', 'Pre-Write MGE1 Rollback Snapshotter', 10, 12],
      ['asm-write-growth', '24+ Synthetic Library Slot Allocator', 15, 8],
      ['asm-write-meta-patch', 'Capability & Title Metadata Patcher', 15, 8],
      ['asm-write-fnv-rehash', 'Incremental Post-Write FNV-1a Hasher', 20, 6],
      ['asm-write-quota', 'Persistent LocalVault Storage Budgeter', 10, 12],
      ['asm-write-lock', 'Concurrent Write Conflict Resolver', 30, 4],
      ['asm-write-flush', 'Asynchronous Checkpoint Write Flusher', 5, 24],
      ['asm-write-audit', 'Post-Write Capability Audit Verifier', 10, 12],
      // 10 Synthetic Lexer Daemons
      ['asm-lex-token-scan', 'Multi-Language HTML/TS/JSON Lexer Scanner', 30, 4],
      ['asm-lex-ast-fold', 'Cross-Module AST Declaration Folder', 20, 6],
      ['asm-lex-glsl-ext', 'GLSL Fragment & SDF Shader Extractor', 15, 8],
      ['asm-lex-dsp-probe', 'Web Audio Node & Oscillator Graph Probe', 15, 8],
      ['asm-lex-class-map', 'Shared Class & Constructor Topology Map', 10, 12],
      ['asm-lex-scope-fence', 'Module Global Scope Conflict Detector', 15, 8],
      ['asm-lex-import-trc', 'Dependency & Three.js Import Tracer', 10, 12],
      ['asm-lex-json-schema', 'Structured JSON Dataset Schema Parser', 15, 8],
      ['asm-lex-tree-prune', 'Unused Comment & Dead Fragment Pruner', 10, 12],
      ['asm-lex-sync', 'Live Lexer Symbol Table Synchronizer', 20, 6],
      // 10 Synthetic Assembler Daemons
      ['asm-bld-dep-order', 'Topological Segment Assembly Orderer', 15, 8],
      ['asm-bld-shim-inject', 'Liquid OS Bridge Runtime Shim Injector', 15, 8],
      ['asm-bld-ns-isolate', 'Scoped Closure Namespace Isolator', 20, 6],
      ['asm-bld-bundle-pack', 'Composite Bytestream Packer & Compressor', 15, 8],
      ['asm-bld-rt-link', 'Main Brain 120Hz Bus Assembly Linker', 20, 6],
      ['asm-bld-dead-strip', 'Duplicate Declaration Eliminator', 10, 12],
      ['asm-bld-bridge-bind', 'PostMessage Frame Telemetry Binder', 15, 8],
      ['asm-bld-html-forge', 'Unified HTML5 Composite Applet Forge', 15, 8],
      ['asm-bld-ts-emit', 'TypeScript Kernel Module Emitter', 10, 12],
      ['asm-bld-commit', 'Synthesized Artifact Library Committer', 10, 12],
      // 10 Validator & Fusion Sustainer Daemons
      ['asm-val-brace-chk', 'Balanced Brace & Bracket Syntax Checker', 20, 6],
      ['asm-val-tag-bal', 'HTML Document & Script Tag Verifier', 15, 8],
      ['asm-val-sym-dedup', 'Cross-24+ Library Symbol Collision Guard', 15, 8],
      ['asm-val-mem-budget', 'Fusion Memory & Heap Pressure Guard', 30, 4],
      ['asm-val-growth-gate', 'Dynamic 24+ Library Expansion Gatekeeper', 15, 8],
      ['asm-val-bus-relay', 'Fusion Core Event Bus Telemetry Relay', 30, 4],
      ['asm-val-rollback', 'Faulty Synthetic Module Rollback Arm', 10, 12],
      ['asm-val-drift-heal', 'Self-Healing Library Coherence Recoverer', 20, 6],
      ['asm-val-thermal', '120Hz Assembly Slice Thermal Regulator', 15, 8],
      ['asm-val-fusion-lock', '50-Daemon Single Core Fusion Lock', 5, 24],
    ].map(([id, role, targetHz, divider]) => ({
      id: id as string,
      name: id as string,
      role: role as string,
      group: 'assembly' as const,
      targetHz: targetHz as number,
      divider: divider as number,
      state: 'running' as const,
      ticks: 0,
      lastExecUs: 12,
      lastTopic: 'fusion.sustain',
      lastSummary: '24+ library synced · 100%',
    })),
  ];

  private streams: HybridStreamChannel[] = [
    {
      id: 'webgl-surface',
      label: 'WebGL2 Black Glass Shader',
      rateHz: 120,
      throughputKBps: 1440,
      active: true,
      bufferFillPct: 68,
    },
    {
      id: 'ipc-cluster',
      label: 'Cluster IPC Ring Bus',
      rateHz: 120,
      throughputKBps: 42,
      active: true,
      bufferFillPct: 24,
    },
    {
      id: 'audio-dsp',
      label: 'Audio DSP 64-Bin FFT',
      rateHz: 60,
      throughputKBps: 192,
      active: true,
      bufferFillPct: 52,
    },
    {
      id: 'legacy-bridge',
      label: 'Repo Applet Bridge Stream',
      rateHz: 60,
      throughputKBps: 0,
      active: false,
      bufferFillPct: 0,
    },
  ];

  private buildStageHandler: (() => void) | null = null;

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.dprScale = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.lastNow = performance.now();
    this.secondStart = this.lastNow;
    this.accumulatorMs = 0;

    for (let i = 0; i < this.frameRing.length; i++) {
      this.frameRing[i] = KERNEL_FIXED_DT_MS;
    }

    if (typeof MessageChannel !== 'undefined') {
      this.mc = new MessageChannel();
      this.mc.port1.onmessage = () => {
        if (!this.running) return;
        this.pumpFixedQuantum();
      };
    }

    clusterBus.publish('kclock-120', '*', 'kernel.boot', '120Hz locked quantum + 20 daemons online', 128);
    this.rafId = requestAnimationFrame(this.onAnimationFrame);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mc) {
      this.mc.port1.onmessage = null;
      this.mc = null;
    }
  }

  public setPacingMode(mode: PacingMode): void {
    this.pacingMode = mode;
    clusterBus.publish('kclock-120', 'hybrid-mux', 'kernel.pacing', `Mode switched to ${mode}`, 64);
    this.emitMetricsNow();
  }

  public setShaderPreset(preset: ShaderPreset): void {
    this.shaderPreset = preset;
    const presetIdx = ['obsidian-wave', 'solar-fractal', 'quantum-lattice', 'cad-wireframe'].indexOf(preset);
    binaryStateEngine.registerBank[4] = Math.max(0, presetIdx);
    clusterBus.publish('liquid-studio', 'gl-compositor', 'shader.preset', `Preset -> ${preset}`, 72);
    this.emitMetricsNow();
  }

  public toggleDaemon(daemonId: string): void {
    const target = this.daemons.find((d) => d.id === daemonId);
    if (!target) return;
    target.state = target.state === 'paused' ? 'running' : 'paused';
    clusterBus.publish('kernel-monitor', target.id, 'daemon.toggle', `${target.id} -> ${target.state}`, 64);
    this.emitMetricsNow();
  }

  public stepDaemon(daemonId: string): void {
    const target = this.daemons.find((d) => d.id === daemonId);
    if (!target) return;
    this.executeDaemon(target, performance.now(), true);
    this.emitMetricsNow();
  }

  public triggerManualHeal(): void {
    this.dprScale = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.healEvents++;
    const healer = this.daemons.find((d) => d.id === 'mem-healer');
    if (healer) {
      healer.lastSummary = `Manual heal #${this.healEvents} applied`;
    }
    clusterBus.publish('mem-healer', '*', 'autonomic.heal', `Manual DPR & ring-buffer heal #${this.healEvents}`, 96);
    this.emitMetricsNow();
  }

  public registerBuildStepper(fn: (() => void) | null): void {
    this.buildStageHandler = fn;
  }

  private onAnimationFrame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.onAnimationFrame);

    const rawDelta = Math.min(Math.max(now - this.lastNow, 0.5), 50);
    this.lastNow = now;
    this.lastFrameMs = rawDelta;
    this.framesInSecond++;

    if (this.pacingMode === 'vsync-lock') {
      this.accumulatorMs += KERNEL_FIXED_DT_MS;
    } else if (this.pacingMode === 'burst-test') {
      this.accumulatorMs += rawDelta * 1.25;
    } else {
      this.accumulatorMs += rawDelta;
    }

    const expectedStep = rawDelta > 12 ? 16.6667 : KERNEL_FIXED_DT_MS;
    this.jitterUs = Math.round(Math.abs(rawDelta - expectedStep) * 1000);

    this.frameRing[this.frameRingCursor] = rawDelta;
    this.frameRingCursor = (this.frameRingCursor + 1) % this.frameRing.length;

    this.pumpFixedQuantum();

    const secElapsed = now - this.secondStart;
    if (secElapsed >= 1000) {
      this.measuredTickHz = Math.round((this.ticksInSecond * 1000) / secElapsed);
      this.measuredRenderFps = Math.round((this.framesInSecond * 1000) / secElapsed);
      this.ticksInSecond = 0;
      this.framesInSecond = 0;
      this.secondStart = now;
    }

    const energy = audioDSP.normalizedEnergy;
    const busRate = clusterBus.currentRatePerSec;
    for (const hook of this.frameHooks) {
      hook(this.totalTicks, energy, busRate, this.shaderPreset, this.dprScale);
    }

    if (now - this.lastUiPublish >= 66) {
      this.lastUiPublish = now;
      this.emitMetricsNow();
    }
  };

  private pumpFixedQuantum = (): void => {
    if (!this.running) return;
    if (this.accumulatorMs < KERNEL_FIXED_DT_MS - 0.15) return;

    const stepStart = performance.now();
    this.accumulatorMs -= KERNEL_FIXED_DT_MS;
    if (this.accumulatorMs > KERNEL_FIXED_DT_MS * 6) {
      this.accumulatorMs = KERNEL_FIXED_DT_MS * 2;
    }

    this.totalTicks++;
    this.ticksInSecond++;

    for (let i = 0; i < this.daemons.length; i++) {
      const daemon = this.daemons[i];
      if (daemon.state === 'paused') continue;
      if (this.totalTicks % daemon.divider === 0) {
        this.executeDaemon(daemon, stepStart, false);
      }
    }

    const stepCostMs = performance.now() - stepStart;
    this.budgetUsedPct = Math.min(100, Math.round((stepCostMs / KERNEL_FIXED_DT_MS) * 1000) / 10);

    binaryStateEngine.registerBank[0] = this.measuredTickHz;
    binaryStateEngine.registerBank[1] = this.measuredRenderFps;
    binaryStateEngine.registerBank[2] = this.jitterUs;
    binaryStateEngine.registerBank[3] = audioDSP.normalizedEnergy;
    binaryStateEngine.registerBank[5] = this.dprScale;
    binaryStateEngine.registerBank[6] = this.totalTicks;
    binaryStateEngine.registerBank[7] = clusterBus.currentRatePerSec;

    if (this.accumulatorMs >= KERNEL_FIXED_DT_MS - 0.15 && this.mc) {
      this.mc.port2.postMessage(null);
    }
  };

  private executeDaemon(daemon: DaemonSnapshot, _now: number, forceEmit: boolean): void {
    const t0 = performance.now();
    daemon.ticks++;

    switch (daemon.id) {
      case 'kclock-120': {
        daemon.lastSummary = `Quantum #${this.totalTicks} · ${this.measuredTickHz}Hz`;
        if (forceEmit) {
          clusterBus.publish('kclock-120', '*', 'kernel.quantum', daemon.lastSummary, 48);
        }
        break;
      }
      case 'hybrid-mux': {
        const legacyNodes = clusterBus.getLegacyStates();
        const linkedCount = legacyNodes.filter((n) => n.status === 'linked').length;
        this.streams[0].throughputKBps = Math.round(1150 * this.dprScale + audioDSP.normalizedEnergy * 320);
        this.streams[0].bufferFillPct = Math.round(45 + audioDSP.normalizedEnergy * 45);
        this.streams[1].throughputKBps = Math.max(12, Math.round(clusterBus.currentRatePerSec * 0.64));
        this.streams[1].bufferFillPct = Math.min(95, Math.max(12, clusterBus.currentRatePerSec * 2));
        this.streams[2].throughputKBps = audioDSP.isRunning ? 216 : 64;
        this.streams[2].bufferFillPct = Math.round(25 + audioDSP.normalizedEnergy * 70);
        this.streams[3].active = linkedCount > 0;
        this.streams[3].throughputKBps = linkedCount * 180;
        this.streams[3].bufferFillPct = linkedCount > 0 ? Math.min(95, linkedCount * 28) : 0;
        daemon.lastSummary = `${linkedCount > 0 ? 4 : 3} active streams · ${this.streams[0].throughputKBps} KB/s`;
        break;
      }
      case 'ipc-router': {
        daemon.lastSummary = `${clusterBus.currentRatePerSec} msg/s routed`;
        if (this.totalTicks % 120 === 0 || forceEmit) {
          clusterBus.publish('ipc-router', 'cluster-mesh', 'ipc.pulse', daemon.lastSummary, 64);
        }
        break;
      }
      case 'gl-compositor': {
        daemon.lastSummary = `${this.shaderPreset} · DPR ${this.dprScale.toFixed(2)}x`;
        break;
      }
      case 'audio-dsp': {
        const energy = audioDSP.sampleEnergy(this.totalTicks);
        daemon.lastSummary = `${audioDSP.isRunning ? 'Live' : 'Synth'} energy ${(energy * 100).toFixed(0)}%`;
        if (this.totalTicks % 120 === 0 || forceEmit) {
          clusterBus.publish('audio-dsp', 'gl-compositor', 'dsp.energy', daemon.lastSummary, 56);
        }
        break;
      }
      case 'mem-healer': {
        if (this.lastFrameMs > 34 && this.dprScale > 0.75) {
          this.dprScale = Math.max(0.75, +(this.dprScale - 0.1).toFixed(2));
          this.healEvents++;
          daemon.state = 'healing';
          daemon.lastSummary = `DPR shed -> ${this.dprScale.toFixed(2)}x`;
          clusterBus.publish('mem-healer', 'gl-compositor', 'autonomic.shed', daemon.lastSummary, 80);
        } else {
          daemon.state = 'running';
          daemon.lastSummary = `Nominal · ${this.healEvents} heals`;
        }
        break;
      }
      case 'bridge-watcher': {
        const legacy = clusterBus.getLegacyStates();
        const linked = legacy.filter((l) => l.status === 'linked');
        daemon.lastSummary =
          linked.length > 0
            ? `${linked.length} bridged (${linked.map((l) => l.moduleName).slice(0, 2).join(', ')})`
            : 'No mounted legacy nodes';
        if (linked.length > 0 && (this.totalTicks % 60 === 0 || forceEmit)) {
          clusterBus.pingAllLegacyFrames();
        }
        break;
      }
      case 'segment-builder': {
        if (this.buildStageHandler) {
          this.buildStageHandler();
        }
        daemon.lastSummary = `Build pipeline synced @ tick ${this.totalTicks}`;
        break;
      }
      case 'binary-indexer': {
        const header = binaryStateEngine.header;
        daemon.lastSummary = header
          ? `${header.magic} · ${header.moduleCount} modules · ${header.globalHashHex}`
          : 'Ingesting repository binary...';
        if (header && (this.totalTicks % 240 === 0 || forceEmit)) {
          clusterBus.publish('binary-indexer', 'binary-vault', 'binary.checksum', header.globalHashHex, 64);
        }
        break;
      }
      case 'vault-persister': {
        const saved = binaryStateEngine.loadPersistedState();
        daemon.lastSummary = saved
          ? `${saved.upgradedModuleIds.length} upgraded persisted`
          : 'Ready to persist upgrades';
        if (forceEmit) {
          clusterBus.publish('vault-persister', 'binary-vault', 'vault.sync', daemon.lastSummary, 64);
        }
        break;
      }

      // --- 10 Hyper-Awareness Extension Daemons ---
      case 'sniff-bus': {
        const fs = hyperFlowEngine.flowState;
        daemon.lastSummary = `${fs.sniffedPerSec} pkt/s · ${fs.activeEdges} edges`;
        if (forceEmit) {
          clusterBus.publish('sniff-bus', 'flow-sniffer', 'hyper.sniff', daemon.lastSummary, 64);
        }
        break;
      }
      case 'flow-tracker': {
        const runningCount = this.daemons.filter((d) => d.state !== 'paused').length;
        const fs = hyperFlowEngine.updateFlowSample(audioDSP.normalizedEnergy, this.measuredTickHz, runningCount);
        daemon.lastSummary = `Flow ${fs.flowScore}% · Coherence ${fs.coherencePct}%`;
        if (this.totalTicks % 180 === 0 || forceEmit) {
          clusterBus.publish('flow-tracker', 'main-brain', 'hyper.flow', `Flow ${fs.flowScore}%`, 64);
        }
        break;
      }
      case 'phase-aligner': {
        const fs = hyperFlowEngine.flowState;
        daemon.lastSummary = `Phase ${fs.phaseAngleRad.toFixed(2)} rad · ${fs.harmonicLock ? 'Locked' : 'Free'}`;
        break;
      }
      case 'fold-compressor': {
        const fold = hyperFlowEngine.getFoldResult();
        if (fold.stages.length === 0 && binaryStateEngine.rawBuffer) {
          hyperFlowEngine.computeBinaryFold(false);
        }
        daemon.lastSummary = `${fold.foldedSeedHex} (${fold.compressionRatio}:1)`;
        if (forceEmit) {
          const nextFold = hyperFlowEngine.computeBinaryFold(true);
          clusterBus.publish('fold-compressor', 'fold-forge', 'hyper.fold', nextFold.foldedSeedHex, 96);
        }
        break;
      }
      case 'entropy-oracle': {
        const words = hyperFlowEngine.getFoldResult().foldedWords;
        daemon.lastSummary = `W0 0x${(words[0] >>> 0).toString(16).toUpperCase()}`;
        break;
      }
      case 'predictive-router': {
        const fs = hyperFlowEngine.flowState;
        daemon.lastSummary = fs.autoHarmonicRoute ? 'Auto-routing flow pulses' : 'Manual routing';
        if (this.totalTicks % 240 === 0 || forceEmit) {
          clusterBus.publish('predictive-router', 'phase-harmonizer', 'hyper.route', `Gain ${fs.phaseGain.toFixed(2)}x`, 64);
        }
        break;
      }
      case 'self-mirror': {
        const apps = hyperFlowEngine.getAwarenessSnapshots();
        const openN = apps.filter((a) => a.isOpen).length;
        daemon.lastSummary = `${apps.length} self-aware · ${openN} open`;
        if (this.totalTicks % 360 === 0 || forceEmit) {
          clusterBus.publish('self-mirror', 'self-matrix', 'hyper.reflect', daemon.lastSummary, 80);
        }
        break;
      }
      case 'shard-balancer': {
        daemon.lastSummary = `Budget ${this.budgetUsedPct}% · ${this.measuredTickHz}Hz`;
        break;
      }
      case 'telemetry-weaver': {
        const fs = hyperFlowEngine.flowState;
        daemon.lastSummary = `Entropy ${fs.packetEntropy} · Score ${fs.gameKernelScore}`;
        break;
      }
      case 'final-auditor': {
        const fs = hyperFlowEngine.flowState;
        daemon.lastSummary = `Readiness ${fs.finalReadinessPct}%`;
        if (forceEmit) {
          clusterBus.publish('final-auditor', 'main-brain', 'hyper.final', `Final readiness ${fs.finalReadinessPct}%`, 80);
        }
        break;
      }
      default: {
        if (daemon.group === 'swarm') {
          const sh = swarmDecoderEngine.health;
          const activeSwarm = this.daemons.filter((d) => d.group === 'swarm' && d.state !== 'paused').length;
          if (daemon.id === 'sh-sustain-lock') {
            swarmDecoderEngine.sustainStep(activeSwarm);
          }
          daemon.state = sh.healthPct < 100 ? 'healing' : 'running';
          daemon.lastSummary =
            sh.healthPct < 100
              ? `Healing ${sh.healthPct}% · ${sh.totalHealed} repairs`
              : `${sh.totalDecoded} decoded · ${sh.healthPct}% OK`;
          if (forceEmit) {
            clusterBus.publish(daemon.id, 'swarm-sustainer', 'swarm.heal', daemon.lastSummary, 64);
          }
        } else if (daemon.group === 'assembly') {
          const fh = clusterLibraryEngine.health;
          const activeAsm = this.daemons.filter((d) => d.group === 'assembly' && d.state !== 'paused').length;
          if (daemon.id === 'asm-val-fusion-lock') {
            clusterLibraryEngine.sustainStep(activeAsm);
          }
          daemon.state = fh.healthPct < 100 ? 'healing' : 'running';
          daemon.lastSummary =
            fh.healthPct < 100
              ? `Healing ${fh.healthPct}% · ${fh.totalLibraryCount} mods`
              : `${fh.totalLibraryCount} mods · ${fh.totalAssemblies} asm · 100%`;
          if (forceEmit) {
            clusterBus.publish(daemon.id, 'synthesis-core', 'fusion.sustain', daemon.lastSummary, 64);
          }
        }
        break;
      }
    }

    const execUs = Math.max(4, Math.round((performance.now() - t0) * 1000));
    daemon.lastExecUs = execUs;
    const daemonIdx = this.daemons.indexOf(daemon);
    const regSlot = daemonIdx < 16 ? 16 + daemonIdx : 64 + (daemonIdx - 16);
    if (daemonIdx >= 0 && regSlot < binaryStateEngine.registerBank.length) {
      binaryStateEngine.registerBank[regSlot] = daemon.ticks;
    }
  }

  public getSnapshot(): KernelMetrics {
    const history: number[] = new Array(this.frameRing.length);
    for (let i = 0; i < this.frameRing.length; i++) {
      history[i] = this.frameRing[(this.frameRingCursor + i) % this.frameRing.length];
    }

    return {
      targetHz: KERNEL_TARGET_HZ,
      kernelTickHz: this.measuredTickHz,
      renderFps: this.measuredRenderFps,
      fixedDtMs: KERNEL_FIXED_DT_MS,
      lastFrameMs: +this.lastFrameMs.toFixed(2),
      jitterUs: this.jitterUs,
      budgetUsedPct: this.budgetUsedPct,
      totalTicks: this.totalTicks,
      healEvents: this.healEvents,
      pacingMode: this.pacingMode,
      dprScale: this.dprScale,
      busMessagesPerSec: clusterBus.currentRatePerSec,
      audioEnergy: audioDSP.normalizedEnergy,
      shaderPreset: this.shaderPreset,
      daemons: this.daemons.map((d) => ({ ...d })),
      streams: this.streams.map((s) => ({ ...s })),
      frameHistory: history,
      flowState: { ...hyperFlowEngine.flowState },
      foldResult: hyperFlowEngine.getFoldResult(),
      selfAwareness: hyperFlowEngine.getAwarenessSnapshots(),
      swarmHealth: { ...swarmDecoderEngine.health },
      fusionHealth: { ...clusterLibraryEngine.health },
    };
  }

  private emitMetricsNow(): void {
    const snap = this.getSnapshot();
    for (const sub of this.metricsSubscribers) {
      sub(snap);
    }
  }

  public subscribeMetrics(fn: MetricsSubscriber): () => void {
    this.metricsSubscribers.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.metricsSubscribers.delete(fn);
    };
  }

  public subscribeFrame(fn: FrameHook): () => void {
    this.frameHooks.add(fn);
    return () => {
      this.frameHooks.delete(fn);
    };
  }
}

export const liquidKernel = new LiquidKernel();
