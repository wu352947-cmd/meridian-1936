/**
 * F6 Army & Frontline Dossier Drawer (<=380px right context drawer).
 */
import { useState } from 'preact/hooks';
import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getCountryInfo } from '../../data/countries1936';
import { simArmySig, simPlayerTagSig, type AppActions } from '../store/simStore';
import { ArmyForcesTab } from './ArmyForcesTab';
import { ArmyTrainingTab } from './ArmyTrainingTab';

interface Props {
  actions: AppActions;
}

type ArmySubTab = 'training' | 'forces';

export function ArmyDrawer({ actions }: Props) {
  const [subtab, setSubtab] = useState<ArmySubTab>('training');
  const tag = simPlayerTagSig.value;
  const info = getCountryInfo(tag);
  const armySnap = simArmySig.value;

  if (!armySnap || armySnap.playerTag !== tag) {
    return <div class="drawer-body">正在同步集团军与兵力编成…</div>;
  }

  const ownBrigades = armySnap.brigades.filter((b) => b.owner === tag);
  const ownArmies = armySnap.armies.filter((a) => a.owner === tag);
  const deployedWan = (armySnap.deployedManpower / 10_000).toFixed(1);

  return (
    <div class="army-drawer-wrap">
      <div class="army-banner">
        <img class="gov-flag" src={getFlagDataUri(tag)} alt={info.nameZh} width={38} height={25} />
        <div class="army-banner-meta">
          <div class="army-banner-top">
            <span class="gov-country-title">{info.nameZh} · 陆军总参</span>
            <span class="army-total-pill mono-num">
              {ownBrigades.length} 旅 · {deployedWan}万
            </span>
          </div>
          <div class="gov-banner-sub mono-num">
            {ownArmies.length} 个集团军 · 训练队列 {armySnap.trainingQueue.length} 旅 · 右键行军/绑战线
          </div>
        </div>
      </div>

      <div class="army-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subtab === 'training'}
          class={`army-subtab${subtab === 'training' ? ' active' : ''}`}
          onClick={() => setSubtab('training')}
        >
          作战旅模板与训练 ({armySnap.trainingQueue.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subtab === 'forces'}
          class={`army-subtab${subtab === 'forces' ? ' active' : ''}`}
          onClick={() => setSubtab('forces')}
        >
          集团军与战线 ({ownArmies.length})
        </button>
      </div>

      {subtab === 'training' ? (
        <ArmyTrainingTab tag={tag} armySnap={armySnap} actions={actions} />
      ) : (
        <ArmyForcesTab tag={tag} armySnap={armySnap} actions={actions} />
      )}
    </div>
  );
}
