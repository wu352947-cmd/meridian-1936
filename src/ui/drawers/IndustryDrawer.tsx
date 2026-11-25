import { industrySubTabSig, simIndustrySig, type AppActions } from '../store/simStore';
import { IndustryConstructionTab } from './IndustryConstructionTab';
import { IndustryProductionTab } from './IndustryProductionTab';
import { IndustryTradeTab } from './IndustryTradeTab';

interface Props {
  actions: AppActions;
}

function fmtSigned(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function IndustryDrawer({ actions }: Props) {
  const ind = simIndustrySig.value;
  const subtab = industrySubTabSig.value;

  if (!ind) {
    return (
      <div class="drawer-body">
        <div class="ind-pool-row">正在同步工业与资源模拟快照…</div>
      </div>
    );
  }

  const resEntries = [
    { key: 'steel' as const, label: '钢', color: '#7FA5C2', b: ind.resources.steel },
    { key: 'oil' as const, label: '油', color: '#E2A441', b: ind.resources.oil },
    { key: 'rare' as const, label: '稀', color: '#C590BF', b: ind.resources.rare },
  ];

  return (
    <div class="ind-drawer-wrap">
      <div class="ind-res-strip">
        <div class="ind-res-top">
          <div class="ind-res-chips mono-num">
            {resEntries.map((item) => {
              const domDiff = item.b.prod - item.b.demand;
              const isShort = item.b.net < 0;
              const isImported = item.b.imported > 0;
              return (
                <span
                  key={item.key}
                  class={`ind-res-chip${isShort ? ' is-short' : isImported ? ' is-imported' : ''}`}
                  title={`${item.label}：本土产 ${item.b.prod} / 需求 ${item.b.demand} / 进口 +${item.b.imported} / 出口 -${item.b.exported} → 净 ${fmtSigned(item.b.net)}`}
                >
                  <span class="ind-res-dot" style={`background:${item.color}`} />
                  {item.label}
                  <strong>{fmtSigned(item.b.net)}</strong>
                  {domDiff < 0 && isImported && (
                    <em style="font-style:normal;font-size:9.5px;color:#E5C275;">(进{item.b.imported})</em>
                  )}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            class={`ind-autotrade-btn${ind.autoTrade ? ' is-on' : ''}`}
            onClick={() => actions.toggleAutoTrade(!ind.autoTrade)}
            title="自动平衡贸易：1 座民工购入 8 单位资源"
          >
            自动贸易:{ind.autoTrade ? '开' : '关'}
          </button>
        </div>

        <div class="ind-civ-bar mono-num">
          <span>
            民工 <strong>{ind.civTotal}</strong>（消费 {ind.civConsumer} · 贸易 {ind.civTrade} · 建设 {ind.civBuild} · 闲 {ind.civIdle}）
          </span>
        </div>
      </div>

      <div class="ind-subtabs" role="tablist" aria-label="军工调度分栏">
        <button
          type="button"
          role="tab"
          aria-selected={subtab === 'production'}
          class={`ind-subtab${subtab === 'production' ? ' active' : ''}`}
          onClick={() => {
            industrySubTabSig.value = 'production';
          }}
        >
          军需产线 ({ind.milAssigned}/{ind.milTotal})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === 'construction'}
          class={`ind-subtab${subtab === 'construction' ? ' active' : ''}`}
          onClick={() => {
            industrySubTabSig.value = 'construction';
          }}
        >
          工程建设 ({ind.queue.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === 'trade'}
          class={`ind-subtab${subtab === 'trade' ? ' active' : ''}`}
          onClick={() => {
            industrySubTabSig.value = 'trade';
          }}
        >
          资源贸易 ({ind.civTrade}民)
        </button>
      </div>

      <div class="ind-body">
        {subtab === 'production' && <IndustryProductionTab ind={ind} actions={actions} />}
        {subtab === 'construction' && <IndustryConstructionTab ind={ind} actions={actions} />}
        {subtab === 'trade' && <IndustryTradeTab ind={ind} actions={actions} />}
      </div>
    </div>
  );
}
