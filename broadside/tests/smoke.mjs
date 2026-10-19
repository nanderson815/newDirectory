// End-to-end smoke test: menus, the tutorial with real touches, shipyard purchases, a fort capture,
// a boss with mines, and landscape. Screenshots land in tests/out/.
import { launch, open, shot, botPlay, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const allErrors = [];
const finish = (page) => allErrors.push(...page.errors);

// A quick finger gesture along map points (map coords), sent as one burst of pointer events so slow test
// machines can't split it. A single point is a tap.
async function dragAlong(page, pts) {
  await page.evaluate((pts) => {
    const cv = document.getElementById('hud'), r = cv.getBoundingClientRect();
    const scr = pts.map((p) => window.__broadside.proj(p.x, p.y, p.z || 0));
    const ev = (type, q) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + q.x, clientY: r.top + q.y }));
    ev('pointerdown', scr[0]);
    for (const q of scr.slice(1)) ev('pointermove', q);
    ev('pointerup', scr[scr.length - 1]);
  }, pts);
}
const tutStep = (page) => page.evaluate(() => window.__broadside.G.tut.step);

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
  await page.evaluate(() => { window.__broadside.step(20); window.__broadside.settle(); });
  await shot(page, '03-tutorial-step1');

  // Step 1: drag a course across open sea (not starting on Swift) to the buoy.
  const g = await page.evaluate(() => { const G = window.__broadside.G, s = G.ships[0]; return { s: { x: s.x, y: s.y }, b: G.buoy }; });
  const from = { x: g.s.x + (g.b.x - g.s.x) * 0.25 + 30, y: g.s.y + (g.b.y - g.s.y) * 0.25 };
  const pts = [from]; for (let i = 1; i <= 10; i++) pts.push({ x: from.x + (g.b.x - from.x) * i / 10, y: from.y + (g.b.y - from.y) * i / 10 });
  await dragAlong(page, pts);
  const plotted = await page.evaluate(() => window.__broadside.G.ships[0].path.length);
  check(plotted > 3, `a drag on open sea plots Swift's course (${plotted} points)`, failures);
  for (let i = 0; i < 20 && (await tutStep(page)) === 0; i++) await page.evaluate(() => window.__broadside.sim(30));
  check((await tutStep(page)) === 1, 'reaching the buoy advances to step 2', failures);

  // Step 2: tap the open sea to sail straight there.
  await page.evaluate(() => window.__broadside.settle());
  const tapAt = await page.evaluate(() => { const B = window.__broadside, s = B.G.ships[0]; return { x: Math.min(B.G.W - 60, s.x + 160), y: s.y - 60 }; });
  await dragAlong(page, [tapAt]);
  const tapped = await page.evaluate((t) => { const p = window.__broadside.G.ships[0].path; return p.length === 1 && Math.hypot(p[0].x - t.x, p[0].y - t.y) < 6; }, tapAt);
  check(tapped, 'a tap on the sea sets a straight course to that point', failures);
  await page.evaluate(() => window.__broadside.sim(5));
  check((await tutStep(page)) === 2, 'tapping the sea advances to step 3', failures);

  // Step 3: Anchor on the action bar, then drag around Swift to turn her on the spot.
  await page.evaluate(() => window.__broadside.step(1));
  const anchorBtn = await page.evaluate(() => window.__broadside.S.hud.actions.find((a) => a.kind === 'anchor'));
  check(!!anchorBtn && anchorBtn.w >= 44 && anchorBtn.h >= 44, 'the action bar has an Anchor button (44px or more)', failures);
  if (anchorBtn) await page.mouse.click(anchorBtn.x + anchorBtn.w / 2, anchorBtn.y + anchorBtn.h / 2);
  check(await page.evaluate(() => window.__broadside.G.ships[0].pivot != null), 'tapping Anchor anchors Swift', failures);
  const sw = await page.evaluate(() => { const s = window.__broadside.G.ships[0]; return { x: s.x, y: s.y, h: s.h }; });
  const arc = []; for (let i = 0; i <= 8; i++) { const a = sw.h + 0.4 + i * 0.25; arc.push({ x: sw.x + Math.cos(a) * 110, y: sw.y + Math.sin(a) * 110 }); }
  await dragAlong(page, arc);
  const piv = await page.evaluate(() => window.__broadside.G.ships[0].pivot);
  const want = Math.atan2(arc[8].y - sw.y, arc[8].x - sw.x);
  check(piv != null && Math.abs(Math.atan2(Math.sin(piv - want), Math.cos(piv - want))) < 0.15, 'dragging around an anchored ship turns her toward the finger', failures);
  await page.evaluate(() => window.__broadside.step(10));
  await shot(page, '04-tutorial-anchor');
  await page.evaluate(() => window.__broadside.sim(5));
  check((await tutStep(page)) === 3, 'anchor-and-turn advances to step 4', failures);

  // Step 4: tap the hulk to engage her.
  await page.evaluate(() => window.__broadside.settle());
  const hulk = await page.evaluate(() => { const h = window.__broadside.G.ships.find((s) => s.team === 'enemy'); return { x: h.x, y: h.y, z: 8, id: h.id }; });
  await dragAlong(page, [hulk]);
  const ord = await page.evaluate(() => { const s = window.__broadside.G.ships[0]; return { o: s.order, pivot: s.pivot }; });
  check(ord.o && ord.o.kind === 'engage' && ord.o.targetId === hulk.id && ord.pivot == null, 'tapping the hulk gives an engage order (and weighs anchor)', failures);
  await page.evaluate(() => window.__broadside.sim(5));
  check((await tutStep(page)) === 4, 'engaging advances to step 5', failures);
  await page.evaluate(() => window.__broadside.step(5));
  await shot(page, '05-tutorial-step4');

  // Step 5: Swift sinks the hulk on her own engage order (no bot at the helm).
  let r = null;
  for (let i = 0; i < 150 && !r; i++) r = await page.evaluate(() => { window.__broadside.sim(60); const G = window.__broadside.G; return G.endAt != null ? G.result : null; });
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__broadside.sim(200));
  check(r === 'win', 'tutorial is won: Swift sinks the hulk on her engage order', failures);
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
  // A sturdy test fleet: this checks the capture mechanics, not the battle's balance.
  await page.evaluate(() => window.__broadside.G.ships.filter((s) => s.team === 'player').forEach((s) => { s.hp = s.maxHp = s.maxHp * 6; }));
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
