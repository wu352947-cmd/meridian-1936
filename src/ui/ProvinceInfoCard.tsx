import { getFlagDataUri } from '../assets/flags/neutralFlags';
import { getCountryInfo, TERRAIN_INFO } from '../data/countries1936';
import { getRegionDefByProvince } from '../sim/data/regions1936';
import { getPortLevel } from '../sim/data/supplySources1936';
import { BUILDING_SPECS, INFRA_MULT_PERMILLE, type BuildingType } from '../sim/systems/industryTypes';
import { calcSupplyCap } from '../sim/systems/supplyTypes';
import type { ProvinceRecord } from '../types/map';
import { simIndustrySig, simPlayerTagSig, simSupplyByProvSig, type AppActions } from './store/simStore';

interface Props {
  hovered: ProvinceRecord | null;
  selected: ProvinceRecord | null;
  onClearSelected: () => void;
  actions?: AppActions;
}

const QUICK_BUILD: readonly BuildingType[] = ['CIV', 'MIL', 'DOC', 'INFRA', 'SYNTH'];

export function ProvinceInfoCard({ hovered, selected, onClearSelected, actions }: Props) {
  const prov = hovered ?? selected;
  if (!prov) return null;

  const isSelectedShown = selected !== null && prov.id === selected.id;
  const country = getCountryInfo(prov.owner);
  const terrain = TERRAIN_INFO[prov.terrain];
  const regDef = !prov.isSea ? getRegionDefByProvince(prov.id) : null;
  const ind = simIndustrySig.value;
  const regDyn = regDef && ind ? (ind.regions.find((r) => r.id === regDef.id) ?? null) : null;
  const isOwnSelected = isSelectedShown && !prov.isSea && prov.owner === simPlayerTagSig.value && Boolean(regDef);

  const usedSlots = regDyn ? regDyn.civ + regDyn.mil + regDyn.doc + regDyn.synth : regDef ? regDef.civ + regDef.mil + regDef.doc : 0;
  const queuedSlots = regDef && ind
    ? ind.queue.filter((q) => q.regionId === regDef.id && BUILDING_SPECS[q.building].usesSlot).length
    : 0;
  const queuedInfra = regDef && ind
    ? ind.queue.filter((q) => q.regionId === regDef.id && q.building === 'INFRA').length
    : 0;
  const totalSlots = regDyn?.slots ?? regDef?.slots ?? 4;
  const infraLvl = regDyn?.infra ?? regDef?.infra ?? 2;
  const infraMult = ((INFRA_MULT_PERMILLE[infraLvl] ?? 1000) / 1000).toFixed(2);
  const supplyArr = simSupplyByProvSig.value;
  const provSupply = !prov.isSea && supplyArr && prov.id < supplyArr.length ? supplyArr[prov.id]! : null;
  const portLvl = !prov.isSea ? getPortLevel(prov.id) : 0;

  return (
    <aside class="prov-card" aria-label="省份情报卡">
      <div class="prov-card-head">
        {!prov.isSea && (
          <img
            class="prov-flag"
            src={getFlagDataUri(prov.owner)}
            alt={country.nameZh}
            width={36}
            height={24}
          />
        )}
        <div class="prov-title-wrap">
          <div class="prov-name-row">
            <span class="prov-name-zh">
              {prov.isCapital ? '★ ' : ''}
              {prov.nameZh}
            </span>
            <span class="prov-name-en">{prov.nameEn}</span>
          </div>
          <div class="prov-owner-row">
            {prov.isSea ? '欧洲海域分区' : `${country.nameZh} · ${country.ideologyZh}`}
          </div>
        </div>
        {isSelectedShown && (
          <button
            type="button"
            class="staff-btn"
            style="padding:2px 7px;font-size:11px;"
            onClick={onClearSelected}
            title="取消选中"
          >
            ×
          </button>
        )}
      </div>

      <div class="prov-card-grid">
        <div class="prov-kv">
          <span class="prov-k">地形</span>
          <span class="prov-v">
            <span class="terrain-dot" style={`background:${terrain.color}`} />
            {terrain.nameZh}
          </span>
        </div>
        <div class="prov-kv">
          <span class="prov-k">属性</span>
          <span class="prov-v">
            {prov.isSea ? '海域' : prov.isCoastal ? '沿海省' : '内陆省'}
          </span>
        </div>
        {!prov.isSea ? (
          <>
            <div class="prov-kv">
              <span class="prov-k">胜利点</span>
              <span class="prov-v mono-num">{prov.vp}</span>
            </div>
            <div class="prov-kv">
              <span class="prov-k">补给 / 供养</span>
              <span class="prov-v mono-num">
                {provSupply !== null ? `S=${provSupply} · 上限${calcSupplyCap(provSupply)}旅` : `${prov.industry}`}
              </span>
            </div>
            {portLvl > 0 && (
              <div class="prov-kv" style="grid-column: 1 / -1;">
                <span class="prov-k">海港补给源</span>
                <span class="prov-v mono-num">Lv.{portLvl} 港口（S={Math.min(100, 35 + 13 * portLvl)}）</span>
              </div>
            )}
          </>
        ) : (
          <div class="prov-kv" style="grid-column: 1 / -1;">
            <span class="prov-k">相邻海陆单元</span>
            <span class="prov-v mono-num">{prov.neighbors.length}</span>
          </div>
        )}
      </div>

      <div class="prov-desc">
        {terrain.descZh}
        {isSelectedShown && !prov.isSea && (
          <span class="prov-badge-sel" style="margin-left:8px;">
            已选中 · {country.shortZh}
          </span>
        )}
      </div>

      {regDef && (
        <div class="prov-region-box">
          <div class="prov-region-head">
            <span>行政工业区 · {regDef.nameZh}</span>
            <span class="mono-num">
              基建 Lv.{infraLvl} (×{infraMult})
            </span>
          </div>
          <div class="prov-region-stats mono-num">
            <span>
              民{regDyn?.civ ?? regDef.civ} / 军{regDyn?.mil ?? regDef.mil} / 船{regDyn?.doc ?? regDef.doc}
            </span>
            <span>
              槽 {usedSlots + queuedSlots}/{totalSlots}
            </span>
            <span>
              钢{regDyn?.steel ?? regDef.steel} 油{regDyn?.oil ?? regDef.oil} 稀{regDyn?.rare ?? regDef.rare}
            </span>
          </div>
          {isOwnSelected && actions && (
            <div class="region-build-btns">
              {QUICK_BUILD.map((b) => {
                const sp = BUILDING_SPECS[b];
                const disabled =
                  (sp.requiresCoastal && !regDef.isCoastal) ||
                  (b === 'INFRA' ? infraLvl + queuedInfra >= 5 : usedSlots + queuedSlots >= totalSlots);
                return (
                  <button
                    key={b}
                    type="button"
                    class="build-mini-btn"
                    disabled={disabled}
                    onClick={() => actions.queueConstruction(regDef.id, b)}
                    title={`在${regDef.nameZh}排入${sp.nameZh}（${sp.costFixed / 1000} CP）`}
                  >
                    +{sp.shortZh}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
