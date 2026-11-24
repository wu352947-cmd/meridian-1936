"""Compute smooth quadratic Bezier label spines along each country's principal axis."""
from __future__ import annotations

import math
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

from config_1936 import COUNTRY_NAMES_ZH


def _largest_poly(geom) -> Polygon:
    if geom.geom_type == "Polygon":
        return geom
    polys = [g for g in geom.geoms if g.geom_type == "Polygon"]
    return max(polys, key=lambda p: p.area) if polys else Polygon()


def _sample_interior_chord(poly: Polygon, cx: float, cy: float, ux: float, uy: float, span: float):
    """Clip a line along (ux, uy) through (cx, cy) to poly and return longest segment endpoints."""
    p_a = (cx - ux * span, cy - uy * span)
    p_b = (cx + ux * span, cy + uy * span)
    clipped = poly.intersection(LineString([p_a, p_b]))
    if clipped.is_empty:
        return None
    segs = [clipped] if clipped.geom_type == "LineString" else [
        g for g in getattr(clipped, "geoms", []) if g.geom_type == "LineString"
    ]
    if not segs:
        return None
    best = max(segs, key=lambda s: s.length)
    coords = list(best.coords)
    return coords[0], coords[-1], best.length


def compute_country_label_curves(countries: dict[str, object]) -> list[dict]:
    """Return Bezier label curve specs for every country."""
    curves: list[dict] = []
    # Keep mainland Europe poly (filter out North Africa when computing France/Italy/UK main label!)
    for tag, geom in sorted(countries.items()):
        if tag in ("SEA", "EDG"):
            continue
        # For colonial powers (FRA, ITA, GBR, SPR), prefer the European mainland component
        if geom.geom_type == "MultiPolygon":
            polys = [p for p in geom.geoms if p.area > 60.0]
            if tag in ("FRA", "ITA", "GBR", "SPR"):
                # European parts lie north of py=2520 (roughly 36N+)
                eu_polys = [p for p in polys if p.representative_point().y < 2480]
                main = max(eu_polys, key=lambda p: p.area) if eu_polys else max(polys, key=lambda p: p.area)
            else:
                main = max(polys, key=lambda p: p.area)
        else:
            main = geom

        if main.is_empty or main.area < 40.0:
            continue

        # Eroded core keeps labels nicely inside country borders
        erode_d = min(14.0, math.sqrt(main.area) * 0.08)
        core = main.buffer(-erode_d)
        if core.is_empty or core.area < 15.0:
            core = main
        core = _largest_poly(core)

        # Sample boundary/interior points for PCA orientation
        minx, miny, maxx, maxy = core.bounds
        w, h = maxx - minx, maxy - miny
        pts = np.array(core.exterior.coords)
        mean = pts.mean(axis=0)
        centered = pts - mean
        cov = np.cov(centered.T)
        eigvals, eigvecs = np.linalg.eigh(cov)
        principal = eigvecs[:, np.argmax(eigvals)]
        ux, uy = float(principal[0]), float(principal[1])
        # Always orient left-to-right (ux >= 0) so Chinese text reads naturally
        if ux < 0 or (abs(ux) < 0.2 and uy < 0):
            ux, uy = -ux, -uy
        # Limit steep tilt to <= 48 deg for Chinese legibility (except Italy/Norway/Sweden/Finland)
        angle = math.atan2(uy, ux)
        max_tilt = math.radians(56 if tag in ("ITA", "NOR", "SWE", "FIN", "POR") else 34)
        if abs(angle) > max_tilt:
            angle = math.copysign(max_tilt, angle)
            ux, uy = math.cos(angle), math.sin(angle)

        rp = core.representative_point()
        ct = core.centroid
        anchor = ct if core.contains(ct) else rp
        cx, cy = anchor.x, anchor.y

        diag = math.hypot(w, h) + 80.0
        res = _sample_interior_chord(core, cx, cy, ux, uy, diag)
        if not res:
            res = _sample_interior_chord(main, cx, cy, ux, uy, diag)
        if not res:
            p0 = (cx - 28.0, cy)
            p2 = (cx + 28.0, cy)
            span_px = 56.0
        else:
            a, b, seg_len = res
            if a[0] > b[0]:
                a, b = b, a
            # Inset 12% from each end so letters never touch borders
            p0 = (a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12)
            p2 = (a[0] + (b[0] - a[0]) * 0.88, a[1] + (b[1] - a[1]) * 0.88)
            span_px = seg_len * 0.76

        # Mid control point: gently curved toward interior centroid perpendicular to chord
        mx, my = (p0[0] + p2[0]) * 0.5, (p0[1] + p2[1]) * 0.5
        nx, ny = -uy, ux  # perpendicular
        # Sample offset chords near mid to find widest center
        best_mid = (mx, my)
        best_score = 0.0
        for frac in (-0.12, -0.06, 0.0, 0.06, 0.12):
            tx = mx + nx * span_px * frac
            ty = my + ny * span_px * frac
            pt = Point(tx, ty)
            if main.contains(pt):
                dist_edge = main.boundary.distance(pt)
                # Prefer smooth mild arch upward/inward
                score = dist_edge - abs(frac) * 18.0
                if score > best_score:
                    best_score = score
                    best_mid = (tx, ty)

        # Gentle cartographic arch (subtle upward bow for horizontal countries)
        if abs(best_mid[0] - mx) < 1.0 and abs(best_mid[1] - my) < 1.0 and span_px > 90:
            arch = min(22.0, span_px * 0.06)
            cand = (mx + nx * (-arch if ny > 0 else arch), my + ny * (-arch if ny > 0 else arch))
            if main.contains(Point(cand)):
                best_mid = cand

        name_zh, name_en = COUNTRY_NAMES_ZH.get(tag, (tag, tag))
        # Adaptive font size from area and span
        sqrt_a = math.sqrt(main.area)
        font_sz = int(max(13, min(42, min(sqrt_a * 0.135, span_px / max(len(name_zh), 2) * 0.82))))
        priority = int(main.area)

        curves.append({
            "tag": tag,
            "nameZh": name_zh,
            "nameEn": name_en,
            "curve": [
                [round(p0[0], 1), round(p0[1], 1)],
                [round(best_mid[0], 1), round(best_mid[1], 1)],
                [round(p2[0], 1), round(p2[1], 1)],
            ],
            "spanPx": round(span_px, 1),
            "areaPx": round(main.area, 1),
            "fontSize": font_sz,
            "priority": priority,
        })

    curves.sort(key=lambda c: c["priority"], reverse=True)
    return curves
