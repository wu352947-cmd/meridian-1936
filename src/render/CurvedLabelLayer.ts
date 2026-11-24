import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { CountryLabelCurve, EuropeMapMeta, ProvinceRecord } from '../types/map';

interface QuadBezier {
  p0: [number, number];
  p1: [number, number];
  p2: [number, number];
}

function evalBezier(b: QuadBezier, t: number): { x: number; y: number; angle: number } {
  const mt = 1 - t;
  const x = mt * mt * b.p0[0] + 2 * mt * t * b.p1[0] + t * t * b.p2[0];
  const y = mt * mt * b.p0[1] + 2 * mt * t * b.p1[1] + t * t * b.p2[1];
  const dx = 2 * mt * (b.p1[0] - b.p0[0]) + 2 * t * (b.p2[0] - b.p1[0]);
  const dy = 2 * mt * (b.p1[1] - b.p0[1]) + 2 * t * (b.p2[1] - b.p1[1]);
  return { x, y, angle: Math.atan2(dy, dx) };
}

function sampleArcLengths(b: QuadBezier, steps = 40): number[] {
  const lens = [0];
  let prev = evalBezier(b, 0);
  for (let i = 1; i <= steps; i++) {
    const cur = evalBezier(b, i / steps);
    lens.push(lens[i - 1]! + Math.hypot(cur.x - prev.x, cur.y - prev.y));
    prev = cur;
  }
  return lens;
}

function tAtDist(lens: number[], target: number): number {
  const total = lens[lens.length - 1] ?? 1;
  if (target <= 0) return 0;
  if (target >= total) return 1;
  let lo = 0;
  let hi = lens.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if ((lens[mid] ?? 0) < target) lo = mid;
    else hi = mid;
  }
  const a = lens[lo] ?? 0;
  const b = lens[hi] ?? a + 1;
  const frac = (target - a) / Math.max(0.0001, b - a);
  return (lo + frac) / (lens.length - 1);
}

interface CountryLabelItem {
  curve: CountryLabelCurve;
  container: Container;
  glyphBoxes: Array<{ wx: number; wy: number; half: number }>;
  minZoom: number;
  maxZoom: number;
}

interface CityLabelItem {
  prov: ProvinceRecord;
  marker: Graphics;
  label: Text;
  minZoom: number;
  priority: number;
  baseWidth: number;
  baseHeight: number;
}

export class CurvedLabelLayer {
  readonly root = new Container();
  private readonly countryGroup = new Container();
  private readonly cityMarkerGroup = new Container();
  private readonly cityLabelGroup = new Container();
  private readonly provLabelGroup = new Container();

  private readonly countryItems: CountryLabelItem[] = [];
  private readonly cityItems: CityLabelItem[] = [];
  private readonly provLabels: Array<{ prov: ProvinceRecord; label: Text; w: number; h: number }> = [];

  constructor(meta: EuropeMapMeta) {
    this.root.addChild(this.countryGroup, this.cityMarkerGroup, this.cityLabelGroup, this.provLabelGroup);
    this.buildCountryLabels(meta.labelCurves);
    this.buildCityAndProvinceLabels(meta.provinces);
    this.updateLod(1.0);
  }

  private buildCountryLabels(curves: CountryLabelCurve[]): void {
    // Micro-states (single-province entities) use their crisp capital label instead of stacked country text
    const skipAsMicro = new Set(['DNZ', 'LUX']);

    for (const c of curves) {
      if (skipAsMicro.has(c.tag)) continue;

      const container = new Container();
      const chars = Array.from(c.nameZh);
      const b: QuadBezier = { p0: c.curve[0], p1: c.curve[1], p2: c.curve[2] };
      const lens = sampleArcLengths(b);
      const totalLen = lens[lens.length - 1] ?? 1;

      // Boost base world font size for majestic legibility at overview (0.42x) through campaign (2.0x)
      const boosted = Math.round(c.fontSize * 1.28);
      const fontSize = Math.max(18, Math.min(54, boosted));
      const style = new TextStyle({
        fontFamily: 'MeridianWenKai, "LXGW WenKai Screen", "Noto Serif CJK SC", serif',
        fontSize,
        fontWeight: '600',
        fill: '#F7F2E8',
        stroke: { color: '#1A1613', width: Math.max(3.2, fontSize * 0.14), join: 'round' },
        dropShadow: { color: '#100D0B', alpha: 0.48, blur: 4, distance: 1.5, angle: Math.PI / 4 },
      });

      const n = chars.length;
      const desiredStep = Math.min(fontSize * 1.48, (totalLen * 0.88) / Math.max(n, 1));
      const usedLen = desiredStep * (n - 1);
      const startDist = (totalLen - usedLen) * 0.5;
      const glyphBoxes: Array<{ wx: number; wy: number; half: number }> = [];

      for (let i = 0; i < n; i++) {
        const dist = n === 1 ? totalLen * 0.5 : startDist + i * desiredStep;
        const t = tAtDist(lens, dist);
        const pos = evalBezier(b, t);
        const glyph = new Text({ text: chars[i]!, style });
        glyph.anchor.set(0.5, 0.5);
        glyph.position.set(pos.x, pos.y);
        glyph.rotation = Math.max(-0.52, Math.min(0.52, pos.angle * 0.72));
        container.addChild(glyph);
        glyphBoxes.push({ wx: pos.x, wy: pos.y, half: fontSize * 0.62 });
      }

      const minZoom = c.areaPx < 6000 ? 0.92 : c.areaPx < 14000 ? 0.58 : 0.35;
      const maxZoom = c.areaPx < 18000 ? 2.6 : 3.5;
      this.countryGroup.addChild(container);
      this.countryItems.push({ curve: c, container, glyphBoxes, minZoom, maxZoom });
    }
  }

  private buildCityAndProvinceLabels(provinces: ProvinceRecord[]): void {
    const capStyle = new TextStyle({
      fontFamily: 'MeridianSans, "Noto Sans CJK SC", sans-serif',
      fontSize: 12.5,
      fontWeight: '600',
      fill: '#FAF5EB',
      stroke: { color: '#191512', width: 3.2, join: 'round' },
    });
    const cityStyle = new TextStyle({
      fontFamily: 'MeridianSans, "Noto Sans CJK SC", sans-serif',
      fontSize: 11.5,
      fontWeight: '500',
      fill: '#F0E9DC',
      stroke: { color: '#1D1916', width: 2.8, join: 'round' },
    });
    const provStyle = new TextStyle({
      fontFamily: 'MeridianSans, "Noto Sans CJK SC", sans-serif',
      fontSize: 10.5,
      fontWeight: '400',
      fill: '#EAE2D3',
      stroke: { color: '#241F1B', width: 2.4, join: 'round' },
    });

    const landProvs = provinces.filter((p) => !p.isSea);
    for (const p of landProvs) {
      if (p.isCapital || p.vp >= 8) {
        const marker = new Graphics();
        if (p.isCapital) {
          this.drawStar(marker, p.cx, p.cy, 5, 5.2, 2.3);
          marker.fill({ color: 0xe8c468 }).stroke({ width: 1.15, color: 0x1e1a17 });
        } else {
          marker.circle(p.cx, p.cy, p.vp >= 14 ? 3.2 : 2.5);
          marker.fill({ color: 0xf4efe6 }).stroke({ width: 1.1, color: 0x1e1a17 });
        }
        this.cityMarkerGroup.addChild(marker);

        const textStr = p.cityZh ?? p.nameZh;
        const label = new Text({ text: textStr, style: p.isCapital ? capStyle : cityStyle });
        label.anchor.set(0.5, 0.5);
        this.cityLabelGroup.addChild(label);

        const minZoom = p.isCapital && p.vp >= 15 ? 0.92 : p.isCapital ? 1.15 : p.vp >= 14 ? 1.45 : 2.0;
        this.cityItems.push({
          prov: p,
          marker,
          label,
          minZoom,
          priority: (p.isCapital ? 120 : 0) + p.vp,
          baseWidth: textStr.length * 13 + 10,
          baseHeight: 17,
        });
      } else {
        const label = new Text({ text: p.nameZh, style: provStyle });
        label.anchor.set(0.5, 0.5);
        label.position.set(p.cx, p.cy);
        this.provLabelGroup.addChild(label);
        this.provLabels.push({ prov: p, label, w: p.nameZh.length * 11 + 8, h: 15 });
      }
    }

    this.cityItems.sort((a, b) => b.priority - a.priority);
    this.provLabels.sort((a, b) => b.prov.areaPx - a.prov.areaPx);
  }

  private drawStar(g: Graphics, cx: number, cy: number, spikes: number, outerR: number, innerR: number): void {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    g.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    for (let i = 0; i < spikes; i++) {
      rot += step;
      g.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
      g.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    }
    g.closePath();
  }

  updateLod(zoom: number): void {
    const invScale = 1 / Math.max(0.45, zoom);
    const placed: Array<[number, number, number, number]> = [];

    const overlaps = (x0: number, y0: number, x1: number, y1: number): boolean => {
      for (const [ax0, ay0, ax1, ay1] of placed) {
        if (x0 < ax1 && x1 > ax0 && y0 < ay1 && y1 > ay0) return true;
      }
      return false;
    };

    const tryPlace = (sx: number, sy: number, sw: number, sh: number): boolean => {
      const x0 = sx - sw * 0.5;
      const y0 = sy - sh * 0.5;
      const x1 = sx + sw * 0.5;
      const y1 = sy + sh * 0.5;
      if (overlaps(x0, y0, x1, y1)) return false;
      placed.push([x0, y0, x1, y1]);
      return true;
    };

    // 1. Country curved labels first; register their screen-space glyph AABBs so cities NEVER collide!
    for (const item of this.countryItems) {
      if (zoom < item.minZoom || zoom >= item.maxZoom) {
        item.container.visible = false;
        continue;
      }
      // Check if any glyph of this lower-priority country overlaps an already placed bigger country
      const boxes: Array<[number, number, number, number]> = item.glyphBoxes.map((gb) => {
        const hs = gb.half * zoom + 3;
        return [gb.wx * zoom - hs, gb.wy * zoom - hs, gb.wx * zoom + hs, gb.wy * zoom + hs];
      });
      if (boxes.some(([x0, y0, x1, y1]) => overlaps(x0, y0, x1, y1))) {
        item.container.visible = false;
        continue;
      }
      item.container.visible = true;
      const alpha = zoom < 2.15 ? 0.94 : Math.max(0.26, 0.94 - ((zoom - 2.15) / 1.35) * 0.68);
      item.container.alpha = alpha;
      // Only block city/province labels when country text is clearly opaque (>0.45)
      if (alpha > 0.45) {
        for (const box of boxes) placed.push(box);
      }
    }

    // 2. City markers & smart 4-offset collision-free labels (never leave orphan dots without labels!)
    const markerScale = Math.max(0.32, Math.min(1.1, invScale * 0.95));
    const labelScale = Math.max(0.28, Math.min(1.1, invScale * 0.96));

    for (const item of this.cityItems) {
      if (zoom < item.minZoom) {
        item.marker.visible = false;
        item.label.visible = false;
        continue;
      }

      const cx = item.prov.cx * zoom;
      const cy = item.prov.cy * zoom;
      const offsets: Array<[number, number]> = [
        [0, 14],
        [0, -14],
        [item.baseWidth * 0.5 + 8, 0],
        [-(item.baseWidth * 0.5 + 8), 0],
      ];

      let placedPos: [number, number] | null = null;
      for (const [ox, oy] of offsets) {
        if (tryPlace(cx + ox, cy + oy, item.baseWidth, item.baseHeight)) {
          placedPos = [ox, oy];
          break;
        }
      }

      if (placedPos) {
        item.marker.visible = true;
        item.marker.position.set(
          item.prov.cx * (1 - markerScale),
          item.prov.cy * (1 - markerScale),
        );
        item.marker.scale.set(markerScale);

        item.label.visible = true;
        item.label.scale.set(labelScale);
        item.label.position.set(
          item.prov.cx + placedPos[0] / zoom,
          item.prov.cy + placedPos[1] / zoom,
        );
      } else {
        // Show capital star even if label is blocked, hide non-capital orphan dots
        item.marker.visible = Boolean(item.prov.isCapital);
        if (item.marker.visible) {
          item.marker.position.set(
            item.prov.cx * (1 - markerScale),
            item.prov.cy * (1 - markerScale),
          );
          item.marker.scale.set(markerScale);
        }
        item.label.visible = false;
      }
    }

    // 3. Province names at tactical/inspection zoom (LOD 2.3+) with strict zero-overlap
    const showProvs = zoom >= 2.3;
    this.provLabelGroup.visible = showProvs;
    if (showProvs) {
      for (const pl of this.provLabels) {
        const sx = pl.prov.cx * zoom;
        const sy = pl.prov.cy * zoom;
        if (tryPlace(sx, sy, pl.w, pl.h)) {
          pl.label.visible = true;
          pl.label.scale.set(labelScale);
          pl.label.alpha = Math.min(0.86, (zoom - 2.3) * 0.9);
        } else {
          pl.label.visible = false;
        }
      }
    }
  }
}
