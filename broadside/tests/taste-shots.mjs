// Art-direction screenshots: every menu screen at three phone sizes (portrait 390x844, small 360x740,
// landscape 844x390), with the real Google Fonts served from a local cache (tests/fonts.mjs). Not part of
// `npm test`. After `npx vite build --mode single`: `node tests/taste-shots.mjs <outDir> [--offline] [--only=a,b]`
// (--sizes=psl picks sizes; --offline keeps the fallback faces, to check how the game looks without Google Fonts).
import path from 'path';
import fs from 'fs';
import { launch, open, save, OUT } from './lib.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || path.join(OUT, 'taste');
const fonts = !args.includes('--offline');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(dir, { recursive: true });

const ALL_SIZES = { p: [390, 844], s: [360, 740], l: [844, 390] };
const sizeArg = (args.find((a) => a.startsWith('--sizes=')) || '').slice(8);
const SIZES = Object.fromEntries(Object.entries(ALL_SIZES).filter(([k]) => !sizeArg || sizeArg.includes(k)));
const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const upTo = (n, st = (i) => 3 - (i % 3)) => Object.fromEntries(ids.slice(0, n).map((id, i) => [id, st(i)]));
const mid = save({ gold: 1240, stars: upTo(12), hats: ['cabin', 'rojo', 'comodoro', 'oro'], best: 7 });
const all = save({ gold: 5120, stars: upTo(19, () => 3), hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], best: 12 });
const fresh = save({ stars: { tutorial: 3 }, hats: ['cabin'], gold: 60 });

const browser = await launch();
const errors = [];
const settle = (page, ms = 1500) => page.waitForTimeout(ms);
// The 3D sea at 1x and a 4 fps game loop: on a loaded machine the renderer otherwise starves the screenshots.
// (CSS animations run on their own clock, so the menus' motion is unaffected.)
const calm = (page) => page.evaluate(() => {
  window.__broadside.lockDpr(1);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => setTimeout(() => raf(cb), 250);
});
const want = (name) => !only.length || only.some((o) => name.startsWith(o));

for (const [sz, [width, height]] of Object.entries(SIZES)) {
  const snap = async (page, name) => {
    if (!want(name)) return;
    // Finite CSS animations are fast-forwarded to their end, so a slow machine can't catch a screen mid-fade.
    await page.screenshot({ path: path.join(dir, `${name}-${sz}.png`), timeout: 240000, animations: 'disabled' });
  };
  const page = await open(browser, { width, height, save: mid, fonts });
  await calm(page);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await settle(page, 1200);
  await snap(page, 'menu');
  await page.click('#startBtn');
  await settle(page);
  await snap(page, 'chart');
  await page.click('#yardBtn');
  await settle(page);
  await snap(page, 'yard');
  await page.click('#yardBack');
  await page.click('#hatsBtn');
  await settle(page);
  await snap(page, 'hats');
  await page.click('#hatsBack');
  await settle(page, 400);
  await page.click('[data-battle="12"]');
  await settle(page);
  await snap(page, 'brief-boss');
  await page.evaluate(() => window.__broadside.openBrief(window.__broadside.battleIndex('siege')));
  await settle(page);
  await snap(page, 'brief-siege');
  // Pause: hiding the page pauses the battle.
  await page.evaluate(() => {
    window.__broadside.startBattle('siege');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  await settle(page);
  await snap(page, 'pause');
  // A win with a hat, and a loss.
  await page.evaluate(() => { window.__broadside.startBattle('kate'); const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); });
  await settle(page, 2600);
  await snap(page, 'end-win');
  await page.evaluate(() => { window.__broadside.startBattle('cove'); const G = window.__broadside.G; G.ships.filter((s) => s.team === 'player').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); });
  await settle(page, 1600);
  await snap(page, 'end-loss');
  // Boss intro card.
  // Hold the card up: on a loaded machine the screenshot can take longer than the card's 2.8 s timer.
  await page.evaluate(() => {
    const st = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => st(fn, ms === 2800 ? 1e9 : ms, ...a);
    window.__broadsideIntro = true; window.__broadside.startBattle('oro');
    window.setTimeout = st;
  });
  await settle(page, 1100);
  await snap(page, 'boss-intro');
  await page.evaluate(() => document.getElementById('bossIntro').click());
  // Tutorial coach.
  await page.evaluate(() => { window.__broadside.startBattle('tutorial'); });
  await settle(page, 900);
  await snap(page, 'coach');
  errors.push(...page.errors);
  await page.context().close();

  // A fresh campaign's chart, and the finished one.
  for (const [name, s] of [['chart-fresh', fresh], ['chart-done', all]]) {
    if (!want(name)) continue;
    const pg = await open(browser, { width, height, save: s, fonts });
    await calm(pg);
    await settle(pg, 600);
    await pg.click('#startBtn');
    await settle(pg);
    await snap(pg, name);
    errors.push(...pg.errors);
    await pg.context().close();
  }
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
