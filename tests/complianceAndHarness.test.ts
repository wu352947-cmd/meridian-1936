import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FLAG_TAGS, getFlagSvg } from '../src/assets/flags/neutralFlags';
import { getLandmarkSvg } from '../src/assets/landmarks/capitalLandmarks';
import { parseUrlHarness } from '../src/debug/urlHarness';
import { PLAYABLE_TAG_LIST } from '../src/sim/data/nations1936';

describe('Asset Licensing & Neutral Flag Compliance', () => {
  it('verifies all >=29 playable European countries and neutral flags have zero prohibited symbols', () => {
    const bannedPattern = /swastika|hakenkreuz|卐|卍|fasces|ss[-_ ]?rune|rising[-_ ]?sun|sunburst|wolfsangel/i;
    expect(PLAYABLE_TAG_LIST.length).toBeGreaterThanOrEqual(29);
    expect(ALL_FLAG_TAGS.length).toBeGreaterThanOrEqual(35);

    const tagSet = new Set(ALL_FLAG_TAGS);
    for (const tag of PLAYABLE_TAG_LIST) {
      expect(tagSet.has(tag), `Missing SVG flag for playable tag: ${tag}`).toBe(true);
    }

    for (const tag of ALL_FLAG_TAGS) {
      const svg = getFlagSvg(tag);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(bannedPattern.test(svg), `Prohibited token in flag ${tag}`).toBe(false);
    }

    // GER: Black-White-Red tricolor + straight-armed Balkenkreuz (zero swastika / rotated cross)
    const ger = getFlagSvg('GER');
    expect(ger).toContain('#1C1C1C');
    expect(ger).toContain('#F2EFE9');
    expect(ger).toContain('#B52B27');
    expect(ger).toContain('translate(15,10)');
    expect(ger).not.toMatch(/rotate\(/i);

    // ITA: Green-White-Red vertical tricolor + Savoy blue shield (zero fasces)
    const ita = getFlagSvg('ITA');
    expect(ita).toContain('#007A3D');
    expect(ita).toContain('#1E4D8C');

    // SOV: Simplified crimson flag + golden 5-point star (zero portraits)
    const sov = getFlagSvg('SOV');
    expect(sov).toContain('#9E2421');
    expect(sov).toContain('polygon');

    // JPN: Hinomaru white + red disc only (zero rising-sun rays)
    const jpn = getFlagSvg('JPN');
    expect(jpn).toContain('#BC002D');
    expect(jpn).toContain('<circle');
    expect(jpn).not.toContain('<polygon');
    expect(jpn).not.toContain('<line');
    expect(jpn).not.toContain('<path');

    // Landmark engraving SVGs also pass clean check
    for (const lid of ['berlin', 'london', 'paris', 'moscow', 'rome', 'warsaw', 'madrid', 'prague', 'compass']) {
      const svg = getLandmarkSvg(lid);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(bannedPattern.test(svg)).toBe(false);
    }
  });

  it('verifies ASSET_LICENSES.json contains only open commercial-safe licenses and existing files', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/assets/ASSET_LICENSES.json');
    const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Array<{
      assetId: string;
      files: string[];
      license: string;
      sourceUrl: string;
    }>;
    expect(entries.length).toBeGreaterThanOrEqual(6);

    for (const e of entries) {
      expect(e.license).not.toMatch(/NC|NonCommercial|ND|NoDerivs|GPL/i);
      expect(e.sourceUrl.startsWith('https://')).toBe(true);
      for (const rel of e.files) {
        const abs = path.resolve(process.cwd(), rel);
        expect(fs.existsSync(abs), `Missing licensed file: ${rel}`).toBe(true);
      }
    }
  });
});

describe('Deterministic URL Harness Parser', () => {
  it('parses autotest, mapmode, cam, selectProv, hoverProv and lang', () => {
    const p = parseUrlHarness('?autotest=1&mapmode=terrain&cam=1966,1355,2.8&selectProv=55&hoverProv=383&lang=zh');
    expect(p.autotest).toBe(true);
    expect(p.mapmode).toBe('terrain');
    expect(p.cam).toEqual({ x: 1966, y: 1355, zoom: 2.8 });
    expect(p.selectProv).toBe(55);
    expect(p.hoverProv).toBe(383);
    expect(p.lang).toBe('zh');
  });

  it('parses Batch 02 country_select and scenario/country/date parameters', () => {
    const def = parseUrlHarness('');
    expect(def.screen).toBe('country_select');
    expect(def.country).toBe('GER');

    const selGer = parseUrlHarness('?autotest=1&screen=country_select&country=GER');
    expect(selGer.autotest).toBe(true);
    expect(selGer.screen).toBe('country_select');
    expect(selGer.country).toBe('GER');

    const fraGame = parseUrlHarness('?scenario=1936&country=FRA&date=1936-03-15&panel=industry');
    expect(fraGame.screen).toBe('game');
    expect(fraGame.country).toBe('FRA');
    expect(fraGame.date).toBe('1936-03-15');
    expect(fraGame.panel).toBe('industry');
  });

  it('falls back safely on invalid or empty query params', () => {
    const p = parseUrlHarness('?mapmode=invalid&cam=abc&selectProv=-1');
    expect(p.autotest).toBe(false);
    expect(p.mapmode).toBe('political');
    expect(p.cam).toBeNull();
    expect(p.selectProv).toBeNull();
  });
});
