/**
 * Fine-grained Preact Signals store for simulation snapshots, screen flow, and HUD actions.
 */
import { batch, signal } from '@preact/signals';
import type { DrawerTab, ScreenMode } from '../../debug/urlHarness';
import type { SimSpeed } from '../../sim/core/ClockCalendar';
import type { TickerDispatch } from '../../sim/core/SimEngine';
import type { SimNationSnapshot, WorldSnapshot } from '../../sim/core/SnapshotCodec';
import type { MapMode } from '../../types/map';

export const screenModeSig = signal<ScreenMode>('country_select');
export const selectedCountrySig = signal<string>('GER');
export const historicalAiSig = signal<boolean>(true);
export const activeDrawerSig = signal<DrawerTab | null>(null);
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

export function applyWorldSnapshot(snap: WorldSnapshot, dispatches?: TickerDispatch[]): void {
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
  previewCountry: (tag: string, pan?: boolean) => void;
  startCampaign: (tag: string) => void;
  openCountrySelect: () => void;
  setSpeed: (speed: SimSpeed) => void;
  togglePause: (paused?: boolean) => void;
  toggleDrawer: (tab: DrawerTab | null) => void;
}
