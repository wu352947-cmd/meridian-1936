import { COUNTRIES_1936, TERRAIN_INFO } from '../data/countries1936';
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

/** Industry choropleth color scale (low parchment -> amber -> warm brass-terracotta). */
function industryColor(ind: number, vp: number): [number, number, number] {
  const score = Math.min(1, (ind * 1.15 + vp * 0.25) / 16);
  // 4-stop warm archival heat ramp
  if (score < 0.22) return [218, 210, 193];
  if (score < 0.48) return [196, 174, 128];
  if (score < 0.74) return [184, 126, 74];
  return [158, 76, 58];
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
  primaryBuf: Uint8Array;
  secondaryBuf: Uint8Array;
}

/**
 * Fill the 4096x1 RGBA primary and secondary LUT buffers in O(N) (<0.1ms).
 * primary:   RGB = fill color, A = fill strength hint (255 = land, 0 = sea)
 * secondary: R = ownerIndex (0..255), G = selectedCountry (0/255), B = selectedProv (0/255), A = hoveredProv (0/255)
 */
export function fillProvinceLuts(opts: LutUpdateOptions): void {
  const { provinces, ownerIdx, mode, selectedProvId, selectedOwner, hoveredProvId, primaryBuf, secondaryBuf } = opts;
  primaryBuf.fill(0);
  secondaryBuf.fill(0);

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
    } else if (mode === 'diplomacy') {
      rgb = diplomacyColor(p, selectedOwner);
    } else {
      rgb = industryColor(p.industry, p.vp);
    }

    primaryBuf[off] = rgb[0];
    primaryBuf[off + 1] = rgb[1];
    primaryBuf[off + 2] = rgb[2];
    primaryBuf[off + 3] = 255;

    secondaryBuf[off] = ownerIdx.get(p.owner) ?? 254;
    secondaryBuf[off + 1] = selectedOwner && p.owner === selectedOwner ? 255 : 0;
    secondaryBuf[off + 2] = p.id === selectedProvId ? 255 : 0;
    secondaryBuf[off + 3] = p.id === hoveredProvId ? 255 : 0;
  }
}
