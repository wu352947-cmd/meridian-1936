/**
 * Batch 03 Industry, Construction & Trade shared pure-TS types & Carbon §4.6 constants.
 * Zero DOM/WebGL references — safe in Web Worker, Node Vitest, and UI.
 */

export type EconomyLaw = 'civilian' | 'early_mob' | 'war_economy' | 'total_mob';

export const CONSUMER_GOODS_PERMILLE: Record<EconomyLaw, number> = {
  civilian: 350,    // 民用常态经济 35% (Batch 03 active default)
  early_mob: 250,   // 早期动员 25% (reserved for Batch 04)
  war_economy: 150, // 战时经济 15% (reserved for Batch 04)
  total_mob: 100,   // 总体战动员 10% (reserved for Batch 04)
};

export const ECONOMY_LAW_LABEL_ZH: Record<EconomyLaw, string> = {
  civilian: '民用常态经济',
  early_mob: '早期动员',
  war_economy: '战时经济',
  total_mob: '总体战动员',
};

export type BuildingType = 'CIV' | 'MIL' | 'DOC' | 'INFRA' | 'SYNTH';

export interface BuildingSpec {
  type: BuildingType;
  nameZh: string;
  shortZh: string;
  costFixed: number; // CP * 1000
  usesSlot: boolean;
  requiresCoastal: boolean;
}

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  CIV: { type: 'CIV', nameZh: '民用工坊', shortZh: '民工', costFixed: 3_600_000, usesSlot: true, requiresCoastal: false },
  MIL: { type: 'MIL', nameZh: '军工车间', shortZh: '军工', costFixed: 2_400_000, usesSlot: true, requiresCoastal: false },
  DOC: { type: 'DOC', nameZh: '造船船坞', shortZh: '船坞', costFixed: 2_200_000, usesSlot: true, requiresCoastal: true },
  INFRA: { type: 'INFRA', nameZh: '区域基建', shortZh: '基建', costFixed: 1_500_000, usesSlot: false, requiresCoastal: false },
  SYNTH: { type: 'SYNTH', nameZh: '合成炼油所', shortZh: '炼油', costFixed: 3_200_000, usesSlot: true, requiresCoastal: false },
};

export const MAX_CIV_PER_PROJECT = 12;
export const BASE_CP_PER_CIV_FIXED = 5000; // 5.0 CP / day
export const INFRA_MULT_PERMILLE: readonly number[] = [1000, 1000, 1150, 1300, 1450, 1600]; // levels 1..5
export const SYNTH_OIL_BONUS = 6;

export type EquipmentType = 'INF_EQ' | 'ART_EQ' | 'MOT_EQ' | 'ARM_EQ' | 'AIR_TAC' | 'AIR_STR' | 'CONVOY';
export type ResourceType = 'steel' | 'oil' | 'rare';

export interface EquipmentSpec {
  type: EquipmentType;
  nameZh: string;
  shortZh: string;
  factoryKind: 'MIL' | 'DOC';
  unitCostFixed: number;   // IC or NIC * 1000
  baseOutputFixed: number; // 4500 (4.5 IC) or 3500 (3.5 NIC)
  steelPerFac: number;
  oilPerFac: number;
  rarePerFac: number;
}

export const EQUIPMENT_LIST: readonly EquipmentType[] = [
  'INF_EQ', 'ART_EQ', 'MOT_EQ', 'ARM_EQ', 'AIR_TAC', 'AIR_STR', 'CONVOY',
];

export const EQUIPMENT_SPECS: Record<EquipmentType, EquipmentSpec> = {
  INF_EQ:  { type: 'INF_EQ',  nameZh: '步兵轻重火器', shortZh: '步兵火器', factoryKind: 'MIL', unitCostFixed: 500,    baseOutputFixed: 4500, steelPerFac: 1, oilPerFac: 0, rarePerFac: 0 },
  ART_EQ:  { type: 'ART_EQ',  nameZh: '野战火炮器材', shortZh: '野战火炮', factoryKind: 'MIL', unitCostFixed: 2500,   baseOutputFixed: 4500, steelPerFac: 2, oilPerFac: 0, rarePerFac: 1 },
  MOT_EQ:  { type: 'MOT_EQ',  nameZh: '军用卡车摩托', shortZh: '军用卡车', factoryKind: 'MIL', unitCostFixed: 2000,   baseOutputFixed: 4500, steelPerFac: 1, oilPerFac: 1, rarePerFac: 0 },
  ARM_EQ:  { type: 'ARM_EQ',  nameZh: '装甲战车',     shortZh: '装甲战车', factoryKind: 'MIL', unitCostFixed: 9000,   baseOutputFixed: 4500, steelPerFac: 2, oilPerFac: 1, rarePerFac: 2 },
  AIR_TAC: { type: 'AIR_TAC', nameZh: '战术制空战机', shortZh: '战术战机', factoryKind: 'MIL', unitCostFixed: 18000,  baseOutputFixed: 4500, steelPerFac: 1, oilPerFac: 1, rarePerFac: 2 },
  AIR_STR: { type: 'AIR_STR', nameZh: '战略轰炸机',   shortZh: '战略轰炸', factoryKind: 'MIL', unitCostFixed: 32000,  baseOutputFixed: 4500, steelPerFac: 2, oilPerFac: 2, rarePerFac: 2 },
  CONVOY:  { type: 'CONVOY',  nameZh: '护航运输船',   shortZh: '护航船队', factoryKind: 'DOC', unitCostFixed: 35000,  baseOutputFixed: 3500, steelPerFac: 2, oilPerFac: 0, rarePerFac: 0 },
};

// Production Mastery fixed-point micro scale (1_000_000 = 100.000% to prevent truncation stall)
export const MASTERY_SCALE = 1_000_000;
export const MASTERY_INIT_MICRO = 300_000;      // 30.0%
export const MASTERY_MAX_INIT_MICRO = 750_000;  // 75.0%
export const MASTERY_DAILY_GAIN_MICRO = 12_000; // 0.012

export const TRADE_UNITS_PER_CIV = 8;
export const SEA_CONVOYS_PER_LOT = 2;

export interface ResourceBreakdown {
  prod: number;
  demand: number;
  imported: number;
  exported: number;
  net: number;
}

export interface TradeDeal {
  importerTag: string;
  exporterTag: string;
  resource: ResourceType;
  amount: number;
  civCost: number;
  convoys: number;
  isSea: boolean;
}

export interface ConstructionProjectSnap {
  id: number;
  regionId: number;
  regionNameZh: string;
  building: BuildingType;
  progressFixed: number;
  costFixed: number;
  assignedCiv: number;
  dailyCpFixed: number;
  etaDays: number; // -1 if stalled (0 CIV)
}

export interface ProductionLineSnap {
  type: EquipmentType;
  factories: number;
  masteryPermille: number;
  masteryMaxPermille: number;
  dailyUnitsFixed: number;
  stockpileFixed: number;
  resourceMultPermille: number;
  needSteel: number;
  needOil: number;
  needRare: number;
}

export interface RegionDynamicSnap {
  id: number;
  owner: string;
  civ: number;
  mil: number;
  doc: number;
  synth: number;
  infra: number;
  slots: number;
  steel: number;
  oil: number;
  rare: number;
  activeBuilding: BuildingType | null;
  activeProgressPermille: number;
  queuedCount: number;
}

export interface IndustrySnapshot {
  tag: string;
  economyLaw: EconomyLaw;
  consumerGoodsPermille: number;
  civTotal: number;
  civConsumer: number;
  civTrade: number;
  civBuild: number;
  civIdle: number;
  milTotal: number;
  milAssigned: number;
  docTotal: number;
  docAssigned: number;
  convoysTotal: number;
  convoysUsed: number;
  autoTrade: boolean;
  resources: Record<ResourceType, ResourceBreakdown>;
  lines: ProductionLineSnap[];
  queue: ConstructionProjectSnap[];
  deals: TradeDeal[];
  regions: RegionDynamicSnap[];
}
