/**
 * World-space PixiJS layer rendering full-contact continuous double-ink frontlines
 * (teeth facing enemy), snapped cubic Bezier arrows, target pencil hatching, and curved WenKai labels.
 */
import { Container, Graphics } from 'pixi.js';
import type { ArmySnap, BrigadeSnap } from '../sim/systems/armyTypes';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';
import type { DecodedArc } from './BorderMeshBuilder';
import {
  buildOffsetFrontlineSamples,
  extractRegionBoundaryPolylines,
  sampleCubicArrow,
  snapPointToFrontline,
  stitchFrontlineArcs,
  type BezierSample,
  type OffsetSample,
  type Pt,
} from './frontlineGeometry';
import {
  drawPolygonPencilHatch,
  tryPlaceCurvedStaffLabel,
  type LabelViewTransform,
  type ScreenBox,
} from './FrontlineLabelHelper';

function hexToNum(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isFinite(n) ? n : 0xc84b31;
}

export interface ArrowPreviewState {
  startProvId: number;
  targetProvId: number;
  color: string;
}

export class FrontlineArrowLayer {
  readonly root = new Container();
  private readonly hatchG = new Graphics();
  private readonly marchG = new Graphics();
  private readonly frontG = new Graphics();
  private readonly arrowG = new Graphics();
  private readonly labelGroup = new Container();

  private readonly provById = new Map<number, ProvinceRecord>();
  private readonly arcs: readonly DecodedArc[];
  private readonly pickGrid: Uint16Array;
  private readonly pickW: number;
  private readonly pickH: number;

  private armies: ArmySnap[] = [];
  private brigades: BrigadeSnap[] = [];
  private playerTag = 'GER';
  private controllerByProv = new Map<number, string>();
  private pocketProvIds = new Set<number>();
  private selectedArmyId: number | null = null;
  private preview: ArrowPreviewState | null = null;
  private zoom = 1.0;
  private view: LabelViewTransform | null = null;
  private avoidBoxes: readonly ScreenBox[] = [];
  private flowPhase = 0.25;
  private frontSamplesByArmy = new Map<number, OffsetSample[]>();
  private frontChainsByArmy = new Map<number, Pt[][]>();
  private arrowSamplesByArmy = new Map<number, Pt[]>();

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
    this.root.addChild(this.hatchG, this.marchG, this.frontG, this.arrowG, this.labelGroup);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setData(
    armies: ArmySnap[],
    brigades: BrigadeSnap[],
    selectedArmyId: number | null,
    controllerByProv?: ReadonlyMap<number, string>,
    playerTag = 'GER',
    pocketProvIds?: ReadonlySet<number>,
  ): void {
    this.armies = armies;
    this.brigades = brigades;
    this.selectedArmyId = selectedArmyId;
    this.playerTag = playerTag;
    if (controllerByProv) this.controllerByProv = new Map(controllerByProv);
    this.pocketProvIds = pocketProvIds ? new Set(pocketProvIds) : new Set();
    this.redraw();
  }

  setArrowPreview(preview: ArrowPreviewState | null): void {
    this.preview = preview;
    this.redrawArrows();
  }

  updateLod(zoom: number, view?: LabelViewTransform, avoidBoxes?: readonly ScreenBox[]): void {
    const zoomChanged = Math.abs(zoom - this.zoom) >= 0.015;
    this.zoom = zoom;
    if (view) this.view = view;
    if (avoidBoxes) this.avoidBoxes = avoidBoxes;
    if (zoomChanged) this.redraw();
    else this.redrawLabels();
  }

  advanceFlow(dtSec: number): void {
    if (!this.root.visible) return;
    const hasActive = this.preview !== null || this.armies.some((a) => a.arrow?.active);
    if (!hasActive) return;
    this.flowPhase = (this.flowPhase + dtSec * 0.72) % 1;
    this.redrawArrows();
  }

  private getProvController = (pid: number): string | null => {
    return this.controllerByProv.get(pid) ?? this.provById.get(pid)?.owner ?? null;
  };

  private sampleController = (wx: number, wy: number): string | null => {
    const gx = Math.floor(wx * 0.5);
    const gy = Math.floor(wy * 0.5);
    if (gx < 0 || gx >= this.pickW || gy < 0 || gy >= this.pickH) return null;
    const pid = this.pickGrid[gy * this.pickW + gx] ?? 0;
    return pid > 0 ? this.getProvController(pid) : null;
  };

  redraw(): void {
    this.redrawMarches();
    this.redrawFrontlines();
    this.redrawArrows();
    this.redrawLabels();
  }

  private redrawMarches(): void {
    this.marchG.clear();
    if (this.zoom < 0.85) return;
    const inv = 1 / Math.max(0.85, Math.min(3.2, this.zoom));
    const drawn = new Set<string>();
    for (const b of this.brigades) {
      if (b.movingToProvId === null) continue;
      // Only show clean manual-override / retreating player movement indicators to keep the map uncluttered
      if (b.owner !== this.playerTag) continue;
      if (!b.manualOverride && !b.retreating) continue;
      const key = `${b.provinceId}->${b.movingToProvId}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      const p0 = this.provById.get(b.provinceId);
      const p1 = this.provById.get(b.movingToProvId);
      if (!p0 || !p1) continue;
      const dx = p1.cx - p0.cx, dy = p1.cy - p0.cy, len = Math.hypot(dx, dy);
      if (len < 4) continue;
      const ux = dx / len, uy = dy / len;
      const s0x = p0.cx + ux * 8 * inv, s0y = p0.cy + uy * 8 * inv;
      const e0x = p1.cx - ux * 10 * inv, e0y = p1.cy - uy * 10 * inv;
      const col = b.retreating ? 0xc84b31 : b.manualOverride ? 0xebb952 : 0x76b874;
      this.marchG.moveTo(s0x, s0y).lineTo(e0x, e0y).stroke({ width: 3.2 * inv, color: 0x1c1712, alpha: 0.45, cap: 'round' });
      this.marchG.moveTo(s0x, s0y).lineTo(e0x, e0y).stroke({ width: 1.8 * inv, color: col, alpha: 0.92, cap: 'round' });
      const hs = 6.5 * inv, nx = -uy, ny = ux;
      this.marchG.poly([e0x + ux * hs * 0.5, e0y + uy * hs * 0.5, e0x - ux * hs + nx * hs * 0.65, e0y - uy * hs + ny * hs * 0.65, e0x - ux * hs - nx * hs * 0.65, e0y - uy * hs - ny * hs * 0.65]).fill({ color: col, alpha: 0.95 });
    }
  }

  private redrawFrontlines(): void {
    this.frontG.clear();
    this.frontSamplesByArmy.clear();
    this.frontChainsByArmy.clear();

    const s = 1 / Math.pow(Math.max(0.65, this.zoom), 0.52);
    const offsetPx = 3.2 * s;
    const toothStep = 10.5 * s;
    const toothDepth = 5.8 * s;

    for (const army of this.armies) {
      if (!army.frontline || army.owner !== this.playerTag) continue;
      const color = hexToNum(army.color);
      const hi = army.id === this.selectedArmyId;
      const baseW = (hi ? 4.8 : 3.6) * s;
      const provSet = new Set(army.frontline.friendlyProvIds);
      const filteredArcs = this.pocketProvIds.size > 0
        ? this.arcs.filter((a) => {
            for (const pid of a.provIds) if (this.pocketProvIds.has(pid)) return false;
            return true;
          })
        : this.arcs;
      const chains = stitchFrontlineArcs(
        filteredArcs,
        army.owner,
        army.frontline.targetTag,
        provSet,
        this.sampleController,
        this.getProvController,
      );

      const allSamples: OffsetSample[] = [];
      const chainPts: Pt[][] = [];
      for (const chain of chains) {
        const samples = buildOffsetFrontlineSamples(chain, offsetPx, Math.max(2.6, 4.2 * s));
        if (samples.length < 2) continue;
        allSamples.push(...samples);
        chainPts.push(samples.map((sm) => [sm.x, sm.y] as Pt));

        // 1. Bold double-layer ink backing + mineral army color ribbon
        const trace = () => {
          this.frontG.moveTo(samples[0]!.x, samples[0]!.y);
          for (let i = 1; i < samples.length; i++) this.frontG.lineTo(samples[i]!.x, samples[i]!.y);
        };
        if (hi) {
          trace();
          this.frontG.stroke({ width: baseW + 5.8 * s, color: 0xf2cf78, alpha: 0.55, cap: 'round', join: 'round' });
        }
        trace();
        this.frontG.stroke({ width: baseW + 2.8 * s, color: 0x1a1511, alpha: 0.86, cap: 'round', join: 'round' });
        trace();
        this.frontG.stroke({ width: baseW, color, alpha: 0.98, cap: 'round', join: 'round' });
        trace();
        this.frontG.stroke({ width: 0.9 * s, color: 0xf7ecd4, alpha: hi ? 0.72 : 0.42, cap: 'round', join: 'round' });

        // 2. Serrated teeth facing STRICTLY TOWARD ENEMY (-cur.nx, -cur.ny)
        let nextTooth = toothStep * 0.5;
        for (let i = 1; i < samples.length - 1; i++) {
          const cur = samples[i]!;
          if (cur.dist < nextTooth) continue;
          nextTooth += toothStep;
          const prev = samples[i - 1]!, next = samples[i + 1]!;
          const tx = next.x - prev.x, ty = next.y - prev.y;
          const tl = Math.max(0.01, Math.hypot(tx, ty));
          const ux = tx / tl, uy = ty / tl;
          const hw = 3.1 * s;
          const tipX = cur.x - cur.nx * toothDepth;
          const tipY = cur.y - cur.ny * toothDepth;
          this.frontG.poly([cur.x - ux * hw, cur.y - uy * hw, tipX, tipY, cur.x + ux * hw, cur.y + uy * hw]);
          this.frontG.fill({ color, alpha: 0.96 }).stroke({ width: 0.9 * s, color: 0x1a1511, alpha: 0.84, join: 'round' });
        }
      }
      this.frontSamplesByArmy.set(army.id, allSamples);
      this.frontChainsByArmy.set(army.id, chainPts);
    }
  }

  private redrawArrows(): void {
    this.arrowG.clear();
    this.hatchG.clear();
    this.arrowSamplesByArmy.clear();
    const s = 1 / Math.pow(Math.max(0.7, this.zoom), 0.42);

    for (const army of this.armies) {
      if (!army.arrow || army.owner !== this.playerTag) continue;
      const p0Prov = this.provById.get(army.arrow.startProvId);
      const p3Prov = this.provById.get(army.arrow.targetProvId);
      if (!p0Prov || !p3Prov) continue;

      const colorNum = hexToNum(army.color);
      // Pencil diagonal hatch on objective province in army's mineral color
      const targetRings = extractRegionBoundaryPolylines(this.arcs, new Set([p3Prov.id]), false);
      drawPolygonPencilHatch(this.hatchG, targetRings, colorNum, 7.5 * s, 1.35 * s, army.arrow.active ? 0.44 : 0.24);

      // Snap arrow tail onto army's stitched frontline closest to start province
      const snapped = snapPointToFrontline([p0Prov.cx, p0Prov.cy], this.frontSamplesByArmy.get(army.id) ?? []);
      const p0: Pt = snapped ?? [p0Prov.cx, p0Prov.cy];
      const curvePts = this.drawSingleArrow(
        p0,
        [p3Prov.cx, p3Prov.cy],
        colorNum,
        army.arrow.bendOffsetX ?? 0,
        army.arrow.bendOffsetY ?? 0,
        false,
        army.arrow.active,
      );
      if (curvePts.length >= 2) this.arrowSamplesByArmy.set(army.id, curvePts);
    }

    if (this.preview) {
      const p0 = this.provById.get(this.preview.startProvId);
      const p3 = this.provById.get(this.preview.targetProvId);
      if (p0 && p3 && p0.id !== p3.id) {
        this.drawSingleArrow([p0.cx, p0.cy], [p3.cx, p3.cy], hexToNum(this.preview.color), 0, 0, true, true);
      }
    }
  }

  private drawSingleArrow(
    p0: Pt, p3: Pt, color: number, bendX: number, bendY: number, isPreview: boolean, isActive: boolean,
  ): Pt[] {
    const { samples, totalLen } = sampleCubicArrow(p0, p3, bendX, bendY, 32);
    if (totalLen < 14) return [];
    const s = 1 / Math.pow(Math.max(0.7, this.zoom), 0.42);
    const headLen = Math.min(totalLen * 0.34, 24 * s);
    const shaftEndS = Math.max(4, totalLen - headLen);
    const wTail = 5.4 * s, wNeck = 8.8 * s, headHalfW = 16.5 * s;

    const shaft: BezierSample[] = samples.filter((sm) => sm.s <= shaftEndS);
    const endTip = samples[samples.length - 1]!;
    const neckSample = shaft[shaft.length - 1] ?? samples[0]!;
    const leftPts: Pt[] = [], rightPts: Pt[] = [];
    for (const sm of shaft) {
      const hw = wTail + (wNeck - wTail) * (sm.s / Math.max(1, shaftEndS));
      leftPts.push([sm.x + sm.nx * hw, sm.y + sm.ny * hw]);
      rightPts.push([sm.x - sm.nx * hw, sm.y - sm.ny * hw]);
    }
    const wingL: Pt = [neckSample.x + neckSample.nx * headHalfW, neckSample.y + neckSample.ny * headHalfW];
    const wingR: Pt = [neckSample.x - neckSample.nx * headHalfW, neckSample.y - neckSample.ny * headHalfW];
    const poly: number[] = [];
    for (const p of leftPts) poly.push(p[0], p[1]);
    poly.push(wingL[0], wingL[1], endTip.x, endTip.y, wingR[0], wingR[1]);
    for (let i = rightPts.length - 1; i >= 0; i--) poly.push(rightPts[i]![0], rightPts[i]![1]);

    const shadowPoly: number[] = [];
    for (let i = 0; i < poly.length; i += 2) shadowPoly.push(poly[i]! + 2.2 * s, poly[i + 1]! + 2.6 * s);
    this.arrowG.poly(shadowPoly).fill({ color: 0x16120e, alpha: isPreview ? 0.14 : isActive ? 0.26 : 0.14 });
    this.arrowG.poly(poly).fill({ color, alpha: isPreview ? 0.34 : isActive ? 0.52 : 0.24 });

    if (isActive) {
      const stripePitch = 13.0 * s;
      const phaseOff = this.flowPhase * stripePitch;
      for (let d = phaseOff; d < shaftEndS - 4 * s; d += stripePitch) {
        let idx = 0;
        while (idx < shaft.length - 1 && shaft[idx]!.s < d) idx++;
        const sm = shaft[idx]!;
        const hw = (wTail + (wNeck - wTail) * (sm.s / Math.max(1, shaftEndS))) * 0.78;
        const chevLead = 4.2 * s;
        this.arrowG.moveTo(sm.x - sm.tx * chevLead + sm.nx * hw, sm.y - sm.ty * chevLead + sm.ny * hw)
          .lineTo(sm.x + sm.tx * chevLead, sm.y + sm.ty * chevLead)
          .lineTo(sm.x - sm.tx * chevLead - sm.nx * hw, sm.y - sm.ty * chevLead - sm.ny * hw)
          .stroke({ width: 2.2 * s, color: 0xfff3d6, alpha: isPreview ? 0.38 : 0.62, cap: 'round', join: 'round' });
      }
      this.arrowG.poly(poly).stroke({ width: 2.0 * s, color: 0x1c1713, alpha: isPreview ? 0.52 : 0.85, join: 'round' });
      this.arrowG.poly(poly).stroke({ width: 0.75 * s, color: 0xf7ecd4, alpha: isPreview ? 0.4 : 0.65, join: 'round' });
    } else {
      // Stopped plan: static dashed centerline & muted outline (§2.5)
      for (let i = 0; i < shaft.length - 1; i += 2) {
        this.arrowG.moveTo(shaft[i]!.x, shaft[i]!.y).lineTo(shaft[i + 1]!.x, shaft[i + 1]!.y);
      }
      this.arrowG.stroke({ width: 1.8 * s, color: 0xf7ecd4, alpha: 0.68, cap: 'round' });
      this.arrowG.poly(poly).stroke({ width: 1.5 * s, color: 0x1c1713, alpha: 0.52, join: 'round' });
    }
    return shaft.map((sm) => [sm.x, sm.y] as Pt);
  }

  private redrawLabels(): void {
    this.labelGroup.removeChildren().forEach((c) => c.destroy());
    if (!this.view || this.zoom < 1.05) return;
    const placed: ScreenBox[] = [...this.avoidBoxes];
    const offW = 11 / this.zoom;

    for (const army of this.armies) {
      if (!army.frontline || army.owner !== this.playerTag) continue;
      const chains = this.frontChainsByArmy.get(army.id) ?? [];
      // Try chains from longest to shortest so every army gets a clean collision-free WenKai label
      const sortedChains = [...chains].sort((a, b) => b.length - a.length);
      const text = `${army.nameZh} · ${army.brigadeIds.length}旅`;
      for (const ch of sortedChains) {
        if (tryPlaceCurvedStaffLabel(this.labelGroup, ch, text, army.color, this.view, placed, offW)) break;
      }
      const arrowPts = this.arrowSamplesByArmy.get(army.id);
      if (arrowPts && army.arrow) {
        const tgtName = this.provById.get(army.arrow.targetProvId)?.nameZh ?? '';
        if (tgtName) {
          const arrowText = army.arrow.active ? `攻势 → ${tgtName}` : `待命 → ${tgtName}`;
          tryPlaceCurvedStaffLabel(this.labelGroup, arrowPts, arrowText, army.color, this.view, placed, 0);
        }
      }
    }
  }
}
