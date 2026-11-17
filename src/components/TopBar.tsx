import type { WorkspaceView } from '../kernel/types';

interface TopBarProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  kernelTickHz: number;
  renderFps: number;
  onResetWorkspace: () => void;
}

const NAV_ITEMS: { id: WorkspaceView; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'cluster', label: 'Main Brain' },
  { id: 'fusion', label: 'Fusion Core' },
  { id: 'swarm', label: 'Swarm' },
  { id: 'game', label: 'FoldRunner' },
];

export function TopBar({
  activeView,
  onSelectView,
  kernelTickHz,
  renderFps,
  onResetWorkspace,
}: TopBarProps) {
  return (
    <header className="relative z-40 h-12 px-6 flex items-center justify-between gap-8 border-b border-white/[0.08] bg-[#04070d]/85 backdrop-blur-xl">
      <a
        href="#desktop"
        onClick={(e) => {
          e.preventDefault();
          onSelectView('desktop');
        }}
        className="text-sm font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
      >
        Liquid OS
      </a>

      <nav aria-label="Primary Workspace" className="flex items-center gap-6 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                active
                  ? 'text-sky-300 border-sky-400'
                  : 'text-slate-400 border-transparent hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline font-mono text-xs tabular-nums text-slate-300 whitespace-nowrap shrink-0">
          {kernelTickHz} Hz Kernel · {renderFps} FPS
        </span>
        <button
          type="button"
          onClick={onResetWorkspace}
          className="px-3.5 py-1.5 text-xs font-medium text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Reset Layout
        </button>
      </div>
    </header>
  );
}
