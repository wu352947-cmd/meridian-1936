/**
 * Fine-grained Preact Signals store for simulation snapshots, screen flow, and HUD actions.
 */
import { batch, signal } from '@preact/signals';
import type { DrawerTab, IndustrySubTab, ScreenMode } from '../../debug/urlHarness';
import type { SimSpeed } from '../../sim/core/ClockCalendar';
import type { TickerDispatch } from '../../sim/core/SimEngine';
import type { SimNationSnapshot, WorldSnapshot } from '../../sim/core/SnapshotCodec';
import type { BuildingType, EquipmentType, IndustrySnapshot } from '../../sim/systems/industryTypes';
import type { MapMode } from '../../types/map';

export const screenModeSig = signal<ScreenMode>('country_select');
export const selectedCountrySig = signal<string>('GER');
export const historicalAiSig = signal<boolean>(true);
export const activeDrawerSig = signal<DrawerTab | null>(null);
export const industrySubTabSig = signal<IndustrySubTab>('production');
export const autotestModeSig = signal<boolean>(false);
export const tickerExpandedSig = signal<boolean>(true);

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

export function applyWorldSnapshot(
  snap: WorldSnapshot,
  dispatches?: TickerDispatch[],
  industry?: IndustrySnapshot,
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
    if (dispatches) simDispatchesSig.value = dispatches;
    if (industry) simIndustrySig.value = industry;
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
}
