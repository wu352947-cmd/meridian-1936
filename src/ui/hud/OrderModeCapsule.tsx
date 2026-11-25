/**
 * Bottom-left desktop & tablet touch order mode capsule (选择 / 行军 / 战线 / 箭头).
 */
import {
  orderToolModeSig,
  selectedBrigadeIdsSig,
  type AppActions,
  type OrderToolMode,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

const MODES: ReadonlyArray<{ id: OrderToolMode; label: string; tip: string }> = [
  { id: 'select', label: '点选', tip: '点选军牌或 Shift+拖拽框选部队' },
  { id: 'march', label: '行军', tip: '点击己方省下达手动行军（打手操锁）' },
  { id: 'frontline', label: '战线', tip: '点击邻国省份自动绑定连续战线' },
  { id: 'arrow', label: '箭头', tip: '从战线拖拽至目标省绘制进攻箭头' },
];

export function OrderModeCapsule({ actions }: Props) {
  const mode = orderToolModeSig.value;
  const selCount = selectedBrigadeIdsSig.value.length;

  return (
    <div class="order-capsule" role="group" aria-label="陆军指令模式切换">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          class={`order-cap-btn${mode === m.id ? ' active' : ''}`}
          onClick={() => actions.setOrderToolMode(m.id)}
          title={m.tip}
        >
          {m.label}
        </button>
      ))}
      {selCount > 0 && (
        <button
          type="button"
          class="order-sel-chip mono-num"
          onClick={() => actions.selectBrigades([], null)}
          title="清除当前选中部队"
        >
          已选{selCount}旅 ×
        </button>
      )}
    </div>
  );
}
