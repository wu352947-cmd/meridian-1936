/**
 * World-space PixiJS PocketLayer: draws ONE clean dashed perimeter ring around each
 * encircled pocket block plus a single handwritten 「被围」 staff seal — zero arrow clutter.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { EncircledPocketSnap } from '../sim/systems/combatTypes';
import type { DecodedArc } from './BorderMeshBuilder';
import { extractRegionBoundaryPolylines, type Pt } from './frontlineGeometry';

const POCKET_LABEL_STYLE = new TextStyle({
  fontFamily: 'MeridianWenKai, "LXGW WenKai Screen", serif',
  fontSize: 12.5,
  fontWeight: '700',
  fill: '#FDF3E2',
  stroke: { color: '#261411', width: 2.2, join: 'round' },
});

function strokeDashedRing(g: Graphics, pts: readonly Pt[], dashLen: number, gapLen: number): void {
  if (pts.length < 2) return;
  let draw = true;
  let rem = dashLen;
  let px = pts[0]![0];
  let py = pts[0]![1];

  for (let i = 1; i < pts.length; i++) {
    const nx = pts[i]![0];
    const ny = pts[i]![1];
    const dx = nx - px;
    const dy = ny - py;
    let segLen = Math.hypot(dx, dy);
    if (segLen < 0.05) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;

    while (segLen > 0) {
      const step = Math.min(rem, segLen);
      const ex = px + ux * step;
      const ey = py + uy * step;
      if (draw) g.moveTo(px, py).lineTo(ex, ey);
      px = ex;
      py = ey;
      segLen -= step;
      rem -= step;
      if (rem <= 0.05) {
        draw = !draw;
        rem = draw ? dashLen : gapLen;
      }
    }
  }
}

export class PocketLayer {
  readonly root = new Container();
  private readonly ringG = new Graphics();
  private readonly badgeGroup = new Container();
  private readonly arcs: readonly DecodedArc[];
  private pockets: EncircledPocketSnap[] = [];
  private zoom = 1.0;

  constructor(arcs: readonly DecodedArc[]) {
    this.arcs = arcs;
    this.root.addChild(this.ringG, this.badgeGroup);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setData(pockets: EncircledPocketSnap[]): void {
    this.pockets = pockets;
    this.redraw();
  }

  updateLod(zoom: number): void {
    if (Math.abs(zoom - this.zoom) < 0.02) return;
    this.zoom = zoom;
    this.redraw();
  }

  private redraw(): void {
    this.ringG.clear();
    this.badgeGroup.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.root.visible || this.pockets.length === 0) return;

    const s = 1 / Math.pow(Math.max(0.65, this.zoom), 0.55);
    const inv = 1 / Math.max(0.55, this.zoom);

    for (const pocket of this.pockets) {
      const rings = extractRegionBoundaryPolylines(this.arcs, new Set(pocket.provinceIds), true);
      for (const pts of rings) {
        // Dark ink dashed backing + vivid cinnabar encirclement ring + pale warning accent
        strokeDashedRing(this.ringG, pts, 11 * s, 6.5 * s);
        this.ringG.stroke({ width: 5.4 * s, color: 0x1c1411, alpha: 0.78, cap: 'round' });
        strokeDashedRing(this.ringG, pts, 11 * s, 6.5 * s);
        this.ringG.stroke({ width: 3.1 * s, color: 0xc63c2e, alpha: 0.96, cap: 'round' });
        strokeDashedRing(this.ringG, pts, 11 * s, 6.5 * s);
        this.ringG.stroke({ width: 0.9 * s, color: 0xf7dfc4, alpha: 0.55, cap: 'round' });
      }

      // Single crisp 「被围」 paper seal badge placed cleanly along the north rim (zero counter overlap)
      let topY = pocket.cy;
      let topX = pocket.cx;
      for (const pts of rings) {
        for (const [rx, ry] of pts) {
          if (ry < topY) {
            topY = ry;
            topX = rx;
          }
        }
      }
      const badge = new Container();
      const bg = new Graphics();
      const labelStr = `被围 · ${pocket.brigadeIds.length}旅`;
      const bw = 68;
      const bh = 22;
      bg.roundRect(-bw * 0.5 + 1, -bh * 0.5 + 1.5, bw, bh, 4).fill({ color: 0x120c09, alpha: 0.52 });
      bg.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 4).fill({ color: 0x94291f, alpha: 0.96 });
      bg.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 4).stroke({ width: 1.35, color: 0xeac576 });

      const txt = new Text({ text: labelStr, style: POCKET_LABEL_STYLE });
      txt.resolution = 2;
      txt.anchor.set(0.5, 0.5);
      badge.addChild(bg, txt);
      badge.position.set((topX + pocket.cx) * 0.5, topY - 12 * inv);
      badge.scale.set(inv);
      this.badgeGroup.addChild(badge);
    }
  }
}
