/**
 * Original 1936 Field Commanders with 1-2 tactical traits (no officer corps, no photos).
 * Each Army may appoint at most one commander via F6 Army Drawer. Pure TS, zero DOM.
 */
import type { BrigadeType, LandTerrainType } from './brigadeTemplates';

export interface CommanderTrait {
  id: string;
  nameZh: string;
  summaryZh: string;
  /** Permille bonuses (100 = +10%). */
  armorAtkPermille?: number;
  infDefPermille?: number;
  artAtkPermille?: number;
  allAtkPermille?: number;
  allDefPermille?: number;
  speedPermille?: number;
  entrenchCapPermille?: number;
  mountainBonusPermille?: number;
}

export interface CommanderDef {
  id: string;
  owner: string;
  nameZh: string;
  monogram: string;
  rankZh: string;
  traits: readonly CommanderTrait[];
}

export const COMMANDER_TRAITS: Readonly<Record<string, CommanderTrait>> = {
  armor_spearhead: {
    id: 'armor_spearhead',
    nameZh: '装甲先锋',
    summaryZh: '装甲/摩步攻击 +10%',
    armorAtkPermille: 100,
  },
  swift_maneuver: {
    id: 'swift_maneuver',
    nameZh: '快速穿插',
    summaryZh: '集团军移速 +10%',
    speedPermille: 100,
  },
  entrench_master: {
    id: 'entrench_master',
    nameZh: '筑垒固守',
    summaryZh: '步兵防御 +10% · 堑壕上限 +6%',
    infDefPermille: 100,
    entrenchCapPermille: 60,
  },
  fire_support: {
    id: 'fire_support',
    nameZh: '炮火协调',
    summaryZh: '重炮攻击 +12%',
    artAtkPermille: 120,
  },
  assault_planner: {
    id: 'assault_planner',
    nameZh: '钳形突击',
    summaryZh: '全军攻击 +6%',
    allAtkPermille: 60,
  },
  stalwart_line: {
    id: 'stalwart_line',
    nameZh: '坚韧防线',
    summaryZh: '全军防御 +8%',
    allDefPermille: 80,
  },
  alpine_ranger: {
    id: 'alpine_ranger',
    nameZh: '山地指挥',
    summaryZh: '山地/丘陵攻防 +10%',
    mountainBonusPermille: 100,
  },
};

const T = COMMANDER_TRAITS;

/** Original fictional staff-map commanders per major/regional nation. */
export const COMMANDERS_1936: readonly CommanderDef[] = [
  // GER
  { id: 'ger_keller', owner: 'GER', nameZh: 'K. 凯勒', monogram: 'KK', rankZh: '装甲上将', traits: [T.armor_spearhead!, T.swift_maneuver!] },
  { id: 'ger_brenner', owner: 'GER', nameZh: 'H. 布伦纳', monogram: 'HB', rankZh: '步兵上将', traits: [T.assault_planner!, T.fire_support!] },
  { id: 'ger_vogel', owner: 'GER', nameZh: 'W. 沃格尔', monogram: 'WV', rankZh: '野战上将', traits: [T.entrench_master!] },
  // POL
  { id: 'pol_kowalski', owner: 'POL', nameZh: 'S. 科瓦尔斯基', monogram: 'SK', rankZh: '防务中将', traits: [T.stalwart_line!, T.entrench_master!] },
  { id: 'pol_nowak', owner: 'POL', nameZh: 'J. 诺瓦克', monogram: 'JN', rankZh: '机动少将', traits: [T.swift_maneuver!] },
  // FRA
  { id: 'fra_laurent', owner: 'FRA', nameZh: 'M. 洛朗', monogram: 'ML', rankZh: '筑垒上将', traits: [T.entrench_master!, T.fire_support!] },
  { id: 'fra_delacroix', owner: 'FRA', nameZh: 'C. 德拉克鲁瓦', monogram: 'CD', rankZh: '装甲中将', traits: [T.armor_spearhead!] },
  // SOV
  { id: 'sov_volkov', owner: 'SOV', nameZh: 'A. 沃尔科夫', monogram: 'AV', rankZh: '方面军司令', traits: [T.assault_planner!, T.fire_support!] },
  { id: 'sov_orlov', owner: 'SOV', nameZh: 'N. 奥尔洛夫', monogram: 'NO', rankZh: '装甲司令', traits: [T.armor_spearhead!, T.swift_maneuver!] },
  // ITA
  { id: 'ita_ferrari', owner: 'ITA', nameZh: 'L. 费拉里', monogram: 'LF', rankZh: '山地中将', traits: [T.alpine_ranger!] },
  // GBR
  { id: 'gbr_hartley', owner: 'GBR', nameZh: 'R. 哈特利', monogram: 'RH', rankZh: '远征中将', traits: [T.stalwart_line!, T.fire_support!] },
];

const BY_ID = new Map<string, CommanderDef>(COMMANDERS_1936.map((c) => [c.id, c]));

export function getCommanderDef(id: string | null | undefined): CommanderDef | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function getCommandersForNation(tag: string): CommanderDef[] {
  const list = COMMANDERS_1936.filter((c) => c.owner === tag);
  if (list.length > 0) return list;
  // Deterministic generic staff commander for minor nations
  return [
    {
      id: `${tag.toLowerCase()}_staff_1`,
      owner: tag,
      nameZh: `${tag} 总参指挥官`,
      monogram: tag.slice(0, 2),
      rankZh: '陆军中将',
      traits: [T.stalwart_line!],
    },
  ];
}

/** Sum commander combat attack/defense permille bonus for a brigade in given terrain. */
export function getCommanderCombatBonusPermille(
  commanderId: string | null | undefined,
  template: BrigadeType,
  terrain: LandTerrainType,
  isAttacking: boolean,
): number {
  const cmd = getCommanderDef(commanderId);
  if (!cmd) return 0;
  let bonus = 0;
  for (const tr of cmd.traits) {
    if (isAttacking) {
      if (tr.allAtkPermille) bonus += tr.allAtkPermille;
      if (tr.armorAtkPermille && (template === 'ARM' || template === 'MOT')) bonus += tr.armorAtkPermille;
      if (tr.artAtkPermille && template === 'ART') bonus += tr.artAtkPermille;
    } else {
      if (tr.allDefPermille) bonus += tr.allDefPermille;
      if (tr.infDefPermille && (template === 'INF' || template === 'MTN' || template === 'GAR')) bonus += tr.infDefPermille;
    }
    if (tr.mountainBonusPermille && (terrain === 'hills' || terrain === 'mountain')) {
      bonus += tr.mountainBonusPermille;
    }
  }
  return bonus;
}

export function getCommanderSpeedBonusPermille(commanderId: string | null | undefined): number {
  const cmd = getCommanderDef(commanderId);
  if (!cmd) return 0;
  return cmd.traits.reduce((s, tr) => s + (tr.speedPermille ?? 0), 0);
}
