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

export interface ViewportRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  vw: number;
  vh: number;
}

interface CountryLabelItem {
  curve: CountryLabelCurve;
  bezier: QuadBezier;
  lens: number[];
  totalLen: number;
  fontSize: number;
  desiredStep: number;
  container: Container;
  glyphs: Text[];
  minZoom: number;
  maxZoom: number;
}

interface CityLabelItem {
  prov: ProvinceRecord;
  marker: Graphics;
  label: Text;
  markerMinZoom: number;
  labelMinZoom: number;
  tier: 1 | 2 | 3;
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
  private lastPlacedBoxes: Array<[number, number, number, number]> = [];

  getPlacedScreenBoxes(): ReadonlyArray<[number, number, number, number]> {
    return this.lastPlacedBoxes;
  }

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
      const glyphs: Text[] = [];

      for (let i = 0; i < n; i++) {
        const dist = n === 1 ? totalLen * 0.5 : startDist + i * desiredStep;
        const t = tAtDist(lens, dist);
        const pos = evalBezier(b, t);
        const glyph = new Text({ text: chars[i]!, style });
        glyph.anchor.set(0.5, 0.5);
        glyph.position.set(pos.x, pos.y);
        glyph.rotation = Math.max(-0.52, Math.min(0.52, pos.angle * 0.72));
        container.addChild(glyph);
        glyphs.push(glyph);
      }

      const minZoom = c.areaPx < 6000 ? 0.92 : c.areaPx < 14000 ? 0.58 : 0.35;
      const maxZoom = c.areaPx < 18000 ? 2.6 : 3.5;
      this.countryGroup.addChild(container);
      this.countryItems.push({
        curve: c,
        bezier: b,
        lens,
        totalLen,
        fontSize,
        desiredStep,
        container,
        glyphs,
        minZoom,
        maxZoom,
      });
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
        } else if (p.vp >= 14) {
          marker.circle(p.cx, p.cy, 3.25);
          marker.fill({ color: 0xf4efe6 }).stroke({ width: 1.15, color: 0x1e1a17 });
          marker.circle(p.cx, p.cy, 1.05);
          marker.fill({ color: 0x26201a });
        } else {
          marker.circle(p.cx, p.cy, 2.5);
          marker.fill({ color: 0xf2ece1 }).stroke({ width: 1.05, color: 0x221d18 });
        }
        this.cityMarkerGroup.addChild(marker);

        const textStr = p.cityZh ?? p.nameZh;
        const label = new Text({ text: textStr, style: p.isCapital ? capStyle : cityStyle });
        label.anchor.set(0.5, 0.5);
        this.cityLabelGroup.addChild(label);

        const markerMinZoom = p.isCapital && p.vp >= 15 ? 0.88 : p.isCapital ? 1.08 : p.vp >= 14 ? 1.16 : 1.44;
        const labelMinZoom = p.isCapital && p.vp >= 15 ? 0.90 : p.isCapital ? 1.12 : p.vp >= 14 ? 1.22 : 1.52;
        this.cityItems.push({
          prov: p,
          marker,
          label,
          markerMinZoom,
          labelMinZoom,
          tier: p.isCapital ? 1 : 2,
          priority: (p.isCapital ? 120 : 20) + p.vp,
          baseWidth: textStr.length * 13 + 10,
          baseHeight: 17,
        });
      } else if (p.cityZh && !p.hideMapLabel) {
        // Tier 3 secondary historical town: refined small engraved dot + existing city name at tactical zoom
        const marker = new Graphics();
        marker.circle(p.cx, p.cy, 1.85);
        marker.fill({ color: 0xebe2d0 }).stroke({ width: 0.95, color: 0x28211b });
        this.cityMarkerGroup.addChild(marker);

        const textStr = p.cityZh;
        const label = new Text({ text: textStr, style: provStyle });
        label.anchor.set(0.5, 0.5);
        this.cityLabelGroup.addChild(label);

        this.cityItems.push({
          prov: p,
          marker,
          label,
          markerMinZoom: 1.62,
          labelMinZoom: 2.15,
          tier: 3,
          priority: p.vp,
          baseWidth: textStr.length * 11 + 8,
          baseHeight: 15,
        });
      } else if (!p.hideMapLabel) {
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

  updateLod(zoom: number, view?: ViewportRect): void {
    const invScale = 1 / Math.max(0.45, zoom);
    const placed: Array<[number, number, number, number]> = [];
    const vw = view?.vw ?? 1440;
    const vh = view?.vh ?? 900;
    const toScreenX = (wx: number) => (view ? (wx - view.minX) * zoom : wx * zoom);
    const toScreenY = (wy: number) => (view ? (wy - view.minY) * zoom : wy * zoom);

    const overlaps = (x0: number, y0: number, x1: number, y1: number): boolean => {
      for (const [ax0, ay0, ax1, ay1] of placed) {
        if (x0 < ax1 && x1 > ax0 && y0 < ay1 && y1 > ay0) return true;
      }
      return false;
    };

    const inViewportSafe = (x0: number, y0: number, x1: number, y1: number, pad = 12): boolean => {
      if (!view) return true;
      if (x0 < pad || y0 < pad || x1 > vw - pad || y1 > vh - pad) return false;
      // Avoid clipping under top-left title cartouche or top-right legend bar
      if (x0 < 388 && y0 < 70) return false;
      if (x1 > vw - 350 && y0 < 66) return false;
      // Avoid bottom-center mode dock
      if (x1 > vw * 0.5 - 220 && x0 < vw * 0.5 + 220 && y1 > vh - 58) return false;
      return true;
    };

    const tryPlace = (sx: number, sy: number, sw: number, sh: number): boolean => {
      const x0 = sx - sw * 0.5;
      const y0 = sy - sh * 0.5;
      const x1 = sx + sw * 0.5;
      const y1 = sy + sh * 0.5;
      if (!inViewportSafe(x0, y0, x1, y1, 10)) return false;
      if (overlaps(x0, y0, x1, y1)) return false;
      placed.push([x0, y0, x1, y1]);
      return true;
    };

    // 1. Country curved labels: entire name must fit cleanly inside viewport (or re-layout on visible sub-span)
    for (const item of this.countryItems) {
      if (zoom < item.minZoom || zoom >= item.maxZoom) {
        item.container.visible = false;
        continue;
      }
      const n = item.glyphs.length;
      const halfPx = item.fontSize * 0.58 * zoom;

      const placeAlongSpan = (
        d0: number,
        d1: number,
        isSubSpan: boolean,
      ): Array<{ wx: number; wy: number; angle: number; box: [number, number, number, number] }> | null => {
        const span = d1 - d0;
        const step = n <= 1 ? 0 : Math.min(item.desiredStep, span / Math.max(n - 1, 1));
        if (isSubSpan && n > 1 && step < item.fontSize * 0.92) return null;
        const used = step * (n - 1);
        const start = d0 + (span - used) * 0.5;
        const out: Array<{ wx: number; wy: number; angle: number; box: [number, number, number, number] }> = [];
        for (let i = 0; i < n; i++) {
          const dist = n === 1 ? (d0 + d1) * 0.5 : start + i * step;
          const pos = evalBezier(item.bezier, tAtDist(item.lens, dist));
          const sx = toScreenX(pos.x);
          const sy = toScreenY(pos.y);
          const box: [number, number, number, number] = [sx - halfPx - 3, sy - halfPx - 3, sx + halfPx + 3, sy + halfPx + 3];
          if (!inViewportSafe(box[0], box[1], box[2], box[3], 14)) return null;
          out.push({ wx: pos.x, wy: pos.y, angle: pos.angle, box });
        }
        return out;
      };

      // Try canonical full-curve placement first
      let layout = placeAlongSpan(0, item.totalLen, false);
      // If partially outside viewport, try longest contiguous visible segment of the curve
      if (!layout && view) {
        const samples = 28;
        let bestA = 0;
        let bestB = 0;
        let curA = -1;
        for (let s = 0; s <= samples; s++) {
          const dist = (item.totalLen * s) / samples;
          const pos = evalBezier(item.bezier, tAtDist(item.lens, dist));
          const sx = toScreenX(pos.x);
          const sy = toScreenY(pos.y);
          const ok = inViewportSafe(sx - halfPx - 3, sy - halfPx - 3, sx + halfPx + 3, sy + halfPx + 3, 14);
          if (ok && curA < 0) curA = dist;
          if (!ok && curA >= 0) {
            const prevD = (item.totalLen * (s - 1)) / samples;
            if (prevD - curA > bestB - bestA) {
              bestA = curA;
              bestB = prevD;
            }
            curA = -1;
          }
        }
        if (curA >= 0 && item.totalLen - curA > bestB - bestA) {
          bestA = curA;
          bestB = item.totalLen;
        }
        if (bestB - bestA > item.fontSize * Math.max(n - 1, 1) * 0.96) {
          layout = placeAlongSpan(bestA, bestB, true);
        }
      }

      if (!layout || layout.some((g) => overlaps(g.box[0], g.box[1], g.box[2], g.box[3]))) {
        item.container.visible = false;
        continue;
      }

      for (let i = 0; i < n; i++) {
        const g = item.glyphs[i]!;
        const p = layout[i]!;
        g.position.set(p.wx, p.wy);
        g.rotation = Math.max(-0.52, Math.min(0.52, p.angle * 0.72));
      }

      item.container.visible = true;
      const alpha = zoom < 2.15 ? 0.94 : Math.max(0.26, 0.94 - ((zoom - 2.15) / 1.35) * 0.68);
      item.container.alpha = alpha;
      if (alpha > 0.45) {
        for (const p of layout) placed.push(p.box);
      }
    }

    // 2. City & town markers + smart 4-offset collision-free labels
    const markerScale = Math.max(0.32, Math.min(1.1, invScale * 0.95));
    const labelScale = Math.max(0.28, Math.min(1.1, invScale * 0.96));
    const placedDots: Array<[number, number]> = [];

    for (const item of this.cityItems) {
      if (zoom < item.markerMinZoom) {
        item.marker.visible = false;
        item.label.visible = false;
        continue;
      }

      const cx = toScreenX(item.prov.cx);
      const cy = toScreenY(item.prov.cy);
      if (view && (cx < -30 || cx > vw + 30 || cy < -30 || cy > vh + 30)) {
        item.marker.visible = false;
        item.label.visible = false;
        continue;
      }

      const dotClear =
        item.tier === 1 || !placedDots.some(([dx, dy]) => Math.hypot(cx - dx, cy - dy) < (item.tier === 2 ? 11 : 16));
      const dotInSafe = inViewportSafe(cx - 8, cy - 8, cx + 8, cy + 8, 6);

      const yOff = item.tier === 3 ? 11 : 14;
      const xOff = item.baseWidth * 0.5 + (item.tier === 3 ? 6 : 8);
      const offsets: Array<[number, number]> = [
        [0, yOff],
        [0, -yOff],
        [xOff, 0],
        [-xOff, 0],
      ];

      let placedPos: [number, number] | null = null;
      if (zoom >= item.labelMinZoom) {
        for (const [ox, oy] of offsets) {
          if (tryPlace(cx + ox, cy + oy, item.baseWidth, item.baseHeight)) {
            placedPos = [ox, oy];
            break;
          }
        }
      }

      const showMarker = dotInSafe && (placedPos !== null || (dotClear && (item.tier <= 2 || zoom >= 1.75)));
      if (showMarker) {
        placedDots.push([cx, cy]);
        item.marker.visible = true;
        item.marker.position.set(
          item.prov.cx * (1 - markerScale),
          item.prov.cy * (1 - markerScale),
        );
        item.marker.scale.set(markerScale);
        item.marker.alpha =
          item.tier === 3 ? Math.min(0.86, 0.45 + (zoom - item.markerMinZoom) * 0.55) : 0.96;
      } else {
        item.marker.visible = false;
      }

      if (placedPos && showMarker) {
        item.label.visible = true;
        item.label.scale.set(labelScale);
        item.label.position.set(
          item.prov.cx + placedPos[0] / zoom,
          item.prov.cy + placedPos[1] / zoom,
        );
        item.label.alpha =
          item.tier === 3 ? Math.min(0.88, 0.48 + (zoom - item.labelMinZoom) * 0.65) : 0.96;
      } else {
        item.label.visible = false;
      }
    }

    // 3. Province names at tactical/inspection zoom (LOD 2.2+) with strict viewport containment & zero-overlap
    const showProvs = zoom >= 2.2;
    this.provLabelGroup.visible = showProvs;
    if (showProvs) {
      for (const pl of this.provLabels) {
        const sx = toScreenX(pl.prov.cx);
        const sy = toScreenY(pl.prov.cy);
        if (tryPlace(sx, sy, pl.w, pl.h)) {
          pl.label.visible = true;
          pl.label.scale.set(labelScale);
          pl.label.alpha = Math.min(0.88, 0.44 + (zoom - 2.2) * 0.65);
        } else {
          pl.label.visible = false;
        }
      }
    }
    this.lastPlacedBoxes = placed;
  }
}
