import {
  Application,
  BufferImageSource,
  Container,
  ImageSource,
  Mesh,
  MeshGeometry,
  Shader,
} from 'pixi.js';
import type { EuropeMapMeta, MapMode, ProvinceRecord } from '../types/map';
import type { LoadedMapBundle } from './loadMapData';
import { BorderMeshBuilder } from './BorderMeshBuilder';
import { CurvedLabelLayer } from './CurvedLabelLayer';
import { buildOwnerIndexMap, fillProvinceLuts } from './lutPalette';
import { createProvinceLutShader } from './shaders/provinceLut';

export interface MapStageCallbacks {
  onHoverProvince: (prov: ProvinceRecord | null) => void;
  onSelectProvince: (prov: ProvinceRecord | null) => void;
  onCameraChange: (cam: { x: number; y: number; zoom: number }) => void;
}

const MODE_NUM: Record<MapMode, number> = {
  political: 0,
  terrain: 1,
  diplomacy: 2,
  industry: 3,
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
  private readonly primaryLutSrc: BufferImageSource;
  private readonly secondaryLutSrc: BufferImageSource;
  private readonly lutShader: Shader;
  private readonly borders: BorderMeshBuilder;
  private readonly labels: CurvedLabelLayer;
  private readonly cbs: MapStageCallbacks;

  private mapMode: MapMode = 'political';
  private selectedProvId: number | null = null;
  private selectedOwner: string | null = null;
  private hoveredProvId: number | null = null;

  // Camera state: world point centered in viewport + zoom scale
  private camX = 1880;
  private camY = 1580;
  private zoom = 0.62;
  private readonly minZoom = 0.38;
  private readonly maxZoom = 5.5;

  // Drag state
  private dragging = false;
  private dragMoved = false;
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

    this.lutShader = createProvinceLutShader(
      provIdSrc,
      reliefSrc,
      this.primaryLutSrc,
      this.secondaryLutSrc,
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
    this.borders = new BorderMeshBuilder(this.meta, bundle.topology, this.pickGrid, this.pickW, this.pickH);
    this.labels = new CurvedLabelLayer(this.meta);

    this.world.addChild(mapMesh, this.borders.root, this.labels.root);
    this.app.stage.addChild(this.world);

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
    this.borders.updateLod(this.zoom);
    this.labels.updateLod(this.zoom);
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
    this.refreshLuts();
  }

  selectProvince(provId: number | null): void {
    const prov = provId ? (this.provById.get(provId) ?? null) : null;
    this.selectedProvId = prov ? prov.id : null;
    this.selectedOwner = prov && !prov.isSea ? prov.owner : null;
    this.borders.setSelection(this.selectedOwner, this.selectedProvId);
    this.refreshLuts();
    this.cbs.onSelectProvince(prov);
  }

  hoverProvince(provId: number | null): void {
    if (this.hoveredProvId === provId) return;
    this.hoveredProvId = provId;
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
      primaryBuf: this.primaryBuf,
      secondaryBuf: this.secondaryBuf,
    });
    this.primaryLutSrc.update();
    this.secondaryLutSrc.update();
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

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.dragMoved = false;
      this.lastPtrX = e.clientX;
      this.lastPtrY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
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
      if (!this.dragging) return;
      this.dragging = false;
      canvas.style.cursor = 'grab';
      if (!this.dragMoved) {
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
