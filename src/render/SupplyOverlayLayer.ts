/**
 * World-space PixiJS Supply Source Marker Overlay for M3 Supply Map Mode.
 * Renders original self-drawn SVG stars (capitals & core cities) and maritime anchors (ports)
 * with screen-space collision avoidance so icons never overlap city labels or each other.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  SUPPLY_CAPITAL_STAR_SVG,
  SUPPLY_CORE_STAR_SVG,
  SUPPLY_ICON_SIZE,
  SUPPLY_PORT_ANCHOR_SVG,
} from '../assets/icons/logisticsIcons';
import type { ActiveSupplyHubSnap } from '../sim/systems/supplyTypes';
import type { MapMode } from '../types/map';
import type { DecodedArc } from './BorderMeshBuilder';
import type { ViewportRect } from './CurvedLabelLayer';

function drawDashedIsoline(g: Graphics, pts: readonly [number, number][], dashLen: number, gapLen: number): void {
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

interface HubNode {
  provId: number;
  cx: number;
  cy: number;
  priority: number;
  minZoom: number;
  width: number;
  height: number;
  container: Container;
}

const BADGE_STYLE = new TextStyle({
  fontFamily: 'MeridianMono, "JetBrains Mono", monospace',
  fontSize: 9.5,
  fontWeight: '700',
  fill: '#FAF2E1',
});

export class SupplyOverlayLayer {
  readonly root = new Container();
  readonly contourRoot = new Container();
  private readonly contourG = new Graphics();
  private readonly arcs: readonly DecodedArc[];
  private nodes: HubNode[] = [];
  private contourArcs80: Array<[number, number][]> = [];
  private contourArcs40: Array<[number, number][]> = [];
  private mapMode: MapMode = 'political';
  private lastZoom = 1;
  private lastContourZoom = -1;
  private lastView: ViewportRect | undefined;

  constructor(arcs: readonly DecodedArc[] = []) {
    this.arcs = arcs;
    this.contourRoot.addChild(this.contourG);
    this.contourRoot.visible = false;
  }

  setMapMode(mode: MapMode): void {
    this.mapMode = mode;
    this.updateLod(this.lastZoom, this.lastView);
  }

  /** Extract internal land boundaries where supply crosses S=80 or S=40 for delicate pencil isolines. */
  updateContours(supplyByProv: Uint8Array | null, controllerByProv?: ReadonlyMap<number, string>): void {
    this.contourArcs80 = [];
    this.contourArcs40 = [];
    if (supplyByProv && this.arcs.length > 0) {
      for (const arc of this.arcs) {
        if (arc.points.length < 2 || arc.hasSea || !arc.hasLand || arc.owners.size > 1 || arc.provIds.size !== 2) {
          continue;
        }
        let idA = -1;
        let idB = -1;
        for (const pid of arc.provIds) {
          if (idA < 0) idA = pid;
          else idB = pid;
        }
        if (idA < 0 || idB < 0 || idA >= supplyByProv.length || idB >= supplyByProv.length) continue;
        if (controllerByProv) {
          const cA = controllerByProv.get(idA);
          const cB = controllerByProv.get(idB);
          if (cA !== cB) continue;
        }
        const sA = supplyByProv[idA]!;
        const sB = supplyByProv[idB]!;
        if (sA === 0 || sB === 0) continue;
        const cross40 = (sA >= 40) !== (sB >= 40);
        const cross80 = (sA >= 80) !== (sB >= 80);
        if (cross40) this.contourArcs40.push(arc.points);
        else if (cross80) this.contourArcs80.push(arc.points);
      }
    }
    this.lastContourZoom = -1;
    this.redrawContours(this.lastZoom);
  }

  private redrawContours(zoom: number): void {
    this.contourG.clear();
    if (this.mapMode !== 'supply') return;
    if (this.contourArcs80.length === 0 && this.contourArcs40.length === 0) return;

    const s = 1 / Math.pow(Math.max(0.55, zoom), 0.55);
    if (this.contourArcs80.length > 0) {
      for (const pts of this.contourArcs80) drawDashedIsoline(this.contourG, pts, 9.5 * s, 4.8 * s);
      this.contourG.stroke({ width: 2.4 * s, color: 0xf4ecd8, alpha: 0.28, cap: 'round' });
      for (const pts of this.contourArcs80) drawDashedIsoline(this.contourG, pts, 9.5 * s, 4.8 * s);
      this.contourG.stroke({ width: 1.35 * s, color: 0x2d2923, alpha: 0.64, cap: 'round' });
    }
    if (this.contourArcs40.length > 0) {
      for (const pts of this.contourArcs40) drawDashedIsoline(this.contourG, pts, 5.5 * s, 3.6 * s);
      this.contourG.stroke({ width: 2.6 * s, color: 0xf5e8d2, alpha: 0.30, cap: 'round' });
      for (const pts of this.contourArcs40) drawDashedIsoline(this.contourG, pts, 5.5 * s, 3.6 * s);
      this.contourG.stroke({ width: 1.55 * s, color: 0x241d18, alpha: 0.74, cap: 'round' });
    }
    this.lastContourZoom = zoom;
  }

  rebuildHubs(hubs: readonly ActiveSupplyHubSnap[], playerTag: string): void {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.nodes = [];

    for (const h of hubs) {
      const isOwn = h.controller === playerTag;
      const isCap = h.kind === 'capital';
      const isCore = h.kind === 'core_city';
      const svg = isCap
        ? SUPPLY_CAPITAL_STAR_SVG
        : isCore
          ? SUPPLY_CORE_STAR_SVG
          : SUPPLY_PORT_ANCHOR_SVG;

      const iconPx = isCap ? 21 : isCore ? 17 : 16;
      const cont = new Container();
      const icon = new Graphics().svg(svg);
      icon.scale.set(iconPx / SUPPLY_ICON_SIZE);
      icon.position.set(-iconPx * 0.5, -iconPx * 0.5);

      const tagStr =
        h.portLevel > 0 && !isCap
          ? `港${h.portLevel}·${h.effectiveSupply}`
          : `${h.effectiveSupply}`;
      const pillW = Math.max(24, tagStr.length * 6.0 + 8);
      const pill = new Graphics();
      pill.roundRect(-pillW * 0.5, iconPx * 0.5 - 1, pillW, 13, 3);
      pill.fill({ color: isCap ? 0x261d14 : h.portLevel > 0 && !isCore ? 0x162938 : 0x231e19, alpha: 0.92 });
      pill.stroke({ width: 1.0, color: isCap ? 0xe5be6a : isCore ? 0xc8a25a : 0x7cb5d6 });

      const txt = new Text({ text: tagStr, style: BADGE_STYLE });
      txt.resolution = 2;
      txt.anchor.set(0.5, 0.5);
      txt.position.set(0, iconPx * 0.5 + 5.5);

      cont.addChild(icon, pill, txt);
      cont.alpha = isOwn ? 1.0 : 0.78;
      cont.position.set(h.cx, h.cy);
      this.root.addChild(cont);

      const priority =
        (isCap ? 500 : isCore ? 340 : 180 + h.portLevel * 28) +
        (isOwn ? 160 : 0) +
        h.effectiveSupply;
      const minZoom = isCap
        ? 0.42
        : isCore
          ? (isOwn ? 0.52 : 0.82)
          : h.portLevel >= 4
            ? (isOwn ? 0.65 : 0.98)
            : h.portLevel >= 3
              ? (isOwn ? 0.95 : 1.35)
              : 1.55;

      this.nodes.push({
        provId: h.provId,
        cx: h.cx,
        cy: h.cy,
        priority,
        minZoom,
        width: Math.max(iconPx, pillW) + 6,
        height: iconPx + 16,
        container: cont,
      });
    }

    this.nodes.sort((a, b) => b.priority - a.priority || a.provId - b.provId);
    this.updateLod(this.lastZoom, this.lastView);
  }

  updateLod(zoom: number, view?: ViewportRect): void {
    this.lastZoom = zoom;
    this.lastView = view;
    const active = this.mapMode === 'supply';
    this.root.visible = active;
    this.contourRoot.visible = active;
    if (!active) return;
    if (Math.abs(zoom - this.lastContourZoom) > 0.04) {
      this.redrawContours(zoom);
    }

    const invScale = 1 / Math.max(0.45, zoom);
    const scale = Math.max(0.24, Math.min(1.15, invScale * 0.95));
    const vw = view?.vw ?? 1440;
    const vh = view?.vh ?? 900;
    const toSx = (wx: number) => (view ? (wx - view.minX) * zoom : wx * zoom);
    const toSy = (wy: number) => (view ? (wy - view.minY) * zoom : wy * zoom);
    const placed: Array<[number, number, number, number]> = [];

    for (const n of this.nodes) {
      if (zoom < n.minZoom) {
        n.container.visible = false;
        continue;
      }
      const sx = toSx(n.cx);
      const sy = toSy(n.cy) - 14;
      const x0 = sx - n.width * 0.5;
      const y0 = sy - n.height * 0.5;
      const x1 = sx + n.width * 0.5;
      const y1 = sy + n.height * 0.5;
      if (view && (x0 < 14 || y0 < 72 || x1 > vw - 14 || y1 > vh - 70)) {
        n.container.visible = false;
        continue;
      }
      let collides = false;
      for (const [ax0, ay0, ax1, ay1] of placed) {
        if (x0 < ax1 && x1 > ax0 && y0 < ay1 && y1 > ay0) {
          collides = true;
          break;
        }
      }
      if (collides) {
        n.container.visible = false;
        continue;
      }
      placed.push([x0, y0, x1, y1]);
      n.container.visible = true;
      n.container.scale.set(scale);
      n.container.position.set(n.cx, n.cy - 14 / zoom);
    }
  }
}
