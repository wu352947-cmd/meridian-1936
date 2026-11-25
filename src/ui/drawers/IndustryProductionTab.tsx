import { formatFixedNum, formatPermillePct } from '../../sim/core/FixedMath';
import {
  EQUIPMENT_LIST,
  EQUIPMENT_SPECS,
  type EquipmentType,
  type IndustrySnapshot,
} from '../../sim/systems/industryTypes';
import type { AppActions } from '../store/simStore';

interface Props {
  ind: IndustrySnapshot;
  actions: AppActions;
}

const MIL_TYPES: readonly EquipmentType[] = EQUIPMENT_LIST.filter(
  (k) => EQUIPMENT_SPECS[k].factoryKind === 'MIL',
);

function fmtResNeeds(steel: number, oil: number, rare: number): string {
  const parts: string[] = [];
  if (steel > 0) parts.push(`钢${steel}`);
  if (oil > 0) parts.push(`油${oil}`);
  if (rare > 0) parts.push(`稀${rare}`);
  return parts.length > 0 ? parts.join(' ') : '无耗料';
}

export function IndustryProductionTab({ ind, actions }: Props) {
  const milFree = Math.max(0, ind.milTotal - ind.milAssigned);
  const docFree = Math.max(0, ind.docTotal - ind.docAssigned);

  return (
    <>
      <div class="ind-pool-row">
        <span>
          军工分配 <strong class="mono-num">{ind.milAssigned}/{ind.milTotal}</strong>
          {milFree > 0 && <em class="val-warn">（闲置 {milFree}）</em>}
        </span>
        <span>
          船坞 <strong class="mono-num">{ind.docAssigned}/{ind.docTotal}</strong>
          {docFree > 0 && <em class="val-warn">（闲 {docFree}）</em>}
        </span>
      </div>

      {ind.lines.map((line) => {
        const spec = EQUIPMENT_SPECS[line.type];
        const isDoc = spec.factoryKind === 'DOC';
        const poolFree = isDoc ? docFree : milFree;
        const maxForLine = line.factories + poolFree;
        const penaltyPct = Math.round((1000 - line.resourceMultPermille) / 10);
        const masteryPct = Math.round(line.masteryPermille / 10);
        const capPct = Math.round(line.masteryMaxPermille / 10);
        const stockInt = Math.floor(line.stockpileFixed / 1000);
        const dailyStr = formatFixedNum(line.dailyUnitsFixed, line.dailyUnitsFixed >= 10000 ? 1 : 2);

        const setDelta = (delta: number) => {
          const next = Math.max(0, Math.min(maxForLine, line.factories + delta));
          if (next !== line.factories) actions.setLineFactories(line.type, next);
        };

        return (
          <div
            key={line.type}
            class={`prod-card${isDoc ? ' is-dock' : ''}${penaltyPct > 0 && line.factories > 0 ? ' has-penalty' : ''}`}
          >
            <div class="prod-head">
              <span class="prod-name">
                <span class={`prod-kind-tag${isDoc ? ' doc' : ''}`}>{isDoc ? '船坞' : '军工'}</span>
                {spec.nameZh}
              </span>
              <div style="display:inline-flex;align-items:center;gap:5px;">
                {penaltyPct > 0 && line.factories > 0 ? (
                  <span class="prod-penalty-badge mono-num" title="资源缺口每 10% 扣效率 8%，最差 -80%">
                    缺料 -{penaltyPct}%
                  </span>
                ) : (
                  <span class="mono-num" style="font-size:10px;color:#9A9082;">
                    {fmtResNeeds(line.needSteel, line.needOil, line.needRare)}
                  </span>
                )}
                {!isDoc && line.factories > 0 && (
                  <select
                    class="prod-switch-select"
                    value=""
                    aria-label={`${spec.nameZh} 改产线`}
                    title="将本产线全部车间改产至其他装备（目标线熟练度重置为 30%）"
                    onChange={(e) => {
                      const target = (e.currentTarget as HTMLSelectElement).value as EquipmentType;
                      if (target) {
                        actions.switchProductionLine(line.type, target);
                        (e.currentTarget as HTMLSelectElement).value = '';
                      }
                    }}
                  >
                    <option value="">转产</option>
                    {MIL_TYPES.filter((t) => t !== line.type).map((t) => (
                      <option key={t} value={t}>
                        →{EQUIPMENT_SPECS[t].shortZh}(熟30%)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div class="prod-ctrl-row">
              <button
                type="button"
                class="prod-step-btn mono-num"
                disabled={line.factories <= 0}
                onClick={() => setDelta(-5)}
                title="减少 5 座"
              >
                -5
              </button>
              <button
                type="button"
                class="prod-step-btn mono-num"
                disabled={line.factories <= 0}
                onClick={() => setDelta(-1)}
                title="减少 1 座"
              >
                -1
              </button>
              <input
                type="range"
                class="prod-slider"
                min={0}
                max={Math.max(1, maxForLine)}
                value={line.factories}
                disabled={maxForLine === 0}
                aria-label={`${spec.nameZh} 工厂分配`}
                onInput={(e) => {
                  const v = Number((e.currentTarget as HTMLInputElement).value);
                  actions.setLineFactories(line.type, v);
                }}
              />
              <button
                type="button"
                class="prod-step-btn mono-num"
                disabled={poolFree <= 0}
                onClick={() => setDelta(1)}
                title="增加 1 座"
              >
                +1
              </button>
              <button
                type="button"
                class="prod-step-btn mono-num"
                disabled={poolFree <= 0}
                onClick={() => setDelta(5)}
                title="增加 5 座"
              >
                +5
              </button>
              <span class="prod-fac-count mono-num">{line.factories}厂</span>
            </div>

            <div class="prod-meta-row">
              <div class="mastery-track" title={`产线熟练度 ${formatPermillePct(line.masteryPermille, 1)} / 上限 ${capPct}%`}>
                <div class="mastery-fill" style={`width:${masteryPct}%`} />
                <div class="mastery-cap-line" style={`left:${capPct}%`} />
                <span class="mastery-label mono-num">
                  熟练 {masteryPct}% / {capPct}%
                </span>
              </div>
              <span class="mono-num" style="color:#8DC493;white-space:nowrap;">
                +{dailyStr}/日
              </span>
              <span class="mono-num" style="color:#E8DCC8;white-space:nowrap;">
                库 {stockInt.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
