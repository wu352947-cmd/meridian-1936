import { getCountryInfo } from '../../data/countries1936';
import {
  ECONOMY_LAW_LABEL_ZH,
  SEA_CONVOYS_PER_LOT,
  TRADE_UNITS_PER_CIV,
  type IndustrySnapshot,
  type ResourceType,
} from '../../sim/systems/industryTypes';
import type { AppActions } from '../store/simStore';

interface Props {
  ind: IndustrySnapshot;
  actions: AppActions;
}

const RES_META: ReadonlyArray<{ key: ResourceType; label: string; color: string }> = [
  { key: 'steel', label: '钢铁', color: '#7FA5C2' },
  { key: 'oil', label: '原油', color: '#E2A441' },
  { key: 'rare', label: '稀有金属', color: '#C590BF' },
];

function fmtSigned(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function IndustryTradeTab({ ind, actions }: Props) {
  const imports = ind.deals.filter((d) => d.importerTag === ind.tag);
  const exports = ind.deals.filter((d) => d.exporterTag === ind.tag);

  return (
    <>
      <div class="drawer-section">
        <h3>战略资源日收支总账</h3>
        <table class="trade-ledger-table">
          <thead>
            <tr>
              <th>资源</th>
              <th>本土产</th>
              <th>军工需</th>
              <th>本土差</th>
              <th>进口</th>
              <th>出口</th>
              <th>净余</th>
            </tr>
          </thead>
          <tbody class="mono-num">
            {RES_META.map((m) => {
              const b = ind.resources[m.key];
              const domesticDiff = b.prod - b.demand;
              return (
                <tr key={m.key}>
                  <td>
                    <span class="ind-res-dot" style={`display:inline-block;margin-right:5px;background:${m.color}`} />
                    {m.label}
                  </td>
                  <td>{b.prod}</td>
                  <td>{b.demand}</td>
                  <td class={domesticDiff < 0 ? 'val-neg' : 'val-pos'}>{fmtSigned(domesticDiff)}</td>
                  <td style={b.imported > 0 ? 'color:#E5C275;' : 'color:#7E766B;'}>
                    {b.imported > 0 ? `+${b.imported}` : '0'}
                  </td>
                  <td style={b.exported > 0 ? 'color:#8CB6D8;' : 'color:#7E766B;'}>
                    {b.exported > 0 ? `-${b.exported}` : '0'}
                  </td>
                  <td class={b.net < 0 ? 'val-neg' : 'val-pos'} style="font-weight:600;">
                    {fmtSigned(b.net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div class="drawer-section">
        <h3>自动贸易与民用工坊核算</h3>
        <div class="drawer-kv-list">
          <div class="drawer-kv">
            <span>自动平衡进口（1民工={TRADE_UNITS_PER_CIV}单位）</span>
            <button
              type="button"
              class={`ind-autotrade-btn${ind.autoTrade ? ' is-on' : ''}`}
              onClick={() => actions.toggleAutoTrade(!ind.autoTrade)}
            >
              {ind.autoTrade ? '已开启 · 点击关闭' : '已关闭 · 点击开启'}
            </button>
          </div>
          <div class="drawer-kv">
            <span>经济法令 / 消费品占用</span>
            <span class="mono-num">
              {ECONOMY_LAW_LABEL_ZH[ind.economyLaw]} ({Math.round(ind.consumerGoodsPermille / 10)}%)
            </span>
          </div>
          <div class="drawer-kv">
            <span>民工去向（消费+贸易+建设+闲置）</span>
            <span class="mono-num">
              {ind.civConsumer}+{ind.civTrade}+{ind.civBuild}+{ind.civIdle} = {ind.civTotal}
            </span>
          </div>
          <div class="drawer-kv">
            <span>护航运输船（跨海每单占 {SEA_CONVOYS_PER_LOT} 艘）</span>
            <span class="mono-num">
              在用 {ind.convoysUsed} / 总计 {ind.convoysTotal} 艘
            </span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <h3>活跃进口订单（{imports.length} 项 · 占 {ind.civTrade} 民工）</h3>
        {imports.length === 0 ? (
          <div class="ind-pool-row">
            <span>{ind.autoTrade ? '本土资源充裕或暂无可用贸易额度。' : '自动贸易已关闭，资源缺口将直接惩罚军工效率。'}</span>
          </div>
        ) : (
          <div style="display:flex;flex-direction:column;gap:5px;">
            {imports.map((d, i) => {
              const partner = getCountryInfo(d.exporterTag);
              const resLabel = RES_META.find((r) => r.key === d.resource)?.label ?? d.resource;
              return (
                <div class="trade-deal-row" key={`${d.exporterTag}-${d.resource}-${i}`}>
                  <span>
                    自 <strong>{partner.shortZh}</strong> 购入 <strong>{resLabel}</strong>
                  </span>
                  <span class="mono-num" style="color:#E8C77F;">
                    +{d.amount}（{d.civCost}民工 · {d.isSea ? `海运${d.convoys}船` : '陆路'}）
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {exports.length > 0 && (
        <div class="drawer-section">
          <h3>对外富余出口（{exports.length} 项）</h3>
          <div style="display:flex;flex-direction:column;gap:4px;">
            {exports.slice(0, 6).map((d, i) => {
              const buyer = getCountryInfo(d.importerTag);
              const resLabel = RES_META.find((r) => r.key === d.resource)?.label ?? d.resource;
              return (
                <div class="trade-deal-row" key={`${d.importerTag}-${d.resource}-${i}`}>
                  <span>向 {buyer.shortZh} 供应 {resLabel}</span>
                  <span class="mono-num" style="color:#8CB6D8;">-{d.amount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
