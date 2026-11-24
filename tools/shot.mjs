#!/usr/bin/env node
/**
 * Headless Chrome + SwiftShader screenshot harness for Meridian 1936.
 * Usage:
 *   node tools/shot.mjs --url http://localhost:4173/meridian-1936/?autotest=1 --out shots/overview.png --w 1440 --h 900 --wait 400
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

function parseArgs(argv) {
  const out = {
    url: 'http://localhost:4173/meridian-1936/?autotest=1',
    out: 'shots/capture.png',
    w: 1440,
    h: 900,
    wait: 400,
    timeout: 30000,
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--url' && v) { out.url = v; i++; }
    else if (k === '--out' && v) { out.out = v; i++; }
    else if (k === '--w' && v) { out.w = Number(v); i++; }
    else if (k === '--h' && v) { out.h = Number(v); i++; }
    else if (k === '--wait' && v) { out.wait = Number(v); i++; }
    else if (k === '--timeout' && v) { out.timeout = Number(v); i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--window-size=${args.w},${args.h}`,
  ],
});

const consoleErrors = [];
const pageErrors = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: args.w, height: args.h, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('[browser error]', msg.text());
    } else if (msg.type() === 'warning') {
      console.warn('[browser warn]', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
    console.error('[pageerror]', String(err));
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const txt = `HTTP ${res.status()}: ${res.url()}`;
      consoleErrors.push(txt);
      console.error('[http]', txt);
    }
  });
  page.on('requestfailed', (req) => {
    const txt = `REQUEST FAILED: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`;
    consoleErrors.push(txt);
    console.error('[reqfail]', txt);
  });

  await page.goto(args.url, { waitUntil: 'networkidle0', timeout: args.timeout });
  await page.waitForFunction(() => window.__MERIDIAN_READY__ === true, { timeout: args.timeout });
  if (args.wait > 0) {
    await new Promise((r) => setTimeout(r, args.wait));
  }
  await page.screenshot({ path: args.out, type: 'png' });
  console.log(`[shot] saved ${args.out} (${args.w}x${args.h})`);
  if (consoleErrors.length || pageErrors.length) {
    console.error('[shot] ERRORS DETECTED:');
    for (const e of [...consoleErrors, ...pageErrors]) console.error('  -', e);
    process.exitCode = 1;
  } else {
    console.log('[shot] 0 console/page errors');
  }
} finally {
  await browser.close();
}
