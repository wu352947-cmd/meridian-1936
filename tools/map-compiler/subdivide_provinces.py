"""Subdivide 1936 country geometries into ~620 balanced organic land provinces + sea zones."""
from __future__ import annotations

import math
import numpy as np
import shapefile
from scipy.spatial import Voronoi
from shapely.geometry import Point, Polygon, MultiPolygon, box, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

from config_1936 import RAW_DIR, WIDTH, HEIGHT, TARGET_PROVINCES, lonlat_to_px
from names_zh import CITY_ZH
from names_zh_east import CITY_ZH_EXTRA, SEA_SEEDS

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


def subdivide_all(countries: dict[str, object], fixed_defs: list, places: list[dict]):
    """Produce land province dicts + sea zone dicts covering 100% of the canvas."""
    rng = np.random.default_rng(19360101)
    land_provs: list[dict] = []

    # Group fixed provinces by tag
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

        # Split disconnected landmasses proportional to area (preserving significant islands)
        parts = [rem_geom] if rem_geom.geom_type == "Polygon" else list(rem_geom.geoms)
        parts = [p for p in parts if p.area >= 12.0]
        parts.sort(key=lambda p: p.area, reverse=True)
        # Keep tiny islands attached to the nearest major part unless large enough to be own province
        big_parts = [p for p in parts if p.area >= 260.0]
        if not big_parts:
            big_parts = [parts[0]]
        tiny_parts = [p for p in parts if p not in big_parts]

        # Allocate target_rem across big_parts
        total_area = sum(p.area for p in big_parts)
        alloc = [max(1, round(target_rem * p.area / total_area)) for p in big_parts]
        while sum(alloc) > target_rem and max(alloc) > 1:
            idx = alloc.index(max(alloc))
            alloc[idx] -= 1
        while sum(alloc) < target_rem:
            idx = max(range(len(big_parts)), key=lambda i: big_parts[i].area / alloc[i])
            alloc[idx] += 1

        country_cells: list = []
        for part, k in zip(big_parts, alloc):
            if k <= 1:
                country_cells.append(part)
                continue
            part_cities = [(p["px"], p["py"]) for p in places if part.contains(p["pt"])]
            seeds = _sample_seeds_in_geom(part, k, part_cities, rng)
            cells = _voronoi_cells(seeds, part)
            for cell in cells:
                if not cell.is_empty and cell.area >= 15.0:
                    country_cells.append(cell)

        # Attach tiny islands to their nearest cell in same country
        for tp in tiny_parts:
            if not country_cells:
                country_cells.append(tp)
            else:
                nearest_i = min(range(len(country_cells)), key=lambda i: country_cells[i].distance(tp))
                country_cells[nearest_i] = _clean(unary_union([country_cells[nearest_i], tp]))

        for cell in country_cells:
            land_provs.append({"owner": tag, "core": tag, "geom": cell})

    # Build sea zones covering exact complement of all land in canvas
    frame = box(0, 0, WIDTH, HEIGHT)
    all_land = _clean(unary_union([p["geom"] for p in land_provs]))
    ocean = _clean(frame.difference(all_land))

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
    return land_provs, sea_provs, all_land
