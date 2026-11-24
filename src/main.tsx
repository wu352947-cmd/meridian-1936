import './styles/tokens.css';
import './ui/styles/overlay.css';

import { render } from 'preact';
import { loadMeridianFonts } from './assets/loadFonts';
import { parseUrlHarness } from './debug/urlHarness';
import { loadEurope1936Map } from './render/loadMapData';
import { MapStage } from './render/MapStage';
import type { MapMode } from './types/map';
import { MapOverlay } from './ui/MapOverlay';
import {
  cameraSig,
  hoveredProvSig,
  loadErrorSig,
  mapCountsSig,
  mapModeSig,
  mapReadySig,
  selectedProvSig,
  showCreditsSig,
  type MapActions,
} from './ui/mapStore';

async function bootstrap(): Promise<void> {
  const harness = parseUrlHarness();
  let stage: MapStage | null = null;

  const actions: MapActions = {
    setMode: (mode: MapMode) => {
      mapModeSig.value = mode;
      stage?.setMapMode(mode);
    },
    zoomIn: () => stage?.zoomBy(1.32),
    zoomOut: () => stage?.zoomBy(1 / 1.32),
    resetView: () => stage?.fitOverviewCamera(),
    clearSelection: () => stage?.selectProvince(null),
  };

  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    render(<MapOverlay actions={actions} />, uiRoot);
  }

  try {
    const [, bundle] = await Promise.all([loadMeridianFonts(), loadEurope1936Map()]);
    mapCountsSig.value = { land: bundle.meta.landCount, sea: bundle.meta.seaCount };

    const mapRoot = document.getElementById('map-root');
    if (!mapRoot) throw new Error('#map-root element missing');

    stage = await MapStage.create(mapRoot, bundle, {
      onHoverProvince: (p) => {
        hoveredProvSig.value = p;
      },
      onSelectProvince: (p) => {
        selectedProvSig.value = p;
      },
      onCameraChange: (cam) => {
        cameraSig.value = cam;
      },
    });

    // Apply URL debug harness parameters deterministically
    actions.setMode(harness.mapmode);
    if (harness.cam) {
      stage.setCamera(harness.cam.x, harness.cam.y, harness.cam.zoom);
    }
    if (harness.selectProv !== null) {
      stage.selectProvince(harness.selectProv);
    }
    if (harness.hoverProv !== null) {
      stage.hoverProvince(harness.hoverProv);
    }
    if (harness.about) {
      showCreditsSig.value = true;
    }

    // Expose deterministic debug handle for screenshot/verification scripts
    const liveStage = stage;
    window.__MERIDIAN_DEBUG__ = {
      setCamera: (x, y, zoom) => liveStage.setCamera(x, y, zoom),
      selectProvince: (id) => liveStage.selectProvince(id),
      hoverProvince: (id) => liveStage.hoverProvince(id),
      setMapMode: (m) => actions.setMode(m),
      getStats: () => ({
        landCount: bundle.meta.landCount,
        seaCount: bundle.meta.seaCount,
        zoom: liveStage.getCamera().zoom,
      }),
    };

    stage.renderNow();
    mapReadySig.value = true;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__MERIDIAN_READY__ = true;
  } catch (err) {
    console.error('[meridian] bootstrap failed:', err);
    loadErrorSig.value = err instanceof Error ? err.message : String(err);
  }
}

void bootstrap();
