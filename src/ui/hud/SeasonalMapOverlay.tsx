/**
 * Restrained procedural SVG seasonal corner vignette overlay (Severe Winter frost crystals
 * & East Europe Mud Season damp watercolor silt) framed strictly in the 4 outer corners so
 * the map interior, province labels, and HUD panels remain 100% crisp and legible.
 */
import { getTheaterSeasonSummary } from '../../sim/systems/weatherSystem';
import { simTickSig } from '../store/simStore';

function WinterCornerSvg({ flipClass }: { flipClass: string }) {
  return (
    <svg class={`season-corner ${flipClass}`} viewBox="0 0 260 220" width="260" height="220" aria-hidden="true">
      <defs>
        <radialGradient id="frostGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="#E4F4FF" stop-opacity="0.62" />
          <stop offset="45%" stop-color="#BEE0F5" stop-opacity="0.30" />
          <stop offset="78%" stop-color="#A6CFE8" stop-opacity="0.09" />
          <stop offset="100%" stop-color="#9BC4DE" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="260" height="220" fill="url(#frostGlow)" />
      <g stroke="#EAF7FF" stroke-opacity="0.68" fill="none" stroke-linecap="round">
        <path d="M 0 38 L 62 24 L 112 0" stroke-width="1.6" />
        <path d="M 24 0 L 34 72 L 0 116" stroke-width="1.45" />
        <path d="M 46 38 L 106 54 L 146 32" stroke-width="1.2" />
        <path d="M 76 22 L 96 38 M 44 62 L 68 74 M 22 86 L 48 96" stroke-width="1.05" />
        <path d="M 0 154 L 44 126 L 68 88 L 108 78" stroke-width="1.0" stroke-opacity="0.48" />
        <path d="M 168 0 L 134 28 L 92 22" stroke-width="1.0" stroke-opacity="0.48" />
        <path d="M 112 52 L 128 66 M 62 114 L 84 118 M 140 18 L 154 30" stroke-width="0.9" stroke-opacity="0.45" />
      </g>
      <g fill="#F2FAFF" fill-opacity="0.58">
        <circle cx="88" cy="36" r="2.0" />
        <circle cx="48" cy="84" r="1.8" />
        <circle cx="132" cy="22" r="1.6" />
        <circle cx="28" cy="130" r="1.6" />
        <circle cx="104" cy="68" r="1.4" />
        <circle cx="66" cy="112" r="1.4" />
      </g>
    </svg>
  );
}

function MudCornerSvg({ flipClass }: { flipClass: string }) {
  return (
    <svg class={`season-corner ${flipClass}`} viewBox="0 0 260 220" width="260" height="220" aria-hidden="true">
      <defs>
        <radialGradient id="mudWash" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="#4E381F" stop-opacity="0.60" />
          <stop offset="48%" stop-color="#6B4F30" stop-opacity="0.28" />
          <stop offset="80%" stop-color="#785B3A" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#765A39" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="260" height="220" fill="url(#mudWash)" />
      <g fill="#4A341C" fill-opacity="0.34">
        <path d="M 0 0 L 132 0 C 106 28 74 40 48 68 C 28 90 22 122 0 144 Z" />
        <ellipse cx="82" cy="46" rx="22" ry="7.5" transform="rotate(-24 82 46)" />
        <ellipse cx="44" cy="96" rx="16" ry="6" transform="rotate(-56 44 96)" />
        <ellipse cx="122" cy="24" rx="14" ry="4.5" transform="rotate(-14 122 24)" />
        <circle cx="108" cy="36" r="4.2" />
        <circle cx="144" cy="16" r="2.8" />
        <circle cx="30" cy="134" r="3.6" />
        <circle cx="64" cy="74" r="2.6" />
        <circle cx="94" cy="60" r="2.2" />
        <circle cx="48" cy="120" r="2.1" />
      </g>
    </svg>
  );
}

export function SeasonalMapOverlay() {
  const tick = simTickSig.value;
  const summary = getTheaterSeasonSummary(tick);
  if (summary.eastCondition === 'normal' && summary.nordicCondition === 'normal') return null;

  const isWinter = summary.eastCondition === 'winter' || summary.nordicCondition === 'winter';
  const corners = ['is-tl', 'is-tr', 'is-bl', 'is-br'];

  return (
    <div
      class={`seasonal-frame-overlay ${isWinter ? 'is-winter' : 'is-mud'}`}
      aria-hidden="true"
    >
      {corners.map((cls) =>
        isWinter ? <WinterCornerSvg key={cls} flipClass={cls} /> : <MudCornerSvg key={cls} flipClass={cls} />,
      )}
    </div>
  );
}
