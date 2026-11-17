import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

const IGNORED_FILES = new Set([
  'README.md',
  'package.json',
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml',
  'server.js',
  'metadata.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
  '.env',
  '.env.example',
  '.gitignore',
]);

const CAP_FLAGS = {
  WEBGL: 1 << 0,
  THREEJS: 1 << 1,
  AUDIO_DSP: 1 << 2,
  PHYSICS: 1 << 3,
  AI_SWARM: 1 << 4,
  CAD_SHADER: 1 << 5,
  NODE_GRAPH: 1 << 6,
  PERSISTENCE: 1 << 7,
};

const SEGMENT_MAP = {
  Doom: 1,
  AutoCAD: 1,
  B12: 1,
  Clothes: 1,
  Face2: 1,
  Tauri: 1,
  Dragonfly: 2,
  'Quantum City': 2,
  'Quantum AI generaror': 2,
  'The Sun': 2,
  Sun2: 2,
  'PS6 Sun': 2,
  Soccer: 2,
  '1000agi': 3,
  'Agi swarm': 3,
  'AIM OS Brain': 3,
  'AIM OS V8.4': 3,
  'AIM OSx Sentient Game Generaror': 3,
  MG7: 3,
  'OS Purple': 3,
  Procedura: 3,
  TF: 3,
  Trilateral: 3,
  'AIM Cometic OS V30': 3,
};

function fnv1a32(buffer) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < buffer.length; i++) {
    hash ^= buffer[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function detectCapabilities(text, name) {
  let mask = 0;
  const lower = text.toLowerCase();
  if (lower.includes('webgl') || lower.includes('gl_fragcolor') || lower.includes('getcontext(\'webgl')) {
    mask |= CAP_FLAGS.WEBGL;
  }
  if (lower.includes('three.') || lower.includes('three.min.js') || lower.includes("from 'three'")) {
    mask |= CAP_FLAGS.THREEJS;
  }
  if (lower.includes('audiocontext') || lower.includes('biquadfilter') || lower.includes('createoscillator')) {
    mask |= CAP_FLAGS.AUDIO_DSP;
  }
  if (lower.includes('velocity') || lower.includes('gravity') || lower.includes('raycaster') || lower.includes('ballistic')) {
    mask |= CAP_FLAGS.PHYSICS;
  }
  if (lower.includes('swarm') || lower.includes('sentient') || lower.includes('agi') || lower.includes('neural')) {
    mask |= CAP_FLAGS.AI_SWARM;
  }
  if (lower.includes('shader') || lower.includes('glsl') || lower.includes('sdf') || name === 'AutoCAD') {
    mask |= CAP_FLAGS.CAD_SHADER;
  }
  if (lower.includes('bezier') || lower.includes('connections') || name === 'TF') {
    mask |= CAP_FLAGS.NODE_GRAPH;
  }
  if (lower.includes('localstorage') || lower.includes('opfs') || lower.includes('indexeddb') || lower.includes('sqlite')) {
    mask |= CAP_FLAGS.PERSISTENCE;
  }
  return mask;
}

function capabilityNames(mask) {
  const out = [];
  if (mask & CAP_FLAGS.WEBGL) out.push('WebGL2');
  if (mask & CAP_FLAGS.THREEJS) out.push('Three.js');
  if (mask & CAP_FLAGS.AUDIO_DSP) out.push('AudioDSP');
  if (mask & CAP_FLAGS.PHYSICS) out.push('Physics');
  if (mask & CAP_FLAGS.AI_SWARM) out.push('SwarmAI');
  if (mask & CAP_FLAGS.CAD_SHADER) out.push('ShaderCAD');
  if (mask & CAP_FLAGS.NODE_GRAPH) out.push('NodeGraph');
  if (mask & CAP_FLAGS.PERSISTENCE) out.push('Storage');
  return out;
}

async function analyzeRepository() {
  const entries = await fs.readdir(__dirname, { withFileTypes: true });
  const modules = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.') || IGNORED_FILES.has(entry.name)) continue;

    const fullPath = path.join(__dirname, entry.name);
    const rawBuf = await fs.readFile(fullPath);
    const text = rawBuf.toString('utf8');
    const trimmed = text.trimStart();

    let kind = 'typescript';
    let title = entry.name;
    let kindCode = 2;

    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      kind = 'html';
      kindCode = 0;
      const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
    } else if (trimmed.startsWith('{')) {
      kind = 'json';
      kindCode = 1;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.meta?.projectName) {
          title = parsed.meta.projectName;
        }
      } catch {
        // Fallback to filename
      }
    } else if (entry.name === 'Tauri') {
      kind = 'typescript';
      kindCode = 2;
      title = 'B12 Titanfall / Tauri Spatial Orchestrator';
    }

    const symbolMatches = [...text.matchAll(/(?:class|function)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const uniqueSymbols = [...new Set(symbolMatches)].slice(0, 32);
    const capMask = detectCapabilities(text, entry.name);
    const segment = SEGMENT_MAP[entry.name] || 3;
    const hash = fnv1a32(rawBuf);

    modules.push({
      id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: entry.name,
      title,
      kind,
      kindCode,
      segment,
      sizeBytes: rawBuf.length,
      fnvHash: hash,
      fnvHex: '0x' + hash.toString(16).padStart(8, '0').toUpperCase(),
      capMask,
      capabilities: capabilityNames(capMask),
      symbols: uniqueSymbols,
      symbolCount: symbolMatches.length,
      fullPath,
    });
  }

  modules.sort((a, b) => a.segment - b.segment || a.name.localeCompare(b.name));
  return modules;
}

function buildBinaryStateImage(modules, rawBuffers) {
  const HEADER_SIZE = 32;
  const RECORD_SIZE = 64;
  const tableSize = modules.length * RECORD_SIZE;
  const totalPayloadBytes = rawBuffers.reduce((acc, b) => acc + b.length, 0);
  const totalSize = HEADER_SIZE + tableSize + totalPayloadBytes;

  const out = Buffer.alloc(totalSize);

  let combinedCap = 0;
  let globalHash = 0x811c9dc5;
  for (const mod of modules) {
    combinedCap |= mod.capMask;
    globalHash ^= mod.fnvHash;
    globalHash = Math.imul(globalHash, 0x01000193) >>> 0;
  }

  const nowMs = BigInt(Date.now());
  out.write('MGE1', 0, 4, 'ascii');
  out.writeUInt32LE(1, 4);
  out.writeUInt32LE(modules.length, 8);
  out.writeUInt32LE(totalPayloadBytes, 12);
  out.writeUInt32LE(globalHash >>> 0, 16);
  out.writeUInt32LE(combinedCap >>> 0, 20);
  out.writeUInt32LE(Number(nowMs & 0xffffffffn), 24);
  out.writeUInt32LE(Number((nowMs >> 32n) & 0xffffffffn), 28);

  let payloadCursor = HEADER_SIZE + tableSize;

  modules.forEach((mod, idx) => {
    const recOffset = HEADER_SIZE + idx * RECORD_SIZE;
    const payloadBuf = rawBuffers[idx];

    out.writeUInt32LE(mod.fnvHash >>> 0, recOffset + 0);
    out.writeUInt32LE(payloadCursor >>> 0, recOffset + 4);
    out.writeUInt32LE(payloadBuf.length >>> 0, recOffset + 8);
    out.writeUInt32LE(mod.capMask >>> 0, recOffset + 12);
    out.writeUInt32LE(mod.segment >>> 0, recOffset + 16);
    out.writeUInt32LE(mod.symbolCount >>> 0, recOffset + 20);
    out.writeUInt32LE(mod.kindCode >>> 0, recOffset + 24);
    out.writeUInt32LE(1, recOffset + 28); // invested=1

    const nameBytes = Buffer.from(mod.name, 'utf8');
    nameBytes.copy(out, recOffset + 32, 0, Math.min(31, nameBytes.length));

    payloadBuf.copy(out, payloadCursor);
    payloadCursor += payloadBuf.length;
  });

  return { buffer: out, globalHash: globalHash >>> 0, combinedCap: combinedCap >>> 0, totalPayloadBytes };
}

function createBridgeScript(moduleName, moduleId) {
  return `
<script>
(function() {
  if (window.__LIQUID_BRIDGE__) return;
  const nodeId = ${JSON.stringify(moduleId)};
  const nodeName = ${JSON.stringify(moduleName)};
  let frames = 0;
  let lastReport = performance.now();
  let lastFrame = lastReport;
  let measuredFps = 60;
  let interactionCount = 0;

  function emit(type, payload) {
    try {
      window.parent.postMessage({
        source: 'liquid-os-bridge',
        nodeId,
        nodeName,
        type,
        payload,
        timestamp: performance.now()
      }, '*');
    } catch (_) {}
  }

  function tick(now) {
    frames++;
    const elapsed = now - lastReport;
    if (elapsed >= 250) {
      measuredFps = Math.round((frames * 1000) / elapsed);
      emit('HEARTBEAT', {
        fps: measuredFps,
        dtMs: +(now - lastFrame).toFixed(2),
        interactions: interactionCount,
        memoryMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null
      });
      frames = 0;
      lastReport = now;
    }
    lastFrame = now;
    requestAnimationFrame(tick);
  }

  window.addEventListener('pointerdown', () => {
    interactionCount++;
    emit('CLUSTER_EVENT', { kind: 'input', detail: 'pointer_interaction' });
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    interactionCount++;
    emit('CLUSTER_EVENT', { kind: 'key', detail: e.key });
  }, { passive: true });

  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.target !== 'liquid-os-bridge') return;
    if (ev.data.type === 'CLUSTER_PING') {
      emit('PONG', { fps: measuredFps, status: 'active' });
    }
  });

  window.__LIQUID_BRIDGE__ = { nodeId, nodeName, emit };
  emit('BRIDGE_READY', { title: document.title || nodeName });
  requestAnimationFrame(tick);
})();
</script>`;
}

async function startServer() {
  const modules = await analyzeRepository();
  const rawBuffers = await Promise.all(modules.map((m) => fs.readFile(m.fullPath)));
  const binaryImage = buildBinaryStateImage(modules, rawBuffers);
  const moduleMap = new Map(modules.map((m) => [m.name, m]));

  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      modulesCount: modules.length,
      binaryStateBytes: binaryImage.buffer.length,
      globalHash: '0x' + binaryImage.globalHash.toString(16).padStart(8, '0').toUpperCase(),
    });
  });

  app.get('/api/repo/manifest', (_req, res) => {
    res.json({
      repository: 'hyperloopbeats-netizen/matrix-game-engine',
      binaryMagic: 'MGE1',
      binaryVersion: 1,
      binaryTotalBytes: binaryImage.buffer.length,
      totalSourceBytes: binaryImage.totalPayloadBytes,
      globalHash: '0x' + binaryImage.globalHash.toString(16).padStart(8, '0').toUpperCase(),
      combinedCapabilities: capabilityNames(binaryImage.combinedCap),
      modules: modules.map(({ fullPath: _fp, ...rest }) => rest),
    });
  });

  app.get('/api/repo/binary-state', (_req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="matrix-game-engine-state.bin"');
    res.setHeader('X-MGE-Modules', String(modules.length));
    res.setHeader('X-MGE-Hash', '0x' + binaryImage.globalHash.toString(16).padStart(8, '0').toUpperCase());
    res.send(binaryImage.buffer);
  });

  app.get('/api/repo/module/:name', async (req, res, next) => {
    const mod = moduleMap.get(req.params.name);
    if (!mod) return res.status(404).json({ error: 'Module not found' });
    try {
      const source = await fs.readFile(mod.fullPath, 'utf8');
      const { fullPath: _fp, ...meta } = mod;
      res.json({ ...meta, source });
    } catch (err) {
      next(err);
    }
  });

  const serveModule = async (req, res, next) => {
    const requested = req.params.name;
    const mod = moduleMap.get(requested);
    if (!mod) return next();

    try {
      let content = await fs.readFile(mod.fullPath, 'utf8');
      if (mod.kind === 'html') {
        if (req.query.bridge === '1') {
          const bridge = createBridgeScript(mod.name, mod.id);
          if (content.includes('</body>')) {
            content = content.replace('</body>', `${bridge}\n</body>`);
          } else {
            content += bridge;
          }
        }
        res.type('text/html; charset=utf-8').send(content);
      } else if (mod.kind === 'json') {
        res.type('application/json; charset=utf-8').send(content);
      } else {
        res.type('text/plain; charset=utf-8').send(content);
      }
    } catch (err) {
      next(err);
    }
  };

  app.get('/app/:name', serveModule);

  if (IS_PROD) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/:name', serveModule);
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.get('/:name', serveModule);
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(
      `Liquid OS Server running on http://${HOST}:${PORT} (${modules.length} modules, ${binaryImage.buffer.length}B binary state)`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start Liquid OS server:', err);
  process.exit(1);
});
