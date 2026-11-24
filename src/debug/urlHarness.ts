import type { MapMode } from '../types/map';

export interface UrlHarnessParams {
  autotest: boolean;
  mapmode: MapMode;
  cam: { x: number; y: number; zoom: number } | null;
  selectProv: number | null;
  hoverProv: number | null;
  lang: 'zh' | 'en';
  about: boolean;
}

const VALID_MODES = new Set<MapMode>(['political', 'terrain', 'diplomacy', 'industry']);

export function parseUrlHarness(search: string = window.location.search): UrlHarnessParams {
  const sp = new URLSearchParams(search);
  const autotest = sp.get('autotest') === '1';

  const rawMode = sp.get('mapmode') as MapMode | null;
  const mapmode: MapMode = rawMode && VALID_MODES.has(rawMode) ? rawMode : 'political';

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
      getStats: () => { landCount: number; seaCount: number; zoom: number };
    };
  }
}
