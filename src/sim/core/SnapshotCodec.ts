/**
 * Binary ping-pong Transferable ArrayBuffer codec (32 KB fixed buffer, zero SharedArrayBuffer).
 * Pure TypeScript — safe in Web Worker and Node Vitest.
 */
import type { SimSpeed } from './ClockCalendar';
import { REGIME_BY_CODE, REGIME_CODE, type RegimeType } from '../data/nations1936Core';

export const SNAPSHOT_BYTES = 32768; // 32 KB double-buffer frame
export const SNAPSHOT_MAGIC = 0x4d333602; // "M36\x02"
export const SNAPSHOT_VERSION = 2;

const HEADER_WORDS = 16; // 64 bytes
const NATION_STRIDE = 16; // 16 Int32 = 64 bytes per nation
export const MAX_SNAPSHOT_NATIONS = 48;
export const SUPPLY_SECTION_OFFSET = 4096;
export const MAX_SUPPLY_BYTES = 1024;

export interface SimNationSnapshot {
  tag: string;
  apPermille: number;
  apDailyPermille: number;
  cohesionPermille: number;
  readinessPermille: number;
  manpowerK: number;
  civ: number;
  mil: number;
  doc: number;
  steelNet: number;
  oilNet: number;
  rareNet: number;
  brigades: number;
  ships: number;
  airWings: number;
  researchSlots: number;
  regime: RegimeType;
  isMajor: boolean;
}

export interface WorldSnapshot {
  tick: number;
  speed: SimSpeed;
  paused: boolean;
  crisisPermille: number;
  playerTag: string;
  rngState: [number, number, number, number];
  stateHash: number;
  seqNo: number;
  nations: SimNationSnapshot[];
  /** Per-province integer supply S_p in [0..100] indexed by provId (Batch 07). */
  supplyByProv?: Uint8Array;
}

export function encodeSnapshot(snap: WorldSnapshot, buf: ArrayBuffer): void {
  if (buf.byteLength < SNAPSHOT_BYTES) {
    throw new Error(`Snapshot buffer too small: ${buf.byteLength} < ${SNAPSHOT_BYTES}`);
  }
  const view = new Int32Array(buf);
  const count = Math.min(snap.nations.length, MAX_SNAPSHOT_NATIONS);
  let playerIdx = snap.nations.findIndex((n) => n.tag === snap.playerTag);
  if (playerIdx < 0) playerIdx = 0;

  view[0] = SNAPSHOT_MAGIC;
  view[1] = SNAPSHOT_VERSION;
  view[2] = snap.tick | 0;
  view[3] = snap.speed | 0;
  view[4] = snap.paused ? 1 : 0;
  view[5] = snap.crisisPermille | 0;
  view[6] = playerIdx | 0;
  view[7] = count | 0;
  view[8] = snap.rngState[0] | 0;
  view[9] = snap.rngState[1] | 0;
  view[10] = snap.rngState[2] | 0;
  view[11] = snap.rngState[3] | 0;
  view[12] = snap.stateHash | 0;
  view[13] = snap.seqNo | 0;
  const supplyLen = snap.supplyByProv ? Math.min(snap.supplyByProv.length, MAX_SUPPLY_BYTES) : 0;
  view[14] = supplyLen | 0;
  view[15] = 0;

  for (let i = 0; i < count; i++) {
    const n = snap.nations[i]!;
    const base = HEADER_WORDS + i * NATION_STRIDE;
    view[base] = n.apPermille | 0;
    view[base + 1] = n.apDailyPermille | 0;
    view[base + 2] = n.cohesionPermille | 0;
    view[base + 3] = n.readinessPermille | 0;
    view[base + 4] = n.manpowerK | 0;
    view[base + 5] = n.civ | 0;
    view[base + 6] = n.mil | 0;
    view[base + 7] = n.doc | 0;
    view[base + 8] = n.steelNet | 0;
    view[base + 9] = n.oilNet | 0;
    view[base + 10] = n.rareNet | 0;
    view[base + 11] = n.brigades | 0;
    view[base + 12] = n.ships | 0;
    view[base + 13] = n.airWings | 0;
    view[base + 14] = (n.researchSlots & 0xff) | ((REGIME_CODE[n.regime] & 0x0f) << 8) | (n.isMajor ? 0x1000 : 0);
    view[base + 15] = 0;
  }

  if (snap.supplyByProv && supplyLen > 0) {
    const outBytes = new Uint8Array(buf, SUPPLY_SECTION_OFFSET, supplyLen);
    outBytes.set(snap.supplyByProv.subarray(0, supplyLen));
  }
}

export function decodeSnapshot(buf: ArrayBuffer, tagOrder: readonly string[]): WorldSnapshot {
  const view = new Int32Array(buf);
  if (view[0] !== SNAPSHOT_MAGIC || view[1] !== SNAPSHOT_VERSION) {
    throw new Error(`Invalid snapshot header: magic=${view[0]} ver=${view[1]}`);
  }
  const tick = view[2] ?? 0;
  const rawSpeed = view[3] ?? 1;
  const speed = (rawSpeed >= 0 && rawSpeed <= 4 ? rawSpeed : 1) as SimSpeed;
  const paused = (view[4] ?? 1) !== 0;
  const crisisPermille = view[5] ?? 50;
  const playerIdx = view[6] ?? 0;
  const count = Math.min(view[7] ?? 0, tagOrder.length, MAX_SNAPSHOT_NATIONS);
  const rngState: [number, number, number, number] = [
    (view[8] ?? 0) >>> 0,
    (view[9] ?? 0) >>> 0,
    (view[10] ?? 0) >>> 0,
    (view[11] ?? 0) >>> 0,
  ];
  const stateHash = (view[12] ?? 0) >>> 0;
  const seqNo = view[13] ?? 0;
  const supplyLen = Math.min(Math.max(0, view[14] ?? 0), MAX_SUPPLY_BYTES);

  const nations: SimNationSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const base = HEADER_WORDS + i * NATION_STRIDE;
    const packed = view[base + 14] ?? 0;
    const regimeCode = (packed >> 8) & 0x0f;
    nations.push({
      tag: tagOrder[i] ?? 'GER',
      apPermille: view[base] ?? 0,
      apDailyPermille: view[base + 1] ?? 0,
      cohesionPermille: view[base + 2] ?? 500,
      readinessPermille: view[base + 3] ?? 200,
      manpowerK: view[base + 4] ?? 0,
      civ: view[base + 5] ?? 0,
      mil: view[base + 6] ?? 0,
      doc: view[base + 7] ?? 0,
      steelNet: view[base + 8] ?? 0,
      oilNet: view[base + 9] ?? 0,
      rareNet: view[base + 10] ?? 0,
      brigades: view[base + 11] ?? 0,
      ships: view[base + 12] ?? 0,
      airWings: view[base + 13] ?? 0,
      researchSlots: packed & 0xff,
      regime: REGIME_BY_CODE[regimeCode] ?? 'neutral',
      isMajor: (packed & 0x1000) !== 0,
    });
  }

  const supplyByProv =
    supplyLen > 0
      ? new Uint8Array(buf.slice(SUPPLY_SECTION_OFFSET, SUPPLY_SECTION_OFFSET + supplyLen))
      : undefined;

  return {
    tick,
    speed,
    paused,
    crisisPermille,
    playerTag: tagOrder[playerIdx] ?? 'GER',
    rngState,
    stateHash,
    seqNo,
    nations,
    ...(supplyByProv ? { supplyByProv } : {}),
  };
}
