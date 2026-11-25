/**
 * Governance Laws (3 slots) & Manpower shared types & Carbon §4.4 / §4.7 rules.
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import type { EconomyLaw } from './industryTypes';
import type { ModifierEntry } from './modifierTypes';

export type ConscriptionLaw = 'volunteer' | 'limited' | 'extensive' | 'total_conscription';
export type TradeLaw = 'free_export' | 'priority_ration' | 'wartime_embargo';
export type GovernanceSlot = 'economy' | 'conscription' | 'trade';
export type GovernanceLawId = EconomyLaw | ConscriptionLaw | TradeLaw;

export const LAW_SWITCH_AP_COST = 100;
export const LAW_SWITCH_AP_COST_FIXED = 100_000; // 100.0 AP * SCALE(1000)

export interface NationWarContext {
  crisisPermille: number;
  readinessPermille: number;
  atWar: boolean;
  atWarWithMajor: boolean;
  homelandInvaded: boolean;
  armyInferior: boolean;
}

export interface LawOptionDef<T extends string = string> {
  id: T;
  slot: GovernanceSlot;
  tier: number;
  nameZh: string;
  shortZh: string;
  summaryZh: string;
  requirementZh: string;
  modifiers: readonly ModifierEntry[];
  consumerGoodsPermille?: number;
  conscriptionRatePermille?: number;
  exportSharePermille?: number;
}

export const ECONOMY_LAW_ORDER: readonly EconomyLaw[] = ['civilian', 'early_mob', 'war_economy', 'total_mob'];
export const CONSCRIPTION_LAW_ORDER: readonly ConscriptionLaw[] = ['volunteer', 'limited', 'extensive', 'total_conscription'];
export const TRADE_LAW_ORDER: readonly TradeLaw[] = ['free_export', 'priority_ration', 'wartime_embargo'];

export const ECONOMY_LAW_SPECS: Record<EconomyLaw, LawOptionDef<EconomyLaw>> = {
  civilian: {
    id: 'civilian', slot: 'economy', tier: 0, nameZh: '民用常态经济', shortZh: '民用常态',
    summaryZh: '消费品占民工 35%', requirementZh: '无门槛',
    consumerGoodsPermille: 350, modifiers: [],
  },
  early_mob: {
    id: 'early_mob', slot: 'economy', tier: 1, nameZh: '早期动员', shortZh: '早期动员',
    summaryZh: '消费品占民工 25%', requirementZh: '需欧洲危机度 ≥ 15%',
    consumerGoodsPermille: 250, modifiers: [],
  },
  war_economy: {
    id: 'war_economy', slot: 'economy', tier: 2, nameZh: '战时经济', shortZh: '战时经济',
    summaryZh: '消费品 15% · 军工建造 +15%', requirementZh: '需处于战争或动员度 ≥ 50%',
    consumerGoodsPermille: 150,
    modifiers: [{ key: 'mil_build_speed', value: 150, labelZh: '军工建造速度 +15%' }],
  },
  total_mob: {
    id: 'total_mob', slot: 'economy', tier: 3, nameZh: '总体战动员', shortZh: '总体战',
    summaryZh: '消费品 10% · 军工产出 +10% · 适役上限 -1.5%', requirementZh: '仅限与大国交战时',
    consumerGoodsPermille: 100,
    modifiers: [
      { key: 'mil_output', value: 100, labelZh: '军工产出 +10%' },
      { key: 'conscription_rate', value: -15, labelZh: '适役人力上限 -1.5%' },
    ],
  },
};

export const CONSCRIPTION_LAW_SPECS: Record<ConscriptionLaw, LawOptionDef<ConscriptionLaw>> = {
  volunteer: {
    id: 'volunteer', slot: 'conscription', tier: 0, nameZh: '志愿兵役制', shortZh: '志愿 1.5%',
    summaryZh: '适役比例 1.5% · 无工业惩罚', requirementZh: '无门槛',
    conscriptionRatePermille: 15, modifiers: [],
  },
  limited: {
    id: 'limited', slot: 'conscription', tier: 1, nameZh: '有限征兵制', shortZh: '有限 3.0%',
    summaryZh: '适役比例 3.0% · 无工业惩罚', requirementZh: '无门槛',
    conscriptionRatePermille: 30, modifiers: [],
  },
  extensive: {
    id: 'extensive', slot: 'conscription', tier: 2, nameZh: '广泛征兵制', shortZh: '广泛 6.0%',
    summaryZh: '适役 6.0% · 工厂产出 -5% · 训练耗时 +10%', requirementZh: '需处于战争或动员度 ≥ 50%',
    conscriptionRatePermille: 60,
    modifiers: [
      { key: 'factory_output', value: -50, labelZh: '工厂产出 -5%' },
      { key: 'training_time', value: 100, labelZh: '训练耗时 +10%' },
    ],
  },
  total_conscription: {
    id: 'total_conscription', slot: 'conscription', tier: 3, nameZh: '倾国动员制', shortZh: '倾国 10.0%',
    summaryZh: '适役 10.0% · 产出 -18% · 建造 -15% · 凝聚上限 -10%', requirementZh: '需核心领土遭入侵或总兵力劣势',
    conscriptionRatePermille: 100,
    modifiers: [
      { key: 'factory_output', value: -180, labelZh: '工厂产出 -18%' },
      { key: 'build_speed', value: -150, labelZh: '建造速度 -15%' },
      { key: 'cohesion_cap', value: -100, labelZh: '凝聚度上限 -10%' },
    ],
  },
};

export const TRADE_LAW_SPECS: Record<TradeLaw, LawOptionDef<TradeLaw>> = {
  free_export: {
    id: 'free_export', slot: 'trade', tier: 0, nameZh: '自由出口', shortZh: '自由 50%',
    summaryZh: '出口份额 50% · 科研 +5% · 工坊产出 +5%', requirementZh: '无门槛',
    exportSharePermille: 500,
    modifiers: [
      { key: 'research_speed', value: 50, labelZh: '科研速度 +5%' },
      { key: 'factory_output', value: 50, labelZh: '工坊产出 +5%' },
    ],
  },
  priority_ration: {
    id: 'priority_ration', slot: 'trade', tier: 1, nameZh: '优先配给', shortZh: '配给 25%',
    summaryZh: '出口份额 25% · 科研 +2%', requirementZh: '无门槛',
    exportSharePermille: 250,
    modifiers: [{ key: 'research_speed', value: 20, labelZh: '科研速度 +2%' }],
  },
  wartime_embargo: {
    id: 'wartime_embargo', slot: 'trade', tier: 2, nameZh: '战时管制封锁', shortZh: '封锁 0%',
    summaryZh: '出口份额 0%（全部自留）· 无科研加成', requirementZh: '无门槛',
    exportSharePermille: 0, modifiers: [],
  },
};

export interface ManpowerSnapshot {
  corePop: number;
  nonCorePop: number;
  effectivePop: number;
  baseRatePermille: number;
  rateModifierPermille: number;
  effectiveRatePermille: number;
  maxManpower: number;
  mobilizedPool: number;
  deployed: number;
  casualties: number;
  available: number;
  dailyInflow: number;
  monthlyInflow: number;
}

export interface LawOptionStatus {
  id: GovernanceLawId;
  active: boolean;
  unlocked: boolean;
  canAfford: boolean;
  canSwitch: boolean;
  blockReasonZh: string | null;
}

export interface GovernanceSnapshot {
  tag: string;
  economyLaw: EconomyLaw;
  conscriptionLaw: ConscriptionLaw;
  tradeLaw: TradeLaw;
  apPermille: number;
  apDailyPermille: number;
  crisisPermille: number;
  readinessPermille: number;
  cohesionCapPermille: number;
  atWar: boolean;
  atWarWithMajor: boolean;
  homelandInvaded: boolean;
  armyInferior: boolean;
  exportSharePermille: number;
  researchSpeedBonusPermille: number;
  factoryOutputModPermille: number;
  milOutputModPermille: number;
  buildSpeedModPermille: number;
  milBuildSpeedModPermille: number;
  masteryCapModPermille: number;
  regionSlotBonus: number;
  synthOilBonusPerPlant: number;
  manpower: ManpowerSnapshot;
  economyOptions: LawOptionStatus[];
  conscriptionOptions: LawOptionStatus[];
  tradeOptions: LawOptionStatus[];
}
