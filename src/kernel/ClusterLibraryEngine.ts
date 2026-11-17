import { binaryStateEngine } from './BinaryStateEngine';
import { clusterBus } from './ClusterBus';
import type {
  AssemblyTargetMode,
  ClusterFusionHealth,
  ClusterLibraryEntry,
  LexerAnalysis,
  LexerModuleMetrics,
  LibraryValidationIssue,
  LibraryValidationReport,
  SyntheticAssemblyBuild,
} from './types';

const LIBRARY_STORAGE_KEY = 'liquid_os_cluster_library_v1';

interface PersistedLibraryState {
  overrides: Record<
    string,
    {
      title: string;
      sourceCode: string;
      version: number;
      updatedAt: number;
    }
  >;
  syntheticEntries: ClusterLibraryEntry[];
}

function fnv1aString(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return '0x' + (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function detectCapabilities(text: string, name: string): string[] {
  const lower = text.toLowerCase();
  const caps: string[] = [];
  if (lower.includes('webgl') || lower.includes('gl_fragcolor') || lower.includes("getcontext('webgl")) {
    caps.push('WebGL2');
  }
  if (lower.includes('three.') || lower.includes('three.min.js') || lower.includes("from 'three'")) {
    caps.push('Three.js');
  }
  if (lower.includes('audiocontext') || lower.includes('biquadfilter') || lower.includes('createoscillator')) {
    caps.push('AudioDSP');
  }
  if (lower.includes('velocity') || lower.includes('gravity') || lower.includes('raycaster') || lower.includes('ballistic')) {
    caps.push('Physics');
  }
  if (lower.includes('swarm') || lower.includes('sentient') || lower.includes('agi') || lower.includes('neural')) {
    caps.push('SwarmAI');
  }
  if (lower.includes('shader') || lower.includes('glsl') || lower.includes('sdf') || name === 'AutoCAD') {
    caps.push('ShaderCAD');
  }
  if (lower.includes('bezier') || lower.includes('connections') || name === 'TF') {
    caps.push('NodeGraph');
  }
  if (lower.includes('localstorage') || lower.includes('opfs') || lower.includes('indexeddb') || lower.includes('sqlite')) {
    caps.push('Storage');
  }
  return caps;
}

function extractSymbols(text: string): { functions: string[]; classes: string[]; all: string[]; totalCount: number } {
  const fnMatches = [...text.matchAll(/function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  const clsMatches = [...text.matchAll(/class\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  const uniqueFns = Array.from(new Set(fnMatches));
  const uniqueCls = Array.from(new Set(clsMatches));
  const all = Array.from(new Set([...uniqueCls, ...uniqueFns]));
  return {
    functions: uniqueFns.slice(0, 32),
    classes: uniqueCls.slice(0, 24),
    all: all.slice(0, 32),
    totalCount: fnMatches.length + clsMatches.length,
  };
}

type LibraryListener = () => void;

export class ClusterLibraryEngine {
  private entries: ClusterLibraryEntry[] = [];
  private listeners = new Set<LibraryListener>();
  private lastBuild: SyntheticAssemblyBuild | null = null;
  private lastValidation: LibraryValidationReport = {
    healthPct: 100,
    checkedCount: 0,
    passedCount: 0,
    warningCount: 0,
    faultCount: 0,
    growthCount: 0,
    modifiedCount: 0,
    issues: [],
    validatedAt: Date.now(),
  };

  public health: ClusterFusionHealth = {
    healthPct: 100,
    totalLibraryCount: 0,
    baseRepoCount: 0,
    syntheticGrowthCount: 0,
    modifiedCount: 0,
    activeAssemblyDaemons: 50,
    totalWrites: 0,
    totalAssemblies: 0,
    autoSustainEnabled: true,
    lastAction: '50 fusion daemons standing by for 24+ library sync',
  };

  public subscribe(fn: LibraryListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.updateHealthCounters();
    for (const fn of this.listeners) fn();
  }

  private loadPersisted(): PersistedLibraryState {
    try {
      const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (!raw) return { overrides: {}, syntheticEntries: [] };
      const parsed = JSON.parse(raw) as PersistedLibraryState;
      return {
        overrides: parsed.overrides ?? {},
        syntheticEntries: Array.isArray(parsed.syntheticEntries) ? parsed.syntheticEntries : [],
      };
    } catch {
      return { overrides: {}, syntheticEntries: [] };
    }
  }

  private savePersisted(): void {
    const overrides: PersistedLibraryState['overrides'] = {};
    const syntheticEntries: ClusterLibraryEntry[] = [];
    for (const entry of this.entries) {
      if (entry.origin === 'modified') {
        overrides[entry.id] = {
          title: entry.title,
          sourceCode: entry.sourceCode,
          version: entry.version,
          updatedAt: entry.updatedAt,
        };
      } else if (entry.origin === 'synthetic') {
        syntheticEntries.push(entry);
      }
    }
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ overrides, syntheticEntries }));
    } catch {
      // Ignore storage quota errors
    }
  }

  public syncFromBinaryState(): ClusterLibraryEntry[] {
    const manifest = binaryStateEngine.manifest;
    const rawBuffer = binaryStateEngine.rawBuffer;
    const records = binaryStateEngine.records;
    if (!manifest || !rawBuffer) return this.entries;

    const dec = new TextDecoder('utf-8', { fatal: false });
    const bytes = new Uint8Array(rawBuffer);
    const persisted = this.loadPersisted();

    const baseEntries: ClusterLibraryEntry[] = manifest.modules.map((mod) => {
      const rec = records.find((r) => r.name === mod.name);
      const rawSource =
        rec && rec.payloadOffset + rec.payloadLength <= bytes.length
          ? dec.decode(bytes.subarray(rec.payloadOffset, rec.payloadOffset + rec.payloadLength))
          : '';
      const override = persisted.overrides[mod.id];
      const sourceCode = override ? override.sourceCode : rawSource;
      const syms = extractSymbols(sourceCode);
      const sizeBytes = new TextEncoder().encode(sourceCode).length;

      return {
        id: mod.id,
        name: mod.name,
        title: override ? override.title : mod.title,
        kind: mod.kind,
        segment: mod.segment,
        origin: override ? 'modified' : 'repo-base',
        sourceCode,
        sizeBytes,
        fnvHex: override ? fnv1aString(sourceCode) : mod.fnvHex,
        capabilities: override ? detectCapabilities(sourceCode, mod.name) : mod.capabilities,
        symbols: syms.all,
        symbolCount: syms.totalCount,
        version: override ? override.version : 1,
        updatedAt: override ? override.updatedAt : Date.now(),
      };
    });

    const merged = [...baseEntries, ...persisted.syntheticEntries];
    this.entries = merged;
    this.validateAll(false);
    this.health.lastAction = `Indexed ${merged.length} cluster modules (${baseEntries.length} base + ${persisted.syntheticEntries.length} grown)`;
    this.notify();

    clusterBus.publish(
      'cluster-reader',
      'synthesis-core',
      'library.indexed',
      `${merged.length} cluster modules live in Synthesis Core`,
      128
    );

    return this.entries;
  }

  public getEntries(): ClusterLibraryEntry[] {
    return this.entries;
  }

  public getEntry(id: string): ClusterLibraryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  public writeModuleSource(id: string, newSource: string, newTitle?: string): ClusterLibraryEntry | null {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const prev = this.entries[idx];
    const syms = extractSymbols(newSource);
    const sizeBytes = new TextEncoder().encode(newSource).length;
    const fnvHex = fnv1aString(newSource);
    const capabilities = detectCapabilities(newSource, prev.name);

    const updated: ClusterLibraryEntry = {
      ...prev,
      title: newTitle?.trim() || prev.title,
      origin: prev.origin === 'synthetic' ? 'synthetic' : 'modified',
      sourceCode: newSource,
      sizeBytes,
      fnvHex,
      capabilities,
      symbols: syms.all,
      symbolCount: syms.totalCount,
      version: prev.version + 1,
      updatedAt: Date.now(),
    };

    this.entries = [...this.entries.slice(0, idx), updated, ...this.entries.slice(idx + 1)];
    this.health.totalWrites++;
    this.health.lastAction = `Written ${updated.name} v${updated.version} (${fnvHex})`;
    this.savePersisted();
    this.validateAll(false);
    this.notify();

    clusterBus.publish(
      'cluster-writer',
      'synthesis-core',
      'library.written',
      `${updated.name} v${updated.version} · ${sizeBytes}B · ${fnvHex}`,
      96
    );
    return updated;
  }

  public createSyntheticModule(params: {
    name: string;
    title: string;
    kind: 'html' | 'json' | 'typescript';
    segment: 1 | 2 | 3;
    sourceCode: string;
  }): ClusterLibraryEntry {
    const cleanName = params.name.trim() || `SyntheticMod_${this.entries.length + 1}`;
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const uniqueId = this.entries.some((e) => e.id === baseSlug)
      ? `${baseSlug}-${this.entries.length + 1}`
      : baseSlug || `synth-${this.entries.length + 1}`;

    const syms = extractSymbols(params.sourceCode);
    const sizeBytes = new TextEncoder().encode(params.sourceCode).length;
    const fnvHex = fnv1aString(params.sourceCode);
    const capabilities = detectCapabilities(params.sourceCode, cleanName);

    const created: ClusterLibraryEntry = {
      id: uniqueId,
      name: cleanName,
      title: params.title.trim() || cleanName,
      kind: params.kind,
      segment: params.segment,
      origin: 'synthetic',
      sourceCode: params.sourceCode,
      sizeBytes,
      fnvHex,
      capabilities: capabilities.length > 0 ? capabilities : ['SwarmAI'],
      symbols: syms.all,
      symbolCount: syms.totalCount,
      version: 1,
      updatedAt: Date.now(),
    };

    this.entries = [...this.entries, created];
    this.health.totalWrites++;
    this.health.lastAction = `Library expanded to ${this.entries.length} modules (+${created.name})`;
    this.savePersisted();
    this.validateAll(false);
    this.notify();

    clusterBus.publish(
      'cluster-writer',
      '*',
      'library.grown',
      `Library grown to ${this.entries.length} modules (+${created.name})`,
      128
    );
    return created;
  }

  public resetBaseModule(id: string): void {
    const manifest = binaryStateEngine.manifest;
    const rawBuffer = binaryStateEngine.rawBuffer;
    const records = binaryStateEngine.records;
    if (!manifest || !rawBuffer) return;

    const mod = manifest.modules.find((m) => m.id === id);
    const rec = records.find((r) => r.name === mod?.name);
    if (!mod || !rec) return;

    const dec = new TextDecoder('utf-8', { fatal: false });
    const bytes = new Uint8Array(rawBuffer);
    const original = dec.decode(bytes.subarray(rec.payloadOffset, rec.payloadOffset + rec.payloadLength));
    const syms = extractSymbols(original);

    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx < 0) return;

    const restored: ClusterLibraryEntry = {
      id: mod.id,
      name: mod.name,
      title: mod.title,
      kind: mod.kind,
      segment: mod.segment,
      origin: 'repo-base',
      sourceCode: original,
      sizeBytes: mod.sizeBytes,
      fnvHex: mod.fnvHex,
      capabilities: mod.capabilities,
      symbols: syms.all,
      symbolCount: syms.totalCount,
      version: 1,
      updatedAt: Date.now(),
    };

    this.entries = [...this.entries.slice(0, idx), restored, ...this.entries.slice(idx + 1)];
    this.health.lastAction = `Restored ${restored.name} to original MGE1 image`;
    this.savePersisted();
    this.validateAll(false);
    this.notify();
  }

  public deleteSyntheticModule(id: string): void {
    const target = this.entries.find((e) => e.id === id);
    if (!target || target.origin !== 'synthetic') return;
    this.entries = this.entries.filter((e) => e.id !== id);
    this.health.lastAction = `Removed synthetic module ${target.name} (${this.entries.length} remain)`;
    this.savePersisted();
    this.validateAll(false);
    this.notify();
  }

  public analyzeSelection(moduleIds: string[]): LexerAnalysis {
    const selected = moduleIds.length > 0
      ? this.entries.filter((e) => moduleIds.includes(e.id))
      : this.entries;

    let totalLines = 0;
    let totalBytes = 0;
    const capCounts: Record<string, number> = {};
    const symbolOwners = new Map<string, string[]>();
    const modules: LexerModuleMetrics[] = [];

    for (const entry of selected) {
      const lines = entry.sourceCode.split('\n').length;
      totalLines += lines;
      totalBytes += entry.sizeBytes;
      const syms = extractSymbols(entry.sourceCode);
      const lower = entry.sourceCode.toLowerCase();
      const shaderBlocks = (lower.match(/void\s+main\s*\(/g) ?? []).length + (lower.match(/gl_fragcolor/g) ?? []).length;
      const audioNodes = (lower.match(/createoscillator|biquadfilter|audiocontext|creategain/g) ?? []).length;
      const hasRenderLoop = lower.includes('requestanimationframe');

      for (const cap of entry.capabilities) {
        capCounts[cap] = (capCounts[cap] ?? 0) + 1;
      }

      for (const sym of syms.all) {
        const owners = symbolOwners.get(sym) ?? [];
        owners.push(entry.name);
        symbolOwners.set(sym, owners);
      }

      modules.push({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        lines,
        functions: syms.functions,
        classes: syms.classes,
        shaderBlocks,
        audioNodes,
        hasRenderLoop,
        capabilities: entry.capabilities,
      });
    }

    const collisions: string[] = [];
    for (const [sym, owners] of symbolOwners.entries()) {
      if (owners.length > 1) {
        collisions.push(`${sym} (${owners.slice(0, 3).join(', ')})`);
      }
    }

    return {
      analyzedCount: modules.length,
      totalLines,
      totalBytes,
      uniqueCapabilities: Object.keys(capCounts),
      capabilityCounts: capCounts,
      symbolCollisions: collisions.slice(0, 24),
      modules,
    };
  }

  public assembleCluster(params: {
    targetName: string;
    mode: AssemblyTargetMode;
    moduleIds: string[];
    includeRuntimeShim: boolean;
  }): SyntheticAssemblyBuild {
    const selected = this.entries.filter((e) => params.moduleIds.includes(e.id));
    const list = selected.length > 0 ? selected : this.entries.slice(0, 4);
    const targetName = params.targetName.trim() || `FusionBuild_${list.length}Mod`;

    const allCaps = Array.from(new Set(list.flatMap((m) => m.capabilities)));
    const totalSyms = list.reduce((acc, m) => acc + m.symbolCount, 0);
    let assembledCode = '';

    if (params.mode === 'html-cluster') {
      const modulePanels = list
        .map((m) => {
          const safeTitle = m.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const safeCaps = m.capabilities.join(' / ') || m.kind.toUpperCase();
          return `<div class="mod-card" data-id="${m.id}">
        <div class="mod-head"><strong>${m.name}</strong><span>Seg ${m.segment} · ${m.fnvHex}</span></div>
        <div class="mod-meta">${safeTitle} · ${m.sizeBytes.toLocaleString()} B · ${safeCaps}</div>
      </div>`;
        })
        .join('\n      ');

      const manifestJson = JSON.stringify(
        list.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          segment: m.segment,
          sizeBytes: m.sizeBytes,
          fnvHex: m.fnvHex,
          symbols: m.symbols.slice(0, 8),
        })),
        null,
        2
      );

      const bridgeShim = params.includeRuntimeShim
        ? `<script>
    window.__LIQUID_CLUSTER_ASSEMBLY__ = {
      target: ${JSON.stringify(targetName)},
      modulesCount: ${list.length},
      capabilities: ${JSON.stringify(allCaps)},
      modules: ${manifestJson}
    };
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        source: 'liquid-os-bridge',
        type: 'CLUSTER_EVENT',
        nodeName: ${JSON.stringify(targetName)},
        payload: { kind: 'assembly', detail: 'Mounted ${list.length} fused modules' }
      }, '*');
    }
  </script>`
        : '';

      assembledCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${targetName} — Fused ${list.length}-Module Synthetic Cluster</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #04070d; color: #e2e8f0; padding: 20px; }
    header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 12px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 16px; font-weight: 600; }
    .sub { font-family: ui-monospace, monospace; font-size: 12px; color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
    .mod-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px; }
    .mod-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    .mod-head span { font-family: ui-monospace, monospace; color: #38bdf8; font-size: 11px; }
    .mod-meta { font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <header>
    <h1>${targetName}</h1>
    <div class="sub">${list.length} Fused Modules · ${allCaps.join(' · ') || 'Universal'}</div>
  </header>
  <section class="grid">
      ${modulePanels}
  </section>
  ${bridgeShim}
</body>
</html>`;
    } else if (params.mode === 'ts-kernel-bundle') {
      const exportsList = list
        .map(
          (m) => `  {
    id: ${JSON.stringify(m.id)},
    name: ${JSON.stringify(m.name)},
    kind: ${JSON.stringify(m.kind)},
    segment: ${m.segment},
    fnvHex: ${JSON.stringify(m.fnvHex)},
    sizeBytes: ${m.sizeBytes},
    capabilities: ${JSON.stringify(m.capabilities)},
    symbols: ${JSON.stringify(m.symbols.slice(0, 10))},
  }`
        )
        .join(',\n');

      assembledCode = `export interface SynthesizedClusterModule {
  id: string;
  name: string;
  kind: 'html' | 'json' | 'typescript';
  segment: 1 | 2 | 3;
  fnvHex: string;
  sizeBytes: number;
  capabilities: string[];
  symbols: string[];
}

export const ASSEMBLY_NAME = ${JSON.stringify(targetName)};
export const ASSEMBLY_CAPABILITIES = ${JSON.stringify(allCaps)};

export const FUSED_CLUSTER_MODULES: SynthesizedClusterModule[] = [
${exportsList}
];

export function resolveClusterCapability(cap: string): SynthesizedClusterModule[] {
  return FUSED_CLUSTER_MODULES.filter((m) => m.capabilities.includes(cap));
}
`;
    } else {
      assembledCode = JSON.stringify(
        {
          targetName,
          assembledAt: new Date().toISOString(),
          totalModules: list.length,
          totalLibraryPopulation: this.entries.length,
          combinedCapabilities: allCaps,
          totalSymbols: totalSyms,
          modules: list.map((m) => ({
            id: m.id,
            name: m.name,
            title: m.title,
            kind: m.kind,
            segment: m.segment,
            origin: m.origin,
            sizeBytes: m.sizeBytes,
            fnvHex: m.fnvHex,
            capabilities: m.capabilities,
            symbols: m.symbols,
          })),
        },
        null,
        2
      );
    }

    const outputBytes = new TextEncoder().encode(assembledCode).length;
    const fnvHex = fnv1aString(assembledCode);

    const build: SyntheticAssemblyBuild = {
      id: `asm-${Date.now()}`,
      targetName,
      mode: params.mode,
      sourceModuleIds: list.map((m) => m.id),
      sourceModuleNames: list.map((m) => m.name),
      assembledCode,
      outputBytes,
      fnvHex,
      capabilities: allCaps,
      symbolCount: totalSyms,
      createdAt: Date.now(),
    };

    this.lastBuild = build;
    this.health.totalAssemblies++;
    this.health.lastAction = `Assembled ${targetName} (${list.length} modules -> ${outputBytes.toLocaleString()}B)`;
    binaryStateEngine.registerBank[47] = outputBytes;
    this.notify();

    clusterBus.publish(
      'synthetic-assembler',
      'synthesis-core',
      'assembly.synthesized',
      `${targetName}: ${list.length} modules -> ${outputBytes}B (${fnvHex})`,
      128
    );

    return build;
  }

  public getLastAssembly(): SyntheticAssemblyBuild | null {
    return this.lastBuild;
  }

  public validateAll(emitBus = true): LibraryValidationReport {
    const issues: LibraryValidationIssue[] = [];
    let passedCount = 0;
    let warningCount = 0;
    let faultCount = 0;
    let growthCount = 0;
    let modifiedCount = 0;

    for (const entry of this.entries) {
      if (entry.origin === 'synthetic') growthCount++;
      if (entry.origin === 'modified') modifiedCount++;

      if (entry.sourceCode.trim().length === 0) {
        faultCount++;
        issues.push({
          moduleId: entry.id,
          moduleName: entry.name,
          severity: 'fault',
          message: 'Empty source buffer detected',
        });
        continue;
      }

      if (entry.kind === 'json') {
        try {
          JSON.parse(entry.sourceCode);
          passedCount++;
        } catch {
          warningCount++;
          issues.push({
            moduleId: entry.id,
            moduleName: entry.name,
            severity: 'warn',
            message: 'JSON syntax requires repair before strict bundling',
          });
        }
      } else if (entry.kind === 'html') {
        const lower = entry.sourceCode.toLowerCase();
        if (!lower.includes('<script') && !lower.includes('<canvas') && !lower.includes('<body')) {
          warningCount++;
          issues.push({
            moduleId: entry.id,
            moduleName: entry.name,
            severity: 'warn',
            message: 'Missing standard script or body mount tag',
          });
        } else {
          passedCount++;
        }
      } else {
        passedCount++;
      }
    }

    const total = this.entries.length;
    const rawHealth =
      total === 0 ? 100 : Math.max(40, Math.round(((passedCount + warningCount * 0.65) / total) * 100));

    const report: LibraryValidationReport = {
      healthPct: faultCount === 0 && warningCount === 0 ? 100 : rawHealth,
      checkedCount: total,
      passedCount,
      warningCount,
      faultCount,
      growthCount,
      modifiedCount,
      issues,
      validatedAt: Date.now(),
    };

    this.lastValidation = report;
    this.health.healthPct = Math.min(this.health.healthPct, report.healthPct === 100 ? 100 : report.healthPct);
    this.updateHealthCounters();

    if (emitBus) {
      clusterBus.publish(
        'library-validator',
        'synthesis-core',
        'library.validated',
        `${passedCount}/${total} passed · ${growthCount} synthetic grown`,
        84
      );
      this.notify();
    }

    return report;
  }

  public getValidationReport(): LibraryValidationReport {
    return this.lastValidation;
  }

  public injectFusionFault(): void {
    this.health.healthPct = Math.max(48, this.health.healthPct - 26);
    this.health.lastAction = 'Simulated fusion bus desync — 50 daemons actively healing';
    clusterBus.publish(
      'synthesis-core',
      'asm-val-fusion-lock',
      'fusion.fault_injected',
      `Core health dropped to ${this.health.healthPct}%`,
      96
    );
    this.notify();
  }

  public sustainStep(activeAssemblyDaemons: number): void {
    this.health.activeAssemblyDaemons = activeAssemblyDaemons;
    if (!this.health.autoSustainEnabled) return;

    if (this.health.healthPct < 100 && activeAssemblyDaemons > 0) {
      const recovery = Math.max(3, Math.round(activeAssemblyDaemons * 0.25));
      this.health.healthPct = Math.min(100, this.health.healthPct + recovery);
      if (this.health.healthPct === 100) {
        this.health.lastAction = `All 50 daemons stabilized ${this.entries.length}-module Synthesis Core at 100%`;
      }
      this.notify();
    }
  }

  public boostFusionSustain(): void {
    this.validateAll(false);
    this.health.healthPct = 100;
    this.health.lastAction = `50 daemons locked ${this.entries.length}-module Fusion Core at 100% coherence`;
    clusterBus.publish(
      'synthesis-core',
      '*',
      'fusion.sustained',
      `50 daemons locked ${this.entries.length} modules`,
      120
    );
    this.notify();
  }

  private updateHealthCounters(): void {
    const baseCount = this.entries.filter((e) => e.origin !== 'synthetic').length;
    const synthCount = this.entries.filter((e) => e.origin === 'synthetic').length;
    const modCount = this.entries.filter((e) => e.origin === 'modified').length;

    this.health.totalLibraryCount = this.entries.length;
    this.health.baseRepoCount = baseCount;
    this.health.syntheticGrowthCount = synthCount;
    this.health.modifiedCount = modCount;

    binaryStateEngine.registerBank[44] = this.entries.length;
    binaryStateEngine.registerBank[45] = synthCount;
    binaryStateEngine.registerBank[46] = this.health.healthPct;
    binaryStateEngine.registerBank[48] = this.health.totalWrites;
    binaryStateEngine.registerBank[49] = this.health.totalAssemblies;
    binaryStateEngine.registerBank[50] = this.health.activeAssemblyDaemons;
  }
}

export const clusterLibraryEngine = new ClusterLibraryEngine();
