import { Container, Graphics } from 'pixi.js';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';

function makeRng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Restrained vintage cartographic terrain micro-marks (using strictly existing province terrain data).
 * Every mark is verified against pickGrid to remain cleanly inside its owning province.
 */
export class TerrainDetailLayer {
  readonly root = new Container();
  private readonly inkSoftG = new Graphics();
  private readonly reliefMarkG = new Graphics();
  private readonly foliageG = new Graphics();
  private readonly marshG = new Graphics();

  constructor(meta: EuropeMapMeta, pickGrid: Uint16Array, pickW: number, pickH: number) {
    this.root.addChild(this.inkSoftG, this.reliefMarkG, this.foliageG, this.marshG);
    this.buildMarks(meta.provinces, pickGrid, pickW, pickH);
    this.updateLod(1.0);
  }

  private insideProvince(
    pickGrid: Uint16Array,
    pickW: number,
    pickH: number,
    wx: number,
    wy: number,
    provId: number,
    margin: number,
  ): boolean {
    const check = (x: number, y: number): boolean => {
      const gx = Math.floor(x * 0.5);
      const gy = Math.floor(y * 0.5);
      if (gx < 0 || gx >= pickW || gy < 0 || gy >= pickH) return false;
      return pickGrid[gy * pickW + gx] === provId;
    };
    return (
      check(wx, wy) &&
      check(wx + margin, wy) &&
      check(wx - margin, wy) &&
      check(wx, wy + margin) &&
      check(wx, wy - margin)
    );
  }

  private buildMarks(provinces: ProvinceRecord[], pickGrid: Uint16Array, pickW: number, pickH: number): void {
    for (const p of provinces) {
      if (p.isSea || p.areaPx < 420) continue;
      const rng = makeRng(p.id * 7919 + 1936);
      const radius = Math.sqrt(p.areaPx / Math.PI);

      const divisor = p.terrain === 'plains' ? 27 : p.terrain === 'desert' ? 29 : 23;
      const maxMarks = p.terrain === 'urban' ? (p.areaPx > 2200 ? 2 : 0) : p.terrain === 'plains' ? 4 : 5;
      const target = Math.min(maxMarks, Math.max(p.terrain === 'urban' ? 0 : 1, Math.floor(radius / divisor)));
      if (target <= 0) continue;

      const placed: Array<[number, number]> = [];
      const minSpacing = p.terrain === 'plains' ? 22 : 17;
      const minCenterDist = p.isCapital || p.cityZh ? 14 : 9;

      for (let attempt = 0; attempt < target * 11 && placed.length < target; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = minCenterDist + Math.sqrt(rng()) * Math.max(8, radius * 0.92 - minCenterDist);
        const wx = p.cx + Math.cos(angle) * dist;
        const wy = p.cy + Math.sin(angle) * dist;

        if (placed.some(([px, py]) => Math.hypot(wx - px, wy - py) < minSpacing)) continue;
        if (!this.insideProvince(pickGrid, pickW, pickH, wx, wy, p.id, 7.5)) continue;

        placed.push([wx, wy]);
        this.drawTerrainMotif(p.terrain, wx, wy, rng);
      }
    }

    this.inkSoftG.stroke({ width: 0.52, color: 0x2d251e, alpha: 0.28, cap: 'round', join: 'round' });
    this.reliefMarkG.stroke({ width: 0.62, color: 0x27201a, alpha: 0.37, cap: 'round', join: 'round' });
    this.foliageG.stroke({ width: 0.56, color: 0x232f20, alpha: 0.38, cap: 'round', join: 'round' });
    this.marshG.stroke({ width: 0.56, color: 0x2b4654, alpha: 0.42, cap: 'round', join: 'round' });
  }

  private drawTerrainMotif(terrain: ProvinceRecord['terrain'], x: number, y: number, rng: () => number): void {
    const s = 0.85 + rng() * 0.35;
    if (terrain === 'plains' || terrain === 'urban') {
      // Delicate staff-map meadow/contour wisps (2-3 gentle fine horizontal strokes + tiny grass tick)
      const g = this.inkSoftG;
      const w1 = 6.5 * s;
      g.moveTo(x - w1, y).quadraticCurveTo(x, y - 1.1 * s, x + w1, y);
      g.moveTo(x - w1 * 0.65, y + 2.6 * s).quadraticCurveTo(x + 1.0, y + 1.9 * s, x + w1 * 0.78, y + 2.6 * s);
      if (rng() > 0.42) {
        g.moveTo(x - 1.4, y - 0.6).lineTo(x - 2.1, y - 2.4 * s);
        g.moveTo(x + 0.6, y - 0.7).lineTo(x + 0.8, y - 2.6 * s);
      }
    } else if (terrain === 'forest') {
      // Miniature engraved 3-tree woodland cluster
      const g = this.foliageG;
      const pts: Array<[number, number, number]> = [
        [x - 3.4 * s, y + 1.2 * s, 3.2 * s],
        [x + 0.3 * s, y - 1.6 * s, 3.8 * s],
        [x + 3.6 * s, y + 1.0 * s, 3.0 * s],
      ];
      for (const [tx, ty, h] of pts) {
        g.moveTo(tx - h * 0.55, ty).lineTo(tx, ty - h).lineTo(tx + h * 0.55, ty);
        g.moveTo(tx, ty).lineTo(tx, ty + 1.2 * s);
      }
    } else if (terrain === 'hills') {
      // Classic arched hillock mound with subtle SE slope hachures
      const g = this.reliefMarkG;
      const w = 6.2 * s;
      const h = 3.4 * s;
      g.moveTo(x - w, y + 1.2).quadraticCurveTo(x, y - h * 1.45, x + w, y + 1.2);
      g.moveTo(x + 1.2 * s, y - 0.9 * s).lineTo(x + 2.8 * s, y + 0.8 * s);
      g.moveTo(x + 3.0 * s, y - 0.2 * s).lineTo(x + 4.4 * s, y + 1.0 * s);
    } else if (terrain === 'mountain') {
      // Engraved alpine peak chevron + twin shoulder + right-flank shade lines
      const g = this.reliefMarkG;
      const w = 6.8 * s;
      const h = 5.6 * s;
      g.moveTo(x - w, y + 2.2).lineTo(x - 0.8 * s, y - h).lineTo(x + w * 0.78, y + 2.2);
      g.moveTo(x - 0.8 * s, y - h).lineTo(x + 0.6 * s, y + 1.9);
      g.moveTo(x + 1.2 * s, y - h * 0.42).lineTo(x + 2.9 * s, y + 1.8);
      g.moveTo(x + 2.8 * s, y + 0.2).lineTo(x + 4.8 * s, y - h * 0.52).lineTo(x + w * 1.18, y + 2.2);
    } else if (terrain === 'marsh') {
      // Cartographic marsh waterlines + vertical reed ticks
      const g = this.marshG;
      g.moveTo(x - 6.0 * s, y).lineTo(x + 5.5 * s, y);
      g.moveTo(x - 3.8 * s, y + 2.4 * s).lineTo(x + 6.2 * s, y + 2.4 * s);
      g.moveTo(x - 2.0 * s, y).lineTo(x - 2.3 * s, y - 2.5 * s);
      g.moveTo(x + 0.4 * s, y).lineTo(x + 0.5 * s, y - 2.8 * s);
      g.moveTo(x + 2.6 * s, y + 2.4 * s).lineTo(x + 2.9 * s, y + 0.1 * s);
    } else if (terrain === 'desert') {
      const g = this.inkSoftG;
      const w = 6.8 * s;
      g.moveTo(x - w, y).quadraticCurveTo(x - w * 0.35, y - 2.2 * s, x, y).quadraticCurveTo(x + w * 0.35, y + 1.8 * s, x + w, y);
    }
  }

  updateLod(zoom: number): void {
    if (zoom < 1.18) {
      this.root.visible = false;
      this.root.alpha = 0;
      return;
    }
    this.root.visible = true;
    this.root.alpha = Math.min(0.95, ((zoom - 1.18) / 1.05) * 0.95);
  }
}
