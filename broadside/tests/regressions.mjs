// Regression checks for bugs found in review, plus the Endless Skirmish loop.
import { launch, open, check, save, shot, PAGE } from './lib.mjs';

const failures = [];
const browser = await launch();
const ev = (page, fn, arg) => page.evaluate(fn, arg);

// ---------- A snapshot from an older build must not stop the game from booting ----------
console.log('Old snapshot');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://cdn.jsdelivr.net/npm/three@*/build/three.module.js', (r) => r.fulfill({ path: new URL('../node_modules/three/build/three.module.js', import.meta.url).pathname, contentType: 'application/javascript' }));
  await page.addInitScript(() => {
    // The shape the pre-campaign build saved: no forts, mines or goal.
    window.claude = { hot: { data: { G: { battle: 0, W: 620, H: 1200, ships: [{ id: 1, team: 'player', x: 100, y: 100, h: 0 }], islands: [], phase: 'play', wind: { dir: 0, base: 0 } }, selectedId: 1 } } };
  });
  await page.goto(PAGE);
  await page.waitForTimeout(2500);
  const c1 = await page.evaluate(() => window.__broadside && window.__broadside.S.clock);
  // A loaded machine's software renderer can take over a second per frame: wait (up to 30 s) for the clock to move.
  await page.waitForFunction((c) => window.__broadside && window.__broadside.S.clock > c, c1, { timeout: 30000, polling: 200 }).catch(() => {});
  const c2 = await page.evaluate(() => window.__broadside && window.__broadside.S.clock);
  check(c2 > c1, `the game loop keeps running after an old snapshot (clock ${c1 && c1.toFixed(2)} -> ${c2 && c2.toFixed(2)})`, failures);
  check(await page.isVisible('#menuScreen'), 'it falls back to the main menu', failures);
  check(errors.length === 0, `no page errors (${errors.join('; ')})`, failures);
  await ctx.close();
}

const allStars = { tutorial: 3, tortuga: 3, cayman: 3, rojo: 3, sanlucas: 3, silver: 3, comodoro: 3, cartagena: 3, santamarta: 3 };

// ---------- A capture battle with no marines left ends instead of running forever ----------
console.log('Capture stalemate');
{
  const page = await open(browser, { save: save({ stars: allStars }) });
  await ev(page, () => window.__broadside.startBattle('cartagena'));
  await ev(page, () => { window.__broadside.G.ships.filter((s) => s.team === 'player').forEach((s) => { s.marines = 5; }); window.__broadside.sim(200); });
  const st = await ev(page, () => ({ result: window.__broadside.G.result, phase: window.__broadside.G.phase }));
  check(st.result === 'lose' && st.phase === 'over', `out of marines ends the battle as a defeat (${st.result}, ${st.phase})`, failures);
  check((await page.textContent('#endText')).includes('marines'), 'the results explain it was the marines', failures);
  await page.context().close();
}

// ---------- Pausing during the victory countdown still pays the win ----------
console.log('Pause after winning');
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
  await ev(page, () => window.__broadside.startBattle('tortuga'));
  await ev(page, () => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(30); });
  await page.click('#hud', { position: { x: 360, y: 30 } }); // pause button
  check(await page.isVisible('#endScreen'), 'pause during the countdown jumps to the results', failures);
  const sv = await ev(page, () => window.__broadside.save);
  check(sv.stars.tortuga === 3 && sv.gold > 0, 'the win is recorded', failures);
  await page.context().close();
}

// ---------- One landing party per ship; mines capped ----------
console.log('Landing and mines');
{
  const page = await open(browser, { save: save({ stars: allStars }) });
  await ev(page, () => window.__broadside.startBattle('santamarta'));
  const r = await ev(page, () => {
    const B = window.__broadside, G = B.G, s = G.ships[0];
    G.forts.forEach((f) => { f.state = 'silenced'; });
    const [a, b] = G.forts, ia = G.islands[a.island];
    s.marines = 30; s.v = 0;
    s.x = ia.x + ia.r * 1.05 + s.L * 0.42 + 10; s.y = ia.y;
    const first = B.startLanding(s, a);
    // Pretend the second fort is in reach too: the same ship's boats can't be in two places.
    b.x = a.x; b.y = a.y; b.island = a.island;
    const second = B.startLanding(s, b);
    for (let i = 0; i < 40; i++) B.dropMine(Object.assign(s, { mines: 99 }));
    return { first, second, mines: G.mines.length };
  });
  check(r.first && !r.second, 'a ship already landing troops cannot start a second landing', failures);
  const many = await ev(page, () => { const B = window.__broadside, s = B.G.ships[0]; for (let i = 0; i < 80; i++) B.dropMine(s); return B.G.mines.length; });
  check(many <= 60, `live mines are capped (${many})`, failures);
  await page.context().close();
}

// ---------- Endless Skirmish ----------
console.log('Endless Skirmish');
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3, tortuga: 2 } }) });
  await page.click('#startBtn');
  const node = await page.$('[data-battle="endless"]');
  check(!!node && !(await node.isDisabled()), 'the skirmish is open after winning the first battle', failures);
  await node.click();
  check((await page.textContent('#briefTitle')) === 'Endless Skirmish', 'the skirmish briefing shows', failures);
  await page.click('#sailBtn');
  const w1 = await ev(page, () => window.__broadside.G.ships.filter((s) => s.team === 'enemy').length);
  await ev(page, () => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); });
  const st = await ev(page, () => ({ wave: window.__broadside.G.wave, enemies: window.__broadside.G.ships.filter((s) => s.team === 'enemy' && s.state === 'afloat').length }));
  check(st.wave === 2 && st.enemies > 0, `beating wave 1 brings wave 2 (${w1} then ${st.enemies} ships)`, failures);
  await ev(page, () => window.__broadside.step(60));
  await shot(page, 'r1-endless-wave2');
  // Jump ahead to a flagship wave.
  const boss = await ev(page, () => { const G = window.__broadside.G; G.wave = 4; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(300); return G.ships.some((s) => s.boss && s.state === 'afloat'); });
  check(boss, 'wave 5 brings a flagship', failures);
  await ev(page, () => window.__broadside.step(30));
  await shot(page, 'r2-endless-flagship');
  await ev(page, () => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'player').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(200); });
  const sv = await ev(page, () => window.__broadside.save);
  check(await page.isVisible('#endScreen'), 'losing the fleet ends the skirmish', failures);
  check(sv.best === 4 && sv.gold >= 120, `best wave and wave gold are saved (best ${sv.best}, gold ${sv.gold})`, failures);
  await shot(page, 'r3-endless-results');
  check(page.errors.length === 0, `no page errors (${page.errors.slice(0, 3).join('; ')})`, failures);
  await page.context().close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
