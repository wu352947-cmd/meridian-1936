/**
 * Right-side Provincial Transparent Land Battle Report Drawer (Carbon §6.3.2).
 * Displays battle header, attacker/defender frontline+support slot matrices, reserves,
 * momentum evaluation bar, and itemized multiplier breakdown for the inspected brigade.
 */
import { useState } from 'preact/hooks';
import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getCountryInfo } from '../../data/countries1936';
import { formatFixedNum } from '../../sim/core/FixedMath';
import { RIVER_ZH, TERRAIN_ZH } from '../../sim/data/combatDefines';
import type { BattleSlotUnitSnap, ProvinceBattleSnap } from '../../sim/systems/combatTypes';
import {
  selectedBattleProvIdSig,
  simCombatSig,
  type AppActions,
} from '../store/simStore';
import { ArmyTemplateIcon } from './ArmyTemplateIcon';

interface Props {
  actions: AppActions;
}

function fmtMult(permille: number): string {
  return `×${(permille / 1000).toFixed(2)}`;
}

function momentumText(score: number): string {
  if (score >= 35) return `+${score} 攻方大优`;
  if (score >= 10) return `+${score} 攻方占优`;
  if (score > -10) return `${score >= 0 ? '+' : ''}${score} 战况胶着`;
  if (score > -35) return `${score} 守方占优`;
  return `${score} 守方稳固`;
}

function SlotGrid({
  label,
  units,
  maxSlots,
  selectedId,
  onSelect,
}: {
  label: string;
  units: readonly BattleSlotUnitSnap[];
  maxSlots: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const empties = Math.max(0, maxSlots - units.length);
  return (
    <div class="br-slot-block">
      <div class="br-slot-label">
        <span>{label}</span>
        <span class="mono-num">{units.length}/{maxSlots}</span>
      </div>
      <div class="br-slot-grid">
        {units.map((u) => {
          const orgPct = Math.round(u.orgPermille / 10);
          const strPct = Math.round(u.strengthPermille / 10);
          const sel = u.brigadeId === selectedId;
          return (
            <button
              key={u.brigadeId}
              type="button"
              class={`br-unit-chip${sel ? ' is-sel' : ''}${orgPct < 30 ? ' is-low' : ''}`}
              onClick={() => onSelect(u.brigadeId)}
              title={`点击查看 ${u.nameZh} 逐项乘数拆解`}
            >
              <div class="br-chip-top">
                <ArmyTemplateIcon type={u.template} width={18} height={12} />
                <span class="br-chip-name">{u.nameZh}</span>
              </div>
              <div class="br-chip-bars mono-num">
                <span class={orgPct < 30 ? 'br-warn' : 'br-org'}>组{orgPct}%</span>
                <span class="br-sep">|</span>
                <span class={strPct < 30 ? 'br-warn' : 'br-str'}>兵{strPct}%</span>
              </div>
            </button>
          );
        })}
        {Array.from({ length: Math.min(empties, 4) }).map((_, i) => (
          <div key={`e-${i}`} class="br-unit-chip is-empty">空槽</div>
        ))}
      </div>
    </div>
  );
}

export function BattleReportDrawer({ actions }: Props) {
  const combat = simCombatSig.value;
  const battles = combat?.battles ?? [];
  const targetProvId = selectedBattleProvIdSig.value;
  const [pickedUnitId, setPickedUnitId] = useState<number | null>(null);

  if (battles.length === 0) {
    return (
      <div class="br-empty">
        当前战区暂无正在进行的陆战交锋。点击地图上的交叉刺刀印章可随时调阅战地简报。
      </div>
    );
  }

  const battle: ProvinceBattleSnap =
    battles.find((b) => b.provinceId === targetProvId) ?? battles[0]!;
  const atkInfo = getCountryInfo(battle.attackerTag);
  const defInfo = getCountryInfo(battle.defenderTag);
  const days = (battle.durationTicks / 4).toFixed(1);
  const allUnits = [
    ...battle.attackerFront,
    ...battle.attackerSupport,
    ...battle.defenderFront,
    ...battle.defenderSupport,
  ];
  const inspected =
    allUnits.find((u) => u.brigadeId === pickedUnitId) ??
    battle.attackerFront[0] ??
    battle.defenderFront[0] ??
    allUnits[0] ??
    null;

  const barPct = Math.max(6, Math.min(94, Math.round((battle.advantageScore + 100) / 2)));
  const riverText = battle.river !== 'none' ? ` · ${RIVER_ZH[battle.river]}` : '';
  const fortText = battle.fortLevel > 0 ? ` · ${battle.fortLevel}级要塞` : '';

  return (
    <div class="br-wrap">
      {battles.length > 1 && (
        <div class="br-switcher">
          {battles.map((b) => (
            <button
              key={b.provinceId}
              type="button"
              class={`br-sw-btn${b.provinceId === battle.provinceId ? ' active' : ''}`}
              onClick={() => {
                setPickedUnitId(null);
                actions.openBattleReport(b.provinceId);
              }}
            >
              {b.provinceNameZh} <span class="mono-num">{b.advantageScore >= 0 ? `+${b.advantageScore}` : b.advantageScore}</span>
            </button>
          ))}
        </div>
      )}

      <div class="br-banner">
        <div class="br-title-row">
          <span class="br-title">{battle.provinceNameZh}战役</span>
          <span class="br-dur mono-num">持续 {days} 天</span>
        </div>
        <div class="br-meta-row">
          <span>{TERRAIN_ZH[battle.terrain]}{riverText}{fortText}</span>
          <span class="br-disabled-note">补给/制空/夜战：未启用</span>
        </div>
      </div>

      {/* Attacker Block */}
      <section class="br-side-card is-atk">
        <div class="br-side-head">
          <img src={getFlagDataUri(battle.attackerTag)} alt={atkInfo.shortZh} width={22} height={15} />
          <strong>进攻方：{atkInfo.shortZh}</strong>
          <span class="br-width-pill mono-num">
            {battle.attackDirections}向 · {battle.maxFrontline}前+{battle.maxSupport}支
          </span>
        </div>
        <SlotGrid label="前锋槽" units={battle.attackerFront} maxSlots={battle.maxFrontline} selectedId={inspected?.brigadeId ?? null} onSelect={setPickedUnitId} />
        <SlotGrid label="支援槽" units={battle.attackerSupport} maxSlots={battle.maxSupport} selectedId={inspected?.brigadeId ?? null} onSelect={setPickedUnitId} />
        <div class="br-side-foot mono-num">
          <span>攻势筹备 +{Math.round(battle.attackerPlanAvgPermille / 10)}%</span>
          <span>预备队 {battle.attackerReserves.length} 旅</span>
        </div>
      </section>

      {/* Center VS Momentum Bar */}
      <div class="br-vs-bar">
        <div class="br-vs-track">
          <div class="br-vs-atk" style={`width:${barPct}%`} />
        </div>
        <div class="br-vs-caption mono-num">
          VS · <strong>{momentumText(battle.advantageScore)}</strong>
        </div>
      </div>

      {/* Defender Block */}
      <section class="br-side-card is-def">
        <div class="br-side-head">
          <img src={getFlagDataUri(battle.defenderTag)} alt={defInfo.shortZh} width={22} height={15} />
          <strong>防守方：{defInfo.shortZh}</strong>
          <span class="br-width-pill mono-num">
            槽宽 {battle.maxFrontline}前+{battle.maxSupport}支
          </span>
        </div>
        <SlotGrid label="前锋槽" units={battle.defenderFront} maxSlots={battle.maxFrontline} selectedId={inspected?.brigadeId ?? null} onSelect={setPickedUnitId} />
        <SlotGrid label="支援槽" units={battle.defenderSupport} maxSlots={battle.maxSupport} selectedId={inspected?.brigadeId ?? null} onSelect={setPickedUnitId} />
        <div class="br-side-foot mono-num">
          <span>掘壕加成 +{Math.round(battle.defenderEntrenchAvgPermille / 10)}%</span>
          <span>预备队 {battle.defenderReserves.length} 旅</span>
        </div>
      </section>

      {/* Transparent Itemized Multiplier Breakdown */}
      {inspected && (
        <section class="br-breakdown">
          <div class="br-bd-head">
            <span>{inspected.nameZh} · {inspected.breakdown.isAttacking ? '有效攻击拆解' : '有效防御拆解'}</span>
            <span class="mono-num br-bd-result">
              {formatFixedNum(inspected.breakdown.baseAtkFixed, 1)} → <strong>{formatFixedNum(inspected.breakdown.effAtkFixed, 1)}</strong>
            </span>
          </div>
          <div class="br-bd-guard mono-num">
            {inspected.breakdown.isAttacking ? '有效突破' : '有效防御'}：{formatFixedNum(inspected.breakdown.baseGuardFixed, 1)} → <strong>{formatFixedNum(inspected.breakdown.effGuardFixed, 1)}</strong>
            <span> · 装甲 {inspected.breakdown.armor} / 敌穿甲 {inspected.breakdown.enemyMaxPiercing}</span>
          </div>
          <div class="br-factor-grid mono-num">
            {inspected.breakdown.factors.map((f) => {
              const cls = !f.enabled
                ? 'is-off'
                : f.multPermille > 1000
                  ? 'is-pos'
                  : f.multPermille < 1000
                    ? 'is-neg'
                    : '';
              return (
                <div key={f.key} class={`br-factor-pill ${cls}`}>
                  <span>{f.labelZh}</span>
                  <strong>{f.enabled ? fmtMult(f.multPermille) : '未启用'}</strong>
                </div>
              );
            })}
          </div>
          {inspected.breakdown.armorAdvantage && (
            <div class="br-badge-armor">
              ★ 装甲压制生效（甲 {inspected.breakdown.armor} &gt; 敌穿 {inspected.breakdown.enemyMaxPiercing}）：组织威慑 +35% · 受组织伤 -40%
            </div>
          )}
          {inspected.breakdown.exposedArtPenalty && (
            <div class="br-badge-warn">
              ⚠ 重炮无前锋掩护单独接敌：防御减半 (×0.50)
            </div>
          )}
        </section>
      )}
    </div>
  );
}
