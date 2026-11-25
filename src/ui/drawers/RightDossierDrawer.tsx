import type { DrawerTab } from '../../debug/urlHarness';
import { getCountryInfo } from '../../data/countries1936';
import { formatDateZh } from '../../sim/core/ClockCalendar';
import { formatPermillePct } from '../../sim/core/FixedMath';
import { REGIME_META } from '../../sim/data/nations1936';
import {
  activeDrawerSig,
  simNationsSig,
  simPlayerTagSig,
  simTickSig,
  type AppActions,
} from '../store/simStore';
import { ArmyDrawer } from './ArmyDrawer';
import { BattleReportDrawer } from './BattleReportDrawer';
import { GovernanceDrawer } from './GovernanceDrawer';
import { IndustryDrawer } from './IndustryDrawer';

interface Props {
  actions: AppActions;
  onClose: () => void;
}

const DRAWER_SPEC: Record<
  DrawerTab,
  { fkey: string; title: string; batchTag: string; summary: string; items: string[] }
> = {
  directives: {
    fkey: 'F1',
    title: '国家方略与政务法令',
    batchTag: 'Batch 04 / 08',
    summary: '签批 28/42 日国家方略路线，调整经济动员、兵役征召与战略贸易三槽政务法令。',
    items: ['6 大国专属精悍方略树（20–24 节点）', '区域国家 16 节点通用方略与常设方略', '三槽政务法令（消耗行政点 AP 切换）'],
  },
  diplomacy: {
    fkey: 'F2',
    title: '外交矩阵与阵营协约',
    batchTag: 'Batch 09',
    summary: '管理双边关系、互不侵犯、独立担保、战略禁运、租借援助与最后通牒连锁参战预览。',
    items: ['8 项精炼外交行动与全透明评分拆解', '欧洲危机度阀门与三大阵营联防机制', '战后行政工业区两轮制善后和约大会'],
  },
  industry: {
    fkey: 'F3',
    title: '军工与工程调度卷宗',
    batchTag: 'Batch 03',
    summary: '统筹 155 个行政工业区民用工坊建设、7 类通用军需生产线熟练度与钢/油/稀自动贸易。',
    items: ['民用工坊 / 军工车间 / 船坞建设队列', '7 类通用军需滑块与产线熟练度爬升', '三类战略资源自动平衡贸易开关'],
  },
  tech: {
    fkey: 'F4',
    title: '蓝晒工程科技档案',
    batchTag: 'Batch 04',
    summary: '普鲁士蓝晒图纸界面的 4 大分支 36 项时代科技节点与跨年超前研究惩罚公式。',
    items: ['步炮工程 / 机动装甲 / 海空雷达 / 战时工业', '2–4 并行科研槽实时进度与历史年份标尺', '科技完成后平滑升级全军属性'],
  },
  logistics: {
    fkey: 'F5',
    title: '占领治理与补给后勤',
    batchTag: 'Batch 07 / 10',
    summary: '监控首都与港口多源最短路补给网、东欧泥泞严冬气候与占领区三档治安政策。',
    items: ['每日 00:00 全图多源补给阻抗刷新', '单省堆叠上限与包围圈断粮告警', '占领区抵抗/顺从度与后台治安配额'],
  },
  army: {
    fkey: 'F6',
    title: '集团军编组与战线指挥',
    batchTag: 'Batch 05 / 06',
    summary: '统辖 6 类标准作战旅编制、可见连续参谋战线、钳形进攻箭头与透明前锋/支援陆战结算。',
    items: ['改良北约战术军牌与双进度条显示', '边境自动吸附连续战线与微操覆盖锁', '侧翼夹击拓宽与合围口袋全歼战报'],
  },
  battle: {
    fkey: '战报',
    title: '省级战地简报与乘数拆解',
    batchTag: 'Batch 06',
    summary: '实时展示省级交战前锋/支援槽位、预备队与逐项透明攻防乘数拆解。',
    items: ['前锋/支援宽度与多方向夹击拓宽', '地形/渡河/要塞/堑壕/筹备逐项乘算', '装甲压制与 6 小时实时战况评估'],
  },
};

export function RightDossierDrawer({ actions, onClose }: Props) {
  const tab = activeDrawerSig.value;
  if (!tab || tab === 'tech') return null;

  const spec = DRAWER_SPEC[tab];
  const tag = simPlayerTagSig.value;
  const info = getCountryInfo(tag);
  const nation = simNationsSig.value[tag];
  const tick = simTickSig.value;
  const regime = nation ? REGIME_META[nation.regime] : REGIME_META.neutral;

  return (
    <aside class="right-drawer" aria-label={`${spec.fkey} ${spec.title}`}>
      <div class="drawer-head">
        <div class="drawer-title-group">
          <span class="drawer-fkey mono-num">{spec.fkey}</span>
          <h2>{spec.title}</h2>
        </div>
        <button type="button" class="staff-btn drawer-close-btn" onClick={onClose} title="关闭抽屉 (Esc)">
          ×
        </button>
      </div>

      {tab === 'industry' ? (
        <IndustryDrawer actions={actions} />
      ) : tab === 'directives' ? (
        <GovernanceDrawer actions={actions} />
      ) : tab === 'army' ? (
        <ArmyDrawer actions={actions} />
      ) : tab === 'battle' ? (
        <BattleReportDrawer actions={actions} />
      ) : (
      <div class="drawer-body">
        <div class="drawer-stamp-card">
          <div class="drawer-stamp-top">
            <span class="drawer-notice-badge">占位卷宗页</span>
            <span class="drawer-batch-tag mono-num">规划交付 · {spec.batchTag}</span>
          </div>
          <p class="drawer-placeholder-msg">
            本卷宗完整交互与模拟结算<strong>将在后续批次实现</strong>。当前批次（Batch 02）聚焦确定性时钟、双缓冲 Worker 同步与参谋桌面骨架。
          </p>
        </div>

        <div class="drawer-section">
          <h3>当前执掌国实时快照（Worker 同步）</h3>
          <div class="drawer-kv-list">
            <div class="drawer-kv">
              <span>国家 / 政体</span>
              <span>
                {info.nameZh} · {regime.shortZh}
              </span>
            </div>
            <div class="drawer-kv">
              <span>当前战区日期</span>
              <span class="mono-num">{formatDateZh(tick)}</span>
            </div>
            <div class="drawer-kv">
              <span>工坊（民/军/船）</span>
              <span class="mono-num">
                {nation ? `${nation.civ} / ${nation.mil} / ${nation.doc}` : '—'}
              </span>
            </div>
            <div class="drawer-kv">
              <span>凝聚 / 动员</span>
              <span class="mono-num">
                {nation
                  ? `${formatPermillePct(nation.cohesionPermille)} / ${formatPermillePct(nation.readinessPermille)}`
                  : '—'}
              </span>
            </div>
            <div class="drawer-kv">
              <span>在编陆 / 海 / 空</span>
              <span class="mono-num">
                {nation ? `${nation.brigades} 旅 · ${nation.ships} 舰 · ${nation.airWings} 队` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <h3>后续模块设计要点</h3>
          <p class="drawer-summary">{spec.summary}</p>
          <ul class="drawer-roadmap-list">
            {spec.items.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      )}
    </aside>
  );
}
