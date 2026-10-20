// Screenshots of the great ship for eyeballing: the shipyard offering her after La Gran Armada, her gun decks in
// the ledger (a slot closed and open, portrait and landscape), and her action bar and arcs in battle with two
// tiers of different reach. Not part of `npm test`; run after a single-file build with
// `node tests/loadout-shots.mjs [outDir]` (default tests/out/loadout).
import path from 'path';
import fs from 'fs';
import { launch, open, save, OUT } from './lib.mjs';

const dir = process.argv[2] || path.join(OUT, 'loadout');
fs.mkdirSync(dir, { recursive: true });
const snap = (page, name) => page.screenshot({ path: path.join(dir, name + '.png'), timeout: 180000 });
const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const fleet = [
  { name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3, sails: 1, chain: 1, grape: 1 } },
  { name: 'Swift', cls: 'frigate', up: { guns: 1, marines: 2 } },
  { name: 'Kestrel', cls: 'frigate', up: { hull: 1 } },
  { name: 'Merlin', cls: 'brig', up: {} },
  { name: 'Osprey', cls: 'brig', up: { mines: 2 } },
];
const won = save({ gold: 2860, stars: Object.fromEntries(ids.map((id) => [id, 3])), hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], hired: 2, best: 9, fleet });

const browser = await launch();
const errors = [];
const yard = async (page) => { await page.click('#startBtn'); await page.waitForTimeout(300); await page.click('#yardBtn'); await page.waitForSelector('#yardScreen:not([hidden])'); await page.waitForTimeout(600); };

{
  const page = await open(browser, { save: won, fonts: true });
  await yard(page);
  await snap(page, 'yard-offer');
  await page.click('[data-buy="great"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelector('.lo-head').scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  await snap(page, 'yard-gun-decks');
  await page.click('[data-slot="portUpper"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('[data-slot-row="portUpper"]').scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200);
  await snap(page, 'yard-slot-open');
  await page.click('[data-buy="fit:portUpper:carronade"]');
  await page.evaluate(() => { const g = window.__broadside.guns; window.__broadside.save.gold += 600; g.fitGun(0, 'forecastle', 'mortar'); g.fitGun(0, 'quarterdeck', 'firepot'); g.fitGun(0, 'portLower', 'demicannon'); });
  await page.click('[data-ship="1"]'); await page.click('[data-ship="0"]');
  await page.click('[data-slot="starboardLower"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('[data-slot-row="starboardLower"]').scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200);
  await snap(page, 'yard-too-heavy');
  errors.push(...page.errors);
  await page.context().close();
}
{
  const page = await open(browser, { width: 844, height: 390, save: won, fonts: true });
  await page.evaluate(() => { window.__broadside.guns.buyGreatShip(0); });
  await yard(page);
  await page.click('[data-slot="forecastle"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('[data-slot-row="forecastle"]').scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  await snap(page, 'yard-landscape');
  errors.push(...page.errors);
  await page.context().close();
}
// In battle: the great ship with long guns below and carronades above, guns on Manual, one tier loaded.
{
  const page = await open(browser, { save: won, fonts: true });
  await page.evaluate(() => {
    const b = window.__broadside;
    b.setFire('manual');
    b.playDef({
      name: 'Gun drill', wind: 0, islands: [{ x: 0.85, y: 0.3, r: 30 }],
      player: [{ type: 'greatship', name: 'Resolute', x: 0.5, y: 0.6, h: -90, loadout: { portUpper: 'carronade', starboardUpper: 'carronade', forecastle: 'mortar', quarterdeck: 'firepot' } }],
      enemy: [{ type: 'galleon', name: 'San Pedro', x: 0.2, y: 0.5, h: -90, passive: true }, { type: 'brig', name: 'Santa Ana', x: 0.75, y: 0.45, h: -90, passive: true }],
      ai: { dmgMul: 0 },
    });
    b.step(30);
    const s = b.G.ships[0];
    for (const x of s.batteries) x.t = x.slot === 'portUpper' ? 0 : x.slot === 'portLower' ? 1.6 : x.slot.startsWith('starboard') ? 0.9 : x.t;
    b.S.selected = s; b.settle(); b.step(2);
  });
  await page.waitForTimeout(300);
  await snap(page, 'battle-manual');
  await page.evaluate(() => { const b = window.__broadside; b.setFire('auto'); b.step(90); });
  await snap(page, 'battle-auto');
  errors.push(...page.errors);
  await page.context().close();
}
await browser.close();
console.log(`wrote ${dir}${errors.length ? `\nerrors: ${errors.join('\n')}` : ''}`);
