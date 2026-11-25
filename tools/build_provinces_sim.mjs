#!/usr/bin/env node
/**
 * Extract compact deterministic land-province graph for src/sim/ (zero DOM/fetch).
 * Reads public/data/europe_1936/europe_1936.json -> src/sim/data/provinces1936.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'public/data/europe_1936/europe_1936.json');
const DST = path.join(ROOT, 'src/sim/data/provinces1936.json');

const meta = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const land = meta.provinces.filter((p) => !p.isSea);
const landIds = new Set(land.map((p) => p.id));

// Compact tuple per land province:
// [id, owner, terrain, cx, cy, vp, isCapital(0|1), isCoastal(0|1), nameZh, landNeighbors]
const rows = land
  .map((p) => [
    p.id,
    p.owner,
    p.terrain,
    Math.round(p.cx),
    Math.round(p.cy),
    p.vp | 0,
    p.isCapital ? 1 : 0,
    p.isCoastal ? 1 : 0,
    p.nameZh,
    p.neighbors.filter((nid) => landIds.has(nid)).sort((a, b) => a - b),
  ])
  .sort((a, b) => a[0] - b[0]);

fs.writeFileSync(DST, JSON.stringify({ provinces: rows }) + '\n');
console.log(`[provinces-sim] Wrote ${rows.length} land provinces -> ${DST}`);
