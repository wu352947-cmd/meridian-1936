#!/usr/bin/env python3
"""Master entrypoint for compiling Natural Earth -> Meridian 1936 Europe map assets."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from download_raw import main as download_raw
from borders_1936 import build_1936_geometries
from subdivide_provinces import load_populated_places, subdivide_all
from terrain_and_labels import name_and_enrich_provinces, build_rivers_and_graticule
from label_curves import compute_country_label_curves
from export_outputs import export_all


def main() -> None:
    print("=== Meridian 1936 Map Compiler ===")
    download_raw()
    print("[1/5] Building 1936 historical borders...")
    countries, fixed_defs = build_1936_geometries()
    print(f"      {len(countries)} entities, {len(fixed_defs)} fixed historical provinces")

    print("[2/5] Subdividing countries into provinces & sea zones...")
    places = load_populated_places()
    land_provs, sea_provs, admin1_units = subdivide_all(countries, fixed_defs, places)
    print(f"      {len(land_provs)} land + {len(sea_provs)} sea")

    print("[3/5] Classifying terrain, naming provinces & extracting rivers...")
    name_and_enrich_provinces(land_provs, places, admin1_units)
    rivers, graticule = build_rivers_and_graticule()
    print(f"      {len(rivers)} river segments, {len(graticule)} graticule curves")

    print("[4/5] Computing curved country label Bezier splines...")
    label_curves = compute_country_label_curves(countries)
    print(f"      {len(label_curves)} country label curves")

    print("[5/5] Exporting TopoJSON, province_id.png, terrain_relief.webp & metadata...")
    export_all(land_provs, sea_provs, rivers, graticule, label_curves)
    print("=== Map compilation complete! ===")


if __name__ == "__main__":
    main()
