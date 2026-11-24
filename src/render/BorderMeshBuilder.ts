import { Container, Graphics } from 'pixi.js';
import type { Topology, GeometryCollection, Polygon as TopoPoly, MultiPolygon as TopoMulti } from 'topojson-specification';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';

interface DecodedArc {
  points: [number, number][];
  owners: Set<string>;
  provIds: Set<number>;
  hasSea: boolean;
  hasLand: boolean;
}

function decodeArcs(topology: Topology): [number, number][][] {
  const tr = topology.transform;
  const sx = tr ? tr.scale[0] : 1;
  const sy = tr ? tr.scale[1] : 1;
  const tx = tr ? tr.translate[0] : 0;
  const ty = tr ? tr.translate[1] : 0;

  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const pts: [number, number][] = [];
    for (const pt of arc) {
      x += pt[0]!;
      y += pt[1]!;
      pts.push([x * sx + tx, y * sy + ty]);
    }
    return pts;
  });
}

function drawPolyline(g: Graphics, pts: [number, number][]): void {
  if (pts.length < 2) return;
  g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i]![0], pts[i]![1]);
  }
}

function drawDashedPolyline(g: Graphics, pts: [number, number][], dashLen: number, gapLen: number): void {
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
    if (segLen < 0.01) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;

    while (segLen > 0) {
      const step = Math.min(rem, segLen);
      const ex = px + ux * step;
      const ey = py + uy * step;
      if (draw) {
        g.moveTo(px, py);
        g.lineTo(ex, ey);
      }
      px = ex;
      py = ey;
      segLen -= step;
      rem -= step;
      if (rem <= 0.01) {
        draw = !draw;
        rem = draw ? dashLen : gapLen;
      }
    }
  }
}

export class BorderMeshBuilder {
  readonly root = new Container();
  private readonly graticuleG = new Graphics();
  private readonly seaBorderG = new Graphics();
  private readonly provBorderG = new Graphics();
  private readonly riverMajorG = new Graphics();
  private readonly riverMinorG = new Graphics();
  private readonly coastG = new Graphics();
  private readonly intlBorderG = new Graphics();
  private readonly selectGlowG = new Graphics();

  private readonly decodedArcs: DecodedArc[] = [];
  private readonly provById = new Map<number, ProvinceRecord>();

  constructor(
    meta: EuropeMapMeta,
    topology: Topology,
    pickGrid: Uint16Array,
    pickW: number,
    pickH: number,
  ) {
    for (const p of meta.provinces) this.provById.set(p.id, p);

    this.root.addChild(
      this.graticuleG,
      this.seaBorderG,
      this.riverMinorG,
      this.riverMajorG,
      this.provBorderG,
      this.coastG,
      this.intlBorderG,
      this.selectGlowG,
    );

    this.buildArcIndex(topology, pickGrid, pickW, pickH);
    this.drawStaticVectors(meta);
    this.updateLod(1.0);
  }

  private samplePick(pickGrid: Uint16Array, pickW: number, pickH: number, wx: number, wy: number): ProvinceRecord | null {
    const gx = Math.floor(wx * 0.5);
    const gy = Math.floor(wy * 0.5);
    if (gx < 0 || gx >= pickW || gy < 0 || gy >= pickH) return null;
    const pid = pickGrid[gy * pickW + gx] ?? 0;
    return pid > 0 ? (this.provById.get(pid) ?? null) : null;
  }

  private buildArcIndex(topology: Topology, pickGrid: Uint16Array, pickW: number, pickH: number): void {
    const rawArcs = decodeArcs(topology);
    const arcs: DecodedArc[] = rawArcs.map((points) => ({
      points,
      owners: new Set<string>(),
      provIds: new Set<number>(),
      hasSea: false,
      hasLand: false,
    }));

    const obj = topology.objects.provinces as GeometryCollection | undefined;
    if (!obj) return;

    const visitRings = (rings: number[][], pid: number, owner: string, isSea: boolean) => {
      for (const ring of rings) {
        for (const rawIdx of ring) {
          const idx = rawIdx < 0 ? ~rawIdx : rawIdx;
          const a = arcs[idx];
          if (!a) continue;
          a.provIds.add(pid);
          a.owners.add(owner);
          if (isSea) a.hasSea = true;
          else a.hasLand = true;
        }
      }
    };

    for (const geom of obj.geometries) {
      const props = (geom.properties ?? {}) as { id?: number };
      const pid = props.id;
      if (!pid) continue;
      const prov = this.provById.get(pid);
      if (!prov) continue;
      if (geom.type === 'Polygon') {
        visitRings((geom as TopoPoly).arcs, pid, prov.owner, prov.isSea);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of (geom as TopoMulti).arcs) {
          visitRings(poly, pid, prov.owner, prov.isSea);
        }
      }
    }

    // Resolve unshared T-junction arcs AND prune false micro-sliver inland coastlines via exact normal sampling
    for (const a of arcs) {
      if (a.points.length < 2) continue;
      const isUnshared = a.provIds.size === 1;
      const isSuspectCoast = a.hasLand && a.hasSea && a.points.length <= 4;
      if (!isUnshared && !isSuspectCoast) continue;

      const midIdx = Math.floor((a.points.length - 1) * 0.5);
      const p0 = a.points[midIdx]!;
      const p1 = a.points[midIdx + 1]!;
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const mx = (p0[0] + p1[0]) * 0.5;
      const my = (p0[1] + p1[1]) * 0.5;

      const sampledOwners = new Set<string>();
      const sampledIds = new Set<number>();
      let sawSea = false;
      let sawLand = false;

      for (const dist of [3.0, 5.5]) {
        for (const sign of [-1, 1]) {
          const hit = this.samplePick(pickGrid, pickW, pickH, mx + nx * dist * sign, my + ny * dist * sign);
          if (hit) {
            sampledIds.add(hit.id);
            sampledOwners.add(hit.owner);
            if (hit.isSea) sawSea = true;
            else sawLand = true;
          }
        }
      }

      if (isSuspectCoast && sawLand && !sawSea) {
        // Micro-gap sliver between adjacent land provinces; reclassify cleanly as inland border
        a.hasSea = false;
        a.hasLand = true;
        a.owners = sampledOwners;
        a.provIds = sampledIds;
      } else if (isUnshared) {
        for (const id of sampledIds) a.provIds.add(id);
        for (const ow of sampledOwners) a.owners.add(ow);
        if (sawSea) a.hasSea = true;
        if (sawLand) a.hasLand = true;
      }
    }

    this.decodedArcs.push(...arcs);
  }

  private drawStaticVectors(meta: EuropeMapMeta): void {
    for (const gl of meta.graticule) drawPolyline(this.graticuleG, gl.points);
    this.graticuleG.stroke({ width: 0.9, color: 0x8ea6b8, alpha: 0.14 });

    for (const r of meta.rivers) {
      if (r.rank <= 1) drawPolyline(this.riverMajorG, r.points);
      else drawPolyline(this.riverMinorG, r.points);
    }
    this.riverMajorG.stroke({ width: 1.55, color: 0x3b5c76, alpha: 0.88, cap: 'round', join: 'round' });
    this.riverMinorG.stroke({ width: 0.95, color: 0x456984, alpha: 0.62, cap: 'round', join: 'round' });

    for (const arc of this.decodedArcs) {
      if (arc.points.length < 2) continue;
      if (arc.hasLand && arc.hasSea) {
        drawPolyline(this.coastG, arc.points);
      } else if (arc.hasLand && !arc.hasSea) {
        if (arc.owners.size > 1) {
          drawPolyline(this.intlBorderG, arc.points);
        } else if (arc.provIds.size > 1) {
          drawDashedPolyline(this.provBorderG, arc.points, 5.0, 3.8);
        }
      } else if (arc.hasSea && arc.provIds.size > 1) {
        drawDashedPolyline(this.seaBorderG, arc.points, 8.0, 9.0);
      }
    }

    this.seaBorderG.stroke({ width: 0.8, color: 0x6c8ca3, alpha: 0.20 });
    this.provBorderG.stroke({ width: 0.68, color: 0x4f463d, alpha: 0.68 });
    this.coastG.stroke({ width: 1.35, color: 0x2c2621, alpha: 0.92, join: 'round', cap: 'round' });
    this.intlBorderG.stroke({ width: 1.95, color: 0x1e1a17, alpha: 0.96, join: 'round', cap: 'round' });
  }

  /** Draw crisp vermilion outer border halo around selected country + inner highlight on selected province. */
  setSelection(selectedOwner: string | null, selectedProvId: number | null): void {
    this.selectGlowG.clear();
    if (!selectedOwner && !selectedProvId) return;

    if (selectedOwner && selectedOwner !== 'SEA') {
      const frontierArcs = this.decodedArcs.filter(
        (arc) => arc.owners.has(selectedOwner) && (arc.hasSea || arc.owners.size > 1),
      );
      for (const arc of frontierArcs) drawPolyline(this.selectGlowG, arc.points);
      this.selectGlowG.stroke({ width: 4.8, color: 0xb83a2d, alpha: 0.34, join: 'round', cap: 'round' });
      for (const arc of frontierArcs) drawPolyline(this.selectGlowG, arc.points);
      this.selectGlowG.stroke({ width: 1.75, color: 0xd94b38, alpha: 0.96, join: 'round', cap: 'round' });
    }

    if (selectedProvId !== null) {
      for (const arc of this.decodedArcs) {
        if (arc.provIds.has(selectedProvId)) drawPolyline(this.selectGlowG, arc.points);
      }
      this.selectGlowG.stroke({ width: 1.35, color: 0xf4efe6, alpha: 0.9, join: 'round', cap: 'round' });
    }
  }

  updateLod(zoom: number): void {
    if (zoom < 1.05) {
      this.provBorderG.alpha = 0;
    } else if (zoom < 2.1) {
      this.provBorderG.alpha = 0.26 + ((zoom - 1.05) / 1.05) * 0.28;
    } else {
      this.provBorderG.alpha = Math.min(0.72, 0.54 + (zoom - 2.1) * 0.1);
    }
    this.riverMajorG.alpha = zoom < 0.85 ? 0.36 : Math.min(0.92, 0.56 + (zoom - 0.85) * 0.44);
    this.riverMinorG.alpha = zoom < 1.35 ? 0 : Math.min(0.7, (zoom - 1.35) * 0.52);
    this.seaBorderG.alpha = zoom < 1.0 ? 0.14 : 0.24;
  }
}
