import './styles/tokens.css';
import './ui/styles/overlay.css';
import './ui/styles/dossier.css';
import './ui/styles/dossierTray.css';
import './ui/styles/hudTop.css';
import './ui/styles/hudDock.css';
import './ui/styles/industryDrawer.css';
import './ui/styles/governanceDrawer.css';
import './ui/styles/techBlueprint.css';
import './ui/styles/techBlueprintNodes.css';
import './ui/styles/armyDrawer.css';
import './ui/styles/armyOrders.css';
import './ui/styles/armyCards.css';
import './ui/styles/battleReport.css';
import './ui/styles/logistics.css';

import { render } from 'preact';
import { loadMeridianFonts } from './assets/loadFonts';
import { parseUrlHarness } from './debug/urlHarness';
import { loadEurope1936Map } from './render/loadMapData';
import { MapStage } from './render/MapStage';
import { isPlayableTag } from './sim/data/nations1936';
import { getRegionDef } from './sim/data/regions1936';
import type { MapMode } from './types/map';
import { AppShell } from './ui/AppShell';
import {
  cameraSig,
  hoveredProvSig,
  loadErrorSig,
  mapCountsSig,
  mapModeSig,
  mapReadySig,
  selectedProvSig,
  showCreditsSig,
} from './ui/mapStore';
import { SimClient } from './ui/store/SimClient';
import {
  activeDrawerSig,
  applyWorldSnapshot,
  autotestModeSig,
  colorblindModeSig,
  industrySubTabSig,
  orderToolModeSig,
  screenModeSig,
  selectedArmyIdSig,
  selectedBattleProvIdSig,
  selectedBrigadeIdsSig,
  selectedCountrySig,
  simArmySig,
  simCombatSig,
  simIndustrySig,
  simLogisticsSig,
  simPlayerTagSig,
  simSeedSig,
  simSupplyByProvSig,
  simTickSig,
  type AppActions,
} from './ui/store/simStore';

async function bootstrap(): Promise<void> {
  const harness = parseUrlHarness();
  const initialTag = isPlayableTag(harness.country) ? harness.country : 'GER';
  let stage: MapStage | null = null;
  let sim: SimClient | null = null;

  autotestModeSig.value = harness.autotest;
  colorblindModeSig.value = harness.colorblind;
  screenModeSig.value = harness.screen;
  selectedCountrySig.value = initialTag;
  simSeedSig.value = harness.seed;
  activeDrawerSig.value = harness.panel;
  if (harness.subtab) industrySubTabSig.value = harness.subtab;

  const actions: AppActions = {
    setMode: (mode: MapMode) => {
      mapModeSig.value = mode;
      stage?.setMapMode(mode);
    },
    zoomIn: () => stage?.zoomBy(1.32),
    zoomOut: () => stage?.zoomBy(1 / 1.32),
    resetView: () => stage?.fitOverviewCamera(),
    clearSelection: () => stage?.selectProvince(null),
    focusCountry: (tag: string, pan = false) => {
      stage?.highlightCountry(tag, pan, 1.35);
    },
    focusRegion: (regionId: number) => {
      const def = getRegionDef(regionId);
      if (!def || !stage) return;
      stage.selectProvince(def.hubProvId);
      stage.setCamera(def.cx + 120, def.cy, Math.max(stage.getCamera().zoom, 1.45));
    },
    previewCountry: (tag: string, pan = false) => {
      if (!isPlayableTag(tag)) return;
      selectedCountrySig.value = tag;
      stage?.highlightCountry(tag, pan, 1.05);
    },
    startCampaign: (tag: string) => {
      const validTag = isPlayableTag(tag) ? tag : 'GER';
      selectedCountrySig.value = validTag;
      screenModeSig.value = 'game';
      activeDrawerSig.value = null;
      selectedBrigadeIdsSig.value = [];
      selectedArmyIdSig.value = null;
      orderToolModeSig.value = 'select';
      stage?.setArmyVisible(true);
      stage?.setPlayerTag(validTag);
      stage?.setOrderToolMode('select');
      stage?.selectProvince(null);
      stage?.highlightCountry(validTag, false);
      sim?.selectCountry(validTag);
      sim?.togglePause(true);
    },
    openCountrySelect: () => {
      sim?.togglePause(true);
      activeDrawerSig.value = null;
      selectedCountrySig.value = simPlayerTagSig.value;
      screenModeSig.value = 'country_select';
      stage?.setArmyVisible(false);
      stage?.highlightCountry(simPlayerTagSig.value, false);
    },
    setSpeed: (speed) => {
      sim?.setSpeed(speed);
    },
    togglePause: (paused) => {
      sim?.togglePause(paused);
    },
    toggleDrawer: (tab) => {
      activeDrawerSig.value = tab;
    },
    queueConstruction: (regionId, building) => {
      sim?.queueConstruction(regionId, building);
    },
    cancelConstruction: (projectId) => {
      sim?.cancelConstruction(projectId);
    },
    reorderConstruction: (projectId, direction) => {
      sim?.reorderConstruction(projectId, direction);
    },
    setLineFactories: (eqType, factories) => {
      sim?.setLineFactories(eqType, factories);
    },
    switchProductionLine: (fromType, toType, count) => {
      sim?.switchProductionLine(fromType, toType, count);
    },
    toggleAutoTrade: (enabled) => {
      sim?.toggleAutoTrade(enabled);
    },
    setGovernanceLaw: (slot, lawId) => {
      sim?.setGovernanceLaw(slot, lawId);
    },
    startResearch: (techId, slotIndex) => {
      sim?.startResearch(techId, slotIndex);
    },
    cancelResearch: (slotIndex) => {
      sim?.cancelResearch(slotIndex);
    },
    setOrderToolMode: (mode) => {
      orderToolModeSig.value = mode;
      stage?.setOrderToolMode(mode);
    },
    selectBrigades: (ids, armyId) => {
      selectedBrigadeIdsSig.value = ids;
      if (armyId !== undefined) selectedArmyIdSig.value = armyId;
      const army = simArmySig.value;
      if (army && stage) {
        stage.updateArmyOverlay(
          army.armies,
          army.brigades,
          selectedBrigadeIdsSig.value,
          selectedArmyIdSig.value,
          simCombatSig.value,
          selectedBattleProvIdSig.value,
        );
      }
    },
    queueTraining: (template, deployProvId, armyId) => {
      sim?.queueTraining(template, deployProvId, armyId);
    },
    cancelTraining: (orderId) => {
      sim?.cancelTraining(orderId);
    },
    createArmy: (nameZh) => {
      sim?.createArmy(nameZh);
    },
    disbandArmy: (armyId) => {
      sim?.disbandArmy(armyId);
    },
    assignBrigadeArmy: (brigadeId, armyId) => {
      sim?.assignBrigadeArmy(brigadeId, armyId);
    },
    marchBrigades: (brigadeIds, targetProvId) => {
      sim?.marchBrigades(brigadeIds, targetProvId);
    },
    unlockManualOverride: (brigadeId) => {
      sim?.unlockManualOverride(brigadeId);
    },
    bindFrontline: (armyId, targetTag) => {
      sim?.bindFrontline(armyId, targetTag);
    },
    clearFrontline: (armyId) => {
      sim?.clearFrontline(armyId);
    },
    setOffensiveArrow: (armyId, startProvId, targetProvId, bendX, bendY) => {
      sim?.setOffensiveArrow(armyId, startProvId, targetProvId, bendX, bendY);
    },
    clearOffensiveArrow: (armyId) => {
      sim?.clearOffensiveArrow(armyId);
    },
    toggleArrowActive: (armyId, active) => {
      sim?.toggleArrowActive(armyId, active);
    },
    assignCommander: (armyId, commanderId) => {
      sim?.assignCommander(armyId, commanderId);
    },
    toggleArmyMotorizedSupply: (armyId, enabled) => {
      sim?.toggleArmyMotorizedSupply(armyId, enabled);
    },
    toggleColorblindMode: (enabled) => {
      const next = typeof enabled === 'boolean' ? enabled : !colorblindModeSig.value;
      colorblindModeSig.value = next;
      stage?.setColorblind(next);
    },
    openBattleReport: (provId) => {
      selectedBattleProvIdSig.value = provId;
      activeDrawerSig.value = 'battle';
      syncArmyStage();
    },
  };

  const uiRoot = document.getElementById('ui-root');
  if (uiRoot) {
    render(<AppShell actions={actions} />, uiRoot);
  }

  const syncArmyStage = () => {
    const army = simArmySig.value;
    if (!army || !stage) return;
    stage.setPlayerTag(simPlayerTagSig.value);
    stage.updateArmyOverlay(
      army.armies,
      army.brigades,
      selectedBrigadeIdsSig.value,
      selectedArmyIdSig.value,
      simCombatSig.value,
      selectedBattleProvIdSig.value,
    );
  };

  try {
    sim = new SimClient({
      onSnapshot: (snap, dispatches, industry, governance, tech, army, combat, logistics) => {
        applyWorldSnapshot(snap, dispatches, industry, governance, tech, army, combat, logistics);
        if (industry && stage) {
          stage.updateIndustryRegions(industry.regions);
        }
        if (army && stage) {
          syncArmyStage();
        }
        if (stage && (snap.supplyByProv || logistics)) {
          stage.updateSupplyOverlay(
            snap.supplyByProv ?? simSupplyByProvSig.value,
            logistics?.allHubs ?? null,
            snap.tick,
          );
        }
      },
    });

    const initialPaused =
      harness.paused !== null ? harness.paused : harness.autotest || harness.screen === 'country_select';
    const initialSpeed = harness.speed ?? 2;

    const [, bundle] = await Promise.all([
      loadMeridianFonts(),
      loadEurope1936Map(),
      sim.initScenario({
        scenarioId: harness.scenario,
        countryTag: initialTag,
        seed: harness.seed,
        startDate: harness.date ?? undefined,
        fastForwardTicks: harness.tick ?? undefined,
        paused: initialPaused,
        speed: initialSpeed,
        autoTrade: harness.autotrade ?? undefined,
        initialQueue: harness.queue.length > 0 ? harness.queue : undefined,
        crisisPermille: harness.crisisPermille ?? undefined,
        playerAp: harness.ap ?? undefined,
        playerMobilizationPermille: harness.mobilizationPermille ?? undefined,
        playerAtWar: harness.atWar || undefined,
        playerAtWarWithMajor: harness.atWarMajor || undefined,
        playerHomelandInvaded: harness.homelandInvaded || undefined,
        playerArmyInferior: harness.armyInferior || undefined,
        initialLaws: harness.laws.length > 0 ? harness.laws : undefined,
        initialResearch: harness.research.length > 0 ? harness.research : undefined,
        demoFrontline: harness.demoFrontline ?? undefined,
        mockWar: harness.mockWar ?? undefined,
        initialTraining: harness.train.length > 0 ? harness.train.map((template) => ({ template })) : undefined,
      }),
    ]);

    mapCountsSig.value = { land: bundle.meta.landCount, sea: bundle.meta.seaCount };

    const mapRoot = document.getElementById('map-root');
    if (!mapRoot) throw new Error('#map-root element missing');

    const resolveActiveArmyId = (): number | null => {
      const cur = selectedArmyIdSig.value;
      const armySnap = simArmySig.value;
      if (!armySnap) return null;
      const ownArmies = armySnap.armies.filter((a) => a.owner === simPlayerTagSig.value);
      if (cur !== null && ownArmies.some((a) => a.id === cur)) return cur;
      return ownArmies[0]?.id ?? null;
    };

    stage = await MapStage.create(mapRoot, bundle, {
      onHoverProvince: (p) => {
        hoveredProvSig.value = p;
      },
      onSelectProvince: (p) => {
        if (screenModeSig.value === 'country_select') {
          if (p && !p.isSea && isPlayableTag(p.owner)) {
            actions.previewCountry(p.owner, false);
          }
          return;
        }
        selectedProvSig.value = p;
      },
      onCameraChange: (cam) => {
        cameraSig.value = cam;
      },
      onClickCounter: (hit) => {
        if (screenModeSig.value !== 'game') return;
        if (hit.owner === simPlayerTagSig.value) {
          actions.selectBrigades(hit.brigadeIds, hit.armyId);
        }
        stage?.selectProvince(hit.provinceId);
      },
      onClickBattle: (battle) => {
        if (screenModeSig.value !== 'game') return;
        actions.openBattleReport(battle.provinceId);
      },
      onMarqueeSelect: (ids) => {
        if (screenModeSig.value !== 'game') return;
        const first = simArmySig.value?.brigades.find((b) => ids.includes(b.id));
        actions.selectBrigades(ids, first?.armyId ?? null);
      },
      onRightClickProvince: (prov) => {
        if (screenModeSig.value !== 'game') return;
        const pTag = simPlayerTagSig.value;
        const selIds = selectedBrigadeIdsSig.value;
        const combat = simCombatSig.value;
        const occ = combat?.occupiedProvinces.find((o) => o.provId === prov.id);
        const ctrl = occ ? occ.controller : prov.owner;
        const isEnemy = combat?.wars.some(([a, b]) => (a === pTag && b === ctrl) || (b === pTag && a === ctrl)) ?? false;
        if ((ctrl === pTag || isEnemy) && selIds.length > 0) {
          actions.marchBrigades(selIds, prov.id);
        } else if (ctrl !== pTag) {
          const aid = resolveActiveArmyId();
          if (aid !== null) actions.bindFrontline(aid, ctrl);
        }
      },
      onOrderClickProvince: (prov) => {
        if (screenModeSig.value !== 'game') return;
        const mode = orderToolModeSig.value;
        const pTag = simPlayerTagSig.value;
        if (mode === 'march') {
          const selIds = selectedBrigadeIdsSig.value;
          if (selIds.length > 0 && prov.owner === pTag) actions.marchBrigades(selIds, prov.id);
        } else if (mode === 'frontline' && prov.owner !== pTag) {
          const aid = resolveActiveArmyId();
          if (aid !== null) {
            actions.bindFrontline(aid, prov.owner);
            actions.setOrderToolMode('select');
          }
        } else if (mode === 'arrow' && prov.owner !== pTag) {
          const aid = resolveActiveArmyId();
          if (aid !== null) {
            actions.setOffensiveArrow(aid, null, prov.id);
            actions.setOrderToolMode('select');
          }
        }
      },
      onArrowDragComplete: (startProv, endProv) => {
        if (screenModeSig.value !== 'game') return;
        const aid = resolveActiveArmyId();
        if (aid !== null && endProv.owner !== simPlayerTagSig.value) {
          const startId = startProv.owner === simPlayerTagSig.value ? startProv.id : null;
          actions.setOffensiveArrow(aid, startId, endProv.id);
          actions.setOrderToolMode('select');
        }
      },
    });

    stage.setAutotest(harness.autotest);
    stage.setColorblind(harness.colorblind);
    stage.setPlayerTag(initialTag);
    stage.setArmyVisible(harness.screen === 'game');
    if (simIndustrySig.value) {
      stage.updateIndustryRegions(simIndustrySig.value.regions);
    }
    stage.updateSupplyOverlay(
      simSupplyByProvSig.value,
      simLogisticsSig.value?.allHubs ?? null,
      simTickSig.value,
    );
    if (harness.motorized && simArmySig.value) {
      const firstArmy = simArmySig.value.armies.find((a) => a.owner === initialTag);
      if (firstArmy) sim?.toggleArmyMotorizedSupply(firstArmy.id, true);
    }
    if (harness.selectArmy !== null && simArmySig.value) {
      const own = simArmySig.value.armies.filter((a) => a.owner === initialTag);
      const picked = own[harness.selectArmy - 1] ?? own[0];
      if (picked) {
        selectedArmyIdSig.value = picked.id;
        selectedBrigadeIdsSig.value = picked.brigadeIds;
      }
    }
    if (harness.panel === 'battle' && simCombatSig.value && simCombatSig.value.battles.length > 0) {
      selectedBattleProvIdSig.value = simCombatSig.value.battles[0]!.provinceId;
    }
    syncArmyStage();

    actions.setMode(harness.mapmode);
    if (harness.cam) {
      stage.setCamera(harness.cam.x, harness.cam.y, harness.cam.zoom);
    } else if (harness.screen === 'country_select') {
      // Frame continental Europe cleanly beside the right dossier folder
      stage.setCamera(1880, 1615, 0.50);
      stage.highlightCountry(initialTag, false);
    } else if (harness.mapmode === 'industry' && initialTag === 'GER') {
      // Frame Ruhr, Rhine, Berlin & Silesia cleanly to the left of the 380px F3 drawer
      stage.setCamera(1740, 1595, 1.32);
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
        tick: simTickSig.value,
        playerTag: simPlayerTagSig.value,
        screen: screenModeSig.value,
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
