/**
 * SimulationWorker — Dedicated Web Worker hosting deterministic 6-hour tick clock
 * and Ping-Pong double-buffered Transferable ArrayBuffer snapshots (32 KB x 2).
 * Pure TypeScript, zero window/document/PIXI references.
 */
import { SPEED_INTERVAL_MS } from './core/ClockCalendar';
import { SimEngine } from './core/SimEngine';
import { encodeSnapshot, SNAPSHOT_BYTES } from './core/SnapshotCodec';
import { PLAYABLE_TAG_LIST } from './data/nations1936';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';

interface WorkerScopeMinimal {
  onmessage: ((ev: { data: MainToWorkerMessage }) => void) | null;
  postMessage: (msg: WorkerToMainMessage, transfer?: Transferable[]) => void;
}

const scope = self as unknown as WorkerScopeMinimal;

const engine = new SimEngine(19360101, 'GER');
const bufferPool: ArrayBuffer[] = [
  new ArrayBuffer(SNAPSHOT_BYTES),
  new ArrayBuffer(SNAPSHOT_BYTES),
];

let timerHandle: ReturnType<typeof setTimeout> | null = null;
let lastDispatchId = 0;
let lastIndustryRev = -1;
let lastArmyRev = -1;

function clearTickTimer(): void {
  if (timerHandle !== null) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
}

function scheduleNextTick(): void {
  clearTickTimer();
  if (engine.paused || engine.speed === 0) return;
  const interval = SPEED_INTERVAL_MS[engine.speed];
  if (interval <= 0) return;
  timerHandle = setTimeout(() => {
    timerHandle = null;
    if (engine.paused || engine.speed === 0) return;
    engine.stepTick();
    emitSnapshot();
    scheduleNextTick();
  }, interval);
}

function emitSnapshot(forceFull = false): void {
  const buf = bufferPool.pop() ?? new ArrayBuffer(SNAPSHOT_BYTES);
  const snap = engine.getSnapshot();
  encodeSnapshot(snap, buf);

  const dispatches = engine.getDispatches();
  const topId = dispatches[0]?.id ?? 0;
  const sendDispatches = forceFull || topId !== lastDispatchId;
  if (sendDispatches) lastDispatchId = topId;

  const indRev = engine.getIndustryRevision();
  const sendIndustry = forceFull || indRev !== lastIndustryRev;
  if (sendIndustry) lastIndustryRev = indRev;

  const armyRev = engine.getArmyRevision();
  const sendArmy = forceFull || armyRev !== lastArmyRev;
  if (sendArmy) lastArmyRev = armyRev;

  scope.postMessage(
    {
      type: 'SNAPSHOT',
      buffer: buf,
      ...(sendDispatches ? { dispatches } : {}),
      ...(sendIndustry
        ? {
            industry: engine.getIndustrySnapshot(),
            governance: engine.getGovernanceSnapshot(),
            tech: engine.getTechSnapshot(),
          }
        : {}),
      ...(sendArmy ? { army: engine.getArmySnapshot() } : {}),
    },
    [buf],
  );
}

scope.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'INIT':
      clearTickTimer();
      engine.resetScenario(msg.payload);
      emitSnapshot(true);
      scheduleNextTick();
      break;

    case 'COMMAND':
      engine.applyImmediate(msg.command);
      emitSnapshot();
      scheduleNextTick();
      break;

    case 'STEP_ONCE':
      engine.stepTick();
      emitSnapshot();
      break;

    case 'RETURN_BUFFER':
      if (msg.buffer instanceof ArrayBuffer && msg.buffer.byteLength >= SNAPSHOT_BYTES && bufferPool.length < 3) {
        bufferPool.push(msg.buffer);
      }
      break;
  }
};

scope.postMessage({ type: 'READY', tagOrder: [...PLAYABLE_TAG_LIST] });
emitSnapshot(true);
