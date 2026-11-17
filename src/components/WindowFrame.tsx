import { useRef, type ReactNode } from 'react';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import type { OSWindowState } from '../kernel/types';

interface WindowFrameProps {
  win: OSWindowState;
  isFocused: boolean;
  onFocus: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMinimize: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onClose: (id: string) => void;
  children: ReactNode;
}

export function WindowFrame({
  win,
  isFocused,
  onFocus,
  onMove,
  onMinimize,
  onToggleMaximize,
  onClose,
  children,
}: WindowFrameProps) {
  const dragOrigin = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);

  if (win.minimized) return null;

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus(win.id);
    if (win.maximized) return;

    dragOrigin.current = {
      startX: e.clientX,
      startY: e.clientY,
      winX: win.x,
      winY: win.y,
    };

    const handleMove = (moveEv: PointerEvent) => {
      if (!dragOrigin.current) return;
      const dx = moveEv.clientX - dragOrigin.current.startX;
      const dy = moveEv.clientY - dragOrigin.current.startY;
      const nextX = Math.max(8, Math.min(window.innerWidth - 260, dragOrigin.current.winX + dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 160, dragOrigin.current.winY + dy));
      onMove(win.id, nextX, nextY);
    };

    const handleUp = () => {
      dragOrigin.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const style: React.CSSProperties = win.maximized
    ? {
        left: 12,
        top: 12,
        width: 'calc(100% - 24px)',
        height: 'calc(100% - 88px)',
        zIndex: win.zIndex,
      }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      };

  return (
    <section
      aria-label={win.title}
      onPointerDown={() => onFocus(win.id)}
      style={style}
      className={`fixed flex flex-col rounded-xl overflow-hidden black-glass-elevated transition-shadow ${
        isFocused ? 'border-sky-400/35' : 'border-white/[0.09]'
      }`}
    >
      <div
        onPointerDown={handleHeaderPointerDown}
        className="h-10 px-4 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-black/40 select-none cursor-grab active:cursor-grabbing shrink-0"
      >
        <div className="min-w-0 flex items-center gap-2.5">
          <h2 className="text-xs font-semibold text-slate-100 truncate">{win.title}</h2>
          <span aria-hidden="true" className="text-slate-600 text-xs">·</span>
          <span className="text-[11px] font-mono text-slate-400 truncate">{win.subtitle}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMinimize(win.id)}
            aria-label={`Minimize ${win.title}`}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleMaximize(win.id)}
            aria-label={win.maximized ? `Restore ${win.title}` : `Maximize ${win.title}`}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {win.maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onClose(win.id)}
            aria-label={`Close ${win.title}`}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-[#060911]/85">{children}</div>
    </section>
  );
}
