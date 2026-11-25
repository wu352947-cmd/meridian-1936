/**
 * Deterministic 1936 European Climate Zones Table (Carbon §4.1 / Batch 07 §2).
 *
 * Four deterministic geographic climate zones:
 *  - west_temperate   (西欧温带): Western & Central Europe (GER/FRA/GBR/BEL/HOL/CZE/AUS/SWI/DEN/IRE/etc.)
 *  - med_arid         (地中海/北非干旱): Mediterranean basin, Iberia, Anatolia, Levant & North Africa
 *  - nordic_subarctic (北欧亚寒带): Finland, Sweden, Norway, Iceland & Arctic Russia (cy < 620)
 *  - east_continental (东欧大陆性): Poland, Baltics, Romania, Hungary & European USSR
 *
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { SIM_PROVINCES, type SimProvince } from './provinces1936';

export type ClimateZone =
  | 'west_temperate'
  | 'med_arid'
  | 'nordic_subarctic'
  | 'east_continental';

export const CLIMATE_ZONE_CODE: Readonly<Record<ClimateZone, number>> = {
  west_temperate: 0,
  med_arid: 1,
  nordic_subarctic: 2,
  east_continental: 3,
};

export const CLIMATE_ZONE_BY_CODE: readonly ClimateZone[] = [
  'west_temperate',
  'med_arid',
  'nordic_subarctic',
  'east_continental',
];

export const CLIMATE_ZONE_META: Readonly<
  Record<ClimateZone, { nameZh: string; shortZh: string; descZh: string }>
> = {
  west_temperate: {
    nameZh: '西欧温带气候',
    shortZh: '西欧',
    descZh: '四季温和，全年无泥泞或严冬减益',
  },
  med_arid: {
    nameZh: '地中海 / 北非干旱带',
    shortZh: '地中海',
    descZh: '干热少雪，无东欧翻浆与严冬惩罚',
  },
  nordic_subarctic: {
    nameZh: '北欧亚寒带',
    shortZh: '北欧',
    descZh: '12–2 月严冬：非山地旅进攻 −25%，缺补给损耗翻倍',
  },
  east_continental: {
    nameZh: '东欧大陆性气候',
    shortZh: '东欧',
    descZh: '4 月及 10 月下半月泥泞季；12–2 月严冬',
  },
};

/** Nations with intrinsic winter resilience offsetting half of severe-winter penalties (§4.1). */
export const COLD_RESISTANT_TAGS: ReadonlySet<string> = new Set(['FIN', 'SOV']);

const NORDIC_OWNERS = new Set(['FIN', 'SWE', 'NOR', 'ISL']);
const EAST_OWNERS = new Set(['POL', 'LIT', 'LAT', 'EST', 'ROM', 'HUN']);
const MED_OWNERS = new Set(['ITA', 'SPR', 'POR', 'GRE', 'TUR', 'ALB', 'IRQ', 'IRN', 'SAU']);

function classifyProvinceClimate(p: SimProvince): ClimateZone {
  if (NORDIC_OWNERS.has(p.owner)) return 'nordic_subarctic';
  if (p.owner === 'SOV') {
    return p.cy < 620 ? 'nordic_subarctic' : 'east_continental';
  }
  if (EAST_OWNERS.has(p.owner)) return 'east_continental';
  if (MED_OWNERS.has(p.owner)) return 'med_arid';
  if (p.owner === 'FRA' && p.cy >= 2350) return 'med_arid';
  if (p.owner === 'GBR' && (p.cy >= 2350 || p.cx >= 2600)) return 'med_arid';
  if (p.owner === 'YUG' && p.cy >= 2180) return 'med_arid';
  return 'west_temperate';
}

const MAX_ID = SIM_PROVINCES.reduce((m, p) => Math.max(m, p.id), 0);

/** Dense provId -> ClimateZone code (0..3) table for O(1) lookup in sim & renderer. */
export const CLIMATE_ZONE_BY_PROV = new Uint8Array(MAX_ID + 1);

for (const p of SIM_PROVINCES) {
  CLIMATE_ZONE_BY_PROV[p.id] = CLIMATE_ZONE_CODE[classifyProvinceClimate(p)];
}

export function getProvinceClimateZone(provId: number): ClimateZone {
  if (provId < 0 || provId >= CLIMATE_ZONE_BY_PROV.length) return 'west_temperate';
  return CLIMATE_ZONE_BY_CODE[CLIMATE_ZONE_BY_PROV[provId]!] ?? 'west_temperate';
}

export function isColdResistantNation(tag: string): boolean {
  return COLD_RESISTANT_TAGS.has(tag);
}
