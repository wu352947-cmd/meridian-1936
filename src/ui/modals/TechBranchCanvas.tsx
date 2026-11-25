import { getBranchTechNodes, type TechBranchDef, type TechNodeDef } from '../../sim/data/techTree1936';
import { calcTechAheadPenaltyPermille, type TechSlotSnapshot } from '../../sim/systems/techTypes';

export const BP_TRACK_W = 900;
const CARD_W = 154;
const CARD_H = 29;
const COL_X0 = 12;
const COL_STEP = 178;
const ROW_Y0 = 5;
const ROW_STEP = 34;

export const colX = (col: number): number => COL_X0 + col * COL_STEP;
export const rowY = (row: number): number => ROW_Y0 + row * ROW_STEP;

export type NodeVisualStatus = 'completed' | 'researching' | 'available' | 'excluded' | 'locked';

interface Props {
  branch: TechBranchDef;
  currentYear: number;
  completedSet: ReadonlySet<string>;
  slotByTech: ReadonlyMap<string, TechSlotSnapshot>;
  selectedId: string;
  onSelect: (node: TechNodeDef) => void;
  onQuickStart: (node: TechNodeDef) => void;
}

export function getNodeVisualStatus(
  node: TechNodeDef,
  completedSet: ReadonlySet<string>,
  slotByTech: ReadonlyMap<string, TechSlotSnapshot>,
): NodeVisualStatus {
  if (completedSet.has(node.id)) return 'completed';
  if (slotByTech.has(node.id)) return 'researching';
  for (const ex of node.mutuallyExclusive) {
    if (completedSet.has(ex) || slotByTech.has(ex)) return 'excluded';
  }
  for (const pre of node.prerequisites) {
    if (!completedSet.has(pre)) return 'locked';
  }
  return 'available';
}

export function TechBranchCanvas({
  branch,
  currentYear,
  completedSet,
  slotByTech,
  selectedId,
  onSelect,
  onQuickStart,
}: Props) {
  const nodes = getBranchTechNodes(branch.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trackH = ROW_Y0 + branch.rows * ROW_STEP + 3;
  const doneCount = nodes.filter((n) => completedSet.has(n.id)).length;

  return (
    <div class="bp-branch-row">
      <div class="bp-branch-label">
        <div class="bp-branch-name">{branch.shortZh}</div>
        <div class="bp-branch-count mono-num">
          {doneCount}/{nodes.length}
        </div>
      </div>

      <div class="bp-branch-track" style={`height:${trackH}px`}>
        <svg class="bp-connector-svg" viewBox={`0 0 ${BP_TRACK_W} ${trackH}`} width={BP_TRACK_W} height={trackH} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((c) => {
            const x = colX(c) + CARD_W / 2;
            return (
              <line
                key={c}
                x1={x}
                y1={0}
                x2={x}
                y2={trackH}
                stroke="rgba(230,242,255,0.12)"
                stroke-width="1"
                stroke-dasharray="3 4"
              />
            );
          })}

          {branch.id === 'armor_doctrine' && (
            <g>
              <rect
                x={colX(1) - 6}
                y={rowY(2) - 3}
                width={colX(3) - colX(1) + CARD_W + 12}
                height={CARD_H + 6}
                rx="3"
                fill="rgba(230,242,255,0.04)"
                stroke="rgba(232,188,104,0.52)"
                stroke-width="1"
                stroke-dasharray="4 3"
              />
              <text x={colX(0) + 76} y={rowY(2) + 18} text-anchor="middle" fill="rgba(232,188,104,0.88)" font-size="10">
                [!] 陆战学说 · 三选一互斥
              </text>
              {[1, 2].map((c) => {
                const lx1 = colX(c) + CARD_W + 2;
                const lx2 = colX(c + 1) - 2;
                const ly = rowY(2) + CARD_H / 2;
                return (
                  <g key={c}>
                    <line x1={lx1} y1={ly} x2={lx2} y2={ly} stroke="rgba(232,188,104,0.75)" stroke-width="1.2" stroke-dasharray="2 2" />
                    <text x={(lx1 + lx2) / 2} y={ly - 4} text-anchor="middle" fill="#F0C674" font-size="9" font-weight="700">
                      ✕
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {nodes.map((dst) =>
            dst.prerequisites.map((preId) => {
              const src = byId.get(preId);
              if (!src) return null;
              const x1 = colX(src.col) + CARD_W;
              const y1 = rowY(src.row) + CARD_H / 2;
              const x2 = colX(dst.col);
              const y2 = rowY(dst.row) + CARD_H / 2;
              const midX = x1 + 12;
              const dPath =
                src.row === dst.row
                  ? `M ${x1} ${y1} L ${x2 - 4} ${y2}`
                  : `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 4} ${y2}`;
              const activeEdge = completedSet.has(src.id);
              const stroke = activeEdge ? '#E6F2FF' : 'rgba(230,242,255,0.42)';
              return (
                <g key={`${preId}->${dst.id}`}>
                  <path d={dPath} fill="none" stroke={stroke} stroke-width={activeEdge ? 1.6 : 1.15} />
                  <circle cx={x1} cy={y1} r="2.2" fill={stroke} />
                  <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`} fill={stroke} />
                </g>
              );
            }),
          )}
        </svg>

        {nodes.map((node) => {
          const st = getNodeVisualStatus(node, completedSet, slotByTech);
          const slot = slotByTech.get(node.id);
          const aheadPerm = calcTechAheadPenaltyPermille(node.year, currentYear);
          const pct = slot ? Math.round(slot.progressPermille / 10) : 0;
          const isSel = selectedId === node.id;

          return (
            <button
              key={node.id}
              type="button"
              class={`bp-node is-${st}${isSel ? ' is-selected' : ''}`}
              style={`left:${colX(node.col)}px;top:${rowY(node.row)}px;width:${CARD_W}px;height:${CARD_H}px`}
              onClick={() => {
                onSelect(node);
                if (st === 'available') onQuickStart(node);
              }}
              onMouseEnter={() => onSelect(node)}
              title={`${node.nameZh} (${node.year}) · 基础 ${node.baseDays} 天`}
            >
              {st === 'researching' && <span class="bp-node-prog-fill" style={`width:${pct}%`} />}
              <span class="bp-node-name">{node.nameZh}</span>
              <span class="bp-node-badge mono-num">
                {st === 'completed' ? (
                  '✓'
                ) : st === 'researching' && slot ? (
                  <em class="bp-eta-tag">剩{slot.etaDays}天</em>
                ) : st === 'excluded' ? (
                  '互斥'
                ) : aheadPerm > 0 ? (
                  <em class="bp-ahead-tag">+{aheadPerm / 10}%</em>
                ) : (
                  node.year
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
