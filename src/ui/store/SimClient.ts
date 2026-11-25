/**
 * Main-thread SimulationWorker bridge using double-buffered Transferable ArrayBuffers.
 * Decodes incoming 32 KB snapshots into Preact Signals and immediately returns the buffer.
 */
import type { SimSpeed } from '../../sim/core/ClockCalendar';
import type { GameCommand, InitScenarioPayload } from '../../sim/core/GameCommand';
import { decodeSnapshot, type WorldSnapshot } from '../../sim/core/SnapshotCodec';
import type { TickerDispatch } from '../../sim/core/SimEngine';
import { PLAYABLE_TAG_LIST } from '../../sim/data/nations1936';
import type { MainToWorkerMessage, WorkerToMainMessage } from '../../sim/workerProtocol';

export interface SimClientHandlers {
  onSnapshot: (snap: WorldSnapshot, dispatches?: TickerDispatch[]) => void;
}

export class SimClient {
  private readonly worker: Worker;
  private tagOrder: string[] = [...PLAYABLE_TAG_LIST];
  private currentTick = 0;
  private currentTag = 'GER';
  private readyResolve: (() => void) | null = null;
  private snapshotWaiters: Array<() => void> = [];
  readonly ready: Promise<void>;

  constructor(handlers: SimClientHandlers) {
    this.ready = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });

    this.worker = new Worker(new URL('../../sim/worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (ev: MessageEvent<WorkerToMainMessage>) => {
      const msg = ev.data;
      if (msg.type === 'READY') {
        this.tagOrder = msg.tagOrder;
        this.readyResolve?.();
        this.readyResolve = null;
        return;
      }
      if (msg.type === 'SNAPSHOT') {
        const snap = decodeSnapshot(msg.buffer, this.tagOrder);
        this.currentTick = snap.tick;
        this.currentTag = snap.playerTag;
        // Return ArrayBuffer ownership back to Worker immediately (ping-pong zero-GC)
        const ret: MainToWorkerMessage = { type: 'RETURN_BUFFER', buffer: msg.buffer };
        this.worker.postMessage(ret, [msg.buffer]);

        handlers.onSnapshot(snap, msg.dispatches);

        if (this.snapshotWaiters.length > 0) {
          const waiters = this.snapshotWaiters.splice(0);
          for (const w of waiters) w();
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('[SimClient] worker error:', err);
    };
  }

  async initScenario(payload: InitScenarioPayload): Promise<void> {
    await this.ready;
    const waitNext = new Promise<void>((resolve) => {
      this.snapshotWaiters.push(resolve);
    });
    const msg: MainToWorkerMessage = { type: 'INIT', payload };
    this.worker.postMessage(msg);
    await waitNext;
  }

  sendCommand(type: GameCommand['type'], payload: GameCommand['payload']): void {
    const command: GameCommand = {
      tick: this.currentTick,
      actorTag: this.currentTag,
      type,
      payload,
    };
    const msg: MainToWorkerMessage = { type: 'COMMAND', command };
    this.worker.postMessage(msg);
  }

  selectCountry(countryTag: string): void {
    this.sendCommand('SELECT_COUNTRY', { countryTag });
  }

  setSpeed(speed: SimSpeed): void {
    this.sendCommand('SET_SPEED', { speed });
  }

  togglePause(paused?: boolean): void {
    this.sendCommand('TOGGLE_PAUSE', { paused });
  }

  setDate(isoDate: string): void {
    this.sendCommand('SET_DATE', { isoDate });
  }

  stepOnce(): void {
    const msg: MainToWorkerMessage = { type: 'STEP_ONCE' };
    this.worker.postMessage(msg);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
