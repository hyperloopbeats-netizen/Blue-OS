import { useEffect, useRef, useState } from 'react';
import { liquidKernel } from '../kernel/LiquidKernel';
import type { ShaderPreset } from '../kernel/types';

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform vec2 u_res;
uniform float u_energy;
uniform float u_bus;
uniform int u_preset;
uniform vec2 u_pointer;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  vec2 ptr = (u_pointer - 0.5) * 1.4;
  float distPtr = length(uv - ptr);
  float t = u_time * 0.35;

  vec3 col = vec3(0.012, 0.018, 0.032);

  if (u_preset == 0) {
    // Obsidian Wave
    float n1 = noise(uv * 2.6 + vec2(t * 0.6, -t * 0.4));
    float n2 = noise(uv * 5.2 - vec2(t * 0.3, t * 0.7) + n1 * 1.4);
    float ripple = sin(distPtr * 10.0 - t * 3.0) * exp(-distPtr * 2.2) * (0.25 + u_energy * 0.8);
    float crest = smoothstep(0.46, 0.88, n2 + ripple * 0.45);
    col += vec3(0.03, 0.11, 0.19) * crest * (0.65 + u_energy * 0.9);
    col += vec3(0.07, 0.24, 0.38) * pow(crest, 3.0) * (0.5 + u_bus * 0.05);
  } else if (u_preset == 1) {
    // Solar Fractal (inspired by The Sun / Sun2)
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    float corona = sin(a * 6.0 + t * 1.5) * 0.08 + cos(r * 14.0 - t * 2.5) * 0.04;
    float glow = exp(-abs(r - (0.34 + u_energy * 0.12 + corona)) * 9.0);
    float core = exp(-r * 3.8) * (0.35 + u_energy * 0.5);
    col += vec3(0.22, 0.10, 0.02) * core + vec3(0.36, 0.18, 0.04) * glow;
  } else if (u_preset == 2) {
    // Quantum Lattice (inspired by Quantum City / 1000agi)
    vec2 grid = abs(fract(uv * 6.0 + vec2(t * 0.2, -t * 0.15)) - 0.5);
    float line = smoothstep(0.46, 0.495, max(grid.x, grid.y));
    float pulse = 0.4 + 0.6 * sin(length(uv) * 8.0 - t * 2.4 + u_energy * 4.0);
    col += vec3(0.04, 0.16, 0.24) * line * pulse * 0.7;
    col += vec3(0.02, 0.08, 0.15) * exp(-distPtr * 2.5);
  } else {
    // CAD Wireframe (inspired by AutoCAD SDF Kernel)
    vec2 g1 = abs(fract(uv * 12.0) - 0.5);
    vec2 g2 = abs(fract(uv * 3.0) - 0.5);
    float fine = smoothstep(0.47, 0.495, max(g1.x, g1.y)) * 0.22;
    float major = smoothstep(0.48, 0.497, max(g2.x, g2.y)) * 0.55;
    float ring = exp(-abs(length(uv - ptr * 0.3) - (0.3 + u_energy * 0.15)) * 22.0);
    col += vec3(0.05, 0.18, 0.28) * (fine + major) + vec3(0.12, 0.36, 0.52) * ring * 0.5;
  }

  float vignette = 1.0 - smoothstep(0.45, 1.35, length(uv));
  col *= (0.55 + 0.45 * vignette);
  outColor = vec4(col, 1.0);
}`;

const PRESET_INDEX: Record<ShaderPreset, number> = {
  'obsidian-wave': 0,
  'solar-fractal': 1,
  'quantum-lattice': 2,
  'cad-wireframe': 3,
};

export function BlackGlassSurface() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFallbackActive(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) {
      setFallbackActive(true);
      return;
    }

    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) {
      setFallbackActive(true);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) {
      setFallbackActive(true);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallbackActive(true);
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uEnergy = gl.getUniformLocation(prog, 'u_energy');
    const uBus = gl.getUniformLocation(prog, 'u_bus');
    const uPreset = gl.getUniformLocation(prog, 'u_preset');
    const uPointer = gl.getUniformLocation(prog, 'u_pointer');

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setFallbackActive(true);
    };
    const handleContextRestored = () => {
      setFallbackActive(false);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX / Math.max(1, window.innerWidth);
      pointerRef.current.y = 1 - e.clientY / Math.max(1, window.innerHeight);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const startTime = performance.now();
    const unsub = liquidKernel.subscribeFrame((_tick, audioEnergy, busRate, preset, dpr) => {
      if (gl.isContextLost()) return;
      const targetW = Math.max(1, Math.floor(window.innerWidth * dpr));
      const targetH = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uEnergy, audioEnergy);
      gl.uniform1f(uBus, busRate);
      gl.uniform1i(uPreset, PRESET_INDEX[preset] ?? 0);
      gl.uniform2f(uPointer, pointerRef.current.x, pointerRef.current.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });

    return () => {
      unsub();
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  if (fallbackActive) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(14,32,56,0.45)_0%,_#030508_65%)]"
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" />;
}
