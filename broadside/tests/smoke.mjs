// End-to-end smoke test: menus, the tutorial with real touches, shipyard purchases, a fort capture,
// a boss with mines, and landscape. Screenshots land in tests/out/.
import { launch, open, shot, botPlay, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const allErrors = [];
const finish = (page) => allErrors.push(...page.errors);

// A quick finger drag along map points (map coords), sent as one gesture so slow test machines
// can't mistake it for a press-and-hold.
async function dragAlong(page, pts) {
  await page.evaluate((pts) => {
    const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
    const scr = pts.map((p) => window.__broadside.proj(p.x, p.y, p.z || 0));
    const ev = (type, q) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + q.x, clientY: r.top + q.y }));
    ev('pointerdown', scr[0]);
    for (const q of scr.slice(2)) ev('pointermove', q);
    ev('pointerup', scr[scr.length - 1]);
  }, pts);
}

// ---------- Fresh campaign: menu -> tutorial ----------
console.log('Tutorial');
{
  const page = await open(browser);
  await shot(page, '01-menu');
  check(await page.isVisible('#menuScreen'), 'menu shows on first load', failures);
  await page.click('#startBtn');
  check(await page.isVisible('#briefScreen'), 'first Set sail opens the tutorial briefing', failures);
  check((await page.textContent('#briefTitle')) === 'Shakedown Cruise', 'briefing is the Shakedown Cruise', failures);
  await shot(page, '02-tutorial-brief');
  await page.click('#sailBtn');
  check(await page.isVisible('#coach'), 'coach panel appears', failures);
  await page.evaluate(() => window.__broadside.step(20));
  await shot(page, '03-tutorial-step1');

  // Step 1: drag Swift to the buoy.
  const g = await page.evaluate(() => { const G = window.__broadside.G, s = G.ships[0]; return { s: { x: s.x, y: s.y, z: 8 }, b: G.buoy }; });
  const pts = [g.s]; for (let i = 1; i <= 12; i++) pts.push({ x: g.s.x + (g.b.x - g.s.x) * i / 12, y: g.s.y + (g.b.y - g.s.y) * i / 12 });
  await dragAlong(page, pts);
  for (let i = 0; i < 20 && (await page.evaluate(() => window.__broadside.G.tut.step)) === 0; i++) await page.evaluate(() => window.__broadside.sim(30));
  check((await page.evaluate(() => window.__broadside.G.tut.step)) === 1, 'reaching the buoy advances to step 2', failures);

  // Step 2: press and hold, then drag around.
  const at = await page.evaluate(() => { const s = window.__broadside.G.ships[0]; return { c: window.__broadside.proj(s.x, s.y, 8), e: window.__broadside.proj(s.x + 90, s.y, 0) }; });
  await page.mouse.move(at.c.x, at.c.y); await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(at.e.x, at.e.y, { steps: 4 });
  await page.evaluate(() => window.__broadside.step(10));
  await shot(page, '04-tutorial-anchor');
  await page.mouse.up();
  await page.evaluate(() => window.__broadside.sim(5));
  check((await page.evaluate(() => window.__broadside.G.tut.step)) === 2, 'hold-and-turn advances to step 3', failures);

  // Step 3: tap to raise the anchor.
  const c2 = await page.evaluate(() => { const s = window.__broadside.G.ships[0]; return window.__broadside.proj(s.x, s.y, 8); });
  await page.mouse.click(c2.x, c2.y);
  await page.evaluate(() => window.__broadside.sim(5));
  check((await page.evaluate(() => window.__broadside.G.tut.step)) === 3, 'tapping raises the anchor and advances to step 4', failures);
  await page.evaluate(() => window.__broadside.step(5));
  await shot(page, '05-tutorial-step4');

  // Step 4: sink the hulk (bot steers).
  const r = await botPlay(page, 120);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__broadside.sim(200));
  check(r === 'win', 'tutorial is won by sinking the hulk', failures);
  check(await page.isVisible('#endScreen'), 'results screen shows', failures);
  const sv = await page.evaluate(() => window.__broadside.save);
  check(sv.hats.includes('cabin'), "cabin boy's cap is awarded", failures);
  check(sv.gold > 0 && sv.stars.tutorial >= 1, `gold (${sv.gold}) and stars recorded`, failures);
  await shot(page, '06-tutorial-won');

  // On to the chart via the results screen.
  await page.click('#endChart');
  check(await page.isVisible('#chartScreen'), 'chart opens from results', failures);
  const open1 = await page.evaluate(() => [...document.querySelectorAll('#chartList [data-battle]')].map((b) => !b.disabled));
  check(open1[1] && open1[2] === false, 'battle I is open and battle II is locked', failures);
  await shot(page, '07-chart');
  finish(page);
  await page.context().close();
}

// ---------- Shipyard ----------
console.log('Shipyard');
{
  const page = await open(browser, { save: save({ gold: 2000, stars: { tutorial: 3, tortuga: 2 } }) });
  await page.click('#startBtn');
  await page.click('#yardBtn');
  check(await page.isVisible('#yardScreen'), 'shipyard opens', failures);
  await page.click('[data-ship="1"]');
  await page.click('[data-buy="refit"]');
  await page.click('[data-buy="guns"]');
  await page.click('[data-buy="chasers"]');
  await page.click('[data-buy="mines"]');
  await page.click('[data-buy="hire"]');
  const sv = await page.evaluate(() => window.__broadside.save);
  check(sv.fleet[1].cls === 'brig', 'Swift refits from sloop to brig', failures);
  check(sv.fleet[1].up.guns === 1 && sv.fleet[1].up.chasers === 1 && sv.fleet[1].up.mines === 1, 'guns, chasers and mines bought', failures);
  check(sv.fleet.length === 4 && sv.fleet[3].name === 'Merlin', 'Merlin hired', failures);
  check(sv.gold === 2000 - 150 - 90 - 120 - 100 - 220, `gold spent correctly (${sv.gold} left)`, failures);
  await page.click('[data-ship="1"]');
  await shot(page, '08-shipyard');
  // Upgraded ship shows up in battle with its new kit.
  await page.click('#yardBack');
  await page.click('[data-battle="2"]');
  await page.click('#sailBtn');
  const swift = await page.evaluate(() => { const s = window.__broadside.G.ships.find((x) => x.name === 'Swift'); return { type: s.type, guns: s.guns, chasers: s.chasers, mines: s.mines, n: window.__broadside.G.ships.filter((x) => x.team === 'player').length }; });
  check(swift.type === 'brig' && swift.guns === 4 && swift.chasers === 1 && swift.mines === 2 && swift.n === 4, 'upgrades and the hired ship appear in battle', failures);
  // Drop a mine with the on-screen button.
  await page.evaluate(() => { const B = window.__broadside; B.S.selected = B.G.ships.find((x) => x.name === 'Swift'); B.step(1); });
  const btn = await page.evaluate(() => window.__broadside.S.hud.actions.find((a) => a.kind === 'mine'));
  check(!!btn, 'Drop mine button shows for a ship with mines', failures);
  if (btn) await page.mouse.click(btn.x + btn.w / 2, btn.y + btn.h / 2);
  check((await page.evaluate(() => window.__broadside.G.mines.length)) === 1, 'tapping Drop mine lays a mine', failures);
  await page.evaluate(() => window.__broadside.step(90));
  await shot(page, '09-mine-and-chasers');
  finish(page);
  await page.context().close();
}

// ---------- Fort capture ----------
console.log('Fort capture');
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3, tortuga: 3, cayman: 3, rojo: 3 } }) });
  await page.evaluate(() => window.__broadside.startBattle('sanlucas'));
  await page.evaluate(() => window.__broadside.step(240));
  await shot(page, '10-fort');
  let silenced = false, captured = false;
  for (let i = 0; i < 300 && !captured; i++) {
    const st = await page.evaluate(() => { window.__bot.tick(); window.__broadside.sim(60); const f = window.__broadside.G.forts[0]; return { s: f.state, team: f.team, cap: !!f.capture, over: window.__broadside.G.endAt != null }; });
    if (st.s !== 'active' && !silenced) { silenced = true; await page.evaluate(() => window.__broadside.step(1)); await shot(page, '11-fort-silenced'); }
    if (st.cap) { await page.evaluate(() => window.__broadside.step(1)); await shot(page, '12-landing'); }
    if (st.team === 'player') captured = true;
    if (st.over) break;
  }
  check(silenced, 'the fort can be shot silent', failures);
  check(captured, 'landing troops captures the fort', failures);
  await page.evaluate(() => window.__broadside.sim(200));
  const res = await page.evaluate(() => window.__broadside.G.result);
  check(res === 'win', 'capturing the fort wins the battle', failures);
  finish(page);
  await page.context().close();
}

// ---------- Boss with mines ----------
console.log('Boss');
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3, tortuga: 3, cayman: 3, rojo: 3, sanlucas: 3, silver: 3, comodoro: 3, cartagena: 3, santamarta: 3 } }) });
  await page.click('#startBtn');
  await page.click('[data-battle="9"]');
  check(await page.isVisible('#briefBoss'), 'boss briefing shows the boss card', failures);
  await shot(page, '13-boss-brief');
  await page.click('#sailBtn');
  // A sturdy test fleet, so the check is about the boss's kit rather than the balance.
  await page.evaluate(() => window.__broadside.G.ships.filter((s) => s.team === 'player').forEach((s) => { s.hp = s.maxHp = s.maxHp * 6; }));
  for (let i = 0; i < 25; i++) await page.evaluate(() => { window.__bot.tick(); window.__broadside.sim(60); });
  await page.evaluate(() => window.__broadside.step(1));
  const st = await page.evaluate(() => ({ mines: window.__broadside.G.mines.filter((m) => m.team === 'enemy').length, boss: !!window.__broadside.G.ships.find((s) => s.boss) }));
  check(st.boss, 'the boss ship is in the battle', failures);
  check(st.mines > 0, `the boss lays sea mines (${st.mines})`, failures);
  await shot(page, '14-boss-battle');
  // Sink the boss directly to check the hat award path.
  await page.evaluate(() => { const b = window.__broadside.G.ships.find((s) => s.boss); b.hp = 1; });
  const r = await botPlay(page, 120);
  await page.evaluate(() => window.__broadside.sim(200));
  const sv = await page.evaluate(() => window.__broadside.save);
  check(r === 'win' && sv.hats.includes('oro'), "sinking the Almirante wins the admiral's hat", failures);
  await shot(page, '15-boss-won');
  await page.click('#endChart'); await page.click('#hatsBtn');
  await shot(page, '16-hats');
  finish(page);
  await page.context().close();
}

// ---------- Landscape ----------
console.log('Landscape');
{
  const page = await open(browser, { width: 844, height: 390, save: save({ stars: { tutorial: 3, tortuga: 3, cayman: 3 } }) });
  await page.evaluate(() => window.__broadside.startBattle('comodoro'));
  for (let i = 0; i < 12; i++) await page.evaluate(() => { window.__bot.tick(); window.__broadside.sim(60); });
  await page.evaluate(() => window.__broadside.step(1));
  check((await page.evaluate(() => window.__broadside.G.W > window.__broadside.G.H)), 'landscape lays the map out wide', failures);
  await shot(page, '17-landscape-boss-forts');
  await page.click('#hud', { position: { x: 844 - 30, y: 30 } });
  check(await page.isVisible('#pauseScreen'), 'pause button opens the pause screen', failures);
  await shot(page, '18-pause');
  finish(page);
  await page.context().close();
}

await browser.close();
check(allErrors.length === 0, `no page errors (${allErrors.length})`, failures);
if (allErrors.length) console.log(allErrors.slice(0, 10).join('\n'));
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
