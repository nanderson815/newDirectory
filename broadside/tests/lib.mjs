// Shared Playwright helpers. Tests run against the single-file build (npm run build:single).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
export const OUT = path.join(here, 'out');
export const PAGE = 'file://' + path.join(ROOT, 'dist-single', 'index.html');
fs.mkdirSync(OUT, { recursive: true });

export async function launch() {
  const opts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

// Opens the game. `save` seeds the campaign save; `fresh` clears it. `fonts: true` serves the real Google Fonts
// from a local cache (tests/fonts.mjs) for screenshots; otherwise the page runs on its offline fallback faces.
export async function open(browser, { width = 390, height = 844, save = null, fonts = false, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: width < height, reducedMotion });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  if (fonts) await (await import('./fonts.mjs')).routeFonts(page);
  else await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  // The single-file build loads three.js from jsDelivr; serve the installed copy so tests run offline.
  await page.route('https://cdn.jsdelivr.net/npm/three@*/build/three.module.js', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/three/build/three.module.js'), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.addInitScript((s) => {
    try { localStorage.clear(); if (s) localStorage.setItem('broadside.save.v1', JSON.stringify(s)); } catch (e) { /* ignore */ }
  }, save);
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__broadside && window.__broadside.G, null, { timeout: 60000 });
  await page.addScriptTag({ path: path.join(here, 'bot.js') });
  return page;
}

// Generous timeout: on a busy machine a WebGL page can take minutes to hand over a frame.
export const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 240000 });

// Runs the bot captain for up to `secs` of game time; returns the battle result or null.
export async function botPlay(page, secs = 240) {
  for (let t = 0; t < secs; t += 1) {
    const r = await page.evaluate(() => { window.__bot.tick(); window.__broadside.sim(60); const G = window.__broadside.G; return G.phase === 'over' || G.endAt != null ? G.result : null; });
    if (r) return r;
  }
  return null;
}

export function check(cond, msg, failures) {
  if (!cond) failures.push(msg);
  console.log((cond ? '  ok   ' : '  FAIL ') + msg);
}

export const save = (o = {}) => Object.assign({
  v: 1, gold: 0, stars: {}, hats: [], hired: 0,
  fleet: [
    { name: 'Resolute', cls: 'frigate', up: {} },
    { name: 'Swift', cls: 'sloop', up: {} },
    { name: 'Kestrel', cls: 'sloop', up: {} },
  ],
}, o);
