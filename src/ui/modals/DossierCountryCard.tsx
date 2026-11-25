import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getLandmarkDataUri } from '../../assets/landmarks/capitalLandmarks';
import { getCountryInfo } from '../../data/countries1936';
import { REGIME_META, type NationStartProfile } from '../../sim/data/nations1936';
import { historicalAiSig, simSeedSig } from '../store/simStore';

interface Props {
  profile: NationStartProfile;
  onStart: (tag: string) => void;
}

const RATING_ROWS: ReadonlyArray<{ key: keyof NationStartProfile['ratings']; label: string }> = [
  { key: 'industry', label: '工业产能' },
  { key: 'manpower', label: '适役人力' },
  { key: 'army', label: '陆军力量' },
  { key: 'navy', label: '海军投射' },
  { key: 'air', label: '空军规模' },
];

function fmtRes(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function DossierCountryCard({ profile, onStart }: Props) {
  const info = getCountryInfo(profile.tag);
  const regime = REGIME_META[profile.regime];
  const histAi = historicalAiSig.value;
  const seed = simSeedSig.value;

  return (
    <aside class="dossier-folder" aria-label="1936 欧洲参谋部国情档案袋">
      <div class="dossier-spine">
        <span class="dossier-code mono-num">DOSSIER // 1936-EU-{profile.tag}</span>
        <span class="dossier-stamp">绝密参谋卷宗</span>
      </div>

      <div class="dossier-paper">
        <div class="dossier-id-row">
          <img
            class="dossier-flag"
            src={getFlagDataUri(profile.tag)}
            alt={info.nameZh}
            width={60}
            height={40}
          />
          <div class="dossier-id-meta">
            <h2 class="dossier-country-zh">{info.nameZh}</h2>
            <div class="dossier-country-en">
              {info.nameEn} · 首都 {info.capitalZh}
            </div>
            <div class="dossier-badges">
              <span class="dossier-seal" style={`border-color:${regime.sealColor};color:${regime.sealColor}`}>
                {regime.nameZh}
              </span>
              <span class="dossier-faction">{profile.factionLabelZh}</span>
            </div>
          </div>
        </div>

        <div class="dossier-landmark-box">
          <img
            class="dossier-landmark-svg"
            src={getLandmarkDataUri(profile.landmarkId)}
            alt={`${info.capitalZh}地标版画`}
          />
          <span class="dossier-landmark-cap">
            {info.capitalZh}总参谋部档案印记
          </span>
        </div>

        <div class="dossier-section-title">五维综合国力评估（1936.01）</div>
        <div class="dossier-bars">
          {RATING_ROWS.map((row) => {
            const val = profile.ratings[row.key];
            return (
              <div class="dossier-bar-row" key={row.key}>
                <span class="dossier-bar-label">{row.label}</span>
                <div class="dossier-bar-track">
                  <div class="dossier-bar-fill" style={`width:${val}%`} />
                </div>
                <span class="dossier-bar-val mono-num">{val}</span>
              </div>
            );
          })}
        </div>

        <div class="dossier-metrics-grid">
          <div class="dossier-metric">
            <span class="dm-k">工坊 民/军/船</span>
            <span class="dm-v mono-num">
              {profile.civ}/{profile.mil}/{profile.doc}
            </span>
          </div>
          <div class="dossier-metric">
            <span class="dm-k">可用人力</span>
            <span class="dm-v mono-num">{(profile.manpowerK / 10).toFixed(1)}万</span>
          </div>
          <div class="dossier-metric">
            <span class="dm-k">钢 / 油 / 稀</span>
            <span class="dm-v mono-num">
              <span class={profile.steel < 0 ? 'num-neg' : ''}>{fmtRes(profile.steel)}</span>/
              <span class={profile.oil < 0 ? 'num-neg' : ''}>{fmtRes(profile.oil)}</span>/
              <span class={profile.rare < 0 ? 'num-neg' : ''}>{fmtRes(profile.rare)}</span>
            </span>
          </div>
          <div class="dossier-metric">
            <span class="dm-k">在编旅 / 科研槽</span>
            <span class="dm-v mono-num">
              {profile.brigades}旅 · {profile.researchSlots}槽
            </span>
          </div>
        </div>

        <p class="dossier-brief">{profile.briefZh}</p>

        <div class="dossier-forces-strip">
          <div class="df-cell">
            <span class="df-k">在编陆军</span>
            <span class="df-v mono-num">{profile.brigades} 旅</span>
          </div>
          <div class="df-cell">
            <span class="df-k">舰队编成</span>
            <span class="df-v mono-num">{profile.ships} 舰</span>
          </div>
          <div class="df-cell">
            <span class="df-k">空军联队</span>
            <span class="df-v mono-num">{profile.airWings} 队</span>
          </div>
        </div>

        <div class="dossier-regime-box">
          <span class="dossier-regime-k">政体特性</span>
          <span class="dossier-regime-note">{regime.noteZh}</span>
        </div>

        <div class="dossier-seal-footer">
          <span class="mono-num">MERIDIAN STAFF ARCHIVE</span>
          <span>1936 · 欧洲战区</span>
        </div>
      </div>

      <div class="dossier-footer">
        <div class="dossier-opts">
          <label class="dossier-check">
            <input
              type="checkbox"
              checked={histAi}
              onChange={(e) => {
                historicalAiSig.value = (e.target as HTMLInputElement).checked;
              }}
            />
            <span>史实 AI 方略</span>
          </label>
          <span class="dossier-seed mono-num">SEED #{seed}</span>
        </div>
        <button
          type="button"
          class="dossier-start-btn"
          onClick={() => onStart(profile.tag)}
        >
          签署任命 · 执掌{info.shortZh}
        </button>
      </div>
    </aside>
  );
}
