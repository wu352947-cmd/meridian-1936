/**
 * Parallel Research Slots & Cyanotype Tech Tree Simulation System (Carbon §4.8).
 * Automatically recalculates ahead-of-time rates on January 1st and law/modifier changes.
 * Pure TypeScript — zero DOM/PIXI references.
 */
import { ALL_PLAYABLE_NATIONS_1936 } from '../data/nations1936';
import { getTechNode, STARTING_TECHS_BY_TAG, TECH_NODES } from '../data/techTree1936';
import { applyModifierList, createEmptyModifiers, type NationModifiers } from './modifierTypes';
import {
  calcTechActualDaysFixed,
  calcTechAheadPenaltyPermille,
  calcTechDailyProgressMicro,
  calcTechEtaDays,
  TECH_PROG_SCALE,
  type CompletedTechEvent,
  type TechSlotSnapshot,
  type TechSnapshot,
} from './techTypes';

interface ActiveSlotState {
  techId: string;
  progressMicro: number;
  dailyProgressMicro: number;
  aheadPenaltyPermille: number;
  actualDaysFixed: number;
}

interface NationTechState {
  tag: string;
  slotCount: number;
  completed: Set<string>;
  slots: Array<ActiveSlotState | null>;
  modifiers: NationModifiers;
}

export class TechSystem {
  private nations = new Map<string, NationTechState>();
  private nationOrder: string[] = [];

  reset(currentYear: number, getResearchBonus: (tag: string) => number): void {
    this.nations.clear();
    this.nationOrder = ALL_PLAYABLE_NATIONS_1936.map((p) => p.tag);

    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const completed = new Set<string>();
      const modifiers = createEmptyModifiers();
      for (const tid of STARTING_TECHS_BY_TAG[p.tag] ?? []) {
        const def = getTechNode(tid);
        if (!def) continue;
        completed.add(tid);
        applyModifierList(modifiers, def.modifiers);
      }

      this.nations.set(p.tag, {
        tag: p.tag,
        slotCount: p.researchSlots,
        completed,
        slots: Array.from({ length: p.researchSlots }, () => null),
        modifiers,
      });
    }
    this.recomputeAllRates(currentYear, getResearchBonus);
  }

  getTechModifiers(tag: string): Readonly<NationModifiers> {
    return this.nations.get(tag)?.modifiers ?? createEmptyModifiers();
  }

  isCompleted(tag: string, techId: string): boolean {
    return this.nations.get(tag)?.completed.has(techId) ?? false;
  }

  canStartResearch(tag: string, techId: string): { ok: boolean; reasonZh: string | null } {
    const n = this.nations.get(tag);
    const def = getTechNode(techId);
    if (!n || !def) return { ok: false, reasonZh: '未知科技节点' };
    if (n.completed.has(techId)) return { ok: false, reasonZh: '已完成研发' };
    if (n.slots.some((s) => s?.techId === techId)) return { ok: false, reasonZh: '正在研发中' };

    for (const pre of def.prerequisites) {
      if (!n.completed.has(pre)) {
        const preDef = getTechNode(pre);
        return { ok: false, reasonZh: `需先完成前置：${preDef?.nameZh ?? pre}` };
      }
    }
    for (const excl of def.mutuallyExclusive) {
      if (n.completed.has(excl) || n.slots.some((s) => s?.techId === excl)) {
        const exDef = getTechNode(excl);
        return { ok: false, reasonZh: `与「${exDef?.nameZh ?? excl}」互斥` };
      }
    }
    if (!n.slots.some((s) => s === null)) {
      return { ok: false, reasonZh: '无空闲科研槽（请先取消或等待完成）' };
    }
    return { ok: true, reasonZh: null };
  }

  startResearch(
    tag: string,
    techId: string,
    currentYear: number,
    researchBonusPermille: number,
    slotIndex?: number,
  ): boolean {
    const check = this.canStartResearch(tag, techId);
    if (!check.ok) return false;
    const n = this.nations.get(tag)!;
    const def = getTechNode(techId)!;

    let targetSlot = -1;
    if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < n.slotCount && n.slots[slotIndex] === null) {
      targetSlot = slotIndex;
    } else {
      targetSlot = n.slots.findIndex((s) => s === null);
    }
    if (targetSlot < 0) return false;

    n.slots[targetSlot] = {
      techId,
      progressMicro: 0,
      dailyProgressMicro: calcTechDailyProgressMicro(def.baseDays, def.year, currentYear, researchBonusPermille),
      aheadPenaltyPermille: calcTechAheadPenaltyPermille(def.year, currentYear),
      actualDaysFixed: calcTechActualDaysFixed(def.baseDays, def.year, currentYear, researchBonusPermille),
    };
    return true;
  }

  cancelResearch(tag: string, slotIndex: number): boolean {
    const n = this.nations.get(tag);
    if (!n || slotIndex < 0 || slotIndex >= n.slotCount || n.slots[slotIndex] === null) return false;
    n.slots[slotIndex] = null;
    return true;
  }

  recomputeAllRates(currentYear: number, getResearchBonus: (tag: string) => number): void {
    for (const tag of this.nationOrder) {
      this.recomputeNationRates(tag, currentYear, getResearchBonus(tag));
    }
  }

  recomputeNationRates(tag: string, currentYear: number, researchBonusPermille: number): void {
    const n = this.nations.get(tag);
    if (!n) return;
    for (const slot of n.slots) {
      if (!slot) continue;
      const def = getTechNode(slot.techId);
      if (!def) continue;
      slot.dailyProgressMicro = calcTechDailyProgressMicro(def.baseDays, def.year, currentYear, researchBonusPermille);
      slot.aheadPenaltyPermille = calcTechAheadPenaltyPermille(def.year, currentYear);
      slot.actualDaysFixed = calcTechActualDaysFixed(def.baseDays, def.year, currentYear, researchBonusPermille);
    }
  }

  /** Advance 1 simulation day, applying currentYear's ahead-of-time rate (auto-recalcs on Jan 1). */
  stepDaily(currentYear: number, getResearchBonus: (tag: string) => number): CompletedTechEvent[] {
    const completedEvents: CompletedTechEvent[] = [];

    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      const bonus = getResearchBonus(tag);
      let completedAny = false;

      for (let i = 0; i < n.slotCount; i++) {
        const slot = n.slots[i];
        if (!slot) continue;
        const def = getTechNode(slot.techId);
        if (!def) continue;

        slot.dailyProgressMicro = calcTechDailyProgressMicro(def.baseDays, def.year, currentYear, bonus);
        slot.aheadPenaltyPermille = calcTechAheadPenaltyPermille(def.year, currentYear);
        slot.actualDaysFixed = calcTechActualDaysFixed(def.baseDays, def.year, currentYear, bonus);
        slot.progressMicro += slot.dailyProgressMicro;

        if (slot.progressMicro >= TECH_PROG_SCALE) {
          n.completed.add(def.id);
          n.slots[i] = null;
          applyModifierList(n.modifiers, def.modifiers);
          completedAny = true;
          completedEvents.push({
            tag,
            techId: def.id,
            nameZh: def.nameZh,
            effectSummaryZh: def.modifiers.map((m) => m.labelZh).join('、'),
          });
        }
      }
      if (completedAny) {
        this.recomputeNationRates(tag, currentYear, getResearchBonus(tag));
      }
    }
    return completedEvents;
  }

  getSnapshotFor(tag: string, currentYear: number, researchBonusPermille: number): TechSnapshot {
    const n = this.nations.get(tag) ?? this.nations.get('GER')!;
    const completedIds = TECH_NODES.filter((t) => n.completed.has(t.id)).map((t) => t.id);
    const slots: TechSlotSnapshot[] = n.slots.map((s, idx) => {
      if (!s) {
        return { slotIndex: idx, techId: null, progressMicro: 0, progressPermille: 0, dailyProgressMicro: 0, aheadPenaltyPermille: 0, actualDaysFixed: 0, etaDays: 0 };
      }
      return {
        slotIndex: idx,
        techId: s.techId,
        progressMicro: s.progressMicro,
        progressPermille: Math.min(1000, Math.floor(s.progressMicro / 1000)),
        dailyProgressMicro: s.dailyProgressMicro,
        aheadPenaltyPermille: s.aheadPenaltyPermille,
        actualDaysFixed: s.actualDaysFixed,
        etaDays: calcTechEtaDays(s.progressMicro, s.dailyProgressMicro),
      };
    });

    return { tag: n.tag, currentYear, researchSpeedBonusPermille: researchBonusPermille, completedIds, slots };
  }

  mixHash(mix: (v: number) => void): void {
    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      let maskLo = 0;
      let maskHi = 0;
      for (let i = 0; i < TECH_NODES.length; i++) {
        if (n.completed.has(TECH_NODES[i]!.id)) {
          if (i < 31) maskLo |= 1 << i;
          else maskHi |= 1 << (i - 31);
        }
      }
      mix(maskLo);
      mix(maskHi);
      for (const s of n.slots) {
        if (!s) {
          mix(0);
        } else {
          const idx = TECH_NODES.findIndex((t) => t.id === s.techId) + 1;
          mix((idx << 20) ^ s.progressMicro);
        }
      }
    }
  }
}
