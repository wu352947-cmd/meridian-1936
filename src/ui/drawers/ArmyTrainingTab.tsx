/**
 * F6 Army Drawer — Brigade Templates (6 fixed types) & Active Training Queue Tab.
 */
import { useState } from 'preact/hooks';
import {
  BRIGADE_TEMPLATES,
  BRIGADE_TYPE_ORDER,
  COMBAT_SLOT_RULES,
  type BrigadeType,
} from '../../sim/data/brigadeTemplates';
import { getCapitalProvince, getOwnerProvinces } from '../../sim/data/provinces1936';
import type { ArmySystemSnapshot } from '../../sim/systems/armyTypes';
import { EQUIPMENT_SPECS } from '../../sim/systems/industryTypes';
import { calcTargetTrainDaysFixed } from '../../sim/systems/trainingSystem';
import { selectedProvSig } from '../mapStore';
import { simGovernanceSig, simIndustrySig, type AppActions } from '../store/simStore';
import { ArmyTemplateIcon } from './ArmyTemplateIcon';

interface Props {
  tag: string;
  armySnap: ArmySystemSnapshot;
  actions: AppActions;
}

function fmtMp(n: number): string {
  return n >= 10_000 ? `${(n / 10_000).toFixed(1)}万` : n.toLocaleString('en-US');
}

export function ArmyTrainingTab({ tag, armySnap, actions }: Props) {
  const ownProvs = getOwnerProvinces(tag);
  const capital = getCapitalProvince(tag);
  const [deployProvId, setDeployProvId] = useState<number>(capital?.id ?? ownProvs[0]?.id ?? 0);
  const selectedProv = selectedProvSig.value;
  const activeDeployId = ownProvs.some((p) => p.id === deployProvId)
    ? deployProvId
    : (capital?.id ?? ownProvs[0]?.id ?? 0);

  const ind = simIndustrySig.value;
  const gov = simGovernanceSig.value;
  const availMp = gov && gov.tag === tag ? gov.manpower.available : 0;
  const stockByType = new Map<string, number>();
  if (ind && ind.tag === tag) {
    for (const l of ind.lines) stockByType.set(l.type, Math.floor(l.stockpileFixed / 1000));
  }
  const modPerm = armySnap.trainingTimeModPermille;
  const modPct = Math.round(modPerm / 10);

  return (
    <div class="army-tab-body">
      <div class="army-slot-rule-bar">
        <span class="army-rule-tag">宽度槽</span>
        <span class="mono-num">
          基础 {COMBAT_SLOT_RULES.base.frontline}前+{COMBAT_SLOT_RULES.base.support}支 · 山/沼{' '}
          {COMBAT_SLOT_RULES.narrowTerrains.frontline}+{COMBAT_SLOT_RULES.narrowTerrains.support} · 都市{' '}
          {COMBAT_SLOT_RULES.urban.frontline}+{COMBAT_SLOT_RULES.urban.support} · 夹击 +
          {COMBAT_SLOT_RULES.flankingBonusPerDirection.frontline}/+
          {COMBAT_SLOT_RULES.flankingBonusPerDirection.support}
        </span>
      </div>

      <div class="army-deploy-row">
        <label class="army-deploy-label" for="army-deploy-select">
          部署省
        </label>
        <select
          id="army-deploy-select"
          class="army-select"
          value={activeDeployId}
          onChange={(e) => setDeployProvId(Number((e.target as HTMLSelectElement).value))}
        >
          {ownProvs.slice(0, 28).map((p) => (
            <option key={p.id} value={p.id}>
              {p.isCapital ? `★ ${p.nameZh}` : p.nameZh}
            </option>
          ))}
        </select>
        {selectedProv && !selectedProv.isSea && selectedProv.owner === tag && (
          <button
            type="button"
            class="staff-btn army-mini-btn"
            onClick={() => setDeployProvId(selectedProv.id)}
            title={`设为当前选中省：${selectedProv.nameZh}`}
          >
            用选中省
          </button>
        )}
      </div>

      <section class="army-card">
        <div class="army-card-head">
          <h3>训练队列 ({armySnap.trainingQueue.length})</h3>
          <span class="army-card-note mono-num">
            待部署 {fmtMp(armySnap.inTrainingManpower)}
            {modPct !== 0 ? ` · 耗时 ${modPct > 0 ? `+${modPct}%` : `${modPct}%`}` : ''}
          </span>
        </div>
        {armySnap.trainingQueue.length === 0 ? (
          <div class="army-empty">暂无在训旅，点击下方模板“+开训”即可征编。</div>
        ) : (
          <div class="army-queue-list">
            {armySnap.trainingQueue.map((ord) => {
              const tmpl = BRIGADE_TEMPLATES[ord.template];
              const pct = Math.round(ord.progressPermille / 10);
              const eqPct = Math.round(ord.equipmentRatioPermille / 10);
              const shortLabel = ord.shortageType ? EQUIPMENT_SPECS[ord.shortageType].shortZh : '';
              return (
                <div class="army-queue-item" key={ord.id}>
                  <div class="army-queue-top">
                    <div class="army-queue-name">
                      <ArmyTemplateIcon type={ord.template} width={22} height={15} />
                      <span>{tmpl.nameZh}</span>
                    </div>
                    <span class="mono-num army-queue-eta">
                      剩 {ord.remainingDays}/{ord.totalDays}日
                    </span>
                    <button
                      type="button"
                      class="army-cancel-btn"
                      onClick={() => actions.cancelTraining(ord.id)}
                      title="取消训练并退还人力与装备"
                    >
                      ×
                    </button>
                  </div>
                  <div class="army-prog-track">
                    <div class="army-prog-fill" style={`width:${Math.max(4, pct)}%`} />
                  </div>
                  <div class="army-queue-meta mono-num">
                    <span>部署：{ord.deployProvNameZh}</span>
                    <span class={eqPct < 100 ? 'army-warn' : 'army-ok'}>
                      {eqPct < 100 ? `装备 ${eqPct}%（缺${shortLabel}）` : '满编 100%'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section class="army-card">
        <div class="army-card-head">
          <h3>六类标准作战旅模板</h3>
          <span class="army-card-note mono-num">可用人力 {fmtMp(availMp)}</span>
        </div>
        <div class="army-tmpl-list">
          {BRIGADE_TYPE_ORDER.map((bt: BrigadeType) => {
            const t = BRIGADE_TEMPLATES[bt];
            const days = Math.ceil(calcTargetTrainDaysFixed(bt, modPerm) / 1000);
            const canMp = availMp >= t.manpower;
            const eqParts = t.equipment.map((req) => {
              const have = stockByType.get(req.type) ?? 0;
              return { ...req, have, ok: have >= req.amount };
            });
            const allEqOk = eqParts.every((e) => e.ok);
            return (
              <div class="army-tmpl-row" key={bt}>
                <div class="army-tmpl-head">
                  <div class="army-tmpl-id">
                    <ArmyTemplateIcon type={bt} />
                    <div>
                      <div class="army-tmpl-name">
                        {t.nameZh}
                        <span class={`army-role-pill ${t.role}`}>
                          {t.role === 'frontline' ? '前锋' : '支援'}
                        </span>
                      </div>
                      <div class="army-tmpl-stats mono-num">
                        Org {t.maxOrg} · 攻{t.attack}/防{t.defense}/突{t.breakthrough} · 甲{t.armor}/{t.piercing} · 速{t.speed.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class={`staff-btn army-train-btn${!allEqOk ? ' is-short' : ''}`}
                    disabled={!canMp}
                    onClick={() => actions.queueTraining(bt, activeDeployId)}
                    title={
                      !canMp
                        ? `可用人力不足（需 ${t.manpower.toLocaleString('en-US')}）`
                        : allEqOk
                          ? `征编 1 个${t.nameZh}（耗时 ${days} 日）`
                          : `装备不足：可按短缺比例降编开训（耗时 ${days} 日）`
                    }
                  >
                    +开训
                    <em class="mono-num">{days}日</em>
                  </button>
                </div>
                <div class="army-tmpl-cost mono-num">
                  <span class={canMp ? '' : 'army-warn'}>人力 {(t.manpower / 1000).toFixed(0)}k</span>
                  {eqParts.map((ep) => (
                    <span key={ep.type} class={ep.ok ? 'army-eq-ok' : 'army-warn'}>
                      {EQUIPMENT_SPECS[ep.type].shortZh} {ep.amount}
                      <small>({ep.have})</small>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
