/**
 * Procedural SVG seasonal corner vignette overlay (Severe Winter white-blue crystalline frost
 * & East Europe Mud Season rasputitsa silt wash), framed in the 4 outer corners (~12-18% screen
 * reach per corner, fading cleanly to 0 before the map interior) beneath HUD panels so country
 * names, city labels, unit counters, and HUD widgets remain 100% legible.
 */
import { getTheaterSeasonSummary } from '../../sim/systems/weatherSystem';
import { simTickSig } from '../store/simStore';

function WinterCornerSvg({ flipClass }: { flipClass: string }) {
  const glowId = `frostGlow-${flipClass}`;
  const mistId = `frostMist-${flipClass}`;
  return (
    <svg
      class={`season-corner ${flipClass}`}
      viewBox="0 0 540 380"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId} cx="0%" cy="0%" r="96%" fx="4%" fy="4%">
          <stop offset="0%" stop-color="#F2FAFF" stop-opacity="0.88" />
          <stop offset="28%" stop-color="#CFEAFD" stop-opacity="0.62" />
          <stop offset="56%" stop-color="#A6D1EE" stop-opacity="0.34" />
          <stop offset="78%" stop-color="#84B6D8" stop-opacity="0.13" />
          <stop offset="100%" stop-color="#76A9CC" stop-opacity="0" />
        </radialGradient>
        <radialGradient id={mistId} cx="0%" cy="0%" r="72%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.58" />
          <stop offset="46%" stop-color="#DFF2FF" stop-opacity="0.26" />
          <stop offset="100%" stop-color="#B9DFF7" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="540" height="380" fill={`url(#${glowId})`} />

      {/* Translucent crystalline ice shards radiating from the corner */}
      <g fill={`url(#${mistId})`}>
        <polygon points="0,0 320,0 248,46 152,72 86,136 42,226 0,264" />
        <polygon points="0,48 214,22 174,88 110,122 52,196 0,218" opacity="0.72" />
        <polygon points="184,0 412,0 338,44 256,58 198,36" opacity="0.55" />
        <polygon points="0,170 68,142 96,204 48,284 0,322" opacity="0.52" />
      </g>

      {/* Cool ice-blue crystalline facet shadows */}
      <g stroke="#6DA4CC" stroke-opacity="0.46" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 4 86 L 116 58 L 222 18 L 318 4" stroke-width="2.1" />
        <path d="M 48 4 L 68 128 L 24 234 L 4 282" stroke-width="1.9" />
        <path d="M 86 66 L 194 94 L 288 64 L 368 28" stroke-width="1.5" />
        <path d="M 38 148 L 128 164 L 204 128 L 266 106" stroke-width="1.35" />
        <path d="M 14 232 L 94 218 L 154 184" stroke-width="1.2" stroke-opacity="0.34" />
      </g>

      {/* Crisp white-blue dendritic frost veins & fern branches */}
      <g stroke="#F4FBFF" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 0 82 L 114 54 L 220 14 L 324 0" stroke-width="2.0" stroke-opacity="0.82" />
        <path d="M 44 0 L 64 124 L 20 230 L 0 286" stroke-width="1.9" stroke-opacity="0.80" />
        <path d="M 82 62 L 192 90 L 286 60 L 374 22" stroke-width="1.55" stroke-opacity="0.68" />
        <path d="M 34 144 L 126 160 L 204 124 L 274 98" stroke-width="1.35" stroke-opacity="0.56" />
        <path d="M 10 228 L 92 214 L 158 178 L 214 158" stroke-width="1.15" stroke-opacity="0.44" />
        <path d="M 248 0 L 228 42 L 266 56 M 156 36 L 182 58 L 160 82" stroke-width="1.2" stroke-opacity="0.56" />
        <path d="M 114 54 L 138 92 L 106 122 M 64 124 L 98 140 L 82 178" stroke-width="1.2" stroke-opacity="0.54" />
        <path d="M 286 60 L 312 82 M 204 124 L 234 140 M 126 160 L 146 190" stroke-width="1.05" stroke-opacity="0.40" />
        <path d="M 342 36 L 386 52 M 248 108 L 288 118 M 158 178 L 178 210 M 72 248 L 108 258" stroke-width="0.95" stroke-opacity="0.32" />
      </g>

      {/* Scattered fine crystalline starlets & rime specks fading outward */}
      <g fill="#F6FCFF">
        <circle cx="174" cy="48" r="2.6" fill-opacity="0.72" />
        <circle cx="112" cy="110" r="2.4" fill-opacity="0.66" />
        <circle cx="268" cy="36" r="2.2" fill-opacity="0.58" />
        <circle cx="62" cy="186" r="2.2" fill-opacity="0.56" />
        <circle cx="222" cy="96" r="2.0" fill-opacity="0.48" />
        <circle cx="152" cy="154" r="1.9" fill-opacity="0.44" />
        <circle cx="338" cy="44" r="1.7" fill-opacity="0.36" />
        <circle cx="96" cy="242" r="1.7" fill-opacity="0.34" />
        <circle cx="282" cy="112" r="1.5" fill-opacity="0.28" />
        <circle cx="196" cy="184" r="1.4" fill-opacity="0.24" />
      </g>
    </svg>
  );
}

function MudCornerSvg({ flipClass }: { flipClass: string }) {
  const washId = `mudWash-${flipClass}`;
  const stainId = `mudStain-${flipClass}`;
  return (
    <svg
      class={`season-corner ${flipClass}`}
      viewBox="0 0 540 380"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={washId} cx="0%" cy="0%" r="96%" fx="4%" fy="4%">
          <stop offset="0%" stop-color="#362210" stop-opacity="0.86" />
          <stop offset="28%" stop-color="#53371B" stop-opacity="0.60" />
          <stop offset="56%" stop-color="#6B4A28" stop-opacity="0.32" />
          <stop offset="78%" stop-color="#785633" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#785836" stop-opacity="0" />
        </radialGradient>
        <radialGradient id={stainId} cx="0%" cy="0%" r="80%">
          <stop offset="0%" stop-color="#432A14" stop-opacity="0.62" />
          <stop offset="52%" stop-color="#5C3D1F" stop-opacity="0.30" />
          <stop offset="100%" stop-color="#6E4C2B" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="540" height="380" fill={`url(#${washId})`} />

      {/* Organic layered mud-silt tide washes fading softly from corner */}
      <path
        d="M 0 0 L 392 0 C 344 42 292 52 246 88 C 194 128 164 168 112 208 C 66 244 46 286 0 318 Z"
        fill={`url(#${stainId})`}
      />
      <path
        d="M 0 0 L 296 0 C 258 34 214 58 172 94 C 122 136 92 174 52 218 C 30 242 14 260 0 272 Z"
        fill="#3F2813"
        fill-opacity="0.34"
      />

      {/* Damp watercolor mud tide lines & organic silt splatters */}
      <g fill="none" stroke="#36210E" stroke-linecap="round">
        <path d="M 358 4 C 314 38 268 48 228 82 C 176 126 146 164 94 202 C 52 232 34 268 4 294" stroke-width="2.0" stroke-opacity="0.32" />
        <path d="M 274 6 C 236 36 196 58 158 92 C 110 134 82 172 44 214" stroke-width="1.6" stroke-opacity="0.28" />
        <path d="M 416 12 C 368 48 326 70 282 104 C 234 140 198 184 148 224" stroke-width="1.3" stroke-opacity="0.20" />
      </g>

      <g fill="#422A14">
        <ellipse cx="186" cy="112" rx="38" ry="12" transform="rotate(-26 186 112)" fill-opacity="0.34" />
        <ellipse cx="96" cy="216" rx="30" ry="10.5" transform="rotate(-48 96 216)" fill-opacity="0.32" />
        <ellipse cx="294" cy="54" rx="32" ry="9.5" transform="rotate(-16 294 54)" fill-opacity="0.28" />
        <ellipse cx="242" cy="148" rx="22" ry="7.5" transform="rotate(-32 242 148)" fill-opacity="0.22" />
        <ellipse cx="144" cy="242" rx="20" ry="7" transform="rotate(-42 144 242)" fill-opacity="0.22" />
        <ellipse cx="364" cy="34" rx="20" ry="6" transform="rotate(-12 364 34)" fill-opacity="0.20" />
        <circle cx="256" cy="94" r="6.0" fill-opacity="0.32" />
        <circle cx="332" cy="76" r="4.6" fill-opacity="0.26" />
        <circle cx="164" cy="186" r="5.5" fill-opacity="0.30" />
        <circle cx="116" cy="268" r="4.8" fill-opacity="0.26" />
        <circle cx="212" cy="198" r="4.0" fill-opacity="0.22" />
        <circle cx="298" cy="122" r="3.6" fill-opacity="0.22" />
        <circle cx="398" cy="54" r="3.4" fill-opacity="0.20" />
        <circle cx="74" cy="296" r="4.2" fill-opacity="0.24" />
        <circle cx="188" cy="252" r="3.0" fill-opacity="0.18" />
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
