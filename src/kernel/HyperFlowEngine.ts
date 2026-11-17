import { binaryStateEngine } from './BinaryStateEngine';
import { clusterBus } from './ClusterBus';
import type {
  AnyAppId,
  AppSelfAwareness,
  BinaryFoldResult,
  BinaryFoldStage,
  ClusterPacket,
  FoldAlgorithm,
  SniffedFlowState,
} from './types';

const ALL_APP_META: { id: AnyAppId; title: string }[] = [
  { id: 'cluster-mesh', title: 'Main Brain' },
  { id: 'kernel-monitor', title: 'Kernel Monitor' },
  { id: 'liquid-studio', title: 'Liquid Studio' },
  { id: 'binary-vault', title: 'Binary Vault' },
  { id: 'build-pipeline', title: 'Build Pipeline' },
  { id: 'flow-sniffer', title: 'Flow Sniffer' },
  { id: 'fold-forge', title: 'Fold Forge' },
  { id: 'self-matrix', title: 'Self-Aware Matrix' },
  { id: 'phase-harmonizer', title: 'Phase Harmonizer' },
  { id: 'final-sequencer', title: 'Final Sequencer' },
  { id: 'fold-runner', title: 'FoldRunner Game' },
  { id: 'swarm-ingestor', title: 'Swarm Ingestor' },
  { id: 'swarm-decoder', title: 'Swarm Decoder' },
  { id: 'swarm-consensus', title: 'Swarm Consensus' },
  { id: 'swarm-healer', title: 'Swarm Healer' },
  { id: 'swarm-streamer', title: 'Swarm Streamer' },
  { id: 'swarm-sustainer', title: 'Swarm Sustainer' },
  { id: 'cluster-reader', title: 'Cluster Reader' },
  { id: 'cluster-writer', title: 'Cluster Writer' },
  { id: 'synthetic-lexer', title: 'Synthetic Lexer' },
  { id: 'synthetic-assembler', title: 'Synthetic Assembler' },
  { id: 'library-validator', title: 'Library Validator' },
  { id: 'synthesis-core', title: 'Synthesis Core' },
];

function rotl32(val: number, shift: number): number {
  return ((val << shift) | (val >>> (32 - shift))) >>> 0;
}

export class HyperFlowEngine {
  public foldAlgorithm: FoldAlgorithm = 'xor-rotate';
  public foldGeneration = 1;
  private cachedFold: BinaryFoldResult = {
    algorithm: 'xor-rotate',
    sourceBytes: 0,
    foldedSeedHex: '0x00000000',
    foldedWords: [0x4d474531, 0x120a8333, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0x7f4a7c15],
    compressionRatio: 1,
    stages: [],
    foldGeneration: 1,
  };

  private awarenessMap = new Map<string, AppSelfAwareness>();
  private activeEdges = new Map<string, number>();
  private sniffedThisSec = 0;
  private lastSniffReset = performance.now();
  private topicHistogram = new Map<string, number>();

  public flowState: SniffedFlowState = {
    flowScore: 68,
    coherencePct: 74,
    packetEntropy: 0.42,
    phaseAngleRad: 0,
    harmonicLock: true,
    activeEdges: 0,
    sniffedPerSec: 0,
    finalReadinessPct: 75,
    gameKernelScore: 0,
    gameFoldDepth: 1,
    phaseGain: 1.0,
    autoHarmonicRoute: true,
  };

  constructor() {
    for (const app of ALL_APP_META) {
      this.awarenessMap.set(app.id, {
        appId: app.id,
        title: app.title,
        isOpen: false,
        inboundCount: 0,
        outboundCount: 0,
        resonancePct: 72,
        lastThought: 'Synced to Main Brain 120Hz bus',
        lastUpdatedAt: performance.now(),
      });
    }

    clusterBus.subscribe(this.onBusPacket);
  }

  private onBusPacket = (pkt: ClusterPacket): void => {
    this.sniffedThisSec++;
    const now = performance.now();
    this.topicHistogram.set(pkt.topic, (this.topicHistogram.get(pkt.topic) ?? 0) + 1);
    if (this.topicHistogram.size > 48) {
      const firstKey = this.topicHistogram.keys().next().value;
      if (firstKey) this.topicHistogram.delete(firstKey);
    }

    const edgeKey = `${pkt.from}->${pkt.to}`;
    this.activeEdges.set(edgeKey, now);

    const fromNode = this.awarenessMap.get(pkt.from) || this.resolveAlias(pkt.from);
    if (fromNode) {
      fromNode.outboundCount++;
      fromNode.lastThought = `Emitted ${pkt.topic}: ${pkt.payloadSummary}`;
      fromNode.lastUpdatedAt = now;
      fromNode.resonancePct = Math.min(100, fromNode.resonancePct + 1.5);
    }

    if (pkt.to === '*') {
      for (const app of this.awarenessMap.values()) {
        if (app.appId !== fromNode?.appId) {
          app.inboundCount++;
          app.lastUpdatedAt = now;
        }
      }
    } else {
      const toNode = this.awarenessMap.get(pkt.to) || this.resolveAlias(pkt.to);
      if (toNode) {
        toNode.inboundCount++;
        toNode.lastThought = `Received ${pkt.topic} from ${pkt.from}`;
        toNode.lastUpdatedAt = now;
        toNode.resonancePct = Math.min(100, toNode.resonancePct + 2);
      }
    }
  };

  private resolveAlias(name: string): AppSelfAwareness | undefined {
    if (name === 'main-brain') return this.awarenessMap.get('cluster-mesh');
    if (name === 'gl-compositor' || name === 'audio-dsp') return this.awarenessMap.get('liquid-studio');
    if (name === 'binary-indexer' || name === 'vault-persister') return this.awarenessMap.get('binary-vault');
    if (name === 'segment-builder') return this.awarenessMap.get('build-pipeline');
    if (name === 'kclock-120' || name === 'hybrid-mux' || name === 'mem-healer') {
      return this.awarenessMap.get('kernel-monitor');
    }
    if (name.startsWith('sh-')) {
      return this.awarenessMap.get('swarm-sustainer');
    }
    if (name.startsWith('asm-')) {
      return this.awarenessMap.get('synthesis-core');
    }
    return undefined;
  }

  public markOpenApps(openIds: Set<string>): void {
    for (const app of this.awarenessMap.values()) {
      app.isOpen = openIds.has(app.appId);
    }
  }

  public setFoldAlgorithm(algo: FoldAlgorithm): BinaryFoldResult {
    this.foldAlgorithm = algo;
    const res = this.computeBinaryFold(true);
    clusterBus.publish('fold-forge', '*', 'fold.algorithm', `${algo} -> ${res.foldedSeedHex}`, 96);
    return res;
  }

  public computeBinaryFold(incrementGen = false): BinaryFoldResult {
    const buf = binaryStateEngine.rawBuffer;
    if (!buf || buf.byteLength < 32) {
      return this.cachedFold;
    }

    if (incrementGen) {
      this.foldGeneration++;
    }

    const bytes = new Uint8Array(buf);
    const foldStage = (input: Uint8Array, targetSize: number, salt: number): Uint8Array => {
      const out = new Uint8Array(targetSize);
      for (let i = 0; i < input.length; i++) {
        const dst = i % targetSize;
        const b = input[i];
        if (this.foldAlgorithm === 'xor-rotate') {
          const rot = ((b << (i % 7)) | (b >>> (8 - (i % 7)))) & 0xff;
          out[dst] = (out[dst] ^ rot ^ ((salt + i) & 0xff)) & 0xff;
        } else if (this.foldAlgorithm === 'golden-mix') {
          out[dst] = (out[dst] + Math.imul(b ^ (salt & 0xff), 157)) & 0xff;
        } else {
          const parity = ((b * 0x01010101) >>> 24) & 0xff;
          out[dst] = (out[dst] ^ ((b + parity + salt) & 0xff)) & 0xff;
        }
      }
      return out;
    };

    const s1 = foldStage(bytes, 4096, this.foldGeneration * 13);
    const s2 = foldStage(s1, 512, this.foldGeneration * 29);
    const s3 = foldStage(s2, 64, this.foldGeneration * 47);
    const s4 = foldStage(s3, 32, this.foldGeneration * 73);

    const dv = new DataView(s4.buffer);
    const words: number[] = [];
    for (let i = 0; i < 8; i++) {
      words.push(rotl32(dv.getUint32(i * 4, true) ^ (this.foldGeneration * 0x9e3779b9), i + 3));
    }

    const seedHex = '0x' + (words[0] ^ words[7]).toString(16).padStart(8, '0').toUpperCase();

    const preview = (arr: Uint8Array) =>
      Array.from(arr.subarray(0, 8))
        .map((v) => v.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

    const stages: BinaryFoldStage[] = [
      { stage: 0, label: 'MGE1 Raw Binary', bytes: bytes.length, previewHex: preview(bytes) },
      { stage: 1, label: 'Hyper Fold L1', bytes: s1.length, previewHex: preview(s1) },
      { stage: 2, label: 'Hyper Fold L2', bytes: s2.length, previewHex: preview(s2) },
      { stage: 3, label: 'Kernel Fold L3', bytes: s3.length, previewHex: preview(s3) },
      { stage: 4, label: '32B Hyper Seed', bytes: s4.length, previewHex: preview(s4) },
    ];

    // Mirror folded words into BinaryStateEngine registers 32..39
    for (let i = 0; i < 8; i++) {
      binaryStateEngine.registerBank[32 + i] = words[i];
    }

    this.cachedFold = {
      algorithm: this.foldAlgorithm,
      sourceBytes: bytes.length,
      foldedSeedHex: seedHex,
      foldedWords: words,
      compressionRatio: Math.round(bytes.length / s4.length),
      stages,
      foldGeneration: this.foldGeneration,
    };

    return this.cachedFold;
  }

  public getFoldResult(): BinaryFoldResult {
    return this.cachedFold;
  }

  public updateFlowSample(audioEnergy: number, kernelHz: number, totalDaemonsRunning: number): SniffedFlowState {
    const now = performance.now();
    const elapsed = now - this.lastSniffReset;
    if (elapsed >= 1000) {
      this.flowState.sniffedPerSec = Math.round((this.sniffedThisSec * 1000) / elapsed);
      this.sniffedThisSec = 0;
      this.lastSniffReset = now;
    }

    // Expire stale edges older than 3.5 seconds
    for (const [k, ts] of this.activeEdges.entries()) {
      if (now - ts > 3500) this.activeEdges.delete(k);
    }

    // Shannon-like normalized topic entropy
    let totalTopics = 0;
    for (const c of this.topicHistogram.values()) totalTopics += c;
    let entropy = 0;
    if (totalTopics > 0 && this.topicHistogram.size > 1) {
      for (const c of this.topicHistogram.values()) {
        const p = c / totalTopics;
        entropy -= p * Math.log2(p);
      }
      entropy = Math.min(1, entropy / Math.log2(this.topicHistogram.size));
    }

    const daemonFactor = Math.min(1, totalDaemonsRunning / 90);
    const hzFactor = Math.min(1, kernelHz / 120);
    const edgeFactor = Math.min(1, this.activeEdges.size / 10);
    const gameBonus = Math.min(0.15, this.flowState.gameFoldDepth * 0.02);

    const coherence = Math.round(
      Math.min(100, (daemonFactor * 0.45 + hzFactor * 0.35 + edgeFactor * 0.2) * 100)
    );
    const flowScore = Math.round(
      Math.min(
        100,
        (coherence * 0.006 + entropy * 0.2 + audioEnergy * 0.12 + gameBonus) * 100
      )
    );

    this.flowState.coherencePct = coherence;
    this.flowState.flowScore = flowScore;
    this.flowState.packetEntropy = +entropy.toFixed(2);
    this.flowState.activeEdges = this.activeEdges.size;
    this.flowState.phaseAngleRad = +((this.flowState.phaseAngleRad + 0.052 * this.flowState.phaseGain) % (Math.PI * 2)).toFixed(3);

    const hasBinary = binaryStateEngine.rawBuffer ? 1 : 0;
    const hasFold = this.cachedFold.stages.length > 0 ? 1 : 0;
    const hasGameLink = this.flowState.gameKernelScore > 0 || this.flowState.gameFoldDepth > 1 ? 1 : 0.6;
    this.flowState.finalReadinessPct = Math.round(
      ((daemonFactor * 0.35 + hzFactor * 0.25 + hasBinary * 0.15 + hasFold * 0.15 + hasGameLink * 0.1) * 100)
    );

    // Gentle decay on awareness resonance when idle
    for (const app of this.awarenessMap.values()) {
      if (now - app.lastUpdatedAt > 2000) {
        app.resonancePct = Math.max(55, +(app.resonancePct - 0.15).toFixed(1));
      }
    }

    binaryStateEngine.registerBank[8] = flowScore;
    binaryStateEngine.registerBank[9] = coherence;
    binaryStateEngine.registerBank[10] = this.flowState.phaseAngleRad;

    return { ...this.flowState };
  }

  public recordGameFold(score: number, foldDepth: number): void {
    this.flowState.gameKernelScore = score;
    this.flowState.gameFoldDepth = foldDepth;
    binaryStateEngine.registerBank[11] = score;
    binaryStateEngine.registerBank[12] = foldDepth;
  }

  public queryAppSelfAwareness(appId: string): void {
    const target = this.awarenessMap.get(appId);
    if (!target) return;
    target.resonancePct = Math.min(100, target.resonancePct + 8);
    target.lastThought = `Self-audit verified @ flow ${this.flowState.flowScore}%`;
    target.lastUpdatedAt = performance.now();
    clusterBus.publish('self-matrix', appId, 'self.reflect', `Resonance ${Math.round(target.resonancePct)}%`, 84);
  }

  public triggerFinalSequence(): void {
    this.computeBinaryFold(true);
    for (const app of this.awarenessMap.values()) {
      app.resonancePct = 98;
      app.lastThought = `Locked into Final Flow (${this.cachedFold.foldedSeedHex})`;
      app.lastUpdatedAt = performance.now();
    }
    clusterBus.publish('final-sequencer', '*', 'final.sequence', `Locked 20 daemons + 10 apps @ ${this.cachedFold.foldedSeedHex}`, 160);
    clusterBus.pingAllLegacyFrames();
  }

  public getAwarenessSnapshots(): AppSelfAwareness[] {
    return Array.from(this.awarenessMap.values());
  }
}

export const hyperFlowEngine = new HyperFlowEngine();
