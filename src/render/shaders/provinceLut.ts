import { BufferImageSource, Shader, TextureSource } from 'pixi.js';

export const PROVINCE_LUT_VERT = /* glsl */ `
precision highp float;

attribute vec2 aPosition;
attribute vec2 aUV;

varying vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  vUV = aUV;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const PROVINCE_LUT_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUV;

uniform sampler2D uProvIdTex;
uniform sampler2D uReliefTex;
uniform sampler2D uPrimaryLut;
uniform sampler2D uSecondaryLut;
uniform sampler2D uOccupierLut;

uniform vec2 uMapSize;
uniform float uZoom;
uniform float uMode; // 0=political, 1=terrain, 2=supply, 3=diplomacy, 4=industry, 5=air_sea
uniform float uColorblind; // 0=standard, 1=Okabe-Ito colorblind-safe

float decodeId(vec4 raw) {
  float r = floor(raw.r * 255.0 + 0.5);
  float g = floor(raw.g * 255.0 + 0.5);
  return r + g * 256.0;
}

float sampleOwner(vec2 uv) {
  vec4 idRaw = texture2D(uProvIdTex, clamp(uv, 0.0, 1.0));
  float pid = decodeId(idRaw);
  float u = (pid + 0.5) / 4096.0;
  return texture2D(uSecondaryLut, vec2(u, 0.5)).r;
}

float sampleProvId(vec2 uv) {
  return decodeId(texture2D(uProvIdTex, clamp(uv, 0.0, 1.0)));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec4 idRaw = texture2D(uProvIdTex, vUV);
  float provId = decodeId(idRaw);
  float coastDist = idRaw.b; // 0..1 normalized distance from coast
  float lutU = (provId + 0.5) / 4096.0;

  vec4 prim = texture2D(uPrimaryLut, vec2(lutU, 0.5));
  vec4 sec = texture2D(uSecondaryLut, vec2(lutU, 0.5));
  vec4 occ = texture2D(uOccupierLut, vec2(lutU, 0.5));
  vec3 relief = texture2D(uReliefTex, vUV).rgb;

  bool isSea = prim.a < 0.5;
  float myOwner = sec.r;
  float gByte = floor(sec.g * 255.0 + 0.5);
  bool isSelCountry = gByte >= 127.5;
  bool isConstructing = mod(gByte, 128.0) >= 63.5;
  bool isSupplyZero = mod(gByte, 64.0) >= 31.5;
  float weatherCode = mod(gByte, 4.0); // 0=normal, 1=winter, 2=mud
  bool isSelProv = sec.b > 0.5;
  bool isHoverProv = sec.a > 0.5;

  if (isSea) {
    // Antique nautical chart ocean: relief bathymetry + coastal shelf wash + dual ripple rings
    vec3 col = relief;
    float dPx = coastDist * 96.0;
    float shelf = exp(-dPx / 22.0);
    vec3 shallowTint = vec3(0.285, 0.388, 0.462);
    col = mix(col, shallowTint, shelf * 0.28);

    // Subtle engraved double coastal hachure lines
    float ring1 = smoothstep(1.4, 0.0, abs(dPx - 5.5)) * 0.16;
    float ring2 = smoothstep(1.6, 0.0, abs(dPx - 12.5)) * 0.09;
    float ring3 = smoothstep(1.8, 0.0, abs(dPx - 21.0)) * 0.05;
    col += vec3(0.68, 0.78, 0.84) * (ring1 + ring2 + ring3);

    if (isHoverProv) {
      col = clamp(col * vec3(1.13, 1.15, 1.17) + vec3(0.018, 0.026, 0.032), 0.0, 1.0);
    }
    if (isSelProv) {
      col = mix(col, vec3(0.76, 0.58, 0.42), 0.22);
    }
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  // Land: detect proximity to international border / coastline across 2 rings for watercolor inner wash
  vec2 px = 1.0 / uMapSize;
  float rInner = clamp(4.5 / sqrt(max(uZoom, 0.45)), 2.0, 6.5);
  float rOuter = clamp(12.5 / sqrt(max(uZoom, 0.45)), 5.5, 16.0);

  float diffInner = 0.0;
  float diffOuter = 0.0;

  // 8 directional taps at inner & outer radii
  vec2 d0 = vec2(1.0, 0.0);
  vec2 d1 = vec2(-1.0, 0.0);
  vec2 d2 = vec2(0.0, 1.0);
  vec2 d3 = vec2(0.0, -1.0);
  vec2 d4 = vec2(0.707, 0.707);
  vec2 d5 = vec2(-0.707, 0.707);
  vec2 d6 = vec2(0.707, -0.707);
  vec2 d7 = vec2(-0.707, -0.707);

  diffInner += step(0.002, abs(sampleOwner(vUV + d0 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d1 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d2 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d3 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d4 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d5 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d6 * rInner * px) - myOwner));
  diffInner += step(0.002, abs(sampleOwner(vUV + d7 * rInner * px) - myOwner));

  diffOuter += step(0.002, abs(sampleOwner(vUV + d0 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d1 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d2 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d3 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d4 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d5 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d6 * rOuter * px) - myOwner));
  diffOuter += step(0.002, abs(sampleOwner(vUV + d7 * rOuter * px) - myOwner));

  float edgeNear = clamp(diffInner / 3.0, 0.0, 1.0);
  float edgeWide = clamp(diffOuter / 4.5, 0.0, 1.0);
  float borderBand = clamp(edgeNear * 0.72 + edgeWide * 0.42, 0.0, 1.0);

  // Watercolor fill alpha: crisp mineral pigment near international border, luminous interior letting relief breathe
  float baseAlpha = mix(0.36, 0.78, borderBand);
  vec3 reliefBase = clamp((relief - 0.52) * 1.32 + 0.54, 0.0, 1.0);
  float hillStrength = 0.42;
  float multiplyMix = 0.56;

  if (uMode > 0.5 && uMode < 1.5) {
    // Terrain mode: heightened Alps/Carpathian hillshade relief + organic topographic wash
    reliefBase = clamp((relief - 0.50) * 1.56 + 0.53, 0.0, 1.0);
    baseAlpha = mix(0.42, 0.56, borderBand);
    hillStrength = 0.28;
    multiplyMix = 0.52;
  } else if (uMode > 1.5 && uMode < 2.5) {
    // M3 Supply lens: smooth monotonic choropleth gradient from hubs outward without border wash flattening
    reliefBase = clamp((relief - 0.50) * 1.06 + 0.58, 0.0, 1.0);
    baseAlpha = mix(0.78, 0.83, borderBand);
    hillStrength = 0.20;
    multiplyMix = 0.34;
  } else if (uMode >= 2.5) {
    // Diplomacy & industry modes: crisp thematic choropleth clarity while preserving relief depth
    reliefBase = clamp((relief - 0.52) * 1.24 + 0.54, 0.0, 1.0);
    baseAlpha = mix(0.46, 0.78, borderBand);
    hillStrength = 0.30;
    multiplyMix = 0.50;
  }

  // Gentle mineral chroma lift + paper multiply blend so relief mountain shadows breathe cleanly
  vec3 pigment = prim.rgb;
  float luma = dot(pigment, vec3(0.299, 0.587, 0.114));
  vec3 vividPigment = clamp(mix(vec3(luma), pigment, 1.15), 0.0, 1.0);
  vec3 multiplied = reliefBase * mix(vec3(1.0), vividPigment * 1.24, baseAlpha);
  vec3 alphaMixed = mix(reliefBase, vividPigment, baseAlpha * 0.82);
  vec3 col = mix(alphaMixed, multiplied, multiplyMix);

  // Sculptural hillshade relief accent so mountains & rolling hills remain legible in political mode
  float relLuma = dot(relief, vec3(0.299, 0.587, 0.114));
  float hillAccent = clamp((relLuma - 0.69) * hillStrength, -0.15, 0.13);
  col *= (1.0 + hillAccent);

  // Zoom-aware tactile fine linen weave + watercolor paper mottling (prevents blurry upscaled flat plains)
  vec2 mapPos = vUV * uMapSize;
  float mottle = (vnoise(mapPos * 0.016) * 0.62 + vnoise(mapPos * 0.048) * 0.38) - 0.5;
  float linenVis = smoothstep(0.95, 2.20, uZoom);
  float fineVis = smoothstep(1.50, 2.95, uZoom);
  float warp = sin(mapPos.x * 3.65 + mottle * 1.8);
  float weft = sin(mapPos.y * 3.65 - mottle * 1.8);
  float weaveCross = (warp + weft) * 0.25;
  float tooth = vnoise(mapPos * 0.72) - 0.5;
  float microGrain = vnoise(mapPos * 2.10) - 0.5;
  float paperTex = mottle * 0.068 + (weaveCross * 0.018 + tooth * 0.038) * linenVis + microGrain * 0.024 * fineVis;
  col += vec3(1.04, 1.00, 0.92) * paperTex;

  // Whisper-subtle per-province hand-tinted wash variation when zoomed in (separates adjacent plains gently)
  float provJitter = fract(sin(provId * 127.1 + 311.7) * 43758.5453) - 0.5;
  float jitterAmt = mix(0.012, 0.046, smoothstep(0.95, 2.25, uZoom));
  if (uMode > 0.5 && uMode < 1.5) jitterAmt *= 0.55;
  if (uMode > 1.5 && uMode < 2.5) jitterAmt *= 0.28;
  col *= (1.0 + provJitter * jitterAmt);

  // Visible yet legible regional seasonal wash in affected climate zones (cold frost blue-grey / damp mud umber)
  bool isSupplyMode = uMode > 1.5 && uMode < 2.5;
  if (weatherCode > 0.5 && weatherCode < 1.5) {
    float frostDrift = vnoise(mapPos * 0.022) * 0.55 + vnoise(mapPos * 0.095) * 0.45;
    float frostFine = vnoise(mapPos * 0.26);
    float colLuma = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 cooled = mix(col, vec3(colLuma) * vec3(0.88, 0.95, 1.04), isSupplyMode ? 0.16 : 0.30);
    float winterAmt = isSupplyMode ? 0.25 : 0.34;
    col = mix(cooled, vec3(0.75, 0.84, 0.93), clamp(winterAmt + (frostDrift - 0.5) * 0.09 + (frostFine - 0.5) * 0.04, 0.14, 0.44));
  } else if (weatherCode >= 1.5 && weatherCode < 2.5) {
    float mudPatch = vnoise(mapPos * 0.024) * 0.56 + vnoise(mapPos * 0.088) * 0.44;
    float siltFine = vnoise(mapPos * 0.22);
    vec3 dampBase = col * (isSupplyMode ? vec3(0.96, 0.93, 0.87) : vec3(0.92, 0.87, 0.79));
    float mudAmt = isSupplyMode ? 0.22 : 0.37;
    col = mix(dampBase, vec3(0.39, 0.28, 0.17), clamp(mudAmt + (mudPatch - 0.5) * 0.12 + (siltFine - 0.5) * 0.05, 0.14, 0.48));
  }

  // M3 Supply cut-off (S=0): screen-pixel-space black-red (or navy-orange CB) diagonal hatching (zero Moire)
  if (isSupplyZero && isSupplyMode) {
    float supStripe = step(mod(gl_FragCoord.x + gl_FragCoord.y, 10.0), 4.0);
    vec3 darkStripe = uColorblind > 0.5 ? vec3(0.09, 0.12, 0.17) : vec3(0.11, 0.07, 0.07);
    vec3 alertStripe = uColorblind > 0.5 ? vec3(0.87, 0.40, 0.08) : vec3(0.69, 0.17, 0.14);
    col = mix(darkStripe, alertStripe, supStripe);
  }

  // Subtle ink darkening right along the inner international frontier (softer in supply mode to preserve gradient)
  col *= (1.0 - edgeNear * (isSupplyMode ? 0.03 : 0.075));

  // Selected country: ultra-subtle warm presence (NO heavy red wash on other provinces!)
  if (isSelCountry && !isSelProv) {
    col = clamp(col * vec3(1.03, 1.025, 1.015), 0.0, 1.0);
  }

  // Hovered province: texture-preserving parchment & brass lift (keeps linen weave + mountain hillshade)
  if (isHoverProv) {
    vec3 lifted = col * vec3(1.14, 1.12, 1.07) + reliefBase * vec3(0.055, 0.048, 0.030);
    col = mix(col, clamp(lifted, 0.0, 1.0), 0.85);
  }

  // Active military occupation dual-color diagonal stripes in screen pixel space (zero Moire at all zooms)
  if (occ.a > 0.5 && uMode < 0.5) {
    float occStripe = step(mod(gl_FragCoord.x + gl_FragCoord.y, 10.0), 4.0);
    vec3 occTint = clamp(mix(vec3(dot(occ.rgb, vec3(0.299, 0.587, 0.114))), occ.rgb, 1.18), 0.0, 1.0);
    vec3 occMul = reliefBase * mix(vec3(1.0), occTint * 1.24, 0.72);
    vec3 occCol = mix(mix(reliefBase, occTint, 0.62), occMul, 0.52);
    col = mix(col, occCol, occStripe * 0.84);
  }

  // Active construction ochre-gold diagonal hatching across the region
  if (isConstructing) {
    float stripe = step(mod(gl_FragCoord.x + gl_FragCoord.y, 11.0), 3.6);
    col = mix(col, vec3(0.89, 0.69, 0.27), stripe * 0.44);
  }

  // Selected province: soft vermilion inner edge glow (#B83A2D) + relief-preserving warm lift
  if (isSelProv) {
    float rSel = clamp(4.0 / sqrt(max(uZoom, 0.5)), 1.8, 5.5);
    float diffProv = 0.0;
    diffProv += step(0.5, abs(sampleProvId(vUV + d0 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d1 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d2 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d3 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d4 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d5 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d6 * rSel * px) - provId));
    diffProv += step(0.5, abs(sampleProvId(vUV + d7 * rSel * px) - provId));
    float selEdge = clamp(diffProv / 3.2, 0.0, 1.0);
    vec3 lifted = col * vec3(1.08, 1.05, 1.01) + reliefBase * vec3(0.032, 0.024, 0.014);
    col = clamp(lifted, 0.0, 1.0);
    col = mix(col, vec3(0.75, 0.25, 0.19), selEdge * 0.42);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function createProvinceLutShader(
  provIdSource: BufferImageSource,
  reliefSource: TextureSource,
  primaryLutSource: BufferImageSource,
  secondaryLutSource: BufferImageSource,
  occupierLutSource: BufferImageSource,
  mapWidth: number,
  mapHeight: number,
): Shader {
  return Shader.from({
    gl: {
      vertex: PROVINCE_LUT_VERT,
      fragment: PROVINCE_LUT_FRAG,
    },
    resources: {
      uProvIdTex: provIdSource,
      uReliefTex: reliefSource,
      uPrimaryLut: primaryLutSource,
      uSecondaryLut: secondaryLutSource,
      uOccupierLut: occupierLutSource,
      mapUniforms: {
        uMapSize: { value: [mapWidth, mapHeight], type: 'vec2<f32>' },
        uZoom: { value: 1.0, type: 'f32' },
        uMode: { value: 0.0, type: 'f32' },
        uColorblind: { value: 0.0, type: 'f32' },
      },
    },
  });
}
