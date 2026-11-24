export type TerrainType =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'marsh'
  | 'urban'
  | 'desert'
  | 'sea';

export type MapMode = 'political' | 'terrain' | 'diplomacy' | 'industry';

export type FactionId = 'allies' | 'axis' | 'comintern' | 'neutral';

export interface ProvinceRecord {
  id: number;
  code: string;
  nameZh: string;
  nameEn: string;
  owner: string;
  core: string;
  isSea: boolean;
  isCoastal: boolean;
  terrain: TerrainType;
  cx: number;
  cy: number;
  areaPx: number;
  vp: number;
  industry: number;
  cityZh?: string;
  cityEn?: string;
  isCapital?: boolean;
  hideMapLabel?: boolean;
  neighbors: number[];
  straits?: number[];
}

export interface RiverPolyline {
  name: string;
  rank: number; // 1 = major trunk, 2 = secondary
  points: [number, number][];
}

export interface GraticuleLine {
  kind: 'lat' | 'lon';
  deg: number;
  points: [number, number][];
}

export interface CountryLabelCurve {
  tag: string;
  nameZh: string;
  nameEn: string;
  /** 3 control points [p0, p1, p2] for quadratic Bezier in map coords */
  curve: [[number, number], [number, number], [number, number]];
  spanPx: number;
  areaPx: number;
  fontSize: number;
  priority: number;
}

export interface EuropeMapMeta {
  width: number;
  height: number;
  reliefWidth: number;
  reliefHeight: number;
  projection: string;
  boundsMeters: [number, number, number, number];
  landCount: number;
  seaCount: number;
  provinces: ProvinceRecord[];
  rivers: RiverPolyline[];
  graticule: GraticuleLine[];
  labelCurves: CountryLabelCurve[];
}

export interface CountryInfo {
  tag: string;
  nameZh: string;
  nameEn: string;
  shortZh: string;
  color: string;
  faction: FactionId;
  capitalZh: string;
  ideologyZh: string;
  isEdge?: boolean;
}
