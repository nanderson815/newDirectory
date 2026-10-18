// Screenshots of the menus for eyeballing: sea chart (portrait and landscape), briefings with the captain's log,
// the boss intro card, the hat collection and a results screen. Not part of `npm test`; run after a single-file
// build with `node tests/ui-shots.mjs [outDir]` (default tests/out/ui).
import path from 'path';
import fs from 'fs';
import { launch, open, save, OUT } from './lib.mjs';

const dir = process.argv[2] || path.join(OUT, 'ui');
fs.mkdirSync(dir, { recursive: true });
const snap = (page, name) => page.screenshot({ path: path.join(dir, name + '.png') });
const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
const upTo = (n, st = (i) => 3 - (i % 3)) => Object.fromEntries(ids.slice(0, n).map((id, i) => [id, st(i)]));
const mid = save({ gold: 1240, stars: upTo(12), hats: ['cabin', 'rojo', 'comodoro', 'oro'], best: 7 });
const all = save({ gold: 5120, stars: upTo(19, () => 3), hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], best: 12 });

const browser = await launch();
const errors = [];
const done = async (page) => { errors.push(...page.errors); await page.context().close(); };

// Menu and chart, portrait, mid-campaign.
{
  const page = await open(browser, { save: mid });
  await snap(page, 'menu-portrait');
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  await snap(page, 'chart-portrait');
  await page.evaluate(() => { const c = document.getElementById('chartList'); c.scrollLeft = 0; });
  await page.waitForTimeout(100);
  await snap(page, 'chart-portrait-west');
  await page.click('[data-battle="12"]');
  await snap(page, 'brief-kate');
  await page.click('#briefBack');
  await page.click('[data-battle="11"]');
  await snap(page, 'brief-wreck');
  await done(page);
}
// Chart, landscape and a fresh campaign.
{
  const page = await open(browser, { width: 844, height: 390, save: mid });
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  await snap(page, 'chart-landscape');
  await done(page);
}
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3 }, hats: ['cabin'], gold: 60 }) });
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  await snap(page, 'chart-portrait-fresh');
  await done(page);
}
// The finished campaign, desktop size.
{
  const page = await open(browser, { width: 1280, height: 800, save: all });
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  await snap(page, 'chart-desktop-complete');
  await page.click('#hatsBtn');
  await snap(page, 'hats-all');
  await done(page);
}
// Briefings for the new goals, the boss card and a win.
{
  const page = await open(browser, { save: all });
  for (const id of ['convoy', 'siege', 'blockade', 'fog', 'armada']) {
    await page.evaluate((id) => window.__broadside.openBrief(window.__broadside.battleIndex(id)), id);
    await snap(page, 'brief-' + id);
  }
  const paused = await page.evaluate(() => { window.__broadsideIntro = true; window.__broadside.startBattle('kate'); return window.__broadside.G.phase; });
  await page.waitForTimeout(900);
  await snap(page, 'boss-card-kate');
  await page.evaluate(() => document.getElementById('bossIntro').click());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ phase: window.__broadside.G.phase, hidden: document.getElementById('bossIntro').hidden }));
  console.log(`boss card: phase while shown ${paused}, after tap ${after.phase}, card hidden ${after.hidden}`);
  await page.evaluate(() => window.__broadside.startBattle('armada'));
  await page.waitForTimeout(900);
  await snap(page, 'boss-card-armada');
  await page.waitForTimeout(2600);
  console.log('armada card auto-dismissed:', await page.evaluate(() => document.getElementById('bossIntro').hidden && window.__broadside.G.phase === 'play'));
  await page.evaluate(() => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); G.forts.forEach((f) => { f.state = 'silenced'; f.team = 'player'; }); window.__broadside.sim(300); });
  await page.waitForTimeout(2600);
  await snap(page, 'end-armada');
  await page.evaluate(() => { window.__broadside.startBattle('cove'); const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); });
  await page.waitForTimeout(2600);
  await snap(page, 'end-cove');
  await page.evaluate(() => { window.__broadside.startBattle('kate'); document.getElementById('bossIntro').click(); });
  await page.evaluate(() => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'player').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); });
  await snap(page, 'end-kate-lost');
  console.log('lost text:', await page.textContent('#endText'));
  await done(page);
}
{
  const page = await open(browser, { width: 844, height: 390, save: all });
  await page.evaluate(() => { window.__broadsideIntro = true; window.__broadside.startBattle('hierro'); });
  await page.waitForTimeout(900);
  await snap(page, 'boss-card-landscape');
  await done(page);
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
