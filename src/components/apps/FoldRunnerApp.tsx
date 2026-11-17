import { useCallback, useEffect, useRef, useState } from 'react';
import { audioDSP } from '../../kernel/AudioDSP';
import { clusterBus } from '../../kernel/ClusterBus';
import { hyperFlowEngine } from '../../kernel/HyperFlowEngine';
import { liquidKernel } from '../../kernel/LiquidKernel';
import type { BinaryFoldResult } from '../../kernel/types';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface Entity {
  id: number;
  lane: number; // 0..3
  x: number; // normalized 0..1 from left
  bit: 0 | 1;
  kind: 'shard' | 'barrier';
  collected: boolean;
}

interface FoldRunnerAppProps {
  foldResult: BinaryFoldResult;
  flowScore: number;
}

export function FoldRunnerApp({ foldResult, flowScore }: FoldRunnerAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [integrity, setIntegrity] = useState(100);
  const [foldDepth, setFoldDepth] = useState(1);
  const [playerPolarity, setPlayerPolarity] = useState<0 | 1>(0);

  const simRef = useRef({
    state: 'TITLE_MENU' as GameState,
    lane: 1,
    targetLane: 1,
    laneY: 1,
    polarity: 0 as 0 | 1,
    score: 0,
    integrity: 100,
    foldDepth: 1,
    combo: 0,
    spawnTimer: 0,
    bitCursor: 0,
    wordIdx: 0,
    entities: [] as Entity[],
    nextId: 1,
    flashFrames: 0,
  });

  const resetAndStart = useCallback(() => {
    const s = simRef.current;
    s.state = 'PLAYING';
    s.lane = 1;
    s.targetLane = 1;
    s.laneY = 1;
    s.polarity = 0;
    s.score = 0;
    s.integrity = 100;
    s.foldDepth = 1;
    s.combo = 0;
    s.spawnTimer = 0;
    s.bitCursor = 0;
    s.wordIdx = 0;
    s.entities = [];
    s.flashFrames = 0;

    setScore(0);
    setIntegrity(100);
    setFoldDepth(1);
    setPlayerPolarity(0);
    setGameState('PLAYING');

    hyperFlowEngine.recordGameFold(0, 1);
    clusterBus.publish('fold-runner', '*', 'game.boot', `Seed ${foldResult.foldedSeedHex}`, 96);
    void audioDSP.playHarmonicPulse(220, 0.25);
  }, [foldResult.foldedSeedHex]);

  const togglePolarity = useCallback(() => {
    const s = simRef.current;
    if (s.state !== 'PLAYING') return;
    s.polarity = s.polarity === 0 ? 1 : 0;
    setPlayerPolarity(s.polarity);
    void audioDSP.playHarmonicPulse(s.polarity === 0 ? 330 : 440, 0.09);
  }, []);

  const moveLane = useCallback((delta: -1 | 1) => {
    const s = simRef.current;
    if (s.state !== 'PLAYING') return;
    s.targetLane = Math.max(0, Math.min(3, s.targetLane + delta));
  }, []);

  const setExactLane = useCallback((lane: number) => {
    const s = simRef.current;
    if (s.state !== 'PLAYING') return;
    s.targetLane = Math.max(0, Math.min(3, lane));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (simRef.current.state !== 'PLAYING') return;
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        moveLane(-1);
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        moveLane(1);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePolarity();
      } else if (e.key.toLowerCase() === 'p') {
        simRef.current.state = 'PAUSED';
        setGameState('PAUSED');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane, togglePolarity]);

  // Locked directly into the 120Hz Kernel Loop!
  useEffect(() => {
    let lastTick = -1;
    const unsub = liquidKernel.subscribeFrame((tickIndex) => {
      const s = simRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dt = 1 / 120;
      const tickDelta = lastTick < 0 ? 1 : Math.min(4, Math.max(1, tickIndex - lastTick));
      lastTick = tickIndex;

      if (s.state === 'PLAYING') {
        for (let step = 0; step < tickDelta; step++) {
          // Smooth lane interpolation
          s.laneY += (s.targetLane - s.laneY) * 0.22;

          // Spawn deterministic entities from Hyper Binary Folded Words
          s.spawnTimer += dt;
          const spawnInterval = Math.max(0.28, 0.62 - s.foldDepth * 0.03);
          if (s.spawnTimer >= spawnInterval) {
            s.spawnTimer = 0;
            const words = hyperFlowEngine.getFoldResult().foldedWords;
            const word = words[s.wordIdx % words.length] >>> 0;
            const shift = s.bitCursor % 28;
            const nibble = (word >>> shift) & 0xf;
            const lane = nibble % 4;
            const bit = ((word >>> (shift + 2)) & 1) as 0 | 1;
            const kind = ((word >>> (shift + 3)) & 3) === 0 ? 'barrier' : 'shard';

            s.entities.push({
              id: s.nextId++,
              lane,
              x: 1.05,
              bit,
              kind,
              collected: false,
            });

            s.bitCursor += 4;
            if (s.bitCursor >= 28) {
              s.bitCursor = 0;
              s.wordIdx = (s.wordIdx + 1) % words.length;
            }
          }

          const speed = 0.42 + Math.min(0.45, s.foldDepth * 0.035);
          const playerX = 0.14;

          for (let i = s.entities.length - 1; i >= 0; i--) {
            const ent = s.entities[i];
            ent.x -= speed * dt;

            if (!ent.collected && Math.abs(ent.x - playerX) < 0.045 && Math.abs(ent.lane - s.laneY) < 0.48) {
              ent.collected = true;
              if (ent.kind === 'shard' && ent.bit === s.polarity) {
                s.combo++;
                const pts = 10 * s.foldDepth;
                s.score += pts;
                if (s.combo % 5 === 0) {
                  s.foldDepth = Math.min(12, s.foldDepth + 1);
                  const nextFold = hyperFlowEngine.computeBinaryFold(true);
                  clusterBus.publish(
                    'fold-runner',
                    '*',
                    'game.fold_combo',
                    `Depth x${s.foldDepth} · Seed ${nextFold.foldedSeedHex}`,
                    112
                  );
                  void audioDSP.playHarmonicPulse(440 + s.foldDepth * 40, 0.22);
                } else {
                  clusterBus.publish('fold-runner', 'main-brain', 'game.fold_shard', `+${pts} (${ent.bit}-bit)`, 64);
                  void audioDSP.playHarmonicPulse(260 + ent.lane * 55, 0.1);
                }
                hyperFlowEngine.recordGameFold(s.score, s.foldDepth);
                setScore(s.score);
                setFoldDepth(s.foldDepth);
              } else {
                // Polarity mismatch or barrier hit
                s.combo = 0;
                s.integrity = Math.max(0, s.integrity - (ent.kind === 'barrier' ? 25 : 15));
                s.flashFrames = 14;
                setIntegrity(s.integrity);
                clusterBus.publish('fold-runner', 'mem-healer', 'game.collision', `Integrity ${s.integrity}%`, 72);
                void audioDSP.playHarmonicPulse(110, 0.18);
                if (s.integrity <= 0) {
                  s.state = 'GAME_OVER';
                  setGameState('GAME_OVER');
                  setHighScore((prev) => Math.max(prev, s.score));
                  clusterBus.publish('fold-runner', '*', 'game.over', `Final Score ${s.score}`, 96);
                }
              }
            }

            if (ent.collected || ent.x < -0.08) {
              s.entities.splice(i, 1);
            }
          }

          if (s.flashFrames > 0) s.flashFrames--;
        }
      }

      // Render 4-lane obsidian arena
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = s.flashFrames > 0 ? 'rgba(220, 38, 38, 0.14)' : 'rgba(3, 6, 12, 0.92)';
      ctx.fillRect(0, 0, w, h);

      const laneH = h / 4;
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, i * laneH);
        ctx.lineTo(w, i * laneH);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(`L${i}`, 10, i * laneH + 18);
      }

      // Draw entities
      for (const ent of s.entities) {
        const ex = ent.x * w;
        const ey = (ent.lane + 0.5) * laneH;
        if (ent.kind === 'barrier') {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(ex - 7, ey - laneH * 0.3, 14, laneH * 0.6);
        } else {
          ctx.fillStyle = ent.bit === 0 ? '#38bdf8' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(ex, ey, 11, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#030508';
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(ent.bit), ex, ey);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }

      // Draw player fold core
      const px = 0.14 * w;
      const py = (s.laneY + 0.5) * laneH;
      ctx.fillStyle = s.polarity === 0 ? '#38bdf8' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(px + 16, py);
      ctx.lineTo(px - 12, py - 12);
      ctx.lineTo(px - 6, py);
      ctx.lineTo(px - 12, py + 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`${s.polarity}B`, px - 26, py - 14);
    });

    return () => unsub();
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (simRef.current.state !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
    const clickedLane = Math.min(3, Math.max(0, Math.floor(relY * 4)));
    setExactLane(clickedLane);
  };

  return (
    <div className="p-5 space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">FoldRunner — Hyper Binary Kernel Game</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
            Seed {foldResult.foldedSeedHex} · Flow {flowScore}% · Feeds live entropy to cluster game systems
          </p>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span>Score <strong className="text-sky-300">{score}</strong></span>
          <span>Fold <strong className="text-amber-300">x{foldDepth}</strong></span>
          <span>HP <strong className={integrity > 40 ? 'text-emerald-400' : 'text-rose-400'}>{integrity}%</strong></span>
          <span>Bit <strong className={playerPolarity === 0 ? 'text-sky-300' : 'text-amber-300'}>{playerPolarity}</strong></span>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/[0.1] bg-[#030508]">
        <canvas
          ref={canvasRef}
          width={760}
          height={300}
          onClick={handleCanvasClick}
          className="w-full h-[270px] sm:h-[310px] block cursor-pointer"
        />

        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="space-y-1.5 max-w-md">
              <h4 className="text-lg font-semibold text-slate-100">FoldRunner 120Hz Kernel</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Catch binary shards matching your active polarity (0-Bit cyan or 1-Bit amber) and dodge red barriers.
                Waves are generated deterministically from the folded MGE1 GitHub binary state.
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                W/S or Arrows (or tap lane) to move · Space to Flip Polarity
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndStart}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 cursor-pointer"
            >
              Start Game
            </button>
          </div>
        )}

        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-3">
            <h4 className="text-base font-semibold text-slate-100">Kernel Game Paused</h4>
            <button
              type="button"
              onClick={() => {
                simRef.current.state = 'PLAYING';
                setGameState('PLAYING');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500/25 border border-sky-400/40 text-sky-100 cursor-pointer"
            >
              Resume
            </button>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-slate-100">Binary Integrity Depleted</h4>
              <p className="text-xs font-mono text-slate-300 tabular-nums">
                Score {score} · Best {Math.max(highScore, score)} · Max Fold x{foldDepth}
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndStart}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-sky-500/25 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Tactile Touch & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveLane(-1)}
            className="px-3.5 py-2 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200 cursor-pointer"
          >
            Lane Up
          </button>
          <button
            type="button"
            onClick={() => moveLane(1)}
            className="px-3.5 py-2 text-xs font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200 cursor-pointer"
          >
            Lane Down
          </button>
        </div>

        <button
          type="button"
          onClick={togglePolarity}
          className={`px-4 py-2 text-xs font-semibold rounded border cursor-pointer ${
            playerPolarity === 0
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
              : 'bg-amber-500/20 border-amber-400/40 text-amber-200'
          }`}
        >
          Flip Polarity (Current: {playerPolarity}-Bit)
        </button>
      </div>
    </div>
  );
}
