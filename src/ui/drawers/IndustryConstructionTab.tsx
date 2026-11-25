import { formatFixedNum } from '../../sim/core/FixedMath';
import { getRegionDef, getRegionDefByProvince } from '../../sim/data/regions1936';
import {
  BUILDING_SPECS,
  INFRA_MULT_PERMILLE,
  MAX_CIV_PER_PROJECT,
  type BuildingType,
  type IndustrySnapshot,
} from '../../sim/systems/industryTypes';
import { selectedProvSig } from '../mapStore';
import type { AppActions } from '../store/simStore';

interface Props {
  ind: IndustrySnapshot;
  actions: AppActions;
}

const BUILD_BUTTONS: readonly BuildingType[] = ['CIV', 'MIL', 'DOC', 'INFRA', 'SYNTH'];

export function IndustryConstructionTab({ ind, actions }: Props) {
  const selProv = selectedProvSig.value;
  const selRegionId = selProv && !selProv.isSea ? (getRegionDefByProvince(selProv.id)?.id ?? null) : null;

  const ownRegions = ind.regions
    .filter((r) => r.owner === ind.tag)
    .sort((a, b) => {
      if (a.id === selRegionId) return -1;
      if (b.id === selRegionId) return 1;
      return (b.infra - a.infra) || (b.slots - (b.civ + b.mil + b.doc + b.synth)) - (a.slots - (a.civ + a.mil + a.doc + a.synth));
    });

  return (
    <>
      <div class="drawer-section">
        <h3>工程建设队列（{ind.queue.length} 项 · 投入 {ind.civBuild} 民工）</h3>
        {ind.queue.length === 0 ? (
          <div class="ind-pool-row">
            <span>当前无施工项。可在下方行政区或地图选省排入建设。</span>
          </div>
        ) : (
          <div style="display:flex;flex-direction:column;gap:6px;">
            {ind.queue.map((p, idx) => {
              const spec = BUILDING_SPECS[p.building];
              const pct = Math.min(100, Math.floor((p.progressFixed * 100) / Math.max(1, p.costFixed)));
              return (
                <div class="build-proj-card" key={p.id}>
                  <div class="build-proj-top">
                    <button
                      type="button"
                      class="region-name-btn"
                      onClick={() => actions.focusRegion(p.regionId)}
                      title="聚焦该工业区"
                    >
                      {p.regionNameZh} · {spec.nameZh}
                    </button>
                    <div class="build-proj-actions">
                      {idx > 0 && (
                        <button
                          type="button"
                          class="prod-step-btn"
                          onClick={() => actions.reorderConstruction(p.id, 'top')}
                          title="置顶优先施工"
                        >
                          顶
                        </button>
                      )}
                      <button
                        type="button"
                        class="prod-step-btn"
                        onClick={() => actions.cancelConstruction(p.id)}
                        title="取消工程"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div class="build-bar-bg">
                    <div class="build-bar-fill" style={`width:${pct}%`} />
                  </div>
                  <div class="ind-civ-bar mono-num">
                    <span>
                      民工 {p.assignedCiv}/{MAX_CIV_PER_PROJECT} · +{formatFixedNum(p.dailyCpFixed, 1)} CP/日
                    </span>
                    <span>
                      {pct}% · {p.etaDays > 0 ? `约 ${p.etaDays} 天` : '待工'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class="drawer-section">
        <h3>本土行政工业区（点击排入队列）</h3>
        <div style="display:flex;flex-direction:column;gap:6px;">
          {ownRegions.map((r) => {
            const def = getRegionDef(r.id);
            const usedSlots = r.civ + r.mil + r.doc + r.synth;
            const queuedSlots = ind.queue.filter(
              (q) => q.regionId === r.id && BUILDING_SPECS[q.building].usesSlot,
            ).length;
            const queuedInfra = ind.queue.filter(
              (q) => q.regionId === r.id && q.building === 'INFRA',
            ).length;
            const freeSlots = Math.max(0, r.slots - usedSlots - queuedSlots);
            const infraMult = ((INFRA_MULT_PERMILLE[r.infra] ?? 1000) / 1000).toFixed(2);
            const isSel = r.id === selRegionId;

            return (
              <div class={`region-row${isSel ? ' is-selected' : ''}`} key={r.id}>
                <div class="region-row-head">
                  <button
                    type="button"
                    class="region-name-btn"
                    onClick={() => actions.focusRegion(r.id)}
                  >
                    {isSel ? '◈ ' : ''}
                    {def?.nameZh ?? `#${r.id}`}
                    {def?.isCoastal ? ' · 港' : ''}
                  </button>
                  <span class="mono-num" style="font-size:10.5px;color:#C6BCAD;">
                    基建 Lv.{r.infra} (×{infraMult}) · 槽 {usedSlots + queuedSlots}/{r.slots}
                  </span>
                </div>
                <div class="ind-civ-bar mono-num">
                  <span>
                    民{r.civ} 军{r.mil} 船{r.doc}
                    {r.synth > 0 ? ` 炼${r.synth}` : ''}
                  </span>
                  <span>
                    钢{r.steel} 油{r.oil} 稀{r.rare}
                  </span>
                </div>
                <div class="region-build-btns">
                  {BUILD_BUTTONS.map((b) => {
                    const spec = BUILDING_SPECS[b];
                    const disabled =
                      (spec.requiresCoastal && !def?.isCoastal) ||
                      (b === 'INFRA' ? r.infra + queuedInfra >= 5 : freeSlots <= 0);
                    return (
                      <button
                        key={b}
                        type="button"
                        class="build-mini-btn"
                        disabled={disabled}
                        onClick={() => actions.queueConstruction(r.id, b)}
                        title={`${spec.nameZh}（造价 ${spec.costFixed / 1000} CP${b === 'SYNTH' ? '，建成 +6 原油' : ''}）`}
                      >
                        +{spec.shortZh}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
