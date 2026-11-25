import type { SimSpeed } from '../sim/core/ClockCalendar';
import { BRIGADE_TEMPLATES, type BrigadeType } from '../sim/data/brigadeTemplates';
import {
  CONSCRIPTION_LAW_SPECS,
  ECONOMY_LAW_SPECS,
  TRADE_LAW_SPECS,
  type GovernanceLawId,
  type GovernanceSlot,
} from '../sim/systems/governanceTypes';
import type { BuildingType } from '../sim/systems/industryTypes';
import type { MapMode } from '../types/map';

export type ScreenMode = 'country_select' | 'game';
export type DrawerTab = 'directives' | 'diplomacy' | 'industry' | 'tech' | 'logistics' | 'army' | 'battle';
export type IndustrySubTab = 'production' | 'construction' | 'trade';

export interface UrlHarnessParams {
  autotest: boolean;
  screen: ScreenMode;
  scenario: '1936';
  country: string;
  date: string | null;
  tick: number | null;
  seed: number;
  paused: boolean | null;
  speed: SimSpeed | null;
  panel: DrawerTab | null;
  subtab: IndustrySubTab | null;
  autotrade: boolean | null;
  queue: Array<{ regionId: number; building: BuildingType }>;
  crisisPermille: number | null;
  ap: number | null;
  mobilizationPermille: number | null;
  atWar: boolean;
  atWarMajor: boolean;
  homelandInvaded: boolean;
  armyInferior: boolean;
  laws: Array<{ slot: GovernanceSlot; lawId: GovernanceLawId }>;
  research: string[];
  demoFrontline: string | null;
  mockWar: string | null;
  selectArmy: number | null;
  train: BrigadeType[];
  mapmode: MapMode;
  cam: { x: number; y: number; zoom: number } | null;
  selectProv: number | null;
  hoverProv: number | null;
  lang: 'zh' | 'en';
  about: boolean;
  colorblind: boolean;
  motorized: boolean;
}

const VALID_MODES = new Set<MapMode>([
  'political',
  'terrain',
  'supply',
  'diplomacy',
  'industry',
  'air_sea',
]);

const VALID_PANELS = new Set<DrawerTab>([
  'directives',
  'diplomacy',
  'industry',
  'tech',
  'logistics',
  'army',
  'battle',
]);

const VALID_SUBTABS = new Set<IndustrySubTab>(['production', 'construction', 'trade']);
const VALID_BUILDINGS = new Set<BuildingType>(['CIV', 'MIL', 'DOC', 'INFRA', 'SYNTH']);

export function parseUrlHarness(search: string = window.location.search): UrlHarnessParams {
  const sp = new URLSearchParams(search);
  const autotest = sp.get('autotest') === '1';

  const rawMode = sp.get('mapmode') as MapMode | null;
  const mapmode: MapMode = rawMode && VALID_MODES.has(rawMode) ? rawMode : 'political';

  const rawPanel = sp.get('panel') as DrawerTab | null;
  const panel: DrawerTab | null = rawPanel && VALID_PANELS.has(rawPanel) ? rawPanel : null;

  const rawSubtab = sp.get('subtab') as IndustrySubTab | null;
  const subtab: IndustrySubTab | null = rawSubtab && VALID_SUBTABS.has(rawSubtab) ? rawSubtab : null;

  const rawAutoTrade = sp.get('autotrade');
  const autotrade: boolean | null =
    rawAutoTrade === '1' || rawAutoTrade === 'true'
      ? true
      : rawAutoTrade === '0' || rawAutoTrade === 'false'
        ? false
        : null;

  const queue: Array<{ regionId: number; building: BuildingType }> = [];
  const rawQueue = sp.get('queue');
  if (rawQueue) {
    for (const part of rawQueue.split(',')) {
      const [ridStr, bStr] = part.trim().split(':');
      const regionId = Number.parseInt(ridStr ?? '', 10);
      const building = (bStr ?? '').trim().toUpperCase() as BuildingType;
      if (Number.isFinite(regionId) && regionId > 0 && VALID_BUILDINGS.has(building)) {
        queue.push({ regionId, building });
      }
    }
  }

  const rawCountry = (sp.get('country') ?? '').trim().toUpperCase();
  const country = /^[A-Z]{3}$/.test(rawCountry) ? rawCountry : 'GER';

  const rawDate = sp.get('date');
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()) ? rawDate.trim() : null;

  const rawSeed = sp.get('seed');
  const parsedSeed = rawSeed ? Number.parseInt(rawSeed, 10) : NaN;
  const seed = Number.isFinite(parsedSeed) && parsedSeed > 0 ? parsedSeed : 19360101;

  const rawSpeed = sp.get('speed');
  const parsedSpeed = rawSpeed !== null ? Number.parseInt(rawSpeed, 10) : NaN;
  const speed: SimSpeed | null =
    Number.isFinite(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed <= 4
      ? (parsedSpeed as SimSpeed)
      : null;

  const rawPaused = sp.get('paused');
  const paused: boolean | null =
    rawPaused === '1' || rawPaused === 'true'
      ? true
      : rawPaused === '0' || rawPaused === 'false'
        ? false
        : null;

  // Screen resolution: explicit ?screen= wins; else ?scenario=/?country=/?date=/?panel= enters game directly;
  // default webpage landing opens country_select.
  const rawScreen = sp.get('screen');
  let screen: ScreenMode = 'country_select';
  if (rawScreen === 'country_select') {
    screen = 'country_select';
  } else if (
    rawScreen === 'game' ||
    sp.has('scenario') ||
    sp.has('country') ||
    sp.has('date') ||
    panel !== null
  ) {
    screen = 'game';
  }

  let cam: { x: number; y: number; zoom: number } | null = null;
  const rawCam = sp.get('cam');
  if (rawCam) {
    const parts = rawCam.split(',').map((s) => Number(s.trim()));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      cam = { x: parts[0]!, y: parts[1]!, zoom: parts[2]! };
    }
  }

  const parseIntOrNull = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const parseNonNegNum = (v: string | null): number | null => {
    if (v === null || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const crisisPct = parseNonNegNum(sp.get('crisis'));
  const crisisPermille = crisisPct !== null ? Math.min(1000, Math.round(crisisPct * 10)) : null;
  const ap = parseNonNegNum(sp.get('ap'));
  const mobPct = parseNonNegNum(sp.get('mobilization'));
  const mobilizationPermille = mobPct !== null ? Math.min(1000, Math.round(mobPct * 10)) : null;
  const isFlag = (k: string): boolean => {
    const v = sp.get(k);
    return v === '1' || v === 'true';
  };

  const laws: Array<{ slot: GovernanceSlot; lawId: GovernanceLawId }> = [];
  const rawLaws = sp.get('laws') ?? sp.get('law');
  if (rawLaws) {
    for (const part of rawLaws.split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const pieces = cleaned.split(':');
      const lawId = (pieces.length === 2 ? pieces[1] : pieces[0])!.trim() as GovernanceLawId;
      if (lawId in ECONOMY_LAW_SPECS) laws.push({ slot: 'economy', lawId });
      else if (lawId in CONSCRIPTION_LAW_SPECS) laws.push({ slot: 'conscription', lawId });
      else if (lawId in TRADE_LAW_SPECS) laws.push({ slot: 'trade', lawId });
    }
  }

  const research: string[] = [];
  const rawResearch = sp.get('research');
  if (rawResearch) {
    for (const part of rawResearch.split(',')) {
      const tid = part.trim();
      if (tid) research.push(tid);
    }
  }

  const rawDemoFrontline = sp.get('demoFrontline')?.trim() ?? '';
  const demoFrontline = rawDemoFrontline ? rawDemoFrontline.toUpperCase() : null;

  const rawMockWar = sp.get('mockWar')?.trim() ?? '';
  const mockWar = rawMockWar ? rawMockWar.toUpperCase() : null;
  const tick = parseIntOrNull(sp.get('tick'));
  const selectArmy = parseIntOrNull(sp.get('selectArmy'));

  const train: BrigadeType[] = [];
  const rawTrain = sp.get('train');
  if (rawTrain) {
    for (const part of rawTrain.split(',')) {
      const bt = part.trim().toUpperCase() as BrigadeType;
      if (bt in BRIGADE_TEMPLATES) train.push(bt);
    }
  }

  return {
    autotest,
    screen,
    scenario: '1936',
    country,
    date,
    tick,
    seed,
    paused,
    speed,
    panel,
    subtab,
    autotrade,
    queue,
    crisisPermille,
    ap,
    mobilizationPermille,
    atWar: isFlag('atWar'),
    atWarMajor: isFlag('atWarMajor'),
    homelandInvaded: isFlag('homelandInvaded'),
    armyInferior: isFlag('armyInferior'),
    laws,
    research,
    demoFrontline,
    mockWar,
    selectArmy,
    train,
    mapmode,
    cam,
    selectProv: parseIntOrNull(sp.get('selectProv')),
    hoverProv: parseIntOrNull(sp.get('hoverProv')),
    lang: sp.get('lang') === 'en' ? 'en' : 'zh',
    about: sp.get('modal') === 'credits' || sp.get('about') === '1',
    colorblind: isFlag('cb') || isFlag('colorblind'),
    motorized: isFlag('motorized'),
  };
}

declare global {
  interface Window {
    __MERIDIAN_READY__?: boolean;
    __MERIDIAN_DEBUG__?: {
      setCamera: (x: number, y: number, zoom: number) => void;
      selectProvince: (id: number | null) => void;
      hoverProvince: (id: number | null) => void;
      setMapMode: (mode: MapMode) => void;
      getStats: () => {
        landCount: number;
        seaCount: number;
        zoom: number;
        tick: number;
        playerTag: string;
        screen: ScreenMode;
      };
    };
  }
}
