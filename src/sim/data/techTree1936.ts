/**
 * Typed loader for the 36-node 1936 Cyanotype Engineering Tech Tree.
 * Pure static JSON import — safe in Web Worker, Node Vitest, and main thread UI.
 */
import rawTechTree from '../../../public/data/europe_1936/tech_tree.json';
import type { ModifierEntry } from '../systems/modifierTypes';

export type TechBranchId =
  | 'infantry_artillery'
  | 'armor_doctrine'
  | 'air_navy_radar'
  | 'industry_chem';

export interface TechBranchDef {
  id: TechBranchId;
  nameZh: string;
  shortZh: string;
  rows: number;
}

export interface TechNodeDef {
  id: string;
  branch: TechBranchId;
  nameZh: string;
  year: number;
  baseDays: number;
  row: number;
  col: number;
  prerequisites: readonly string[];
  mutuallyExclusive: readonly string[];
  doctrineGroup?: string;
  modifiers: readonly ModifierEntry[];
}

interface RawTechTreeBundle {
  version: number;
  yearTicks: readonly number[];
  branches: readonly TechBranchDef[];
  nodes: readonly TechNodeDef[];
}

const BUNDLE = rawTechTree as unknown as RawTechTreeBundle;

export const TECH_YEAR_TICKS: readonly number[] = BUNDLE.yearTicks;
export const TECH_BRANCHES: readonly TechBranchDef[] = BUNDLE.branches;
export const TECH_NODES: readonly TechNodeDef[] = BUNDLE.nodes;

const NODE_BY_ID = new Map<string, TechNodeDef>();
const NODES_BY_BRANCH = new Map<TechBranchId, TechNodeDef[]>();

for (const b of TECH_BRANCHES) NODES_BY_BRANCH.set(b.id, []);
for (const n of TECH_NODES) {
  NODE_BY_ID.set(n.id, n);
  NODES_BY_BRANCH.get(n.branch)?.push(n);
}

export function getTechNode(id: string): TechNodeDef | null {
  return NODE_BY_ID.get(id) ?? null;
}

export function getBranchTechNodes(branch: TechBranchId): readonly TechNodeDef[] {
  return NODES_BY_BRANCH.get(branch) ?? [];
}

/** Major powers begin 1936 with baseline light tanks researched (zero industry/manpower side effects). */
export const STARTING_TECHS_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  GER: ['light_tank_1936'],
  GBR: ['light_tank_1936'],
  FRA: ['light_tank_1936'],
  SOV: ['light_tank_1936'],
  ITA: ['light_tank_1936'],
};
