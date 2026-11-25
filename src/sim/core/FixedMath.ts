/**
 * Deterministic 32-bit fixed-point arithmetic (permille scale = 1000).
 * Pure TypeScript — zero DOM/WebGL dependencies.
 */

export const FIXED_SCALE = 1000;
export const INT32_MAX = 2147483647;
export const INT32_MIN = -2147483648;

export function clampInt(v: number, min: number, max: number): number {
  const n = v | 0;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Convert integer or finite decimal to permille Int32 (e.g. 75.4 -> 75400 or 0.754 -> 754). */
export function toFixed(val: number): number {
  const scaled = Math.round(val * FIXED_SCALE);
  return clampInt(scaled, INT32_MIN, INT32_MAX);
}

export function fromFixed(fixedVal: number): number {
  return (fixedVal | 0) / FIXED_SCALE;
}

/** Deterministic fixed-point multiply: trunc((a * b) / 1000) without float drift. */
export function mulFixed(a: number, b: number): number {
  const ia = a | 0;
  const ib = b | 0;
  const prod = BigInt(ia) * BigInt(ib);
  const res = Number(prod / BigInt(FIXED_SCALE));
  return clampInt(res, INT32_MIN, INT32_MAX);
}

/** Deterministic fixed-point divide: trunc((a * 1000) / b). Returns 0 on div-by-zero. */
export function divFixed(a: number, b: number): number {
  const ib = b | 0;
  if (ib === 0) return 0;
  const ia = a | 0;
  const res = Number((BigInt(ia) * BigInt(FIXED_SCALE)) / BigInt(ib));
  return clampInt(res, INT32_MIN, INT32_MAX);
}

/** Linear blend in permille: a + (b - a) * tPermille / 1000 */
export function lerpFixed(a: number, b: number, tPermille: number): number {
  const t = clampInt(tPermille, 0, FIXED_SCALE);
  return (a | 0) + mulFixed((b | 0) - (a | 0), t);
}

/** Format permille value (0..1000 -> "0%".."100%", with optional 1 decimal). */
export function formatPermillePct(permille: number, decimals = 0): string {
  const pct = (permille | 0) / 10;
  return `${pct.toFixed(decimals)}%`;
}

/** Format fixed-point scalar (e.g. 120500 -> "120.5" or "120"). */
export function formatFixedNum(fixedVal: number, decimals = 1): string {
  return ((fixedVal | 0) / FIXED_SCALE).toFixed(decimals);
}
