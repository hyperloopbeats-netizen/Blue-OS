import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Binary, BookOpen, Boxes, CheckCircle2, Code2, Combine, Cpu, Eye, FileCode2, FoldVertical, Gamepad2, HeartPulse, Layers, Network, PenTool, Radio, ShieldAlert, ShieldCheck, Sparkles, TerminalSquare, Users, Waves, Workflow } from 'lucide-react';
import { BlackGlassSurface } from './components/BlackGlassSurface';
import { TopBar } from './components/TopBar';
import { WindowFrame } from './components/WindowFrame';
import { BinaryVaultApp } from './components/apps/BinaryVaultApp';
import { BuildPipelineApp } from './components/apps/BuildPipelineApp';
import { ClusterMeshApp } from './components/apps/ClusterMeshApp';
import { ClusterReaderApp } from './components/apps/ClusterReaderApp';
import { ClusterWriterApp } from './components/apps/ClusterWriterApp';
import { FinalSequencerApp } from './components/apps/FinalSequencerApp';
import { FlowSnifferApp } from './components/apps/FlowSnifferApp';
import { FoldForgeApp } from './components/apps/FoldForgeApp';
import { FoldRunnerApp } from './components/apps/FoldRunnerApp';
import { KernelMonitorApp } from './components/apps/KernelMonitorApp';
import { LegacyBridgeWindow } from './components/apps/LegacyBridgeWindow';
import { LibraryValidatorApp } from './components/apps/LibraryValidatorApp';
import { LiquidStudioApp } from './components/apps/LiquidStudioApp';
import { PhaseHarmonizerApp } from './components/apps/PhaseHarmonizerApp';
import { SelfMatrixApp } from './components/apps/SelfMatrixApp';
import { SwarmConsensusApp } from './components/apps/SwarmConsensusApp';
import { SwarmDecoderApp } from './components/apps/SwarmDecoderApp';
import { SwarmHealerApp } from './components/apps/SwarmHealerApp';
import { SwarmIngestorApp } from './components/apps/SwarmIngestorApp';
import { SwarmStreamerApp } from './components/apps/SwarmStreamerApp';
import { SwarmSustainerApp } from './components/apps/SwarmSustainerApp';
import { SynthesisCoreApp } from './components/apps/SynthesisCoreApp';
import { SyntheticAssemblerApp } from './components/apps/SyntheticAssemblerApp';
import { SyntheticLexerApp } from './components/apps/SyntheticLexerApp';
import { binaryStateEngine } from './kernel/BinaryStateEngine';
import { clusterBus } from './kernel/ClusterBus';
import { clusterLibraryEngine } from './kernel/ClusterLibraryEngine';
import { hyperFlowEngine } from './kernel/HyperFlowEngine';
import { liquidKernel } from './kernel/LiquidKernel';
import { swarmDecoderEngine } from './kernel/SwarmDecoderEngine';
import type {
  AnyAppId,
  BinaryRecordView,
  BinaryStateHeader,
  ClusterLibraryEntry,
  ClusterPacket,
  DecodedFrame,
  KernelMetrics,
  LibraryValidationReport,
  MountedLegacyState,
  OSWindowState,
  RepoManifest,
  RepoModuleDescriptor,
  SyntheticAssemblyBuild,
  WorkspaceView,
} from './kernel/types';

interface AppMeta {
  id: AnyAppId;
  title: string;
  subtitle: string;
  description: string;
  group: 'core' | 'hyper' | 'swarm' | 'assembly';
  icon: typeof Cpu;
}

const ALL_APPS: AppMeta[] = [
  // 5 Core Main Apps
  {
    id: 'cluster-mesh',
    title: 'Main Brain',
    subtitle: 'Unified Cluster Bus',
    description: 'Central cognitive coordinator routing real-time IPC across all apps and daemons.',
    group: 'core',
    icon: Network,
  },
  {
    id: 'kernel-monitor',
    title: 'Kernel Monitor',
    subtitle: '120Hz Lock · 90 Daemons',
    description: '8.333ms fixed-quantum scheduler, frame oscilloscope, and hybrid stream multiplexer.',
    group: 'core',
    icon: Cpu,
  },
  {
    id: 'liquid-studio',
    title: 'Liquid Studio',
    subtitle: 'GLSL Shader · Audio DSP',
    description: 'Fused WebGL2 obsidian surface presets and Web Audio FFT harmonic synthesizer.',
    group: 'core',
    icon: Sparkles,
  },
  {
    id: 'binary-vault',
    title: 'Binary Vault',
    subtitle: 'MGE1 State Image',
    description: 'Packed 24-module binary state buffer, FNV-1a checksums, and hex memory inspector.',
    group: 'core',
    icon: Binary,
  },
  {
    id: 'build-pipeline',
    title: 'Build Pipeline',
    subtitle: 'Segmented Upgrades',
    description: 'Progressive build staging that compiles and mounts GitHub games and OS modules.',
    group: 'core',
    icon: Layers,
  },
  // 5 Hyper-Awareness Extension Apps + 1 Kernel Micro Game
  {
    id: 'flow-sniffer',
    title: 'Flow Sniffer',
    subtitle: 'Sniffed Flow State',
    description: 'Live Main Brain packet sniffer calculating cluster coherence and topic entropy.',
    group: 'hyper',
    icon: Radio,
  },
  {
    id: 'fold-forge',
    title: 'Fold Forge',
    subtitle: 'Hyper Binary Folding',
    description: 'Folds the 1.09MB MGE1 binary image into 8x32-bit entropy seeds for game systems.',
    group: 'hyper',
    icon: FoldVertical,
  },
  {
    id: 'self-matrix',
    title: 'Self-Aware Matrix',
    subtitle: 'App Self-Reflection',
    description: 'Inspects live inbound/outbound awareness dialogue and resonance across all nodes.',
    group: 'hyper',
    icon: Eye,
  },
  {
    id: 'phase-harmonizer',
    title: 'Phase Harmonizer',
    subtitle: 'Hybrid Phase Lock',
    description: 'Aligns 120Hz kernel phase, AudioDSP energy, GLSL surface, and game waves.',
    group: 'hyper',
    icon: Waves,
  },
  {
    id: 'final-sequencer',
    title: 'Final Sequencer',
    subtitle: 'Final Process Guard',
    description: 'Coordinates readiness across all daemons, binary fold state, and kernel game.',
    group: 'hyper',
    icon: CheckCircle2,
  },
  {
    id: 'fold-runner',
    title: 'FoldRunner',
    subtitle: 'Kernel Micro Game',
    description: '120Hz polarity runner driven by hyper-folded MGE1 seeds; feeds entropy to cluster.',
    group: 'hyper',
    icon: Gamepad2,
  },
  // 5 Sentient Swarm Decoder Apps + 1 Processor Sustainer App
  {
    id: 'swarm-ingestor',
    title: 'Swarm Ingestor',
    subtitle: 'Universal Data Intake',
    description: 'Ingests JSON, Hex, Base64, Binary bits, CSV, or any uploaded binary file.',
    group: 'swarm',
    icon: TerminalSquare,
  },
  {
    id: 'swarm-decoder',
    title: 'Swarm Decoder',
    subtitle: 'Multi-Radix Inspector',
    description: 'Decodes incoming payloads into UTF-8 text, structured JSON, Hex matrix, and entropy.',
    group: 'swarm',
    icon: FileCode2,
  },
  {
    id: 'swarm-consensus',
    title: 'Swarm Consensus',
    subtitle: '5-Agent Evaluator',
    description: 'Autonomous parser, entropy, healer, fold, and router agents vote on every frame.',
    group: 'swarm',
    icon: Users,
  },
  {
    id: 'swarm-healer',
    title: 'Fault Healer',
    subtitle: 'Payload Auto-Repair',
    description: 'Detects and repairs broken JSON, odd hex nibbles, missing Base64 padding, and bytes.',
    group: 'swarm',
    icon: ShieldCheck,
  },
  {
    id: 'swarm-streamer',
    title: 'Swarm Streamer',
    subtitle: 'Continuous Processor',
    description: 'Streams MGE1 binary blocks and Main Brain packets into decoded exportable frames.',
    group: 'swarm',
    icon: Workflow,
  },
  {
    id: 'swarm-sustainer',
    title: 'Swarm Sustainer',
    subtitle: '20 Self-Heal Daemons',
    description: 'Sustains the Sentient Swarm processor with fault injection and 20 healing daemons.',
    group: 'swarm',
    icon: HeartPulse,
  },
  // 5 Cluster Library & Synthetic Assembly Apps + Single Fused Core App
  {
    id: 'cluster-reader',
    title: 'Cluster Reader',
    subtitle: '24+ Library Index',
    description: 'Reads source, hex slices, FNV-1a checksums, and symbols across all 24+ library modules.',
    group: 'assembly',
    icon: BookOpen,
  },
  {
    id: 'cluster-writer',
    title: 'Cluster Writer',
    subtitle: 'Edit & Grow #25+',
    description: 'Writes patches to existing modules and appends new synthetic modules past 24.',
    group: 'assembly',
    icon: PenTool,
  },
  {
    id: 'synthetic-lexer',
    title: 'Synthetic Lexer',
    subtitle: 'AST & Shader Scan',
    description: 'Extracts functions, classes, GLSL shaders, Web Audio graphs, and symbol collisions.',
    group: 'assembly',
    icon: Code2,
  },
  {
    id: 'synthetic-assembler',
    title: 'Synthetic Assembler',
    subtitle: 'Composite Forge',
    description: 'Fuses selected or all 24+ modules into HTML5, TypeScript, or JSON cluster bundles.',
    group: 'assembly',
    icon: Combine,
  },
  {
    id: 'library-validator',
    title: 'Library Validator',
    subtitle: 'Integrity & Growth',
    description: 'Audits syntax balance, checksums, and growth stability across all 24+ modules.',
    group: 'assembly',
    icon: ShieldAlert,
  },
  {
    id: 'synthesis-core',
    title: 'Synthesis Core',
    subtitle: 'Fused Core · 50 Daemons',
    description: 'Single fused core app combining all 5 cluster engines sustained by 50 dedicated daemons.',
    group: 'assembly',
    icon: Layers,
  },
];

export function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('desktop');
  const [desktopAppTab, setDesktopAppTab] = useState<'core' | 'hyper' | 'swarm' | 'assembly'>('core');
  const [daemonGroupTab, setDaemonGroupTab] = useState<'core' | 'hyper' | 'swarm' | 'assembly'>('core');

  const [metrics, setMetrics] = useState<KernelMetrics>(() => liquidKernel.getSnapshot());
  const [manifest, setManifest] = useState<RepoManifest | null>(null);
  const [binHeader, setBinHeader] = useState<BinaryStateHeader | null>(null);
  const [binRecords, setBinRecords] = useState<BinaryRecordView[]>([]);
  const [packets, setPackets] = useState<ClusterPacket[]>(() => clusterBus.getRecentPackets(50));
  const [legacyNodes, setLegacyNodes] = useState<MountedLegacyState[]>([]);
  const [decodedFrames, setDecodedFrames] = useState<DecodedFrame[]>(() => swarmDecoderEngine.getFrames());
  const [libraryEntries, setLibraryEntries] = useState<ClusterLibraryEntry[]>(() => clusterLibraryEngine.getEntries());
  const [lastAssembly, setLastAssembly] = useState<SyntheticAssemblyBuild | null>(() =>
    clusterLibraryEngine.getLastAssembly()
  );
  const [validationReport, setValidationReport] = useState<LibraryValidationReport>(() =>
    clusterLibraryEngine.getValidationReport()
  );

  const [upgradedIds, setUpgradedIds] = useState<Set<string>>(() => {
    const saved = binaryStateEngine.loadPersistedState();
    return new Set(saved?.upgradedModuleIds ?? []);
  });
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    return binaryStateEngine.loadPersistedState()?.savedAt ?? null;
  });

  const [buildingSegment, setBuildingSegment] = useState<number | null>(null);
  const [buildProgressPct, setBuildProgressPct] = useState<number>(0);

  const [windows, setWindows] = useState<OSWindowState[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const zCounter = useRef(10);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    liquidKernel.start();

    const unsubMetrics = liquidKernel.subscribeMetrics((snap) => {
      setMetrics(snap);
      setLegacyNodes(clusterBus.getLegacyStates());
    });

    const unsubBus = clusterBus.subscribe(() => {
      setPackets(clusterBus.getRecentPackets(50));
    });

    const unsubSwarm = swarmDecoderEngine.subscribe(() => {
      setDecodedFrames([...swarmDecoderEngine.getFrames()]);
    });

    const unsubLibrary = clusterLibraryEngine.subscribe(() => {
      setLibraryEntries([...clusterLibraryEngine.getEntries()]);
      setLastAssembly(clusterLibraryEngine.getLastAssembly());
      setValidationReport({ ...clusterLibraryEngine.getValidationReport() });
    });

    binaryStateEngine
      .ingestFromRepository()
      .then(({ manifest: mf, header, records }) => {
        setManifest(mf);
        setBinHeader(header);
        setBinRecords(records);
        clusterLibraryEngine.syncFromBinaryState();
        const fold = hyperFlowEngine.computeBinaryFold(false);
        clusterBus.publish(
          'binary-indexer',
          'main-brain',
          'repo.ingested',
          `${mf.modules.length} modules · Fold ${fold.foldedSeedHex}`,
          128
        );
      })
      .catch((err) => {
        clusterBus.publish('binary-indexer', 'main-brain', 'repo.error', String(err), 64);
      });

    return () => {
      unsubMetrics();
      unsubBus();
      unsubSwarm();
      unsubLibrary();
      liquidKernel.stop();
    };
  }, []);

  useEffect(() => {
    const openIds = new Set<string>();
    for (const w of windows) {
      if (!w.minimized && w.appId) openIds.add(w.appId);
    }
    hyperFlowEngine.markOpenApps(openIds);
  }, [windows]);

  const persistUpgrades = useCallback(
    (nextSet: Set<string>) => {
      const ids = Array.from(nextSet);
      const segs = Array.from(
        new Set(
          (manifest?.modules ?? [])
            .filter((m) => nextSet.has(m.id))
            .map((m) => m.segment)
        )
      );
      const saved = binaryStateEngine.savePersistedState(ids, segs);
      setLastSavedAt(saved.savedAt);
      clusterBus.publish('vault-persister', 'binary-vault', 'vault.checkpoint', `${ids.length} modules saved`, 80);
    },
    [manifest]
  );

  const upgradeModule = useCallback(
    (mod: RepoModuleDescriptor) => {
      setUpgradedIds((prev) => {
        const next = new Set(prev);
        next.add(mod.id);
        const idx = manifest?.modules.findIndex((m) => m.id === mod.id) ?? -1;
        if (idx >= 0) binaryStateEngine.setModuleFlag(idx, 1, true);
        persistUpgrades(next);
        return next;
      });
    },
    [manifest, persistUpgrades]
  );

  const startSegmentUpgrade = useCallback(
    (segment: 1 | 2 | 3) => {
      if (!manifest || buildingSegment !== null) return;
      const targets = manifest.modules.filter((m) => m.segment === segment && !upgradedIds.has(m.id));
      if (targets.length === 0) return;

      setBuildingSegment(segment);
      setBuildProgressPct(0);
      clusterBus.publish('segment-builder', 'main-brain', 'build.start', `Segment ${segment} (${targets.length} modules)`, 96);

      let cursor = 0;
      liquidKernel.registerBuildStepper(() => {
        if (cursor >= targets.length) {
          liquidKernel.registerBuildStepper(null);
          setBuildingSegment(null);
          setBuildProgressPct(100);
          clusterBus.publish('segment-builder', '*', 'build.complete', `Segment ${segment} upgraded into cluster`, 128);
          return;
        }

        const mod = targets[cursor];
        cursor++;
        setUpgradedIds((prev) => {
          const next = new Set(prev);
          next.add(mod.id);
          const idx = manifest.modules.findIndex((m) => m.id === mod.id);
          if (idx >= 0) binaryStateEngine.setModuleFlag(idx, 1, true);
          if (cursor === targets.length) {
            persistUpgrades(next);
          }
          return next;
        });

        setBuildProgressPct(Math.round((cursor / targets.length) * 100));
        clusterBus.publish('segment-builder', 'binary-indexer', 'module.compiled', `${mod.name} (${mod.fnvHex})`, 72);
      });
    },
    [manifest, buildingSegment, upgradedIds, persistUpgrades]
  );

  const openApp = useCallback((appId: AnyAppId) => {
    setActiveView('desktop');
    const meta = ALL_APPS.find((a) => a.id === appId);
    if (!meta) return;

    const winId = `app:${appId}`;
    zCounter.current += 1;
    const nextZ = zCounter.current;

    setWindows((prev) => {
      const existing = prev.find((w) => w.id === winId);
      if (existing) {
        return prev.map((w) => (w.id === winId ? { ...w, minimized: false, zIndex: nextZ } : w));
      }

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const width = Math.min(920, Math.max(320, vw - 48));
      const height = Math.min(600, Math.max(380, vh - 148));
      const offset = (prev.length % 4) * 24;

      const created: OSWindowState = {
        id: winId,
        title: meta.title,
        subtitle: meta.subtitle,
        kind: meta.group,
        appId,
        x: Math.max(16, Math.round((vw - width) / 2) + offset - 24),
        y: Math.max(58, Math.round((vh - height) / 2) + offset - 20),
        width,
        height,
        zIndex: nextZ,
        minimized: false,
        maximized: vw < 768,
      };
      return [...prev, created];
    });

    setFocusedWindowId(winId);
    clusterBus.publish('main-brain', appId, 'app.focus', `Activated ${meta.title}`, 64);
  }, []);

  const launchRepoModule = useCallback((mod: RepoModuleDescriptor) => {
    setActiveView('desktop');
    const winId = `legacy:${mod.id}`;
    zCounter.current += 1;
    const nextZ = zCounter.current;

    setWindows((prev) => {
      const existing = prev.find((w) => w.id === winId);
      if (existing) {
        return prev.map((w) => (w.id === winId ? { ...w, minimized: false, zIndex: nextZ } : w));
      }

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const width = Math.min(980, Math.max(320, vw - 48));
      const height = Math.min(640, Math.max(400, vh - 148));

      const created: OSWindowState = {
        id: winId,
        title: mod.name,
        subtitle: `Seg ${mod.segment} · ${mod.fnvHex}`,
        kind: 'legacy',
        module: mod,
        x: Math.max(16, Math.round((vw - width) / 2)),
        y: Math.max(58, Math.round((vh - height) / 2) - 10),
        width,
        height,
        zIndex: nextZ,
        minimized: false,
        maximized: vw < 768,
      };
      return [...prev, created];
    });

    setFocusedWindowId(winId);
  }, []);

  const focusWindow = useCallback((id: string) => {
    zCounter.current += 1;
    const nextZ = zCounter.current;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: nextZ } : w)));
    setFocusedWindowId(id);
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)));
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFocusedWindowId((cur) => (cur === id ? null : cur));
  }, []);

  const resetWorkspace = useCallback(() => {
    setWindows([]);
    setFocusedWindowId(null);
    setActiveView('desktop');
    clusterBus.publish('main-brain', '*', 'workspace.reset', 'Cleared desktop window stack', 48);
  }, []);

  const upgradedModules = useMemo(() => {
    return (manifest?.modules ?? []).filter((m) => upgradedIds.has(m.id));
  }, [manifest, upgradedIds]);

  const visibleDesktopWindows = useMemo(() => {
    if (!isMobile) return windows;
    const active = windows.filter((w) => !w.minimized);
    if (active.length === 0) return [];
    const focused = active.find((w) => w.id === focusedWindowId) || active[active.length - 1];
    return [{ ...focused, maximized: true }];
  }, [windows, isMobile, focusedWindowId]);

  const displayedApps = useMemo(() => {
    return ALL_APPS.filter((a) => a.group === desktopAppTab);
  }, [desktopAppTab]);

  const displayedDaemons = useMemo(() => {
    return metrics.daemons.filter((d) => d.group === daemonGroupTab);
  }, [metrics.daemons, daemonGroupTab]);

  const latestPacket = packets[0];

  const renderAppBody = (appId: AnyAppId) => {
    switch (appId) {
      case 'kernel-monitor':
        return <KernelMonitorApp metrics={metrics} />;
      case 'cluster-mesh':
        return (
          <ClusterMeshApp
            daemons={metrics.daemons}
            upgradedModules={upgradedModules}
            packets={packets}
            legacyNodes={legacyNodes}
          />
        );
      case 'binary-vault':
        return (
          <BinaryVaultApp
            manifest={manifest}
            header={binHeader}
            records={binRecords}
            upgradedIds={upgradedIds}
            onPersistCheckpoint={() => persistUpgrades(upgradedIds)}
            lastSavedAt={lastSavedAt}
          />
        );
      case 'build-pipeline':
        return (
          <BuildPipelineApp
            modules={manifest?.modules ?? []}
            upgradedIds={upgradedIds}
            buildingSegment={buildingSegment}
            buildProgressPct={buildProgressPct}
            onStartSegmentUpgrade={startSegmentUpgrade}
            onUpgradeSingleModule={upgradeModule}
            onLaunchModule={launchRepoModule}
          />
        );
      case 'liquid-studio':
        return <LiquidStudioApp activePreset={metrics.shaderPreset} dprScale={metrics.dprScale} />;
      case 'flow-sniffer':
        return <FlowSnifferApp flowState={metrics.flowState} packets={packets} />;
      case 'fold-forge':
        return <FoldForgeApp foldResult={metrics.foldResult} />;
      case 'self-matrix':
        return <SelfMatrixApp awareness={metrics.selfAwareness} />;
      case 'phase-harmonizer':
        return <PhaseHarmonizerApp metrics={metrics} />;
      case 'final-sequencer':
        return (
          <FinalSequencerApp
            metrics={metrics}
            binHeader={binHeader}
            upgradedCount={upgradedModules.length}
            totalModules={manifest?.modules.length ?? 24}
            onLaunchGame={() => openApp('fold-runner')}
          />
        );
      case 'fold-runner':
        return <FoldRunnerApp foldResult={metrics.foldResult} flowScore={metrics.flowState.flowScore} />;
      case 'swarm-ingestor':
        return <SwarmIngestorApp frames={decodedFrames} onOpenDecoder={() => openApp('swarm-decoder')} />;
      case 'swarm-decoder':
        return <SwarmDecoderApp frames={decodedFrames} />;
      case 'swarm-consensus':
        return <SwarmConsensusApp frames={decodedFrames} />;
      case 'swarm-healer':
        return <SwarmHealerApp frames={decodedFrames} health={metrics.swarmHealth} />;
      case 'swarm-streamer':
        return <SwarmStreamerApp frames={decodedFrames} />;
      case 'swarm-sustainer':
        return <SwarmSustainerApp health={metrics.swarmHealth} daemons={metrics.daemons} />;
      case 'cluster-reader':
        return (
          <ClusterReaderApp
            entries={libraryEntries}
            onSendToWriter={() => openApp('cluster-writer')}
            onAddToAssembly={() => openApp('synthetic-assembler')}
          />
        );
      case 'cluster-writer':
        return <ClusterWriterApp entries={libraryEntries} />;
      case 'synthetic-lexer':
        return <SyntheticLexerApp entries={libraryEntries} />;
      case 'synthetic-assembler':
        return <SyntheticAssemblerApp entries={libraryEntries} lastBuild={lastAssembly} />;
      case 'library-validator':
        return (
          <LibraryValidatorApp
            entries={libraryEntries}
            report={validationReport}
            onSelectForFix={() => openApp('cluster-writer')}
          />
        );
      case 'synthesis-core':
        return (
          <SynthesisCoreApp
            entries={libraryEntries}
            health={metrics.fusionHealth}
            validationReport={validationReport}
            lastBuild={lastAssembly}
            daemons={metrics.daemons}
          />
        );
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-[#030508] text-slate-100">
      <BlackGlassSurface />

      <TopBar
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        kernelTickHz={metrics.kernelTickHz}
        renderFps={metrics.renderFps}
        onResetWorkspace={resetWorkspace}
      />

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto pb-20">
        {activeView === 'desktop' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Main Brain & Swarm Processor Summary Banner */}
            <section className="p-4 sm:p-5 rounded-xl black-glass flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-sky-300 font-medium">
                  <Activity className="w-4 h-4 shrink-0" />
                  <span>
                    Main Brain · {libraryEntries.length || 24} Library Modules · Flow {metrics.flowState.flowScore}% · Fusion {metrics.fusionHealth.healthPct}%
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-100 tracking-tight">
                  Black Glass Liquid OS
                </h1>
                <p className="text-xs text-slate-400 font-mono truncate tabular-nums">
                  {latestPacket
                    ? `${latestPacket.from} -> ${latestPacket.to} · ${latestPacket.topic}: ${latestPacket.payloadSummary}`
                    : 'Initializing 120Hz awareness bus...'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="text-left sm:text-right font-mono text-xs tabular-nums">
                  <div className="text-slate-100">
                    {metrics.daemons.filter((d) => d.state !== 'paused').length}/{metrics.daemons.length} Daemons Active
                  </div>
                  <div className="text-slate-400">
                    Fold {metrics.foldResult.foldedSeedHex} · {metrics.fusionHealth.syntheticGrowthCount} Grown · {metrics.swarmHealth.totalDecoded} Decoded
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openApp('synthesis-core')}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 whitespace-nowrap cursor-pointer"
                >
                  Synthesis Core
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clusterBus.publish('main-brain', '*', 'brain.sync', 'Full cluster synchronization', 112);
                    openApp('cluster-mesh');
                  }}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-sky-100 whitespace-nowrap cursor-pointer"
                >
                  Open Main Brain
                </button>
              </div>
            </section>

            {/* Segmented Application Cluster */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setDesktopAppTab('core')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      desktopAppTab === 'core'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    5 Main Apps
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopAppTab('hyper')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      desktopAppTab === 'hyper'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    5 Hyper + FoldRunner
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopAppTab('swarm')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      desktopAppTab === 'swarm'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    5 Sentient Swarm + Sustainer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesktopAppTab('assembly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      desktopAppTab === 'assembly'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    5 Assembly + Fusion Core
                  </button>
                </div>

                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {metrics.flowState.sniffedPerSec} pkt/s · {libraryEntries.length || 24} modules
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {displayedApps.map((app) => {
                  const Icon = app.icon;
                  const isOpen = windows.some((w) => w.id === `app:${app.id}` && !w.minimized);
                  const self = metrics.selfAwareness.find((s) => s.appId === app.id);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => openApp(app.id)}
                      className={`p-4 rounded-xl text-left black-glass transition-colors flex flex-col justify-between gap-3 cursor-pointer ${
                        isOpen
                          ? 'border-sky-400/45 bg-sky-500/[0.08]'
                          : 'hover:border-white/25 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Icon className="w-5 h-5 text-sky-300" />
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                            {isOpen ? 'Active' : `${Math.round(self?.resonancePct ?? 72)}% sync`}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{app.title}</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{app.subtitle}</div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{app.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 40 Sustaining Kernel Daemons (10 Core | 10 Hyper | 20 Self-Healing Swarm) */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.08] overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setDaemonGroupTab('core')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      daemonGroupTab === 'core'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    10 Core Daemons
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaemonGroupTab('hyper')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      daemonGroupTab === 'hyper'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    10 Hyper Daemons
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaemonGroupTab('swarm')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      daemonGroupTab === 'swarm'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    20 Self-Healing Daemons
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaemonGroupTab('assembly')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      daemonGroupTab === 'assembly'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    50 Fusion Daemons
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openApp(
                      daemonGroupTab === 'swarm'
                        ? 'swarm-sustainer'
                        : daemonGroupTab === 'assembly'
                          ? 'synthesis-core'
                          : 'kernel-monitor'
                    )
                  }
                  className="text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  {daemonGroupTab === 'swarm'
                    ? 'Open Swarm Sustainer →'
                    : daemonGroupTab === 'assembly'
                      ? 'Open Synthesis Core →'
                      : 'Inspect Kernel Scheduler →'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {displayedDaemons.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      openApp(
                        daemonGroupTab === 'swarm'
                          ? 'swarm-sustainer'
                          : daemonGroupTab === 'assembly'
                            ? 'synthesis-core'
                            : 'kernel-monitor'
                      )
                    }
                    className="p-3 rounded-lg text-left black-glass hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-slate-100 truncate">{d.name}</span>
                      <span
                        className={`font-mono text-[10px] shrink-0 ${
                          d.state === 'running'
                            ? 'text-emerald-400'
                            : d.state === 'healing'
                              ? 'text-amber-400'
                              : 'text-slate-500'
                        }`}
                      >
                        {d.targetHz}Hz
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-400 truncate tabular-nums">
                      {d.lastSummary}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Upgraded Repo Modules */}
            <section className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <h2 className="font-semibold text-slate-200">
                  Upgraded Cluster Modules ({upgradedModules.length})
                </h2>
                <button
                  type="button"
                  onClick={() => openApp('build-pipeline')}
                  className="text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  Open Build Pipeline →
                </button>
              </div>

              {upgradedModules.length === 0 ? (
                <div className="p-4 rounded-xl black-glass flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    All {manifest?.modules.length ?? 24} GitHub modules are folded into {metrics.foldResult.foldedSeedHex} and ready for segmented build deployment.
                  </div>
                  <button
                    type="button"
                    onClick={() => startSegmentUpgrade(1)}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Upgrade Segment 1 (Engines)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {upgradedModules.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => launchRepoModule(mod)}
                      className="p-3 rounded-lg text-left black-glass hover:border-sky-400/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span className="font-mono text-[10px] text-slate-400">Seg {mod.segment}</span>
                      </div>
                      <div className="mt-1.5 text-xs font-semibold text-slate-100 truncate">{mod.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{mod.capabilities[0] || mod.kind}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeView === 'cluster' && (
          <div className="max-w-6xl mx-auto m-4 rounded-xl black-glass-elevated overflow-hidden">
            {renderAppBody('cluster-mesh')}
          </div>
        )}

        {activeView === 'swarm' && (
          <div className="max-w-6xl mx-auto m-4 space-y-4">
            <div className="rounded-xl black-glass-elevated overflow-hidden">
              {renderAppBody('swarm-ingestor')}
            </div>
            <div className="rounded-xl black-glass-elevated overflow-hidden">
              {renderAppBody('swarm-sustainer')}
            </div>
          </div>
        )}

        {activeView === 'fusion' && (
          <div className="max-w-6xl mx-auto m-4 rounded-xl black-glass-elevated overflow-hidden">
            {renderAppBody('synthesis-core')}
          </div>
        )}

        {activeView === 'binary' && (
          <div className="max-w-6xl mx-auto m-4 rounded-xl black-glass-elevated overflow-hidden">
            {renderAppBody('binary-vault')}
          </div>
        )}

        {activeView === 'pipeline' && (
          <div className="max-w-6xl mx-auto m-4 rounded-xl black-glass-elevated overflow-hidden">
            {renderAppBody('build-pipeline')}
          </div>
        )}

        {activeView === 'game' && (
          <div className="max-w-5xl mx-auto m-4 rounded-xl black-glass-elevated overflow-hidden">
            {renderAppBody('fold-runner')}
          </div>
        )}
      </main>

      {/* Floating / Mobile-Safe Black Glass Windows */}
      {activeView === 'desktop' &&
        visibleDesktopWindows.map((win) => (
          <WindowFrame
            key={win.id}
            win={win}
            isFocused={focusedWindowId === win.id}
            onFocus={focusWindow}
            onMove={moveWindow}
            onMinimize={minimizeWindow}
            onToggleMaximize={toggleMaximizeWindow}
            onClose={closeWindow}
          >
            {win.kind !== 'legacy' && win.appId
              ? renderAppBody(win.appId)
              : win.module && (
                  <LegacyBridgeWindow
                    module={win.module}
                    bridgeState={legacyNodes.find((l) => l.moduleId === win.module?.id)}
                  />
                )}
          </WindowFrame>
        ))}

      {/* Bottom Obsidian Dock */}
      <nav
        aria-label="OS Application Dock"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-[96vw] px-2.5 py-1.5 rounded-xl black-glass-elevated flex items-center gap-1.5 overflow-x-auto"
      >
        {ALL_APPS.filter((a) => a.group === desktopAppTab).map((app) => {
          const Icon = app.icon;
          const win = windows.find((w) => w.id === `app:${app.id}`);
          const isOpen = Boolean(win && !win.minimized);
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => openApp(app.id)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isOpen
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-white/[0.07]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{app.title}</span>
            </button>
          );
        })}

        {windows
          .filter((w) => w.kind === 'legacy' && w.module)
          .map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => w.module && launchRepoModule(w.module)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                !w.minimized
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
                  : 'text-slate-300 hover:bg-white/[0.07]'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{w.title}</span>
            </button>
          ))}
      </nav>
    </div>
  );
}

export default App;
