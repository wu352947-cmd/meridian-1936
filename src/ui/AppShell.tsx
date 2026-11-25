import { useEffect } from 'preact/hooks';
import type { DrawerTab } from '../debug/urlHarness';
import type { MapMode } from '../types/map';
import { CreditsModal } from './CreditsModal';
import { ProvinceInfoCard } from './ProvinceInfoCard';
import { ScenarioSelectModal } from './ScenarioSelectModal';
import { RightDossierDrawer } from './drawers/RightDossierDrawer';
import { TechBlueprintModal } from './modals/TechBlueprintModal';
import { ArmyCardsBar } from './hud/ArmyCardsBar';
import { BottomCommandDock } from './hud/BottomCommandDock';
import { DispatchTicker } from './hud/DispatchTicker';
import { OrderModeCapsule } from './hud/OrderModeCapsule';
import { SeasonalMapOverlay } from './hud/SeasonalMapOverlay';
import { TopLeftNationBrief } from './hud/TopLeftNationBrief';
import { TopRightClockBar } from './hud/TopRightClockBar';
import { WipeoutBanner } from './hud/WipeoutBanner';
import {
  cameraSig,
  hoveredProvSig,
  loadErrorSig,
  mapModeSig,
  selectedProvSig,
  showCreditsSig,
} from './mapStore';
import { activeDrawerSig, colorblindModeSig, screenModeSig, simPlayerTagSig, type AppActions } from './store/simStore';

const DIPLO_FACTION_LEGEND: Array<{ label: string; color: string; hatch?: boolean }> = [
  { label: '协约同盟', color: '#4B7098' },
  { label: '中欧同盟', color: '#9C4842' },
  { label: '东方共同体', color: '#963E3A' },
  { label: '中立国', color: '#A8A091' },
];

const SUPPLY_LEGEND_STD: Array<{ label: string; color: string; hatch?: boolean }> = [
  { label: '充裕 (80–100)', color: 'linear-gradient(90deg, #62D678, #587434)' },
  { label: '吃紧 (40–79)', color: 'linear-gradient(90deg, #F0D26C, #A65E2A)' },
  { label: '缺粮 (<40)', color: 'linear-gradient(90deg, #D0603E, #6C1E1C)' },
  { label: '断粮 (0)', color: '#A82A22', hatch: true },
];

const SUPPLY_LEGEND_CB: Array<{ label: string; color: string; hatch?: boolean }> = [
  { label: '充裕 (80–100)', color: 'linear-gradient(90deg, #5ABCF4, #366088)' },
  { label: '吃紧 (40–79)', color: 'linear-gradient(90deg, #D8DAD4, #8E765C)' },
  { label: '缺粮 (<40)', color: 'linear-gradient(90deg, #F09834, #90340E)' },
  { label: '断粮 (0)', color: '#DE6614', hatch: true },
];

const LEGENDS: Partial<Record<MapMode, Array<{ label: string; color: string; hatch?: boolean }>>> = {
  terrain: [
    { label: '平原', color: '#E5DEC9' },
    { label: '森林', color: '#6F8260' },
    { label: '丘陵', color: '#B59E7A' },
    { label: '高山', color: '#6E5A4B' },
    { label: '沼泽', color: '#6B7D78' },
    { label: '都市', color: '#CCB298' },
    { label: '荒漠', color: '#D8C394' },
  ],
  supply: [
    { label: '补给充裕', color: '#4E8A57' },
    { label: '通畅走廊', color: '#86A866' },
    { label: '运输吃紧', color: '#C4AC68' },
    { label: '补给瓶颈', color: '#B05644' },
  ],
  diplomacy: [
    { label: '本国', color: '#4E8A57' },
    { label: '同盟阵营', color: '#5484B0' },
    { label: '紧张对手', color: '#B85244' },
    { label: '中立国', color: '#B0A89A' },
  ],
  industry: [
    { label: '重工核心(≥6厂)', color: '#9E4C3A' },
    { label: '工业区(4–5)', color: '#B87E4A' },
    { label: '轻工区(2–3)', color: '#C4AE80' },
    { label: '腹地(≤1)', color: '#DAD2C1' },
    { label: '施工中', color: '#E3AD4B' },
  ],
  air_sea: [
    { label: '战略枢纽', color: '#547CA6' },
    { label: '沿海防区', color: '#7292AA' },
    { label: '内陆空域', color: '#A8A49A' },
  ],
};

const FKEY_MAP: Record<string, DrawerTab> = {
  F1: 'directives',
  F2: 'diplomacy',
  F3: 'industry',
  F4: 'tech',
  F5: 'logistics',
  F6: 'army',
};

function lodLabel(zoom: number): string {
  if (zoom < 1.1) return '洲际层';
  if (zoom < 2.1) return '战役层';
  if (zoom < 3.4) return '战术层';
  return '详查层';
}

interface Props {
  actions: AppActions;
}

export function AppShell({ actions }: Props) {
  const screen = screenModeSig.value;
  const mode = mapModeSig.value;
  const cam = cameraSig.value;
  const hovered = hoveredProvSig.value;
  const selected = selectedProvSig.value;
  const showCredits = showCreditsSig.value;
  const err = loadErrorSig.value;
  const drawer = activeDrawerSig.value;
  const colorblind = colorblindModeSig.value;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (showCreditsSig.value) showCreditsSig.value = false;
        else if (activeDrawerSig.value) actions.toggleDrawer(null);
        else actions.clearSelection();
        return;
      }
      if (showCreditsSig.value) return;

      const fTab = FKEY_MAP[e.key];
      if (fTab && screenModeSig.value === 'game') {
        e.preventDefault();
        actions.toggleDrawer(activeDrawerSig.value === fTab ? null : fTab);
        return;
      }

      if (e.code === 'Space' && screenModeSig.value === 'game') {
        e.preventDefault();
        actions.togglePause();
        return;
      }

      const k = e.key.toLowerCase();
      if (screenModeSig.value === 'game') {
        if (k === '1') actions.setSpeed(1);
        else if (k === '2') actions.setSpeed(2);
        else if (k === '3') actions.setSpeed(3);
        else if (k === '4') actions.setSpeed(4);
        else if (k === 'q') actions.setMode('political');
        else if (k === 'w') actions.setMode('terrain');
        else if (k === 'e') actions.setMode('supply');
        else if (k === 'r') actions.setMode('diplomacy');
        else if (k === 't') actions.setMode('industry');
        else if (k === 'y') actions.setMode('air_sea');
      }

      if (k === '+' || k === '=') actions.zoomIn();
      else if (k === '-') actions.zoomOut();
      else if (k === 'h' || e.key === 'Home') {
        if (screenModeSig.value === 'game') actions.focusCountry(simPlayerTagSig.value, true);
        else actions.resetView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  const legendItems =
    mode === 'supply'
      ? (colorblind ? SUPPLY_LEGEND_CB : SUPPLY_LEGEND_STD)
      : mode === 'diplomacy' && (!selected || selected.isSea)
        ? DIPLO_FACTION_LEGEND
        : LEGENDS[mode];

  return (
    <div class="meridian-overlay">
      {screen === 'country_select' ? (
        <ScenarioSelectModal actions={actions} />
      ) : (
        <>
          <SeasonalMapOverlay />
          <TopLeftNationBrief actions={actions} />
          <TopRightClockBar actions={actions} />
          {!drawer && <DispatchTicker actions={actions} />}

          {legendItems && (
            <aside class="hud-mode-legend" aria-label="图例">
              {legendItems.map((item) => (
                <span class="legend-item" key={item.label}>
                  {item.hatch ? (
                    <span class={`legend-swatch-hatch${colorblind ? ' is-cb' : ''}`} />
                  ) : (
                    <span class="terrain-dot" style={`background:${item.color}`} />
                  )}
                  {item.label}
                </span>
              ))}
              {mode === 'supply' && (
                <button
                  type="button"
                  class={`staff-btn${colorblind ? ' active' : ''}`}
                  style="padding:1px 6px;font-size:10px;margin-left:2px;"
                  onClick={() => actions.toggleColorblindMode()}
                  title="切换色盲安全蓝-灰-橙补给色表 (Okabe-Ito)"
                >
                  {colorblind ? '色盲色表: 开' : '色盲色表'}
                </button>
              )}
            </aside>
          )}

          <RightDossierDrawer actions={actions} onClose={() => actions.toggleDrawer(null)} />
          <TechBlueprintModal
            open={drawer === 'tech'}
            onClose={() => actions.toggleDrawer(null)}
            actions={actions}
          />

          <ProvinceInfoCard
            hovered={hovered}
            selected={selected}
            onClearSelected={actions.clearSelection}
            actions={actions}
          />

          <WipeoutBanner />
          <ArmyCardsBar actions={actions} />
          <OrderModeCapsule actions={actions} />

          <BottomCommandDock actions={actions} />

          <div class="zoom-dock" aria-label="缩放控制">
            <div class="zoom-meta">
              <span class="zoom-lod">{lodLabel(cam.zoom)}</span>
              <span class="zoom-val mono-num">{cam.zoom.toFixed(2)}×</span>
            </div>
            <button type="button" class="staff-btn zoom-icon-btn" onClick={actions.zoomOut} title="缩小 (-)">
              −
            </button>
            <button type="button" class="staff-btn zoom-icon-btn" onClick={actions.zoomIn} title="放大 (+)">
              +
            </button>
            <button type="button" class="staff-btn" onClick={actions.resetView} title="重置全欧视角">
              全图
            </button>
          </div>
        </>
      )}

      {err && (
        <div class="meridian-error-banner">
          系统初始化失败：{err}
        </div>
      )}

      <CreditsModal
        open={showCredits}
        onClose={() => {
          showCreditsSig.value = false;
        }}
      />
    </div>
  );
}
