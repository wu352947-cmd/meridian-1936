import { useEffect } from 'preact/hooks';
import type { MapMode } from '../types/map';
import { CreditsModal } from './CreditsModal';
import { ProvinceInfoCard } from './ProvinceInfoCard';
import {
  cameraSig,
  hoveredProvSig,
  loadErrorSig,
  mapCountsSig,
  mapModeSig,
  mapReadySig,
  selectedProvSig,
  showCreditsSig,
  type MapActions,
} from './mapStore';

const MODES: Array<{ id: MapMode; label: string; key: string }> = [
  { id: 'political', label: '政治版图', key: 'Q' },
  { id: 'terrain', label: '地形地貌', key: 'W' },
  { id: 'diplomacy', label: '外交阵营', key: 'E' },
  { id: 'industry', label: '工业资源', key: 'R' },
];

const LEGENDS: Partial<Record<MapMode, Array<{ label: string; color: string }>>> = {
  terrain: [
    { label: '平原', color: '#E5DEC9' },
    { label: '森林', color: '#6F8260' },
    { label: '丘陵', color: '#B59E7A' },
    { label: '高山', color: '#6E5A4B' },
    { label: '沼泽', color: '#6B7D78' },
    { label: '都市', color: '#C29A86' },
    { label: '荒漠', color: '#D8C394' },
  ],
  diplomacy: [
    { label: '本国', color: '#4E8A57' },
    { label: '同盟阵营', color: '#5484B0' },
    { label: '紧张对手', color: '#B85244' },
    { label: '中立国', color: '#B0A89A' },
  ],
  industry: [
    { label: '重工核心', color: '#9E4C3A' },
    { label: '工业区', color: '#B87E4A' },
    { label: '轻工城镇', color: '#C4AE80' },
    { label: '农业腹地', color: '#DAD2C1' },
  ],
};

function lodLabel(zoom: number): string {
  if (zoom < 1.1) return '洲际层';
  if (zoom < 2.1) return '战役层';
  if (zoom < 3.4) return '战术层';
  return '详查层';
}

interface Props {
  actions: MapActions;
}

export function MapOverlay({ actions }: Props) {
  const mode = mapModeSig.value;
  const cam = cameraSig.value;
  const hovered = hoveredProvSig.value;
  const selected = selectedProvSig.value;
  const showCredits = showCreditsSig.value;
  const ready = mapReadySig.value;
  const err = loadErrorSig.value;
  const counts = mapCountsSig.value;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreditsSig.value) showCreditsSig.value = false;
        else actions.clearSelection();
        return;
      }
      if (showCreditsSig.value) return;
      const k = e.key.toLowerCase();
      if (k === 'q' || k === '1') actions.setMode('political');
      else if (k === 'w' || k === '2') actions.setMode('terrain');
      else if (k === 'e' || k === '3') actions.setMode('diplomacy');
      else if (k === 'r' || k === '4') actions.setMode('industry');
      else if (k === '+' || k === '=') actions.zoomIn();
      else if (k === '-') actions.zoomOut();
      else if (k === '0' || k === 'h') actions.resetView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  return (
    <div class="meridian-overlay">
      <header class="cartouche-title">
        <div>
          <h1>子午线 1936：碎裂大陆</h1>
          <div class="cartouche-subtitle">
            欧洲参谋地图 · 1936.01.01
            {ready && (
              <span class="mono-num">
                {' '}
                · {counts.land} 陆省 / {counts.sea} 海区
              </span>
            )}
          </div>
        </div>
        <div class="cartouche-divider" />
        <button
          type="button"
          class="staff-btn"
          onClick={() => {
            showCreditsSig.value = true;
          }}
        >
          关于 / 致谢
        </button>
      </header>

      {LEGENDS[mode] && (
        <aside class="mode-legend" aria-label="图例">
          {LEGENDS[mode]!.map((item) => (
            <span class="legend-item" key={item.label}>
              <span class="terrain-dot" style={`background:${item.color}`} />
              {item.label}
            </span>
          ))}
        </aside>
      )}

      {err && (
        <div
          style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1E1C1A;border:1px solid #B83A2D;padding:18px 24px;border-radius:5px;pointer-events:auto;"
        >
          地图加载失败：{err}
        </div>
      )}

      <ProvinceInfoCard
        hovered={hovered}
        selected={selected}
        onClearSelected={actions.clearSelection}
      />

      <nav class="mode-dock" aria-label="地图模式切换">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            class={`staff-btn mode-btn${mode === m.id ? ' active' : ''}`}
            onClick={() => actions.setMode(m.id)}
          >
            <span>{m.label}</span>
            <span class="mode-key">{m.key}</span>
          </button>
        ))}
      </nav>

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
        <button type="button" class="staff-btn" onClick={actions.resetView} title="重置全欧视角 (H)">
          全图
        </button>
      </div>

      <CreditsModal
        open={showCredits}
        onClose={() => {
          showCreditsSig.value = false;
        }}
      />
    </div>
  );
}
