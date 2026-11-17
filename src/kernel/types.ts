export type WorkspaceView = 'desktop' | 'cluster' | 'binary' | 'pipeline' | 'game' | 'swarm' | 'fusion';

export type CoreAppId =
  | 'kernel-monitor'
  | 'cluster-mesh'
  | 'binary-vault'
  | 'build-pipeline'
  | 'liquid-studio';

export type HyperAppId =
  | 'flow-sniffer'
  | 'fold-forge'
  | 'self-matrix'
  | 'phase-harmonizer'
  | 'final-sequencer'
  | 'fold-runner';

export type SwarmAppId =
  | 'swarm-ingestor'
  | 'swarm-decoder'
  | 'swarm-consensus'
  | 'swarm-healer'
  | 'swarm-streamer'
  | 'swarm-sustainer';

export type AssemblyAppId =
  | 'cluster-reader'
  | 'cluster-writer'
  | 'synthetic-lexer'
  | 'synthetic-assembler'
  | 'library-validator'
  | 'synthesis-core';

export type AnyAppId = CoreAppId | HyperAppId | SwarmAppId | AssemblyAppId;

export type ShaderPreset = 'obsidian-wave' | 'solar-fractal' | 'quantum-lattice' | 'cad-wireframe';

export type PacingMode = 'hybrid-120' | 'vsync-lock' | 'burst-test';

export type FoldAlgorithm = 'xor-rotate' | 'golden-mix' | 'parity-collapse';

export type DetectedDataFormat =
  | 'json'
  | 'hex'
  | 'base64'
  | 'binary-bits'
  | 'csv'
  | 'html-code'
  | 'utf8-text'
  | 'raw-bytes';

export interface RepoModuleDescriptor {
  id: string;
  name: string;
  title: string;
  kind: 'html' | 'json' | 'typescript';
  kindCode: number;
  segment: 1 | 2 | 3;
  sizeBytes: number;
  fnvHash: number;
  fnvHex: string;
  capMask: number;
  capabilities: string[];
  symbols: string[];
  symbolCount: number;
}

export interface RepoManifest {
  repository: string;
  binaryMagic: string;
  binaryVersion: number;
  binaryTotalBytes: number;
  totalSourceBytes: number;
  globalHash: string;
  combinedCapabilities: string[];
  modules: RepoModuleDescriptor[];
}

export interface BinaryStateHeader {
  magic: string;
  version: number;
  moduleCount: number;
  totalPayloadBytes: number;
  globalHashHex: string;
  combinedCapMask: number;
  timestampMs: number;
}

export interface BinaryRecordView {
  name: string;
  fnvHex: string;
  payloadOffset: number;
  payloadLength: number;
  capMask: number;
  segment: number;
  symbolCount: number;
  kindCode: number;
  invested: boolean;
}

export interface DaemonSnapshot {
  id: string;
  name: string;
  role: string;
  group: 'core' | 'hyper' | 'swarm' | 'assembly';
  targetHz: number;
  divider: number;
  state: 'running' | 'paused' | 'healing';
  ticks: number;
  lastExecUs: number;
  lastTopic: string;
  lastSummary: string;
}

export interface HybridStreamChannel {
  id: 'webgl-surface' | 'ipc-cluster' | 'audio-dsp' | 'legacy-bridge';
  label: string;
  rateHz: number;
  throughputKBps: number;
  active: boolean;
  bufferFillPct: number;
}

export interface BinaryFoldStage {
  stage: number;
  label: string;
  bytes: number;
  previewHex: string;
}

export interface BinaryFoldResult {
  algorithm: FoldAlgorithm;
  sourceBytes: number;
  foldedSeedHex: string;
  foldedWords: number[];
  compressionRatio: number;
  stages: BinaryFoldStage[];
  foldGeneration: number;
}

export interface AppSelfAwareness {
  appId: string;
  title: string;
  isOpen: boolean;
  inboundCount: number;
  outboundCount: number;
  resonancePct: number;
  lastThought: string;
  lastUpdatedAt: number;
}

export interface SniffedFlowState {
  flowScore: number;
  coherencePct: number;
  packetEntropy: number;
  phaseAngleRad: number;
  harmonicLock: boolean;
  activeEdges: number;
  sniffedPerSec: number;
  finalReadinessPct: number;
  gameKernelScore: number;
  gameFoldDepth: number;
  phaseGain: number;
  autoHarmonicRoute: boolean;
}

export interface SwarmVote {
  agent: string;
  verdict: 'valid' | 'healed' | 'anomalous';
  confidencePct: number;
  note: string;
}

export interface DecodedFrame {
  id: number;
  timestamp: number;
  sourceLabel: string;
  rawInputPreview: string;
  detectedFormat: DetectedDataFormat;
  rawByteLength: number;
  decodedByteLength: number;
  fnvHex: string;
  entropyBits: number;
  asciiRatioPct: number;
  decodedText: string;
  repairedText: string | null;
  repairsApplied: string[];
  structuredJson: string | null;
  csvPreview: string[][] | null;
  hexPreviewRows: { offset: string; bytes: string[]; ascii: string }[];
  votes: SwarmVote[];
}

export interface SwarmProcessorHealth {
  healthPct: number;
  loadPct: number;
  queueDepth: number;
  totalDecoded: number;
  totalHealed: number;
  injectedFaults: number;
  quantumBudgetMs: number;
  autoHealEnabled: boolean;
  autoStreamEnabled: boolean;
  activeSelfHealDaemons: number;
  lastRepairAction: string;
}

export type AssemblyTargetMode = 'html-cluster' | 'ts-kernel-bundle' | 'json-manifest';

export interface ClusterLibraryEntry {
  id: string;
  name: string;
  title: string;
  kind: 'html' | 'json' | 'typescript';
  segment: 1 | 2 | 3;
  origin: 'repo-base' | 'modified' | 'synthetic';
  sourceCode: string;
  sizeBytes: number;
  fnvHex: string;
  capabilities: string[];
  symbols: string[];
  symbolCount: number;
  version: number;
  updatedAt: number;
}

export interface LexerModuleMetrics {
  id: string;
  name: string;
  kind: 'html' | 'json' | 'typescript';
  lines: number;
  functions: string[];
  classes: string[];
  shaderBlocks: number;
  audioNodes: number;
  hasRenderLoop: boolean;
  capabilities: string[];
}

export interface LexerAnalysis {
  analyzedCount: number;
  totalLines: number;
  totalBytes: number;
  uniqueCapabilities: string[];
  capabilityCounts: Record<string, number>;
  symbolCollisions: string[];
  modules: LexerModuleMetrics[];
}

export interface SyntheticAssemblyBuild {
  id: string;
  targetName: string;
  mode: AssemblyTargetMode;
  sourceModuleIds: string[];
  sourceModuleNames: string[];
  assembledCode: string;
  outputBytes: number;
  fnvHex: string;
  capabilities: string[];
  symbolCount: number;
  createdAt: number;
}

export interface LibraryValidationIssue {
  moduleId: string;
  moduleName: string;
  severity: 'ok' | 'warn' | 'fault';
  message: string;
}

export interface LibraryValidationReport {
  healthPct: number;
  checkedCount: number;
  passedCount: number;
  warningCount: number;
  faultCount: number;
  growthCount: number;
  modifiedCount: number;
  issues: LibraryValidationIssue[];
  validatedAt: number;
}

export interface ClusterFusionHealth {
  healthPct: number;
  totalLibraryCount: number;
  baseRepoCount: number;
  syntheticGrowthCount: number;
  modifiedCount: number;
  activeAssemblyDaemons: number;
  totalWrites: number;
  totalAssemblies: number;
  autoSustainEnabled: boolean;
  lastAction: string;
}

export interface KernelMetrics {
  targetHz: number;
  kernelTickHz: number;
  renderFps: number;
  fixedDtMs: number;
  lastFrameMs: number;
  jitterUs: number;
  budgetUsedPct: number;
  totalTicks: number;
  healEvents: number;
  pacingMode: PacingMode;
  dprScale: number;
  busMessagesPerSec: number;
  audioEnergy: number;
  shaderPreset: ShaderPreset;
  daemons: DaemonSnapshot[];
  streams: HybridStreamChannel[];
  frameHistory: number[];
  flowState: SniffedFlowState;
  foldResult: BinaryFoldResult;
  selfAwareness: AppSelfAwareness[];
  swarmHealth: SwarmProcessorHealth;
  fusionHealth: ClusterFusionHealth;
}

export interface ClusterPacket {
  id: number;
  timestamp: number;
  from: string;
  to: string;
  topic: string;
  payloadSummary: string;
  bytes: number;
}

export interface MountedLegacyState {
  moduleId: string;
  moduleName: string;
  fps: number;
  dtMs: number;
  interactions: number;
  memoryMB: number | null;
  lastHeartbeatAt: number;
  status: 'booting' | 'linked' | 'idle';
}

export interface OSWindowState {
  id: string;
  title: string;
  subtitle: string;
  kind: 'core' | 'hyper' | 'swarm' | 'assembly' | 'legacy';
  appId?: AnyAppId;
  module?: RepoModuleDescriptor;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}
