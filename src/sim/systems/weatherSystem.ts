/**
 * Deterministic Seasonal Climate, Mud (Rasputitsa), Severe Winter & Night Tick System
 * (Carbon §4.1 / Batch 07 §2). Pure TypeScript fixed-point — zero DOM/PIXI references.
 */
import { tickToDate } from '../core/ClockCalendar';
import { FIXED_SCALE } from '../core/FixedMath';
import type { BrigadeType } from '../data/brigadeTemplates';
import {
  CLIMATE_ZONE_META,
  getProvinceClimateZone,
  isColdResistantNation,
  type ClimateZone,
} from '../data/climateZones1936';

export type SeasonCondition = 'normal' | 'mud' | 'winter';

export const WEATHER_DEFINES = {
  /** East Europe mud (April & Oct 16-31): march -40%, ARM/MOT attack -35%. */
  mudMarchMultPermille: 600,
  mudMechAttackMultPermille: 650,
  /** East Europe & Nordic severe winter (Dec-Feb): non-MTN attack -25%, attrition x2.0. */
  winterAttackPenaltyPermille: 250,
  winterAttritionExtraPermille: 1000, // +100% -> x2.0 total
  /** 18:00 Night Tick: land attack x0.75, air sortie x0.50 (interface for Batch 10). */
  nightLandAttackMultPermille: 750,
  nightAirSortieMultPermille: 500,
  /** AI armored offensive weight reduction under mud/severe winter (x0.40). */
  adverseArmorAiWeightPermille: 400,
} as const;

export interface WeatherCombatEffect {
  condition: SeasonCondition;
  zone: ClimateZone;
  attackMultPermille: number;
  labelZh: string;
  noteZh: string;
}

export interface TheaterSeasonSummary {
  eastCondition: SeasonCondition;
  nordicCondition: SeasonCondition;
  isNight: boolean;
  activeBadgeZh: string;
  activeDetailZh: string;
  nextChangeDateIso: string;
  nextChangeLabelZh: string;
}

/** Determine seasonal condition for a climate zone on a given (month, day). */
export function getZoneSeasonCondition(zone: ClimateZone, month: number, day: number): SeasonCondition {
  if (zone === 'east_continental') {
    if (month === 12 || month === 1 || month === 2) return 'winter';
    if (month === 4 || (month === 10 && day >= 16)) return 'mud';
    return 'normal';
  }
  if (zone === 'nordic_subarctic') {
    if (month === 12 || month === 1 || month === 2) return 'winter';
    return 'normal';
  }
  return 'normal';
}

export function getProvinceSeasonCondition(provId: number, tick: number): SeasonCondition {
  const d = tickToDate(tick);
  return getZoneSeasonCondition(getProvinceClimateZone(provId), d.month, d.day);
}

/** Land march speed multiplier from seasonal weather (permille: 600 in East mud, else 1000). */
export function getWeatherMarchMultPermille(provId: number, tick: number): number {
  return getProvinceSeasonCondition(provId, tick) === 'mud'
    ? WEATHER_DEFINES.mudMarchMultPermille
    : FIXED_SCALE;
}

/** Severe winter attrition multiplier (permille: 1000 normal, 2000 winter, 1500 FIN/SOV or MTN). */
export function getWinterAttritionMultPermille(
  provId: number,
  ownerTag: string,
  template: BrigadeType,
  tick: number,
): number {
  if (getProvinceSeasonCondition(provId, tick) !== 'winter') return FIXED_SCALE;
  let extra: number = WEATHER_DEFINES.winterAttritionExtraPermille;
  if (isColdResistantNation(ownerTag)) extra = Math.floor(extra / 2);
  if (template === 'MTN') extra = Math.floor(extra / 2);
  return FIXED_SCALE + extra;
}

/** Seasonal weather attack multiplier for a brigade fighting in targetProvId. */
export function getWeatherCombatEffect(
  provId: number,
  ownerTag: string,
  template: BrigadeType,
  isAttacking: boolean,
  tick: number,
): WeatherCombatEffect {
  const zone = getProvinceClimateZone(provId);
  const cond = getProvinceSeasonCondition(provId, tick);
  const zShort = CLIMATE_ZONE_META[zone].shortZh;

  if (cond === 'mud') {
    if (isAttacking && (template === 'ARM' || template === 'MOT')) {
      return {
        condition: 'mud',
        zone,
        attackMultPermille: WEATHER_DEFINES.mudMechAttackMultPermille,
        labelZh: `${zShort}泥泞`,
        noteZh: `${zShort}泥泞 · 装甲/摩步 −35%`,
      };
    }
    return {
      condition: 'mud',
      zone,
      attackMultPermille: FIXED_SCALE,
      labelZh: `${zShort}泥泞`,
      noteZh: `${zShort}泥泞 · 步兵无攻罚`,
    };
  }

  if (cond === 'winter') {
    if (!isAttacking) {
      return {
        condition: 'winter',
        zone,
        attackMultPermille: FIXED_SCALE,
        labelZh: `${zShort}严冬`,
        noteZh: `${zShort}严冬 · 守方无攻罚`,
      };
    }
    if (template === 'MTN') {
      return {
        condition: 'winter',
        zone,
        attackMultPermille: FIXED_SCALE,
        labelZh: `${zShort}严冬`,
        noteZh: '山地旅免严冬攻罚',
      };
    }
    const pen = isColdResistantNation(ownerTag)
      ? Math.floor(WEATHER_DEFINES.winterAttackPenaltyPermille / 2) // -12.5% (-125 permille)
      : WEATHER_DEFINES.winterAttackPenaltyPermille;                // -25% (-250 permille)
    const pctStr = pen % 10 === 0 ? `${pen / 10}%` : `${(pen / 10).toFixed(1)}%`;
    return {
      condition: 'winter',
      zone,
      attackMultPermille: FIXED_SCALE - pen,
      labelZh: `${zShort}严冬`,
      noteZh: isColdResistantNation(ownerTag)
        ? `${zShort}严冬 · 抗寒减半 −${pctStr}`
        : `${zShort}严冬 · 进攻 −${pctStr}`,
    };
  }

  return {
    condition: 'normal',
    zone,
    attackMultPermille: FIXED_SCALE,
    labelZh: '季节(晴朗)',
    noteZh: '无季节减益',
  };
}

/** 18:00 Night Tick land combat attack multiplier (x0.75 at 18:00, else x1.00). */
export function getNightAttackMultPermille(tick: number): number {
  return tickToDate(tick).isNight ? WEATHER_DEFINES.nightLandAttackMultPermille : FIXED_SCALE;
}

/** Reserved interface for Batch 10 Air System: 18:00 Night Tick sortie rate x0.50. */
export function getAirSortieMultPermille(tick: number): number {
  return tickToDate(tick).isNight ? WEATHER_DEFINES.nightAirSortieMultPermille : FIXED_SCALE;
}

/** AI armored offensive launch weight permille (400 in mud/winter, 1000 otherwise). */
export function getAiArmorOffensiveWeightPermille(provId: number, tick: number): number {
  const cond = getProvinceSeasonCondition(provId, tick);
  return cond === 'mud' || cond === 'winter'
    ? WEATHER_DEFINES.adverseArmorAiWeightPermille
    : FIXED_SCALE;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Compute theater-wide seasonal summary and next deterministic climate transition date. */
export function getTheaterSeasonSummary(tick: number): TheaterSeasonSummary {
  const d = tickToDate(tick);
  const east = getZoneSeasonCondition('east_continental', d.month, d.day);
  const nordic = getZoneSeasonCondition('nordic_subarctic', d.month, d.day);

  let nextY = d.year;
  let nextM = 3;
  let nextD = 1;
  let nextLabel = '严冬结束（春季解冻）';

  if (d.month === 1 || d.month === 2) {
    nextM = 3; nextD = 1; nextLabel = '严冬结束（春季解冻）';
  } else if (d.month === 3) {
    nextM = 4; nextD = 1; nextLabel = '东欧春季泥泞季开始';
  } else if (d.month === 4) {
    nextM = 5; nextD = 1; nextLabel = '东欧春季泥泞结束';
  } else if (d.month >= 5 && d.month <= 9) {
    nextM = 10; nextD = 16; nextLabel = '东欧秋季泥泞季开始';
  } else if (d.month === 10 && d.day < 16) {
    nextM = 10; nextD = 16; nextLabel = '东欧秋季泥泞季开始';
  } else if (d.month === 10 && d.day >= 16) {
    nextM = 11; nextD = 1; nextLabel = '东欧秋季泥泞结束';
  } else if (d.month === 11) {
    nextM = 12; nextD = 1; nextLabel = '东欧与北欧严冬降临';
  } else {
    nextY = d.year + 1; nextM = 3; nextD = 1; nextLabel = '严冬结束（春季解冻）';
  }

  let activeBadgeZh = '季节 · 正常';
  let activeDetailZh = '全欧气候平稳，无泥泞或严冬修正';
  if (east === 'winter') {
    activeBadgeZh = '东欧/北欧 · 严冬';
    activeDetailZh = '非山地进攻 −25%，缺补给损耗翻倍（苏/芬抗寒减半）';
  } else if (east === 'mud') {
    activeBadgeZh = '东欧 · 泥泞季';
    activeDetailZh = '东欧行军 −40%，装甲/摩步进攻 −35%';
  }

  return {
    eastCondition: east,
    nordicCondition: nordic,
    isNight: d.isNight,
    activeBadgeZh,
    activeDetailZh,
    nextChangeDateIso: `${nextY}-${pad2(nextM)}-${pad2(nextD)}`,
    nextChangeLabelZh: nextLabel,
  };
}
