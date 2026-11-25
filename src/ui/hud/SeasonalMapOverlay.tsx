/**
 * Restrained procedural SVG seasonal corner vignette overlay (Severe Winter frost crystals
 * & East Europe Mud Season damp watercolor silt) framed strictly in the 4 outer corners so
 * the map interior, province labels, and HUD panels remain 100% crisp and legible.
 */
import { getTheaterSeasonSummary } from '../../sim/systems/weatherSystem';
import { simTickSig } from '../store/simStore';

function WinterCornerSvg({ flipClass }: { flipClass: string }) {
  return (
    <svg class={`season-corner ${flipClass}`} viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
      <defs>
        <radialGradient id="frostGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="#D8EEFA" stop-opacity="0.46" />
          <stop offset="48%" stop-color="#B7D9EE" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#9BC4DE" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="180" height="180" fill="url(#frostGlow)" />
      <g stroke="#E4F4FD" stroke-opacity="0.52" fill="none" stroke-linecap="round">
        <path d="M 0 28 L 36 18 L 62 0" stroke-width="1.3" />
        <path d="M 16 0 L 22 46 L 0 74" stroke-width="1.15" />
        <path d="M 28 24 L 58 34 L 78 22" stroke-width="0.95" />
        <path d="M 42 14 L 52 24 M 24 38 L 38 44 M 12 52 L 26 58" stroke-width="0.85" />
        <path d="M 0 104 L 22 86 L 34 62" stroke-width="0.85" stroke-opacity="0.34" />
        <path d="M 96 0 L 76 18 L 54 14" stroke-width="0.85" stroke-opacity="0.34" />
      </g>
      <g fill="#EEF8FF" fill-opacity="0.42">
        <circle cx="48" cy="24" r="1.5" />
        <circle cx="24" cy="54" r="1.3" />
        <circle cx="72" cy="14" r="1.2" />
        <circle cx="14" cy="82" r="1.1" />
      </g>
    </svg>
  );
}

function MudCornerSvg({ flipClass }: { flipClass: string }) {
  return (
    <svg class={`season-corner ${flipClass}`} viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
      <defs>
        <radialGradient id="mudWash" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="#5B442A" stop-opacity="0.44" />
          <stop offset="52%" stop-color="#765A39" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#765A39" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="180" height="180" fill="url(#mudWash)" />
      <g fill="#4F3A22" fill-opacity="0.28">
        <path d="M 0 0 L 82 0 C 66 18 44 26 30 42 C 18 56 14 78 0 92 Z" />
        <ellipse cx="46" cy="28" rx="14" ry="5.5" transform="rotate(-24 46 28)" />
        <ellipse cx="26" cy="60" rx="10" ry="4" transform="rotate(-58 26 60)" />
        <circle cx="68" cy="18" r="3.2" />
        <circle cx="82" cy="10" r="2.0" />
        <circle cx="18" cy="84" r="2.8" />
        <circle cx="38" cy="46" r="1.8" />
        <circle cx="56" cy="36" r="1.5" />
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
