import { signal } from '@preact/signals';
import type { MapMode, ProvinceRecord } from '../types/map';

export const mapModeSig = signal<MapMode>('political');
export const hoveredProvSig = signal<ProvinceRecord | null>(null);
export const selectedProvSig = signal<ProvinceRecord | null>(null);
export const cameraSig = signal<{ x: number; y: number; zoom: number }>({ x: 1880, y: 1560, zoom: 0.62 });
export const showCreditsSig = signal<boolean>(false);
export const mapReadySig = signal<boolean>(false);
export const loadErrorSig = signal<string | null>(null);
export const mapCountsSig = signal<{ land: number; sea: number }>({ land: 0, sea: 0 });

export interface MapActions {
  setMode: (mode: MapMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  clearSelection: () => void;
}
