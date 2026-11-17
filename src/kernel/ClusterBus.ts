import type { ClusterPacket, MountedLegacyState } from './types';

type PacketListener = (packet: ClusterPacket) => void;

export class ClusterBus {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<PacketListener>();
  private legacyStates = new Map<string, MountedLegacyState>();
  private recentPackets: ClusterPacket[] = [];
  private seq = 1;
  private msgWindowCount = 0;
  private lastWindowReset = performance.now();
  public currentRatePerSec = 0;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('liquid-os-cluster-v1');
      this.channel.onmessage = (ev) => {
        const data = ev.data as Omit<ClusterPacket, 'id'> | undefined;
        if (!data || !data.from || !data.topic) return;
        this.recordPacket(data.from, data.to || '*', data.topic, data.payloadSummary || '', data.bytes || 64, false);
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowBridgeMessage);
    }
  }

  private handleWindowBridgeMessage = (ev: MessageEvent): void => {
    const data = ev.data;
    if (!data || data.source !== 'liquid-os-bridge') return;

    const nodeId = String(data.nodeId || 'legacy-node');
    const nodeName = String(data.nodeName || nodeId);

    if (data.type === 'BRIDGE_READY') {
      this.legacyStates.set(nodeId, {
        moduleId: nodeId,
        moduleName: nodeName,
        fps: 60,
        dtMs: 16.67,
        interactions: 0,
        memoryMB: null,
        lastHeartbeatAt: performance.now(),
        status: 'linked',
      });
      this.publish(nodeName, 'cluster-mesh', 'bridge.ready', `Mounted ${nodeName} into 120Hz cluster`, 128);
    } else if (data.type === 'HEARTBEAT') {
      const payload = data.payload || {};
      const prev = this.legacyStates.get(nodeId);
      this.legacyStates.set(nodeId, {
        moduleId: nodeId,
        moduleName: nodeName,
        fps: Number(payload.fps) || 60,
        dtMs: Number(payload.dtMs) || 16.67,
        interactions: Number(payload.interactions) || prev?.interactions || 0,
        memoryMB: typeof payload.memoryMB === 'number' ? payload.memoryMB : null,
        lastHeartbeatAt: performance.now(),
        status: 'linked',
      });
      this.publish(
        nodeName,
        'bridge-watcher',
        'node.heartbeat',
        `${Number(payload.fps) || 60}fps · ${Number(payload.dtMs) || 16.7}ms`,
        64
      );
    } else if (data.type === 'CLUSTER_EVENT') {
      const payload = data.payload || {};
      this.publish(nodeName, '*', `node.${payload.kind || 'event'}`, String(payload.detail || 'activity'), 96);
    } else if (data.type === 'PONG') {
      this.publish(nodeName, 'cluster-mesh', 'node.pong', `Ack ${data.payload?.fps ?? 60}fps`, 48);
    }
  };

  public publish(from: string, to: string, topic: string, payloadSummary: string, bytes = 64): ClusterPacket {
    const packet = this.recordPacket(from, to, topic, payloadSummary, bytes, true);
    return packet;
  }

  private recordPacket(
    from: string,
    to: string,
    topic: string,
    payloadSummary: string,
    bytes: number,
    broadcastExternal: boolean
  ): ClusterPacket {
    const now = performance.now();
    const packet: ClusterPacket = {
      id: this.seq++,
      timestamp: now,
      from,
      to,
      topic,
      payloadSummary,
      bytes,
    };

    this.recentPackets.unshift(packet);
    if (this.recentPackets.length > 140) {
      this.recentPackets.length = 140;
    }

    this.msgWindowCount++;
    const elapsed = now - this.lastWindowReset;
    if (elapsed >= 1000) {
      this.currentRatePerSec = Math.round((this.msgWindowCount * 1000) / elapsed);
      this.msgWindowCount = 0;
      this.lastWindowReset = now;
    }

    if (broadcastExternal && this.channel) {
      try {
        this.channel.postMessage({
          timestamp: packet.timestamp,
          from: packet.from,
          to: packet.to,
          topic: packet.topic,
          payloadSummary: packet.payloadSummary,
          bytes: packet.bytes,
        });
      } catch {
        // Ignore closed channel
      }
    }

    for (const listener of this.listeners) {
      listener(packet);
    }

    return packet;
  }

  public subscribe(listener: PacketListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getRecentPackets(limit = 40): ClusterPacket[] {
    return this.recentPackets.slice(0, limit);
  }

  public getLegacyStates(): MountedLegacyState[] {
    const now = performance.now();
    const result: MountedLegacyState[] = [];
    for (const state of this.legacyStates.values()) {
      result.push({
        ...state,
        status: now - state.lastHeartbeatAt > 3000 ? 'idle' : 'linked',
      });
    }
    return result;
  }

  public unregisterLegacyNode(moduleId: string): void {
    this.legacyStates.delete(moduleId);
  }

  public pingAllLegacyFrames(): void {
    const iframes = document.querySelectorAll('iframe[data-cluster-bridge="true"]');
    iframes.forEach((frame) => {
      const win = (frame as HTMLIFrameElement).contentWindow;
      if (win) {
        win.postMessage({ target: 'liquid-os-bridge', type: 'CLUSTER_PING' }, '*');
      }
    });
  }
}

export const clusterBus = new ClusterBus();
