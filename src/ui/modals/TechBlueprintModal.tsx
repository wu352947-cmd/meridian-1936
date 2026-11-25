import { useState } from 'preact/hooks';
import { getFlagDataUri } from '../../assets/flags/neutralFlags';
import { getCountryInfo } from '../../data/countries1936';
import {
  getTechNode,
  TECH_BRANCHES,
  TECH_NODES,
  TECH_YEAR_TICKS,
  type TechNodeDef,
} from '../../sim/data/techTree1936';
import {
  calcTechActualDaysFixed,
  calcTechAheadPenaltyPermille,
  type TechSlotSnapshot,
} from '../../sim/systems/techTypes';
import { simPlayerTagSig, simTechSig, type AppActions } from '../store/simStore';
import { colX, getNodeVisualStatus, TechBranchCanvas } from './TechBranchCanvas';

interface Props {
  open: boolean;
  onClose: () => void;
  actions: AppActions;
}

export function TechBlueprintModal({ open, onClose, actions }: Props) {
  const [selectedId, setSelectedId] = useState<string>('machine_tools_1');

  if (!open) return null;

  const tag = simPlayerTagSig.value;
  const info = getCountryInfo(tag);
  const tech = simTechSig.value;
  if (!tech || tech.tag !== tag) return null;

  const completedSet = new Set(tech.completedIds);
  const slotByTech = new Map<string, TechSlotSnapshot>();
  for (const s of tech.slots) {
    if (s.techId) slotByTech.set(s.techId, s);
  }
  const hasFreeSlot = tech.slots.some((s) => s.techId === null);

  const selectedNode: TechNodeDef = getTechNode(selectedId) ?? TECH_NODES[0]!;
  const selStatus = getNodeVisualStatus(selectedNode, completedSet, slotByTech);
  const selSlot = slotByTech.get(selectedNode.id);
  const selAhead = calcTechAheadPenaltyPermille(selectedNode.year, tech.currentYear);
  const selActualDaysFixed = calcTechActualDaysFixed(
    selectedNode.baseDays,
    selectedNode.year,
    tech.currentYear,
    tech.researchSpeedBonusPermille,
  );
  const selActualDays = Math.ceil(selActualDaysFixed / 1000);

  const handleQuickStart = (node: TechNodeDef) => {
    if (hasFreeSlot) {
      actions.startResearch(node.id);
    }
  };

  let blockReason = '';
  if (selStatus === 'locked') {
    const missing = selectedNode.prerequisites
      .filter((p) => !completedSet.has(p))
      .map((p) => getTechNode(p)?.nameZh ?? p);
    blockReason = `需前置：${missing.join('、')}`;
  } else if (selStatus === 'excluded') {
    blockReason = '已选择其他互斥陆战学说';
  } else if (selStatus === 'available' && !hasFreeSlot) {
    blockReason = '科研槽已满（请先取消某槽）';
  }

  return (
    <div
      class="bp-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="F4 蓝晒工程科技树"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="bp-sheet">
        <span class="bp-corner tl" aria-hidden="true" />
        <span class="bp-corner tr" aria-hidden="true" />
        <span class="bp-corner bl" aria-hidden="true" />
        <span class="bp-corner br" aria-hidden="true" />

        <header class="bp-header">
          <div class="bp-title-block">
            <img class="bp-flag" src={getFlagDataUri(tag)} alt={info.nameZh} width={34} height={22} />
            <div>
              <div class="bp-title-row">
                <h2>蓝晒工程科技图谱</h2>
                <span class="bp-sheet-code mono-num">DWG // M36-TECH-{tech.currentYear}</span>
              </div>
              <div class="bp-subtitle mono-num">
                {info.nameZh} · 当前年份 {tech.currentYear} · 科研速度{' '}
                {tech.researchSpeedBonusPermille >= 0 ? '+' : ''}
                {Math.round(tech.researchSpeedBonusPermille / 10)}% · 已竣工 {tech.completedIds.length}/{TECH_NODES.length}
              </div>
            </div>
          </div>

          <div class="bp-slots-strip" aria-label="并行科研槽">
            {tech.slots.map((s) => {
              const node = s.techId ? getTechNode(s.techId) : null;
              if (!node) {
                return (
                  <div class="bp-slot-card is-idle" key={s.slotIndex}>
                    <span class="bp-slot-idx mono-num">槽 #{s.slotIndex + 1}</span>
                    <span class="bp-slot-idle-txt">空闲 · 点选节点排研</span>
                  </div>
                );
              }
              const pct = Math.round(s.progressPermille / 10);
              return (
                <div
                  class="bp-slot-card is-busy"
                  key={s.slotIndex}
                  onClick={() => setSelectedId(node.id)}
                >
                  <div class="bp-slot-top">
                    <span class="bp-slot-name">{node.nameZh}</span>
                    <button
                      type="button"
                      class="bp-slot-cancel"
                      title="取消此科研槽"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        actions.cancelResearch(s.slotIndex);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div class="bp-slot-bar">
                    <div class="bp-slot-bar-fill" style={`width:${pct}%`} />
                  </div>
                  <div class="bp-slot-meta mono-num">
                    <span>
                      {pct}%{s.aheadPenaltyPermille > 0 ? ` · 罚+${s.aheadPenaltyPermille / 10}%` : ''}
                    </span>
                    <strong>剩 {s.etaDays} 天</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" class="bp-close-btn" onClick={onClose} title="关闭蓝晒科技树 (Esc)">
            ×
          </button>
        </header>

        <div class="bp-ruler-row">
          <div class="bp-ruler-head mono-num">年代标尺</div>
          <div class="bp-ruler-track">
            {TECH_YEAR_TICKS.map((yr, idx) => {
              const isCur = tech.currentYear >= yr && (idx === TECH_YEAR_TICKS.length - 1 || tech.currentYear < TECH_YEAR_TICKS[idx + 1]!);
              return (
                <div
                  key={yr}
                  class={`bp-ruler-tick mono-num${isCur ? ' is-now' : ''}`}
                  style={`left:${colX(idx)}px`}
                >
                  <span>{yr}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div class="bp-canvas-scroll">
          {TECH_BRANCHES.map((branch) => (
            <TechBranchCanvas
              key={branch.id}
              branch={branch}
              currentYear={tech.currentYear}
              completedSet={completedSet}
              slotByTech={slotByTech}
              selectedId={selectedNode.id}
              onSelect={(n) => setSelectedId(n.id)}
              onQuickStart={handleQuickStart}
            />
          ))}
        </div>

        <footer class="bp-inspector">
          <div class="bp-insp-left">
            <div class="bp-insp-title">
              <strong>{selectedNode.nameZh}</strong>
              <span class="bp-insp-yr mono-num">基准年 {selectedNode.year}</span>
              <span class="bp-insp-days mono-num">
                基础 {selectedNode.baseDays} 天 → 实需 {selActualDays} 天
                {selAhead > 0 ? `（超前罚 +${selAhead / 10}%）` : '（当期无惩罚）'}
              </span>
            </div>
            <div class="bp-insp-mods">
              {selectedNode.modifiers.map((m) => (
                <span class="bp-mod-chip" key={`${selectedNode.id}-${m.key}`}>
                  {m.labelZh}
                </span>
              ))}
              {blockReason && <span class="bp-block-chip">{blockReason}</span>}
            </div>
          </div>

          <div class="bp-insp-right">
            {selStatus === 'completed' ? (
              <span class="bp-status-pill done">✓ 已竣工并生效</span>
            ) : selStatus === 'researching' && selSlot ? (
              <button
                type="button"
                class="bp-act-btn is-cancel mono-num"
                onClick={() => actions.cancelResearch(selSlot.slotIndex)}
              >
                研发中（剩 {selSlot.etaDays} 天）· 取消
              </button>
            ) : (
              <button
                type="button"
                class="bp-act-btn mono-num"
                disabled={selStatus !== 'available' || !hasFreeSlot}
                onClick={() => actions.startResearch(selectedNode.id)}
              >
                排入空闲科研槽 · 预计 {selActualDays} 天
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
