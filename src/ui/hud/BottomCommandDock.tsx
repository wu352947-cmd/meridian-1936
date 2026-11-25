import type { DrawerTab } from '../../debug/urlHarness';
import type { MapMode } from '../../types/map';
import { mapModeSig } from '../mapStore';
import {
  activeDrawerSig,
  autotestModeSig,
  simGovernanceSig,
  simLogisticsSig,
  simTechSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

const DOSSIER_TABS: ReadonlyArray<{
  id: DrawerTab;
  fkey: string;
  label: string;
  hasAmberHint?: boolean;
}> = [
  { id: 'directives', fkey: 'F1', label: '方略', hasAmberHint: true },
  { id: 'diplomacy', fkey: 'F2', label: '外交' },
  { id: 'industry', fkey: 'F3', label: '军工' },
  { id: 'tech', fkey: 'F4', label: '科技', hasAmberHint: true },
  { id: 'logistics', fkey: 'F5', label: '占领补给' },
  { id: 'army', fkey: 'F6', label: '集团军' },
];

const MAP_LENSES: ReadonlyArray<{
  id: MapMode;
  code: string;
  short: string;
  label: string;
  hotkey: string;
}> = [
  { id: 'political', code: 'M1', short: '政', label: '政治版图', hotkey: 'Q' },
  { id: 'terrain', code: 'M2', short: '地', label: '地形与筑垒', hotkey: 'W' },
  { id: 'supply', code: 'M3', short: '补', label: '后勤补给', hotkey: 'E' },
  { id: 'diplomacy', code: 'M4', short: '外', label: '外交阵营', hotkey: 'R' },
  { id: 'industry', code: 'M5', short: '工', label: '工业资源', hotkey: 'T' },
  { id: 'air_sea', code: 'M6', short: '空', label: '海空态势', hotkey: 'Y' },
];

export function BottomCommandDock({ actions }: Props) {
  const activeDrawer = activeDrawerSig.value;
  const activeMode = mapModeSig.value;
  const noAnim = autotestModeSig.value;
  const gov = simGovernanceSig.value;
  const tech = simTechSig.value;
  const logi = simLogisticsSig.value;
  const hasLawReady = gov
    ? [...gov.economyOptions, ...gov.conscriptionOptions, ...gov.tradeOptions].some((o) => o.canSwitch)
    : false;
  const hasIdleTechSlot = tech ? tech.slots.some((s) => s.techId === null) : true;
  const hasSupplyAlert = logi ? logi.lowSupplyBrigades + logi.starvingBrigades > 0 : false;

  return (
    <nav class="walnut-dock" aria-label="参谋部公文卷宗坞站与地图透镜">
      <div class="dock-tabs" role="tablist" aria-label="F1-F6 参谋卷宗">
        {DOSSIER_TABS.map((t) => {
          const active = activeDrawer === t.id;
          const showDot =
            !active &&
            ((t.id === 'directives' && hasLawReady) ||
              (t.id === 'tech' && hasIdleTechSlot) ||
              (t.id === 'logistics' && hasSupplyAlert));
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              class={`dossier-tab${active ? ' active' : ''}`}
              onClick={() => actions.toggleDrawer(active ? null : t.id)}
              title={`${t.fkey} ${t.label}卷宗`}
            >
              <span class="tab-fkey mono-num">{t.fkey}</span>
              <span class="tab-label">{t.label}</span>
              {showDot && (
                <span class={`tab-amber-dot${noAnim ? ' static' : ''}`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <div class="dock-brass-sep" />

      <div class="dock-lenses" role="group" aria-label="M1-M6 地图模式透镜">
        {MAP_LENSES.map((lens) => {
          const active = activeMode === lens.id;
          return (
            <button
              key={lens.id}
              type="button"
              class={`map-lens-btn${active ? ' active' : ''}`}
              onClick={() => actions.setMode(lens.id)}
              title={`${lens.code} ${lens.label} (快捷键 ${lens.hotkey})`}
            >
              <span class="lens-short">{lens.short}</span>
              <span class="lens-code mono-num">{lens.hotkey}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
