import { getFlagDataUri } from '../assets/flags/neutralFlags';
import { getCountryInfo, TERRAIN_INFO } from '../data/countries1936';
import type { ProvinceRecord } from '../types/map';

interface Props {
  hovered: ProvinceRecord | null;
  selected: ProvinceRecord | null;
  onClearSelected: () => void;
}

export function ProvinceInfoCard({ hovered, selected, onClearSelected }: Props) {
  const prov = hovered ?? selected;
  if (!prov) return null;

  const isSelectedShown = selected !== null && prov.id === selected.id;
  const country = getCountryInfo(prov.owner);
  const terrain = TERRAIN_INFO[prov.terrain];

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
              <span class="prov-k">工业度</span>
              <span class="prov-v mono-num">{prov.industry}</span>
            </div>
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
    </aside>
  );
}
