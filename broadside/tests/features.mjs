// Combat features: shot types, boarding and prizes, fleet orders and damage numbers, driven with real taps.
import { launch, open, shot, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, {
  save: save({
    gold: 500, stars: { tutorial: 3 },
    fleet: [
      { name: 'Resolute', cls: 'frigate', up: { chain: 1, grape: 1 } },
      { name: 'Swift', cls: 'sloop', up: {} },
      { name: 'Kestrel', cls: 'sloop', up: {} },
    ],
  }),
});
const B = (fn, arg) => page.evaluate(fn, arg);
const tapRect = async (r) => page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);

await B(() => window.__broadside.startBattle('tortuga'));
await B(() => { const b = window.__broadside; b.S.selected = b.G.ships[0]; b.step(1); });

// ---------- Shot selector ----------
console.log('Shot types');
const chips = await B(() => window.__broadside.S.hud.ammo);
check(chips.length === 3, 'Resolute shows Round, Chain and Grape chips', failures);
const grape = chips.find((c) => c.kind === 'grape');
if (grape) await tapRect(grape);
check((await B(() => window.__broadside.G.ships[0].ammo)) === 'grape', 'tapping Grape loads grapeshot', failures);
const chain = chips.find((c) => c.kind === 'chain');
if (chain) await tapRect(chain);
check((await B(() => window.__broadside.G.ships[0].ammo)) === 'chain', 'tapping Chain loads chain shot', failures);

// Park an enemy brig on Resolute's beam and let the gun crews fire chain shot at it.
await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships.find((s) => s.team === 'enemy');
  G.ships.filter((s) => s.team === 'enemy' && s !== e).forEach((s) => { s.x = 40; s.y = 40; s.passive = true; });
  r.pivot = r.h; r.v = 0; r.reload = [0, 0];
  e.passive = true; e.v = 0; e.x = r.x + Math.cos(r.h + Math.PI / 2) * 150; e.y = r.y + Math.sin(r.h + Math.PI / 2) * 150;
  b.sim(90);
});
const slowed = await B(() => window.__broadside.G.ships.find((s) => s.team === 'enemy' && s.slowT > 0) != null);
check(slowed, 'chain shot hits leave the target with cut rigging', failures);
const floaters = await B(() => window.__broadside.S.floaters.length);
check(floaters > 0, `hits show damage numbers (${floaters})`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'f1-chain-shot');

// Grapeshot thins the crew.
await B(() => { const r = window.__broadside.G.ships[0]; r.ammo = 'grape'; r.reload = [0, 0]; });
const before = await B(() => window.__broadside.G.ships.find((s) => s.team === 'enemy' && s.passive && s.x > 50).marines);
await B(() => { const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships.find((s) => s.team === 'enemy' && s.x > 50); e.x = r.x + Math.cos(r.h + Math.PI / 2) * 95; e.y = r.y + Math.sin(r.h + Math.PI / 2) * 95; b.sim(60); });
const after = await B(() => window.__broadside.G.ships.find((s) => s.team === 'enemy' && s.passive && s.x > 50).marines);
check(after < before, `grapeshot kills marines (${before} -> ${after})`, failures);

// ---------- Boarding ----------
console.log('Boarding');
await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships.find((s) => s.team === 'enemy' && s.x > 50);
  e.hp = Math.round(e.maxHp * 0.3); e.marines = 15; e.passive = false; e.pivot = e.h; // a live (anchored) enemy, not a hulk
  e.x = r.x + Math.cos(r.h + Math.PI / 2) * 60; e.y = r.y + Math.sin(r.h + Math.PI / 2) * 60;
  r.reload = [9, 9]; b.S.selected = r; b.step(1);
});
const board = await B(() => window.__broadside.S.hud.actions.find((a) => a.kind === 'board'));
check(!!board, 'a Board! button shows beside a crippled enemy', failures);
if (board) await tapRect(board);
check(await B(() => !!window.__broadside.G.ships[0].boarding), 'tapping Board! starts a boarding action', failures);
await B(() => window.__broadside.step(120));
await shot(page, 'f2-boarding');
await B(() => window.__broadside.sim(200));
const prize = await B(() => window.__broadside.G.ships.find((s) => s.prize));
check(!!prize && prize.team === 'player', `the brig strikes and joins as a prize${prize ? ` (${prize.name})` : ''}`, failures);
await B(() => window.__broadside.step(20));
await shot(page, 'f3-prize');

// ---------- Fleet orders ----------
console.log('Fleet orders');
await B(() => window.__broadside.step(1));
const fleetCard = await B(() => window.__broadside.S.hud.cards.find((c) => c.fleet));
check(!!fleetCard, 'a Whole fleet card shows', failures);
if (fleetCard) await tapRect(fleetCard);
check(await B(() => window.__broadside.S.selectAll), 'tapping it selects the whole fleet', failures);
await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0];
  r.pivot = null;
  const cv = document.getElementById('hud'), rc = cv.getBoundingClientRect();
  const pts = [0, 2, 4, 6, 8, 10].map((i) => b.proj(r.x + i * 6, r.y - i * 30, i ? 0 : 8));
  const ev = (type, q) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: rc.left + q.x, clientY: rc.top + q.y }));
  ev('pointerdown', pts[0]); for (const q of pts.slice(1)) ev('pointermove', q); ev('pointerup', pts[pts.length - 1]);
});
const withPaths = await B(() => window.__broadside.G.ships.filter((s) => s.team === 'player' && s.state === 'afloat' && !s.boarding && s.path.length).length);
const fleetSize = await B(() => window.__broadside.G.ships.filter((s) => s.team === 'player' && s.state === 'afloat' && !s.boarding).length);
check(withPaths === fleetSize && fleetSize >= 3, `one drawn course moves every ship (${withPaths}/${fleetSize})`, failures);
await B(() => window.__broadside.step(30));
await shot(page, 'f4-fleet-orders');

// ---------- Spanish boarders ----------
console.log('Spanish boarders');
await B(() => {
  const b = window.__broadside, G = b.G;
  b.S.selectAll = false;
  const swift = G.ships.find((s) => s.name === 'Swift');
  const e = G.ships.find((s) => s.team === 'enemy' && s.state === 'afloat');
  swift.path = []; swift.pivot = swift.h; swift.hp = Math.round(swift.maxHp * 0.25); swift.marines = 4;
  e.passive = false; e.pivot = null; e.v = 0; e.marines = 15; e.hp = e.maxHp;
  e.x = swift.x + Math.cos(swift.h + Math.PI / 2) * 160; e.y = swift.y + Math.sin(swift.h + Math.PI / 2) * 160;
  G.ships.filter((s) => s.team === 'player').forEach((s) => { s.reload = [99, 99]; });
  e.reload = [99, 99];
});
let taken = false;
for (let i = 0; i < 40 && !taken; i++) taken = await B(() => { window.__broadside.sim(30); return window.__broadside.G.ships.find((s) => s.name === 'Swift').team === 'enemy'; });
check(taken, 'a Spanish ship closes, boards and takes a crippled English sloop', failures);
await B(() => window.__broadside.step(1));
const swiftCard = await B(() => { const c = window.__broadside.S.hud.cards.find((c) => c.ship && c.ship.name === 'Swift'); return !!c; });
check(swiftCard, 'the captured ship still shows in the fleet list', failures);
await shot(page, 'f6-captured');

// ---------- Prize money ----------
console.log('Prize money');
await B(() => { const G = window.__broadside.G; G.ships.filter((s) => s.team === 'enemy').forEach((s) => { s.hp = 0; s.state = 'sunk'; }); window.__broadside.sim(200); });
const award = await B(() => window.__broadside.G.award);
check(award && award.prizes === 1 && award.prizeGold > 0, `the win pays prize money (${award && award.prizeGold})`, failures);
check(award && award.stars === 2, `losing Swift to boarders costs a star (${award && award.stars} stars)`, failures);
await page.waitForTimeout(300);
await shot(page, 'f5-results');

check(page.errors.length === 0, `no page errors (${page.errors.length})`, failures);
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
