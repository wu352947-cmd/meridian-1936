#!/usr/bin/env python3
"""Download Natural Earth (Public Domain) datasets into data/raw/."""
import os
import urllib.request
import zipfile
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"

SOURCES = [
    ("ne_10m_admin_0_countries", "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip"),
    ("ne_10m_admin_1_states_provinces", "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip"),
    ("ne_10m_rivers_lake_centerlines", "https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip"),
    ("ne_10m_rivers_europe", "https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_europe.zip"),
    ("ne_10m_lakes", "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip"),
    ("ne_10m_lakes_europe", "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes_europe.zip"),
    ("ne_10m_populated_places_simple", "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip"),
    ("GRAY_50M_SR_OB", "https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_OB.zip"),
    ("HYP_50M_SR", "https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR.zip"),
]


def download_and_extract(name: str, url: str) -> None:
    target_dir = RAW_DIR / name
    marker = target_dir / ".done"
    if marker.exists():
        print(f"[skip] {name} already extracted")
        return
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RAW_DIR / f"{name}.zip"
    if not zip_path.exists():
        print(f"[dl] {name} <- {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "Meridian1936-MapCompiler/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(zip_path, "wb") as out:
            while chunk := resp.read(1 << 16):
                out.write(chunk)
    print(f"[unzip] {name}")
    target_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(target_dir)
    marker.write_text("ok\n", encoding="utf-8")


def main() -> None:
    for name, url in SOURCES:
        download_and_extract(name, url)
    print("[done] Natural Earth raw data ready in", RAW_DIR)


if __name__ == "__main__":
    main()
