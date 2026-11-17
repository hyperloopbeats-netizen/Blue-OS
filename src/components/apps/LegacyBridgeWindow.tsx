import { useEffect, useRef } from 'react';
import { clusterBus } from '../../kernel/ClusterBus';
import type { MountedLegacyState, RepoModuleDescriptor } from '../../kernel/types';

interface LegacyBridgeWindowProps {
  module: RepoModuleDescriptor;
  bridgeState?: MountedLegacyState;
}

export function LegacyBridgeWindow({ module, bridgeState }: LegacyBridgeWindowProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    clusterBus.publish('desktop', module.name, 'node.mount', `Launched ${module.name} (${module.fnvHex})`, 128);
    return () => {
      clusterBus.unregisterLegacyNode(module.id);
      clusterBus.publish('desktop', 'bridge-watcher', 'node.unmount', `Closed ${module.name}`, 64);
    };
  }, [module.id, module.name, module.fnvHex]);

  const srcUrl =
    module.kind === 'html'
      ? `/app/${encodeURIComponent(module.name)}?bridge=1`
      : `/app/${encodeURIComponent(module.name)}`;

  const handlePing = () => {
    iframeRef.current?.contentWindow?.postMessage({ target: 'liquid-os-bridge', type: 'CLUSTER_PING' }, '*');
    clusterBus.publish('bridge-watcher', module.name, 'cluster.ping', 'Direct bridge ping', 48);
  };

  return (
    <div className="h-full flex flex-col bg-[#04060b]">
      <div className="px-4 py-2 border-b border-white/[0.08] bg-black/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300 tabular-nums">
          <span className={bridgeState?.status === 'linked' ? 'text-emerald-400' : 'text-slate-400'}>
            {module.kind === 'html'
              ? bridgeState?.status === 'linked'
                ? 'Cluster Bridge Linked'
                : 'Bridge Connecting'
              : 'Source Module'}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{bridgeState ? `${bridgeState.fps} FPS (${bridgeState.dtMs} ms)` : module.fnvHex}</span>
          {bridgeState?.memoryMB != null && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{bridgeState.memoryMB} MB heap</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {module.kind === 'html' && (
            <button
              type="button"
              onClick={handlePing}
              className="px-2.5 py-1 text-[11px] font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200 cursor-pointer"
            >
              Ping Node
            </button>
          )}
          <a
            href={`/app/${encodeURIComponent(module.name)}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 text-[11px] font-medium rounded bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200"
          >
            Standalone Tab
          </a>
        </div>
      </div>

      <iframe
        ref={iframeRef}
        title={module.title}
        src={srcUrl}
        data-cluster-bridge={module.kind === 'html' ? 'true' : 'false'}
        className="w-full flex-1 border-0 bg-[#030508]"
      />
    </div>
  );
}
