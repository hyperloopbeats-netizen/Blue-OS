import { binaryStateEngine } from './BinaryStateEngine';
import { clusterBus } from './ClusterBus';
import type {
  DecodedFrame,
  DetectedDataFormat,
  SwarmProcessorHealth,
  SwarmVote,
} from './types';

function fnv1aBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return '0x' + (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) freq[bytes[i]]++;
  let ent = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] === 0) continue;
    const p = freq[i] / bytes.length;
    ent -= p * Math.log2(p);
  }
  return +ent.toFixed(2);
}

function buildHexRows(bytes: Uint8Array, maxBytes = 128) {
  const limit = Math.min(bytes.length, maxBytes);
  const rows: { offset: string; bytes: string[]; ascii: string }[] = [];
  for (let i = 0; i < limit; i += 16) {
    const rowBytes: string[] = [];
    let ascii = '';
    for (let j = 0; j < 16; j++) {
      if (i + j < limit) {
        const b = bytes[i + j];
        rowBytes.push(b.toString(16).padStart(2, '0').toUpperCase());
        ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      } else {
        rowBytes.push('  ');
        ascii += ' ';
      }
    }
    rows.push({
      offset: '0x' + i.toString(16).padStart(4, '0').toUpperCase(),
      bytes: rowBytes,
      ascii,
    });
  }
  return rows;
}

function repairBrokenJson(raw: string): { text: string; repairs: string[] } {
  const repairs: string[] = [];
  let s = raw.trim();
  // Remove trailing commas before } or ]
  const noTrailing = s.replace(/,\s*([}\]])/g, '$1');
  if (noTrailing !== s) {
    repairs.push('Stripped trailing JSON commas');
    s = noTrailing;
  }

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  if (inString) {
    s += '"';
    repairs.push('Closed unterminated JSON string');
  }
  if (openBrackets > 0) {
    s += ']'.repeat(openBrackets);
    repairs.push(`Closed ${openBrackets} unclosed bracket(s)`);
  }
  if (openBraces > 0) {
    s += '}'.repeat(openBraces);
    repairs.push(`Closed ${openBraces} unclosed brace(s)`);
  }

  return { text: s, repairs };
}

type FrameListener = () => void;

export class SwarmDecoderEngine {
  private frames: DecodedFrame[] = [];
  private listeners = new Set<FrameListener>();
  private seq = 1;

  public health: SwarmProcessorHealth = {
    healthPct: 100,
    loadPct: 14,
    queueDepth: 0,
    totalDecoded: 0,
    totalHealed: 0,
    injectedFaults: 0,
    quantumBudgetMs: 2.4,
    autoHealEnabled: true,
    autoStreamEnabled: true,
    activeSelfHealDaemons: 20,
    lastRepairAction: 'All 20 self-healing daemons nominal',
  };

  constructor() {
    // Seed with one initial decoded MGE1 frame so all 5 swarm apps are immediately populated
    this.decodeInput('{"kernel":"liquid-120hz","cluster":"main-brain","swarm":"ready","fold":"MGE1"}', 'kernel-boot-seed');
  }

  public subscribe(fn: FrameListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  public getFrames(): DecodedFrame[] {
    return this.frames;
  }

  public getLatestFrame(): DecodedFrame | null {
    return this.frames[0] ?? null;
  }

  public decodeBinaryBytes(bytes: Uint8Array, sourceLabel = 'binary-upload'): DecodedFrame {
    const dec = new TextDecoder('utf-8', { fatal: false });
    const rawPreview = dec.decode(bytes.subarray(0, 512));
    return this.processBytesAndText(bytes, rawPreview, sourceLabel, true);
  }

  public decodeInput(input: string, sourceLabel = 'manual-input'): DecodedFrame {
    const enc = new TextEncoder();
    const rawBytes = enc.encode(input);
    return this.processBytesAndText(rawBytes, input, sourceLabel, false);
  }

  private processBytesAndText(
    rawBytes: Uint8Array,
    inputStr: string,
    sourceLabel: string,
    preferRawBinary: boolean
  ): DecodedFrame {
    const trimmed = inputStr.trim();
    const repairs: string[] = [];
    let format: DetectedDataFormat = 'utf8-text';
    let decodedBytes = rawBytes;
    let decodedText = inputStr;
    let repairedText: string | null = null;
    let structuredJson: string | null = null;
    let csvPreview: string[][] | null = null;

    if (preferRawBinary) {
      const printableCount = Array.from(rawBytes).filter((b) => (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13).length;
      const ratio = rawBytes.length > 0 ? printableCount / rawBytes.length : 1;
      if (ratio < 0.7) {
        format = 'raw-bytes';
      }
    }

    if (format !== 'raw-bytes') {
      // 1. Binary bitstream detection (e.g. 01001000 01101001)
      const bitCompact = trimmed.replace(/\s+/g, '');
      if (/^[01]{8,}$/.test(bitCompact)) {
        format = 'binary-bits';
        let cleanBits = bitCompact;
        if (cleanBits.length % 8 !== 0) {
          const pad = 8 - (cleanBits.length % 8);
          cleanBits += '0'.repeat(pad);
          repairs.push(`Padded ${pad} missing trailing bit(s)`);
        }
        const byteArr = new Uint8Array(cleanBits.length / 8);
        for (let i = 0; i < byteArr.length; i++) {
          byteArr[i] = parseInt(cleanBits.slice(i * 8, i * 8 + 8), 2);
        }
        decodedBytes = byteArr;
        decodedText = new TextDecoder('utf-8', { fatal: false }).decode(byteArr);
      }
      // 2. Hex detection
      else if (/^(?:0x)?[0-9a-fA-F\s:-]{6,}$/.test(trimmed) && /[0-9a-fA-F]{2}/.test(trimmed)) {
        format = 'hex';
        let cleanHex = trimmed.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
        if (cleanHex.length % 2 !== 0) {
          cleanHex += '0';
          repairs.push('Padded odd hex nibble with 0');
        }
        const byteArr = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < byteArr.length; i++) {
          byteArr[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
        }
        decodedBytes = byteArr;
        decodedText = new TextDecoder('utf-8', { fatal: false }).decode(byteArr);
      }
      // 3. JSON detection (including broken JSON recovery)
      else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        format = 'json';
        try {
          const parsed = JSON.parse(trimmed);
          structuredJson = JSON.stringify(parsed, null, 2);
          decodedText = structuredJson;
        } catch {
          const repaired = repairBrokenJson(trimmed);
          try {
            const parsed = JSON.parse(repaired.text);
            structuredJson = JSON.stringify(parsed, null, 2);
            repairedText = structuredJson;
            decodedText = structuredJson;
            repairs.push(...(repaired.repairs.length ? repaired.repairs : ['Normalized malformed JSON structure']));
          } catch {
            repairs.push('Quarantined unrecoverable JSON syntax fragment');
          }
        }
      }
      // 4. Base64 detection
      else if (/^[A-Za-z0-9+/=\s]{8,}$/.test(trimmed) && !trimmed.includes(' ')) {
        format = 'base64';
        let b64 = trimmed.replace(/\s+/g, '');
        const mod = b64.length % 4;
        if (mod !== 0) {
          b64 += '='.repeat(4 - mod);
          repairs.push(`Appended ${4 - mod} Base64 '=' padding char(s)`);
        }
        try {
          const binStr = atob(b64);
          const arr = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
          decodedBytes = arr;
          decodedText = new TextDecoder('utf-8', { fatal: false }).decode(arr);
        } catch {
          repairs.push('Recovered invalid Base64 character stream');
        }
      }
      // 5. HTML/Code detection
      else if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('function ')) {
        format = 'html-code';
      }
      // 6. CSV detection
      else if (trimmed.includes('\n') && trimmed.split('\n')[0].includes(',')) {
        format = 'csv';
        csvPreview = trimmed
          .split('\n')
          .slice(0, 12)
          .map((row) => row.split(',').map((cell) => cell.trim()));
      }
    }

    // Sanitize control chars from decoded text preview if needed
    const sanitized = decodedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    if (sanitized !== decodedText && format !== 'raw-bytes') {
      decodedText = sanitized;
      repairs.push('Sanitized non-printable control bytes');
    }

    const entropy = shannonEntropy(decodedBytes);
    const printable = Array.from(decodedBytes).filter((b) => b >= 32 && b <= 126).length;
    const asciiRatio = decodedBytes.length > 0 ? Math.round((printable / decodedBytes.length) * 100) : 100;
    const fnvHex = fnv1aBytes(decodedBytes);

    const votes: SwarmVote[] = [
      {
        agent: 'Alpha-Parser',
        verdict: repairs.length > 0 ? 'healed' : 'valid',
        confidencePct: repairs.length > 0 ? 94 : 99,
        note: `Format ${format.toUpperCase()} (${decodedBytes.length}B)`,
      },
      {
        agent: 'Beta-Entropy',
        verdict: entropy > 7.4 ? 'anomalous' : 'valid',
        confidencePct: entropy > 7.4 ? 82 : 97,
        note: `Shannon ${entropy} bits/B`,
      },
      {
        agent: 'Gamma-Healer',
        verdict: repairs.length > 0 ? 'healed' : 'valid',
        confidencePct: 98,
        note: repairs.length > 0 ? repairs[0] : 'Zero byte faults',
      },
      {
        agent: 'Delta-Fold',
        verdict: 'valid',
        confidencePct: 96,
        note: `Digest ${fnvHex}`,
      },
      {
        agent: 'Epsilon-Router',
        verdict: 'valid',
        confidencePct: 99,
        note: `Routed to Main Brain`,
      },
    ];

    const frame: DecodedFrame = {
      id: this.seq++,
      timestamp: Date.now(),
      sourceLabel,
      rawInputPreview: inputStr.slice(0, 220),
      detectedFormat: format,
      rawByteLength: rawBytes.length,
      decodedByteLength: decodedBytes.length,
      fnvHex,
      entropyBits: entropy,
      asciiRatioPct: asciiRatio,
      decodedText: decodedText.slice(0, 4000),
      repairedText,
      repairsApplied: repairs,
      structuredJson,
      csvPreview,
      hexPreviewRows: buildHexRows(decodedBytes, 128),
      votes,
    };

    this.frames.unshift(frame);
    if (this.frames.length > 48) {
      this.frames.length = 48;
    }

    this.health.totalDecoded++;
    if (repairs.length > 0) {
      this.health.totalHealed++;
      this.health.lastRepairAction = `${sourceLabel}: ${repairs[0]}`;
    }
    this.health.queueDepth = Math.min(48, this.frames.length);
    this.health.loadPct = Math.min(92, Math.max(12, Math.round(14 + decodedBytes.length / 4096)));

    // Mirror swarm processor health into BinaryStateEngine registers 40..43
    binaryStateEngine.registerBank[40] = this.health.healthPct;
    binaryStateEngine.registerBank[41] = this.health.totalDecoded;
    binaryStateEngine.registerBank[42] = this.health.totalHealed;
    binaryStateEngine.registerBank[43] = entropy;

    clusterBus.publish(
      'swarm-decoder',
      'main-brain',
      repairs.length > 0 ? 'swarm.healed_decode' : 'swarm.decoded',
      `${format} (${decodedBytes.length}B) · ${fnvHex}`,
      Math.min(512, Math.max(64, decodedBytes.length))
    );

    this.notify();
    return frame;
  }

  public injectFault(): void {
    this.health.injectedFaults++;
    this.health.healthPct = Math.max(42, this.health.healthPct - 24);
    this.health.loadPct = Math.min(98, this.health.loadPct + 35);
    this.health.lastRepairAction = 'Fault injected — 20 self-healing daemons responding';
    // Also decode a deliberately malformed JSON+Base64 payload to demonstrate real repair
    this.decodeInput('{"swarm_fault":"corrupt_stream","nodes":[1,2,3,', 'fault-injector');
    clusterBus.publish('swarm-sustainer', 'sh-fault-trap', 'swarm.fault_injected', `Health dropped to ${this.health.healthPct}%`, 96);
    this.notify();
  }

  public sustainStep(activeSelfHealDaemons: number): void {
    this.health.activeSelfHealDaemons = activeSelfHealDaemons;
    if (!this.health.autoHealEnabled) return;

    if (this.health.healthPct < 100 && activeSelfHealDaemons > 0) {
      const recovery = Math.max(2, Math.round(activeSelfHealDaemons * 0.45));
      this.health.healthPct = Math.min(100, this.health.healthPct + recovery);
      this.health.loadPct = Math.max(12, this.health.loadPct - 4);
      if (this.health.healthPct === 100) {
        this.health.lastRepairAction = 'Processor stabilized at 100% by 20 self-healing daemons';
      }
      this.notify();
    } else if (this.health.loadPct > 18) {
      this.health.loadPct = Math.max(14, this.health.loadPct - 2);
      this.notify();
    }
  }

  public boostSustain(): void {
    this.health.healthPct = 100;
    this.health.loadPct = 14;
    this.health.lastRepairAction = 'Sustainer overdrive stabilized all 20 self-healing daemons';
    clusterBus.publish('swarm-sustainer', '*', 'swarm.sustained', 'Processor locked at 100% health', 112);
    this.notify();
  }
}

export const swarmDecoderEngine = new SwarmDecoderEngine();
