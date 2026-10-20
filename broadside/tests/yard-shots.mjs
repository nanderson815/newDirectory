// Screenshots of the 3D shipyard for eyeballing: the default frigate, the great ship fully decked out, a sloop, a
// part lit from its key and a gun slot tapped on the model, in portrait and landscape; then a battle with the
// dressed squadron against seeded enemies. Not part of `npm test`; run after a single-file build with
// `node tests/yard-shots.mjs [outDir] [--only=name,...]` (default tests/out/yard).
import path from 'path';
import fs from 'fs';
import { launch, open, save, OUT } from './lib.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || path.join(OUT, 'yard');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(dir, { recursive: true });
const want = (n) => !only.length || only.some((o) => n.startsWith(o));
const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const DECKED = { paint: 'royal', cloth: 'white', emblem: 'crown', figurehead: 'lion', flag: 'admiral', lanterns: 3, gilding: 'almirante' };
const fleet = [
  { name: 'Resolute', cls: 'greatship', up: { hull: 3, sails: 1, chain: 1, grape: 1 }, look: DECKED,
    loadout: { portUpper: 'carronade', starboardUpper: 'carronade', forecastle: 'mortar', quarterdeck: 'firepot' } },
  { name: 'Swift', cls: 'frigate', up: { guns: 1, marines: 2 } },
  { name: 'Kestrel', cls: 'sloop', up: {}, look: { paint: 'verdigris', cloth: 'tan', emblem: 'anchor', figurehead: 'mermaid', flag: 'pennant', lanterns: 2 } },
  { name: 'Merlin', cls: 'brig', up: {}, look: { paint: 'black', cloth: 'striped', emblem: 'rose', figurehead: 'unicorn', flag: 'ensign', gilding: 'gilt' } },
  { name: 'Osprey', cls: 'frigate', up: {}, look: { paint: 'ochre', cloth: 'dyed', emblem: 'george', figurehead: 'eagle', flag: 'pennant', lanterns: 3, gilding: 'gilt' } },
];
const won = save({ gold: 3860, stars: Object.fromEntries(ids.map((id) => [id, 3])), hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], hired: 2, best: 9, fleet });
const plain = save({ gold: 640, stars: Object.fromEntries(ids.slice(0, 6).map((id) => [id, 3])), hats: ['cabin', 'rojo'] });

const browser = await launch();
const errors = [];
const snap = async (page, name) => {
  if (!want(name)) return;
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__broadside.yard.active && window.__broadside.yard.settle());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 240000, animations: 'disabled' });
  console.log('  ' + name);
};
const yard = async (page) => {
  await page.evaluate(() => window.__broadside.lockDpr(1.5));
  await page.click('#startBtn'); await page.waitForTimeout(300);
  await page.click('#yardBtn'); await page.waitForSelector('#yardScreen:not([hidden])');
  await page.waitForTimeout(900);
};
const tab = (page, i) => page.evaluate((i) => document.querySelector(`[data-ship="${i}"]`).click(), i);
const settle = (page) => page.evaluate(() => window.__broadside.yard.settle());

for (const [o, width, height] of [['p', 390, 844], ['l', 844, 390]]) {
  {
    const page = await open(browser, { width, height, save: plain, fonts: true });
    await yard(page);
    await snap(page, `default-${o}`);
    errors.push(...page.errors);
    await page.context().close();
  }
  const page = await open(browser, { width, height, save: won, fonts: true });
  await yard(page);
  await snap(page, `great-${o}`);
  // A part lit from its key: the figurehead, with its ledger section open.
  await page.click('.yard-key[data-part="figurehead"]');
  await page.waitForTimeout(1600); await settle(page);
  await snap(page, `hotspot-${o}`);
  // A gun slot tapped on the model itself: the larboard upper tier.
  await page.evaluate(() => window.__broadside.yard.aim('slot:portUpper')); await settle(page);
  await page.waitForTimeout(300);
  const at = await page.evaluate(() => window.__broadside.yard.partAt('slot:portUpper'));
  if (at) await page.mouse.click(at[0], at[1]);
  await page.waitForTimeout(1400); await settle(page);
  await snap(page, `slot-${o}`);
  await tab(page, 2);
  await page.waitForTimeout(1500);
  await snap(page, `sloop-${o}`);
  await tab(page, 3);
  await page.waitForTimeout(1500);
  await snap(page, `brig-${o}`);
  errors.push(...page.errors);
  await page.context().close();
}

// In battle: the dressed squadron closing with seeded enemies (a Spanish squadron, then pirates), close in.
const TIPS = ['fleet', 'ammo', 'mine', 'land', 'board', 'fireship', 'mortar', 'exit', 'chest', 'reach', 'protect', 'hunt', 'fog', 'rake', 'crit', 'shoal', 'reef'];
const fight = (faction) => ({
  name: 'Yard test', wind: -60, islands: [{ x: 0.88, y: 0.42, r: 26 }], faction,
  player: fleet.slice(0, 3).map((f, i) => ({ type: f.cls, name: f.name, x: 0.36 + i * 0.13, y: 0.58 + (i % 2) * 0.04, h: -90, look: f.look, loadout: f.loadout })),
  enemy: [['brig', 'Santa Ana'], ['brig', 'San Pedro'], ['frigate', 'Rosario'], ['brig', 'San Telmo']].map(([type, name], i) => ({ type, name, x: 0.32 + i * 0.12, y: 0.44 - (i % 2) * 0.04, h: 90, passive: true })),
  ai: { dmgMul: 0, spread: 0.1, reloadMul: 1, hpMul: 1 },
});
for (const [o, width, height] of [['p', 390, 844], ['l', 844, 390]]) {
  if (!want(`battle-${o}`) && !want(`battle-pirate-${o}`)) continue;
  const page = await open(browser, { width, height, save: { ...won, tips: TIPS }, fonts: true });
  for (const [name, faction] of [[`battle-${o}`, undefined], [`battle-pirate-${o}`, 'pirate']]) {
    if (!want(name)) continue;
    await page.evaluate((def) => {
      const B = window.__broadside;
      B.lockDpr(1.5);
      B.playDef(def); B.step(20);
      const G = B.G, cam = B.cam;
      cam.mode = 'manual'; cam.idle = 0;
      cam.tx = G.ships.reduce((a, s) => a + s.x, 0) / G.ships.length; cam.ty = G.ships.reduce((a, s) => a + s.y, 0) / G.ships.length;
      cam.d = Math.max(cam.dMin, cam.dComfort * 0.62);
      B.step(20);
    }, fight(faction));
    await snap(page, name);
  }
  errors.push(...page.errors);
  await page.context().close();
}
await browser.close();
console.log(`wrote ${dir}${errors.length ? `\nerrors: ${errors.join('\n')}` : ''}`);
