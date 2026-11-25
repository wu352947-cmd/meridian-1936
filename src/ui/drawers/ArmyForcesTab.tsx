/**
 * F6 Army Drawer — Active Armies (max 16 brigades), Frontline/Arrow Status & Manual Override Tab.
 */
import { getCountryInfo } from '../../data/countries1936';
import { MAX_ARMY_BRIGADES } from '../../sim/data/brigadeTemplates';
import { getSimProvince } from '../../sim/data/provinces1936';
import type { ArmySystemSnapshot } from '../../sim/systems/armyTypes';
import {
  orderToolModeSig,
  selectedArmyIdSig,
  selectedBrigadeIdsSig,
  type AppActions,
} from '../store/simStore';
import { ArmyTemplateIcon } from './ArmyTemplateIcon';

interface Props {
  tag: string;
  armySnap: ArmySystemSnapshot;
  actions: AppActions;
}

export function ArmyForcesTab({ tag, armySnap, actions }: Props) {
  const ownArmies = armySnap.armies.filter((a) => a.owner === tag);
  const ownBrigades = armySnap.brigades.filter((b) => b.owner === tag);
  const selectedArmyId = selectedArmyIdSig.value ?? ownArmies[0]?.id ?? null;
  const selectedIds = new Set(selectedBrigadeIdsSig.value);
  const toolMode = orderToolModeSig.value;
  const activeArmy = ownArmies.find((a) => a.id === selectedArmyId) ?? ownArmies[0] ?? null;

  const rosterBrigades = activeArmy
    ? ownBrigades.filter((b) => b.armyId === activeArmy.id)
    : ownBrigades;
  const unassigned = ownBrigades.filter((b) => b.armyId === null);

  return (
    <div class="army-tab-body">
      <section class="army-card">
        <div class="army-card-head">
          <h3>在编集团军 ({ownArmies.length})</h3>
          <button
            type="button"
            class="staff-btn army-mini-btn"
            onClick={() => actions.createArmy()}
          >
            +新建集团军
          </button>
        </div>

        <div class="army-list">
          {ownArmies.map((a) => {
            const isSel = activeArmy?.id === a.id;
            const targetInfo = a.frontline ? getCountryInfo(a.frontline.targetTag) : null;
            const arrowTarget = a.arrow ? getSimProvince(a.arrow.targetProvId) : null;
            return (
              <div
                key={a.id}
                class={`army-item${isSel ? ' is-selected' : ''}`}
                onClick={() => actions.selectBrigades(a.brigadeIds, a.id)}
              >
                <div class="army-item-top">
                  <span class="army-color-dot" style={`background:${a.color}`} />
                  <span class="army-item-name">{a.nameZh}</span>
                  <span class="army-cap-pill mono-num">
                    {a.brigadeIds.length}/{MAX_ARMY_BRIGADES}旅
                  </span>
                </div>

                <div class="army-order-status">
                  {a.frontline && targetInfo ? (
                    <span class="army-status-pill is-front">
                      战线：{targetInfo.shortZh}（{a.frontline.friendlyProvIds.length}省）
                    </span>
                  ) : (
                    <span class="army-status-pill">未绑定战线</span>
                  )}
                  {a.arrow && arrowTarget && (
                    <span class="army-status-pill is-arrow">进攻→{arrowTarget.nameZh}</span>
                  )}
                </div>

                {isSel && (
                  <div class="army-item-actions" onClick={(e) => e.stopPropagation()}>
                    {armySnap.neighborTags.length > 0 && (
                      <select
                        class="army-select army-select-sm"
                        value={a.frontline?.targetTag ?? ''}
                        onChange={(e) => {
                          const v = (e.target as HTMLSelectElement).value;
                          if (v) actions.bindFrontline(a.id, v);
                          else actions.clearFrontline(a.id);
                        }}
                      >
                        <option value="">绑定邻国战线…</option>
                        {armySnap.neighborTags.map((nt) => (
                          <option key={nt} value={nt}>
                            {getCountryInfo(nt).nameZh}边境
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      class={`staff-btn army-mini-btn${toolMode === 'arrow' ? ' active' : ''}`}
                      onClick={() => actions.setOrderToolMode(toolMode === 'arrow' ? 'select' : 'arrow')}
                      title="在地图上从战线拖拽或点选目标省绘制进攻箭头"
                    >
                      画箭头
                    </button>
                    {a.arrow && (
                      <button
                        type="button"
                        class="staff-btn army-mini-btn"
                        onClick={() => actions.clearOffensiveArrow(a.id)}
                      >
                        清箭头
                      </button>
                    )}
                    {a.frontline && (
                      <button
                        type="button"
                        class="staff-btn army-mini-btn"
                        onClick={() => actions.clearFrontline(a.id)}
                      >
                        撤战线
                      </button>
                    )}
                    {ownArmies.length > 1 && (
                      <button
                        type="button"
                        class="army-cancel-btn"
                        onClick={() => actions.disbandArmy(a.id)}
                        title="解散集团军（下属旅转为直属）"
                      >
                        解散
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section class="army-card">
        <div class="army-card-head">
          <h3>{activeArmy ? `${activeArmy.nameZh} · 旅编成` : '全部在编旅'} ({rosterBrigades.length})</h3>
          {unassigned.length > 0 && (
            <span class="army-card-note mono-num">直属未编 {unassigned.length}旅</span>
          )}
        </div>
        <div class="army-brig-list">
          {rosterBrigades.map((b) => {
            const prov = getSimProvince(b.provinceId);
            const dest = b.moveTargetProvId ? getSimProvince(b.moveTargetProvId) : null;
            const isSel = selectedIds.has(b.id);
            return (
              <div
                key={b.id}
                class={`army-brig-row${isSel ? ' is-selected' : ''}`}
                onClick={() => actions.selectBrigades([b.id], b.armyId)}
              >
                <ArmyTemplateIcon type={b.template} width={22} height={15} />
                <div class="army-brig-main">
                  <div class="army-brig-top">
                    <span class="army-brig-name">{b.nameZh}</span>
                    {b.manualOverride && (
                      <button
                        type="button"
                        class="army-lock-badge"
                        title="手动微操锁：抵达前集团军AI不得覆盖（点击解锁）"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.unlockManualOverride(b.id);
                        }}
                      >
                        手操锁 ×
                      </button>
                    )}
                  </div>
                  <div class="army-brig-sub mono-num">
                    <span>{prov?.nameZh ?? `#${b.provinceId}`}</span>
                    {dest && <span class="army-march-tag">→{dest.nameZh} ({Math.ceil(b.etaTicks / 4)}日)</span>}
                    <span class="army-org-str">
                      <i class="org">{Math.round(b.orgPermille / 10)}%</i>/
                      <i class="str">{Math.round(b.strengthPermille / 10)}%</i>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
