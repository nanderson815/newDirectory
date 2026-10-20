// Screenshots of the Mediterranean: its chart, the hats cabinet, briefings, a results sheet and a few battles in
// play. Not part of npm test.
//   npm run build:single && OUT=/path node tests/med-shots.mjs
import fs from 'fs';
import path from 'path';
import { launch, open, save, ROOT, botPlay } from './lib.mjs';
import { BATTLES } from '../src/config/battles.js';

const OUT = process.env.OUT || path.join(ROOT, 'shots', 'med');
fs.mkdirSync(OUT, { recursive: true });
const stars = Object.fromEntries(BATTLES.filter((b) => b.world === 'caribbean').map((b) => [b.id, 3]));
const veteran = save({
  gold: 1840, stars: { ...stars, tangier: 3, gibraltar: 2, sale: 3 }, hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada', 'rover'], hired: 2,
  fleet: [
    { name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3 } }, { name: 'Swift', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } },
    { name: 'Kestrel', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } }, { name: 'Merlin', cls: 'frigate', up: {} }, { name: 'Osprey', cls: 'brig', up: {} },
  ],
});
const browser = await launch();
const page = await open(browser, { save: veteran, fonts: !!process.env.FONTS });
const snap = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 240000 }); console.log(name, page.errors.slice(-1).join('')); };

await page.click('#startBtn');
await snap('chart-med');
await page.click('#hatsBtn');
await snap('hats');
await page.click('#hatsBack');
for (const id of ['bougie', 'bagnio', 'tripoli', 'kapudan']) {
  await page.evaluate((i) => window.__broadside.openBrief(window.__broadside.battleIndex(i)), id);
  await snap('brief-' + id);
}
// Battles in play: the director's view a few seconds in, with the bot sailing.
for (const [id, secs] of [['tangier', 14], ['bougie', 16], ['bagnio', 22], ['goletta', 18], ['knights', 10], ['tripoli', 14], ['dia', 30], ['narrows', 18], ['kapudan', 24]]) {
  await page.evaluate((i) => { const b = window.__broadside; b.S.muted = true; b.startBattle(i); }, id);
  await botPlay(page, secs);
  await page.evaluate(() => { window.__broadside.step(30); });
  await snap('battle-' + id);
}
// A results sheet: Algiers won, with its hat and the log.
await page.evaluate(() => {
  const b = window.__broadside; b.startBattle('algiers');
  const G = b.G; for (const s of G.ships) if (s.team === 'enemy') s.state = 'sunk';
  b.sim(60 * 3);
});
await snap('end-algiers');
await page.evaluate(() => {
  const b = window.__broadside; b.startBattle('kapudan');
  const G = b.G; for (const s of G.ships) if (s.team === 'enemy') s.state = 'sunk';
  b.sim(60 * 3);
});
await snap('end-kapudan');
await browser.close();
