import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getCountryInfo } from '../../data/countries1936';
import { formatFixedNum, formatPermillePct } from '../../sim/core/FixedMath';
import { REGIME_META } from '../../sim/data/nations1936';
import {
  simGovernanceSig,
  simIndustrySig,
  simNationsSig,
  simPlayerTagSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function TopLeftNationBrief({ actions }: Props) {
  const tag = simPlayerTagSig.value;
  const info = getCountryInfo(tag);
  const nation = simNationsSig.value[tag];
  const ind = simIndustrySig.value;
  const gov = simGovernanceSig.value;
  const resTooltip = ind && ind.tag === tag
    ? `模拟资源日净余｜钢:产${ind.resources.steel.prod}/需${ind.resources.steel.demand}/进${ind.resources.steel.imported}｜油:产${ind.resources.oil.prod}/需${ind.resources.oil.demand}/进${ind.resources.oil.imported}｜稀:产${ind.resources.rare.prod}/需${ind.resources.rare.demand}/进${ind.resources.rare.imported}`
    : '战略资源净余量：钢铁 / 原油 / 稀有金属';
  const mp = gov && gov.tag === tag ? gov.manpower : null;
  const mpTooltip = mp
    ? `可用人力：${(mp.available / 10_000).toFixed(1)}万｜总适役池：${(mp.maxManpower / 10_000).toFixed(1)}万（适役率 ${(mp.effectiveRatePermille / 10).toFixed(1)}%）｜在编：${(mp.deployed / 10_000).toFixed(1)}万｜累计战损：${mp.casualties}${mp.dailyInflow > 0 ? `｜动员日增 +${mp.dailyInflow}` : ''}`
    : '可用适役人力池';
  const facTooltip = ind && ind.tag === tag
    ? `总工厂（民/军/船）｜消费品占用 ${Math.round(ind.consumerGoodsPermille / 10)}%（${ind.civConsumer} 民工）｜可用民工 ${ind.civTotal - ind.civConsumer}（建设 ${ind.civBuild} / 贸易 ${ind.civTrade} / 闲置 ${ind.civIdle}）`
    : '总工厂数（民用工坊 / 军工车间 / 造船船坞）';

  const regime = nation ? REGIME_META[nation.regime] : REGIME_META.neutral;
  const apText = nation ? Math.floor(nation.apPermille / 1000).toString() : '—';
  const apRate = nation ? `+${formatFixedNum(nation.apDailyPermille, 1)}` : '';
  const cohText = nation ? formatPermillePct(nation.cohesionPermille, 0) : '—';
  const rdyText = nation ? formatPermillePct(nation.readinessPermille, 0) : '—';
  const mpText = mp
    ? `${(mp.available / 10_000).toFixed(1)}万`
    : nation
      ? `${(nation.manpowerK / 10).toFixed(1)}万`
      : '—';
  const facTotal = nation ? nation.civ + nation.mil + nation.doc : 0;

  return (
    <header class="hud-top-left" aria-label="国家印鉴与核心国力笺">
      <button
        type="button"
        class="hud-nation-btn"
        onClick={() => actions.focusCountry(tag, true)}
        title={`点击聚焦${info.capitalZh}首都`}
      >
        <img
          class="hud-flag"
          src={getFlagDataUri(tag)}
          alt={info.nameZh}
          width={44}
          height={29}
        />
        <div class="hud-nation-title">
          <div class="hud-nation-name">{info.nameZh}</div>
          <div class="hud-regime-row">
            <span class="hud-regime-dot" style={`background:${regime.sealColor}`} />
            <span>{regime.shortZh}</span>
          </div>
        </div>
      </button>

      <div class="hud-sep" />

      <div class="hud-stat-group">
        <div class="hud-stat" title="行政点（每日自然产出）">
          <span class="hud-stat-k">行政点 AP</span>
          <span class="hud-stat-v mono-num">
            {apText}
            <em class="hud-stat-delta">{apRate}</em>
          </span>
        </div>

        <div class="hud-stat" title="社会凝聚度 / 战时动员度">
          <span class="hud-stat-k">凝聚 / 动员</span>
          <span class="hud-stat-v mono-num">
            <span class={nation && nation.cohesionPermille < 450 ? 'val-warn' : ''}>{cohText}</span>
            <span class="val-slash">/</span>
            <span>{rdyText}</span>
          </span>
        </div>

        <div class="hud-stat" title={mpTooltip}>
          <span class="hud-stat-k">可用人力</span>
          <span class="hud-stat-v mono-num">{mpText}</span>
        </div>

        <div class="hud-stat" title={facTooltip}>
          <span class="hud-stat-k">工厂 民/军/船</span>
          <span class="hud-stat-v mono-num">
            {facTotal}
            <em class="hud-stat-sub">
              ({nation?.civ ?? 0}/{nation?.mil ?? 0}/{nation?.doc ?? 0})
            </em>
          </span>
        </div>

        <div class="hud-stat hud-stat-res" title={resTooltip}>
          <span class="hud-stat-k">钢 / 油 / 稀</span>
          <span class="hud-stat-v mono-num">
            <span class={nation && nation.steelNet < 0 ? 'val-neg' : 'val-pos'}>
              {nation ? fmtSigned(nation.steelNet) : '—'}
            </span>
            <span class="val-slash">/</span>
            <span class={nation && nation.oilNet < 0 ? 'val-neg' : 'val-pos'}>
              {nation ? fmtSigned(nation.oilNet) : '—'}
            </span>
            <span class="val-slash">/</span>
            <span class={nation && nation.rareNet < 0 ? 'val-neg' : 'val-pos'}>
              {nation ? fmtSigned(nation.rareNet) : '—'}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
