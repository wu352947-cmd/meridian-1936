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
import type { ViewportRect } from './CurvedLabelLayer';

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
  private nodes: HubNode[] = [];
  private mapMode: MapMode = 'political';
  private lastZoom = 1;
  private lastView: ViewportRect | undefined;

  setMapMode(mode: MapMode): void {
    this.mapMode = mode;
    this.updateLod(this.lastZoom, this.lastView);
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
          ? (isOwn ? 0.55 : 0.85)
          : h.portLevel >= 4
            ? (isOwn ? 0.65 : 0.95)
            : (isOwn ? 0.92 : 1.35);

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
    if (!active) return;

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
