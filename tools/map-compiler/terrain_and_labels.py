"""Terrain classification, bilingual province naming, rivers, graticule & curved country labels."""
from __future__ import annotations

import math
import re
import unicodedata
import numpy as np
import shapefile
from PIL import Image
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform as shp_transform, unary_union

from config_1936 import (
    RAW_DIR, WIDTH, HEIGHT, RELIEF_W, RELIEF_H, COUNTRY_NAMES_ZH,
    lonlat_to_px, px_to_lonlat, TO_LONLAT, X_MIN, X_MAX, Y_MIN, Y_MAX,
)
from names_zh import CITY_ZH
from names_zh_east import CITY_ZH_EXTRA


def _norm_city(s: str) -> str:
    s = re.sub(r"\s+", " ", s.strip().lower())
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return s.replace("ł", "l")


ALL_CITIES = {_norm_city(k): v for k, v in {**CITY_ZH, **CITY_ZH_EXTRA}.items()}

DIR_ZH = {
    (0, -1): "北", (1, -1): "东北", (1, 0): "东", (1, 1): "东南",
    (0, 1): "南", (-1, 1): "西南", (-1, 0): "西", (-1, -1): "西北", (0, 0): "中",
}
DIR_EN = {
    (0, -1): "North", (1, -1): "NE", (1, 0): "East", (1, 1): "SE",
    (0, 1): "South", (-1, 1): "SW", (-1, 0): "West", (-1, -1): "NW", (0, 0): "Central",
}
TERRAIN_SUFFIX_ZH = {
    "mountain": "山地", "hills": "丘陵", "forest": "林区",
    "marsh": "湿地", "desert": "荒原", "plains": "平原", "urban": "城区",
}


def classify_terrain(lon: float, lat: float, gray_val: float, hyp_rgb: tuple[float, float, float]) -> str:
    """Classify 7 tactical terrains from hypsometric color, relief roughness & geography."""
    r, g, b = hyp_rgb
    # Major mountain belts: Alps, Pyrenees, Carpathians, Caucasus, Dinaric, Norwegian Keel, Anatolia
    in_alps = (5.5 <= lon <= 16.5 and 44.2 <= lat <= 47.8)
    in_pyrenees = (-1.8 <= lon <= 3.0 and 42.1 <= lat <= 43.3)
    in_carpathians = (19.0 <= lon <= 26.8 and 45.2 <= lat <= 49.4)
    in_caucasus = (39.0 <= lon <= 49.0 and 40.5 <= lat <= 44.0)
    in_norway_mt = (5.5 <= lon <= 19.0 and 60.0 <= lat <= 69.5)
    in_balkans_mt = (16.0 <= lon <= 25.0 and 39.0 <= lat <= 44.5)
    in_apennines = (9.5 <= lon <= 16.2 and 38.5 <= lat <= 44.6)

    # Desert: Sahara, Libyan interior, Arabian/Iraqi interior
    if lat < 33.8 and (lon < 25.0 or lon > 33.5):
        return "desert"
    if lon > 37.5 and lat < 35.5:
        return "desert"
    # Pripyat marshes, Finnish Lakeland marshes, Volga delta
    if (23.5 <= lon <= 30.8 and 51.2 <= lat <= 53.1) or (46.0 <= lon <= 50.0 and 45.5 <= lat <= 47.5):
        return "marsh"

    # High-elevation hypsometric signal (warm brown/white peaks in HYP_50M_SR)
    elev_score = (r - g) + (200.0 - gray_val) * 0.45
    if (in_alps or in_pyrenees or in_caucasus) and (elev_score > 14 or gray_val < 185):
        return "mountain"
    if (in_carpathians or in_norway_mt or in_balkans_mt) and elev_score > 22:
        return "mountain"
    if in_alps or in_pyrenees or in_caucasus or (in_norway_mt and lon < 13.0):
        return "hills"
    if (in_carpathians or in_balkans_mt or in_apennines or (35.5 <= lat <= 41.5 and (-7.5 <= lon <= -1.0 or 28.0 <= lon <= 44.0))) and elev_score > 10:
        return "hills"
    # Scottish Highlands, Wales, Sudeten, Ardennes, Massif Central, Urals
    if (-6.5 <= lon <= -2.5 and 56.2 <= lat <= 58.6) or (12.0 <= lon <= 17.0 and 49.5 <= lat <= 51.0):
        return "hills"
    if (2.0 <= lon <= 4.8 and 44.2 <= lat <= 46.2) or (50.0 <= lon <= 58.0 and 54.0 <= lat <= 64.0):
        return "hills"

    # Boreal & temperate forests (Scandinavia, Finland, Baltics, North Russia, Belarus, Germany/Poland woods)
    if lat >= 56.5 and lon >= 11.5:
        return "forest"
    if (21.0 <= lon <= 45.0 and 53.0 <= lat <= 62.0) and g > r * 0.96:
        return "forest"
    if (5.0 <= lon <= 16.0 and 47.5 <= lat <= 52.0) and (g - b) > 12:
        return "forest"
    return "plains"


def name_and_enrich_provinces(land_provs: list[dict], places: list[dict]) -> None:
    """Assign bilingual names, terrain, VP, industry & capital flag to each land province."""
    gray_img = Image.open(RAW_DIR / "GRAY_50M_SR_OB" / "GRAY_50M_SR_OB.tif").convert("L")
    hyp_img = Image.open(RAW_DIR / "HYP_50M_SR" / "HYP_50M_SR.tif").convert("RGB")
    gw, gh = gray_img.size
    hw, hh = hyp_img.size

    # Compute country centroids for clean directional fallback names
    by_owner: dict[str, list[dict]] = {}
    for p in land_provs:
        by_owner.setdefault(p["owner"], []).append(p)
    owner_center: dict[str, tuple[float, float]] = {}
    for tag, plist in by_owner.items():
        pts = [p["geom"].representative_point() for p in plist]
        owner_center[tag] = (
            sum(pt.x for pt in pts) / len(pts),
            sum(pt.y for pt in pts) / len(pts),
        )

    used_names: dict[str, int] = {}
    for p in land_provs:
        geom = p["geom"]
        rp = geom.representative_point()
        p["cx"], p["cy"] = round(rp.x, 1), round(rp.y, 1)
        lon, lat = px_to_lonlat(rp.x, rp.y)

        # Sample raster relief
        gx = int(np.clip((lon + 180.0) / 360.0 * gw, 0, gw - 1))
        gy = int(np.clip((90.0 - lat) / 180.0 * gh, 0, gh - 1))
        gray_val = float(gray_img.getpixel((gx, gy)))
        hx = int(np.clip((lon + 180.0) / 360.0 * hw, 0, hw - 1))
        hy = int(np.clip((90.0 - lat) / 180.0 * hh, 0, hh - 1))
        hyp_rgb = tuple(float(v) for v in hyp_img.getpixel((hx, hy)))

        terrain = p.get("fixed_terrain") or classify_terrain(lon, lat, gray_val, hyp_rgb)
        # Find top populated place inside this province
        matched_city = None
        for c in places:
            if geom.contains(c["pt"]):
                matched_city = c
                break

        owner = p["owner"]
        c_zh, c_en = COUNTRY_NAMES_ZH.get(owner, (owner, owner))

        if p.get("fixed_name"):
            nzh, nen = p["fixed_name"]
            vp = p.get("fixed_vp", 5)
            ind = p.get("fixed_industry", 4)
            is_cap = bool(p.get("fixed_capital", False))
            if matched_city and _norm_city(matched_city["name"]) in ALL_CITIES:
                p["cityZh"], p["cityEn"] = nzh, nen
        elif matched_city:
            key = _norm_city(matched_city["name"])
            if owner == "FRA" and key == "brest":
                key = "brest-fra"
            if key in ALL_CITIES:
                nzh, nen, is_urb, vp, is_cap = ALL_CITIES[key]
                if is_urb:
                    terrain = "urban"
                ind = max(2, min(12, vp // 2))
                p["cityZh"], p["cityEn"] = nzh, nen
            else:
                # Fallback directional Chinese + real English city name
                ocx, ocy = owner_center[owner]
                dx, dy = rp.x - ocx, rp.y - ocy
                sx = 0 if abs(dx) < 55 else (1 if dx > 0 else -1)
                sy = 0 if abs(dy) < 55 else (1 if dy > 0 else -1)
                nzh = f"{c_zh}{DIR_ZH[(sx, sy)]}{TERRAIN_SUFFIX_ZH.get(terrain, '地区')}"
                nen = matched_city["name"]
                vp = 3 if matched_city["pop"] > 150000 else 1
                ind = 3 if matched_city["pop"] > 150000 else 1
                is_cap = False
        else:
            ocx, ocy = owner_center[owner]
            dx, dy = rp.x - ocx, rp.y - ocy
            sx = 0 if abs(dx) < 55 else (1 if dx > 0 else -1)
            sy = 0 if abs(dy) < 55 else (1 if dy > 0 else -1)
            nzh = f"{c_zh}{DIR_ZH[(sx, sy)]}{TERRAIN_SUFFIX_ZH.get(terrain, '地区')}"
            nen = f"{DIR_EN[(sx, sy)]} {c_en}"
            vp, ind, is_cap = 1, 1, False

        # Ensure unique Chinese province name
        cnt = used_names.get(nzh, 0) + 1
        used_names[nzh] = cnt
        if cnt > 1:
            nzh = f"{nzh}·{['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'][min(cnt - 2, 9)]}"

        p["nameZh"] = nzh
        p["nameEn"] = nen
        p["terrain"] = terrain
        p["vp"] = vp
        p["industry"] = ind
        p["isCapital"] = is_cap


def build_rivers_and_graticule() -> tuple[list[dict], list[dict]]:
    """Extract European major rivers and 10-degree LAEA graticule polylines."""
    frame = box(0, 0, WIDTH, HEIGHT)
    rivers: list[dict] = []
    for fname in [
        RAW_DIR / "ne_10m_rivers_lake_centerlines" / "ne_10m_rivers_lake_centerlines.shp",
        RAW_DIR / "ne_10m_rivers_europe" / "ne_10m_rivers_europe.shp",
    ]:
        sf = shapefile.Reader(str(fname))
        fields = [f[0] for f in sf.fields[1:]]
        i_nm = fields.index("name")
        i_sr = fields.index("scalerank")
        for sr in sf.iterShapeRecords():
            rank = int(sr.record[i_sr] or 9)
            if rank > 7:
                continue
            bx = sr.shape.bbox
            if bx[2] < -24 or bx[0] > 60 or bx[3] < 26 or bx[1] > 72:
                continue
            g = shp_transform(lonlat_to_px, shape(sr.shape.__geo_interface__)).intersection(frame)
            if g.is_empty:
                continue
            lines = [g] if g.geom_type == "LineString" else [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]
            for ln in lines:
                ln_s = ln.simplify(2.2, preserve_topology=False)
                if ln_s.length < 28.0:
                    continue
                pts = [[round(x, 1), round(y, 1)] for x, y in ln_s.coords]
                rivers.append({"name": str(sr.record[i_nm] or ""), "rank": 1 if rank <= 4 else 2, "points": pts})

    # 10-degree graticule curves
    grat: list[dict] = []
    for lat in range(30, 75, 10):
        pts = [lonlat_to_px(lon, lat) for lon in range(-28, 66, 2)]
        ln = LineString(pts).intersection(frame)
        if not ln.is_empty and ln.geom_type == "LineString":
            grat.append({"kind": "lat", "deg": lat, "points": [[round(x, 1), round(y, 1)] for x, y in ln.coords]})
    for lon in range(-20, 65, 10):
        pts = [lonlat_to_px(lon, lat) for lat in range(25, 76, 2)]
        ln = LineString(pts).intersection(frame)
        if not ln.is_empty and ln.geom_type == "LineString":
            grat.append({"kind": "lon", "deg": lon, "points": [[round(x, 1), round(y, 1)] for x, y in ln.coords]})
    return rivers, grat
