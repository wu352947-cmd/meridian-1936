"""Export TopoJSON, lossless province_id.png, terrain_relief.webp, and europe_1936.json."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt
from shapely.geometry import mapping

from config_1936 import (
    ROOT, RAW_DIR, OUT_DIR, WIDTH, HEIGHT, RELIEF_W, RELIEF_H,
    X_MIN, X_MAX, Y_MIN, Y_MAX, PROJ_LAEA, TO_LONLAT,
)


def _decode_topo_rings(topo: dict, arc_indices: list[int]) -> list[tuple[float, float]]:
    tr = topo.get("transform")
    scale = tr["scale"] if tr else [1.0, 1.0]
    trans = tr["translate"] if tr else [0.0, 0.0]
    arcs = topo["arcs"]
    pts: list[tuple[float, float]] = []
    for idx in arc_indices:
        rev = idx < 0
        raw = arcs[~idx if rev else idx]
        coords = []
        x, y = 0.0, 0.0
        for dx, dy in raw:
            x += dx
            y += dy
            coords.append((x * scale[0] + trans[0], y * scale[1] + trans[1]))
        if rev:
            coords.reverse()
        if pts and coords and pts[-1] == coords[0]:
            pts.extend(coords[1:])
        else:
            pts.extend(coords)
    return pts


def _rasterize_topojson(topo: dict, land_ids: set[int]) -> tuple[np.ndarray, dict[int, int]]:
    """Rasterize exact simplified TopoJSON polygons into (H, W) uint16 ID grid without AA."""
    id_img = Image.new("I;16", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(id_img)
    geoms = topo["objects"]["provinces"]["geometries"]

    # Draw sea zones first, then land provinces on top so coastlines are razor crisp
    ordered = sorted(geoms, key=lambda g: (0 if g["properties"]["isSea"] else 1, g["properties"]["id"]))
    for g in ordered:
        pid = int(g["properties"]["id"])
        gtype = g["type"]
        poly_list = [g["arcs"]] if gtype == "Polygon" else (g["arcs"] if gtype == "MultiPolygon" else [])
        for rings in poly_list:
            if not rings:
                continue
            outer = _decode_topo_rings(topo, rings[0])
            if len(outer) >= 3:
                draw.polygon(outer, fill=pid)
            # Carve holes back to 0 so nested enclaves / islands show through
            for hole_arc in rings[1:]:
                hole = _decode_topo_rings(topo, hole_arc)
                if len(hole) >= 3:
                    draw.polygon(hole, fill=0)

    # Re-draw smaller land provinces on top in case any enclave sat inside a hole
    for g in ordered:
        if not g["properties"]["isSea"] and g["properties"].get("areaPx", 9999) < 8000:
            pid = int(g["properties"]["id"])
            gtype = g["type"]
            poly_list = [g["arcs"]] if gtype == "Polygon" else (g["arcs"] if gtype == "MultiPolygon" else [])
            for rings in poly_list:
                outer = _decode_topo_rings(topo, rings[0])
                if len(outer) >= 3:
                    draw.polygon(outer, fill=pid)

    arr = np.array(id_img, dtype=np.uint16)

    # Fill any 0-pixel seam via exact Euclidean nearest-neighbor Voronoi fill
    zero_mask = arr == 0
    if np.any(zero_mask):
        _, nearest_idx = distance_transform_edt(zero_mask, return_indices=True)
        arr[zero_mask] = arr[nearest_idx[0][zero_mask], nearest_idx[1][zero_mask]]

    # Count pixels per province ID
    vals, cnts = np.unique(arr, return_counts=True)
    pixel_counts = {int(v): int(c) for v, c in zip(vals, cnts)}
    return arr, pixel_counts


def _extract_adjacency_and_dist(arr: np.ndarray, land_ids: set[int]):
    """Extract 100% symmetric 4-neighbor adjacency & compute normalized border distance channel."""
    # Horizontal and vertical transitions
    a_h, b_h = arr[:, :-1], arr[:, 1:]
    diff_h = a_h != b_h
    a_v, b_v = arr[:-1, :], arr[1:, :]
    diff_v = a_v != b_v

    pairs = set()
    for p1, p2 in zip(a_h[diff_h].tolist(), b_h[diff_h].tolist()):
        if p1 != p2 and p1 > 0 and p2 > 0:
            pairs.add((min(p1, p2), max(p1, p2)))
    for p1, p2 in zip(a_v[diff_v].tolist(), b_v[diff_v].tolist()):
        if p1 != p2 and p1 > 0 and p2 > 0:
            pairs.add((min(p1, p2), max(p1, p2)))

    adj: dict[int, set[int]] = {}
    for u, v in pairs:
        adj.setdefault(u, set()).add(v)
        adj.setdefault(v, set()).add(u)

    # Distance to coast / ocean boundary for smooth coastal bathymetry & water ripples in shader!
    max_land = max(land_ids) if land_ids else 0
    is_land = (arr > 0) & (arr <= max_land)
    # B channel: on sea = distance to land (0..255 over 0..96px); on land = distance to coast (0..255 over 0..64px)
    sea_dist = distance_transform_edt(~is_land)
    land_dist = distance_transform_edt(is_land)
    b_chan = np.where(
        is_land,
        np.clip(land_dist / 64.0 * 255.0, 0, 255),
        np.clip(sea_dist / 96.0 * 255.0, 0, 255),
    ).astype(np.uint8)
    return adj, b_chan


def _build_terrain_relief(is_land_full: np.ndarray) -> None:
    """Reproject Natural Earth shaded relief + bathymetry to LAEA 2048x1536 + linen fiber grain."""
    gray_src = np.array(Image.open(RAW_DIR / "GRAY_50M_SR_OB" / "GRAY_50M_SR_OB.tif").convert("L"), dtype=np.float32)
    hyp_src = np.array(Image.open(RAW_DIR / "HYP_50M_SR" / "HYP_50M_SR.tif").convert("RGB"), dtype=np.float32)
    gh, gw = gray_src.shape
    hh, hw, _ = hyp_src.shape

    xs = np.linspace(X_MIN + (X_MAX - X_MIN) / (2 * RELIEF_W), X_MAX - (X_MAX - X_MIN) / (2 * RELIEF_W), RELIEF_W)
    ys = np.linspace(Y_MAX - (Y_MAX - Y_MIN) / (2 * RELIEF_H), Y_MIN + (Y_MAX - Y_MIN) / (2 * RELIEF_H), RELIEF_H)
    gx_m, gy_m = np.meshgrid(xs, ys)
    lons, lats = TO_LONLAT.transform(gx_m, gy_m)

    # Sample GRAY_50M_SR_OB and HYP_50M_SR
    u_g = np.clip((lons + 180.0) / 360.0 * (gw - 1), 0, gw - 1).astype(np.int32)
    v_g = np.clip((90.0 - lats) / 180.0 * (gh - 1), 0, gh - 1).astype(np.int32)
    shade = gray_src[v_g, u_g] / 255.0  # 0..1 hillshade + ocean bottom

    u_h = np.clip((lons + 180.0) / 360.0 * (hw - 1), 0, hw - 1).astype(np.int32)
    v_h = np.clip((90.0 - lats) / 180.0 * (hh - 1), 0, hh - 1).astype(np.int32)
    hyp = hyp_src[v_h, u_h] / 255.0

    # Downsample land mask 2x
    land_2x = is_land_full[::2, ::2]
    sea_dist_2x = distance_transform_edt(~land_2x)
    coast_band = np.exp(-sea_dist_2x / 18.0)  # coastal shallows glow
    contour_ring = (np.sin(sea_dist_2x * 0.48) * 0.5 + 0.5) * np.exp(-sea_dist_2x / 26.0)

    # Subtle deterministic linen weave grain (4% amplitude, warm wartime staff paper!)
    yy, xx = np.mgrid[0:RELIEF_H, 0:RELIEF_W]
    rng = np.random.default_rng(1936)
    weave = (
        np.sin(xx * 1.45) * 0.012
        + np.sin(yy * 1.45) * 0.012
        + rng.normal(0.0, 0.016, size=(RELIEF_H, RELIEF_W))
    ).astype(np.float32)

    # Land: warm parchment #EAE2D3 modulated by hillshade & subtle desaturated hypsometric warmth
    paper_r, paper_g, paper_b = 234.0 / 255.0, 226.0 / 255.0, 211.0 / 255.0
    # Boost mountain contrast slightly around neutral 0.78
    relief_mod = np.clip(0.56 + (shade - 0.55) * 1.15, 0.42, 1.12)
    land_r = np.clip((paper_r * 0.78 + hyp[:, :, 0] * 0.22) * relief_mod + weave, 0, 1)
    land_g = np.clip((paper_g * 0.78 + hyp[:, :, 1] * 0.22) * relief_mod + weave, 0, 1)
    land_b = np.clip((paper_b * 0.78 + hyp[:, :, 2] * 0.22) * relief_mod + weave, 0, 1)

    # Sea: deep slate Prussian blue #2B3D4F -> coastal shallows #435B6E + subtle bathymetry & wave ripples
    deep_rgb = np.array([43.0, 61.0, 79.0]) / 255.0
    shallow_rgb = np.array([76.0, 102.0, 120.0]) / 255.0
    bathy_mod = 0.88 + shade * 0.22
    sea_r = np.clip((deep_rgb[0] * (1 - coast_band) + shallow_rgb[0] * coast_band) * bathy_mod + contour_ring * 0.035 + weave * 0.6, 0, 1)
    sea_g = np.clip((deep_rgb[1] * (1 - coast_band) + shallow_rgb[1] * coast_band) * bathy_mod + contour_ring * 0.04 + weave * 0.6, 0, 1)
    sea_b = np.clip((deep_rgb[2] * (1 - coast_band) + shallow_rgb[2] * coast_band) * bathy_mod + contour_ring * 0.045 + weave * 0.6, 0, 1)

    rgb = np.empty((RELIEF_H, RELIEF_W, 3), dtype=np.uint8)
    rgb[:, :, 0] = np.where(land_2x, land_r * 255, sea_r * 255).astype(np.uint8)
    rgb[:, :, 1] = np.where(land_2x, land_g * 255, sea_g * 255).astype(np.uint8)
    rgb[:, :, 2] = np.where(land_2x, land_b * 255, sea_b * 255).astype(np.uint8)

    out_webp = OUT_DIR / "terrain_relief.webp"
    Image.fromarray(rgb, mode="RGB").save(out_webp, format="WEBP", quality=88, method=5)
    print(f"[out] {out_webp} ({out_webp.stat().st_size // 1024} KB)")


def export_all(land_provs: list[dict], sea_provs: list[dict], rivers: list[dict], grat: list[dict], label_curves: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_provs = []
    for i, p in enumerate(land_provs, start=1):
        p["id"] = i
        p["isSea"] = False
        p["areaPx"] = round(float(p["geom"].area), 1)
        all_provs.append(p)
    land_count = len(land_provs)
    for j, s in enumerate(sea_provs, start=land_count + 1):
        rp = s["geom"].representative_point()
        s["id"] = j
        s["isSea"] = True
        s["cx"], s["cy"] = round(rp.x, 1), round(rp.y, 1)
        s["areaPx"] = round(float(s["geom"].area), 1)
        s["nameZh"], s["nameEn"] = s["fixed_name"]
        s["terrain"] = "sea"
        s["vp"] = 0
        s["industry"] = 0
        s["isCapital"] = False
        all_provs.append(s)

    # 1. Write intermediate GeoJSON and compile topology with mapshaper
    tmp_geo = ROOT / ".cache" / "europe_1936_raw.geojson"
    tmp_geo.parent.mkdir(parents=True, exist_ok=True)
    feats = []
    for p in all_provs:
        feats.append({
            "type": "Feature",
            "id": p["id"],
            "properties": {
                "id": p["id"], "owner": p["owner"], "isSea": p["isSea"], "areaPx": p["areaPx"],
            },
            "geometry": mapping(p["geom"]),
        })
    tmp_geo.write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")

    topo_path = OUT_DIR / "topology.topo.json"
    cmd = [
        "npx", "--no-install", "mapshaper", str(tmp_geo),
        "name=provinces",
        "-snap", "interval=0.25",
        "-simplify", "visvalingam", "22%", "keep-shapes",
        "-o", "format=topojson", "quantization=1e5", str(topo_path),
    ]
    print("[mapshaper]", " ".join(cmd))
    subprocess.run(cmd, cwd=str(ROOT), check=True)
    print(f"[out] {topo_path} ({topo_path.stat().st_size // 1024} KB)")

    # 2. Rasterize simplified TopoJSON -> province_id.png & extract exact adjacency
    topo = json.loads(topo_path.read_text(encoding="utf-8"))
    topo_geoms = topo["objects"]["provinces"]["geometries"]
    assert len(topo_geoms) == len(all_provs), f"Topology dropped features: {len(topo_geoms)} != {len(all_provs)}"
    land_ids = set(range(1, land_count + 1))
    id_arr, px_counts = _rasterize_topojson(topo, land_ids)

    missing = [p["id"] for p in all_provs if px_counts.get(p["id"], 0) == 0]
    assert not missing, f"Provinces with 0 pixels in province_id.png: {missing}"

    adj, b_chan = _extract_adjacency_and_dist(id_arr, land_ids)

    rgba = np.empty((HEIGHT, WIDTH, 4), dtype=np.uint8)
    rgba[:, :, 0] = (id_arr & 0xFF).astype(np.uint8)
    rgba[:, :, 1] = ((id_arr >> 8) & 0xFF).astype(np.uint8)
    rgba[:, :, 2] = b_chan
    rgba[:, :, 3] = 255
    id_png = OUT_DIR / "province_id.png"
    Image.fromarray(rgba, mode="RGBA").save(id_png, format="PNG", optimize=True)
    print(f"[out] {id_png} ({id_png.stat().st_size // 1024} KB)")

    # 3. Generate terrain_relief.webp
    is_land_full = (id_arr > 0) & (id_arr <= land_count)
    _build_terrain_relief(is_land_full)

    # 4. Assemble europe_1936.json (province attributes, symmetric neighbors, rivers, graticule, label curves)
    prov_records = []
    for p in all_provs:
        pid = p["id"]
        nbrs = sorted(adj.get(pid, set()))
        is_coastal = (not p["isSea"]) and any(n > land_count for n in nbrs)
        rec = {
            "id": pid,
            "code": p.get("code") or f"{p['owner'].lower()}_{pid}",
            "nameZh": p["nameZh"],
            "nameEn": p["nameEn"],
            "owner": p["owner"],
            "core": p["core"],
            "isSea": p["isSea"],
            "isCoastal": is_coastal,
            "terrain": p["terrain"],
            "cx": p["cx"],
            "cy": p["cy"],
            "areaPx": px_counts.get(pid, 0),
            "vp": p["vp"],
            "industry": p["industry"],
            "neighbors": nbrs,
        }
        if p.get("cityZh"):
            rec["cityZh"] = p["cityZh"]
            rec["cityEn"] = p["cityEn"]
        if p.get("isCapital"):
            rec["isCapital"] = True
        prov_records.append(rec)

    meta = {
        "width": WIDTH,
        "height": HEIGHT,
        "reliefWidth": RELIEF_W,
        "reliefHeight": RELIEF_H,
        "projection": PROJ_LAEA,
        "boundsMeters": [X_MIN, Y_MIN, X_MAX, Y_MAX],
        "landCount": land_count,
        "seaCount": len(sea_provs),
        "provinces": prov_records,
        "rivers": rivers,
        "graticule": grat,
        "labelCurves": label_curves,
    }
    meta_path = OUT_DIR / "europe_1936.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[out] {meta_path} ({meta_path.stat().st_size // 1024} KB)")
    print(f"[summary] {land_count} land provinces + {len(sea_provs)} sea zones = {len(all_provs)} total")
