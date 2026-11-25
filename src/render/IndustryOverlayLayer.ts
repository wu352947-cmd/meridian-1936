/**
 * World-space PixiJS overlay for M5 Industry Map Mode resource bubbles (钢/油/稀)
 * and active construction progress indicators on constructing regions.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { getRegionDef, REGIONS_1936 } from '../sim/data/regions1936';
import { BUILDING_SPECS, type RegionDynamicSnap } from '../sim/systems/industryTypes';
import type { MapMode } from '../types/map';
import type { ViewportRect } from './CurvedLabelLayer';

interface BubbleNode {
  regionId: number;
  cx: number;
  cy: number;
  priority: number;
  minZoom: number;
  width: number;
  height: number;
  container: Container;
}

const RES_COLORS = {
  steel: { bg: 0x354b5e, border: 0x8eb2ce, label: '钢' },
  oil:   { bg: 0x3a2a18, border: 0xdca03e, label: '油' },
  rare:  { bg: 0x4c344b, border: 0xc999c6, label: '稀' },
} as const;

const PILL_TEXT_STYLE = new TextStyle({
  fontFamily: 'MeridianSans, "Noto Sans CJK SC", sans-serif',
  fontSize: 10,
  fontWeight: '600',
  fill: '#F7F1E6',
});

const BUILD_TEXT_STYLE = new TextStyle({
  fontFamily: 'MeridianSans, "Noto Sans CJK SC", sans-serif',
  fontSize: 10,
  fontWeight: '600',
  fill: '#FFE8B3',
});

export class IndustryOverlayLayer {
  readonly root = new Container();
  private readonly resourceGroup = new Container();
  private readonly buildGroup = new Container();
  private resourceNodes: BubbleNode[] = [];
  private buildNodes: BubbleNode[] = [];
  private mapMode: MapMode = 'political';
  private lastZoom = 1;
  private lastView: ViewportRect | undefined;

  constructor() {
    this.root.addChild(this.resourceGroup, this.buildGroup);
    this.rebuildFromRegions(
      REGIONS_1936.map((r) => ({
        id: r.id, owner: r.owner, civ: r.civ, mil: r.mil, doc: r.doc, synth: 0,
        infra: r.infra, slots: r.slots, steel: r.steel, oil: r.oil, rare: r.rare,
        activeBuilding: null, activeProgressPermille: 0, queuedCount: 0,
      })),
    );
  }

  setMapMode(mode: MapMode): void {
    this.mapMode = mode;
    this.updateLod(this.lastZoom, this.lastView);
  }

  rebuildFromRegions(regions: readonly RegionDynamicSnap[]): void {
    this.resourceGroup.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.buildGroup.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.resourceNodes = [];
    this.buildNodes = [];

    for (const r of regions) {
      const def = getRegionDef(r.id);
      if (!def) continue;

      // 1. Resource pill cluster (for M5 industry lens)
      const items: Array<{ key: 'steel' | 'oil' | 'rare'; val: number }> = [];
      if (r.steel >= 8) items.push({ key: 'steel', val: r.steel });
      if (r.oil >= 4) items.push({ key: 'oil', val: r.oil });
      if (r.rare >= 4) items.push({ key: 'rare', val: r.rare });
      if (items.length > 0) {
        const cont = new Container();
        let xCursor = 0;
        const pills: Array<{ x: number; w: number; key: 'steel' | 'oil' | 'rare'; val: number }> = [];
        for (const it of items) {
          const w = it.val >= 10 ? 31 : 25;
          pills.push({ x: xCursor, w, key: it.key, val: it.val });
          xCursor += w + 3;
        }
        const totalW = xCursor - 3;
        const g = new Graphics();
        for (const p of pills) {
          const st = RES_COLORS[p.key];
          const px = p.x - totalW * 0.5;
          g.roundRect(px, -8.5, p.w, 17, 4);
          g.fill({ color: st.bg, alpha: 0.92 }).stroke({ width: 1.15, color: st.border });
          const txt = new Text({ text: `${st.label}${p.val}`, style: PILL_TEXT_STYLE });
          txt.anchor.set(0.5, 0.5);
          txt.position.set(px + p.w * 0.5, 0);
          cont.addChild(txt);
        }
        cont.addChildAt(g, 0);
        cont.position.set(def.cx, def.cy);
        this.resourceGroup.addChild(cont);

        const weight = r.steel + r.oil * 2.2 + r.rare * 1.6;
        this.resourceNodes.push({
          regionId: r.id, cx: def.cx, cy: def.cy,
          priority: weight, minZoom: weight >= 32 ? 0.45 : weight >= 16 ? 0.78 : 1.25,
          width: totalW + 6, height: 20, container: cont,
        });
      }

      // 2. Active construction progress badge (all modes)
      if (r.activeBuilding) {
        const pct = Math.round(r.activeProgressPermille / 10);
        const bShort = BUILDING_SPECS[r.activeBuilding].shortZh;
        const labelStr = `筑·${bShort} ${pct}%${r.queuedCount > 1 ? ` +${r.queuedCount - 1}` : ''}`;
        const w = Math.max(66, labelStr.length * 7.8 + 14);
        const cont = new Container();
        const g = new Graphics();
        g.roundRect(-w * 0.5, -13, w, 24, 4);
        g.fill({ color: 0x241d17, alpha: 0.94 }).stroke({ width: 1.3, color: 0xdca03e });
        g.roundRect(-w * 0.5 + 5, 5, w - 10, 3.5, 1.5);
        g.fill({ color: 0x45392c });
        const fillW = Math.max(2, ((w - 10) * Math.min(100, pct)) / 100);
        g.roundRect(-w * 0.5 + 5, 5, fillW, 3.5, 1.5);
        g.fill({ color: 0xe3ad4b });
        const txt = new Text({ text: labelStr, style: BUILD_TEXT_STYLE });
        txt.anchor.set(0.5, 0.5);
        txt.position.set(0, -3.5);
        cont.addChild(g, txt);
        cont.position.set(def.cx, def.cy);
        this.buildGroup.addChild(cont);
        this.buildNodes.push({
          regionId: r.id, cx: def.cx, cy: def.cy, priority: 1000 + pct,
          minZoom: 0.35, width: w + 6, height: 28, container: cont,
        });
      }
    }

    this.resourceNodes.sort((a, b) => b.priority - a.priority);
    this.updateLod(this.lastZoom, this.lastView);
  }

  updateLod(zoom: number, view?: ViewportRect): void {
    this.lastZoom = zoom;
    this.lastView = view;
    const invScale = 1 / Math.max(0.45, zoom);
    const scale = Math.max(0.28, Math.min(1.15, invScale * 0.96));
    const vw = view?.vw ?? 1440;
    const vh = view?.vh ?? 900;
    const toSx = (wx: number) => (view ? (wx - view.minX) * zoom : wx * zoom);
    const toSy = (wy: number) => (view ? (wy - view.minY) * zoom : wy * zoom);
    const placed: Array<[number, number, number, number]> = [];

    const canPlace = (sx: number, sy: number, w: number, h: number): boolean => {
      const x0 = sx - w * 0.5, y0 = sy - h * 0.5, x1 = sx + w * 0.5, y1 = sy + h * 0.5;
      if (view && (x0 < 12 || y0 < 68 || x1 > vw - 12 || y1 > vh - 66)) return false;
      for (const [ax0, ay0, ax1, ay1] of placed) {
        if (x0 < ax1 && x1 > ax0 && y0 < ay1 && y1 > ay0) return false;
      }
      placed.push([x0, y0, x1, y1]);
      return true;
    };

    // Always prioritize active construction badges (placed above resource pills if present)
    const hasResByRegion = new Set(this.resourceNodes.map((n) => n.regionId));
    for (const node of this.buildNodes) {
      const yOff = this.mapMode === 'industry' && hasResByRegion.has(node.regionId) ? -34 : -18;
      const sx = toSx(node.cx);
      const sy = toSy(node.cy) + yOff;
      if (canPlace(sx, sy, node.width, node.height)) {
        node.container.visible = true;
        node.container.scale.set(scale);
        node.container.position.set(node.cx, node.cy + yOff / zoom);
      } else {
        node.container.visible = false;
      }
    }

    const showRes = this.mapMode === 'industry';
    this.resourceGroup.visible = showRes;
    if (!showRes) return;

    for (const node of this.resourceNodes) {
      if (zoom < node.minZoom) {
        node.container.visible = false;
        continue;
      }
      // Place above city dot so city labels (which default below dot) remain unobstructed
      const sx = toSx(node.cx);
      const sy = toSy(node.cy) - 16;
      if (canPlace(sx, sy, node.width, node.height)) {
        node.container.visible = true;
        node.container.scale.set(scale);
        node.container.position.set(node.cx, node.cy - 16 / zoom);
      } else {
        node.container.visible = false;
      }
    }
  }
}
