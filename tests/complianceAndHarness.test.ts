import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_FLAG_TAGS, getFlagSvg } from '../src/assets/flags/neutralFlags';
import { parseUrlHarness } from '../src/debug/urlHarness';

describe('Asset Licensing & Neutral Flag Compliance', () => {
  it('verifies all neutral flags are valid SVGs with zero prohibited symbols', () => {
    const bannedPattern = /swastika|hakenkreuz|卐|卍|fasces|ss[-_ ]?rune|rising[-_ ]?sun/i;
    expect(ALL_FLAG_TAGS.length).toBeGreaterThanOrEqual(30);

    for (const tag of ALL_FLAG_TAGS) {
      const svg = getFlagSvg(tag);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(bannedPattern.test(svg)).toBe(false);
    }

    // Spot check GER Balkenkreuz (horizontal tricolor + 4 rects for cross), ITA Savoy shield, SOV star, JPN disc
    const ger = getFlagSvg('GER');
    expect(ger).toContain('#1C1C1C');
    expect(ger).toContain('#B52B27');
    expect(ger).toContain('translate(15,10)');

    const ita = getFlagSvg('ITA');
    expect(ita).toContain('#1E4D8C');

    const sov = getFlagSvg('SOV');
    expect(sov).toContain('#9E2421');
    expect(sov).toContain('polygon');

    const jpn = getFlagSvg('JPN');
    expect(jpn).toContain('#BC002D');
    expect(jpn).toContain('<circle');
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

  it('falls back safely on invalid or empty query params', () => {
    const p = parseUrlHarness('?mapmode=invalid&cam=abc&selectProv=-1');
    expect(p.autotest).toBe(false);
    expect(p.mapmode).toBe('political');
    expect(p.cam).toBeNull();
    expect(p.selectProv).toBeNull();
  });
});
