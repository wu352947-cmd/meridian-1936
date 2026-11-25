/**
 * 100% original geometric neutral-compliant 3:2 SVG flags for 1936 Europe.
 * Strictly adheres to docs/ART_BIBLE.md §6.1:
 *  - GER: Black-White-Red tricolor + straight-armed Balkenkreuz (zero swastika / SS runes)
 *  - ITA: Green-White-Red vertical tricolor + Savoy blue/white shield (zero fasces)
 *  - SOV: Deep crimson + golden 5-point star
 *  - JPN: Hinomaru white + red disc (zero rising-sun rays)
 */

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="30" height="20">${inner}</svg>`;

const h3 = (a: string, b: string, c: string, extra = ''): string =>
  wrap(
    `<rect width="30" height="6.7" fill="${a}"/>` +
    `<rect y="6.65" width="30" height="6.7" fill="${b}"/>` +
    `<rect y="13.3" width="30" height="6.7" fill="${c}"/>${extra}`,
  );

const v3 = (a: string, b: string, c: string, extra = ''): string =>
  wrap(
    `<rect width="10" height="20" fill="${a}"/>` +
    `<rect x="10" width="10" height="20" fill="${b}"/>` +
    `<rect x="20" width="10" height="20" fill="${c}"/>${extra}`,
  );

const h2 = (a: string, b: string, extra = ''): string =>
  wrap(`<rect width="30" height="10" fill="${a}"/><rect y="10" width="30" height="10" fill="${b}"/>${extra}`);

const nordic = (bg: string, cross: string, border?: string): string =>
  wrap(
    `<rect width="30" height="20" fill="${bg}"/>` +
    (border
      ? `<rect x="8.2" width="4.6" height="20" fill="${border}"/><rect y="7.7" width="30" height="4.6" fill="${border}"/>`
      : '') +
    `<rect x="9.2" width="2.6" height="20" fill="${cross}"/><rect y="8.7" width="30" height="2.6" fill="${cross}"/>`,
  );

/** Straight-armed geometric Balkenkreuz centered in 30x20 viewBox */
const BALKENKREUZ =
  `<g transform="translate(15,10)">` +
  `<rect x="-4.2" y="-1.5" width="8.4" height="3.0" fill="#1C1C1C" stroke="#F2EFE9" stroke-width="0.65"/>` +
  `<rect x="-1.5" y="-4.2" width="3.0" height="8.4" fill="#1C1C1C" stroke="#F2EFE9" stroke-width="0.65"/>` +
  `<rect x="-3.4" y="-0.95" width="6.8" height="1.9" fill="#1C1C1C"/>` +
  `<rect x="-0.95" y="-3.4" width="1.9" height="6.8" fill="#1C1C1C"/>` +
  `</g>`;

/** Simplified Savoy blue shield with white cross */
const SAVOY_SHIELD =
  `<g transform="translate(15,10)">` +
  `<path d="M-2.6,-3.2 H2.6 V0.6 C2.6,2.4 0,3.6 0,3.6 C0,3.6 -2.6,2.4 -2.6,0.6 Z" fill="#1E4D8C" stroke="#D4AF5A" stroke-width="0.45"/>` +
  `<rect x="-2.1" y="-0.65" width="4.2" height="1.3" fill="#F2EFE9"/>` +
  `<rect x="-0.65" y="-2.7" width="1.3" height="5.5" fill="#F2EFE9"/>` +
  `</g>`;

const FLAG_MAP: Record<string, string> = {
  GER: h3('#1C1C1C', '#F2EFE9', '#B52B27', BALKENKREUZ),
  ITA: v3('#007A3D', '#F2EFE9', '#C82829', SAVOY_SHIELD),
  SOV: wrap(
    `<rect width="30" height="20" fill="#9E2421"/>` +
    `<polygon points="6.5,3.2 7.3,5.5 9.7,5.5 7.8,6.9 8.5,9.2 6.5,7.8 4.5,9.2 5.2,6.9 3.3,5.5 5.7,5.5" fill="#E0B445"/>`,
  ),
  GBR: wrap(
    `<rect width="30" height="20" fill="#1B3668"/>` +
    `<path d="M0,0 L30,20 M30,0 L0,20" stroke="#F2EFE9" stroke-width="3.4"/>` +
    `<path d="M0,0 L30,20 M30,0 L0,20" stroke="#B8292F" stroke-width="1.4"/>` +
    `<rect x="12.2" width="5.6" height="20" fill="#F2EFE9"/>` +
    `<rect y="7.2" width="30" height="5.6" fill="#F2EFE9"/>` +
    `<rect x="13.3" width="3.4" height="20" fill="#B8292F"/>` +
    `<rect y="8.3" width="30" height="3.4" fill="#B8292F"/>`,
  ),
  FRA: v3('#1E3F7A', '#F2EFE9', '#C0322E'),
  POL: h2('#F2EFE9', '#C42B3B'),
  DNZ: wrap(
    `<rect width="30" height="20" fill="#B8292F"/>` +
    `<rect x="7.8" y="6.2" width="1.8" height="7.6" fill="#F2EFE9"/>` +
    `<rect x="5.6" y="7.8" width="6.2" height="1.5" fill="#F2EFE9"/>` +
    `<rect x="5.6" y="11.2" width="6.2" height="1.5" fill="#F2EFE9"/>` +
    `<circle cx="8.7" cy="4.2" r="1.4" fill="#E0B445"/>`,
  ),
  SPR: h3('#B8292F', '#E5B53A', '#63326E'),
  SPA: wrap(
    `<rect width="30" height="5" fill="#B8292F"/>` +
    `<rect y="5" width="30" height="10" fill="#E5B53A"/>` +
    `<rect y="15" width="30" height="5" fill="#B8292F"/>`,
  ),
  CZE: wrap(
    `<rect width="30" height="10" fill="#F2EFE9"/>` +
    `<rect y="10" width="30" height="10" fill="#C42B3B"/>` +
    `<polygon points="0,0 13.5,10 0,20" fill="#204A87"/>`,
  ),
  AUS: h3('#C42B3B', '#F2EFE9', '#C42B3B'),
  HUN: h3('#B83430', '#F2EFE9', '#3D7A4F'),
  ROM: v3('#1F3F7A', '#E2B83B', '#B8292F'),
  YUG: h3('#21468B', '#F2EFE9', '#C42B3B'),
  BUL: h3('#F2EFE9', '#2E7D54', '#C0322E'),
  GRE: wrap(
    `<rect width="30" height="20" fill="#2B67A4"/>` +
    `<rect x="13" width="4" height="20" fill="#F2EFE9"/>` +
    `<rect y="8" width="30" height="4" fill="#F2EFE9"/>`,
  ),
  TUR: wrap(
    `<rect width="30" height="20" fill="#B8252A"/>` +
    `<circle cx="11.5" cy="10" r="4.8" fill="#F2EFE9"/>` +
    `<circle cx="12.9" cy="10" r="3.8" fill="#B8252A"/>` +
    `<polygon points="17.8,10 19.8,9.3 19.2,11.3 19.2,8.7 19.8,10.7" fill="#F2EFE9"/>`,
  ),
  FIN: nordic('#F2EFE9', '#1E4A84'),
  SWE: nordic('#235B96', '#E5BC3A'),
  NOR: nordic('#B8292F', '#1C3F78', '#F2EFE9'),
  DEN: nordic('#B8292F', '#F2EFE9'),
  ISL: nordic('#1F4E8C', '#C42B3B', '#F2EFE9'),
  HOL: h3('#AE2E32', '#F2EFE9', '#21468B'),
  BEL: v3('#1E1C1A', '#E4B83A', '#B8292F'),
  LUX: h3('#C42B3B', '#F2EFE9', '#4A96C8'),
  SWI: wrap(
    `<rect width="30" height="20" fill="#C42B3B"/>` +
    `<rect x="12.8" y="4.2" width="4.4" height="11.6" fill="#F2EFE9"/>` +
    `<rect x="9.2" y="7.8" width="11.6" height="4.4" fill="#F2EFE9"/>`,
  ),
  POR: wrap(
    `<rect width="12" height="20" fill="#216B3E"/>` +
    `<rect x="12" width="18" height="20" fill="#B8292F"/>` +
    `<circle cx="12" cy="10" r="3.8" fill="#E0B445" stroke="#1E1C1A" stroke-width="0.4"/>`,
  ),
  IRE: v3('#2A7D4F', '#F2EFE9', '#D67A34'),
  LIT: h3('#E2B53B', '#2C6E49', '#B8292F'),
  LAT: wrap(`<rect width="30" height="20" fill="#8C2B32"/><rect y="8" width="30" height="4" fill="#F2EFE9"/>`),
  EST: h3('#2D6CA2', '#1C1C1C', '#F2EFE9'),
  ALB: wrap(
    `<rect width="30" height="20" fill="#B0242A"/>` +
    `<path d="M15,5 L18.5,8.5 L16.5,14.5 L15,12.8 L13.5,14.5 L11.5,8.5 Z" fill="#1C1C1C"/>`,
  ),
  IRQ: h3('#1C1C1C', '#F2EFE9', '#2E7D4A', `<polygon points="0,0 10,10 0,20" fill="#B8292F"/>`),
  IRN: h3('#2E7D4A', '#F2EFE9', '#C0322E'),
  SAU: wrap(`<rect width="30" height="20" fill="#236B42"/><rect x="7" y="13.5" width="16" height="1.3" fill="#F2EFE9"/>`),
  JPN: wrap(`<rect width="30" height="20" fill="#F5F3EE"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`),
};

export function getFlagSvg(tag: string): string {
  return FLAG_MAP[tag] ?? wrap(`<rect width="30" height="20" fill="#6E655C"/><rect x="2" y="2" width="26" height="16" fill="none" stroke="#EAE2D3" stroke-width="1"/>`);
}

export function getFlagDataUri(tag: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(getFlagSvg(tag))}`;
}

export const ALL_FLAG_TAGS = Object.keys(FLAG_MAP);
