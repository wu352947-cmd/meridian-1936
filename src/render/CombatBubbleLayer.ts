/**
 * Screen-space PixiJS CombatBubbleLayer: original vermilion & deep-ink octagonal wax seals
 * bearing hand-coded SVG crossed bayonet rifles and bottom advantage pill, placed cleanly
 * beside unit counters (never covering counters or city names). Click opens BattleReportDrawer.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BATTLE_SEAL_SVG_SIZE, CROSSED_BAYONET_RIFLES_SVG } from '../assets/icons/combatIcons';
import type { ProvinceBattleSnap } from '../sim/systems/combatTypes';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';

type ScreenBox = [number, number, number, number];
export interface CounterAnchor { sx: number; sy: number; w: number; h: number }

const SCORE_STYLE = new TextStyle({
  fontFamily: 'MeridianMono, "JetBrains Mono", monospace',
  fontSize: 10.5,
  fontWeight: '700',
  fill: '#FAF3E4',
});

const SEAL_R = 18;
const RIFLE_SCALE = 30.5 / BATTLE_SEAL_SVG_SIZE;

function octPoints(r: number, ox = 0, oy = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    pts.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
  }
  return pts;
}

function overlapArea(a: ScreenBox, b: ScreenBox, pad = 0): number {
  const ox = Math.min(a[2], b[2] + pad) - Math.max(a[0], b[0] - pad);
  const oy = Math.min(a[3], b[3] + pad) - Math.max(a[1], b[1] - pad);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

interface StampHitBox { battle: ProvinceBattleSnap; sx: number; sy: number; r: number }

export class CombatBubbleLayer {
  readonly root = new Container();
  private readonly tetherG = new Graphics();
  private readonly sealGroup = new Container();
  private readonly provById = new Map<number, ProvinceRecord>();
  private battles: ProvinceBattleSnap[] = [];
  private playerTag = 'GER';
  private selectedProvId: number | null = null;
  private hitBoxes: StampHitBox[] = [];
  private avoidCounters: readonly ScreenBox[] = [];
  private countersByProv: ReadonlyMap<number, CounterAnchor[]> = new Map();
  private avoidLabels: readonly ScreenBox[] = [];
  private cam = { x: 1880, y: 1580, zoom: 1.0, vw: 1440, vh: 900 };

  constructor(meta: EuropeMapMeta) {
    for (const p of meta.provinces) this.provById.set(p.id, p);
    this.root.addChild(this.tetherG, this.sealGroup);
  }

  setVisible(visible: boolean): void { this.root.visible = visible; }

  setAvoidContext(
    counterBoxes: readonly ScreenBox[],
    countersByProv: ReadonlyMap<number, CounterAnchor[]>,
    labelBoxes: readonly ScreenBox[],
  ): void {
    this.avoidCounters = counterBoxes;
    this.countersByProv = countersByProv;
    this.avoidLabels = labelBoxes;
  }

  setData(battles: ProvinceBattleSnap[], playerTag: string, selectedProvId: number | null): void {
    this.battles = battles;
    this.playerTag = playerTag;
    this.selectedProvId = selectedProvId;
    this.rebuild();
  }

  updateCamera(camX: number, camY: number, zoom: number, vw: number, vh: number): void {
    this.cam = { x: camX, y: camY, zoom, vw, vh };
    this.rebuild();
  }

  hitTestPoint(sx: number, sy: number): ProvinceBattleSnap | null {
    if (!this.root.visible) return null;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const h = this.hitBoxes[i]!;
      if (Math.abs(sx - h.sx) <= 21 && sy >= h.sy - 21 && sy <= h.sy + 29) return h.battle;
    }
    return null;
  }

  getPlacedScreenBoxes(): ScreenBox[] {
    return this.hitBoxes.map((h) => [h.sx - 21, h.sy - 21, h.sx + 21, h.sy + 29]);
  }

  private toScreen(wx: number, wy: number): [number, number] {
    const { x, y, zoom, vw, vh } = this.cam;
    return [vw * 0.5 + (wx - x) * zoom, vh * 0.5 + (wy - y) * zoom];
  }

  private pickSidePosition(provId: number, px: number, py: number, placedSeals: readonly ScreenBox[]): [number, number] {
    const { vw, vh } = this.cam;
    const cs = this.countersByProv.get(provId);
    let cMinX = px - 10, cMaxX = px + 10, cMinY = py - 10, cMaxY = py + 10;
    if (cs && cs.length > 0) {
      cMinX = Infinity; cMaxX = -Infinity; cMinY = Infinity; cMaxY = -Infinity;
      for (const c of cs) {
        cMinX = Math.min(cMinX, c.sx - c.w * 0.5);
        cMaxX = Math.max(cMaxX, c.sx + c.w * 0.5);
        cMinY = Math.min(cMinY, c.sy - c.h * 0.5);
        cMaxY = Math.max(cMaxY, c.sy + c.h * 0.5);
      }
    }
    const ax = (cMinX + cMaxX) * 0.5, ay = (cMinY + cMaxY) * 0.5;
    const cands: Array<[number, number, boolean]> = [
      [cMaxX + 25, ay - 3, true], [cMinX - 25, ay - 3, true],
      [cMaxX + 24, ay - 20, true], [cMinX - 24, ay - 20, true],
      [cMaxX + 24, ay + 16, true], [cMinX - 24, ay + 16, true],
      [cMaxX + 35, ay - 3, true], [cMinX - 35, ay - 3, true],
      [ax, cMinY - 31, false], [ax, cMaxY + 25, false],
    ];
    for (const rad of [62, 78]) {
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        cands.push([ax + Math.cos(a) * rad, ay + Math.sin(a) * rad, false]);
      }
    }
    let bestX = cMaxX + 25, bestY = ay - 3, bestCost = Infinity;
    for (const [x, y, isSide] of cands) {
      const box: ScreenBox = [x - 19, y - 19, x + 19, y + 27];
      let cost = Math.hypot(x - px, y - py) * 1.15 + (isSide ? -14 : 0);
      if (box[0] < 20 || box[2] > vw - 20 || box[1] < 76 || box[3] > vh - 86) cost += 24000;
      if (box[0] < 550 && box[1] < 76) cost += 24000;
      if (box[2] > vw - 430 && box[1] < 146) cost += 24000;
      for (const cb of this.avoidCounters) {
        const area = overlapArea(box, cb, 4);
        if (area > 0) cost += 100000 + area * 120;
      }
      for (const sb of placedSeals) {
        const area = overlapArea(box, sb, 5);
        if (area > 0) cost += 80000 + area * 120;
      }
      for (const lb of this.avoidLabels) {
        const area = overlapArea(box, lb, 2);
        if (area > 0) cost += 4500 + area * 12;
      }
      if (cost < bestCost) { bestCost = cost; bestX = x; bestY = y; }
    }
    return [Math.round(bestX), Math.round(bestY)];
  }

  private rebuild(): void {
    this.tetherG.clear();
    this.sealGroup.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.hitBoxes = [];
    if (!this.root.visible || this.battles.length === 0) return;

    const { vw, vh } = this.cam;
    const placedBoxes: ScreenBox[] = [];
    const sorted = [...this.battles].sort((a, b) => a.provinceId - b.provinceId);

    for (const battle of sorted) {
      const p = this.provById.get(battle.provinceId);
      if (!p) continue;
      const [px, py] = this.toScreen(p.cx, p.cy);
      if (px < -60 || px > vw + 60 || py < -60 || py > vh + 60) continue;

      const [cx, cy] = this.pickSidePosition(battle.provinceId, px, py, placedBoxes);
      this.hitBoxes.push({ battle, sx: cx, sy: cy, r: SEAL_R });
      placedBoxes.push([cx - 19, cy - 19, cx + 19, cy + 27]);

      if (Math.hypot(cx - px, cy - py) > 18) {
        const dx = px - cx, dy = py - cy;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len, uy = dy / len;
        // Draw subtle leader tick from seal rim toward province without ever crossing inside a counter
        const insideCounter = (x: number, y: number) =>
          this.avoidCounters.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
        let tipD = len;
        while (tipD > SEAL_R + 3 && insideCounter(cx + ux * tipD, cy + uy * tipD)) tipD -= 3;
        if (tipD > SEAL_R + 4) {
          this.tetherG.moveTo(cx + ux * (SEAL_R - 1), cy + uy * (SEAL_R - 1))
            .lineTo(cx + ux * tipD, cy + uy * tipD)
            .stroke({ width: 1.35, color: 0x1d1510, alpha: 0.65 });
          this.tetherG.circle(cx + ux * tipD, cy + uy * tipD, 2.3).fill(0xa92f25).stroke({ width: 0.85, color: 0x1a130e });
        }
      }

      const rel = battle.defenderTag === this.playerTag ? -battle.advantageScore : battle.advantageScore;
      const pillFill = rel >= 12 ? 0x255b36 : rel <= -12 ? 0x7c2019 : 0x6f501b;
      const pillEdge = rel >= 12 ? 0x82d694 : rel <= -12 ? 0xf27d6e : 0xebd078;
      const selected = this.selectedProvId === battle.provinceId;

      const cont = new Container();
      const g = new Graphics();
      g.poly(octPoints(SEAL_R + 0.8, 1.6, 2.6)).fill({ color: 0x0e0a08, alpha: 0.54 });
      if (selected) g.poly(octPoints(SEAL_R + 4.0)).stroke({ width: 2.6, color: 0xf2cb6c, alpha: 0.98, join: 'round' });
      g.poly(octPoints(SEAL_R)).fill(0xa92f25).stroke({ width: 1.6, color: 0x19120e, join: 'round' });
      g.poly(octPoints(SEAL_R - 2.4)).stroke({ width: 0.95, color: 0xe8cd96, alpha: 0.78, join: 'round' });
      g.poly(octPoints(SEAL_R - 3.7)).fill(0x221914).stroke({ width: 0.9, color: 0x120d0a, join: 'round' });
      g.poly([0, -SEAL_R + 0.6, 3.2, -SEAL_R + 4.0, -3.2, -SEAL_R + 4.0]).fill(pillEdge);

      const rifles = new Graphics().svg(CROSSED_BAYONET_RIFLES_SVG);
      rifles.scale.set(RIFLE_SCALE);
      rifles.position.set(-BATTLE_SEAL_SVG_SIZE * RIFLE_SCALE * 0.5, -BATTLE_SEAL_SVG_SIZE * RIFLE_SCALE * 0.5);

      const scoreText = battle.advantageScore >= 0 ? `+${battle.advantageScore}` : `${battle.advantageScore}`;
      g.roundRect(-17.5, 13.8, 35, 13.2, 3.6).fill({ color: 0x0e0a08, alpha: 0.45 });
      g.roundRect(-18, 12.6, 36, 13.5, 3.6).fill(pillFill).stroke({ width: 1.25, color: pillEdge });
      const txt = new Text({ text: scoreText, style: SCORE_STYLE });
      txt.resolution = 2;
      txt.anchor.set(0.5, 0.5);
      txt.position.set(0, 19.4);

      cont.addChild(g, rifles, txt);
      cont.position.set(cx, cy);
      this.sealGroup.addChild(cont);
    }
  }
}
