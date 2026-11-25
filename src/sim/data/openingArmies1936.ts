/**
 * Deterministic 1936 opening brigade compositions and historical garrison placements.
 * Guarantees exact profile.brigades count per nation and spreads units across borders/forts/VPs.
 */
import type { BrigadeType } from './brigadeTemplates';
import { ALL_PLAYABLE_NATIONS_1936, type NationStartProfile } from './nations1936';
import { getCapitalProvince, getOwnerProvinces, getSimProvince, type SimProvince } from './provinces1936';

export interface OpeningBrigadePlan {
  template: BrigadeType;
  provinceId: number;
  armySlot: number; // 0 = 1st Army, 1 = 2nd Army, etc.
}

export interface OpeningArmyDef {
  nameZh: string;
  colorIndex: number;
}

const MAJOR_MIX: Record<string, Partial<Record<BrigadeType, number>>> = {
  GER: { INF: 16, ARM: 4, MOT: 4, ART: 3, MTN: 2, GAR: 1 }, // 30
  FRA: { INF: 20, ART: 5, ARM: 3, MOT: 2, MTN: 2, GAR: 2 }, // 34
  SOV: { INF: 34, ARM: 6, MOT: 5, ART: 5, MTN: 3, GAR: 3 }, // 56
  ITA: { INF: 13, MTN: 4, ARM: 2, MOT: 2, ART: 2, GAR: 1 }, // 24
  POL: { INF: 15, MOT: 2, ARM: 1, ART: 2, MTN: 1, GAR: 1 }, // 22
  GBR: { INF: 10, ARM: 2, MOT: 2, ART: 2, GAR: 2 },         // 18
  CZE: { INF: 11, MTN: 2, ARM: 1, MOT: 1, ART: 2, GAR: 1 }, // 18
  SPR: { INF: 9, MTN: 1, MOT: 1, ART: 2, GAR: 1 },          // 14
};

/** Priority neighbor borders for historical garrison weighting. */
const BORDER_PRIORITY: Record<string, readonly string[]> = {
  GER: ['POL', 'FRA', 'CZE', 'BEL', 'HOL'],
  FRA: ['GER', 'ITA', 'BEL', 'SWI'],
  POL: ['GER', 'SOV', 'CZE', 'DNZ'],
  SOV: ['POL', 'ROM', 'FIN', 'LAT', 'EST'],
  ITA: ['FRA', 'AUS', 'YUG', 'SWI'],
  CZE: ['GER', 'HUN', 'POL', 'AUS'],
  ROM: ['SOV', 'HUN', 'BUL'],
  FIN: ['SOV'],
};

const ARMY_NAMES_BY_TAG: Record<string, readonly string[]> = {
  GER: ['第1东方集团军', '第2莱茵集团军'],
  FRA: ['第1阿尔萨斯集团军', '第2北部集团军', '第3阿尔卑斯集群'],
  SOV: ['西部特别方面军', '西南方面军', '列宁格勒集群', '中央预备集团军'],
  POL: ['波莫瑞—波兹南集团军', '华沙预备集团军'],
  ITA: ['北部阿尔卑斯集团军', '中部防卫集团军'],
  GBR: ['本土远征集团军', '地中海守备集群'],
};

function buildTemplateList(profile: NationStartProfile): BrigadeType[] {
  const mix = MAJOR_MIX[profile.tag];
  const out: BrigadeType[] = [];
  if (mix) {
    for (const t of ['INF', 'ARM', 'MOT', 'ART', 'MTN', 'GAR'] as const) {
      const cnt = mix[t] ?? 0;
      for (let i = 0; i < cnt; i++) out.push(t);
    }
  } else {
    const total = profile.brigades;
    const arm = total >= 12 ? 1 : 0;
    const mot = total >= 10 ? 1 : 0;
    const art = total >= 6 ? Math.min(2, Math.floor(total / 6)) : 0;
    const mtn = total >= 8 ? 1 : 0;
    const gar = total >= 4 ? 1 : 0;
    const inf = Math.max(0, total - arm - mot - art - mtn - gar);
    for (let i = 0; i < inf; i++) out.push('INF');
    for (let i = 0; i < arm; i++) out.push('ARM');
    for (let i = 0; i < mot; i++) out.push('MOT');
    for (let i = 0; i < art; i++) out.push('ART');
    for (let i = 0; i < mtn; i++) out.push('MTN');
    for (let i = 0; i < gar; i++) out.push('GAR');
  }
  while (out.length < profile.brigades) out.push('INF');
  if (out.length > profile.brigades) out.length = profile.brigades;
  return out;
}

function scoreGarrisonProvince(tag: string, p: SimProvince): number {
  const prios = BORDER_PRIORITY[tag] ?? [];
  let borderScore = 0;
  for (const nid of p.neighbors) {
    const nb = getSimProvince(nid);
    if (!nb || nb.owner === tag || nb.owner === 'EDG') continue;
    const idx = prios.indexOf(nb.owner);
    borderScore = Math.max(borderScore, idx >= 0 ? 120 - idx * 20 : 45);
  }
  const capScore = p.isCapital ? 55 : 0;
  const vpScore = Math.min(40, p.vp * 2);
  const coastScore = p.isCoastal ? 12 : 0;
  return borderScore + capScore + vpScore + coastScore;
}

export function getOpeningArmyDefs(tag: string, brigadeCount: number): OpeningArmyDef[] {
  const count = Math.max(1, Math.ceil(brigadeCount / 16));
  const custom = ARMY_NAMES_BY_TAG[tag];
  const defs: OpeningArmyDef[] = [];
  for (let i = 0; i < count; i++) {
    defs.push({
      nameZh: custom?.[i] ?? `第${i + 1}野战集团军`,
      colorIndex: i,
    });
  }
  return defs;
}

export function buildOpeningBrigadesForNation(profile: NationStartProfile): OpeningBrigadePlan[] {
  const provs = getOwnerProvinces(profile.tag);
  if (provs.length === 0) return [];
  const cap = getCapitalProvince(profile.tag) ?? provs[0]!;
  const templates = buildTemplateList(profile);
  const armyCount = Math.max(1, Math.ceil(templates.length / 16));

  // Rank provinces by strategic border/fortress/VP importance, deterministic tie-break by id
  const ranked = [...provs].sort(
    (a, b) => scoreGarrisonProvince(profile.tag, b) - scoreGarrisonProvince(profile.tag, a) || a.id - b.id,
  );
  const mtnProvs = ranked.filter((p) => p.terrain === 'mountain' || p.terrain === 'hills');
  const coastProvs = ranked.filter((p) => p.isCoastal || p.isCapital);

  // Use top strategic pool (spread across at least min(provs, max(6, brigades/2)) provinces)
  const spreadCount = Math.min(ranked.length, Math.max(6, Math.ceil(templates.length * 0.65)));
  const pool = ranked.slice(0, spreadCount);

  // Split GER cleanly into East (cx >= 1700) vs West (cx < 1700) for 2 armies
  const eastPool = pool.filter((p) => p.cx >= cap.cx - 10);
  const westPool = pool.filter((p) => p.cx < cap.cx - 10);

  const plans: OpeningBrigadePlan[] = [];
  const perArmyCap = Math.ceil(templates.length / armyCount);

  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i]!;
    const armySlot = Math.min(armyCount - 1, Math.floor(i / perArmyCap));
    let target: SimProvince;

    if (tmpl === 'MTN' && mtnProvs.length > 0) {
      target = mtnProvs[i % mtnProvs.length]!;
    } else if (tmpl === 'GAR' && coastProvs.length > 0) {
      target = coastProvs[i % coastProvs.length]!;
    } else if (profile.tag === 'GER' && armyCount >= 2 && eastPool.length > 0 && westPool.length > 0) {
      const sub = armySlot === 0 ? eastPool : westPool;
      target = sub[i % sub.length]!;
    } else {
      target = pool[i % pool.length]!;
    }

    plans.push({ template: tmpl, provinceId: target.id, armySlot });
  }
  return plans;
}

export function getAllOpeningNationProfiles(): readonly NationStartProfile[] {
  return ALL_PLAYABLE_NATIONS_1936;
}
