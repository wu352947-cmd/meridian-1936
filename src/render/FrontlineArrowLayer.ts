/**
 * World-space PixiJS layer rendering continuous staff-style serrated frontlines,
 * smooth cubic Bezier offensive arrows with flowing diagonal stripes, and march paths.
 */
import { Container, Graphics } from 'pixi.js';
import type { ArmySnap, BrigadeSnap } from '../sim/systems/armyTypes';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';
import type { DecodedArc } from './BorderMeshBuilder';
import {
  buildOffsetFrontlineSamples,
  sampleCubicArrow,
  stitchFrontlineArcs,
  type BezierSample,
  type Pt,
} from './frontlineGeometry';

function hexToNum(hex: string): number {
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean, 16);
  return Number.isFinite(n) ? n : 0xc84b31;
}

export interface ArrowPreviewState {
  startProvId: number;
  targetProvId: number;
  color: string;
}

export class FrontlineArrowLayer {
  readonly root = new Container();
  private readonly marchG = new Graphics();
  private readonly frontG = new Graphics();
  private readonly arrowG = new Graphics();
  private readonly provById = new Map<number, ProvinceRecord>();
  private readonly arcs: readonly DecodedArc[];
  private readonly pickGrid: Uint16Array;
  private readonly pickW: number;
  private readonly pickH: number;

  private armies: ArmySnap[] = [];
  private brigades: BrigadeSnap[] = [];
  private selectedArmyId: number | null = null;
  private preview: ArrowPreviewState | null = null;
  private zoom = 1.0;
  private flowPhase = 0.25;

  constructor(
    meta: EuropeMapMeta,
    arcs: readonly DecodedArc[],
    pickGrid: Uint16Array,
    pickW: number,
    pickH: number,
  ) {
    this.arcs = arcs;
    this.pickGrid = pickGrid;
    this.pickW = pickW;
    this.pickH = pickH;
    for (const p of meta.provinces) this.provById.set(p.id, p);
    this.root.addChild(this.marchG, this.frontG, this.arrowG);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setData(armies: ArmySnap[], brigades: BrigadeSnap[], selectedArmyId: number | null): void {
    this.armies = armies;
    this.brigades = brigades;
    this.selectedArmyId = selectedArmyId;
    this.redraw();
  }

  setArrowPreview(preview: ArrowPreviewState | null): void {
    this.preview = preview;
    this.redrawArrows();
  }

  updateLod(zoom: number): void {
    if (Math.abs(zoom - this.zoom) < 0.02) return;
    this.zoom = zoom;
    this.redraw();
  }

  advanceFlow(dtSec: number): void {
    if (!this.root.visible) return;
    const hasArrow = this.preview !== null || this.armies.some((a) => a.arrow !== null);
    if (!hasArrow) return;
    this.flowPhase = (this.flowPhase + dtSec * 0.45) % 1;
    this.redrawArrows();
  }

  private sampleOwner = (wx: number, wy: number): string | null => {
    const gx = Math.floor(wx * 0.5);
    const gy = Math.floor(wy * 0.5);
    if (gx < 0 || gx >= this.pickW || gy < 0 || gy >= this.pickH) return null;
    const pid = this.pickGrid[gy * this.pickW + gx] ?? 0;
    return pid > 0 ? (this.provById.get(pid)?.owner ?? null) : null;
  };

  redraw(): void {
    this.redrawMarches();
    this.redrawFrontlines();
    this.redrawArrows();
  }

  private redrawMarches(): void {
    this.marchG.clear();
    if (this.zoom < 0.85) return;
    const inv = 1 / Math.max(0.85, Math.min(3.2, this.zoom));
    const drawnPairs = new Set<string>();
    for (const b of this.brigades) {
      if (b.movingToProvId === null) continue;
      const key = `${b.provinceId}->${b.movingToProvId}`;
      if (drawnPairs.has(key)) continue;
      drawnPairs.add(key);
      const p0 = this.provById.get(b.provinceId);
      const p1 = this.provById.get(b.movingToProvId);
      if (!p0 || !p1) continue;

      const dx = p1.cx - p0.cx;
      const dy = p1.cy - p0.cy;
      const len = Math.hypot(dx, dy);
      if (len < 4) continue;
      const ux = dx / len;
      const uy = dy / len;
      const s0x = p0.cx + ux * 8 * inv;
      const s0y = p0.cy + uy * 8 * inv;
      const e0x = p1.cx - ux * 10 * inv;
      const e0y = p1.cy - uy * 10 * inv;

      this.marchG.moveTo(s0x, s0y).lineTo(e0x, e0y);
      this.marchG.stroke({ width: 3.2 * inv, color: 0x1c1712, alpha: 0.45, cap: 'round' });
      this.marchG.moveTo(s0x, s0y).lineTo(e0x, e0y);
      this.marchG.stroke({ width: 1.7 * inv, color: b.manualOverride ? 0xebb952 : 0x76b874, alpha: 0.92, cap: 'round' });

      // Clean arrowhead tip
      const hs = 6.5 * inv;
      const nx = -uy;
      const ny = ux;
      this.marchG.poly([
        e0x + ux * hs * 0.5, e0y + uy * hs * 0.5,
        e0x - ux * hs + nx * hs * 0.65, e0y - uy * hs + ny * hs * 0.65,
        e0x - ux * hs - nx * hs * 0.65, e0y - uy * hs - ny * hs * 0.65,
      ]);
      this.marchG.fill({ color: b.manualOverride ? 0xebb952 : 0x76b874, alpha: 0.95 });
    }
  }

  private redrawFrontlines(): void {
    this.frontG.clear();
    const s = 1 / Math.pow(Math.max(0.65, this.zoom), 0.52);
    const offsetPx = 2.6 * s;
    const toothStep = 9.5 * s;
    const toothDepth = 4.6 * s;
    const baseW = 2.4 * s;

    for (const army of this.armies) {
      if (!army.frontline) continue;
      const color = hexToNum(army.color);
      const hi = army.id === this.selectedArmyId;
      const provSet = new Set(army.frontline.friendlyProvIds);
      const chains = stitchFrontlineArcs(
        this.arcs,
        army.owner,
        army.frontline.targetTag,
        provSet,
        this.sampleOwner,
      );

      for (const chain of chains) {
        const samples = buildOffsetFrontlineSamples(chain, offsetPx, Math.max(2.5, 4.0 * s));
        if (samples.length < 2) continue;

        // 1. Soft dark ink backing + continuous baseline
        this.frontG.moveTo(samples[0]!.x, samples[0]!.y);
        for (let i = 1; i < samples.length; i++) this.frontG.lineTo(samples[i]!.x, samples[i]!.y);
        this.frontG.stroke({ width: baseW + (hi ? 2.4 : 1.7) * s, color: 0x1b1612, alpha: hi ? 0.8 : 0.62, cap: 'round', join: 'round' });

        this.frontG.moveTo(samples[0]!.x, samples[0]!.y);
        for (let i = 1; i < samples.length; i++) this.frontG.lineTo(samples[i]!.x, samples[i]!.y);
        this.frontG.stroke({ width: baseW, color, alpha: 0.96, cap: 'round', join: 'round' });

        // 2. Crisp staff-map serrated teeth facing inward into friendly territory
        let nextTooth = toothStep * 0.5;
        for (let i = 1; i < samples.length - 1; i++) {
          const cur = samples[i]!;
          if (cur.dist < nextTooth) continue;
          nextTooth += toothStep;
          const prev = samples[i - 1]!;
          const next = samples[i + 1]!;
          const tx = next.x - prev.x;
          const ty = next.y - prev.y;
          const tl = Math.max(0.01, Math.hypot(tx, ty));
          const ux = tx / tl;
          const uy = ty / tl;
          const hw = 2.6 * s;
          const tipX = cur.x + cur.nx * toothDepth;
          const tipY = cur.y + cur.ny * toothDepth;
          this.frontG.poly([
            cur.x - ux * hw, cur.y - uy * hw,
            tipX, tipY,
            cur.x + ux * hw, cur.y + uy * hw,
          ]);
          this.frontG.fill({ color, alpha: 0.94 }).stroke({ width: 0.75 * s, color: 0x1b1612, alpha: 0.72, join: 'round' });
        }
      }
    }
  }

  private redrawArrows(): void {
    this.arrowG.clear();
    for (const army of this.armies) {
      if (!army.arrow) continue;
      const p0 = this.provById.get(army.arrow.startProvId);
      const p3 = this.provById.get(army.arrow.targetProvId);
      if (!p0 || !p3) continue;
      this.drawSingleArrow(
        [p0.cx, p0.cy],
        [p3.cx, p3.cy],
        hexToNum(army.color),
        army.arrow.bendOffsetX ?? 0,
        army.arrow.bendOffsetY ?? 0,
        false,
      );
    }
    if (this.preview) {
      const p0 = this.provById.get(this.preview.startProvId);
      const p3 = this.provById.get(this.preview.targetProvId);
      if (p0 && p3 && p0.id !== p3.id) {
        this.drawSingleArrow([p0.cx, p0.cy], [p3.cx, p3.cy], hexToNum(this.preview.color), 0, 0, true);
      }
    }
  }

  private drawSingleArrow(p0: Pt, p3: Pt, color: number, bendX: number, bendY: number, isPreview: boolean): void {
    const { samples, totalLen } = sampleCubicArrow(p0, p3, bendX, bendY, 32);
    if (totalLen < 14) return;
    const s = 1 / Math.pow(Math.max(0.7, this.zoom), 0.42);
    const headLen = Math.min(totalLen * 0.34, 24 * s);
    const shaftEndS = Math.max(4, totalLen - headLen);
    const wTail = 5.2 * s;
    const wNeck = 8.4 * s;
    const headHalfW = 16.5 * s;

    // Split shaft samples up to shaftEndS so arrowhead attaches seamlessly without folding
    const shaft: BezierSample[] = [];
    for (const sm of samples) {
      if (sm.s <= shaftEndS) shaft.push(sm);
    }
    const endTip = samples[samples.length - 1]!;
    const neckSample = shaft[shaft.length - 1] ?? samples[0]!;

    const leftPts: Pt[] = [];
    const rightPts: Pt[] = [];
    for (const sm of shaft) {
      const frac = sm.s / Math.max(1, shaftEndS);
      const hw = wTail + (wNeck - wTail) * frac;
      leftPts.push([sm.x + sm.nx * hw, sm.y + sm.ny * hw]);
      rightPts.push([sm.x - sm.nx * hw, sm.y - sm.ny * hw]);
    }

    // Build unified clean polygon (tail -> left -> left wing -> tip -> right wing -> right -> tail)
    const wingL: Pt = [neckSample.x + neckSample.nx * headHalfW, neckSample.y + neckSample.ny * headHalfW];
    const wingR: Pt = [neckSample.x - neckSample.nx * headHalfW, neckSample.y - neckSample.ny * headHalfW];
    const tipPt: Pt = [endTip.x, endTip.y];

    const poly: number[] = [];
    for (const p of leftPts) poly.push(p[0], p[1]);
    poly.push(wingL[0], wingL[1], tipPt[0], tipPt[1], wingR[0], wingR[1]);
    for (let i = rightPts.length - 1; i >= 0; i--) poly.push(rightPts[i]![0], rightPts[i]![1]);

    // 1. Soft map shadow
    const shadowPoly: number[] = [];
    for (let i = 0; i < poly.length; i += 2) shadowPoly.push(poly[i]! + 2.2 * s, poly[i + 1]! + 2.6 * s);
    this.arrowG.poly(shadowPoly).fill({ color: 0x16120e, alpha: isPreview ? 0.14 : 0.24 });

    // 2. Translucent paper-harmonized arrow body
    this.arrowG.poly(poly).fill({ color, alpha: isPreview ? 0.34 : 0.48 });

    // 3. Flowing chevron stripes strictly inside shaft ribbon
    const stripePitch = 13.5 * s;
    const phaseOff = this.flowPhase * stripePitch;
    for (let d = phaseOff; d < shaftEndS - 4 * s; d += stripePitch) {
      let idx = 0;
      while (idx < shaft.length - 1 && shaft[idx]!.s < d) idx++;
      const sm = shaft[idx]!;
      const frac = sm.s / Math.max(1, shaftEndS);
      const hw = (wTail + (wNeck - wTail) * frac) * 0.78;
      const chevLead = 4.2 * s;
      this.arrowG
        .moveTo(sm.x - sm.tx * chevLead + sm.nx * hw, sm.y - sm.ty * chevLead + sm.ny * hw)
        .lineTo(sm.x + sm.tx * chevLead, sm.y + sm.ty * chevLead)
        .lineTo(sm.x - sm.tx * chevLead - sm.nx * hw, sm.y - sm.ty * chevLead - sm.ny * hw);
      this.arrowG.stroke({ width: 2.1 * s, color: 0xfff3d6, alpha: isPreview ? 0.38 : 0.56, cap: 'round', join: 'round' });
    }

    // 4. Crisp ink & pale parchment double border (zero tearing)
    this.arrowG.poly(poly).stroke({ width: 2.0 * s, color: 0x1c1713, alpha: isPreview ? 0.52 : 0.82, join: 'round' });
    this.arrowG.poly(poly).stroke({ width: 0.75 * s, color: 0xf7ecd4, alpha: isPreview ? 0.4 : 0.65, join: 'round' });
  }
}
