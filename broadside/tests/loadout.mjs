// The great ship and her guns: save v2 (a v1 save migrates without losing anything), the great ship offered once
// La Gran Armada is won, fitting a slot at the shipyard and what it costs, and every gun kind in a small ad-hoc
// battle (window.__broadside.playDef): carronades hold fire until the enemy is in reach, swivels speak at pistol
// shot, chasers keep to their arcs, fire-pots set ships alight, the deck mortar lobs shells, weight slows her, and
// Fire port fires only that side's loaded batteries.
import { launch, open, check } from './lib.mjs';

const failures = [];
const browser = await launch();

// A campaign that has beaten the Armada, as a v1 save (the shape of every save made before v2).
const STARS = { tutorial: 3, tortuga: 3, cayman: 2, rojo: 3, sanlucas: 3, silver: 2, comodoro: 3, cartagena: 3, santamarta: 1, oro: 3, cove: 3, wreck: 2, kate: 3, convoy: 3, siege: 2, hierro: 3, fog: 3, blockade: 2, armada: 3 };
const V1 = {
  v: 1, gold: 2400, stars: STARS, hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], hired: 2, best: 7,
  tips: ['ammo', 'mine', 'rake', 'crit'],
  fleet: [
    { name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3, sails: 1, chasers: 1, chain: 1, grape: 1 } },
    { name: 'Swift', cls: 'frigate', up: { guns: 1, marines: 2 } },
    { name: 'Kestrel', cls: 'frigate', up: { hull: 1 } },
    { name: 'Merlin', cls: 'brig', up: {} },
    { name: 'Osprey', cls: 'brig', up: { mines: 2 } },
  ],
};

// ---------- Save v2 ----------
console.log('Save v2');
let page = await open(browser, { save: V1 });
let B = (fn, arg) => page.evaluate(fn, arg);
const sv = await B(() => ({ save: window.__broadside.save, stored: JSON.parse(localStorage.getItem('broadside.save.v2') || 'null'), old: JSON.parse(localStorage.getItem('broadside.save.v1') || 'null') }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(sv.save.v === 2, `a v1 save loads as v2 (v ${sv.save.v})`, failures);
check(sv.save.gold === V1.gold && same(sv.save.stars, V1.stars) && same(sv.save.hats, V1.hats) && sv.save.hired === V1.hired && sv.save.best === V1.best && same(sv.save.tips, V1.tips),
  'gold, stars, hats, hires, the skirmish best and tips all survive', failures);
check(sv.save.fleet.length === 5 && sv.save.fleet.every((f, i) => f.name === V1.fleet[i].name && f.cls === V1.fleet[i].cls && same(f.up, V1.fleet[i].up)),
  'every fleet ship keeps her name, class and fittings', failures);
check(sv.save.fleet.every((f) => f.loadout && typeof f.loadout === 'object' && f.look && typeof f.look === 'object' && !Object.keys(f.look).length),
  'and gains a loadout and an empty look', failures);
check(sv.stored && sv.stored.v === 2 && sv.old && sv.old.v === 1, 'the migrated save is stored as v2; the v1 copy is left as it was', failures);
const remig = await B((s) => { const m = window.__broadside.guns.migrate(s); return m && m.v === 2 && JSON.stringify(window.__broadside.guns.migrate(m)) === JSON.stringify(m); }, V1);
check(remig, 'migrating twice changes nothing', failures);

// ---------- The great ship at the shipyard ----------
console.log('Shipyard');
await B(() => document.getElementById('yardBtn').click());
await page.waitForSelector('#yardScreen:not([hidden])');
const greatRow = async () => B(() => !!document.querySelector('[data-buy="great"]'));
check(await greatRow(), 'after La Gran Armada the shipyard offers to rebuild Resolute as a great ship', failures);
let yard = await B(() => ({ text: document.querySelector('[data-buy="great"]').closest('.up-row').textContent, gold: window.__broadside.save.gold }));
check(/great ship/.test(yard.text) && /1,000/.test(yard.text), `for 1,000 gold from a man-o'-war ("${yard.text.replace(/\s+/g, ' ').trim()}")`, failures);
await B(() => { document.querySelectorAll('[data-ship]')[1].click(); });
check(/1,500/.test(await B(() => document.querySelector('[data-buy="great"]').closest('.up-row').textContent)), 'and 1,500 from a frigate', failures);
await B(() => { document.querySelectorAll('[data-ship]')[3].click(); });
check(!(await greatRow()), 'never from a brig', failures);
await B(() => { document.querySelectorAll('[data-ship]')[0].click(); });
await B(() => document.querySelector('[data-buy="great"]').click());
let st = await B(() => ({ f: window.__broadside.save.fleet[0], gold: window.__broadside.save.gold, rows: [...document.querySelectorAll('[data-slot]')].map((b) => b.dataset.slot), again: !!document.querySelector('[data-buy="great"]') }));
check(st.f.cls === 'greatship' && st.gold === 1400, `buying her makes Resolute a great ship and costs 1,000 (gold ${st.gold})`, failures);
check(Object.keys(st.f.loadout).length === 8 && st.f.loadout.portLower === 'long' && st.f.loadout.forecastle === 'swivel', 'with the default loadout in every slot', failures);
check(st.rows.join() === 'portLower,portUpper,starboardLower,starboardUpper,bow,stern,forecastle,quarterdeck', `the ledger lists her gun decks slot by slot (${st.rows.join(', ')})`, failures);
check(!st.again && !(await B(() => { document.querySelectorAll('[data-ship]')[1].click(); return !!document.querySelector('[data-buy="great"]'); })), 'one great ship to a squadron', failures);
check(!(await B(() => { document.querySelectorAll('[data-ship]')[0].click(); return !!document.querySelector('[data-buy="guns"]') || !!document.querySelector('[data-buy="chasers"]'); })), 'her slots replace the extra-guns and chasers upgrades', failures);

// Fit carronades on the larboard upper tier.
await B(() => document.querySelector('[data-slot="portUpper"]').click());
const opts = await B(() => [...document.querySelectorAll('.lo-options [data-buy], .lo-options .buy.maxed')].map((b) => b.dataset.buy || 'fitted'));
check(opts.join() === 'fitted,fit:portUpper:carronade,fit:portUpper:swivel', `the upper tier opens on the guns it takes (${opts.join(', ')})`, failures);
await B(() => document.querySelector('[data-buy="fit:portUpper:carronade"]').click());
st = await B(() => ({ f: window.__broadside.save.fleet[0], gold: window.__broadside.save.gold, open: !!document.querySelector('.lo-options'), desc: document.querySelector('[data-slot-row="portUpper"] .up-desc').textContent }));
check(st.f.loadout.portUpper === 'carronade' && st.gold === 1400 - 4 * 45, `carronades fitted for 4 × 45 gold (gold ${st.gold}), and the ledger says so ("${st.desc}")`, failures);
// Demi-cannon below on both sides, long guns above and a mortar forward and aft is more than she can carry.
await B(() => {
  const g = window.__broadside.guns, sv = window.__broadside.save;
  sv.gold += 2000;
  return [g.fitGun(0, 'portLower', 'demicannon'), g.fitGun(0, 'starboardLower', 'demicannon'), g.fitGun(0, 'portUpper', 'long'), g.fitGun(0, 'forecastle', 'mortar')];
});
const heavy = await B(() => { const g = window.__broadside.guns, f = window.__broadside.save.fleet[0], gold = window.__broadside.save.gold; const o = g.fitOffer(f, 'quarterdeck', 'mortar'); const ok = g.fitGun(0, 'quarterdeck', 'mortar'); return { o, ok, gold: window.__broadside.save.gold === gold, w: g.fleetStats(f).weight }; });
check(heavy.o.over && !heavy.ok && heavy.gold, `a second mortar would make her overweight (${heavy.o.weight} of 92 tons): refused, no gold spent`, failures);
await B(() => { document.querySelectorAll('[data-ship]')[1].click(); document.querySelectorAll('[data-ship]')[0].click(); document.querySelector('[data-slot="quarterdeck"]').click(); });
const heavyRow = await B(() => { const b = document.querySelector('[data-buy="fit:quarterdeck:mortar"]'); return { disabled: b.disabled, note: b.closest('.up-row').textContent }; });
check(heavyRow.disabled && /too heavy/.test(heavyRow.note), 'the ledger greys it out as too heavy', failures);
const speeds = await B(() => window.__broadside.guns.fleetStats(window.__broadside.save.fleet[0]));
check(speeds.weight > 64.8 && speeds.speed < 42 * 1.07, `heavier guns show as a slower ship in her particulars (${speeds.weight} tons, speed ${speeds.speed})`, failures);
check(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`, failures);
await page.context().close();

// ---------- The Armada win opens the great ship ----------
console.log('After the Armada');
const notYet = { ...V1, stars: { ...STARS } };
delete notYet.stars.armada;
page = await open(browser, { save: notYet });
B = (fn, arg) => page.evaluate(fn, arg);
check(!(await B(() => window.__broadside.guns.greatOffer(window.__broadside.save.fleet[0]))), 'before La Gran Armada is won there is no great ship', failures);
const armada = await B(() => {
  const b = window.__broadside;
  b.startBattle('armada'); b.step(1);
  const felipe = b.G.ships.find((s) => s.name === 'Real Felipe');
  const info = { type: felipe.type, guns: felipe.batteries.map((x) => x.gun) };
  felipe.hp = 0; felipe.state = 'sinking';
  b.sim(60 * 8);
  return { ...info, result: b.G.result, stars: b.save.stars.armada || 0, offer: !!b.guns.greatOffer(b.save.fleet[0]) };
});
check(armada.type === 'greatship' && armada.guns.includes('demicannon') && armada.guns.includes('mortar') && armada.guns.includes('swivel'),
  `the Real Felipe is Spain's great ship, with demi-cannon, swivels and a mortar (${armada.guns.join(', ')})`, failures);
check(armada.result === 'win' && armada.stars > 0 && armada.offer, 'winning La Gran Armada puts the great ship on offer', failures);
await page.context().close();

// ---------- Guns in battle ----------
console.log('Guns in battle');
page = await open(browser, { save: V1 });
B = (fn, arg) => page.evaluate(fn, arg);
// A lab battle: one ship of ours against a passive brig that does no damage, at a given bearing and range
// from her (bearing in degrees from her bow, positive to starboard). Map units: the lab map is 520 wide or so.
const fight = (o) => B(({ ship, loadout, bearing, dist, secs, mode, ready }) => {
  const b = window.__broadside;
  b.setFire(mode || 'manual');
  b.playDef({
    name: 'Gun test', wind: 0, islands: [],
    player: [{ type: ship, name: 'Tester', x: 0.5, y: 0.5, h: 0, loadout }],
    enemy: [{ type: 'brig', name: 'Target', x: 0.5, y: 0.1, h: 90, passive: true, hp: 999 }],
    ai: { dmgMul: 0 },
  });
  b.step(1);
  const G = b.G, s = G.ships[0], e = G.ships[1];
  // Hold everyone still and place the target.
  s.pivot = s.h; s.v = 0; e.v = 0;
  const a = s.h + bearing * Math.PI / 180;
  e.x = s.x + Math.cos(a) * dist; e.y = s.y + Math.sin(a) * dist; e.h = s.h + Math.PI / 2;
  for (const x of s.batteries) x.t = ready && ready[x.slot] != null ? ready[x.slot] : 0;
  b.S.balls.length = 0; b.S.pending.length = 0;
  const kinds = {}, fired = new Set();
  const t0 = {}; for (const x of s.batteries) t0[x.slot] = x.t;
  const marines = e.marines;
  let maxFire = 0;
  for (let i = 0; i < Math.round(secs * 60); i++) {
    b.sim(1);
    for (const x of s.batteries) if (x.t > t0[x.slot] + 0.2) fired.add(x.slot);
    for (const x of s.batteries) t0[x.slot] = x.t;
    for (const ball of b.S.balls) if (ball.team === 'player') kinds[ball.kind] = (kinds[ball.kind] || 0) + 1;
    maxFire = Math.max(maxFire, e.fireT);
  }
  return { fired: [...fired].sort(), kinds: Object.keys(kinds).sort(), fireT: maxFire, killed: marines - e.marines, speed: s.speed, slots: s.batteries.map((x) => x.slot) };
}, o);

// Carronades (an implicit frigate refitted with them) hold fire beyond their reach.
let r = await fight({ ship: 'frigate', loadout: { port: 'carronade', starboard: 'carronade' }, bearing: -90, dist: 210, secs: 2, mode: 'auto' });
check(!r.fired.includes('port'), `carronades hold fire at 210, beyond their reach of 150 (fired: ${r.fired.join(', ') || 'nothing'})`, failures);
r = await fight({ ship: 'frigate', loadout: { port: 'carronade', starboard: 'carronade' }, bearing: -90, dist: 120, secs: 2, mode: 'auto' });
check(r.fired.includes('port') && !r.fired.includes('starboard'), `and fire once the enemy is inside it, from the side that bears (${r.fired.join(', ')})`, failures);
r = await fight({ ship: 'frigate', loadout: {}, bearing: -90, dist: 210, secs: 2, mode: 'auto' });
check(r.fired.includes('port'), 'long guns reach 210 where carronades could not', failures);

// Swivels speak at pistol shot, on their own even with the guns on Manual.
const SW = { portUpper: 'swivel', starboardUpper: 'swivel' };
r = await fight({ ship: 'greatship', loadout: SW, bearing: -90, dist: 80, secs: 2 });
check(r.fired.includes('portUpper') && r.fired.includes('forecastle') && !r.fired.includes('portLower') && r.kinds.includes('grape'),
  `swivels fire by themselves at 80 in Manual, grapeshot only; the hand-fired lower tier waits (${r.fired.join(', ')})`, failures);
check(r.killed > 0, `swivel grape cuts down her crew (${r.killed} marines lost)`, failures);
r = await fight({ ship: 'greatship', loadout: SW, bearing: -90, dist: 160, secs: 2 });
check(!r.fired.includes('portUpper') && !r.fired.includes('forecastle'), `and keep quiet at 160 (${r.fired.join(', ') || 'nothing'})`, failures);
const repel = await B(() => window.__broadside.G.ships[0].repel);
check(repel >= 8, `her swivels stiffen her against boarders (+${repel} defence)`, failures);

// Chasers keep to their arcs.
r = await fight({ ship: 'greatship', loadout: {}, bearing: 0, dist: 200, secs: 2 });
check(r.fired.includes('bow') && !r.fired.includes('stern'), `dead ahead: the bow chasers fire, the stern chasers don't (${r.fired.join(', ')})`, failures);
r = await fight({ ship: 'greatship', loadout: {}, bearing: 180, dist: 200, secs: 2 });
check(r.fired.includes('stern') && !r.fired.includes('bow'), `dead astern: the stern chasers fire (${r.fired.join(', ')})`, failures);
r = await fight({ ship: 'greatship', loadout: {}, bearing: 60, dist: 200, secs: 2 });
check(!r.fired.includes('stern') && !r.fired.includes('bow'), `on the bow quarter, outside both arcs, neither does (${r.fired.join(', ') || 'nothing'})`, failures);

// Fire-pots set her burning.
r = await fight({ ship: 'greatship', loadout: { quarterdeck: 'firepot', forecastle: 'firepot' }, bearing: 90, dist: 110, secs: 3 });
check(r.fired.includes('quarterdeck') && r.kinds.includes('firepot') && r.fireT > 0, `the fire-pot engine throws pots that set her alight (burning ${r.fireT.toFixed(1)} s)`, failures);
r = await fight({ ship: 'greatship', loadout: { quarterdeck: 'firepot', forecastle: 'firepot' }, bearing: 90, dist: 220, secs: 2 });
check(!r.fired.includes('quarterdeck') && r.fireT === 0, 'and has no reach beyond 140', failures);

// The deck mortar lobs shells, but not at anything too close.
r = await fight({ ship: 'greatship', loadout: { forecastle: 'mortar' }, bearing: 90, dist: 380, secs: 1 });
check(r.fired.includes('forecastle') && r.kinds.includes('shell'), `the deck mortar lobs a shell at 380 (${r.kinds.join(', ')})`, failures);
r = await fight({ ship: 'greatship', loadout: { forecastle: 'mortar' }, bearing: 90, dist: 80, secs: 1 });
check(!r.fired.includes('forecastle'), 'and holds fire at 80, inside its least range', failures);

// Weight slows her.
const light = await fight({ ship: 'greatship', loadout: { portUpper: 'carronade', starboardUpper: 'carronade' }, bearing: 90, dist: 500, secs: 0.1 });
const dflt = await fight({ ship: 'greatship', loadout: {}, bearing: 90, dist: 500, secs: 0.1 });
const heavyR = await fight({ ship: 'greatship', loadout: { portLower: 'demicannon', starboardLower: 'demicannon', forecastle: 'mortar' }, bearing: 90, dist: 500, secs: 0.1 });
check(light.speed > dflt.speed && dflt.speed > heavyR.speed, `lighter guns sail faster: carronades ${light.speed.toFixed(1)}, default ${dflt.speed.toFixed(1)}, demi-cannon and a mortar ${heavyR.speed.toFixed(1)}`, failures);
const sailed = await B(() => {
  const b = window.__broadside;
  b.playDef({
    name: 'Race', wind: -90, islands: [],
    player: [{ type: 'greatship', name: 'Light', x: 0.25, y: 0.85, h: -90, loadout: { portUpper: 'carronade', starboardUpper: 'carronade', bow: 'swivel', stern: 'swivel' } },
      { type: 'greatship', name: 'Heavy', x: 0.75, y: 0.85, h: -90, loadout: { portLower: 'demicannon', starboardLower: 'demicannon', forecastle: 'mortar' } }],
    enemy: [{ type: 'brig', name: 'Far', x: 0.5, y: 0.05, h: 90, passive: true }], ai: { dmgMul: 0 },
  });
  const [l, h] = b.G.ships, y0 = [l.y, h.y];
  for (const s of [l, h]) { s.path = [{ x: s.x, y: 10 }]; }
  b.sim(60 * 8);
  return { light: y0[0] - l.y, heavy: y0[1] - h.y };
});
check(sailed.light > sailed.heavy * 1.05, `over eight seconds the light ship sails ${sailed.light.toFixed(0)}, the heavy one ${sailed.heavy.toFixed(0)}`, failures);

// Manual fire: Fire port fires the port batteries that are loaded, and only those.
await fight({ ship: 'greatship', loadout: { portUpper: 'carronade' }, bearing: -90, dist: 400, secs: 0.05, ready: { portLower: 5, portUpper: 0, starboardLower: 0, starboardUpper: 0 } });
const manual = await B(() => {
  const b = window.__broadside, s = b.G.ships[0];
  b.S.selected = s; b.step(1);
  const tile = b.S.hud.actions.find((a) => a.kind === 'fire' && a.side === 0);
  return { tile: tile && { x: tile.x, y: tile.y, w: tile.w, h: tile.h, segs: Array.isArray(tile.prog) ? tile.prog.length : 0, ready: tile.ready }, t: Object.fromEntries(s.batteries.map((x) => [x.slot, x.t])) };
});
check(manual.tile && manual.tile.segs === 2 && !manual.tile.ready, 'the Fire port tile shows a reload segment for each tier, not yet all loaded', failures);
await page.mouse.click(manual.tile.x + manual.tile.w / 2, manual.tile.y + manual.tile.h / 2);
const after = await B(() => Object.fromEntries(window.__broadside.G.ships[0].batteries.map((x) => [x.slot, x.t])));
check(after.portUpper > 1 && after.portLower > 3 && after.portLower < 5 && after.starboardUpper <= 0 && after.starboardLower <= 0,
  `a tap fires the loaded upper tier only: port upper ${after.portUpper.toFixed(2)}, port lower ${after.portLower.toFixed(2)} (still loading), starboard untouched`, failures);
check(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`, failures);

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
