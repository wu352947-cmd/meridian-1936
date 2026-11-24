import type { Topology } from 'topojson-specification';
import type { EuropeMapMeta } from '../types/map';

export interface LoadedMapBundle {
  meta: EuropeMapMeta;
  topology: Topology;
  provIdBytes: Uint8Array;
  pickGrid: Uint16Array;
  pickWidth: number;
  pickHeight: number;
  reliefBitmap: ImageBitmap;
}

/** Load compiled 1936 Europe map bundle + decode bit-exact province ID raster and 2x pick grid. */
export async function loadEurope1936Map(): Promise<LoadedMapBundle> {
  const base = `${import.meta.env.BASE_URL}data/europe_1936/`;

  const [metaResp, topoResp, idResp, reliefResp] = await Promise.all([
    fetch(`${base}europe_1936.json`),
    fetch(`${base}topology.topo.json`),
    fetch(`${base}province_id.png`),
    fetch(`${base}terrain_relief.webp`),
  ]);

  if (!metaResp.ok || !topoResp.ok || !idResp.ok || !reliefResp.ok) {
    throw new Error('Failed to load compiled Europe 1936 map assets');
  }

  const [meta, topology, idBlob, reliefBlob] = await Promise.all([
    metaResp.json() as Promise<EuropeMapMeta>,
    topoResp.json() as Promise<Topology>,
    idResp.blob(),
    reliefResp.blob(),
  ]);

  // Decode province_id.png without color-space or premultiplied-alpha distortion
  const [idBitmap, reliefBitmap] = await Promise.all([
    createImageBitmap(idBlob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
    createImageBitmap(reliefBlob),
  ]);

  const w = meta.width;
  const h = meta.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable for province_id decoding');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(idBitmap, 0, 0);
  idBitmap.close();

  const imgData = ctx.getImageData(0, 0, w, h);
  const provIdBytes = new Uint8Array(imgData.data.buffer);

  // Build 2x downsampled Uint16Array for O(1) pixel-perfect hover & click picking
  const pickWidth = w >> 1;
  const pickHeight = h >> 1;
  const pickGrid = new Uint16Array(pickWidth * pickHeight);
  for (let py = 0; py < pickHeight; py++) {
    const srcRow = (py << 1) * w;
    const dstRow = py * pickWidth;
    for (let px = 0; px < pickWidth; px++) {
      const off = (srcRow + (px << 1)) << 2;
      const r = provIdBytes[off] ?? 0;
      const g = provIdBytes[off + 1] ?? 0;
      pickGrid[dstRow + px] = r | (g << 8);
    }
  }

  return {
    meta,
    topology,
    provIdBytes,
    pickGrid,
    pickWidth,
    pickHeight,
    reliefBitmap,
  };
}
