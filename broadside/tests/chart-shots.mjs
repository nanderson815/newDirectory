// Screenshots of the two sea charts and the switch between them, at portrait 390x844, small 360x740 and landscape
// 844x390, with the real fonts (tests/fonts.mjs). Not part of `npm test`. After `npx vite build --mode single`:
//   node tests/chart-shots.mjs [outDir] [--only=med-mid,switch] [--sizes=psl]
// Each state is a save: the West Indies fresh, mid-campaign and finished (with the Mediterranean's tab locked, then
// open); the Mediterranean the first time it is laid on the table (with its note), fresh, mid-campaign and finished;
// a tap on the locked tab; a turn from one plate to the other; and the cabinet and the title page once both are open.
import path from 'path';
import fs from 'fs';
import { launch, open, save, ROOT } from './lib.mjs';
import { BATTLES } from '../src/config/battles.js';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'shots', 'chart2');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const sizeArg = (args.find((a) => a.startsWith('--sizes=')) || '').slice(8);
fs.mkdirSync(dir, { recursive: true });
const ALL_SIZES = { p: [390, 844], s: [360, 740], l: [844, 390] };
const SIZES = Object.entries(ALL_SIZES).filter(([k]) => !sizeArg || sizeArg.includes(k));

const CARIB = BATTLES.filter((b) => b.world === 'caribbean').map((b) => b.id);
const MED = BATTLES.filter((b) => b.world === 'med').map((b) => b.id);
const won = (ids, n, st = (i) => 3 - (i % 3)) => Object.fromEntries(ids.slice(0, n).map((id, i) => [id, st(i)]));
const CARIB_HATS = ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'];
const fleet = [{ name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3 } }, { name: 'Swift', cls: 'frigate', up: { guns: 1 } },
  { name: 'Kestrel', cls: 'frigate', up: {} }, { name: 'Merlin', cls: 'brig', up: {} }];
const allCarib = won(CARIB, CARIB.length, () => 3);
const STATES = {
  'carib-fresh': save({ stars: { tutorial: 3 }, hats: ['cabin'], gold: 60 }),
  'carib-mid': save({ gold: 1240, stars: won(CARIB, 12), hats: ['cabin', 'rojo', 'comodoro', 'oro'], best: 7 }),
  'carib-done': save({ gold: 5120, stars: allCarib, hats: CARIB_HATS, best: 12, fleet, world: 'caribbean', seenWorlds: ['med'] }),
  'med-new': save({ gold: 5120, stars: allCarib, hats: CARIB_HATS, best: 12, fleet, world: 'caribbean' }),
  'med-fresh': save({ gold: 5120, stars: allCarib, hats: CARIB_HATS, best: 12, fleet, world: 'med', seenWorlds: ['med'] }),
  'med-mid': save({ gold: 2380, stars: { ...allCarib, ...won(MED, 8) }, hats: [...CARIB_HATS, 'rover', 'kalpak'], best: 12, fleet, world: 'med', seenWorlds: ['med'] }),
  'med-done': save({ gold: 9480, stars: { ...allCarib, ...won(MED, MED.length, (i) => (i % 5 ? 3 : 2)) }, hats: [...CARIB_HATS, 'rover', 'kalpak', 'osman', 'corno', 'kavuk'],
    best: 12, fleet, world: 'med', seenWorlds: ['med'] }),
};
const want = (name) => !only.length || only.some((o) => name.startsWith(o));

const browser = await launch();
const errors = [];
// The 3D sea at 1x and a slow game loop, so a loaded machine can't starve the screenshots (see taste-shots.mjs).
const calm = (page) => page.evaluate(() => {
  window.__broadside.lockDpr(1);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => setTimeout(() => raf(cb), 250);
});
for (const [sz, [width, height]] of SIZES) {
  const snap = (page, name) => page.screenshot({ path: path.join(dir, `${name}-${sz}.png`), timeout: 240000, animations: 'disabled' });
  const start = async (s) => {
    const page = await open(browser, { width, height, save: s, fonts: true });
    await calm(page);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(600);
    return page;
  };
  for (const [name, s] of Object.entries(STATES)) {
    const shots = [name, ...(name === 'carib-fresh' ? ['switch-locked'] : []), ...(name === 'med-mid' ? ['switch-turned', 'hats', 'menu'] : [])];
    if (!shots.some(want)) continue;
    const page = await start(s);
    if (want('menu') && name === 'med-mid') await snap(page, 'menu');
    await page.click('#startBtn');
    await page.waitForTimeout(1200);
    if (want(name)) await snap(page, name);
    if (name === 'carib-fresh' && want('switch-locked')) {
      await page.click('#worldTabs .wtab.locked', { force: true }); // aria-disabled, but a tap still says what opens it
      await page.waitForTimeout(500);
      await snap(page, 'switch-locked');
    }
    if (name === 'med-mid') {
      if (want('switch-turned')) {
        await page.click('#worldBtn');
        await page.waitForTimeout(900);
        await snap(page, 'switch-turned');
        await page.click('#worldBtn');
        await page.waitForTimeout(300);
      }
      if (want('hats')) {
        await page.click('#hatsBtn');
        await page.waitForTimeout(1200);
        await snap(page, 'hats');
      }
    }
    errors.push(...page.errors);
    await page.context().close();
  }
  console.log('size', sz, 'done');
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
