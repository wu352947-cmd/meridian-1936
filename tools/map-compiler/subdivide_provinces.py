"""Subdivide 1936 country geometries into ~620 balanced organic land provinces + sea zones."""
from __future__ import annotations

import math
import numpy as np
import shapefile
from scipy.spatial import Voronoi
from shapely.geometry import Point, Polygon, MultiPolygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

from config_1936 import RAW_DIR, WIDTH, HEIGHT, TARGET_PROVINCES, lonlat_to_px
from names_zh import CITY_ZH
from names_zh_east import CITY_ZH_EXTRA, SEA_SEEDS
from organic_borders import (
    NO_CUT_ISOS,
    agglomerative_merge,
    jitter_shared_edges,
    load_admin1_units,
    load_split_rivers,
    try_river_split,
)

ALL_CITIES = {**CITY_ZH, **CITY_ZH_EXTRA}


def _clean(g):
    if g is None or g.is_empty:
        return Polygon()
    g = make_valid(g)
    if g.geom_type == "GeometryCollection":
        polys = [p for p in g.geoms if p.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys) if polys else Polygon()
    return g


def load_populated_places() -> list[dict]:
    sf = shapefile.Reader(str(RAW_DIR / "ne_10m_populated_places_simple" / "ne_10m_populated_places_simple.shp"))
    fields = [f[0] for f in sf.fields[1:]]
    i_nm = fields.index("name")
    i_pop = fields.index("pop_max")
    i_adm0 = fields.index("adm0_a3")
    places = []
    for sr in sf.iterShapeRecords():
        lon, lat = sr.shape.points[0]
        if not (-26 <= lon <= 62 and 24 <= lat <= 74):
            continue
        px, py = lonlat_to_px(lon, lat)
        if 4 <= px <= WIDTH - 4 and 4 <= py <= HEIGHT - 4:
            nm = str(sr.record[i_nm] or "").strip()
            pop = float(sr.record[i_pop] or 0)
            places.append({"name": nm, "pop": pop, "px": px, "py": py, "pt": Point(px, py), "adm0": sr.record[i_adm0]})
    places.sort(key=lambda p: p["pop"], reverse=True)
    return places


def _voronoi_cells(pts: list[tuple[float, float]], clip_geom) -> list:
    if len(pts) <= 1:
        return [clip_geom]
    minx, miny, maxx, maxy = clip_geom.bounds
    pad = max(maxx - minx, maxy - miny, 500.0) * 3.0
    # Add 4 far bounding points so all real regions are finite
    aug = list(pts) + [
        (minx - pad, miny - pad), (maxx + pad, miny - pad),
        (maxx + pad, maxy + pad), (minx - pad, maxy + pad),
    ]
    vor = Voronoi(np.array(aug))
    cells = []
    for idx in range(len(pts)):
        reg_idx = vor.point_region[idx]
        verts = vor.regions[reg_idx]
        if not verts or -1 in verts:
            cells.append(Polygon())
            continue
        poly = Polygon([vor.vertices[v] for v in verts])
        cells.append(_clean(poly.intersection(clip_geom)))
    return cells


def _sample_seeds_in_geom(geom, n: int, city_pts: list[tuple[float, float]], rng: np.random.Generator) -> list[tuple[float, float]]:
    """Select n well-spaced seeds inside geom, prioritizing major cities."""
    minx, miny, maxx, maxy = geom.bounds
    min_dist = math.sqrt(max(geom.area, 1.0) / max(n, 1)) * 0.58
    seeds: list[tuple[float, float]] = []
    for cx, cy in city_pts:
        if len(seeds) >= n:
            break
        if all(math.hypot(cx - sx, cy - sy) >= min_dist for sx, sy in seeds):
            seeds.append((cx, cy))
    # Fill remaining via farthest-point sampling over random interior points
    cands: list[tuple[float, float]] = []
    tries = 0
    while len(cands) < max(n * 28, 120) and tries < n * 400:
        tries += 1
        x = float(rng.uniform(minx, maxx))
        y = float(rng.uniform(miny, maxy))
        if geom.contains(Point(x, y)):
            cands.append((x, y))
    if not cands:
        rp = geom.representative_point()
        cands.append((rp.x, rp.y))
    if not seeds:
        seeds.append(cands[0])
    while len(seeds) < n:
        best_c = max(cands, key=lambda c: min(math.hypot(c[0] - s[0], c[1] - s[1]) for s in seeds))
        seeds.append(best_c)
    # 3 gentle Lloyd relaxation iterations for organic balanced provinces
    for _ in range(3):
        cells = _voronoi_cells(seeds, geom)
        new_seeds = []
        for s, cell in zip(seeds, cells):
            if not cell.is_empty and cell.area > 4.0:
                c = cell.representative_point()
                # Blend toward centroid for smoother shapes
                ct = cell.centroid
                p = ct if cell.contains(ct) else c
                new_seeds.append((p.x, p.y))
            else:
                new_seeds.append(s)
        seeds = new_seeds
    return seeds


def _allocate_counts(polys: list, total_k: int) -> list[int]:
    if not polys:
        return []
    total_area = sum(p.area for p in polys) or 1.0
    alloc = [max(1, round(total_k * p.area / total_area)) for p in polys]
    while sum(alloc) > total_k and max(alloc) > 1:
        idx = alloc.index(max(alloc))
        alloc[idx] -= 1
    while sum(alloc) < total_k:
        idx = max(range(len(polys)), key=lambda i: polys[i].area / alloc[i])
        alloc[idx] += 1
    return alloc


def _extract_admin1_partition(part, admin1_units: list[dict], adm1_tree: STRtree) -> list:
    """Clip Natural Earth admin-1 units into a clean, gap-free partition of `part`."""
    cand_idxs = adm1_tree.query(part)
    no_cut_geoms = []
    raw_pieces = []
    for idx in cand_idxs:
        u = admin1_units[idx]
        if not u["geom"].intersects(part):
            continue
        inter = _clean(u["geom"].intersection(part))
        if inter.is_empty or inter.area < 25.0:
            continue
        if u["iso"] in NO_CUT_ISOS:
            no_cut_geoms.append(inter)
        else:
            raw_pieces.append(inter)

    if no_cut_geoms:
        merged_ep = _clean(unary_union(no_cut_geoms).buffer(0.6, join_style=2).buffer(-0.6, join_style=2).intersection(part))
        if not merged_ep.is_empty and merged_ep.area >= 25.0:
            raw_pieces.append(merged_ep)

    if len(raw_pieces) <= 1:
        return [part]

    # Resolve overlaps deterministically and attach any tiny uncovered slivers to nearest piece
    raw_pieces.sort(key=lambda g: g.area, reverse=True)
    claimed = Polygon()
    clean_pieces = []
    for g in raw_pieces:
        d = _clean(g.difference(claimed))
        if not d.is_empty and d.area >= 35.0:
            clean_pieces.append(d)
            claimed = _clean(unary_union([claimed, d]))

    if not clean_pieces:
        return [part]

    # Absorb tiny city-state enclaves (e.g. Berlin/Vienna/Prague city-only < 580 px²) into surrounding piece
    # so capitals form balanced clickable provinces via city-seeded subdivision
    big = [p for p in clean_pieces if p.area >= 580.0]
    tiny = [p for p in clean_pieces if p.area < 580.0]
    if big and tiny:
        for tp in tiny:
            ni = max(range(len(big)), key=lambda i: getattr(big[i].boundary.intersection(tp.boundary), "length", 0.0) - big[i].distance(tp) * 0.1)
            big[ni] = _clean(unary_union([big[ni], tp]))
        clean_pieces = big

    leftover = _clean(part.difference(unary_union(clean_pieces)))
    if not leftover.is_empty and leftover.area >= 5.0:
        lparts = [leftover] if leftover.geom_type == "Polygon" else list(leftover.geoms)
        for lp in lparts:
            if lp.area < 2.0:
                continue
            ni = min(range(len(clean_pieces)), key=lambda i: clean_pieces[i].distance(lp))
            clean_pieces[ni] = _clean(unary_union([clean_pieces[ni], lp]))

    return clean_pieces


def _subdivide_part_organically(
    part,
    k: int,
    part_places: list[dict],
    admin1_units: list[dict],
    adm1_tree: STRtree,
    rivers: list,
    rng: np.random.Generator,
) -> list:
    if k <= 1:
        return [part]
    major_pts = [p["pt"] for p in part_places if p["pop"] >= 200000][:k * 2]
    pieces = _extract_admin1_partition(part, admin1_units, adm1_tree)

    if len(pieces) > k:
        merged = agglomerative_merge(pieces, k, major_pts)
        # If disconnected components prevented reaching k, allow minor Voronoi only if still way off
        return jitter_shared_edges(merged, part)

    # Fewer admin-1 units than k: allocate k across admin-1 units, split along rivers then jittered Voronoi
    alloc = _allocate_counts(pieces, k)
    out_cells: list = []
    for piece, kp in zip(pieces, alloc):
        if kp <= 1:
            out_cells.append(piece)
            continue
        river_parts = try_river_split(piece, rivers, kp)
        r_alloc = _allocate_counts(river_parts, kp)
        for rp_geom, kr in zip(river_parts, r_alloc):
            if kr <= 1:
                out_cells.append(rp_geom)
                continue
            c_pts = [(p["px"], p["py"]) for p in part_places if rp_geom.contains(p["pt"])]
            seeds = _sample_seeds_in_geom(rp_geom, kr, c_pts, rng)
            sub_cells = [c for c in _voronoi_cells(seeds, rp_geom) if not c.is_empty and c.area >= 15.0]
            sub_cells = jitter_shared_edges(sub_cells, rp_geom)
            out_cells.extend(sub_cells)

    return jitter_shared_edges(out_cells, part)


def subdivide_all(countries: dict[str, object], fixed_defs: list, places: list[dict]):
    """Produce organic land province dicts + sea zone dicts covering 100% of the canvas."""
    rng = np.random.default_rng(19360101)
    admin1_units = load_admin1_units()
    adm1_tree = STRtree([u["geom"] for u in admin1_units])
    rivers = load_split_rivers()
    land_provs: list[dict] = []

    fixed_by_tag: dict[str, list] = {}
    for item in fixed_defs:
        fixed_by_tag.setdefault(item[0], []).append(item)

    for tag in sorted(countries.keys()):
        geom = countries[tag]
        fixed_list = fixed_by_tag.get(tag, [])
        rem_geom = geom
        for (_, code, name_zh, name_en, fg, terr, vp, ind, is_cap) in fixed_list:
            fg = _clean(fg.intersection(rem_geom))
            if fg.is_empty or fg.area < 10.0:
                continue
            rem_geom = _clean(rem_geom.difference(fg))
            land_provs.append({
                "owner": tag, "core": tag, "code": code, "geom": fg,
                "fixed_name": (name_zh, name_en), "fixed_terrain": terr,
                "fixed_vp": vp, "fixed_industry": ind, "fixed_capital": is_cap,
            })

        target_rem = max(0, TARGET_PROVINCES.get(tag, 4) - len(fixed_list))
        if rem_geom.is_empty or rem_geom.area < 15.0:
            continue
        if target_rem <= 1:
            land_provs.append({"owner": tag, "core": tag, "geom": rem_geom})
            continue

        parts = [rem_geom] if rem_geom.geom_type == "Polygon" else list(rem_geom.geoms)
        parts = [p for p in parts if p.area >= 12.0]
        parts.sort(key=lambda p: p.area, reverse=True)
        big_parts = [p for p in parts if p.area >= 260.0] or [parts[0]]
        tiny_parts = [p for p in parts if p not in big_parts]
        alloc = _allocate_counts(big_parts, target_rem)

        country_cells: list = []
        for part, k in zip(big_parts, alloc):
            part_places = [p for p in places if part.contains(p["pt"])]
            cells = _subdivide_part_organically(part, k, part_places, admin1_units, adm1_tree, rivers, rng)
            country_cells.extend(cells)

        for tp in tiny_parts:
            if not country_cells:
                country_cells.append(tp)
            else:
                nearest_i = min(range(len(country_cells)), key=lambda i: country_cells[i].distance(tp))
                country_cells[nearest_i] = _clean(unary_union([country_cells[nearest_i], tp]))

        for cell in country_cells:
            land_provs.append({"owner": tag, "core": tag, "geom": cell})

    frame = box(0, 0, WIDTH, HEIGHT)
    all_land = _clean(unary_union([p["geom"] for p in land_provs]))
    ocean_raw = _clean(frame.difference(all_land))

    # Eliminate any tiny disconnected inland sliver polygons (< 180 px²) from ocean by absorbing into adjacent land province
    ocean_parts = [ocean_raw] if ocean_raw.geom_type == "Polygon" else list(ocean_raw.geoms)
    real_ocean = []
    slivers = []
    for op in ocean_parts:
        if op.area >= 180.0:
            real_ocean.append(op)
        elif op.area >= 0.05:
            slivers.append(op)
    if slivers:
        land_tree = STRtree([p["geom"] for p in land_provs])
        for sl in slivers:
            cands = list(land_tree.query(sl.buffer(2.0)))
            if cands:
                ni = min(cands, key=lambda i: land_provs[i]["geom"].distance(sl))
                land_provs[ni]["geom"] = _clean(unary_union([land_provs[ni]["geom"], sl]))
        all_land = _clean(unary_union([p["geom"] for p in land_provs]))
    ocean = _clean(unary_union(real_ocean)) if real_ocean else _clean(frame.difference(all_land))

    sea_pts = [lonlat_to_px(lon, lat) for (lon, lat, _, _) in SEA_SEEDS]
    sea_cells = _voronoi_cells(sea_pts, ocean)
    sea_provs: list[dict] = []
    for (lon, lat, nzh, nen), cell in zip(SEA_SEEDS, sea_cells):
        if cell.is_empty or cell.area < 40.0:
            continue
        sea_provs.append({
            "owner": "SEA", "core": "SEA", "geom": cell, "is_sea": True,
            "fixed_name": (nzh, nen),
        })
    return land_provs, sea_provs, admin1_units
