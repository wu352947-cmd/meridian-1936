/**
 * Pure deterministic lookup of river-crossing province neighbor edges derived from europe_1936.json.
 * Zero DOM/fetch dependencies — identical in Web Worker and Node Vitest.
 */
import rawRivers from './riverCrossings1936.json';
import type { RiverCrossingKind } from './combatDefines';

interface RawRiverData {
  major: number[];
  minor: number[];
}

const DATA = rawRivers as unknown as RawRiverData;
const MAJOR_SET = new Set<number>(DATA.major);
const MINOR_SET = new Set<number>(DATA.minor);

export function encodeProvEdgeKey(provA: number, provB: number): number {
  const lo = provA < provB ? provA : provB;
  const hi = provA < provB ? provB : provA;
  return (lo << 12) | hi;
}

export function getRiverCrossing(provA: number, provB: number): RiverCrossingKind {
  const k = encodeProvEdgeKey(provA, provB);
  if (MAJOR_SET.has(k)) return 'major';
  if (MINOR_SET.has(k)) return 'minor';
  return 'none';
}

export function worstRiverCrossing(kinds: readonly RiverCrossingKind[]): RiverCrossingKind {
  let res: RiverCrossingKind = 'none';
  for (const k of kinds) {
    if (k === 'major') return 'major';
    if (k === 'minor') res = 'minor';
  }
  return res;
}
