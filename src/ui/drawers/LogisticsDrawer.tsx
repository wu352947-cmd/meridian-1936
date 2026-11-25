/**
 * F5 Logistics & Supply Network Drawer (Carbon §4.10 / Batch 07 §4.5).
 * Displays national supply overview, per-army average S, low-supply/starving brigade counts,
 * truck stockpile & motorized-supply toggles, active supply hubs, current seasonal weather
 * with next change date, and a clean placeholder for future Occupation Management.
 */
import { formatFixedNum } from '../../sim/core/FixedMath';
import { getTheaterSeasonSummary } from '../../sim/systems/weatherSystem';
import { mapModeSig } from '../mapStore';
import {
  colorblindModeSig,
  simLogisticsSig,
  simTickSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

const HUB_KIND_ZH: Record<'capital' | 'core_city' | 'port', string> = {
  capital: '首都',
  core_city: '核心都市',
  port: '海港',
};

export function LogisticsDrawer({ actions }: Props) {
  const logi = simLogisticsSig.value;
  const tick = simTickSig.value;
  const colorblind = colorblindModeSig.value;
  const mode = mapModeSig.value;
  const season = getTheaterSeasonSummary(tick);

  if (!logi) {
    return <div class="br-empty">正在同步后勤补给网络快照…</div>;
  }

  const avgCls =
    logi.avgNationSupply >= 75 ? 'is-ok' : logi.avgNationSupply >= 40 ? 'is-warn' : 'is-bad';
  const lowCls = logi.lowSupplyBrigades > 0 ? 'is-warn' : 'is-ok';
  const starvCls = logi.starvingBrigades > 0 ? 'is-bad' : 'is-ok';

  return (
    <div class="logi-wrap">
      {/* 1. National Supply & Truck Overview */}
      <section class="logi-card">
        <div class="logi-card-head">
          <span>全国后勤补给概况</span>
          <div style="display:flex;gap:4px;">
            <button
              type="button"
              class={`staff-btn${mode === 'supply' ? ' active' : ''}`}
              style="padding:1px 6px;font-size:10px;"
              onClick={() => actions.setMode(mode === 'supply' ? 'political' : 'supply')}
              title="切换 M3 后勤补给地图模式 (E)"
            >
              M3 补给图
            </button>
            <button
              type="button"
              class={`staff-btn${colorblind ? ' active' : ''}`}
              style="padding:1px 6px;font-size:10px;"
              onClick={() => actions.toggleColorblindMode()}
              title="切换蓝-灰-橙色盲安全色表"
            >
              {colorblind ? '色盲:开' : '色盲色表'}
            </button>
          </div>
        </div>

        <div class="logi-kpi-grid mono-num">
          <div class="logi-kpi">
            <span class="logi-kpi-k">部队均补给</span>
            <span class={`logi-kpi-v ${avgCls}`}>S={logi.avgNationSupply}</span>
          </div>
          <div class="logi-kpi">
            <span class="logi-kpi-k">缺粮 / 断粮</span>
            <span class={`logi-kpi-v ${logi.starvingBrigades > 0 ? starvCls : lowCls}`}>
              {logi.lowSupplyBrigades} / {logi.starvingBrigades} 旅
            </span>
          </div>
          <div class="logi-kpi">
            <span class="logi-kpi-k">卡车库存</span>
            <span class="logi-kpi-v">{logi.truckStockpile}</span>
          </div>
        </div>

        <div class="logi-army-meta mono-num">
          <span>卡车日产 +{formatFixedNum(logi.truckDailyProdFixed, 1)}</span>
          <span>摩托化补给日耗 −{logi.truckDailyDemand}</span>
          <span>每日 00:00 重算全图补给网</span>
        </div>
      </section>

      {/* 2. Per-Army Supply & Motorized Supply Toggles */}
      <section class="logi-card">
        <div class="logi-card-head">
          <span>集团军补给与摩托化配给</span>
          <span class="mono-num" style="font-size:10px;color:var(--ui-text-muted);">
            跨省阻抗 −3
          </span>
        </div>
        {logi.armies.length === 0 ? (
          <div style="font-size:11px;color:var(--ui-text-muted);">暂无在编集团军</div>
        ) : (
          logi.armies.map((a) => {
            const btnCls = !a.motorizedSupply
              ? 'logi-mot-btn'
              : a.motorizedFunded
                ? 'logi-mot-btn active'
                : 'logi-mot-btn shortage';
            return (
              <div key={a.armyId} class="logi-army-row">
                <div class="logi-army-main">
                  <div class="logi-army-name">
                    <span class="logi-army-dot" style={`background:${a.color}`} />
                    <span>{a.nameZh}</span>
                    <span class="mono-num" style="font-size:10px;color:var(--ui-text-muted);">
                      {a.brigadeCount}旅
                    </span>
                  </div>
                  <div class="logi-army-meta mono-num">
                    <span>均补给 S={a.avgSupply}</span>
                    {a.lowSupplyCount > 0 && <span class="val-warn">缺粮 {a.lowSupplyCount}</span>}
                    {a.starvingCount > 0 && <span class="val-neg">断粮 {a.starvingCount}</span>}
                    {a.motorizedSupply && <span>耗车 {a.dailyTruckCost}/日</span>}
                  </div>
                </div>
                <button
                  type="button"
                  class={btnCls}
                  onClick={() => actions.toggleArmyMotorizedSupply(a.armyId)}
                  title="开启后消耗库存卡车，每跨省补给阻抗 −3"
                >
                  {!a.motorizedSupply ? '摩托化: 关' : a.motorizedFunded ? '摩托化: 开' : '缺卡车'}
                </button>
              </div>
            );
          })
        )}
      </section>

      {/* 3. Active Supply Sources */}
      <section class="logi-card">
        <div class="logi-card-head">
          <span>本国补给源节点</span>
          <span class="mono-num" style="font-size:10px;color:var(--ui-text-muted);">
            共 {logi.hubs.length} 处
          </span>
        </div>
        <div class="logi-hub-list">
          {logi.hubs.slice(0, 12).map((h) => (
            <div key={h.provId} class="logi-hub-row">
              <span>
                {h.kind === 'capital' ? '★ ' : h.kind === 'core_city' ? '◈ ' : '⚓ '}
                {h.nameZh}
              </span>
              <span style="display:inline-flex;align-items:center;gap:5px;">
                <span class="logi-hub-tag">
                  {HUB_KIND_ZH[h.kind]}
                  {h.portLevel > 0 ? ` · ${h.portLevel}级港` : ''}
                </span>
                <strong class="mono-num" style="color:#E8CA82;">S={h.effectiveSupply}</strong>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Seasonal Weather & Next Change Date */}
      <section class="logi-card">
        <div class="logi-card-head">
          <span>季节气候与夜战态势</span>
          <span class="mono-num" style="font-size:10px;color:#E6C77E;">
            {season.isNight ? '夜间 ×0.75' : '昼间 18:00起夜战'}
          </span>
        </div>
        <div class="logi-season-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>{season.activeBadgeZh}</strong>
            <span class="mono-num" style="font-size:10px;color:var(--ui-text-muted);">
              下次变季 {season.nextChangeDateIso}
            </span>
          </div>
          <span style="font-size:10.5px;color:var(--ui-text-secondary);">{season.activeDetailZh}</span>
          <span style="font-size:10px;color:var(--ui-text-muted);">
            预告：{season.nextChangeLabelZh}
          </span>
        </div>
      </section>

      {/* 5. Future Batch 10 Occupation Placeholder */}
      <section class="logi-placeholder">
        <strong>占领管理（后续开放）</strong>
        <span>非核心占领区三档政策、抵抗度与顺从度治安配额将在后续批次接入。</span>
      </section>
    </div>
  );
}
