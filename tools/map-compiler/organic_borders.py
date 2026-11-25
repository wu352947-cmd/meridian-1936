"""Natural admin-1 merging, river splitting & watertight shared-edge fractal jitter."""
from __future__ import annotations

import hashlib
import math
from collections import defaultdict
import numpy as np
import shapefile
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import linemerge, polygonize, transform as shp_transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

from config_1936 import RAW_DIR, WIDTH, HEIGHT, lonlat_to_px

# Post-1945 artificial admin-1 seams that must NOT become 1936 province borders
NO_CUT_ISOS = {"RU-KGD", "PL-WN"}


def clean_poly(g):
    if g is None or g.is_empty:
        return Polygon()
    g = make_valid(g)
    if g.geom_type == "GeometryCollection":
        polys = [p for p in g.geoms if p.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys) if polys else Polygon()
    return g


def load_admin1_units() -> list[dict]:
    """Load Natural Earth admin-1 polygons in Europe pixel space with zh/en names."""
    frame = box(0, 0, WIDTH, HEIGHT)
    sf = shapefile.Reader(str(RAW_DIR / "ne_10m_admin_1_states_provinces" / "ne_10m_admin_1_states_provinces.shp"))
    f = [x[0] for x in sf.fields[1:]]
    i_a0, i_iso, i_nm, i_zh = f.index("adm0_a3"), f.index("iso_3166_2"), f.index("name"), f.index("name_zh")
    units: list[dict] = []
    for sr in sf.iterShapeRecords():
        bx = sr.shape.bbox
        if bx[2] < -26 or bx[0] > 62 or bx[3] < 24 or bx[1] > 74:
            continue
        g = clean_poly(shp_transform(lonlat_to_px, shape(sr.shape.__geo_interface__)).intersection(frame))
        if g.is_empty or g.area < 18.0:
            continue
        units.append({
            "adm0": str(sr.record[i_a0] or ""),
            "iso": str(sr.record[i_iso] or ""),
            "name": str(sr.record[i_nm] or "").strip(),
            "name_zh": str(sr.record[i_zh] or "").strip(),
            "geom": g,
        })
    return units


def load_split_rivers() -> list[LineString]:
    """Load major & regional European rivers as pixel-space LineStrings for province splitting."""
    frame = box(0, 0, WIDTH, HEIGHT)
    raw_lines: list[LineString] = []
    sources = [
        ("ne_10m_rivers_lake_centerlines/ne_10m_rivers_lake_centerlines.shp", 6),
        ("ne_10m_rivers_europe/ne_10m_rivers_europe.shp", 11),
    ]
    for rel, max_sr in sources:
        sf = shapefile.Reader(str(RAW_DIR / rel))
        f = [x[0] for x in sf.fields[1:]]
        i_sr = f.index("scalerank")
        for sr in sf.iterShapeRecords():
            if int(sr.record[i_sr] or 99) > max_sr:
                continue
            bx = sr.shape.bbox
            if bx[2] < -24 or bx[0] > 60 or bx[3] < 26 or bx[1] > 72:
                continue
            g = shp_transform(lonlat_to_px, shape(sr.shape.__geo_interface__)).intersection(frame)
            if g.is_empty:
                continue
            parts = [g] if g.geom_type == "LineString" else [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]
            for ln in parts:
                if ln.length >= 10.0:
                    raw_lines.append(ln)
    merged = linemerge(raw_lines) if raw_lines else LineString()
    merged_parts = [merged] if merged.geom_type == "LineString" else [x for x in getattr(merged, "geoms", []) if x.geom_type == "LineString"]
    lines = [ln.simplify(1.4, preserve_topology=False) for ln in merged_parts if ln.length >= 26.0]
    return lines


def try_river_split(poly, rivers: list[LineString], target_k: int) -> list:
    """Recursively split a large polygon along rivers when a river creates balanced halves."""
    if target_k <= 1 or poly.area < 1600.0:
        return [poly]
    tree = STRtree(rivers)
    cand_idxs = tree.query(poly)
    best_split = None
    best_score = 0.0
    for idx in cand_idxs:
        rv = rivers[idx]
        if not rv.intersects(poly):
            continue
        # Extend river slightly at endpoints to cleanly cross polygon boundary
        coords = list(rv.coords)
        if len(coords) < 2:
            continue
        p0, p1 = coords[0], coords[1]
        d0 = math.hypot(p0[0] - p1[0], p0[1] - p1[1]) or 1.0
        ext0 = (p0[0] + (p0[0] - p1[0]) / d0 * 14.0, p0[1] + (p0[1] - p1[1]) / d0 * 14.0)
        q0, q1 = coords[-2], coords[-1]
        d1 = math.hypot(q1[0] - q0[0], q1[1] - q0[1]) or 1.0
        ext1 = (q1[0] + (q1[0] - q0[0]) / d1 * 14.0, q1[1] + (q1[1] - q0[1]) / d1 * 14.0)
        ext_rv = LineString([ext0] + coords + [ext1])
        try:
            noded = unary_union([poly.boundary, ext_rv.intersection(poly.buffer(3.0))])
            parts = [clean_poly(p.intersection(poly)) for p in polygonize(noded)]
            parts = [p for p in parts if not p.is_empty and p.area >= 400.0]
        except Exception:
            continue
        if len(parts) != 2:
            continue
        if abs(sum(p.area for p in parts) - poly.area) > poly.area * 0.04:
            continue
        ratio = min(parts[0].area, parts[1].area) / poly.area
        if 0.24 <= ratio <= 0.50:
            score = ratio * min(rv.length, 400.0)
            if score > best_score:
                best_score = score
                best_split = parts
    if not best_split:
        return [poly]
    a0, a1 = best_split[0].area, best_split[1].area
    k0 = max(1, min(target_k - 1, round(target_k * a0 / (a0 + a1))))
    k1 = target_k - k0
    return try_river_split(best_split[0], rivers, k0) + try_river_split(best_split[1], rivers, k1)


def agglomerative_merge(pieces: list, target_k: int, major_pts: list[Point]) -> list:
    """Merge smallest adjacent admin-1 polygons until count <= target_k."""
    polys = [clean_poly(p) for p in pieces if not p.is_empty and p.area >= 12.0]
    if len(polys) <= target_k:
        return polys

    def has_major(p) -> bool:
        return any(p.contains(pt) for pt in major_pts)

    while len(polys) > target_k:
        # Prefer merging smallest piece; give slight weight bonus to keep major cities unmerged
        weights = [p.area * (1.45 if has_major(p) else 1.0) for p in polys]
        order = sorted(range(len(polys)), key=lambda i: weights[i])
        merged = False
        for i in order:
            pi = polys[i]
            best_j = -1
            best_score = -1.0
            for j, pj in enumerate(polys):
                if j == i or not pi.touches(pj) and not pi.intersects(pj):
                    continue
                inter = pi.boundary.intersection(pj.boundary)
                shared = getattr(inter, "length", 0.0)
                if shared < 0.8:
                    continue
                score = shared / math.sqrt(max(pj.area, 100.0))
                if score > best_score:
                    best_score = score
                    best_j = j
            if best_j >= 0:
                u = clean_poly(unary_union([polys[i], polys[best_j]]))
                hi, lo = max(i, best_j), min(i, best_j)
                polys.pop(hi)
                polys[lo] = u
                merged = True
                break
        if not merged:
            break
    return polys


def _snap_key(pt: tuple[float, float]) -> tuple[int, int]:
    return (round(pt[0] * 1000), round(pt[1] * 1000))


def _extract_topological_chains(noded_lines) -> list[list[tuple[float, float]]]:
    """Group noded 2-point segments into maximal chains between degree!=2 junction nodes."""
    segs: list[tuple[tuple[float, float], tuple[float, float]]] = []
    geoms = [noded_lines] if noded_lines.geom_type == "LineString" else list(getattr(noded_lines, "geoms", []))
    for g in geoms:
        if g.geom_type != "LineString":
            continue
        cs = list(g.coords)
        for k in range(len(cs) - 1):
            a, b = (float(cs[k][0]), float(cs[k][1])), (float(cs[k + 1][0]), float(cs[k + 1][1]))
            if _snap_key(a) != _snap_key(b):
                segs.append((a, b))

    adj: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for idx, (a, b) in enumerate(segs):
        ka, kb = _snap_key(a), _snap_key(b)
        adj[ka].append((idx, 0))
        adj[kb].append((idx, 1))

    visited = [False] * len(segs)
    chains: list[list[tuple[float, float]]] = []

    def walk(start_idx: int, start_end: int) -> list[tuple[float, float]]:
        a, b = segs[start_idx]
        pts = [a, b] if start_end == 0 else [b, a]
        visited[start_idx] = True
        while True:
            cur_k = _snap_key(pts[-1])
            if len(adj[cur_k]) != 2:
                break
            nxt = None
            for s_idx, s_end in adj[cur_k]:
                if not visited[s_idx]:
                    nxt = (s_idx, s_end)
                    break
            if nxt is None:
                break
            s_idx, s_end = nxt
            visited[s_idx] = True
            sa, sb = segs[s_idx]
            pts.append(sb if s_end == 0 else sa)
        return pts

    # Start from all junction nodes (degree != 2)
    for k, inc in adj.items():
        if len(inc) != 2:
            for s_idx, s_end in inc:
                if not visited[s_idx]:
                    chains.append(walk(s_idx, s_end))
    # Remaining closed rings
    for idx in range(len(segs)):
        if not visited[idx]:
            chains.append(walk(idx, 0))
    return chains


def _fractal_displace(pts: list[tuple[float, float]], scale: float = 1.0) -> list[tuple[float, float]]:
    """Deterministic endpoint-pinned band-limited smooth organic curve for artificial cuts.

    Uses a low-frequency asymmetric spectral bridge (half-wave lobes >= ~16px, zero high-freq
    sawtooth jitter) so interior borders flow smoothly like hand-drawn cartographic lines
    without collapsing back into straight Voronoi polygons.
    """
    a, b = pts[0], pts[-1]
    rev = _snap_key(a) > _snap_key(b)
    work = list(reversed(pts)) if rev else list(pts)

    p0, p1 = work[0], work[-1]
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    total_len = math.hypot(dx, dy)
    if total_len < 14.0:
        return pts

    seed_bytes = hashlib.sha256(
        f"{round(p0[0],2)},{round(p0[1],2)}->{round(p1[0],2)},{round(p1[1],2)}".encode()
    ).digest()
    rng = np.random.default_rng(int.from_bytes(seed_bytes[:8], "little"))

    ux, uy = dx / total_len, dy / total_len
    nx, ny = -uy, ux
    s_sign = -1.0 if scale < 0 else 1.0
    amp = min(total_len * 0.118, 10.2) * abs(scale)

    # Low-frequency modes only: shortest half-wave lobe >= ~15px prevents jagged fractal spikes
    m_max = max(2, min(5, int(total_len / 15.0) + 1))
    weights: list[tuple[int, float]] = []
    for m in range(1, m_max + 1):
        if m == 1:
            w = float(rng.choice([-1.0, 1.0])) * float(rng.uniform(0.45, 0.95))
        elif m == 2:
            w = float(rng.choice([-1.0, 1.0])) * float(rng.uniform(0.40, 0.90))
        else:
            w = float(rng.uniform(-0.85, 0.85))
        weights.append((m, w * (m ** -1.18) * s_sign))

    # Gentle monotonic phase warp breaks periodic sine regularity into natural asymmetric bends
    warp = float(rng.uniform(-0.14, 0.14))
    n_steps = max(10, min(32, int(round(total_len / 4.2))))
    ts = [i / n_steps for i in range(n_steps + 1)]
    raw_d: list[float] = []
    for t in ts:
        tw = t + warp * math.sin(math.pi * t)
        raw_d.append(sum(w * math.sin(m * math.pi * tw) for m, w in weights))

    peak = max(abs(v) for v in raw_d) or 1.0
    target_peak = amp * float(rng.uniform(0.76, 1.0))
    gain = target_peak / peak

    cur: list[tuple[float, float]] = []
    for t, dv in zip(ts, raw_d):
        off = dv * gain
        cur.append((p0[0] + ux * (total_len * t) + nx * off, p0[1] + uy * (total_len * t) + ny * off))

    cur[0] = p0
    cur[-1] = p1
    if rev:
        cur.reverse()
    return cur


def jitter_shared_edges(cells: list, outer_geom) -> list:
    """Apply watertight gentle hand-drawn curvature to artificial interior Voronoi cuts."""
    if len(cells) <= 1:
        return cells
    outer_b = outer_geom.boundary
    outer_buf = outer_geom.buffer(0.8)
    noded = unary_union([c.boundary for c in cells])
    chains = _extract_topological_chains(noded)
    if not chains:
        return cells

    line_objs = [LineString(ch) for ch in chains]
    final_lines = list(line_objs)

    for idx, ch in enumerate(chains):
        ln = line_objs[idx]
        if ln.length < 14.0 or _snap_key(ch[0]) == _snap_key(ch[-1]):
            continue
        # Preserve coastlines, national borders & already-curved admin-1 / river lines verbatim
        p25, p50, p75 = ln.interpolate(0.25, True), ln.interpolate(0.5, True), ln.interpolate(0.75, True)
        if outer_b.distance(p25) < 1.3 and outer_b.distance(p50) < 1.3 and outer_b.distance(p75) < 1.3:
            continue
        chord = math.hypot(ch[-1][0] - ch[0][0], ch[-1][1] - ch[0][1])
        if len(ch) >= 4 and ln.length / max(chord, 1.0) > 1.012:
            continue

        # Try gentle displacement (both bend directions, decreasing amplitude) until intersection-free
        end_keys = {_snap_key(ch[0]), _snap_key(ch[-1])}
        others = [final_lines[j] for j in range(len(final_lines)) if j != idx]
        tree = STRtree(others)
        for mult in (1.0, -1.0, 0.65, -0.65, 0.38, -0.38, 0.20, -0.20):
            cand_pts = _fractal_displace(ch, scale=mult)
            cand = LineString(cand_pts)
            if not cand.is_simple or not cand.within(outer_buf):
                continue
            ok = True
            for o_i in tree.query(cand):
                o_ln = others[o_i]
                if not cand.intersects(o_ln):
                    continue
                if cand.crosses(o_ln):
                    ok = False
                    break
                inter = cand.intersection(o_ln)
                pts_chk = [inter] if inter.geom_type == "Point" else (list(inter.geoms) if inter.geom_type == "MultiPoint" else None)
                if pts_chk is None or any(_snap_key((p.x, p.y)) not in end_keys for p in pts_chk):
                    ok = False
                    break
            if ok:
                final_lines[idx] = cand
                break

    # Watertight polygonize reconstruction
    rebuilt_raw = [clean_poly(p) for p in polygonize(final_lines)]
    rebuilt_raw = [p for p in rebuilt_raw if not p.is_empty and p.area >= 8.0]
    if not rebuilt_raw:
        return cells

    orig_area = sum(c.area for c in cells)
    new_area = sum(p.area for p in rebuilt_raw)
    if abs(new_area - orig_area) > orig_area * 0.015:
        return cells

    # Map each reconstructed polygon to its parent cell by max overlap
    buckets: list[list] = [[] for _ in range(len(cells))]
    for p in rebuilt_raw:
        rp = p.representative_point()
        parent = -1
        for ci, c in enumerate(cells):
            if c.contains(rp):
                parent = ci
                break
        if parent < 0:
            parent = max(range(len(cells)), key=lambda ci: p.intersection(cells[ci]).area)
        buckets[parent].append(p)

    merged = [clean_poly(unary_union(b)) for b in buckets if b]
    if len(merged) != len(cells) or any(m.is_empty or m.area < 12.0 for m in merged):
        return cells
    return merged
