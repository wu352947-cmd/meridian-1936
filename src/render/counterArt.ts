/**
 * Pure vector Pixi Graphics art for Original NATO-Inspired Cardstock Counters (44x28px),
 * LOD 0 Army Crest Badges, and compliant miniature neutral flags. Zero external textures.
 */
import { Graphics } from 'pixi.js';
import { getCountryInfo } from '../data/countries1936';
import type { BrigadeType } from '../sim/data/brigadeTemplates';
import type { SupplyStatus } from '../sim/systems/supplyTypes';

export const COUNTER_W = 46;
export const COUNTER_H = 31;
export const ARMY_BADGE_W = 56;
export const ARMY_BADGE_H = 24;

export type CounterRelation = 'own' | 'ally' | 'enemy' | 'neutral';

export function hexToInt(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isFinite(n) ? n : 0x5c5852;
}

/** Draw razor-sharp compliant miniature 3:2 flag inside (x, y, w, h). Zero swastika/SS/fasces. */
export function drawMiniFlag(g: Graphics, tag: string, x: number, y: number, w: number, h: number): void {
  const t = tag.toUpperCase();
  if (t === 'GER') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0x1c1c1c);
    g.rect(x, y + sh, w, sh).fill(0xf3efe6);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0xb52b27);
    // Straight-armed Balkenkreuz in center
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    g.rect(cx - 2.3, cy - 0.95, 4.6, 1.9).fill(0xf3efe6);
    g.rect(cx - 0.95, cy - 2.3, 1.9, 4.6).fill(0xf3efe6);
    g.rect(cx - 1.8, cy - 0.55, 3.6, 1.1).fill(0x181818);
    g.rect(cx - 0.55, cy - 1.8, 1.1, 3.6).fill(0x181818);
  } else if (t === 'POL') {
    g.rect(x, y, w, h * 0.5).fill(0xf3efe6);
    g.rect(x, y + h * 0.5, w, h * 0.5).fill(0xc42b3b);
  } else if (t === 'FRA') {
    const sw = w / 3;
    g.rect(x, y, sw, h).fill(0x1e3f7a);
    g.rect(x + sw, y, sw, h).fill(0xf3efe6);
    g.rect(x + sw * 2, y, w - sw * 2, h).fill(0xc0322e);
  } else if (t === 'ITA') {
    const sw = w / 3;
    g.rect(x, y, sw, h).fill(0x007a3d);
    g.rect(x + sw, y, sw, h).fill(0xf3efe6);
    g.rect(x + sw * 2, y, w - sw * 2, h).fill(0xc82829);
    // Savoy blue shield + white cross (no fasces)
    g.rect(x + w * 0.5 - 1.2, y + h * 0.5 - 1.5, 2.4, 3.0).fill(0x1e4d8c);
    g.rect(x + w * 0.5 - 0.35, y + h * 0.5 - 1.1, 0.7, 2.2).fill(0xf3efe6);
    g.rect(x + w * 0.5 - 0.9, y + h * 0.5 - 0.35, 1.8, 0.7).fill(0xf3efe6);
  } else if (t === 'SOV') {
    g.rect(x, y, w, h).fill(0x9e2421);
    const sx = x + w * 0.28;
    const sy = y + h * 0.38;
    g.poly([
      sx, sy - 2.0,
      sx + 0.6, sy - 0.5,
      sx + 2.0, sy - 0.5,
      sx + 0.9, sy + 0.4,
      sx + 1.3, sy + 1.9,
      sx, sy + 1.0,
      sx - 1.3, sy + 1.9,
      sx - 0.9, sy + 0.4,
      sx - 2.0, sy - 0.5,
      sx - 0.6, sy - 0.5,
    ]).fill(0xe5ba4a);
  } else if (t === 'GBR') {
    g.rect(x, y, w, h).fill(0x1b3668);
    g.rect(x + w * 0.4, y, w * 0.2, h).fill(0xf3efe6);
    g.rect(x, y + h * 0.36, w, h * 0.28).fill(0xf3efe6);
    g.rect(x + w * 0.44, y, w * 0.12, h).fill(0xb8292f);
    g.rect(x, y + h * 0.42, w, h * 0.16).fill(0xb8292f);
  } else if (t === 'CZE') {
    g.rect(x, y, w, h * 0.5).fill(0xf3efe6);
    g.rect(x, y + h * 0.5, w, h * 0.5).fill(0xc42b3b);
    g.poly([x, y, x + w * 0.46, y + h * 0.5, x, y + h]).fill(0x204a87);
  } else if (t === 'HOL') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0xae2e32);
    g.rect(x, y + sh, w, sh).fill(0xf3efe6);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0x21468b);
  } else if (t === 'BEL') {
    const sw = w / 3;
    g.rect(x, y, sw, h).fill(0x1e1c1a);
    g.rect(x + sw, y, sw, h).fill(0xe4b83a);
    g.rect(x + sw * 2, y, w - sw * 2, h).fill(0xb8292f);
  } else if (t === 'SWI') {
    g.rect(x, y, w, h).fill(0xc42b3b);
    g.rect(x + w * 0.41, y + h * 0.18, w * 0.18, h * 0.64).fill(0xf3efe6);
    g.rect(x + w * 0.28, y + h * 0.38, w * 0.44, h * 0.24).fill(0xf3efe6);
  } else if (t === 'AUS') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0xc42b3b);
    g.rect(x, y + sh, w, sh).fill(0xf3efe6);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0xc42b3b);
  } else if (t === 'HUN') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0xb83430);
    g.rect(x, y + sh, w, sh).fill(0xf3efe6);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0x3d7a4f);
  } else if (t === 'ROM') {
    const sw = w / 3;
    g.rect(x, y, sw, h).fill(0x1f3f7a);
    g.rect(x + sw, y, sw, h).fill(0xe2b83b);
    g.rect(x + sw * 2, y, w - sw * 2, h).fill(0xb8292f);
  } else if (t === 'DEN' || t === 'SWE' || t === 'NOR' || t === 'FIN') {
    const bg = t === 'DEN' || t === 'NOR' ? 0xb8292f : t === 'SWE' ? 0x235b96 : 0xf3efe6;
    const cr = t === 'SWE' ? 0xe5bc3a : t === 'DEN' ? 0xf3efe6 : 0x1e4a84;
    g.rect(x, y, w, h).fill(bg);
    g.rect(x + w * 0.3, y, w * 0.14, h).fill(cr);
    g.rect(x, y + h * 0.4, w, h * 0.2).fill(cr);
  } else if (t === 'LIT') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0xe2b53b);
    g.rect(x, y + sh, w, sh).fill(0x2c6e49);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0xb8292f);
  } else if (t === 'LAT') {
    g.rect(x, y, w, h).fill(0x8c2b32);
    g.rect(x, y + h * 0.38, w, h * 0.24).fill(0xf3efe6);
  } else if (t === 'EST') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0x2d6ca2);
    g.rect(x, y + sh, w, sh).fill(0x1c1c1c);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0xf3efe6);
  } else if (t === 'DNZ') {
    g.rect(x, y, w, h).fill(0xb8292f);
    g.rect(x + w * 0.24, y + h * 0.25, w * 0.1, h * 0.55).fill(0xf3efe6);
    g.rect(x + w * 0.14, y + h * 0.36, w * 0.3, h * 0.12).fill(0xf3efe6);
    g.rect(x + w * 0.14, y + h * 0.58, w * 0.3, h * 0.12).fill(0xf3efe6);
  } else if (t === 'LUX') {
    const sh = h / 3;
    g.rect(x, y, w, sh).fill(0xc42b3b);
    g.rect(x, y + sh, w, sh).fill(0xf3efe6);
    g.rect(x, y + sh * 2, w, h - sh * 2).fill(0x4a96c8);
  } else {
    const base = hexToInt(getCountryInfo(t).color);
    g.rect(x, y, w, h).fill(base);
    g.rect(x, y + h * 0.34, w, h * 0.32).fill(0xf2ede2);
  }
  g.rect(x, y, w, h).stroke({ width: 0.65, color: 0x1a1612, alpha: 0.75 });
}

/** Draw razor-sharp black geometric APP-6 inspired symbol inside (x, y, w, h). */
export function drawNatoSymbol(g: Graphics, type: BrigadeType, x: number, y: number, w: number, h: number): void {
  // White/ivory inner symbol box with 1px deep ink frame
  g.rect(x, y, w, h).fill(0xf9f5eb).stroke({ width: 1.0, color: 0x1b1713 });

  const x0 = x + 1.4;
  const y0 = y + 1.4;
  const x1 = x + w - 1.4;
  const y1 = y + h - 1.4;
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  if (type === 'INF') {
    g.moveTo(x0, y0).lineTo(x1, y1).moveTo(x1, y0).lineTo(x0, y1);
    g.stroke({ width: 1.35, color: 0x1a1613, cap: 'round' });
  } else if (type === 'MTN') {
    g.moveTo(x0, y0).lineTo(x1, y1).moveTo(x1, y0).lineTo(x0, y1);
    g.stroke({ width: 1.2, color: 0x1a1613, cap: 'round' });
    g.poly([cx, cy - 0.5, cx - 4.2, y1 + 0.5, cx + 4.2, y1 + 0.5]).fill(0x1a1613);
  } else if (type === 'MOT') {
    g.moveTo(x0, y0).lineTo(x1, y1 - 2.6).moveTo(x1, y0).lineTo(x0, y1 - 2.6);
    g.stroke({ width: 1.25, color: 0x1a1613, cap: 'round' });
    g.circle(cx - 4.0, y1 - 1.4, 1.9).stroke({ width: 1.15, color: 0x1a1613 });
    g.circle(cx + 4.0, y1 - 1.4, 1.9).stroke({ width: 1.15, color: 0x1a1613 });
  } else if (type === 'ARM') {
    g.roundRect(x + 2.6, y + 3.4, w - 5.2, h - 6.8, (h - 6.8) * 0.5);
    g.stroke({ width: 1.5, color: 0x1a1613 });
  } else if (type === 'ART') {
    g.circle(cx, cy, 3.3).fill(0x1a1613);
  } else {
    // GAR: shield outline + single diagonal slash
    g.poly([
      cx - 4.6, y + 2.2,
      cx + 4.6, y + 2.2,
      cx + 4.6, cy + 1.2,
      cx, y + h - 1.8,
      cx - 4.6, cy + 1.2,
    ]).stroke({ width: 1.2, color: 0x1a1613, join: 'round' });
    g.moveTo(cx - 3.6, y + h - 3.4).lineTo(cx + 3.6, y + 3.2);
    g.stroke({ width: 1.25, color: 0x1a1613, cap: 'round' });
  }
}

export interface CounterDrawSpec {
  owner: string;
  leadType: BrigadeType;
  orgRatio: number;
  strRatio: number;
  selected: boolean;
  hasManualOverride: boolean;
  armyColor?: string;
  relation?: CounterRelation;
  inCombat?: boolean;
  supplyStatus?: SupplyStatus;
  starveFlash?: boolean;
}

/** Draw original miniature red jerrycan / oil barrel + exclamation mark badge at (cx, cy). */
function drawOilBarrelAlertBadge(g: Graphics, cx: number, cy: number, starving: boolean): void {
  const bx = cx - 5.2;
  const by = cy - 6.0;
  // Subtle dark shadow + brass/crimson backing
  g.roundRect(bx + 0.8, by + 1.0, 10.4, 12.0, 2.0).fill({ color: 0x0f0807, alpha: 0.65 });
  // Jerrycan spout/cap on top-left
  g.roundRect(bx + 1.4, by - 1.6, 3.8, 2.2, 0.8).fill(starving ? 0xe03a2f : 0xd44638).stroke({ width: 0.85, color: 0x160a09 });
  // Main barrel body
  g.roundRect(bx, by, 10.4, 12.0, 2.0)
    .fill(starving ? 0xa31b15 : 0xc63024)
    .stroke({ width: 1.1, color: starving ? 0x160a09 : 0x260d0b });
  // Highlight bevel & crisp ivory exclamation mark "!"
  g.rect(bx + 4.4, by + 2.2, 1.7, 5.2).fill(0xfff5e4);
  g.circle(bx + 5.25, by + 9.4, 1.05).fill(0xfff5e4);
}

/** Draw complete 46x31px hard-cardstock tactical counter centered at (0, 0) with clear friend/ally/foe styling. */
export function drawCardstockCounter(g: Graphics, spec: CounterDrawSpec): void {
  const x = -COUNTER_W * 0.5;
  const y = -COUNTER_H * 0.5;
  const rel: CounterRelation = spec.relation ?? 'own';
  const themeColor = hexToInt(getCountryInfo(spec.owner).color);

  const cardBg =
    rel === 'own' ? 0xf4ede0
    : rel === 'ally' ? 0xdde7ef
    : rel === 'enemy' ? 0xcabdb0
    : 0xddd6c7;
  const frameColor =
    rel === 'enemy' ? 0xb83a2d
    : rel === 'ally' ? 0x2f5c7e
    : rel === 'neutral' ? 0x564e44
    : 0x1a1612;
  const frameWidth = rel === 'enemy' ? 1.85 : rel === 'ally' ? 1.45 : 1.2;

  // Subtle drop shadow
  g.roundRect(x + 1.5, y + 2, COUNTER_W, COUNTER_H, 3.5).fill({ color: 0x120e0b, alpha: 0.44 });

  // Selection brass halo, starvation black-red alert frame, or combat pulse ring
  const isStarving = spec.supplyStatus === 'starving';
  const isLowSupply = spec.supplyStatus === 'low';
  if (spec.selected) {
    g.roundRect(x - 2.2, y - 2.2, COUNTER_W + 4.4, COUNTER_H + 4.4, 5).stroke({ width: 2.3, color: 0xf2c86b, alpha: 0.98 });
  } else if (isStarving) {
    if (spec.starveFlash) {
      g.roundRect(x - 3.0, y - 3.0, COUNTER_W + 6.0, COUNTER_H + 6.0, 5.5).stroke({ width: 2.4, color: 0xf24b3d, alpha: 0.85 });
    }
    g.roundRect(x - 1.8, y - 1.8, COUNTER_W + 3.6, COUNTER_H + 3.6, 4.6).stroke({ width: 2.2, color: 0x170b0a, alpha: 0.96 });
  } else if (spec.inCombat) {
    g.roundRect(x - 1.5, y - 1.5, COUNTER_W + 3, COUNTER_H + 3, 4.5).stroke({ width: 1.5, color: 0xd9563f, alpha: 0.85 });
  }

  // Main hard cardstock body (differentiates own / ally / enemy / neutral immediately)
  g.roundRect(x, y, COUNTER_W, COUNTER_H, 3.5).fill(cardBg);

  // Subtle top relation ribbon for enemy/ally quick scan
  if (rel === 'enemy') {
    g.rect(x + 1, y + 1, COUNTER_W - 2, 2.4).fill({ color: 0xb83a2d, alpha: 0.88 });
  } else if (rel === 'ally') {
    g.rect(x + 1, y + 1, COUNTER_W - 2, 2.2).fill({ color: 0x3b6e94, alpha: 0.82 });
  }

  // Left country theme band + mini neutral flag
  g.roundRect(x + 1.5, y + 2, 12, 18, 2.0).fill(themeColor);
  drawMiniFlag(g, spec.owner, x + 2.5, y + 7.5, 10, 7);

  // Army color top-left accent stripe for own forces
  if (spec.armyColor && rel === 'own') {
    g.rect(x + 1.5, y + 2, 12, 3.0).fill(hexToInt(spec.armyColor));
  }

  // Center NATO geometric box (18x15px)
  drawNatoSymbol(g, spec.leadType, x + 14.5, y + 3.5, 17.5, 15.2);

  // Bottom bold twin 4px status bars (Org top, Strength bottom); <30% turns warning cinnabar
  const barX = x + 2;
  const barW = COUNTER_W - 4;
  const orgClamped = Math.max(0, Math.min(1, spec.orgRatio));
  const strClamped = Math.max(0, Math.min(1, spec.strRatio));
  g.rect(barX, y + 20.5, barW, 9).fill(0x1f1b16);
  const orgW = Math.max(1, Math.round(barW * orgClamped));
  const strW = Math.max(1, Math.round(barW * strClamped));
  const orgCol = orgClamped < 0.3 ? 0xcf3d2e : 0x45a362;
  const strCol = strClamped < 0.3 ? 0xcf3d2e : 0xe49f38;
  g.rect(barX, y + 20.5, orgW, 4).fill(orgCol);
  g.rect(barX, y + 25.2, strW, 4).fill(strCol);

  // Crisp outer frame (black-red double rim when starving)
  if (isStarving) {
    g.roundRect(x, y, COUNTER_W, COUNTER_H, 3.5).stroke({ width: 2.4, color: 0x160a09 });
    g.roundRect(x + 0.9, y + 0.9, COUNTER_W - 1.8, COUNTER_H - 1.8, 2.8).stroke({ width: 1.45, color: 0xd92f26 });
  } else {
    g.roundRect(x, y, COUNTER_W, COUNTER_H, 3.5).stroke({ width: frameWidth, color: frameColor });
  }

  // Enemy top-right cinnabar corner chevron pip
  if (rel === 'enemy' && !isLowSupply && !isStarving) {
    g.poly([x + COUNTER_W - 6.5, y + 1, x + COUNTER_W - 1, y + 1, x + COUNTER_W - 1, y + 6.5]).fill(0xb83a2d);
  }

  // Manual override golden lock pip (top-right corner)
  if (spec.hasManualOverride) {
    g.circle(x + COUNTER_W - 3.8, y + 3.8, 2.7).fill(0xeab84b).stroke({ width: 0.8, color: 0x1a1612 });
  }

  // Original red oil-barrel exclamation badge at top-right when low supply or starving
  if (isLowSupply || isStarving) {
    drawOilBarrelAlertBadge(g, x + COUNTER_W - 1.2, y - 1.5, isStarving);
  }
}

/** Draw LOD 0 aggregated Army Crest badge centered at (0, 0). */
export function drawArmyCrestBadge(
  g: Graphics,
  owner: string,
  armyColor: string,
  orgRatio: number,
  strRatio: number,
  selected: boolean,
): void {
  const x = -ARMY_BADGE_W * 0.5;
  const y = -ARMY_BADGE_H * 0.5;
  g.roundRect(x + 1.5, y + 2, ARMY_BADGE_W, ARMY_BADGE_H, 4.5).fill({ color: 0x120e0b, alpha: 0.42 });
  if (selected) {
    g.roundRect(x - 2, y - 2, ARMY_BADGE_W + 4, ARMY_BADGE_H + 4, 6).stroke({ width: 2.0, color: 0xf2c86b });
  }
  g.roundRect(x, y, ARMY_BADGE_W, ARMY_BADGE_H, 4.5).fill(0x241f1a);
  g.roundRect(x + 1, y + 1, 5, ARMY_BADGE_H - 2, 2.5).fill(hexToInt(armyColor));
  drawMiniFlag(g, owner, x + 8, y + 5, 13, 9);

  // Twin thin status bars along bottom
  const bx = x + 7;
  const bw = ARMY_BADGE_W - 10;
  g.rect(bx, y + ARMY_BADGE_H - 6, bw, 4.5).fill(0x14110e);
  g.rect(bx, y + ARMY_BADGE_H - 6, Math.max(1, Math.round(bw * orgRatio)), 2).fill(0x3cb868);
  g.rect(bx, y + ARMY_BADGE_H - 3.5, Math.max(1, Math.round(bw * strRatio)), 2).fill(0xe49f38);

  g.roundRect(x, y, ARMY_BADGE_W, ARMY_BADGE_H, 4.5).stroke({ width: 1.15, color: 0x9b8255 });
}
