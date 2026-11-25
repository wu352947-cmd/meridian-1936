import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getCountryInfo } from '../../data/countries1936';
import { formatFixedNum, formatPermillePct } from '../../sim/core/FixedMath';
import {
  CONSCRIPTION_LAW_SPECS,
  ECONOMY_LAW_SPECS,
  TRADE_LAW_SPECS,
  type GovernanceLawId,
  type GovernanceSlot,
  type LawOptionDef,
  type LawOptionStatus,
} from '../../sim/systems/governanceTypes';
import {
  simGovernanceSig,
  simIndustrySig,
  simPlayerTagSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

function fmtPop(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString('en-US');
}

interface SlotSectionProps {
  slot: GovernanceSlot;
  title: string;
  liveNote: string;
  cols: 2 | 3;
  options: LawOptionStatus[];
  specs: Record<string, LawOptionDef>;
  onSelect: (slot: GovernanceSlot, lawId: GovernanceLawId) => void;
}

function LawSlotSection({ slot, title, liveNote, cols, options, specs, onSelect }: SlotSectionProps) {
  return (
    <section class="gov-slot-card">
      <div class="gov-slot-head">
        <h3>{title}</h3>
        <span class="gov-slot-note mono-num">{liveNote}</span>
      </div>
      <div class={`gov-law-grid cols-${cols}`}>
        {options.map((opt) => {
          const spec = specs[opt.id]!;
          const cls = `gov-law-tile${opt.active ? ' is-active' : opt.canSwitch ? ' is-ready' : ' is-locked'}`;
          return (
            <button
              key={opt.id}
              type="button"
              class={cls}
              disabled={opt.active || !opt.canSwitch}
              title={
                opt.active
                  ? `${spec.nameZh}（当前生效）`
                  : opt.blockReasonZh ?? `消耗 100 AP 切换至${spec.nameZh}`
              }
              onClick={() => {
                if (opt.canSwitch) onSelect(slot, opt.id);
              }}
            >
              <div class="gov-tile-top">
                <span class="gov-law-name">{cols === 3 ? spec.shortZh : spec.nameZh}</span>
                {opt.active ? (
                  <span class="gov-active-pill">生效</span>
                ) : (
                  <span class={`gov-cost-pill mono-num${opt.canSwitch ? ' ready' : ''}`}>100AP</span>
                )}
              </div>
              <div class="gov-law-effect">{spec.summaryZh}</div>
              {!opt.active && opt.blockReasonZh && (
                <div class="gov-law-block">{opt.blockReasonZh}</div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function GovernanceDrawer({ actions }: Props) {
  const tag = simPlayerTagSig.value;
  const gov = simGovernanceSig.value;
  const ind = simIndustrySig.value;
  const info = getCountryInfo(tag);

  if (!gov || gov.tag !== tag) {
    return <div class="drawer-body">正在同步政务与人力数据…</div>;
  }

  const mp = gov.manpower;
  const mobPct = mp.maxManpower > 0 ? Math.min(100, Math.round((mp.mobilizedPool / mp.maxManpower) * 100)) : 100;
  const usableCiv = ind && ind.tag === tag ? ind.civTotal - ind.civConsumer : 0;
  const totalCiv = ind && ind.tag === tag ? ind.civTotal : 0;
  const cgPct = ind && ind.tag === tag ? Math.round(ind.consumerGoodsPermille / 10) : 35;

  return (
    <div class="gov-drawer-wrap">
      <div class="gov-banner">
        <img class="gov-flag" src={getFlagDataUri(tag)} alt={info.nameZh} width={38} height={25} />
        <div class="gov-banner-meta">
          <div class="gov-banner-top">
            <span class="gov-country-title">{info.nameZh} · 内政卷宗</span>
            <span class="gov-ap-pill mono-num">
              {Math.floor(gov.apPermille / 1000)} AP <em>+{formatFixedNum(gov.apDailyPermille, 1)}/日</em>
            </span>
          </div>
          <div class="gov-banner-sub mono-num">
            危机 {formatPermillePct(gov.crisisPermille)} · 动员 {formatPermillePct(gov.readinessPermille)}
            {gov.atWar ? ' · 战时状态' : ' · 和平态'}
          </div>
        </div>
      </div>

      <div class="gov-body">
        <div class="gov-directive-note">
          <span class="gov-note-tag">方略树</span>
          <span>国家方略将在后续批次实装；本卷宗开放三槽法令与人力动员。</span>
        </div>

        <section class="gov-mp-card">
          <div class="gov-slot-head">
            <h3>人力动员与适役兵源</h3>
            <span class="gov-slot-note mono-num">
              适役 {(mp.effectiveRatePermille / 10).toFixed(1)}%
              {mp.rateModifierPermille < 0 ? ` (含${(mp.rateModifierPermille / 10).toFixed(1)}%)` : ''}
            </span>
          </div>

          <div class="gov-mp-grid mono-num">
            <div class="gov-mp-cell">
              <span>可用人力</span>
              <strong class="gov-mp-hi">{fmtPop(mp.available)}</strong>
            </div>
            <div class="gov-mp-cell">
              <span>适役上限</span>
              <strong>{fmtPop(mp.maxManpower)}</strong>
            </div>
            <div class="gov-mp-cell">
              <span>在编人数</span>
              <strong>{fmtPop(mp.deployed)}</strong>
            </div>
            <div class="gov-mp-cell">
              <span>累计战损</span>
              <strong>{fmtPop(mp.casualties)}</strong>
            </div>
          </div>

          <div class="gov-mob-bar-wrap">
            <div class="gov-mob-bar-track">
              <div class="gov-mob-bar-fill" style={`width:${mobPct}%`} />
              <span class="gov-mob-bar-label mono-num">
                动员池 {fmtPop(mp.mobilizedPool)} / {fmtPop(mp.maxManpower)}
                {mp.dailyInflow > 0 ? ` · +${mp.dailyInflow.toLocaleString('en-US')}/日` : ' · 已满员'}
              </span>
            </div>
            <div class="gov-mp-foot mono-num">
              <span>核心 {fmtPop(mp.corePop)}</span>
              {mp.nonCorePop > 0 && <span>非核 {fmtPop(mp.nonCorePop)}×12%</span>}
              {mp.monthlyInflow > 0 && <span class="gov-inflow-tag">月增 +{fmtPop(mp.monthlyInflow)}</span>}
            </div>
          </div>
        </section>

        <LawSlotSection
          slot="economy"
          title="一、经济动员法"
          liveNote={`消费品 ${cgPct}% · 可用民工 ${usableCiv}/${totalCiv}`}
          cols={2}
          options={gov.economyOptions}
          specs={ECONOMY_LAW_SPECS}
          onSelect={actions.setGovernanceLaw}
        />

        <LawSlotSection
          slot="conscription"
          title="二、兵役征召法"
          liveNote={`有效适役 ${(mp.effectiveRatePermille / 10).toFixed(1)}%`}
          cols={2}
          options={gov.conscriptionOptions}
          specs={CONSCRIPTION_LAW_SPECS}
          onSelect={actions.setGovernanceLaw}
        />

        <LawSlotSection
          slot="trade"
          title="三、战略贸易法"
          liveNote={`出口上限 ${Math.round(gov.exportSharePermille / 10)}% · 科研 +${Math.round(gov.researchSpeedBonusPermille / 10)}%`}
          cols={3}
          options={gov.tradeOptions}
          specs={TRADE_LAW_SPECS}
          onSelect={actions.setGovernanceLaw}
        />
      </div>
    </div>
  );
}
