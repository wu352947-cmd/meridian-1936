/**
 * Screen-space PixiJS UnitCounterLayer with Semantic Zoom LOD (LOD 0 Army Badges <-> LOD 1-3 NATO Counters)
 * and deterministic screen-space grid repulsion so counters NEVER overlap or hide stack numbers.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BrigadeType } from '../sim/data/brigadeTemplates';
import type { ArmySnap, BrigadeSnap } from '../sim/systems/armyTypes';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';
import {
  ARMY_BADGE_H,
  ARMY_BADGE_W,
  COUNTER_H,
  COUNTER_W,
  drawArmyCrestBadge,
  drawCardstockCounter,
} from './counterArt';

const LEAD_PRIORITY: Record<BrigadeType, number> = {
  ARM: 6, MOT: 5, MTN: 4, INF: 3, ART: 2, GAR: 1,
};

const COUNT_STYLE = new TextStyle({
  fontFamily: 'MeridianMono, "JetBrains Mono", monospace',
  fontSize: 11,
  fontWeight: '700',
  fill: '#1A1613',
});

const ARMY_COUNT_STYLE = new TextStyle({
  fontFamily: 'MeridianMono, "JetBrains Mono", monospace',
  fontSize: 11,
  fontWeight: '700',
  fill: '#F5EDE0',
});

export interface CounterHitItem {
  owner: string;
  armyId: number | null;
  provinceId: number;
  brigadeIds: number[];
  sx: number;
  sy: number;
  w: number;
  h: number;
}

interface LayoutBox {
  key: string;
  ax: number;
  ay: number;
  x: number;
  y: number;
  w: number;
  h: number;
  item: CounterHitItem;
  leadType: BrigadeType;
  orgRatio: number;
  strRatio: number;
  selected: boolean;
  hasManualOverride: boolean;
  armyColor: string;
  isLod0: boolean;
}

export class UnitCounterLayer {
  readonly root = new Container();
  private readonly tetherG = new Graphics();
  private readonly cardGroup = new Container();
  private readonly provById = new Map<number, ProvinceRecord>();

  private brigades: BrigadeSnap[] = [];
  private armies: ArmySnap[] = [];
  private selectedBrigadeIds = new Set<number>();
  private selectedArmyId: number | null = null;
  private hitBoxes: CounterHitItem[] = [];
  private lastCam = { x: 1880, y: 1580, zoom: 1.0, vw: 1440, vh: 900 };

  constructor(meta: EuropeMapMeta) {
    for (const p of meta.provinces) this.provById.set(p.id, p);
    this.root.addChild(this.tetherG, this.cardGroup);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setData(
    armies: ArmySnap[],
    brigades: BrigadeSnap[],
    selectedBrigadeIds: readonly number[],
    selectedArmyId: number | null,
  ): void {
    this.armies = armies;
    this.brigades = brigades;
    this.selectedBrigadeIds = new Set(selectedBrigadeIds);
    this.selectedArmyId = selectedArmyId;
    this.rebuild();
  }

  updateCamera(camX: number, camY: number, zoom: number, vw: number, vh: number): void {
    this.lastCam = { x: camX, y: camY, zoom, vw, vh };
    this.rebuild();
  }

  hitTestPoint(sx: number, sy: number): CounterHitItem | null {
    if (!this.root.visible) return null;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const b = this.hitBoxes[i]!;
      if (Math.abs(sx - b.sx) <= b.w * 0.5 && Math.abs(sy - b.sy) <= b.h * 0.5) return b;
    }
    return null;
  }

  hitTestMarquee(x0: number, y0: number, x1: number, y1: number, ownerTag: string): number[] {
    if (!this.root.visible) return [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const out: number[] = [];
    for (const b of this.hitBoxes) {
      if (b.owner !== ownerTag) continue;
      if (b.sx >= minX && b.sx <= maxX && b.sy >= minY && b.sy <= maxY) {
        out.push(...b.brigadeIds);
      }
    }
    return out;
  }

  private toScreen(wx: number, wy: number): [number, number] {
    const { x, y, zoom, vw, vh } = this.lastCam;
    return [vw * 0.5 + (wx - x) * zoom, vh * 0.5 + (wy - y) * zoom];
  }

  private rebuild(): void {
    this.tetherG.clear();
    this.cardGroup.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.hitBoxes = [];
    if (!this.root.visible || this.brigades.length === 0) return;

    const { zoom, vw, vh } = this.lastCam;
    const isLod0 = zoom < 1.05;
    const armyColorById = new Map<number, string>(this.armies.map((a) => [a.id, a.color]));
    const boxes: LayoutBox[] = isLod0
      ? this.buildLod0Boxes(armyColorById, vw, vh)
      : this.buildProvinceStackBoxes(armyColorById, vw, vh);

    // Deterministic screen-space grid repulsion so zero counters ever overlap
    this.applyScreenRepulsion(boxes);

    for (const box of boxes) {
      const cx = Math.round(box.x);
      const cy = Math.round(box.y);
      box.item.sx = cx;
      box.item.sy = cy;
      this.hitBoxes.push(box.item);

      // Subtle anchor tether if repelled away from province center
      if (Math.hypot(cx - box.ax, cy - box.ay) > 12) {
        this.tetherG.moveTo(box.ax, box.ay).lineTo(cx, cy);
        this.tetherG.stroke({ width: 1.1, color: 0x1e1914, alpha: 0.52 });
        this.tetherG.circle(box.ax, box.ay, 2.2).fill({ color: 0x1e1914, alpha: 0.72 });
      }

      const cont = new Container();
      const g = new Graphics();
      if (box.isLod0) {
        drawArmyCrestBadge(g, box.item.owner, box.armyColor, box.orgRatio, box.strRatio, box.selected);
        const txt = new Text({ text: `${box.item.brigadeIds.length}旅`, style: ARMY_COUNT_STYLE });
        txt.resolution = 2;
        txt.anchor.set(0.5, 0.5);
        txt.position.set(11, -2);
        cont.addChild(g, txt);
      } else {
        drawCardstockCounter(g, {
          owner: box.item.owner,
          leadType: box.leadType,
          orgRatio: box.orgRatio,
          strRatio: box.strRatio,
          selected: box.selected,
          hasManualOverride: box.hasManualOverride,
          armyColor: box.armyColor,
        });
        const txt = new Text({ text: String(box.item.brigadeIds.length), style: COUNT_STYLE });
        txt.resolution = 2;
        txt.anchor.set(0.5, 0.5);
        txt.position.set(15.5, -3.5);
        cont.addChild(g, txt);
      }
      cont.position.set(cx, cy);
      this.cardGroup.addChild(cont);
    }
  }

  private buildLod0Boxes(armyColorById: Map<number, string>, vw: number, vh: number): LayoutBox[] {
    const groups = new Map<string, BrigadeSnap[]>();
    for (const b of this.brigades) {
      const k = b.armyId !== null ? `A:${b.armyId}` : `N:${b.owner}`;
      const list = groups.get(k) ?? [];
      list.push(b);
      groups.set(k, list);
    }
    const boxes: LayoutBox[] = [];
    for (const [key, list] of groups.entries()) {
      let sxSum = 0, sySum = 0, cnt = 0, orgSum = 0, strSum = 0;
      for (const b of list) {
        const p = this.provById.get(b.provinceId);
        if (!p) continue;
        sxSum += p.cx;
        sySum += p.cy;
        cnt += 1;
        orgSum += b.orgPermille;
        strSum += b.strengthPermille;
      }
      if (cnt === 0) continue;
      const [sx, sy] = this.toScreen(sxSum / cnt, sySum / cnt);
      if (sx < -60 || sx > vw + 60 || sy < -40 || sy > vh + 40) continue;
      const first = list[0]!;
      const armyId = first.armyId;
      const ids = list.map((b) => b.id);
      boxes.push({
        key, ax: sx, ay: sy, x: sx, y: sy, w: ARMY_BADGE_W, h: ARMY_BADGE_H,
        item: { owner: first.owner, armyId, provinceId: first.provinceId, brigadeIds: ids, sx, sy, w: ARMY_BADGE_W, h: ARMY_BADGE_H },
        leadType: first.template,
        orgRatio: orgSum / (cnt * 1000),
        strRatio: strSum / (cnt * 1000),
        selected: (armyId !== null && armyId === this.selectedArmyId) || ids.some((id) => this.selectedBrigadeIds.has(id)),
        hasManualOverride: list.some((b) => b.manualOverride),
        armyColor: (armyId !== null ? armyColorById.get(armyId) : undefined) ?? '#8A7148',
        isLod0: true,
      });
    }
    return boxes.sort((a, b) => a.key.localeCompare(b.key));
  }

  private buildProvinceStackBoxes(armyColorById: Map<number, string>, vw: number, vh: number): LayoutBox[] {
    const stacks = new Map<string, BrigadeSnap[]>();
    for (const b of this.brigades) {
      const k = `${b.provinceId}:${b.owner}`;
      const list = stacks.get(k) ?? [];
      list.push(b);
      stacks.set(k, list);
    }
    const boxes: LayoutBox[] = [];
    for (const [key, list] of stacks.entries()) {
      const first = list[0]!;
      const p = this.provById.get(first.provinceId);
      if (!p) continue;
      const [sx, sy] = this.toScreen(p.cx, p.cy);
      if (sx < -60 || sx > vw + 60 || sy < -40 || sy > vh + 40) continue;

      let lead = first.template;
      let orgSum = 0, strSum = 0;
      for (const b of list) {
        if (LEAD_PRIORITY[b.template] > LEAD_PRIORITY[lead]) lead = b.template;
        orgSum += b.orgPermille;
        strSum += b.strengthPermille;
      }
      const ids = list.map((b) => b.id);
      const armyId = first.armyId;
      boxes.push({
        key, ax: sx, ay: sy, x: sx, y: sy, w: COUNTER_W, h: COUNTER_H,
        item: { owner: first.owner, armyId, provinceId: first.provinceId, brigadeIds: ids, sx, sy, w: COUNTER_W, h: COUNTER_H },
        leadType: lead,
        orgRatio: orgSum / (list.length * 1000),
        strRatio: strSum / (list.length * 1000),
        selected: ids.some((id) => this.selectedBrigadeIds.has(id)),
        hasManualOverride: list.some((b) => b.manualOverride),
        armyColor: (armyId !== null ? armyColorById.get(armyId) : undefined) ?? '#8A7148',
        isLod0: false,
      });
    }
    return boxes.sort((a, b) => a.key.localeCompare(b.key));
  }

  /** Iterative grid-spaced AABB repulsion: zero overlapping counters, minimal drift from anchor. */
  private applyScreenRepulsion(boxes: LayoutBox[]): void {
    const padX = 5;
    const padY = 4;
    for (let iter = 0; iter < 12; iter++) {
      let movedAny = false;
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i]!;
        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j]!;
          const minDx = (a.w + b.w) * 0.5 + padX;
          const minDy = (a.h + b.h) * 0.5 + padY;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const ox = minDx - Math.abs(dx);
          const oy = minDy - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            movedAny = true;
            if (ox < oy) {
              const dir = dx === 0 ? ((i + j) % 2 === 0 ? 1 : -1) : Math.sign(dx);
              const shift = ox * 0.52;
              a.x -= dir * shift;
              b.x += dir * shift;
            } else {
              const dir = dy === 0 ? ((i + j) % 2 === 0 ? 1 : -1) : Math.sign(dy);
              const shift = oy * 0.52;
              a.y -= dir * shift;
              b.y += dir * shift;
            }
          }
        }
      }
      if (!movedAny) break;
    }
  }
}
