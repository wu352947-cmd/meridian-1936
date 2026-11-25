/**
 * Original monochrome engraving-style capital landmark silhouettes & heraldic compass.
 * Zero leader portraits — adheres to docs/ART_BIBLE.md §7.
 */

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 76" fill="none">` +
  `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
  `<line x1="0" y1="0" x2="0" y2="5" stroke="#6E5D42" stroke-opacity="0.16" stroke-width="1"/></pattern></defs>` +
  `<rect x="1" y="1" width="318" height="74" rx="2" fill="url(#hatch)" stroke="#6E5D42" stroke-opacity="0.4"/>` +
  `<path d="M9,14 V7 H16 M304,7 H311 V14 M9,62 V69 H16 M304,69 H311 V62" stroke="#8A724B" stroke-width="1.1"/>` +
  `<line x1="20" y1="62" x2="300" y2="62" stroke="#3B332B" stroke-width="1.4"/>` +
  `<line x1="36" y1="66" x2="284" y2="66" stroke="#6E5D42" stroke-opacity="0.45" stroke-width="0.8"/>` +
  `<g transform="translate(70,6)">${inner}</g></svg>`;

const LANDMARKS: Record<string, string> = {
  /** Berlin — Brandenburg Gate silhouette */
  berlin: wrap(
    `<rect x="44" y="25" width="92" height="5" fill="#2E2823"/>` +
    `<rect x="50" y="20" width="80" height="5" fill="#3B332B"/>` +
    `<rect x="74" y="14" width="32" height="6" fill="#2E2823"/>` +
    `<path d="M82,14 L86,8 L90,11 L94,8 L98,14 Z" fill="#2E2823"/>` +
    `<rect x="49" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="64" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="79" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="95" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="110" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="125" y="30" width="6" height="26" fill="#2E2823"/>` +
    `<rect x="26" y="42" width="18" height="14" fill="#4A4138"/>` +
    `<rect x="136" y="42" width="18" height="14" fill="#4A4138"/>`,
  ),
  /** London — Westminster / Clock Tower */
  london: wrap(
    `<rect x="34" y="40" width="76" height="16" fill="#3B332B"/>` +
    `<path d="M40,40 V34 H46 V40 M58,40 V34 H64 V40 M76,40 V34 H82 V40 M94,40 V34 H100 V40" stroke="#2E2823" stroke-width="2"/>` +
    `<rect x="114" y="20" width="18" height="36" fill="#2E2823"/>` +
    `<circle cx="123" cy="28" r="4.5" fill="#F4EFE6" stroke="#2E2823" stroke-width="1"/>` +
    `<path d="M123,28 L123,25 M123,28 L125.5,28" stroke="#2E2823" stroke-width="1"/>` +
    `<polygon points="113,20 123,6 133,20" fill="#2E2823"/>` +
    `<rect x="26" y="46" width="128" height="10" fill="#2E2823" fill-opacity="0.35"/>`,
  ),
  /** Paris — Iron Lattice Tower & Classical Arch */
  paris: wrap(
    `<path d="M90,7 L95,28 L106,56 H97 L93,43 H87 L83,56 H74 L85,28 Z" fill="#2E2823"/>` +
    `<path d="M84,41 Q90,34 96,41" stroke="#F4EFE6" stroke-width="2.2" fill="none"/>` +
    `<line x1="81" y1="36" x2="99" y2="36" stroke="#2E2823" stroke-width="2"/>` +
    `<line x1="84" y1="25" x2="96" y2="25" stroke="#2E2823" stroke-width="1.6"/>` +
    `<rect x="28" y="34" width="28" height="22" fill="#4A4138"/>` +
    `<path d="M37,56 V44 Q42,39 47,44 V56 Z" fill="#F4EFE6"/>` +
    `<rect x="124" y="42" width="30" height="14" fill="#4A4138"/>`,
  ),
  /** Moscow — Kremlin Wall & Spasskaya Tower */
  moscow: wrap(
    `<rect x="26" y="43" width="128" height="13" fill="#4A4138"/>` +
    `<path d="M30,43 V39 H36 V43 M44,43 V39 H50 V43 M58,43 V39 H64 V43 M116,43 V39 H122 V43 M130,43 V39 H136 V43 M144,43 V39 H150 V43" fill="#4A4138"/>` +
    `<rect x="77" y="25" width="26" height="31" fill="#2E2823"/>` +
    `<circle cx="90" cy="34" r="4.5" fill="#F4EFE6" stroke="#2E2823" stroke-width="1"/>` +
    `<polygon points="79,25 90,8 101,25" fill="#2E2823"/>` +
    `<path d="M85,56 V45 Q90,41 95,45 V56 Z" fill="#F4EFE6"/>`,
  ),
  /** Rome — Classical Amphitheatre */
  rome: wrap(
    `<path d="M34,56 V26 H112 V34 H146 V56 Z" fill="#2E2823"/>` +
    `<path d="M44,56 V47 A4,4 0 0 1 52,47 V56 M60,56 V47 A4,4 0 0 1 68,47 V56 M76,56 V47 A4,4 0 0 1 84,47 V56 M92,56 V47 A4,4 0 0 1 100,47 V56 M108,56 V47 A4,4 0 0 1 116,47 V56 M124,56 V47 A4,4 0 0 1 132,47 V56" fill="#F4EFE6"/>` +
    `<path d="M44,41 V34 A4,4 0 0 1 52,34 V41 M60,41 V34 A4,4 0 0 1 68,34 V41 M76,41 V34 A4,4 0 0 1 84,34 V41 M92,41 V34 A4,4 0 0 1 100,34 V41" fill="#F4EFE6"/>`,
  ),
  /** Warsaw — Royal Castle & Sigismund Column */
  warsaw: wrap(
    `<rect x="52" y="34" width="84" height="22" fill="#3B332B"/>` +
    `<polygon points="84,34 94,16 104,34" fill="#2E2823"/>` +
    `<rect x="91" y="24" width="6" height="10" fill="#2E2823"/>` +
    `<rect x="36" y="24" width="4" height="32" fill="#2E2823"/>` +
    `<circle cx="38" cy="21" r="2.8" fill="#2E2823"/>` +
    `<rect x="64" y="42" width="6" height="8" fill="#F4EFE6"/><rect x="78" y="42" width="6" height="8" fill="#F4EFE6"/>` +
    `<rect x="104" y="42" width="6" height="8" fill="#F4EFE6"/><rect x="118" y="42" width="6" height="8" fill="#F4EFE6"/>`,
  ),
  /** Madrid — Puerta de Alcala Arch */
  madrid: wrap(
    `<rect x="38" y="28" width="104" height="28" fill="#2E2823"/>` +
    `<polygon points="62,28 90,15 118,28" fill="#3B332B"/>` +
    `<path d="M50,56 V41 A6,6 0 0 1 62,41 V56 M82,56 V39 A8,8 0 0 1 98,39 V56 M118,56 V41 A6,6 0 0 1 130,41 V56" fill="#F4EFE6"/>`,
  ),
  /** Prague — Vltava Bridge & Gothic Spires */
  prague: wrap(
    `<rect x="24" y="43" width="132" height="13" fill="#3B332B"/>` +
    `<path d="M36,56 A9,9 0 0 1 54,56 M68,56 A9,9 0 0 1 86,56 M100,56 A9,9 0 0 1 118,56 M130,56 A9,9 0 0 1 148,56" fill="#F4EFE6"/>` +
    `<rect x="62" y="24" width="16" height="19" fill="#2E2823"/><polygon points="60,24 70,11 80,24" fill="#2E2823"/>` +
    `<rect x="104" y="22" width="14" height="21" fill="#2E2823"/><polygon points="103,22 111,9 119,22" fill="#2E2823"/>`,
  ),
  /** Generic Cartographic Compass Rose & Citadel */
  compass: wrap(
    `<circle cx="90" cy="34" r="20" stroke="#3B332B" stroke-width="1.2" stroke-dasharray="3 2"/>` +
    `<circle cx="90" cy="34" r="14" stroke="#6E5D42" stroke-width="1"/>` +
    `<polygon points="90,11 94,30 113,34 94,38 90,57 86,38 67,34 86,30" fill="#2E2823"/>` +
    `<circle cx="90" cy="34" r="3.2" fill="#F4EFE6" stroke="#2E2823" stroke-width="1"/>` +
    `<line x1="24" y1="34" x2="62" y2="34" stroke="#6E5D42" stroke-width="0.9"/>` +
    `<line x1="118" y1="34" x2="156" y2="34" stroke="#6E5D42" stroke-width="0.9"/>`,
  ),
};

export function getLandmarkSvg(landmarkId: string): string {
  return LANDMARKS[landmarkId] ?? LANDMARKS.compass!;
}

export function getLandmarkDataUri(landmarkId: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLandmarkSvg(landmarkId))}`;
}
