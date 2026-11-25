/**
 * Three-Slot Governance Laws System (Economy / Conscription / Trade) with 100 AP switching.
 * Pure TypeScript — zero DOM/PIXI references.
 */
import { ALL_PLAYABLE_NATIONS_1936, type RegimeType } from '../data/nations1936';
import type { EconomyLaw } from './industryTypes';
import {
  CONSCRIPTION_LAW_ORDER,
  CONSCRIPTION_LAW_SPECS,
  ECONOMY_LAW_ORDER,
  ECONOMY_LAW_SPECS,
  LAW_SWITCH_AP_COST_FIXED,
  TRADE_LAW_ORDER,
  TRADE_LAW_SPECS,
  type ConscriptionLaw,
  type GovernanceLawId,
  type GovernanceSlot,
  type LawOptionStatus,
  type NationWarContext,
  type TradeLaw,
} from './governanceTypes';
import { applyModifierList, createEmptyModifiers, type NationModifiers } from './modifierTypes';

const VOLUNTEER_DEFAULT_TAGS = new Set<string>([
  'GBR', 'HOL', 'BEL', 'SWE', 'DEN', 'IRE', 'AUS', 'POR', 'ISL', 'LUX',
]);

interface NationGovernanceState {
  tag: string;
  regime: RegimeType;
  economyLaw: EconomyLaw;
  conscriptionLaw: ConscriptionLaw;
  tradeLaw: TradeLaw;
  atWar: boolean;
  atWarWithMajor: boolean;
  homelandInvaded: boolean;
  armyInferior: boolean;
}

export interface LawSwitchResult {
  ok: boolean;
  reasonZh?: string;
  apCostFixed?: number;
  slotLabelZh?: string;
  lawNameZh?: string;
  summaryZh?: string;
}

export function evaluateLawUnlock(
  slot: GovernanceSlot,
  lawId: GovernanceLawId,
  ctx: NationWarContext,
): { unlocked: boolean; reasonZh: string | null } {
  if (slot === 'economy') {
    if (lawId === 'early_mob' && ctx.crisisPermille < 150) {
      return { unlocked: false, reasonZh: `需欧洲危机度 ≥ 15%（当前 ${Math.round(ctx.crisisPermille / 10)}%）` };
    }
    if (lawId === 'war_economy' && !ctx.atWar && ctx.readinessPermille < 500) {
      return { unlocked: false, reasonZh: `需处于战争或动员度 ≥ 50%（当前 ${Math.round(ctx.readinessPermille / 10)}%）` };
    }
    if (lawId === 'total_mob' && !ctx.atWarWithMajor) {
      return { unlocked: false, reasonZh: '仅限与大国交战时解锁' };
    }
  } else if (slot === 'conscription') {
    if (lawId === 'extensive' && !ctx.atWar && ctx.readinessPermille < 500) {
      return { unlocked: false, reasonZh: `需处于战争或动员度 ≥ 50%（当前 ${Math.round(ctx.readinessPermille / 10)}%）` };
    }
    if (lawId === 'total_conscription' && !ctx.homelandInvaded && !ctx.armyInferior) {
      return { unlocked: false, reasonZh: '仅在核心领土遭入侵或总兵力劣势时解锁' };
    }
  }
  return { unlocked: true, reasonZh: null };
}

export class GovernanceSystem {
  private nations = new Map<string, NationGovernanceState>();
  private nationOrder: string[] = [];

  reset(): void {
    this.nations.clear();
    this.nationOrder = ALL_PLAYABLE_NATIONS_1936.map((p) => p.tag);

    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const conscriptionLaw: ConscriptionLaw = VOLUNTEER_DEFAULT_TAGS.has(p.tag) ? 'volunteer' : 'limited';
      const tradeLaw: TradeLaw =
        p.regime === 'autocracy' || p.regime === 'collectivist' ? 'priority_ration' : 'free_export';

      this.nations.set(p.tag, {
        tag: p.tag,
        regime: p.regime,
        economyLaw: 'civilian',
        conscriptionLaw,
        tradeLaw,
        atWar: false,
        atWarWithMajor: false,
        homelandInvaded: false,
        armyInferior: false,
      });
    }
  }

  setWarFlags(
    tag: string,
    flags: Partial<Pick<NationGovernanceState, 'atWar' | 'atWarWithMajor' | 'homelandInvaded' | 'armyInferior'>>,
  ): void {
    const n = this.nations.get(tag);
    if (!n) return;
    if (typeof flags.atWar === 'boolean') n.atWar = flags.atWar;
    if (typeof flags.atWarWithMajor === 'boolean') {
      n.atWarWithMajor = flags.atWarWithMajor;
      if (flags.atWarWithMajor) n.atWar = true;
    }
    if (typeof flags.homelandInvaded === 'boolean') {
      n.homelandInvaded = flags.homelandInvaded;
      if (flags.homelandInvaded) n.atWar = true;
    }
    if (typeof flags.armyInferior === 'boolean') n.armyInferior = flags.armyInferior;
  }

  getState(tag: string): Readonly<NationGovernanceState> {
    return this.nations.get(tag) ?? this.nations.get('GER')!;
  }

  getWarContext(tag: string, crisisPermille: number, readinessPermille: number): NationWarContext {
    const n = this.getState(tag);
    return {
      crisisPermille,
      readinessPermille,
      atWar: n.atWar,
      atWarWithMajor: n.atWarWithMajor,
      homelandInvaded: n.homelandInvaded,
      armyInferior: n.armyInferior,
    };
  }

  getBaseConscriptionPermille(tag: string): number {
    const n = this.getState(tag);
    return CONSCRIPTION_LAW_SPECS[n.conscriptionLaw].conscriptionRatePermille ?? 30;
  }

  getExportSharePermille(tag: string): number {
    const n = this.getState(tag);
    return TRADE_LAW_SPECS[n.tradeLaw].exportSharePermille ?? 250;
  }

  /** Aggregate Regime + 3 Governance Law modifiers for a nation. */
  getLawModifiers(tag: string): NationModifiers {
    const n = this.getState(tag);
    const mods = createEmptyModifiers();
    if (n.regime === 'republic') {
      mods.research_speed += 80; // Carbon §4.3: 议会宪政制 科研 +8%
    }
    applyModifierList(mods, ECONOMY_LAW_SPECS[n.economyLaw].modifiers);
    applyModifierList(mods, CONSCRIPTION_LAW_SPECS[n.conscriptionLaw].modifiers);
    applyModifierList(mods, TRADE_LAW_SPECS[n.tradeLaw].modifiers);
    return mods;
  }

  switchLaw(
    tag: string,
    slot: GovernanceSlot,
    lawId: GovernanceLawId,
    apPermille: number,
    crisisPermille: number,
    readinessPermille: number,
  ): LawSwitchResult {
    const n = this.nations.get(tag);
    if (!n) return { ok: false, reasonZh: '未知国家代码' };

    const valid =
      (slot === 'economy' && lawId in ECONOMY_LAW_SPECS) ||
      (slot === 'conscription' && lawId in CONSCRIPTION_LAW_SPECS) ||
      (slot === 'trade' && lawId in TRADE_LAW_SPECS);
    if (!valid) return { ok: false, reasonZh: '非法法令编号' };

    const current =
      slot === 'economy' ? n.economyLaw : slot === 'conscription' ? n.conscriptionLaw : n.tradeLaw;
    if (current === lawId) return { ok: false, reasonZh: '当前已实行该法令' };

    const ctx = this.getWarContext(tag, crisisPermille, readinessPermille);
    const check = evaluateLawUnlock(slot, lawId, ctx);
    if (!check.unlocked) return { ok: false, reasonZh: check.reasonZh ?? '未满足解锁条件' };

    if (apPermille < LAW_SWITCH_AP_COST_FIXED) {
      return { ok: false, reasonZh: `行政点不足（需 100 AP，当前 ${Math.floor(apPermille / 1000)} AP）` };
    }

    if (slot === 'economy') {
      n.economyLaw = lawId as EconomyLaw;
      const spec = ECONOMY_LAW_SPECS[n.economyLaw];
      return { ok: true, apCostFixed: LAW_SWITCH_AP_COST_FIXED, slotLabelZh: '经济动员法', lawNameZh: spec.nameZh, summaryZh: spec.summaryZh };
    }
    if (slot === 'conscription') {
      n.conscriptionLaw = lawId as ConscriptionLaw;
      const spec = CONSCRIPTION_LAW_SPECS[n.conscriptionLaw];
      return { ok: true, apCostFixed: LAW_SWITCH_AP_COST_FIXED, slotLabelZh: '兵役征召法', lawNameZh: spec.nameZh, summaryZh: spec.summaryZh };
    }
    n.tradeLaw = lawId as TradeLaw;
    const spec = TRADE_LAW_SPECS[n.tradeLaw];
    return { ok: true, apCostFixed: LAW_SWITCH_AP_COST_FIXED, slotLabelZh: '战略贸易法', lawNameZh: spec.nameZh, summaryZh: spec.summaryZh };
  }

  buildOptionsStatus(
    tag: string,
    slot: GovernanceSlot,
    apPermille: number,
    crisisPermille: number,
    readinessPermille: number,
  ): LawOptionStatus[] {
    const n = this.getState(tag);
    const ctx = this.getWarContext(tag, crisisPermille, readinessPermille);
    const canAfford = apPermille >= LAW_SWITCH_AP_COST_FIXED;
    const list: readonly GovernanceLawId[] =
      slot === 'economy' ? ECONOMY_LAW_ORDER : slot === 'conscription' ? CONSCRIPTION_LAW_ORDER : TRADE_LAW_ORDER;
    const activeId =
      slot === 'economy' ? n.economyLaw : slot === 'conscription' ? n.conscriptionLaw : n.tradeLaw;

    return list.map((id) => {
      const active = id === activeId;
      const check = evaluateLawUnlock(slot, id, ctx);
      const canSwitch = !active && check.unlocked && canAfford;
      let blockReasonZh: string | null = null;
      if (!active) {
        if (!check.unlocked) blockReasonZh = check.reasonZh;
        else if (!canAfford) blockReasonZh = `行政点不足（需 100 AP）`;
      }
      return { id, active, unlocked: check.unlocked, canAfford, canSwitch, blockReasonZh };
    });
  }

  mixHash(mix: (v: number) => void): void {
    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      const eIdx = ECONOMY_LAW_ORDER.indexOf(n.economyLaw);
      const cIdx = CONSCRIPTION_LAW_ORDER.indexOf(n.conscriptionLaw);
      const tIdx = TRADE_LAW_ORDER.indexOf(n.tradeLaw);
      const flags =
        (n.atWar ? 1 : 0) |
        (n.atWarWithMajor ? 2 : 0) |
        (n.homelandInvaded ? 4 : 0) |
        (n.armyInferior ? 8 : 0);
      mix((eIdx & 7) | ((cIdx & 7) << 4) | ((tIdx & 7) << 8) | (flags << 12));
    }
  }
}
