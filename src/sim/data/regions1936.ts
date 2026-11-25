/**
 * Static 1936 European Industrial Regions (140-155 administrative regions clustered from provinces).
 * Pure data module — safe in Web Worker, Node Vitest, and main thread UI/renderer.
 */
import rawData from './regions1936.json';

export interface RegionStaticDef {
  id: number;
  owner: string;
  nameZh: string;
  hubProvId: number;
  cx: number;
  cy: number;
  isCoastal: boolean;
  provinceIds: readonly number[];
  slots: number;
  infra: number;
  civ: number;
  mil: number;
  doc: number;
  steel: number;
  oil: number;
  rare: number;
}

interface RawRegionBundle {
  regions: RegionStaticDef[];
  landAdj: Record<string, string[]>;
}

const BUNDLE = rawData as unknown as RawRegionBundle;

export const REGIONS_1936: readonly RegionStaticDef[] = BUNDLE.regions;
export const LAND_ADJACENCY_1936: Readonly<Record<string, readonly string[]>> = BUNDLE.landAdj;

const REGION_BY_ID = new Map<number, RegionStaticDef>();
const REGION_BY_PROV = new Map<number, RegionStaticDef>();
const REGIONS_BY_OWNER = new Map<string, RegionStaticDef[]>();

for (const r of REGIONS_1936) {
  REGION_BY_ID.set(r.id, r);
  for (const pid of r.provinceIds) {
    REGION_BY_PROV.set(pid, r);
  }
  const list = REGIONS_BY_OWNER.get(r.owner) ?? [];
  list.push(r);
  REGIONS_BY_OWNER.set(r.owner, list);
}

export function getRegionDef(regionId: number): RegionStaticDef | null {
  return REGION_BY_ID.get(regionId) ?? null;
}

export function getRegionDefByProvince(provId: number): RegionStaticDef | null {
  return REGION_BY_PROV.get(provId) ?? null;
}

export function getOwnerRegionDefs(tag: string): readonly RegionStaticDef[] {
  return REGIONS_BY_OWNER.get(tag) ?? [];
}
