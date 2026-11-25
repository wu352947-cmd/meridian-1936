import type { SimSpeed } from '../sim/core/ClockCalendar';
import type { BuildingType } from '../sim/systems/industryTypes';
import type { MapMode } from '../types/map';

export type ScreenMode = 'country_select' | 'game';
export type DrawerTab = 'directives' | 'diplomacy' | 'industry' | 'tech' | 'logistics' | 'army';
export type IndustrySubTab = 'production' | 'construction' | 'trade';

export interface UrlHarnessParams {
  autotest: boolean;
  screen: ScreenMode;
  scenario: '1936';
  country: string;
  date: string | null;
  seed: number;
  paused: boolean | null;
  speed: SimSpeed | null;
  panel: DrawerTab | null;
  subtab: IndustrySubTab | null;
  autotrade: boolean | null;
  queue: Array<{ regionId: number; building: BuildingType }>;
  mapmode: MapMode;
  cam: { x: number; y: number; zoom: number } | null;
  selectProv: number | null;
  hoverProv: number | null;
  lang: 'zh' | 'en';
  about: boolean;
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

  return {
    autotest,
    screen,
    scenario: '1936',
    country,
    date,
    seed,
    paused,
    speed,
    panel,
    subtab,
    autotrade,
    queue,
    mapmode,
    cam,
    selectProv: parseIntOrNull(sp.get('selectProv')),
    hoverProv: parseIntOrNull(sp.get('hoverProv')),
    lang: sp.get('lang') === 'en' ? 'en' : 'zh',
    about: sp.get('modal') === 'credits' || sp.get('about') === '1',
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
