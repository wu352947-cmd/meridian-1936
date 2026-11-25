/**
 * Original hand-coded vector SVG icons for Batch 07 Logistics, Supply Hubs,
 * Port Anchors, Low-Supply Oil Barrel Alerts, and Seasonal Weather Indicators.
 * 100% MIT / CC0 Original Work — zero external assets.
 */

export const SUPPLY_ICON_SIZE = 32;

/** National Capital supply hub star (S=100). */
export const SUPPLY_CAPITAL_STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="13.5" fill="#231B14" stroke="#E5BE6A" stroke-width="2.2"/>
  <polygon points="16,5.5 18.8,12.2 26,12.8 20.5,17.4 22.2,24.5 16,20.6 9.8,24.5 11.5,17.4 6,12.8 13.2,12.2" fill="#F2CC74" stroke="#1A140E" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;

/** Industrial Core City supply hub 8-point compass star (S=85). */
export const SUPPLY_CORE_STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="12.8" fill="#26201A" stroke="#C8A25A" stroke-width="2"/>
  <polygon points="16,6 18.4,13.6 26,16 18.4,18.4 16,26 13.6,18.4 6,16 13.6,13.6" fill="#EFE4CC" stroke="#1E1812" stroke-width="1"/>
  <circle cx="16" cy="16" r="2.8" fill="#C8933E"/>
</svg>`;

/** Friendly Maritime Port supply anchor (S=35+13*L). */
export const SUPPLY_PORT_ANCHOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="12.8" fill="#1D3244" stroke="#8AC0DE" stroke-width="2"/>
  <circle cx="16" cy="9.2" r="2.3" fill="none" stroke="#EBF5FC" stroke-width="2"/>
  <path d="M16 11.6 L16 23.2 M11.5 14.4 L20.5 14.4 M9.6 18.8 C9.8 22.8 12.6 24.4 16 24.4 C19.4 24.4 22.2 22.8 22.4 18.8" fill="none" stroke="#EBF5FC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <polygon points="8.3,19.4 10.6,17.3 11.4,20.1" fill="#EBF5FC"/>
  <polygon points="23.7,19.4 21.4,17.3 20.6,20.1" fill="#EBF5FC"/>
</svg>`;

/** Low-supply red jerrycan / oil barrel with exclamation warning icon (for UI & counters). */
export const OIL_CAN_ALERT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="4" y="5" width="14" height="16" rx="2.4" fill="#B82D22" stroke="#190E0C" stroke-width="1.5"/>
  <rect x="6.5" y="2.5" width="5.5" height="2.6" rx="1" fill="#D94538" stroke="#190E0C" stroke-width="1.2"/>
  <line x1="11" y1="9" x2="11" y2="14.2" stroke="#FFF4E6" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="11" cy="17.6" r="1.35" fill="#FFF4E6"/>
</svg>`;

/** Crisp winter frost crystal icon (16x16). */
export const WINTER_CRYSTAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
  <g stroke="#B8DCF2" stroke-width="1.35" stroke-linecap="round" fill="none">
    <line x1="8" y1="1.5" x2="8" y2="14.5"/>
    <line x1="2.4" y1="4.7" x2="13.6" y2="11.3"/>
    <line x1="13.6" y1="4.7" x2="2.4" y2="11.3"/>
    <polyline points="6.2,3.2 8,4.8 9.8,3.2"/>
    <polyline points="6.2,12.8 8,11.2 9.8,12.8"/>
  </g>
</svg>`;

/** Crisp mud-season raindrop / wheel-rut icon (16x16). */
export const MUD_SEASON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
  <path d="M8 2 C5.6 5.6 4 7.7 4 9.8 C4 12.1 5.8 14 8 14 C10.2 14 12 12.1 12 9.8 C12 7.7 10.4 5.6 8 2 Z" fill="#B68B56" stroke="#2B1E12" stroke-width="1.2"/>
  <path d="M6.4 10.2 C6.5 11.4 7.4 12 8.5 12" fill="none" stroke="#EFE1C8" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;

/** Crisp night crescent moon icon (16x16). */
export const NIGHT_MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14">
  <path d="M11.6 10.7 A5.3 5.3 0 0 1 6.3 2.5 A5.8 5.8 0 1 0 13.5 9.8 A5.2 5.2 0 0 1 11.6 10.7 Z" fill="#E6C97A" stroke="#231D15" stroke-width="1"/>
</svg>`;
