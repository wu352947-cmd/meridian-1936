/**
 * Pure deterministic fixed-point Land Combat math (Carbon §4.9.2–4.9.4).
 * Slot allocation, transparent multiplier breakdown, parry/crit hits, armor suppression.
 */
import { clampInt, FIXED_SCALE, mulFixed } from '../core/FixedMath';
import { BRIGADE_TEMPLATES, type BrigadeSlotRole, type BrigadeType, type LandTerrainType } from '../data/brigadeTemplates';
import {
  COMBAT_DEFINES,
  getRiverAttackMultPermille,
  getTerrainAttackMultPermille,
  getTerrainDefenseMultPermille,
  RIVER_ZH,
  TERRAIN_ZH,
  type RiverCrossingKind,
} from '../data/combatDefines';
import { getCommanderCombatBonusPermille } from '../data/commanders1936';
import type { CombatMultiplierFactor, CombatUnitBreakdown } from './combatTypes';
import type { NationModifiers } from './modifierTypes';
import type { SupplyStatus } from './supplyTypes';
import { WEATHER_DEFINES } from './weatherSystem';

export interface SlotPartition {
  frontline: number[];
  support: number[];
  reserves: number[];
}

/** Partition brigade IDs into frontline, support, and reserve slots deterministically. */
export function partitionCombatSlots(
  ids: readonly number[],
  getRole: (id: number) => BrigadeSlotRole,
  maxFrontline: number,
  maxSupport: number,
): SlotPartition {
  const sorted = [...ids].sort((a, b) => a - b);
  const frontline: number[] = [];
  const support: number[] = [];
  const reserves: number[] = [];
  for (const id of sorted) {
    const role = getRole(id);
    if (role === 'support') {
      if (support.length < maxSupport) support.push(id);
      else reserves.push(id);
    } else if (frontline.length < maxFrontline) {
      frontline.push(id);
    } else {
      reserves.push(id);
    }
  }
  return { frontline, support, reserves };
}

export interface BreakdownInput {
  brigadeId: number;
  nameZh: string;
  template: BrigadeType;
  strengthPermille: number;
  entrenchPermille: number;
  planPermille: number;
  isAttacking: boolean;
  terrain: LandTerrainType;
  river: RiverCrossingKind;
  fortLevel: number;
  hasAttackerArtillery: boolean;
  hasFrontlineCover: boolean;
  enemyMaxPiercing: number;
  commanderId: string | null;
  nationMods: Readonly<NationModifiers>;
  supply?: { multPermille: number; supplyValue: number; status: SupplyStatus; noteZh?: string };
  weather?: { multPermille: number; labelZh: string; noteZh?: string };
  isNight?: boolean;
}

function getTechCombatMod(template: BrigadeType, isAttacking: boolean, mods: Readonly<NationModifiers>): { atk: number; guard: number } {
  if (template === 'ARM') {
    return { atk: mods.armor_attack, guard: isAttacking ? mods.armor_breakthrough : 0 };
  }
  if (template === 'ART') return { atk: mods.artillery_attack, guard: 0 };
  return { atk: mods.infantry_attack, guard: isAttacking ? 0 : mods.infantry_defense };
}

/** Build full transparent multiplier chain & effective attack/guard in fixed-point (x1000). */
export function computeUnitCombatBreakdown(inp: BreakdownInput): CombatUnitBreakdown {
  const tmpl = BRIGADE_TEMPLATES[inp.template];
  const baseAtkFixed = tmpl.attack * FIXED_SCALE;
  const baseGuardFixed = (inp.isAttacking ? tmpl.breakthrough : tmpl.defense) * FIXED_SCALE;

  const strMult = clampInt(inp.strengthPermille, COMBAT_DEFINES.minStrengthMultPermille, FIXED_SCALE);
  const terrainMult = inp.isAttacking
    ? getTerrainAttackMultPermille(inp.template, inp.terrain)
    : getTerrainDefenseMultPermille(inp.template, inp.terrain);
  const riverMult = inp.isAttacking ? getRiverAttackMultPermille(inp.template, inp.river) : FIXED_SCALE;

  const effFort = inp.isAttacking
    ? Math.max(0, Math.min(COMBAT_DEFINES.fortMaxLevel, inp.fortLevel) - (inp.hasAttackerArtillery ? COMBAT_DEFINES.artFortReductionLevels : 0))
    : 0;
  const fortMult = inp.isAttacking ? clampInt(FIXED_SCALE - effFort * COMBAT_DEFINES.fortPenaltyPerLevelPermille, 200, FIXED_SCALE) : FIXED_SCALE;

  const planOrEntrenchMult = inp.isAttacking
    ? FIXED_SCALE + clampInt(inp.planPermille, 0, COMBAT_DEFINES.planMaxCapPermille)
    : FIXED_SCALE + clampInt(inp.entrenchPermille, 0, COMBAT_DEFINES.entrenchTechCapPermille);

  const techMod = getTechCombatMod(inp.template, inp.isAttacking, inp.nationMods);
  const cmdBonus = getCommanderCombatBonusPermille(inp.commanderId, inp.template, inp.terrain, inp.isAttacking);
  const doctrineCmdAtkMult = clampInt(FIXED_SCALE + techMod.atk + cmdBonus, 500, 2500);
  const doctrineCmdGuardMult = clampInt(FIXED_SCALE + techMod.guard + (inp.isAttacking ? 0 : cmdBonus), 500, 2500);

  const exposedArtPenalty = tmpl.role === 'support' && !inp.hasFrontlineCover;
  const exposedGuardMult = exposedArtPenalty ? COMBAT_DEFINES.exposedArtDefMult : FIXED_SCALE;

  const supplyEnabled = inp.supply !== undefined;
  const supplyMult = supplyEnabled ? clampInt(inp.supply!.multPermille, 200, FIXED_SCALE) : FIXED_SCALE;
  const supplyLabel = !supplyEnabled
    ? '后勤补给'
    : inp.supply!.status === 'starving'
      ? '补给(断粮)'
      : inp.supply!.status === 'low'
        ? `补给 S=${inp.supply!.supplyValue}`
        : `补给 S=${inp.supply!.supplyValue}`;

  const weatherEnabled = inp.weather !== undefined;
  const weatherMult = weatherEnabled ? clampInt(inp.weather!.multPermille, 200, FIXED_SCALE) : FIXED_SCALE;

  const nightEnabled = typeof inp.isNight === 'boolean';
  const nightMult = nightEnabled && inp.isNight ? WEATHER_DEFINES.nightLandAttackMultPermille : FIXED_SCALE;

  const factors: CombatMultiplierFactor[] = [
    { key: 'strength', labelZh: '满编率', multPermille: strMult, enabled: true },
    { key: 'terrain', labelZh: `地形(${TERRAIN_ZH[inp.terrain]})`, multPermille: terrainMult, enabled: true },
    { key: 'river', labelZh: inp.river === 'none' ? '渡河(无)' : RIVER_ZH[inp.river], multPermille: riverMult, enabled: true },
    { key: 'fort', labelZh: inp.fortLevel > 0 ? `要塞(${effFort}/${inp.fortLevel}级)` : '要塞(无)', multPermille: fortMult, enabled: true },
    {
      key: inp.isAttacking ? 'planning' : 'entrench',
      labelZh: inp.isAttacking ? '攻势筹备' : '堑壕驻防',
      multPermille: planOrEntrenchMult,
      enabled: true,
    },
    { key: 'cmd_tech', labelZh: '科技/指挥官', multPermille: doctrineCmdAtkMult, enabled: true },
    {
      key: 'supply',
      labelZh: supplyLabel,
      multPermille: supplyMult,
      enabled: supplyEnabled,
      noteZh: supplyEnabled ? (inp.supply!.noteZh ?? '补给正常') : '未启用',
    },
    ...(weatherEnabled
      ? [{
          key: 'season',
          labelZh: inp.weather!.labelZh,
          multPermille: weatherMult,
          enabled: true,
          noteZh: inp.weather!.noteZh,
        }]
      : []),
    { key: 'air', labelZh: '制空支援', multPermille: FIXED_SCALE, enabled: false, noteZh: '未启用' },
    {
      key: 'night',
      labelZh: nightEnabled ? (inp.isNight ? '夜间作战' : '昼间作战') : '夜战修正',
      multPermille: nightMult,
      enabled: nightEnabled,
      noteZh: nightEnabled ? (inp.isNight ? '夜间 ×0.75' : '昼间无罚') : '未启用',
    },
  ];

  let effAtkFixed = baseAtkFixed;
  for (const f of factors) effAtkFixed = mulFixed(effAtkFixed, f.multPermille);

  let effGuardFixed = mulFixed(baseGuardFixed, strMult);
  effGuardFixed = mulFixed(effGuardFixed, inp.isAttacking ? FIXED_SCALE : terrainMult);
  effGuardFixed = mulFixed(effGuardFixed, planOrEntrenchMult);
  effGuardFixed = mulFixed(effGuardFixed, doctrineCmdGuardMult);
  effGuardFixed = mulFixed(effGuardFixed, exposedGuardMult);
  effGuardFixed = mulFixed(effGuardFixed, supplyMult);

  return {
    brigadeId: inp.brigadeId,
    nameZh: inp.nameZh,
    template: inp.template,
    role: tmpl.role,
    isAttacking: inp.isAttacking,
    baseAtkFixed,
    effAtkFixed,
    baseGuardFixed,
    effGuardFixed,
    armor: tmpl.armor,
    enemyMaxPiercing: inp.enemyMaxPiercing,
    armorAdvantage: tmpl.armor > 0 && tmpl.armor > inp.enemyMaxPiercing,
    exposedArtPenalty,
    factors,
  };
}

export interface TickHitResult {
  effHitsFixed: number;
  orgLossPermille: number;
  strLossPermille: number;
}

/** Deterministic parry/crit + armor suppression damage for one shooter against one target. */
export function calcTickHitDamage(
  effAtkFixed: number,
  remainingGuardFixed: number,
  shooterArmorAdv: boolean,
  targetArmorAdv: boolean,
  targetMaxOrg: number,
): TickHitResult {
  if (effAtkFixed <= 0) return { effHitsFixed: 0, orgLossPermille: 0, strLossPermille: 0 };
  const guard = Math.max(0, remainingGuardFixed);
  const parried = Math.min(effAtkFixed, guard);
  const overflow = Math.max(0, effAtkFixed - guard);
  const effHitsFixed =
    mulFixed(parried, COMBAT_DEFINES.parryHitPermille) +
    mulFixed(overflow, COMBAT_DEFINES.critHitPermille);

  let orgDmgFixed = mulFixed(effHitsFixed, COMBAT_DEFINES.orgDmgPerHitPermille);
  if (shooterArmorAdv) orgDmgFixed = mulFixed(orgDmgFixed, COMBAT_DEFINES.armorOrgDealtMult);
  if (targetArmorAdv) orgDmgFixed = mulFixed(orgDmgFixed, COMBAT_DEFINES.armorOrgTakenMult);

  const safeOrg = Math.max(1, targetMaxOrg);
  const orgLossPermille = Math.max(1, Math.floor((orgDmgFixed + (safeOrg >> 1)) / safeOrg));
  const strDmgFixed = mulFixed(effHitsFixed, COMBAT_DEFINES.strDmgPerHitPermille);
  const strLossPermille = Math.max(1, Math.floor((strDmgFixed * 10 + 500) / 1000));
  return { effHitsFixed, orgLossPermille, strLossPermille };
}

/** Evaluate battle momentum score in [-100, +100] (>0 attacker leads, <0 defender leads). */
export function computeAdvantageScore(
  atkPower: number,
  atkOrgSum: number,
  defPower: number,
  defOrgSum: number,
): number {
  const aScore = Math.max(1, Math.floor((atkPower / 100) * Math.max(100, atkOrgSum) / 1000));
  const dScore = Math.max(1, Math.floor((defPower / 100) * Math.max(100, defOrgSum) / 1000));
  const diff = aScore - dScore;
  const total = aScore + dScore;
  return clampInt(Math.round((diff * 100) / Math.max(1, total)), -99, 99);
}
