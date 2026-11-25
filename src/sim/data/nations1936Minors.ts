/**
 * 1936 Europe opening static profiles — 23 additional playable European sovereign states.
 * Brings total playable 1936 European states to 31 (exceeding the 29-nation requirement).
 */
import type { NationStartProfile, RegimeType } from './nations1936Core';

interface MinorSeed {
  tag: string;
  regime: RegimeType;
  civ: number;
  mil: number;
  doc: number;
  mp: number;
  steel: number;
  oil: number;
  rare: number;
  brig: number;
  ships: number;
  air: number;
  coh: number;
  rdy: number;
  briefZh: string;
}

const MINOR_SEEDS: readonly MinorSeed[] = [
  { tag: 'ROM', regime: 'neutral', civ: 11, mil: 7, doc: 2, mp: 310, steel: 14, oil: 52, rare: 4, brig: 16, ships: 4, air: 3, coh: 620, rdy: 380, briefZh: '控制欧洲大陆核心的普洛耶什蒂油田与多瑙河下游，是大国竞相拉拢或觊觎的能源枢纽。' },
  { tag: 'HUN', regime: 'autocracy', civ: 9, mil: 6, doc: 0, mp: 180, steel: 16, oil: 4, rare: 12, brig: 10, ships: 0, air: 2, coh: 680, rdy: 480, briefZh: '地处多瑙河盆地要冲，富含铝土稀有矿藏，对周边历史边界保有强烈外交诉求。' },
  { tag: 'YUG', regime: 'neutral', civ: 10, mil: 6, doc: 2, mp: 280, steel: 18, oil: 2, rare: 14, brig: 15, ships: 4, air: 2, coh: 520, rdy: 400, briefZh: '横跨巴尔干山地与亚得里亚海岸，境内地形险峻易守难攻，但多民族内政整合脆弱。' },
  { tag: 'AUS', regime: 'neutral', civ: 9, mil: 5, doc: 0, mp: 135, steel: 18, oil: 2, rare: 4, brig: 8, ships: 0, air: 1, coh: 560, rdy: 360, briefZh: '阿尔卑斯山国扼守维也纳与多瑙走廊，面临来自北方与南方的巨大地缘合并压力。' },
  { tag: 'TUR', regime: 'neutral', civ: 10, mil: 5, doc: 2, mp: 320, steel: 14, oil: 0, rare: 26, brig: 14, ships: 5, air: 2, coh: 740, rdy: 350, briefZh: '独控博斯普鲁斯海峡与安纳托利亚高原，坐拥丰富铬矿资源，严守武装中立。' },
  { tag: 'FIN', regime: 'republic', civ: 8, mil: 4, doc: 1, mp: 110, steel: 10, oil: 0, rare: 6, brig: 9, ships: 2, air: 1, coh: 820, rdy: 460, briefZh: '千湖林海与卡累利阿地峡构筑天然严寒防线，官兵耐寒善战，北境安全备受瞩目。' },
  { tag: 'SWE', regime: 'republic', civ: 13, mil: 5, doc: 4, mp: 145, steel: 68, oil: -4, rare: 18, brig: 8, ships: 8, air: 2, coh: 880, rdy: 220, briefZh: '北欧重工与基律纳高品位铁矿核心供应地，严守中立的同时成为双方必争贸易伙伴。' },
  { tag: 'NOR', regime: 'republic', civ: 7, mil: 3, doc: 3, mp: 85, steel: 12, oil: 0, rare: 10, brig: 5, ships: 5, air: 1, coh: 840, rdy: 200, briefZh: '漫长峡湾海岸与纳尔维克冬季不冻铁矿港战略地位关键，防御高度依赖北海制海权。' },
  { tag: 'DEN', regime: 'republic', civ: 7, mil: 2, doc: 2, mp: 75, steel: 4, oil: 0, rare: 2, brig: 4, ships: 3, air: 1, coh: 860, rdy: 180, briefZh: '扼守波罗的海出入北海的厄勒海峡门户，地势平坦，国土纵深极为有限。' },
  { tag: 'ISL', regime: 'republic', civ: 2, mil: 0, doc: 1, mp: 18, steel: 0, oil: 0, rare: 0, brig: 1, ships: 1, air: 0, coh: 880, rdy: 120, briefZh: '北大西洋航道中继枢纽岛国，海空补给与护航巡逻价值远超本土经济体量。' },
  { tag: 'HOL', regime: 'republic', civ: 12, mil: 4, doc: 5, mp: 175, steel: 10, oil: 14, rare: 16, brig: 8, ships: 10, air: 2, coh: 820, rdy: 220, briefZh: '莱茵河口水网密布、商业造船发达，依赖中立外交与运河水淹防线护卫低地本土。' },
  { tag: 'BEL', regime: 'republic', civ: 12, mil: 6, doc: 1, mp: 165, steel: 30, oil: -2, rare: 8, brig: 10, ships: 1, air: 2, coh: 760, rdy: 320, briefZh: '西欧重工走廊与阿登森林防务节点，毗邻法德边界，地处西线战略咽喉。' },
  { tag: 'LUX', regime: 'republic', civ: 3, mil: 1, doc: 0, mp: 20, steel: 18, oil: 0, rare: 0, brig: 1, ships: 0, air: 0, coh: 850, rdy: 180, briefZh: '袖珍钢铁大公国夹于法德比交界，钢铁产量惊人但无战略回旋纵深。' },
  { tag: 'SWI', regime: 'republic', civ: 10, mil: 5, doc: 0, mp: 140, steel: 10, oil: -2, rare: 4, brig: 9, ships: 0, air: 1, coh: 920, rdy: 480, briefZh: '全境依托阿尔卑斯高山隘口与全民民兵体系，构成令任何入侵者望而生畏的中立堡垒。' },
  { tag: 'GRE', regime: 'neutral', civ: 6, mil: 4, doc: 2, mp: 155, steel: 6, oil: 0, rare: 12, brig: 10, ships: 5, air: 1, coh: 640, rdy: 420, briefZh: '爱琴海岛链与品都斯山脉天然护国，在东地中海与巴尔干南翼举足轻重。' },
  { tag: 'BUL', regime: 'neutral', civ: 6, mil: 4, doc: 1, mp: 140, steel: 6, oil: 0, rare: 4, brig: 9, ships: 1, air: 1, coh: 660, rdy: 440, briefZh: '扼守黑海西岸与巴尔干山脉走廊，在中欧与巴尔干势力平衡中颇具分量。' },
  { tag: 'ALB', regime: 'neutral', civ: 2, mil: 1, doc: 0, mp: 42, steel: 2, oil: 6, rare: 2, brig: 3, ships: 0, air: 0, coh: 580, rdy: 340, briefZh: '亚得里亚海东岸山地小国，毗邻奥特朗托海峡，面临跨海大国渗透压力。' },
  { tag: 'POR', regime: 'neutral', civ: 6, mil: 3, doc: 2, mp: 150, steel: 6, oil: 0, rare: 22, brig: 7, ships: 4, air: 1, coh: 720, rdy: 260, briefZh: '大西洋伊比利亚门户，盛产稀有钨矿，凭借传统海权纽带维系微妙中立。' },
  { tag: 'IRE', regime: 'republic', civ: 5, mil: 2, doc: 1, mp: 85, steel: 4, oil: 0, rare: 2, brig: 4, ships: 1, air: 0, coh: 780, rdy: 200, briefZh: '大西洋西北侧翼岛国，奉行严守中立路线以专注国内建设。' },
  { tag: 'LIT', regime: 'neutral', civ: 4, mil: 2, doc: 1, mp: 68, steel: 2, oil: 0, rare: 0, brig: 5, ships: 0, air: 1, coh: 640, rdy: 400, briefZh: '波罗的海三国南翼，临时首都设于考纳斯，梅梅尔港与维尔诺争议牵动周边局势。' },
  { tag: 'LAT', regime: 'neutral', civ: 4, mil: 2, doc: 1, mp: 58, steel: 2, oil: 0, rare: 0, brig: 4, ships: 1, air: 1, coh: 680, rdy: 380, briefZh: '里加湾沿岸海港枢纽，连接东普鲁士通往列宁格勒的波罗的海战略通道。' },
  { tag: 'EST', regime: 'neutral', civ: 3, mil: 2, doc: 1, mp: 42, steel: 2, oil: 4, rare: 0, brig: 4, ships: 1, air: 0, coh: 700, rdy: 380, briefZh: '芬兰湾南岸门户，塔林要港与页岩油产区令其在北欧—东欧交界占据独特位置。' },
  { tag: 'DNZ', regime: 'neutral', civ: 2, mil: 1, doc: 1, mp: 16, steel: 2, oil: 0, rare: 0, brig: 2, ships: 0, air: 0, coh: 600, rdy: 450, briefZh: '国联托管下的维斯瓦河口自由港市，处于波兰走廊与东普鲁士交汇的欧洲火药桶焦点。' },
];

const clampRating = (v: number): number => Math.max(4, Math.min(95, Math.round(v)));

export const MINOR_NATIONS_1936: readonly NationStartProfile[] = MINOR_SEEDS.map((s) => ({
  tag: s.tag,
  regime: s.regime,
  factionLabelZh: '独立中立',
  isMajor: false,
  civ: s.civ,
  mil: s.mil,
  doc: s.doc,
  researchSlots: s.civ >= 10 ? 3 : 2,
  manpowerK: s.mp,
  apStart: 85,
  cohesion: s.coh,
  readiness: s.rdy,
  steel: s.steel,
  oil: s.oil,
  rare: s.rare,
  brigades: s.brig,
  ships: s.ships,
  airWings: s.air,
  ratings: {
    industry: clampRating((s.civ + s.mil + s.doc) * 2.2),
    manpower: clampRating(s.mp / 5.5),
    army: clampRating(s.brig * 3.2),
    navy: clampRating(s.ships * 5.0),
    air: clampRating(s.air * 9.0),
  },
  landmarkId: 'compass',
  briefZh: s.briefZh,
}));
