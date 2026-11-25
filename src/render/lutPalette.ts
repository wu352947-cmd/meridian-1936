import { COUNTRIES_1936, TERRAIN_INFO } from '../data/countries1936';
import { getRegionDefByProvince } from '../sim/data/regions1936';
import type { RegionDynamicSnap } from '../sim/systems/industryTypes';
import { getProvinceSeasonCondition } from '../sim/systems/weatherSystem';
import type { MapMode, ProvinceRecord } from '../types/map';

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Build deterministic ownerTag -> numeric ownerIndex (1..254, 0 = sea). */
export function buildOwnerIndexMap(provinces: ProvinceRecord[]): Map<string, number> {
  const tags = Array.from(new Set(provinces.filter((p) => !p.isSea).map((p) => p.owner))).sort();
  const map = new Map<string, number>();
  map.set('SEA', 0);
  tags.forEach((tag, i) => {
    map.set(tag, (i % 250) + 1);
  });
  return map;
}

/** Industry choropleth color scale by live Region factory density (parchment -> gold -> copper -> foundry). */
function regionIndustryColor(reg: RegionDynamicSnap | null, fallbackInd: number, vp: number): [number, number, number] {
  if (reg) {
    const facs = reg.civ + reg.mil + reg.doc + reg.synth;
    if (facs <= 1) return [218, 210, 193];
    if (facs <= 3) return [196, 174, 128];
    if (facs <= 5) return [184, 126, 74];
    return [158, 76, 58];
  }
  const score = Math.min(1, (fallbackInd * 1.15 + vp * 0.25) / 16);
  if (score < 0.22) return [218, 210, 193];
  if (score < 0.48) return [196, 174, 128];
  if (score < 0.74) return [184, 126, 74];
  return [158, 76, 58];
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}

function lerpRgb3(
  low: [number, number, number],
  mid: [number, number, number],
  high: [number, number, number],
  t: number,
): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return u < 0.5 ? lerpRgb(low, mid, u * 2) : lerpRgb(mid, high, (u - 0.5) * 2);
}

/**
 * Live M3 supply choropleth with monotonic within-band luminance & next-band hue ramps
 * (brightest at S=100/79/39 hubs, smoothly darkening & leaning toward the next tier as S falls):
 *  - Standard: Emerald (80-100) -> Amber (40-79) -> Rust Red (1-39) -> Cut-off Dark Crimson (0, hatched)
 *  - Colorblind (Okabe-Ito): Cerulean/Cobalt (80-100) -> Silver/Warm-Slate (40-79) -> Vermilion Orange (1-39) -> Deep Charcoal (0, hatched)
 */
function supplyLiveColor(supplyVal: number, colorblind: boolean): [number, number, number] {
  const s = Math.max(0, Math.min(100, supplyVal));
  if (colorblind) {
    if (s === 0) return [30, 38, 50];
    if (s < 40) return lerpRgb3([144, 52, 14], [206, 98, 22], [240, 152, 52], (s - 1) / 38);
    if (s < 80) return lerpRgb3([142, 118, 92], [176, 170, 154], [216, 218, 212], (s - 40) / 39);
    return lerpRgb3([54, 96, 136], [46, 138, 202], [90, 188, 244], (s - 80) / 20);
  }
  if (s === 0) return [52, 20, 20];
  if (s < 40) return lerpRgb3([108, 30, 28], [164, 58, 44], [208, 96, 62], (s - 1) / 38);
  if (s < 80) return lerpRgb3([166, 94, 42], [212, 154, 62], [240, 210, 108], (s - 40) / 39);
  return lerpRgb3([88, 116, 52], [62, 156, 80], [98, 214, 120], (s - 80) / 20);
}

/** Placeholder air/sea strategic theater preview (Batch 02 preview; full air/navy in Batch 10). */
function airSeaPreviewColor(p: ProvinceRecord): [number, number, number] {
  if (p.isCapital || p.vp >= 12) return [84, 124, 166];
  if (p.isCoastal) return [114, 146, 170];
  return [168, 164, 154];
}

/** Diplomacy lens color relative to selected country (or faction blocs if none selected). */
function diplomacyColor(
  p: ProvinceRecord,
  focusOwner: string | null,
): [number, number, number] {
  const info = COUNTRIES_1936[p.owner];
  if (!info) return [184, 178, 168];

  if (!focusOwner || focusOwner === 'SEA') {
    if (info.faction === 'allies') return [75, 112, 152];
    if (info.faction === 'axis') return [156, 72, 66];
    if (info.faction === 'comintern') return [150, 62, 58];
    if (info.isEdge) return [192, 184, 168];
    return [168, 160, 145];
  }

  if (p.owner === focusOwner) return [78, 138, 87]; // Own nation emerald
  const focusInfo = COUNTRIES_1936[focusOwner];
  if (focusInfo && info.faction !== 'neutral' && info.faction === focusInfo.faction) {
    return [84, 132, 176]; // Same faction sky slate
  }
  // Historical 1936 tension hints (non-binding preview for Batch 01 diplomacy mapmode)
  const rivals: Record<string, string[]> = {
    GER: ['FRA', 'POL', 'CZE', 'SOV'],
    FRA: ['GER', 'ITA'],
    GBR: ['GER', 'ITA'],
    POL: ['GER', 'SOV'],
    SOV: ['GER', 'POL', 'FIN'],
    ITA: ['GBR', 'FRA', 'YUG'],
    CZE: ['GER', 'HUN'],
  };
  if (rivals[focusOwner]?.includes(p.owner)) return [184, 82, 68];
  if (info.isEdge) return [188, 182, 168];
  return [176, 168, 154];
}

export interface LutUpdateOptions {
  provinces: ProvinceRecord[];
  ownerIdx: Map<string, number>;
  mode: MapMode;
  selectedProvId: number | null;
  selectedOwner: string | null;
  hoveredProvId: number | null;
  regionsById?: ReadonlyMap<number, RegionDynamicSnap>;
  controllerByProv?: ReadonlyMap<number, string>;
  supplyByProv?: Uint8Array | null;
  colorblind?: boolean;
  simTick?: number;
  primaryBuf: Uint8Array;
  secondaryBuf: Uint8Array;
  occupierBuf?: Uint8Array;
}

/**
 * Fill the 4096x1 RGBA primary, secondary, and occupier LUT buffers in O(N) (<0.1ms).
 * primary:   RGB = fill color, A = fill strength hint (255 = land, 0 = sea)
 * secondary: R = effectiveControllerIndex (0..255),
 *            G = bit7=selectedCountry | bit6=constructing | bit5=supplyZero | bits0..1=weather(0/1=winter/2=mud),
 *            B = selectedProv, A = hoveredProv
 * occupier:  RGB = occupier color when militarily occupied (controller !== coreOwner), A = 255 occupied / 0 normal
 */
export function fillProvinceLuts(opts: LutUpdateOptions): void {
  const {
    provinces, ownerIdx, mode, selectedProvId, selectedOwner, hoveredProvId,
    regionsById, controllerByProv, supplyByProv, colorblind = false, simTick = 0,
    primaryBuf, secondaryBuf, occupierBuf,
  } = opts;
  primaryBuf.fill(0);
  secondaryBuf.fill(0);
  occupierBuf?.fill(0);

  for (const p of provinces) {
    const off = p.id * 4;
    if (p.isSea) {
      primaryBuf[off] = 43;
      primaryBuf[off + 1] = 61;
      primaryBuf[off + 2] = 79;
      primaryBuf[off + 3] = 0; // sea marker
      secondaryBuf[off] = 0;
      secondaryBuf[off + 1] = 0;
      secondaryBuf[off + 2] = p.id === selectedProvId ? 255 : 0;
      secondaryBuf[off + 3] = p.id === hoveredProvId ? 255 : 0;
      continue;
    }

    const regDef = getRegionDefByProvince(p.id);
    const regDyn = regDef && regionsById ? (regionsById.get(regDef.id) ?? null) : null;

    const supVal = supplyByProv && p.id < supplyByProv.length ? supplyByProv[p.id]! : 75;
    let rgb: [number, number, number];
    if (mode === 'political') {
      const c = COUNTRIES_1936[p.owner];
      rgb = hexToRgb(c?.color ?? '#B8B0A0');
    } else if (mode === 'terrain') {
      // Soften urban fill in terrain mode so macro terrain relief reads organically without bright pink patches
      if (p.terrain === 'urban') {
        rgb = [204, 178, 152];
      } else {
        const t = TERRAIN_INFO[p.terrain];
        rgb = hexToRgb(t?.color ?? '#E5DEC9');
      }
    } else if (mode === 'supply') {
      rgb = supplyLiveColor(supVal, colorblind);
    } else if (mode === 'diplomacy') {
      rgb = diplomacyColor(p, selectedOwner);
    } else if (mode === 'air_sea') {
      rgb = airSeaPreviewColor(p);
    } else {
      rgb = regionIndustryColor(regDyn, p.industry, p.vp);
    }

    primaryBuf[off] = rgb[0];
    primaryBuf[off + 1] = rgb[1];
    primaryBuf[off + 2] = rgb[2];
    primaryBuf[off + 3] = 255;

    const ctrl = controllerByProv?.get(p.id) ?? p.owner;
    const selFlag = selectedOwner && ctrl === selectedOwner ? 128 : 0;
    const buildFlag = regDyn && regDyn.activeBuilding ? 64 : 0;
    const zeroSupFlag = mode === 'supply' && supVal === 0 ? 32 : 0;
    const wx = getProvinceSeasonCondition(p.id, simTick);
    const wxBits = wx === 'winter' ? 1 : wx === 'mud' ? 2 : 0;
    secondaryBuf[off] = ownerIdx.get(ctrl) ?? 254;
    secondaryBuf[off + 1] = selFlag | buildFlag | zeroSupFlag | wxBits;
    secondaryBuf[off + 2] = p.id === selectedProvId ? 255 : 0;
    secondaryBuf[off + 3] = p.id === hoveredProvId ? 255 : 0;

    if (occupierBuf && ctrl !== p.owner) {
      const occRgb = hexToRgb(COUNTRIES_1936[ctrl]?.color ?? '#8C6239');
      occupierBuf[off] = occRgb[0];
      occupierBuf[off + 1] = occRgb[1];
      occupierBuf[off + 2] = occRgb[2];
      occupierBuf[off + 3] = 255;
    }
  }
}
