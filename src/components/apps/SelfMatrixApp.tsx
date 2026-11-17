import { clusterBus } from '../../kernel/ClusterBus';
import { hyperFlowEngine } from '../../kernel/HyperFlowEngine';
import type { AppSelfAwareness } from '../../kernel/types';

interface SelfMatrixAppProps {
  awareness: AppSelfAwareness[];
}

export function SelfMatrixApp({ awareness }: SelfMatrixAppProps) {
  const handleAuditAll = () => {
    for (const app of awareness) {
      hyperFlowEngine.queryAppSelfAwareness(app.appId);
    }
    clusterBus.publish('self-matrix', 'main-brain', 'self.audit_all', `${awareness.length} apps reflected`, 128);
  };

  return (
    <div className="p-5 space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Self-Aware Matrix — Cognitive App Reflections</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Every app tracks its inbound/outbound IPC dialogue, resonance score, and live thought state
          </p>
        </div>

        <button
          type="button"
          onClick={handleAuditAll}
          className="px-3.5 py-1.5 text-xs font-medium rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 whitespace-nowrap cursor-pointer"
        >
          Reflect All Apps
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {awareness.map((app) => (
          <div key={app.appId} className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">{app.title}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className={`font-mono text-[11px] ${app.isOpen ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {app.isOpen ? 'Window Active' : 'Background Aware'}
                </span>
              </div>
              <span className="font-mono text-xs text-sky-300 tabular-nums">{Math.round(app.resonancePct)}%</span>
            </div>

            <div className="text-xs font-mono text-slate-300 truncate">{app.lastThought}</div>

            <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-400 tabular-nums">
              <span>In {app.inboundCount} · Out {app.outboundCount}</span>
              <button
                type="button"
                onClick={() => hyperFlowEngine.queryAppSelfAwareness(app.appId)}
                className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 cursor-pointer"
              >
                Query Self
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
