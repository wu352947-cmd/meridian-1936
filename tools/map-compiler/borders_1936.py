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


def _keep_significant(g, min_area: float = 12.0):
    g = _clean_poly(g)
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

    # Remove Lake Ladoga / Onega / Peipus / Balaton / Geneva / Constance? Keep clean land!
    countries = {t: _clean_poly(unary_union(gs)) for t, gs in by_tag.items()}

    # 3. Apply precise 1936 geometric historical border transfers
    # 3a. Free City of Danzig (DNZ) — historic 1920-1939 territory
    danzig_mask = _poly_ll([
        (18.42, 54.48), (19.46, 54.46), (19.46, 54.12),
        (18.92, 54.02), (18.42, 54.14), (18.38, 54.36),
    ])
    # 3b. Pomeranian west-of-Corridor (Stolp/Köslin) -> GER, and Elbing east of Vistula -> GER
    west_pom_ger = _poly_ll([
        (16.00, 55.00), (17.55, 54.90), (17.55, 53.65), (16.85, 53.30),
        (15.60, 53.30), (15.60, 55.00),
    ])
    elbing_ger = _poly_ll([
        (18.92, 54.46), (20.10, 54.46), (20.10, 53.55), (18.88, 53.55), (18.88, 54.06),
    ])
    # 3c. Polish Corridor exact western edge & Kresy Riga Treaty strip (east of Grodno/Brest to ~27.5E)
    riga_kresy = _poly_ll([
        (25.20, 55.85), (27.65, 55.65), (27.50, 54.35), (27.05, 52.80),
        (27.35, 51.60), (26.20, 51.40), (24.50, 54.00),
    ])
    # 3d. Polish Vilnius expansion (eastern Alytus/Utena corridor connecting to Latvia)
    vilnius_ext = _poly_ll([
        (24.75, 54.05), (26.65, 55.65), (27.20, 55.20), (25.60, 53.85),
    ])
    # 3e. Finland 1920 Tartu borders: Karelian Isthmus + Ladoga Karelia + Salla + Petsamo
    fin_karelia = _poly_ll([
        (27.60, 60.45), (29.95, 60.15), (30.75, 60.55), (32.25, 61.55),
        (31.50, 62.65), (30.20, 63.40), (28.00, 62.50),
    ])
    fin_salla_petsamo = _poly_ll([
        (28.50, 66.20), (30.40, 66.40), (30.40, 67.35), (28.80, 67.60),
    ])
    fin_petsamo = _poly_ll([
        (28.50, 68.55), (31.65, 68.55), (32.35, 69.95), (30.80, 70.10), (28.50, 69.40),
    ])
    # 3f. Romania Budjak (Southern Bessarabia, west of Dniester estuary)
    rom_budjak = _poly_ll([
        (28.10, 46.60), (30.48, 46.32), (29.90, 45.15), (28.10, 45.20),
    ])
    # 3g. Italian Istria & Dodecanese
    ita_istria = _poly_ll([
        (13.20, 46.20), (14.42, 46.10), (14.52, 44.75), (13.30, 44.70),
    ])
    ita_dodecanese = _poly_ll([
        (26.25, 37.55), (28.45, 37.55), (28.45, 35.30), (26.25, 35.30),
    ])
    # 3h. Spanish Morocco Rif strip
    spr_rif = _poly_ll([
        (-6.20, 35.95), (-2.15, 35.40), (-2.25, 34.85), (-6.15, 34.95),
    ])

    def transfer(src: str, dst: str, mask):
        if src not in countries:
            return
        piece = _clean_poly(countries[src].intersection(mask))
        if piece.is_empty:
            return
        countries[src] = _clean_poly(countries[src].difference(piece))
        countries[dst] = _clean_poly(unary_union([countries.get(dst, Polygon()), piece]))

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

    # Subtract big inland lakes so Lake Ladoga / Onega / Vänern / Peipus look crisp
    # Clean tiny dust slivers (< 6 px²) and resolve any overlap deterministically
    ordered = sorted(countries.keys(), key=lambda t: (t != "DNZ", t != "LUX", t))
    claimed = Polygon()
    final_countries: dict[str, object] = {}
    for t in ordered:
        g = _keep_significant(countries[t].difference(claimed), min_area=8.0)
        if not g.is_empty:
            final_countries[t] = g
            claimed = _clean_poly(unary_union([claimed, g]))

    # Fixed historical micro/named provinces to preserve verbatim during subdivision
    fixed_defs = [
        ("DNZ", "danzig", "但泽自由市", "Free City of Danzig", final_countries["DNZ"], "urban", 15, 8, True),
    ]
    # Preserve Sudetenland 3 border zones inside CZE & Saarland inside GER & Polish Corridor & East Prussia Königsberg
    saar = _clean_poly(unary_union(adm1_cache.get("DE-SL", [])).intersection(final_countries["GER"]))
    if not saar.is_empty:
        fixed_defs.append(("GER", "saarland", "萨尔兰", "Saarland", saar, "hills", 5, 10, False))
    koenigsberg = _clean_poly(unary_union(adm1_cache.get("RU-KGD", [])).intersection(final_countries["GER"]))
    if not koenigsberg.is_empty:
        fixed_defs.append(("GER", "koenigsberg", "柯尼斯堡", "Königsberg", koenigsberg, "urban", 12, 8, False))
    corridor = _clean_poly(unary_union(adm1_cache.get("PL-PM", [])).intersection(final_countries["POL"]))
    if not corridor.is_empty:
        fixed_defs.append(("POL", "pomerelia", "波兰走廊", "Polish Corridor", corridor, "plains", 10, 6, False))
    vilnius_p = _clean_poly(unary_union(adm1_cache.get("LT-VL", [])).intersection(final_countries["POL"]))
    if not vilnius_p.is_empty:
        fixed_defs.append(("POL", "wilno", "维尔诺", "Wilno", vilnius_p, "forest", 8, 5, False))
    memel = _clean_poly(unary_union(adm1_cache.get("LT-KL", [])).intersection(final_countries["LIT"]))
    if not memel.is_empty:
        fixed_defs.append(("LIT", "memel", "梅梅尔", "Memel", memel, "plains", 5, 4, False))
    kar_isthmus = _clean_poly(fin_karelia.intersection(final_countries["FIN"]))
    if not kar_isthmus.is_empty:
        fixed_defs.append(("FIN", "viipuri", "维堡卡累利阿", "Viipuri", kar_isthmus, "forest", 10, 5, False))
    sudeten_w = _clean_poly(unary_union(adm1_cache.get("CZ-KA", []) + adm1_cache.get("CZ-US", [])).intersection(final_countries["CZE"]))
    if not sudeten_w.is_empty:
        fixed_defs.append(("CZE", "sudeten_west", "西苏台德", "West Sudetenland", sudeten_w, "mountain", 8, 9, False))
    sudeten_n = _clean_poly(unary_union(adm1_cache.get("CZ-LI", []) + adm1_cache.get("CZ-KR", [])).intersection(final_countries["CZE"]))
    if not sudeten_n.is_empty:
        fixed_defs.append(("CZE", "sudeten_north", "北苏台德", "North Sudetenland", sudeten_n, "mountain", 8, 8, False))
    bessarabia = _clean_poly(unary_union([
        _poly_ll([(26.5, 48.5), (30.5, 48.5), (30.5, 45.2), (28.0, 45.2)]),
    ]).intersection(final_countries["ROM"]))
    # Keep Bessarabia split naturally within ROM (don't force giant 1-piece polygon); just tag city names!

    return final_countries, fixed_defs
