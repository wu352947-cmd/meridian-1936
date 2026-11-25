import {
  formatClockTime,
  formatDateZh,
  tickToDate,
  type SimSpeed,
} from '../../sim/core/ClockCalendar';
import { getTheaterSeasonSummary } from '../../sim/systems/weatherSystem';
import { showCreditsSig } from '../mapStore';
import {
  simCrisisSig,
  simPausedSig,
  simSpeedSig,
  simTickSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

const SPEEDS: readonly SimSpeed[] = [1, 2, 3, 4];

/** Semi-circular SVG brass pressure gauge for European Crisis Index (0..1000 permille). */
function CrisisDial({ permille }: { permille: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(permille / 10)));
  const angleDeg = -90 + (pct / 100) * 180;
  const danger = pct >= 50;
  const warn = pct >= 25 && pct < 50;
  const accent = danger ? '#C84738' : warn ? '#D49A42' : '#6A9B6E';

  return (
    <div class="crisis-dial" title={`欧洲危机度：${pct}%（25% 解锁整军，50% 解锁担保）`}>
      <svg viewBox="0 0 56 34" width="52" height="32" aria-hidden="true">
        <path
          d="M 6 30 A 22 22 0 0 1 50 30"
          fill="none"
          stroke="#3E3730"
          stroke-width="4.5"
          stroke-linecap="round"
        />
        <path
          d="M 6 30 A 22 22 0 0 1 50 30"
          fill="none"
          stroke={accent}
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-dasharray={`${(pct / 100) * 69.1} 70`}
        />
        <g transform={`translate(28,30) rotate(${angleDeg})`}>
          <line x1="0" y1="0" x2="0" y2="-18" stroke="#F4EFE6" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="0" cy="0" r="2.8" fill="#C5A059" />
        </g>
      </svg>
      <div class="crisis-meta">
        <span class="crisis-label">危机度</span>
        <span class="crisis-val mono-num" style={`color:${accent}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

export function TopRightClockBar({ actions }: Props) {
  const tick = simTickSig.value;
  const speed = simSpeedSig.value;
  const paused = simPausedSig.value;
  const crisis = simCrisisSig.value;
  const dateParts = tickToDate(tick);
  const season = getTheaterSeasonSummary(tick);
  const seasonShort =
    season.eastCondition === 'winter'
      ? '东欧 · 严冬'
      : season.eastCondition === 'mud'
        ? '东欧 · 泥泞'
        : '气候正常';
  const seasonCls =
    season.eastCondition === 'winter'
      ? 'is-winter'
      : season.eastCondition === 'mud'
        ? 'is-mud'
        : '';

  return (
    <section class={`hud-top-right${paused ? ' is-paused' : ''}`} aria-label="参谋怀表与危机表盘">
      <div class="clock-block">
        <div class="clock-date-row">
          <span class="clock-date mono-num">{formatDateZh(tick)}</span>
          <span class="clock-slot">
            {dateParts.slotZh} <span class="mono-num">{formatClockTime(tick)}</span>
          </span>
          <span
            class={`clock-season-tag ${seasonCls}${season.isNight ? ' is-night' : ''}`}
            title={`${season.activeDetailZh}（下次变化：${season.nextChangeDateIso} ${season.nextChangeLabelZh}）`}
          >
            {seasonShort}
          </span>
          {paused && <span class="clock-paused-tag">已暂停</span>}
        </div>

        <div class="clock-controls">
          <button
            type="button"
            class={`speed-btn pause-btn${paused ? ' active-pause' : ''}`}
            onClick={() => actions.togglePause()}
            title="暂停 / 恢复 (Space)"
          >
            {paused ? '▶ 继续' : '❚❚ 暂停'}
          </button>

          <div class="speed-levers" role="group" aria-label="时间倍速">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                class={`speed-btn mono-num${!paused && speed === s ? ' active' : ''}`}
                onClick={() => actions.setSpeed(s)}
                title={`${s}× 速度 (快捷键 ${s})`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="hud-sep" />

      <CrisisDial permille={crisis} />

      <div class="hud-sep" />

      <div class="clock-utils">
        <button
          type="button"
          class="staff-btn util-mini-btn"
          onClick={actions.openCountrySelect}
          title="返回 1936 选国档案袋"
        >
          选国
        </button>
        <button
          type="button"
          class="staff-btn util-mini-btn"
          onClick={() => {
            showCreditsSig.value = true;
          }}
          title="关于与开源致谢"
        >
          致谢
        </button>
      </div>
    </section>
  );
}
