import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dateStringToTick,
  formatDateIso,
  tickToDate,
  YEAR_TICKS_365,
} from '../src/sim/core/ClockCalendar';
import { divFixed, mulFixed } from '../src/sim/core/FixedMath';
import { SeededRng } from '../src/sim/core/SeededRng';
import { SimEngine } from '../src/sim/core/SimEngine';
import { decodeSnapshot, encodeSnapshot, SNAPSHOT_BYTES } from '../src/sim/core/SnapshotCodec';
import { PLAYABLE_TAG_LIST } from '../src/sim/data/nations1936';

describe('Batch 02 Deterministic Simulation Kernel', () => {
  it('runs 1,460 ticks (1 year) twice with identical state hash and nation snapshots', () => {
    const runOnce = (seed: number) => {
      const eng = new SimEngine(seed, 'GER');
      eng.stepMany(YEAR_TICKS_365);
      return {
        tick: eng.tick,
        dateIso: formatDateIso(eng.tick),
        hash: eng.computeStateHashHex(),
        snap: eng.getSnapshot(),
      };
    };

    const r1 = runOnce(19360101);
    const r2 = runOnce(19360101);
    const rDiff = runOnce(19360102);

    expect(r1.tick).toBe(1460);
    expect(r1.dateIso).toBe('1936-12-31'); // 1936 is a leap year (366 days)
    expect(r1.hash).toBe(r2.hash);
    expect(r1.snap.rngState).toEqual(r2.snap.rngState);
    expect(r1.snap.nations).toEqual(r2.snap.nations);
    expect(r1.hash).not.toBe(rDiff.hash);
  });

  it('maps 6-hour calendar ticks and ISO dates deterministically (including 1936-03-15)', () => {
    const t = dateStringToTick('1936-03-15');
    expect(t).not.toBeNull();
    expect(formatDateIso(t!)).toBe('1936-03-15');

    // 4 daily slots: 晨(00:00), 午(06:00), 昏(12:00), 夜(18:00)
    const slots = [0, 1, 2, 3].map((offset) => tickToDate(t! + offset).slotShortZh);
    expect(slots).toEqual(['晨', '午', '昏', '夜']);

    const eng = new SimEngine(19360101, 'FRA');
    eng.applyImmediate({
      tick: 0,
      actorTag: 'FRA',
      type: 'SET_DATE',
      payload: { isoDate: '1936-03-15' },
    });
    expect(formatDateIso(eng.tick)).toBe('1936-03-15');
    expect(eng.crisisPermille).toBe(100); // 1936-03-07 Rhineland alert raised crisis from 5% -> 10%
  });

  it('round-trips fixed-point math, sfc32 RNG state, and 32 KB Transferable ArrayBuffer snapshots', () => {
    expect(mulFixed(2000, 952)).toBe(1904);
    expect(divFixed(1500, 2000)).toBe(750);

    const rngA = new SeededRng(424242);
    const saved = rngA.getState();
    const seqA = [rngA.nextUint32(), rngA.nextUint32(), rngA.nextUint32()];
    const rngB = SeededRng.fromState(saved);
    const seqB = [rngB.nextUint32(), rngB.nextUint32(), rngB.nextUint32()];
    expect(seqA).toEqual(seqB);

    const eng = new SimEngine(19360101, 'FRA');
    eng.stepMany(120);
    const snap = eng.getSnapshot();
    const buf = new ArrayBuffer(SNAPSHOT_BYTES);
    encodeSnapshot(snap, buf);
    const decoded = decodeSnapshot(buf, PLAYABLE_TAG_LIST);

    expect(decoded.tick).toBe(snap.tick);
    expect(decoded.playerTag).toBe('FRA');
    expect(decoded.stateHash).toBe(snap.stateHash);
    expect(decoded.rngState).toEqual(snap.rngState);
    expect(decoded.nations.length).toBeGreaterThanOrEqual(29);
    expect(decoded.nations).toEqual(snap.nations);
  });

  it('keeps src/sim/ strictly free of window, document, PIXI, and SharedArrayBuffer references', () => {
    const simDir = path.resolve(process.cwd(), 'src/sim');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(simDir);
    expect(files.length).toBeGreaterThanOrEqual(7);

    const forbidden = /\b(window|document|PIXI|SharedArrayBuffer)\b/;
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      // Strip block and line comments before scanning code tokens
      const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(forbidden.test(codeOnly), `Forbidden browser/DOM ref in ${f}`).toBe(false);
    }
  });
});
