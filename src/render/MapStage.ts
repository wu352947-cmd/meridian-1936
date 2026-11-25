import {
  Application,
  BufferImageSource,
  Container,
  Graphics,
  ImageSource,
  Mesh,
  MeshGeometry,
  Shader,
} from 'pixi.js';
import type { EuropeMapMeta, MapMode, ProvinceRecord } from '../types/map';
import type { LoadedMapBundle } from './loadMapData';
import { BorderMeshBuilder } from './BorderMeshBuilder';
import { CombatBubbleLayer } from './CombatBubbleLayer';
import { CurvedLabelLayer } from './CurvedLabelLayer';
import { FrontlineArrowLayer } from './FrontlineArrowLayer';
import { IndustryOverlayLayer } from './IndustryOverlayLayer';
import { PocketLayer } from './PocketLayer';
import { SupplyOverlayLayer } from './SupplyOverlayLayer';
import { TerrainDetailLayer } from './TerrainDetailLayer';
import { UnitCounterLayer, type CounterHitItem } from './UnitCounterLayer';
import { buildOwnerIndexMap, fillProvinceLuts } from './lutPalette';
import { createProvinceLutShader } from './shaders/provinceLut';
import type { ArmySnap, BrigadeSnap } from '../sim/systems/armyTypes';
import type { CombatSystemSnapshot, ProvinceBattleSnap } from '../sim/systems/combatTypes';
import type { RegionDynamicSnap } from '../sim/systems/industryTypes';
import type { ActiveSupplyHubSnap } from '../sim/systems/supplyTypes';
import type { OrderToolMode } from '../ui/store/simStore';

export interface MapStageCallbacks {
  onHoverProvince: (prov: ProvinceRecord | null) => void;
  onSelectProvince: (prov: ProvinceRecord | null) => void;
  onCameraChange: (cam: { x: number; y: number; zoom: number }) => void;
  onClickCounter?: (hit: CounterHitItem) => void;
  onClickBattle?: (battle: ProvinceBattleSnap) => void;
  onMarqueeSelect?: (brigadeIds: number[]) => void;
  onRightClickProvince?: (prov: ProvinceRecord) => void;
  onOrderClickProvince?: (prov: ProvinceRecord) => void;
  onArrowDragComplete?: (startProv: ProvinceRecord, endProv: ProvinceRecord) => void;
}

const MODE_NUM: Record<MapMode, number> = {
  political: 0,
  terrain: 1,
  supply: 2,
  diplomacy: 3,
  industry: 4,
  air_sea: 5,
};

export class MapStage {
  private readonly app: Application;
  private readonly world = new Container();
  private readonly meta: EuropeMapMeta;
  private readonly provById = new Map<number, ProvinceRecord>();
  private readonly ownerIdx: Map<string, number>;
  private readonly pickGrid: Uint16Array;
  private readonly pickW: number;
  private readonly pickH: number;

  private readonly primaryBuf = new Uint8Array(4096 * 4);
  private readonly secondaryBuf = new Uint8Array(4096 * 4);
  private readonly occupierBuf = new Uint8Array(4096 * 4);
  private readonly primaryLutSrc: BufferImageSource;
  private readonly secondaryLutSrc: BufferImageSource;
  private readonly occupierLutSrc: BufferImageSource;
  private readonly lutShader: Shader;
  private readonly terrainDetails: TerrainDetailLayer;
  private readonly borders: BorderMeshBuilder;
  private readonly frontlines: FrontlineArrowLayer;
  private readonly pockets: PocketLayer;
  private readonly labels: CurvedLabelLayer;
  private readonly industryOverlay: IndustryOverlayLayer;
  private readonly supplyOverlay: SupplyOverlayLayer;
  private readonly counters: UnitCounterLayer;
  private readonly combatBubbles: CombatBubbleLayer;
  private readonly marqueeG = new Graphics();
  private readonly cbs: MapStageCallbacks;

  private mapMode: MapMode = 'political';
  private colorblind = false;
  private simTick = 0;
  private supplyByProv: Uint8Array | null = null;
  private orderToolMode: OrderToolMode = 'select';
  private playerTag = 'GER';
  private autotest = false;
  private selectedProvId: number | null = null;
  private selectedOwner: string | null = null;
  private hoveredProvId: number | null = null;
  private regionsById = new Map<number, RegionDynamicSnap>();
  private controllerByProv = new Map<number, string>();

  // Camera state: world point centered in viewport + zoom scale
  private camX = 1880;
  private camY = 1580;
  private zoom = 0.62;
  private readonly minZoom = 0.38;
  private readonly maxZoom = 5.5;

  // Drag / marquee / arrow draw state
  private dragging = false;
  private dragMoved = false;
  private marqueeActive = false;
  private marqueeStartX = 0;
  private marqueeStartY = 0;
  private arrowStartProvId: number | null = null;
  private lastPtrX = 0;
  private lastPtrY = 0;

  private constructor(app: Application, bundle: LoadedMapBundle, cbs: MapStageCallbacks) {
    this.app = app;
    this.meta = bundle.meta;
    this.pickGrid = bundle.pickGrid;
    this.pickW = bundle.pickWidth;
    this.pickH = bundle.pickHeight;
    this.cbs = cbs;

    for (const p of this.meta.provinces) this.provById.set(p.id, p);
    this.ownerIdx = buildOwnerIndexMap(this.meta.provinces);

    // 1. Upload bit-exact province_id texture (NEAREST, NO premultiplyAlpha, NO mipmaps!)
    const provIdSrc = new BufferImageSource({
      resource: bundle.provIdBytes,
      width: this.meta.width,
      height: this.meta.height,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
      autoGenerateMipmaps: false,
      addressMode: 'clamp-to-edge',
    });

    const reliefSrc = new ImageSource({
      resource: bundle.reliefBitmap,
      scaleMode: 'linear',
      addressMode: 'clamp-to-edge',
    });

    this.primaryLutSrc = new BufferImageSource({
      resource: this.primaryBuf,
      width: 4096,
      height: 1,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
      autoGenerateMipmaps: false,
      addressMode: 'clamp-to-edge',
    });

    this.secondaryLutSrc = new BufferImageSource({
      resource: this.secondaryBuf,
      width: 4096,
      height: 1,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
      autoGenerateMipmaps: false,
      addressMode: 'clamp-to-edge',
    });

    this.occupierLutSrc = new BufferImageSource({
      resource: this.occupierBuf,
      width: 4096,
      height: 1,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      alphaMode: 'no-premultiply-alpha',
      autoGenerateMipmaps: false,
      addressMode: 'clamp-to-edge',
    });

    this.lutShader = createProvinceLutShader(
      provIdSrc,
      reliefSrc,
      this.primaryLutSrc,
      this.secondaryLutSrc,
      this.occupierLutSrc,
      this.meta.width,
      this.meta.height,
    );

    const w = this.meta.width;
    const h = this.meta.height;
    const geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, w, 0, w, h, 0, h]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    const mapMesh = new Mesh({ geometry, shader: this.lutShader });
    this.terrainDetails = new TerrainDetailLayer(this.meta, this.pickGrid, this.pickW, this.pickH);
    this.borders = new BorderMeshBuilder(this.meta, bundle.topology, this.pickGrid, this.pickW, this.pickH);
    this.frontlines = new FrontlineArrowLayer(
      this.meta,
      this.borders.getDecodedArcs(),
      this.pickGrid,
      this.pickW,
      this.pickH,
    );
    this.pockets = new PocketLayer(this.borders.getDecodedArcs());
    this.labels = new CurvedLabelLayer(this.meta);
    this.industryOverlay = new IndustryOverlayLayer();
    this.supplyOverlay = new SupplyOverlayLayer(this.borders.getDecodedArcs());
    this.counters = new UnitCounterLayer(this.meta);
    this.combatBubbles = new CombatBubbleLayer(this.meta);

    this.world.addChild(
      mapMesh,
      this.terrainDetails.root,
      this.borders.root,
      this.supplyOverlay.contourRoot,
      this.frontlines.root,
      this.pockets.root,
      this.labels.root,
      this.industryOverlay.root,
      this.supplyOverlay.root,
    );
    this.app.stage.addChild(this.world, this.counters.root, this.combatBubbles.root, this.marqueeG);

    this.app.ticker.add((t) => {
      if (!this.autotest) this.frontlines.advanceFlow(t.deltaMS / 1000);
    });

    this.refreshLuts();
    this.fitOverviewCamera();
    this.bindInput();
  }

  static async create(container: HTMLElement, bundle: LoadedMapBundle, cbs: MapStageCallbacks): Promise<MapStage> {
    const app = new Application();
    await app.init({
      preference: 'webgl',
      backgroundColor: 0x2b3d4f,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      resizeTo: container,
      preserveDrawingBuffer: true,
    });
    container.innerHTML = '';
    container.appendChild(app.canvas);
    return new MapStage(app, bundle, cbs);
  }

  fitOverviewCamera(): void {
    const vw = this.app.screen.width || 1440;
    const vh = this.app.screen.height || 900;
    const fitZ = Math.max(vw / this.meta.width, vh / this.meta.height) * 1.12;
    this.setCamera(1780, 1590, Math.max(0.42, Math.min(1.15, fitZ)));
  }

  setCamera(x: number, y: number, zoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    const vw = this.app.screen.width || 1440;
    const vh = this.app.screen.height || 900;
    const halfW = (vw * 0.5) / this.zoom;
    const halfH = (vh * 0.5) / this.zoom;

    const minX = Math.min(this.meta.width * 0.5, halfW);
    const maxX = Math.max(this.meta.width * 0.5, this.meta.width - halfW);
    const minY = Math.min(this.meta.height * 0.5, halfH);
    const maxY = Math.max(this.meta.height * 0.5, this.meta.height - halfH);

    this.camX = Math.max(minX, Math.min(maxX, x));
    this.camY = Math.max(minY, Math.min(maxY, y));

    this.world.scale.set(this.zoom);
    this.world.position.set(
      vw * 0.5 - this.camX * this.zoom,
      vh * 0.5 - this.camY * this.zoom,
    );

    this.lutShader.resources.mapUniforms.uniforms.uZoom = this.zoom;
    this.terrainDetails.updateLod(this.zoom);
    this.borders.updateLod(this.zoom);
    const view = {
      minX: this.camX - halfW,
      minY: this.camY - halfH,
      maxX: this.camX + halfW,
      maxY: this.camY + halfH,
      vw,
      vh,
    };
    this.labels.updateLod(this.zoom, view);
    this.pockets.updateLod(this.zoom);
    this.industryOverlay.updateLod(this.zoom, view);
    this.supplyOverlay.updateLod(this.zoom, view);
    this.counters.updateCamera(this.camX, this.camY, this.zoom, vw, vh);
    this.combatBubbles.setAvoidContext(
      this.counters.getPlacedScreenBoxes(),
      this.counters.getPlacedCentersByProvince(),
      this.labels.getPlacedScreenBoxes(),
    );
    this.combatBubbles.updateCamera(this.camX, this.camY, this.zoom, vw, vh);
    this.frontlines.updateLod(
      this.zoom,
      { zoom: this.zoom, minX: view.minX, minY: view.minY, vw, vh },
      [
        ...this.labels.getPlacedScreenBoxes(),
        ...this.counters.getPlacedScreenBoxes(),
        ...this.combatBubbles.getPlacedScreenBoxes(),
      ],
    );
    this.cbs.onCameraChange({ x: this.camX, y: this.camY, zoom: this.zoom });
  }

  zoomBy(factor: number, screenX?: number, screenY?: number): void {
    const vw = this.app.screen.width || 1440;
    const vh = this.app.screen.height || 900;
    const sx = screenX ?? vw * 0.5;
    const sy = screenY ?? vh * 0.5;
    const beforeX = (sx - this.world.position.x) / this.zoom;
    const beforeY = (sy - this.world.position.y) / this.zoom;
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const nextCamX = beforeX - (sx - vw * 0.5) / nextZoom;
    const nextCamY = beforeY - (sy - vh * 0.5) / nextZoom;
    this.setCamera(nextCamX, nextCamY, nextZoom);
  }

  setMapMode(mode: MapMode): void {
    this.mapMode = mode;
    this.lutShader.resources.mapUniforms.uniforms.uMode = MODE_NUM[mode];
    this.industryOverlay.setMapMode(mode);
    this.supplyOverlay.setMapMode(mode);
    this.refreshLuts();
  }

  setColorblind(enabled: boolean): void {
    this.colorblind = enabled;
    this.lutShader.resources.mapUniforms.uniforms.uColorblind = enabled ? 1.0 : 0.0;
    this.refreshLuts();
  }

  updateSupplyOverlay(
    supplyByProv: Uint8Array | null,
    hubs: readonly ActiveSupplyHubSnap[] | null,
    simTick: number,
  ): void {
    this.simTick = simTick;
    if (supplyByProv) {
      this.supplyByProv = supplyByProv;
      this.supplyOverlay.updateContours(supplyByProv, this.controllerByProv);
    }
    if (hubs) this.supplyOverlay.rebuildHubs(hubs, this.playerTag);
    this.refreshLuts();
  }

  updateIndustryRegions(regions: readonly RegionDynamicSnap[]): void {
    this.regionsById = new Map(regions.map((r) => [r.id, r]));
    this.industryOverlay.rebuildFromRegions(regions);
    this.refreshLuts();
  }

  setAutotest(flag: boolean): void {
    this.autotest = flag;
  }

  setPlayerTag(tag: string): void {
    this.playerTag = tag;
  }

  setOrderToolMode(mode: OrderToolMode): void {
    this.orderToolMode = mode;
    this.arrowStartProvId = null;
    this.frontlines.setArrowPreview(null);
    this.app.canvas.style.cursor = mode === 'select' ? 'grab' : 'crosshair';
  }

  setArmyVisible(visible: boolean): void {
    this.frontlines.setVisible(visible);
    this.pockets.setVisible(visible);
    this.counters.setVisible(visible);
    this.combatBubbles.setVisible(visible);
  }

  updateArmyOverlay(
    armies: ArmySnap[],
    brigades: BrigadeSnap[],
    selectedBrigadeIds: readonly number[],
    selectedArmyId: number | null,
    combat?: CombatSystemSnapshot | null,
    selectedBattleProvId: number | null = null,
  ): void {
    const pocketProvs = new Set<number>();
    if (combat) {
      this.controllerByProv = new Map(combat.occupiedProvinces.map((o) => [o.provId, o.controller]));
      for (const pk of combat.pockets) for (const pid of pk.provinceIds) pocketProvs.add(pid);
      this.supplyOverlay.updateContours(this.supplyByProv, this.controllerByProv);
      this.refreshLuts();
      this.counters.setDiplomacyContext(this.playerTag, combat.wars);
      this.pockets.setData(combat.pockets);
    } else {
      this.counters.setDiplomacyContext(this.playerTag, []);
    }
    this.counters.setData(armies, brigades, selectedBrigadeIds, selectedArmyId);
    if (combat) {
      this.combatBubbles.setAvoidContext(
        this.counters.getPlacedScreenBoxes(),
        this.counters.getPlacedCentersByProvince(),
        this.labels.getPlacedScreenBoxes(),
      );
      this.combatBubbles.setData(combat.battles, this.playerTag, selectedBattleProvId);
    }
    this.frontlines.setData(armies, brigades, selectedArmyId, this.controllerByProv, this.playerTag, pocketProvs);
    const vw = this.app.screen.width || 1440;
    const vh = this.app.screen.height || 900;
    const halfW = (vw * 0.5) / this.zoom;
    const halfH = (vh * 0.5) / this.zoom;
    this.frontlines.updateLod(
      this.zoom,
      { zoom: this.zoom, minX: this.camX - halfW, minY: this.camY - halfH, vw, vh },
      [
        ...this.labels.getPlacedScreenBoxes(),
        ...this.counters.getPlacedScreenBoxes(),
        ...this.combatBubbles.getPlacedScreenBoxes(),
      ],
    );
  }

  selectProvince(provId: number | null): void {
    const prov = provId ? (this.provById.get(provId) ?? null) : null;
    this.selectedProvId = prov ? prov.id : null;
    this.selectedOwner = prov && !prov.isSea ? prov.owner : null;
    this.borders.setSelection(this.selectedOwner, this.selectedProvId);
    this.borders.setHover(this.hoveredProvId);
    this.refreshLuts();
    this.cbs.onSelectProvince(prov);
  }

  hoverProvince(provId: number | null): void {
    if (this.hoveredProvId === provId) return;
    this.hoveredProvId = provId;
    this.borders.setHover(this.hoveredProvId);
    this.refreshLuts();
    const prov = provId ? (this.provById.get(provId) ?? null) : null;
    this.cbs.onHoverProvince(prov);
  }

  getCamera(): { x: number; y: number; zoom: number } {
    return { x: this.camX, y: this.camY, zoom: this.zoom };
  }

  getProvinceById(id: number): ProvinceRecord | null {
    return this.provById.get(id) ?? null;
  }

  /** Highlight a country's border & capital on the map without breaking map interaction. */
  highlightCountry(tag: string | null, panToCapital = false, targetZoom?: number): void {
    if (!tag) {
      this.selectProvince(null);
      return;
    }
    const provs = this.meta.provinces.filter((p) => !p.isSea && p.owner === tag);
    if (provs.length === 0) return;
    const cap = provs.find((p) => p.isCapital) ?? provs.reduce((a, b) => (b.vp > a.vp ? b : a), provs[0]!);
    this.selectedProvId = null;
    this.selectedOwner = tag;
    this.borders.setSelection(tag, null);
    this.refreshLuts();
    if (panToCapital) {
      this.setCamera(cap.cx, cap.cy, targetZoom ?? Math.max(this.zoom, 1.05));
    }
  }

  renderNow(): void {
    this.app.render();
  }

  private refreshLuts(): void {
    fillProvinceLuts({
      provinces: this.meta.provinces,
      ownerIdx: this.ownerIdx,
      mode: this.mapMode,
      selectedProvId: this.selectedProvId,
      selectedOwner: this.selectedOwner,
      hoveredProvId: this.hoveredProvId,
      regionsById: this.regionsById,
      controllerByProv: this.controllerByProv,
      supplyByProv: this.supplyByProv,
      colorblind: this.colorblind,
      simTick: this.simTick,
      primaryBuf: this.primaryBuf,
      secondaryBuf: this.secondaryBuf,
      occupierBuf: this.occupierBuf,
    });
    this.primaryLutSrc.update();
    this.secondaryLutSrc.update();
    this.occupierLutSrc.update();
  }

  /** O(1) pixel-perfect province picking via 2x downsampled Uint16Array grid. */
  private pickAtScreen(clientX: number, clientY: number): number | null {
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - this.world.position.x) / this.zoom;
    const wy = (sy - this.world.position.y) / this.zoom;
    const gx = Math.floor(wx * 0.5);
    const gy = Math.floor(wy * 0.5);
    if (gx < 0 || gx >= this.pickW || gy < 0 || gy >= this.pickH) return null;
    const pid = this.pickGrid[gy * this.pickW + gx] ?? 0;
    return pid > 0 ? pid : null;
  }

  private bindInput(): void {
    const canvas = this.app.canvas;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.button === 2) {
        const pid = this.pickAtScreen(e.clientX, e.clientY);
        const prov = pid ? (this.provById.get(pid) ?? null) : null;
        if (prov && !prov.isSea) this.cbs.onRightClickProvince?.(prov);
        return;
      }
      if (e.button !== 0) return;

      if (this.orderToolMode === 'arrow') {
        const pid = this.pickAtScreen(e.clientX, e.clientY);
        if (pid) {
          this.arrowStartProvId = pid;
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      if (e.shiftKey && this.orderToolMode === 'select') {
        this.marqueeActive = true;
        this.marqueeStartX = sx;
        this.marqueeStartY = sy;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      this.dragging = true;
      this.dragMoved = false;
      this.lastPtrX = e.clientX;
      this.lastPtrY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.arrowStartProvId !== null) {
        const pid = this.pickAtScreen(e.clientX, e.clientY);
        if (pid && pid !== this.arrowStartProvId) {
          this.frontlines.setArrowPreview({
            startProvId: this.arrowStartProvId,
            targetProvId: pid,
            color: '#C84B31',
          });
        }
        return;
      }

      if (this.marqueeActive) {
        this.marqueeG.clear();
        const x = Math.min(this.marqueeStartX, sx);
        const y = Math.min(this.marqueeStartY, sy);
        const w = Math.abs(sx - this.marqueeStartX);
        const h = Math.abs(sy - this.marqueeStartY);
        this.marqueeG.rect(x, y, w, h).fill({ color: 0xe2be74, alpha: 0.16 }).stroke({ width: 1.4, color: 0xf2c86b });
        return;
      }

      if (this.dragging) {
        const dx = e.clientX - this.lastPtrX;
        const dy = e.clientY - this.lastPtrY;
        if (Math.hypot(dx, dy) > 3) this.dragMoved = true;
        this.lastPtrX = e.clientX;
        this.lastPtrY = e.clientY;
        this.setCamera(this.camX - dx / this.zoom, this.camY - dy / this.zoom, this.zoom);
      } else {
        const pid = this.pickAtScreen(e.clientX, e.clientY);
        this.hoverProvince(pid);
      }
    });

    const endDrag = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.arrowStartProvId !== null) {
        const startProv = this.provById.get(this.arrowStartProvId) ?? null;
        const endPid = this.pickAtScreen(e.clientX, e.clientY);
        const endProv = endPid ? (this.provById.get(endPid) ?? null) : null;
        this.arrowStartProvId = null;
        this.frontlines.setArrowPreview(null);
        if (startProv && endProv && !endProv.isSea && startProv.id !== endProv.id) {
          this.cbs.onArrowDragComplete?.(startProv, endProv);
        } else if (endProv && !endProv.isSea) {
          this.cbs.onOrderClickProvince?.(endProv);
        }
        return;
      }

      if (this.marqueeActive) {
        this.marqueeActive = false;
        this.marqueeG.clear();
        const ids = this.counters.hitTestMarquee(this.marqueeStartX, this.marqueeStartY, sx, sy, this.playerTag);
        this.cbs.onMarqueeSelect?.(ids);
        return;
      }

      if (!this.dragging) return;
      this.dragging = false;
      canvas.style.cursor = this.orderToolMode === 'select' ? 'grab' : 'crosshair';
      if (!this.dragMoved) {
        if (this.orderToolMode !== 'select') {
          const pid = this.pickAtScreen(e.clientX, e.clientY);
          const prov = pid ? (this.provById.get(pid) ?? null) : null;
          if (prov && !prov.isSea) this.cbs.onOrderClickProvince?.(prov);
          return;
        }
        const battleHit = this.combatBubbles.hitTestPoint(sx, sy);
        if (battleHit && this.cbs.onClickBattle) {
          this.cbs.onClickBattle(battleHit);
          return;
        }
        const hit = this.counters.hitTestPoint(sx, sy);
        if (hit && this.cbs.onClickCounter) {
          this.cbs.onClickCounter(hit);
          return;
        }
        const pid = this.pickAtScreen(e.clientX, e.clientY);
        this.selectProvince(pid === this.selectedProvId ? null : pid);
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
      if (!this.dragging) this.hoverProvince(null);
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        this.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
      },
      { passive: false },
    );

    window.addEventListener('resize', () => {
      this.setCamera(this.camX, this.camY, this.zoom);
    });
  }
}
