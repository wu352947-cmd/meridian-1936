/**
 * Bottom-left Army Cards Bar (sits cleanly above OrderModeCapsule without blocking BottomCommandDock).
 * Shows army color tag, name, brigade count, commander monogram badge & trait. Click selects army & highlights frontline.
 */
import { MAX_ARMY_BRIGADES } from '../../sim/data/brigadeTemplates';
import { getCommanderDef } from '../../sim/data/commanders1936';
import {
  selectedArmyIdSig,
  simArmySig,
  simPlayerTagSig,
  type AppActions,
} from '../store/simStore';

interface Props {
  actions: AppActions;
}

export function ArmyCardsBar({ actions }: Props) {
  const armySnap = simArmySig.value;
  const tag = simPlayerTagSig.value;
  const selArmyId = selectedArmyIdSig.value;
  if (!armySnap) return null;

  const ownArmies = armySnap.armies.filter((a) => a.owner === tag);
  if (ownArmies.length === 0) return null;

  return (
    <div class="army-cards-bar" role="region" aria-label="集团军快捷卡片">
      {ownArmies.map((a) => {
        const isSel = selArmyId === a.id;
        const cmd = getCommanderDef(a.commanderId);
        const leadTrait = cmd?.traits[0];
        return (
          <div
            key={a.id}
            class={`army-mini-card${isSel ? ' is-selected' : ''}`}
            onClick={() => actions.selectBrigades(a.brigadeIds, a.id)}
            title={`点击选中${a.nameZh}并高亮战线`}
          >
            <span class="army-card-ribbon" style={`background:${a.color}`} />
            <div class="army-cmd-seal" aria-hidden="true">
              <span class="army-cmd-mono mono-num">{cmd ? cmd.monogram : '参'}</span>
            </div>
            <div class="army-mini-body">
              <div class="army-mini-top">
                <span class="army-mini-name">{a.nameZh}</span>
                <span class="army-mini-cnt mono-num">
                  {a.brigadeIds.length}/{MAX_ARMY_BRIGADES}旅
                </span>
              </div>
              <div class="army-mini-sub">
                <span class="army-mini-cmd">{cmd ? cmd.nameZh : '未委任将领'}</span>
                {leadTrait && <span class="army-mini-trait">{leadTrait.nameZh}</span>}
              </div>
            </div>
            {a.arrow && (
              <button
                type="button"
                class={`army-arrow-play${a.arrow.active ? ' is-running' : ''}`}
                title={a.arrow.active ? '暂停进攻计划' : '执行进攻计划'}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.toggleArrowActive(a.id);
                }}
              >
                {a.arrow.active ? '❚❚' : '▶'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
