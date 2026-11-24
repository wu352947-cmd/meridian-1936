import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { EuropeMapMeta, ProvinceRecord } from '../src/types/map';

const DATA_DIR = path.resolve(process.cwd(), 'public/data/europe_1936');
const meta: EuropeMapMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'europe_1936.json'), 'utf8'));
const provById = new Map<number, ProvinceRecord>(meta.provinces.map((p) => [p.id, p]));
const png = PNG.sync.read(fs.readFileSync(path.join(DATA_DIR, 'province_id.png')));

/** Exact WGS84 ellipsoidal LAEA forward projection (lon0=10E, lat0=52N). */
function lonLatToPixel(lonDeg: number, latDeg: number): [number, number] {
  const rad = Math.PI / 180;
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const qOf = (phi: number) => {
    const s = Math.sin(phi);
    return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s)));
  };
  const qp = qOf(Math.PI / 2);
  const betaOf = (phi: number) => Math.asin(Math.max(-1, Math.min(1, qOf(phi) / qp)));
  const phi0 = 52 * rad;
  const lam0 = 10 * rad;
  const beta0 = betaOf(phi0);
  const rq = a * Math.sqrt(qp / 2);
  const m1 = Math.cos(phi0) / Math.sqrt(1 - e2 * Math.sin(phi0) ** 2);
  const D = (a * m1) / (rq * Math.cos(beta0));

  const phi = latDeg * rad;
  const lam = lonDeg * rad;
  const beta = betaOf(phi);
  const dLam = lam - lam0;
  const B = rq * Math.sqrt(2 / (1 + Math.sin(beta0) * Math.sin(beta) + Math.cos(beta0) * Math.cos(beta) * Math.cos(dLam)));
  const x = B * D * Math.cos(beta) * Math.sin(dLam);
  const y = (B / D) * (Math.cos(beta0) * Math.sin(beta) - Math.sin(beta0) * Math.cos(beta) * Math.cos(dLam));

  const [xmin, ymin, xmax, ymax] = meta.boundsMeters;
  const px = Math.round(((x - xmin) / (xmax - xmin)) * meta.width);
  const py = Math.round(((ymax - y) / (ymax - ymin)) * meta.height);
  return [px, py];
}

function ownerAt(lon: number, lat: number): { id: number; owner: string; nameZh: string } {
  const [px, py] = lonLatToPixel(lon, lat);
  const idx = (py * png.width + px) * 4;
  const id = (png.data[idx] ?? 0) | ((png.data[idx + 1] ?? 0) << 8);
  const p = provById.get(id);
  if (!p) throw new Error(`No province at (${lon},${lat}) -> px(${px},${py}) id=${id}`);
  return { id, owner: p.owner, nameZh: p.nameZh };
}

describe('Europe 1936 Map Topology & Data Integrity', () => {
  it('has expected province and sea zone counts', () => {
    expect(meta.landCount).toBeGreaterThanOrEqual(500);
    expect(meta.landCount).toBeLessThanOrEqual(700);
    expect(meta.seaCount).toBeGreaterThanOrEqual(45);
    expect(meta.provinces.length).toBe(meta.landCount + meta.seaCount);
    expect(png.width).toBe(meta.width);
    expect(png.height).toBe(meta.height);
  });

  it('maps province IDs 1-to-1 with lossless province_id.png pixels', () => {
    const counts = new Int32Array(4096);
    const totalPixels = png.width * png.height;
    let nonOpaque = 0;
    const data = png.data;
    for (let i = 0; i < totalPixels; i++) {
      const off = i << 2;
      const pid = (data[off] ?? 0) | ((data[off + 1] ?? 0) << 8);
      if ((data[off + 3] ?? 0) !== 255) nonOpaque++;
      counts[pid] = (counts[pid] ?? 0) + 1;
    }

    expect(nonOpaque).toBe(0);
    expect(counts[0]).toBe(0);

    let activeIds = 0;
    for (let id = 1; id < 4096; id++) {
      if ((counts[id] ?? 0) > 0) activeIds++;
    }
    expect(activeIds).toBe(meta.provinces.length);

    // Every metadata province exists in PNG with matching areaPx
    for (const p of meta.provinces) {
      const pxCount = counts[p.id] ?? 0;
      expect(pxCount).toBeGreaterThan(0);
      expect(pxCount).toBe(p.areaPx);
    }
  });

  it('has zero isolated provinces and strictly symmetric adjacency', () => {
    for (const p of meta.provinces) {
      expect(p.neighbors.length).toBeGreaterThan(0);
      for (const nId of p.neighbors) {
        expect(nId).not.toBe(p.id);
        const nbr = provById.get(nId);
        expect(nbr).toBeDefined();
        expect(nbr!.neighbors).toContain(p.id);
      }
      if (!p.isSea) {
        const hasSeaNbr = p.neighbors.some((n) => provById.get(n)?.isSea);
        expect(p.isCoastal).toBe(hasSeaNbr);
      }
    }
  });

  it('accurately reflects key 1936 interwar European borders', () => {
    const historicalChecks: Array<[string, number, number, string]> = [
      ['Free City of Danzig', 18.65, 54.35, 'DNZ'],
      ['Polish Corridor (Gdynia)', 18.20, 54.45, 'POL'],
      ['East Prussia (Königsberg)', 20.50, 54.71, 'GER'],
      ['East Prussia South (Allenstein)', 20.48, 53.78, 'GER'],
      ['Lower Silesia (Breslau)', 17.03, 51.11, 'GER'],
      ['Pomerania (Stettin)', 14.55, 53.43, 'GER'],
      ['Saarland (returned 1935)', 7.00, 49.24, 'GER'],
      ['Sudetenland West (Karlovy Vary)', 12.87, 50.23, 'CZE'],
      ['Sudetenland North (Liberec)', 15.05, 50.77, 'CZE'],
      ['Independent Austria (Vienna)', 16.37, 48.21, 'AUS'],
      ['Finnish Karelia (Viipuri)', 28.75, 60.71, 'FIN'],
      ['Soviet Leningrad', 30.33, 59.93, 'SOV'],
      ['Polish Kresy (Lwów)', 24.03, 49.84, 'POL'],
      ['Polish Kresy (Brześć)', 23.69, 52.10, 'POL'],
      ['Polish Wilno (Vilnius)', 25.28, 54.69, 'POL'],
      ['Lithuania Provisional Capital (Kaunas)', 23.90, 54.90, 'LIT'],
      ['Memel Territory (Klaipėda)', 21.14, 55.71, 'LIT'],
      ['Romanian Bessarabia (Chișinău)', 28.86, 47.01, 'ROM'],
      ['Independent Albania (Tirana)', 19.82, 41.33, 'ALB'],
      ['Irish Free State (Dublin)', -6.26, 53.35, 'IRE'],
      ['Northern Ireland (Belfast)', -5.93, 54.60, 'GBR'],
      ['Iceland (Reykjavík)', -21.94, 64.15, 'ISL'],
      ['European Turkey (Edirne)', 26.56, 41.68, 'TUR'],
    ];

    for (const [label, lon, lat, expectedOwner] of historicalChecks) {
      const got = ownerAt(lon, lat);
      expect(got.owner, `${label} at (${lon},${lat}) mapped to ${got.nameZh} (${got.owner})`).toBe(expectedOwner);
    }
  });
});
