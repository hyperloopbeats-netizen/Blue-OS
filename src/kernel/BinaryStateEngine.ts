import type { BinaryRecordView, BinaryStateHeader, RepoManifest } from './types';

const STORAGE_KEY = 'liquid_os_binary_checkpoint_v1';

export interface PersistedUpgradeState {
  upgradedModuleIds: string[];
  activeSegments: number[];
  investedHash: string;
  savedAt: number;
}

export class BinaryStateEngine {
  public rawBuffer: ArrayBuffer | null = null;
  public dataView: DataView | null = null;
  public header: BinaryStateHeader | null = null;
  public records: BinaryRecordView[] = [];
  public manifest: RepoManifest | null = null;

  // Shared 120Hz Kernel Binary Register Bank (256 Float64 slots):
  // Slots 0..15: Kernel telemetry (tickHz, renderFps, jitterUs, audioEnergy, shaderPresetId, dprScale, etc.)
  // Slots 16..31: Core daemon tick counters; 64..199: Hyper, Swarm & 50 Assembly/Fusion daemon counters
  // Slots 32..39: Folded binary words; 40..43: Swarm health; 44..51: Cluster Library & Fusion Core metrics
  public readonly registerBank = new Float64Array(256);
  public readonly moduleStateFlags = new Uint32Array(256);

  public investedAt: number | null = null;
  public error: string | null = null;

  public async ingestFromRepository(): Promise<{
    manifest: RepoManifest;
    header: BinaryStateHeader;
    records: BinaryRecordView[];
  }> {
    this.error = null;
    const [manifestRes, binRes] = await Promise.all([
      fetch('/api/repo/manifest'),
      fetch('/api/repo/binary-state'),
    ]);

    if (!manifestRes.ok || !binRes.ok) {
      throw new Error('Failed to ingest matrix-game-engine binary state');
    }

    const manifest = (await manifestRes.json()) as RepoManifest;
    const buffer = await binRes.arrayBuffer();

    this.manifest = manifest;
    this.rawBuffer = buffer;
    this.dataView = new DataView(buffer);

    this.parseBinaryImage(this.dataView);
    this.investedAt = Date.now();

    const saved = this.loadPersistedState();
    if (saved) {
      manifest.modules.forEach((mod, idx) => {
        if (saved.upgradedModuleIds.includes(mod.id) && idx < this.moduleStateFlags.length) {
          this.moduleStateFlags[idx] |= 1; // BIT 0 = upgraded/installed
        }
      });
    }

    if (!this.header) {
      throw new Error('Invalid binary state header');
    }

    return {
      manifest: this.manifest,
      header: this.header,
      records: this.records,
    };
  }

  private parseBinaryImage(dv: DataView): void {
    if (dv.byteLength < 32) {
      throw new Error('Binary state buffer truncated');
    }

    const magic =
      String.fromCharCode(dv.getUint8(0)) +
      String.fromCharCode(dv.getUint8(1)) +
      String.fromCharCode(dv.getUint8(2)) +
      String.fromCharCode(dv.getUint8(3));

    if (magic !== 'MGE1') {
      throw new Error(`Unexpected binary magic: ${magic}`);
    }

    const version = dv.getUint32(4, true);
    const moduleCount = dv.getUint32(8, true);
    const totalPayloadBytes = dv.getUint32(12, true);
    const globalHash = dv.getUint32(16, true);
    const combinedCapMask = dv.getUint32(20, true);
    const tsLo = dv.getUint32(24, true);
    const tsHi = dv.getUint32(28, true);
    const timestampMs = tsHi * 4294967296 + tsLo;

    this.header = {
      magic,
      version,
      moduleCount,
      totalPayloadBytes,
      globalHashHex: '0x' + globalHash.toString(16).padStart(8, '0').toUpperCase(),
      combinedCapMask,
      timestampMs,
    };

    const records: BinaryRecordView[] = [];
    const dec = new TextDecoder();

    for (let i = 0; i < moduleCount; i++) {
      const base = 32 + i * 64;
      if (base + 64 > dv.byteLength) break;

      const fnv = dv.getUint32(base + 0, true);
      const payloadOffset = dv.getUint32(base + 4, true);
      const payloadLength = dv.getUint32(base + 8, true);
      const capMask = dv.getUint32(base + 12, true);
      const segment = dv.getUint32(base + 16, true);
      const symbolCount = dv.getUint32(base + 20, true);
      const kindCode = dv.getUint32(base + 24, true);
      const invested = dv.getUint32(base + 28, true) === 1;

      const nameSlice = new Uint8Array(dv.buffer, base + 32, 32);
      const zeroIdx = nameSlice.indexOf(0);
      const name = dec.decode(zeroIdx >= 0 ? nameSlice.subarray(0, zeroIdx) : nameSlice);

      records.push({
        name,
        fnvHex: '0x' + fnv.toString(16).padStart(8, '0').toUpperCase(),
        payloadOffset,
        payloadLength,
        capMask,
        segment,
        symbolCount,
        kindCode,
        invested,
      });
    }

    this.records = records;
  }

  public setModuleFlag(moduleIndex: number, bitMask: number, enabled: boolean): void {
    if (moduleIndex < 0 || moduleIndex >= this.moduleStateFlags.length) return;
    if (enabled) {
      this.moduleStateFlags[moduleIndex] |= bitMask;
    } else {
      this.moduleStateFlags[moduleIndex] &= ~bitMask;
    }
  }

  public readHexSlice(offset: number, length: number): { offsetHex: string; hexBytes: string[]; ascii: string }[] {
    if (!this.rawBuffer) return [];
    const bytes = new Uint8Array(this.rawBuffer);
    const safeStart = Math.max(0, Math.min(offset, Math.max(0, bytes.length - 16)));
    const safeEnd = Math.min(bytes.length, safeStart + length);
    const rows: { offsetHex: string; hexBytes: string[]; ascii: string }[] = [];

    for (let addr = safeStart; addr < safeEnd; addr += 16) {
      const slice = bytes.subarray(addr, Math.min(addr + 16, safeEnd));
      const hexBytes: string[] = [];
      let ascii = '';
      for (let i = 0; i < 16; i++) {
        if (i < slice.length) {
          const b = slice[i];
          hexBytes.push(b.toString(16).padStart(2, '0').toUpperCase());
          ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
        } else {
          hexBytes.push('  ');
          ascii += ' ';
        }
      }
      rows.push({
        offsetHex: '0x' + addr.toString(16).padStart(6, '0').toUpperCase(),
        hexBytes,
        ascii,
      });
    }

    return rows;
  }

  public savePersistedState(upgradedModuleIds: string[], activeSegments: number[]): PersistedUpgradeState {
    const state: PersistedUpgradeState = {
      upgradedModuleIds,
      activeSegments,
      investedHash: this.header?.globalHashHex ?? '0x00000000',
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota restriction
    }
    return state;
  }

  public loadPersistedState(): PersistedUpgradeState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedUpgradeState;
    } catch {
      return null;
    }
  }

  public exportBinaryBlob(): Blob | null {
    if (!this.rawBuffer) return null;
    return new Blob([this.rawBuffer], { type: 'application/octet-stream' });
  }
}

export const binaryStateEngine = new BinaryStateEngine();
