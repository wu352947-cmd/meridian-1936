/**
 * 1936 Europe opening static profiles — 8 featured major/regional powers.
 * Pure data table (Batch 02 placeholder stats aligned with DESIGN_carbon.md §4.15).
 */

export type RegimeType = 'republic' | 'autocracy' | 'collectivist' | 'neutral';

export const REGIME_CODE: Record<RegimeType, number> = {
  republic: 0,
  autocracy: 1,
  collectivist: 2,
  neutral: 3,
};

export const REGIME_BY_CODE: readonly RegimeType[] = [
  'republic',
  'autocracy',
  'collectivist',
  'neutral',
];

export const REGIME_META: Record<
  RegimeType,
  { nameZh: string; shortZh: string; sealColor: string; noteZh: string }
> = {
  republic: { nameZh: '议会宪政制', shortZh: '议会宪政', sealColor: '#4B6B94', noteZh: '科研 +8% · 贸易信用高 · 危机度门槛约束宣战' },
  autocracy: { nameZh: '集权军国制', shortZh: '集权军国', sealColor: '#5B626A', noteZh: '宣战筹备 -50% · 计划上限 +15% · 逆风易损凝聚' },
  collectivist: { nameZh: '计划动员制', shortZh: '计划动员', sealColor: '#963E3A', noteZh: '重工槽 +1 · 资源自给 +15% · 人力动员池深厚' },
  neutral: { nameZh: '威权保守 / 中立', shortZh: '威权中立', sealColor: '#8A7452', noteZh: '核心领土防御 +15% · 驻军维持 -20%' },
};

export interface NationRatings {
  industry: number; // 0..100
  manpower: number; // 0..100
  army: number;     // 0..100
  navy: number;     // 0..100
  air: number;      // 0..100
}

export interface NationStartProfile {
  tag: string;
  regime: RegimeType;
  factionLabelZh: string;
  isMajor: boolean;
  featuredRank?: number; // 1..8 for featured cards
  civ: number;
  mil: number;
  doc: number;
  researchSlots: number;
  manpowerK: number;   // usable manpower in thousands
  apStart: number;     // integer AP (stored *1000 in sim)
  cohesion: number;    // 0..1000 permille
  readiness: number;   // 0..1000 permille
  steel: number;
  oil: number;
  rare: number;
  brigades: number;
  ships: number;
  airWings: number;
  ratings: NationRatings;
  landmarkId: string;
  briefZh: string;
}

export const FEATURED_NATIONS_1936: readonly NationStartProfile[] = [
  {
    tag: 'GER', regime: 'autocracy', factionLabelZh: '中欧同盟盟主', isMajor: true, featuredRank: 1,
    civ: 32, mil: 26, doc: 10, researchSlots: 4, manpowerK: 820,
    apStart: 120, cohesion: 760, readiness: 620,
    steel: 95, oil: -6, rare: -14, brigades: 30, ships: 16, airWings: 14,
    ratings: { industry: 92, manpower: 76, army: 90, navy: 42, air: 88 },
    landmarkId: 'berlin',
    briefZh: '鲁尔与西里西亚重工业底蕴深厚，陆空机动学说领先；但原油与稀有金属高度依赖外部输入，需权衡扩军节奏与两线风险。',
  },
  {
    tag: 'GBR', regime: 'republic', factionLabelZh: '协约同盟盟主', isMajor: true, featuredRank: 2,
    civ: 30, mil: 14, doc: 20, researchSlots: 4, manpowerK: 480,
    apStart: 110, cohesion: 840, readiness: 280,
    steel: 60, oil: 24, rare: 55, brigades: 18, ships: 42, airWings: 12,
    ratings: { industry: 84, manpower: 54, army: 52, navy: 98, air: 84 },
    landmarkId: 'london',
    briefZh: '坐拥大西洋与地中海海权咽喉与强盛造船业，海外战略物资充沛；受和平期动员约束，本土常备陆军相对单薄。',
  },
  {
    tag: 'FRA', regime: 'republic', factionLabelZh: '协约同盟核心', isMajor: true, featuredRank: 3,
    civ: 26, mil: 12, doc: 8, researchSlots: 3, manpowerK: 540,
    apStart: 75, cohesion: 380, readiness: 250,
    steel: 85, oil: 4, rare: 30, brigades: 34, ships: 27, airWings: 8,
    ratings: { industry: 72, manpower: 62, army: 78, navy: 68, air: 62 },
    landmarkId: 'paris',
    briefZh: '本土陆军规模庞大且依托阿尔萨斯—洛林筑垒防线，并辖北非纵深；然国内政局分歧令凝聚度偏低，亟须稳固内政与同盟协同。',
  },
  {
    tag: 'SOV', regime: 'collectivist', factionLabelZh: '东方共同体盟主', isMajor: true, featuredRank: 4,
    civ: 36, mil: 28, doc: 6, researchSlots: 3, manpowerK: 2450,
    apStart: 100, cohesion: 640, readiness: 450,
    steel: 110, oil: 85, rare: 65, brigades: 56, ships: 19, airWings: 14,
    ratings: { industry: 94, manpower: 98, army: 92, navy: 38, air: 80 },
    landmarkId: 'moscow',
    briefZh: '横跨欧亚的广袤纵深与全门类战略资源完全自给，工业与人力潜力无双；开局亟需推进军政改革以释放庞大兵团战力。',
  },
  {
    tag: 'ITA', regime: 'autocracy', factionLabelZh: '潜在中欧盟友', isMajor: true, featuredRank: 5,
    civ: 18, mil: 14, doc: 12, researchSlots: 3, manpowerK: 510,
    apStart: 95, cohesion: 680, readiness: 560,
    steel: 22, oil: -10, rare: -8, brigades: 24, ships: 28, airWings: 8,
    ratings: { industry: 56, manpower: 60, army: 64, navy: 74, air: 64 },
    landmarkId: 'rome',
    briefZh: '扼守地中海中央航道与利比亚北非桥头堡，海军水面与潜艇力量颇具威慑；但钢铁与能源双双匮乏，长战后勤压力巨大。',
  },
  {
    tag: 'POL', regime: 'neutral', factionLabelZh: '独立中立', isMajor: false, featuredRank: 6,
    civ: 14, mil: 10, doc: 1, researchSlots: 3, manpowerK: 420,
    apStart: 90, cohesion: 660, readiness: 520,
    steel: 32, oil: 8, rare: 6, brigades: 22, ships: 2, airWings: 4,
    ratings: { industry: 46, manpower: 58, army: 62, navy: 16, air: 38 },
    landmarkId: 'warsaw',
    briefZh: '身处中东欧平原十字路口，西邻德意志、东接苏维埃，但泽走廊与西部突出部防务险峻；唯有筑垒与外交纵横方能求存破局。',
  },
  {
    tag: 'SPR', regime: 'republic', factionLabelZh: '独立中立', isMajor: false, featuredRank: 7,
    civ: 12, mil: 6, doc: 4, researchSlots: 2, manpowerK: 340,
    apStart: 70, cohesion: 360, readiness: 420,
    steel: 28, oil: -4, rare: 24, brigades: 14, ships: 7, airWings: 3,
    ratings: { industry: 38, manpower: 48, army: 44, navy: 32, air: 28 },
    landmarkId: 'madrid',
    briefZh: '背倚比利牛斯山脉并盛产钨矿等稀有金属，扼守直布罗陀侧翼；国内社会撕裂深重，内战风暴已迫在眉睫。',
  },
  {
    tag: 'CZE', regime: 'republic', factionLabelZh: '中欧防务协定', isMajor: false, featuredRank: 8,
    civ: 13, mil: 11, doc: 0, researchSlots: 3, manpowerK: 260,
    apStart: 105, cohesion: 720, readiness: 540,
    steel: 36, oil: -3, rare: 8, brigades: 18, ships: 0, airWings: 4,
    ratings: { industry: 54, manpower: 36, army: 58, navy: 5, air: 42 },
    landmarkId: 'prague',
    briefZh: '坐拥波希米亚精密重工与苏台德天然山地筑垒弧，军工密度冠绝中欧小国；如何在大国博弈中守住山地防线攸关国运。',
  },
];
