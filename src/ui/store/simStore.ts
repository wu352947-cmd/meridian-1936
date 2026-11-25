/**
 * Fine-grained Preact Signals store for simulation snapshots, screen flow, and HUD actions.
 */
import { batch, signal } from '@preact/signals';
import type { DrawerTab, IndustrySubTab, ScreenMode } from '../../debug/urlHarness';
import type { SimSpeed } from '../../sim/core/ClockCalendar';
import type { TickerDispatch } from '../../sim/core/SimEngine';
import type { SimNationSnapshot, WorldSnapshot } from '../../sim/core/SnapshotCodec';
import type { BrigadeType } from '../../sim/data/brigadeTemplates';
import type { ArmySystemSnapshot } from '../../sim/systems/armyTypes';
import type { CombatSystemSnapshot } from '../../sim/systems/combatTypes';
import type { GovernanceLawId, GovernanceSlot, GovernanceSnapshot } from '../../sim/systems/governanceTypes';
import type { BuildingType, EquipmentType, IndustrySnapshot } from '../../sim/systems/industryTypes';
import type { LogisticsSnapshot } from '../../sim/systems/supplyTypes';
import type { TechSnapshot } from '../../sim/systems/techTypes';
import type { MapMode } from '../../types/map';

export type OrderToolMode = 'select' | 'march' | 'frontline' | 'arrow';

export const screenModeSig = signal<ScreenMode>('country_select');
export const selectedCountrySig = signal<string>('GER');
export const historicalAiSig = signal<boolean>(true);
export const activeDrawerSig = signal<DrawerTab | null>(null);
export const industrySubTabSig = signal<IndustrySubTab>('production');
export const autotestModeSig = signal<boolean>(false);
export const tickerExpandedSig = signal<boolean>(true);
export const orderToolModeSig = signal<OrderToolMode>('select');
export const selectedBrigadeIdsSig = signal<number[]>([]);
export const selectedArmyIdSig = signal<number | null>(null);
export const selectedBattleProvIdSig = signal<number | null>(null);

export const simReadySig = signal<boolean>(false);
export const simTickSig = signal<number>(0);
export const simSpeedSig = signal<SimSpeed>(2);
export const simPausedSig = signal<boolean>(true);
export const simCrisisSig = signal<number>(50);
export const simSeedSig = signal<number>(19360101);
export const simPlayerTagSig = signal<string>('GER');
export const simNationsSig = signal<Record<string, SimNationSnapshot>>({});
export const simDispatchesSig = signal<TickerDispatch[]>([]);
export const simIndustrySig = signal<IndustrySnapshot | null>(null);
export const simGovernanceSig = signal<GovernanceSnapshot | null>(null);
export const simTechSig = signal<TechSnapshot | null>(null);
export const simArmySig = signal<ArmySystemSnapshot | null>(null);
export const simCombatSig = signal<CombatSystemSnapshot | null>(null);
export const simLogisticsSig = signal<LogisticsSnapshot | null>(null);
export const simSupplyByProvSig = signal<Uint8Array | null>(null);
export const colorblindModeSig = signal<boolean>(false);

export function applyWorldSnapshot(
  snap: WorldSnapshot,
  dispatches?: TickerDispatch[],
  industry?: IndustrySnapshot,
  governance?: GovernanceSnapshot,
  tech?: TechSnapshot,
  army?: ArmySystemSnapshot,
  combat?: CombatSystemSnapshot,
  logistics?: LogisticsSnapshot,
): void {
  const byTag: Record<string, SimNationSnapshot> = {};
  for (const n of snap.nations) byTag[n.tag] = n;
  batch(() => {
    simTickSig.value = snap.tick;
    simSpeedSig.value = snap.speed;
    simPausedSig.value = snap.paused;
    simCrisisSig.value = snap.crisisPermille;
    simPlayerTagSig.value = snap.playerTag;
    simNationsSig.value = byTag;
    if (snap.supplyByProv) simSupplyByProvSig.value = snap.supplyByProv;
    if (dispatches) simDispatchesSig.value = dispatches;
    if (industry) simIndustrySig.value = industry;
    if (governance) simGovernanceSig.value = governance;
    if (tech) simTechSig.value = tech;
    if (army) simArmySig.value = army;
    if (combat) simCombatSig.value = combat;
    if (logistics) simLogisticsSig.value = logistics;
    simReadySig.value = true;
  });
}

export interface AppActions {
  setMode: (mode: MapMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  clearSelection: () => void;
  focusCountry: (tag: string, pan?: boolean) => void;
  focusRegion: (regionId: number) => void;
  previewCountry: (tag: string, pan?: boolean) => void;
  startCampaign: (tag: string) => void;
  openCountrySelect: () => void;
  setSpeed: (speed: SimSpeed) => void;
  togglePause: (paused?: boolean) => void;
  toggleDrawer: (tab: DrawerTab | null) => void;
  queueConstruction: (regionId: number, building: BuildingType) => void;
  cancelConstruction: (projectId: number) => void;
  reorderConstruction: (projectId: number, direction: 'up' | 'down' | 'top') => void;
  setLineFactories: (eqType: EquipmentType, factories: number) => void;
  switchProductionLine: (fromType: EquipmentType, toType: EquipmentType, count?: number) => void;
  toggleAutoTrade: (enabled?: boolean) => void;
  setGovernanceLaw: (slot: GovernanceSlot, lawId: GovernanceLawId) => void;
  startResearch: (techId: string, slotIndex?: number) => void;
  cancelResearch: (slotIndex: number) => void;
  setOrderToolMode: (mode: OrderToolMode) => void;
  selectBrigades: (ids: number[], armyId?: number | null) => void;
  queueTraining: (template: BrigadeType, deployProvId?: number, armyId?: number | null) => void;
  cancelTraining: (orderId: number) => void;
  createArmy: (nameZh?: string) => void;
  disbandArmy: (armyId: number) => void;
  assignBrigadeArmy: (brigadeId: number, armyId: number | null) => void;
  marchBrigades: (brigadeIds: number[], targetProvId: number) => void;
  unlockManualOverride: (brigadeId: number) => void;
  bindFrontline: (armyId: number, targetTag: string) => void;
  clearFrontline: (armyId: number) => void;
  setOffensiveArrow: (armyId: number, startProvId: number | null, targetProvId: number, bendX?: number, bendY?: number) => void;
  clearOffensiveArrow: (armyId: number) => void;
  toggleArrowActive: (armyId: number, active?: boolean) => void;
  assignCommander: (armyId: number, commanderId: string | null) => void;
  toggleArmyMotorizedSupply: (armyId: number, enabled?: boolean) => void;
  toggleColorblindMode: (enabled?: boolean) => void;
  openBattleReport: (provId: number) => void;
}
