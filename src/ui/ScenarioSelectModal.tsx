import { useState } from 'preact/hooks';
import { getFlagDataUri } from '../assets/flags/neutralFlags';
import { getCountryInfo } from '../data/countries1936';
import {
  ALL_PLAYABLE_NATIONS_1936,
  FEATURED_NATIONS_1936,
  getNationStartProfile,
  REGIME_META,
} from '../sim/data/nations1936';
import { showCreditsSig } from './mapStore';
import { DossierCountryCard } from './modals/DossierCountryCard';
import { selectedCountrySig, type AppActions } from './store/simStore';

interface Props {
  actions: AppActions;
}

export function ScenarioSelectModal({ actions }: Props) {
  const [showAllRoster, setShowAllRoster] = useState(false);
  const activeTag = selectedCountrySig.value;
  const profile = getNationStartProfile(activeTag) ?? FEATURED_NATIONS_1936[0]!;

  const handlePick = (tag: string, pan = false) => {
    actions.previewCountry(tag, pan);
    setShowAllRoster(false);
  };

  return (
    <div class="dossier-screen" aria-label="1936 选国界面">
      <header class="dossier-topbar">
        <div class="dossier-brand">
          <h1>子午线 1936：碎裂大陆</h1>
          <div class="dossier-sub">
            剧本：<span class="mono-num">1936-01-01</span> 暗流涌动 · 欧洲参谋部国情档案袋
          </div>
        </div>
        <div class="cartouche-divider" />
        <div class="dossier-hint">点击地图或下方卡片任选 31 国</div>
        <button
          type="button"
          class="staff-btn"
          onClick={() => {
            showCreditsSig.value = true;
          }}
        >
          关于 / 致谢
        </button>
      </header>

      <DossierCountryCard profile={profile} onStart={actions.startCampaign} />

      {showAllRoster && (
        <section class="dossier-roster-pop" aria-label="全部 1936 欧洲可选国家名录">
          <div class="roster-head">
            <span>1936 欧洲全部可选主权国家（{ALL_PLAYABLE_NATIONS_1936.length} 国）</span>
            <button
              type="button"
              class="staff-btn"
              style="padding:2px 8px;font-size:11px;"
              onClick={() => setShowAllRoster(false)}
            >
              收起
            </button>
          </div>
          <div class="roster-grid">
            {ALL_PLAYABLE_NATIONS_1936.map((n) => {
              const c = getCountryInfo(n.tag);
              const isAct = n.tag === profile.tag;
              return (
                <button
                  key={n.tag}
                  type="button"
                  class={`roster-chip${isAct ? ' active' : ''}`}
                  onClick={() => handlePick(n.tag, true)}
                >
                  <img src={getFlagDataUri(n.tag)} alt={c.shortZh} width={22} height={15} />
                  <span>{c.shortZh}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <nav class="dossier-featured-tray" aria-label="8 大推荐开局国家">
        <div class="featured-label">推荐大国</div>
        <div class="featured-cards">
          {FEATURED_NATIONS_1936.map((n) => {
            const c = getCountryInfo(n.tag);
            const isAct = n.tag === profile.tag;
            return (
              <button
                key={n.tag}
                type="button"
                class={`featured-card${isAct ? ' active' : ''}`}
                onClick={() => handlePick(n.tag, false)}
                title={`${c.nameZh} · ${REGIME_META[n.regime].nameZh}`}
              >
                <img
                  class="featured-flag"
                  src={getFlagDataUri(n.tag)}
                  alt={c.shortZh}
                  width={36}
                  height={24}
                />
                <span class="featured-name">{c.shortZh}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          class={`staff-btn roster-toggle-btn${showAllRoster ? ' active' : ''}`}
          onClick={() => setShowAllRoster((v) => !v)}
        >
          全部 {ALL_PLAYABLE_NATIONS_1936.length} 国 ▴
        </button>
      </nav>
    </div>
  );
}
