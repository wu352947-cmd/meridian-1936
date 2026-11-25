#!/usr/bin/env node
/**
 * Deterministically cluster the 676 land provinces of europe_1936.json into ~145-155
 * contiguous Industrial Regions, matching exact opening CIV/MIL/DOC totals from nations1936*.ts
 * and placing historical 1936 steel/oil/rare resource deposits.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const MAP_PATH = path.join(ROOT, 'public/data/europe_1936/europe_1936.json');
const OUT_PATH = path.join(ROOT, 'src/sim/data/regions1936.json');

// Exact opening CIV/MIL/DOC & raw domestic resource endowments (aligned with DESIGN_carbon §4.15 & nations1936*.ts)
const NATION_DATA = {
  GER: { civ: 32, mil: 26, doc: 10, steel: 95, oil: 6, rare: 18, infra: 4 },
  GBR: { civ: 30, mil: 14, doc: 20, steel: 60, oil: 24, rare: 55, infra: 4 },
  FRA: { civ: 26, mil: 12, doc: 8, steel: 85, oil: 4, rare: 30, infra: 3 },
  SOV: { civ: 36, mil: 28, doc: 6, steel: 110, oil: 85, rare: 65, infra: 2 },
  ITA: { civ: 18, mil: 14, doc: 12, steel: 22, oil: 2, rare: 12, infra: 3 },
  POL: { civ: 14, mil: 10, doc: 1, steel: 32, oil: 8, rare: 6, infra: 2 },
  SPR: { civ: 12, mil: 6, doc: 4, steel: 28, oil: 0, rare: 24, infra: 2 },
  CZE: { civ: 13, mil: 11, doc: 0, steel: 36, oil: 0, rare: 8, infra: 3 },
  ROM: { civ: 11, mil: 7, doc: 2, steel: 14, oil: 52, rare: 4, infra: 2 },
  HUN: { civ: 9, mil: 6, doc: 0, steel: 16, oil: 4, rare: 12, infra: 3 },
  YUG: { civ: 10, mil: 6, doc: 2, steel: 18, oil: 2, rare: 14, infra: 2 },
  AUS: { civ: 9, mil: 5, doc: 0, steel: 18, oil: 2, rare: 4, infra: 3 },
  TUR: { civ: 10, mil: 5, doc: 2, steel: 14, oil: 0, rare: 26, infra: 2 },
  FIN: { civ: 8, mil: 4, doc: 1, steel: 10, oil: 0, rare: 6, infra: 2 },
  SWE: { civ: 13, mil: 5, doc: 4, steel: 68, oil: 0, rare: 18, infra: 3 },
  NOR: { civ: 7, mil: 3, doc: 3, steel: 12, oil: 0, rare: 10, infra: 2 },
  DEN: { civ: 7, mil: 2, doc: 2, steel: 4, oil: 0, rare: 2, infra: 3 },
  ISL: { civ: 2, mil: 0, doc: 1, steel: 0, oil: 0, rare: 0, infra: 2 },
  HOL: { civ: 12, mil: 4, doc: 5, steel: 10, oil: 14, rare: 16, infra: 4 },
  BEL: { civ: 12, mil: 6, doc: 1, steel: 30, oil: 0, rare: 8, infra: 4 },
  LUX: { civ: 3, mil: 1, doc: 0, steel: 18, oil: 0, rare: 0, infra: 4 },
  SWI: { civ: 10, mil: 5, doc: 0, steel: 10, oil: 0, rare: 4, infra: 4 },
  GRE: { civ: 6, mil: 4, doc: 2, steel: 6, oil: 0, rare: 12, infra: 2 },
  BUL: { civ: 6, mil: 4, doc: 1, steel: 6, oil: 0, rare: 4, infra: 2 },
  ALB: { civ: 2, mil: 1, doc: 0, steel: 2, oil: 6, rare: 2, infra: 1 },
  POR: { civ: 6, mil: 3, doc: 2, steel: 6, oil: 0, rare: 22, infra: 2 },
  IRE: { civ: 5, mil: 2, doc: 1, steel: 4, oil: 0, rare: 2, infra: 3 },
  LIT: { civ: 4, mil: 2, doc: 1, steel: 2, oil: 0, rare: 0, infra: 2 },
  LAT: { civ: 4, mil: 2, doc: 1, steel: 2, oil: 0, rare: 0, infra: 2 },
  EST: { civ: 3, mil: 2, doc: 1, steel: 2, oil: 4, rare: 0, infra: 2 },
  DNZ: { civ: 2, mil: 1, doc: 1, steel: 2, oil: 0, rare: 0, infra: 3 },
};

// Historical resource focal province matchers (regex on nameEn -> weight per resource)
const RESOURCE_HINTS = {
  GER: { steel: [[/ruhr|dortmund|düsseldorf/i, 12], [/breslau|oppeln/i, 6], [/saarland/i, 4]], oil: [[/hannover|niedersachsen/i, 8], [/magdeburg|berlin/i, 3]], rare: [[/dresden|leipzig/i, 8], [/ruhr|breslau/i, 4]] },
  ROM: { oil: [[/ploie/i, 20], [/bucharest|brașov/i, 4]], steel: [[/reșița|timișoara/i, 6]] },
  SOV: { oil: [[/baku/i, 24], [/grozny|krasnodar/i, 8], [/ufa/i, 4]], steel: [[/stalino|dnepropetrovsk|kharkov/i, 10], [/sverdlovsk|chelyabinsk|tula/i, 8]], rare: [[/sverdlovsk|chelyabinsk/i, 10], [/murmansk|perm/i, 6]] },
  SWE: { steel: [[/lule|ume/i, 14], [/borlänge|stockholm/i, 5]], rare: [[/lule|sundsvall/i, 8]] },
  FRA: { steel: [[/strasbourg|metz|nancy|lille/i, 10], [/lyon/i, 4]], rare: [[/marseille|lyon|algiers/i, 7]], oil: [[/strasbourg|algiers/i, 5]] },
  GBR: { steel: [[/sheffield|birmingham|glasgow|newcastle|cardiff/i, 8]], oil: [[/cairo|suez|haifa/i, 10], [/london/i, 3]], rare: [[/london|manchester|cardiff/i, 7]] },
  POL: { steel: [[/katowice|krak|warsaw/i, 9]], oil: [[/lwów|lviv|stanisławów|rzesz/i, 12]] },
  CZE: { steel: [[/ostrava|plzeň|prague|brno/i, 8]], rare: [[/plzeň|prague/i, 7]] },
  SPR: { rare: [[/badajoz|cáceres|león|bilbao/i, 9]], steel: [[/bilbao|oviedo|zaragoza/i, 8]] },
  TUR: { rare: [[/erzurum|sivas|ankara|konya/i, 8]] },
  HUN: { rare: [[/budapest|győr|pécs/i, 7]], oil: [[/pécs|szeged/i, 6]] },
};

function targetRegionsForCount(n) {
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  if (n <= 15) return 3;
  return Math.max(4, Math.min(25, Math.round(n / 4.85)));
}

function clusterCountry(provs) {
  const k = targetRegionsForCount(provs.length);
  if (k <= 1) return [provs];
  const byId = new Map(provs.map((p) => [p.id, p]));
  // Pick k deterministic seeds: highest VP/industry first, maximally spread apart
  const sorted = [...provs].sort((a, b) => (b.vp * 3 + b.industry * 2 - (a.vp * 3 + a.industry * 2)) || a.id - b.id);
  const seeds = [sorted[0]];
  while (seeds.length < k) {
    let best = null;
    let bestScore = -1;
    for (const p of sorted) {
      if (seeds.includes(p)) continue;
      let minDist = Infinity;
      for (const s of seeds) {
        const d = Math.hypot(p.cx - s.cx, p.cy - s.cy);
        if (d < minDist) minDist = d;
      }
      const score = minDist * (1 + (p.vp + p.industry) * 0.02);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) break;
    seeds.push(best);
  }
  // Multi-source BFS assignment to guarantee contiguous regions where possible
  const ownerRegion = new Map();
  const queues = seeds.map((s, idx) => { ownerRegion.set(s.id, idx); return [s]; });
  let progress = true;
  while (progress) {
    progress = false;
    for (let idx = 0; idx < queues.length; idx++) {
      const q = queues[idx];
      if (!q.length) continue;
      const cur = q.shift();
      const nbrs = cur.neighbors.map((id) => byId.get(id)).filter(Boolean);
      nbrs.sort((a, b) => Math.hypot(a.cx - seeds[idx].cx, a.cy - seeds[idx].cy) - Math.hypot(b.cx - seeds[idx].cx, b.cy - seeds[idx].cy));
      for (const nb of nbrs) {
        if (!ownerRegion.has(nb.id)) { ownerRegion.set(nb.id, idx); q.push(nb); progress = true; }
      }
    }
  }
  // Assign any disconnected island/exclave provinces to nearest seed
  for (const p of provs) {
    if (!ownerRegion.has(p.id)) {
      let bestIdx = 0, bestD = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const d = Math.hypot(p.cx - seeds[i].cx, p.cy - seeds[i].cy);
        if (d < bestD) { bestD = d; bestIdx = i; }
      }
      ownerRegion.set(p.id, bestIdx);
    }
  }
  const buckets = Array.from({ length: seeds.length }, () => []);
  for (const p of provs) buckets[ownerRegion.get(p.id)].push(p);
  return buckets.filter((b) => b.length > 0);
}

function distributeInt(total, weights, caps = null) {
  const out = weights.map(() => 0);
  if (total <= 0 || weights.length === 0) return out;
  const sumW = weights.reduce((a, b) => a + b, 0) || weights.length;
  const exact = weights.map((w, i) => ({
    i,
    val: (total * (w || 1)) / sumW,
    cap: caps ? caps[i] : Infinity,
  }));
  let rem = total;
  for (const e of exact) {
    const base = Math.min(e.cap, Math.floor(e.val));
    out[e.i] = base;
    rem -= base;
  }
  const byFrac = [...exact].sort((a, b) => (b.val - Math.floor(b.val)) - (a.val - Math.floor(a.val)) || a.i - b.i);
  while (rem > 0) {
    let placed = false;
    for (const e of byFrac) {
      if (rem <= 0) break;
      if (out[e.i] < e.cap) { out[e.i]++; rem--; placed = true; }
    }
    if (!placed) break;
  }
  return out;
}

const mapMeta = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const landProvs = mapMeta.provinces.filter((p) => !p.isSea);
const byOwner = new Map();
for (const p of landProvs) {
  if (!byOwner.has(p.owner)) byOwner.set(p.owner, []);
  byOwner.get(p.owner).push(p);
}

// Compute country land-adjacency graph (for continental overland trade)
const provById = new Map(landProvs.map((p) => [p.id, p]));
const landAdj = {};
for (const p of landProvs) {
  if (!NATION_DATA[p.owner]) continue;
  landAdj[p.owner] ??= new Set();
  for (const nid of p.neighbors) {
    const nb = provById.get(nid);
    if (nb && nb.owner !== p.owner && NATION_DATA[nb.owner]) {
      landAdj[p.owner].add(nb.owner);
    }
  }
}

const regions = [];
let nextId = 1;
const owners = Object.keys(NATION_DATA);

for (const tag of owners) {
  const provs = byOwner.get(tag) || [];
  if (provs.length === 0) continue;
  const cfg = NATION_DATA[tag];
  const clusters = clusterCountry(provs);
  const hints = RESOURCE_HINTS[tag] || {};

  const metaClusters = clusters.map((cProvs) => {
    const hub = [...cProvs].sort((a, b) => (b.isCapital ? 1000 : 0) + b.vp * 4 + b.industry * 3 - ((a.isCapital ? 1000 : 0) + a.vp * 4 + a.industry * 3) || a.id - b.id)[0];
    const isCoastal = cProvs.some((p) => p.isCoastal);
    const indWeight = cProvs.reduce((s, p) => s + Math.max(1, p.industry) + p.vp * 0.4, 0);
    const hintWeight = (res) => {
      let w = 0;
      for (const [rx, score] of hints[res] || []) {
        if (cProvs.some((p) => rx.test(p.nameEn) || rx.test(p.nameZh))) w += score;
      }
      return w;
    };
    const sH = hintWeight('steel');
    const oH = hintWeight('oil');
    const rH = hintWeight('rare');
    const steelW = sH > 0 ? sH * 18 + indWeight * 0.5 : indWeight * 0.25;
    const oilW = oH > 0 ? oH * 30 : 0.4;
    const rareW = rH > 0 ? rH * 15 + indWeight * 0.4 : indWeight * 0.25;
    const baseInfra = Math.max(1, Math.min(5, cfg.infra + (hub.isCapital || hub.vp >= 18 ? 1 : hub.vp < 6 ? -1 : 0)));
    return { provs: cProvs, hub, isCoastal, indWeight, steelW, oilW, rareW, infra: baseInfra };
  });

  // Allocate DOC strictly to coastal regions (fallback to all if landlocked)
  const coastalWeights = metaClusters.map((c) => (c.isCoastal ? c.indWeight : 0));
  const docWeights = coastalWeights.some((w) => w > 0) ? coastalWeights : metaClusters.map((c) => c.indWeight);
  const civAlloc = distributeInt(cfg.civ, metaClusters.map((c) => c.indWeight));
  const milAlloc = distributeInt(cfg.mil, metaClusters.map((c) => c.indWeight));
  const docAlloc = distributeInt(cfg.doc, docWeights);
  const steelAlloc = distributeInt(cfg.steel, metaClusters.map((c) => c.steelW));
  const oilAlloc = distributeInt(cfg.oil, metaClusters.map((c) => c.oilW));
  const rareAlloc = distributeInt(cfg.rare, metaClusters.map((c) => c.rareW));

  for (let i = 0; i < metaClusters.length; i++) {
    const c = metaClusters[i];
    const used = civAlloc[i] + milAlloc[i] + docAlloc[i];
    const slots = Math.max(used + 2, Math.min(12, Math.max(4, 4 + Math.round(c.hub.vp / 5))));
    const baseName = c.hub.cityZh || c.hub.nameZh;
    const nameZh = baseName.endsWith('区') ? baseName : `${baseName}区`;
    regions.push({
      id: nextId++,
      owner: tag,
      nameZh,
      hubProvId: c.hub.id,
      cx: Math.round(c.hub.cx),
      cy: Math.round(c.hub.cy),
      isCoastal: c.isCoastal,
      provinceIds: c.provs.map((p) => p.id).sort((a, b) => a - b),
      slots,
      infra: c.infra,
      civ: civAlloc[i],
      mil: milAlloc[i],
      doc: docAlloc[i],
      steel: steelAlloc[i],
      oil: oilAlloc[i],
      rare: rareAlloc[i],
    });
  }
}

const landAdjJson = {};
for (const tag of owners) {
  landAdjJson[tag] = Array.from(landAdj[tag] || []).sort();
}

fs.writeFileSync(OUT_PATH, JSON.stringify({ regions, landAdj: landAdjJson }, null, 2) + '\n');
console.log(`[regions] Generated ${regions.length} industrial regions across ${owners.length} playable nations -> ${OUT_PATH}`);
const ger = regions.filter((r) => r.owner === 'GER');
console.log('GER regions:', ger.map((r) => `${r.id}:${r.nameZh}(c${r.civ}/m${r.mil}/d${r.doc} s${r.steel}/o${r.oil}/r${r.rare} inf${r.infra} sl${r.slots})`).join(', '));
