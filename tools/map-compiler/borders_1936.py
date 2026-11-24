"""Build exact 1936 European national & special-province polygons in LAEA pixel space."""
from __future__ import annotations

import shapefile
from shapely.geometry import Polygon, MultiPolygon, box, shape
from shapely.ops import transform as shp_transform, unary_union
from shapely.validation import make_valid

from config_1936 import RAW_DIR, WIDTH, HEIGHT, ADM0_TO_1936, lonlat_to_px


def _proj_geom(geom):
    g = shp_transform(lonlat_to_px, geom)
    if not g.is_valid:
        g = make_valid(g)
    return g


def _poly_ll(coords: list[tuple[float, float]]) -> Polygon:
    return make_valid(Polygon([lonlat_to_px(lon, lat) for lon, lat in coords]))


def _clean_poly(g):
    if g is None or g.is_empty:
        return Polygon()
    g = make_valid(g)
    if g.geom_type == "GeometryCollection":
        polys = [p for p in g.geoms if p.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys) if polys else Polygon()
    return g


def _remove_tiny_holes(g, max_hole_area: float = 180.0):
    g = _clean_poly(g)
    if g.is_empty:
        return g
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    cleaned = []
    for p in polys:
        if p.geom_type != "Polygon":
            continue
        kept_holes = [r for r in p.interiors if Polygon(r).area >= max_hole_area]
        cleaned.append(Polygon(p.exterior, kept_holes))
    return _clean_poly(unary_union(cleaned)) if cleaned else Polygon()


def _weld_country(gs: list) -> object:
    """Union modern admin pieces and close sub-pixel reassembly seams/sliver holes."""
    if not gs:
        return Polygon()
    u = _clean_poly(unary_union(gs))
    if u.is_empty:
        return u
    # Tiny morphological closing welds modern-border micro-gaps (e.g. Kaliningrad/Warmia, Bessarabia, Kresy)
    closed = u.buffer(0.65, join_style=2, mitre_limit=2.0).buffer(-0.65, join_style=2, mitre_limit=2.0)
    return _remove_tiny_holes(closed, max_hole_area=180.0)


def _keep_significant(g, min_area: float = 12.0):
    g = _remove_tiny_holes(g, max_hole_area=180.0)
    if g.is_empty:
        return g
    if g.geom_type == "Polygon":
        return g if g.area >= min_area else Polygon()
    parts = [p for p in g.geoms if p.area >= min_area]
    return unary_union(parts) if parts else Polygon()


def build_1936_geometries():
    """Return (country_geoms: dict[str, geom], fixed_provs: list[dict])."""
    frame = box(0, 0, WIDTH, HEIGHT)
    # 1. Load admin-1 polygons for countries that require 1936 sub-national reassembly
    split_adm0 = {"POL", "DEU", "RUS", "BLR", "UKR", "LTU", "MDA", "BGR", "GRC", "MAR", "HRV", "SVN", "CZE", "SVK"}
    sf1 = shapefile.Reader(str(RAW_DIR / "ne_10m_admin_1_states_provinces" / "ne_10m_admin_1_states_provinces.shp"))
    f1 = [x[0] for x in sf1.fields[1:]]
    i_a0, i_iso, i_nm = f1.index("adm0_a3"), f1.index("iso_3166_2"), f1.index("name")

    by_tag: dict[str, list] = {}
    adm1_cache: dict[str, list] = {}

    for sr in sf1.iterShapeRecords():
        a0 = sr.record[i_a0]
        if a0 not in split_adm0:
            continue
        bx = sr.shape.bbox
        if bx[2] < -26 or bx[0] > 62 or bx[3] < 24 or bx[1] > 74:
            continue
        g = _clean_poly(_proj_geom(shape(sr.shape.__geo_interface__)).intersection(frame))
        if g.is_empty:
            continue
        iso = sr.record[i_iso]
        adm1_cache.setdefault(iso, []).append(g)

        # Default 1936 reassignment by modern admin-1 ISO
        tag = ADM0_TO_1936.get(a0, "EDG")
        if a0 == "POL" and iso in ("PL-ZP", "PL-LB", "PL-DS", "PL-OP", "PL-WN"):
            tag = "GER"
        elif a0 == "RUS" and iso == "RU-KGD":
            tag = "GER"
        elif a0 == "BLR" and iso in ("BY-BR", "BY-HR"):
            tag = "POL"
        elif a0 == "UKR" and iso in ("UA-07", "UA-56", "UA-46", "UA-61", "UA-26"):
            tag = "POL"
        elif a0 == "UKR" and iso == "UA-21":
            tag = "CZE"
        elif a0 == "UKR" and iso == "UA-77":
            tag = "ROM"
        elif a0 == "LTU" and iso == "LT-VL":
            tag = "POL"
        elif a0 == "BGR" and iso in ("BG-08", "BG-19"):
            tag = "ROM"
        elif a0 == "MDA" and iso == "MD-SN":
            tag = "SOV"
        elif a0 == "MAR" and iso == "MA-01":
            tag = "SPR"
        by_tag.setdefault(tag, []).append(g)

    # 2. Load admin-0 polygons for all other countries inside Europe frame
    sf0 = shapefile.Reader(str(RAW_DIR / "ne_10m_admin_0_countries" / "ne_10m_admin_0_countries.shp"))
    f0 = [x[0] for x in sf0.fields[1:]]
    i0_a3 = f0.index("ADM0_A3")
    for sr in sf0.iterShapeRecords():
        a0 = sr.record[i0_a3]
        if a0 in split_adm0:
            continue
        bx = sr.shape.bbox
        if bx[2] < -26 or bx[0] > 62 or bx[3] < 24 or bx[1] > 74:
            continue
        g = _clean_poly(_proj_geom(shape(sr.shape.__geo_interface__)).intersection(frame))
        if g.is_empty:
            continue
        tag = ADM0_TO_1936.get(a0, "EDG")
        by_tag.setdefault(tag, []).append(g)

    # Weld modern admin-0/admin-1 pieces seamlessly (closes micro-cracks in East Prussia, Kresy, Bessarabia, YUG, etc.)
    countries = {t: _weld_country(gs) for t, gs in by_tag.items()}

    # 3. Apply natural multi-vertex 1936 geometric historical border transfers
    # 3a. Free City of Danzig (DNZ) — historic 1920-1939 territory
    danzig_mask = _poly_ll([
        (18.42, 54.48), (18.78, 54.42), (19.16, 54.38), (19.46, 54.44),
        (19.44, 54.26), (19.32, 54.12), (19.04, 54.03), (18.80, 54.05),
        (18.56, 54.11), (18.40, 54.22), (18.38, 54.36),
    ])
    # 3b. Pomeranian west-of-Corridor (Stolp/Köslin) -> GER, and Elbing east of Vistula -> GER
    west_pom_ger = _poly_ll([
        (16.00, 55.00), (17.56, 54.90), (17.64, 54.56), (17.44, 54.26),
        (17.52, 53.95), (17.34, 53.66), (16.95, 53.44), (16.65, 53.26),
        (15.60, 53.30), (15.60, 55.00),
    ])
    elbing_ger = _poly_ll([
        (18.96, 54.46), (20.10, 54.46), (20.10, 53.55), (19.55, 53.58),
        (19.18, 53.64), (18.88, 53.62), (18.92, 53.88), (18.90, 54.08),
    ])
    # 3c. Polish Kresy Riga Treaty strip (naturalized eastern border east of Grodno/Brest to ~27.5E)
    riga_kresy = _poly_ll([
        (25.20, 55.85), (26.40, 55.76), (27.65, 55.65), (27.72, 55.05),
        (27.46, 54.52), (27.22, 53.96), (27.36, 53.42), (27.08, 52.84),
        (27.24, 52.20), (27.35, 51.60), (26.82, 51.45), (26.20, 51.40),
        (25.10, 52.70), (24.50, 54.00),
    ])
    # 3d. Polish Vilnius expansion (eastern Alytus/Utena corridor connecting to Latvia)
    vilnius_ext = _poly_ll([
        (24.75, 54.05), (25.45, 54.68), (26.05, 55.18), (26.65, 55.65),
        (27.20, 55.20), (26.40, 54.50), (25.60, 53.85),
    ])
    # 3e. Finland 1920 Tartu borders: Karelian Isthmus + Ladoga Karelia + Salla + Petsamo
    fin_karelia = _poly_ll([
        (27.60, 60.45), (28.90, 60.22), (29.95, 60.16), (30.52, 60.38),
        (30.92, 60.74), (31.65, 61.18), (32.22, 61.58), (31.95, 62.12),
        (31.48, 62.65), (30.88, 63.05), (30.20, 63.40), (28.00, 62.50),
    ])
    fin_salla_petsamo = _poly_ll([
        (28.50, 66.20), (29.60, 66.28), (30.40, 66.45), (30.52, 66.90),
        (30.36, 67.35), (29.55, 67.50), (28.80, 67.60),
    ])
    fin_petsamo = _poly_ll([
        (28.50, 68.55), (30.10, 68.52), (31.55, 68.62), (32.15, 69.28),
        (32.35, 69.95), (30.80, 70.10), (28.50, 69.40),
    ])
    # 3f. Romania Budjak (Southern Bessarabia, west of Dniester estuary)
    rom_budjak = _poly_ll([
        (28.10, 46.60), (29.35, 46.48), (30.48, 46.32), (30.20, 45.70),
        (29.90, 45.15), (28.10, 45.20),
    ])
    # 3g. Italian Istria & Dodecanese
    ita_istria = _poly_ll([
        (13.20, 46.20), (13.85, 46.16), (14.38, 46.06), (14.48, 45.42),
        (14.52, 44.75), (13.30, 44.70),
    ])
    ita_dodecanese = _poly_ll([
        (26.25, 37.55), (28.45, 37.55), (28.45, 35.30), (26.25, 35.30),
    ])
    # 3h. Spanish Morocco Rif strip
    spr_rif = _poly_ll([
        (-6.20, 35.95), (-4.20, 35.68), (-2.15, 35.40), (-2.25, 34.85),
        (-4.20, 34.90), (-6.15, 34.95),
    ])

    def transfer(src: str, dst: str, mask):
        if src not in countries:
            return
        piece = _clean_poly(countries[src].intersection(mask))
        if piece.is_empty:
            return
        countries[src] = _clean_poly(countries[src].difference(piece))
        countries[dst] = _weld_country([countries.get(dst, Polygon()), piece])

    transfer("POL", "GER", west_pom_ger)
    transfer("POL", "GER", elbing_ger)
    transfer("POL", "DNZ", danzig_mask)
    transfer("GER", "DNZ", danzig_mask)
    transfer("SOV", "POL", riga_kresy)
    transfer("LIT", "POL", vilnius_ext)
    transfer("SOV", "FIN", unary_union([fin_karelia, fin_salla_petsamo, fin_petsamo]))
    transfer("SOV", "ROM", rom_budjak)
    transfer("YUG", "ITA", ita_istria)
    transfer("GRE", "ITA", ita_dodecanese)
    transfer("FRA", "SPR", spr_rif)

    # Clean tiny dust slivers (< 8 px²) and resolve any overlap deterministically
    ordered = sorted(countries.keys(), key=lambda t: (t != "DNZ", t != "LUX", t))
    claimed = Polygon()
    final_countries: dict[str, object] = {}
    for t in ordered:
        g = _keep_significant(countries[t].difference(claimed), min_area=8.0)
        if not g.is_empty:
            final_countries[t] = g
            claimed = _clean_poly(unary_union([claimed, g]))

    # Fixed historical micro/named provinces (NEVER fix post-1945 straight cuts like RU-KGD or 1940 Karelia!)
    fixed_defs = [
        ("DNZ", "danzig", "但泽自由市", "Free City of Danzig", final_countries["DNZ"], "urban", 15, 8, True),
    ]
    saar = _clean_poly(unary_union(adm1_cache.get("DE-SL", [])).intersection(final_countries["GER"]))
    if not saar.is_empty:
        fixed_defs.append(("GER", "saarland", "萨尔兰", "Saarland", saar, "hills", 5, 10, False))

    return final_countries, fixed_defs
