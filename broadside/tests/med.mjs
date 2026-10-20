// The Mediterranean, the second world: it opens from a finished West Indies save (and not before), the chart
// shows one world at a time, every Mediterranean battle loads and plays with the bot without errors, and the
// rules the world brought work: galleys (bow battery, shallow draught, grapple), calm and gale, night, moored
// ships, the rescue and take goals, bonus objectives, and the results sheet's "Next battle" across worlds.
//
//   npm run build:single && node tests/med.mjs
import { launch, open, check, save, botPlay } from './lib.mjs';
import { BATTLES } from '../src/config/battles.js';

const failures = [];
const CARIB = BATTLES.filter((b) => b.world === 'caribbean');
const MED = BATTLES.filter((b) => b.world === 'med');
const done = Object.fromEntries(CARIB.map((b) => [b.id, 3]));
const veteran = save({
  gold: 900, stars: done, hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'], hired: 2,
  fleet: [
    { name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3, marines: 1 } }, { name: 'Swift', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } },
    { name: 'Kestrel', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } }, { name: 'Merlin', cls: 'frigate', up: { marines: 1 } },
    { name: 'Osprey', cls: 'frigate', up: {} },
  ],
});

const browser = await launch();

// ---------- Unlocking ----------
console.log('Worlds and unlocking');
{
  const page = await open(browser, { save: save({ stars: { tutorial: 3, tortuga: 2 } }) });
  const fresh = await page.evaluate(async () => {
    const b = window.__broadside;
    document.getElementById('startBtn').click();
    await new Promise((r) => setTimeout(r, 50));
    return { world: document.getElementById('chartList').dataset.world, worldBtn: document.getElementById('worldBtn').hidden,
      med: [...document.querySelectorAll('#chartList [data-battle]')].some((n) => b.battleIndex('tangier') === +n.dataset.battle) };
  });
  check(fresh.world === 'caribbean' && fresh.worldBtn && !fresh.med, `an early save sees only the West Indies (${JSON.stringify(fresh)})`, failures);
  const locked = await page.evaluate(() => { const b = window.__broadside; b.openBrief(b.battleIndex('tangier')); return b.G.battle; });
  check(typeof locked === 'number', 'a Mediterranean battle still loads by id for testing', failures);
  await page.context().close();
}
{
  const page = await open(browser, { save: veteran });
  const v = await page.evaluate(async () => {
    const b = window.__broadside;
    document.getElementById('startBtn').click();
    await new Promise((r) => setTimeout(r, 50));
    const nodes = [...document.querySelectorAll('#chartList [data-battle]')];
    const open = nodes.filter((n) => !n.disabled).map((n) => +n.dataset.battle);
    const out = { world: document.getElementById('chartList').dataset.world, nodes: nodes.length, open, tangier: b.battleIndex('tangier'),
      btn: document.getElementById('worldBtn').hidden ? null : document.getElementById('worldBtn').textContent };
    document.getElementById('worldBtn').click();
    await new Promise((r) => setTimeout(r, 50));
    out.back = document.getElementById('chartList').dataset.world;
    out.backNodes = document.querySelectorAll('#chartList [data-battle]').length;
    return out;
  });
  check(v.world === 'med', `a finished West Indies save opens the chart on the Mediterranean (${v.world})`, failures);
  check(v.nodes === MED.length, `the Mediterranean chart shows its ${MED.length} battles and nothing else (${v.nodes})`, failures);
  check(v.open.length === 1 && v.open[0] === v.tangier, `only its first battle is open (${v.open})`, failures);
  check(v.btn === 'West Indies' && v.back === 'caribbean' && v.backNodes === CARIB.length + 1, `and the West Indies are still a tap away (${v.btn}, ${v.back}, ${v.backNodes} nodes)`, failures);
  const hats = await page.evaluate(async () => {
    document.getElementById('hatsBtn').click();
    await new Promise((r) => setTimeout(r, 50));
    return { shelves: [...document.querySelectorAll('#hatGrid .hat-shelf')].map((h) => h.textContent), hats: document.querySelectorAll('#hatGrid .hat-card').length,
      won: document.querySelectorAll('#hatGrid .hat-card:not(.locked)').length, tally: document.getElementById('hatsTally').textContent };
  });
  check(hats.shelves.length === 2 && hats.hats === 12 && hats.won === 7, `the cabinet has a shelf for each world (${JSON.stringify(hats)})`, failures);
  check(page.errors.length === 0, `no errors on the chart (${page.errors.slice(0, 2).join(' | ')})`, failures);

  // Results: the West Indies finale leads on to the Mediterranean, and the Med's own finale has its title.
  const ends = await page.evaluate(() => {
    const b = window.__broadside, G0 = () => b.G;
    const win = (id) => { b.startBattle(id); const G = G0(); G.result = 'win'; G.endAt = G.t; for (const s of G.ships) if (s.team === 'enemy') s.state = 'sunk'; b.sim(2); return { title: document.getElementById('endTitle').textContent, next: document.getElementById('endPrimary').dataset.go, text: document.getElementById('endPrimary').textContent }; };
    return { armada: win('armada'), kapudan: win('kapudan'), tangier: b.battleIndex('tangier'), gibraltar: b.battleIndex('gibraltar'), first: win('tangier') };
  });
  check(ends.armada.title === 'The sea is England’s!' && +ends.armada.next === ends.tangier, `La Gran Armada's "Next battle" sails for Tangier (${JSON.stringify(ends.armada)})`, failures);
  check(ends.kapudan.title === 'Peace in the Middle Sea!', `the Mediterranean finale has its own title (${ends.kapudan.title})`, failures);
  check(+ends.first.next === ends.gibraltar, `inside the Mediterranean the next battle is the next one (${ends.first.next})`, failures);
  await page.context().close();
}

// ---------- Every battle plays ----------
console.log('Every Mediterranean battle loads and plays');
{
  const page = await open(browser, { save: veteran });
  for (const B of MED) {
    const info = await page.evaluate((id) => {
      const b = window.__broadside; b.S.muted = true;
      b.openBrief(b.battleIndex(id));
      const brief = document.getElementById('briefOrders').textContent.length > 40 && document.getElementById('briefLogText').textContent.length > 40;
      b.startPlay();
      return { brief, ships: b.G.ships.length, style: b.G.style, faction: b.G.faction };
    }, B.id);
    const result = await botPlay(page, +(process.env.SECS || 90));
    const after = await page.evaluate(() => ({ t: Math.round(window.__broadside.G.t) }));
    check(info.brief && info.ships > 2 && page.errors.length === 0,
      `${B.id}: briefs, builds (${info.ships} ships, ${info.style}, ${info.faction}) and plays ${after.t}s with the bot (${result || 'still on'})${page.errors.length ? ' ' + page.errors.slice(0, 2).join(' | ') : ''}`, failures);
    page.errors.length = 0;
  }
  await page.context().close();
}

// ---------- The new rules ----------
console.log('Galleys, weather and night');
const page = await open(browser, { save: veteran });
const B = (fn, arg) => page.evaluate(fn, arg);

const galley = await B(() => {
  const b = window.__broadside; b.startBattle('bougie'); b.step(1);
  const G = b.G, g = G.ships.find((s) => s.type === 'galley'), r = G.ships[0];
  return { chasers: g.chasers, shallow: g.shallow, oars: g.oars, breeze: G.wind.k,
    sail: b.windFactor(r.h, r), row: b.windFactor(g.h, g) };
});
check(galley.chasers === 3 && galley.shallow && galley.oars, `a war galley carries a three-gun bow battery, rows and draws little water (${JSON.stringify(galley)})`, failures);
check(galley.breeze === 0.3 && galley.sail < 0.35 && galley.row > 0.85, `in the Bougie calm sails barely draw (${galley.sail.toFixed(2)}) while oars row on (${galley.row.toFixed(2)})`, failures);
const breeze = await B(() => {
  const b = window.__broadside, G = b.G;
  for (const s of G.ships) if (s.team === 'enemy') { s.passive = true; s.x = 30; s.y = 30; }
  b.sim(60 * 86);
  return G.wind.k;
});
check(breeze === 1, `then the breeze comes back on cue (${breeze})`, failures);

const grapple = await B(() => {
  const b = window.__broadside; b.startBattle('tangier'); b.step(1);
  const G = b.G, r = G.ships.find((s) => s.team === 'player' && s.name === 'Osprey');
  for (const s of G.ships) if (s.team === 'enemy') { s.passive = true; s.x = 30; s.y = 30; }
  const g = G.ships.find((s) => s.type === 'galley');
  g.passive = false; r.hp = r.maxHp * 0.42; r.marines = 6; r.pivot = r.h; r.v = 0;
  g.x = r.x + 40; g.y = r.y; g.h = Math.PI;
  for (let i = 0; i < 60 * 8 && !r.boarding && !g.boarding; i++) b.sim(1);
  return { boarded: !!(r.boarding || g.boarding), by: r.boarding ? 'defending' : '' };
});
check(grapple.boarded, `a galley grapples a hurt English ship she outnumbers (${JSON.stringify(grapple)})`, failures);

const night = await B(() => {
  const b = window.__broadside; b.startBattle('dia'); b.step(1);
  const G = b.G, far = G.ships.find((s) => s.team === 'enemy' && s.name === 'Şahin');
  b.sim(2);
  const hidden = far.hidden;
  far.fireT = 5; b.sim(2);
  return { night: G.night, fog: G.fog, hidden, burning: far.hidden };
});
check(night.night && night.fog > 0 && night.hidden && !night.burning, `at night a distant ship is hidden, until she catches fire (${JSON.stringify(night)})`, failures);

const gale = await B(() => {
  const b = window.__broadside; b.startBattle('passero'); b.step(1);
  const G = b.G, r = G.ships[0], calm = b.windFactor(r.h, r);
  b.sim(60 * 56);
  return { k: G.wind.k, fog: G.fog, faster: b.windFactor(r.h, r) > calm };
});
check(gale.k > 1.4 && gale.fog > 0 && gale.faster, `the storm off Cape Passero blows up into a gale with rain (${JSON.stringify(gale)})`, failures);

const moored = await B(() => {
  const b = window.__broadside; b.startBattle('goletta'); b.step(1);
  const G = b.G, m = G.ships.find((s) => s.name === 'Hilal'), r = G.ships[0];
  b.sim(60 * 3);
  const still = Math.round(m.v), x0 = m.x;
  r.x = m.x; r.y = m.y + 150; b.sim(60 * 4);
  const fires = G.ships.filter((s) => s.team === 'player' && s.fireship).length;
  return { still, held: m.abilities.moored.held, moved: Math.round(Math.hypot(m.x - x0, 0)), fires };
});
check(moored.still === 0 && moored.held === false, `a moored corsair lies still until a warship comes close, then cuts her cable (${JSON.stringify(moored)})`, failures);
check(moored.fires === 2, `you sail into La Goletta with two fireships of your own (${moored.fires})`, failures);

console.log('Rescue, take and bonus goals');
const rescue = await B(() => {
  const b = window.__broadside; b.startBattle('bagnio'); b.step(1);
  const G = b.G, o = G.goals[0], fort = G.forts[0], r = G.ships[0];
  for (const s of G.ships) if (s.team === 'enemy') { s.passive = true; s.x = 30; s.y = 30; s.v = 0; }
  r.x = o.px; r.y = o.py; r.pivot = r.h; r.v = 0;
  b.sim(60 * 5);
  const guarded = o.stage;
  fort.hp = 0; fort.state = 'silenced';
  const m0 = r.marines;
  b.sim(60 * 5);
  const boat = G.ships.find((s) => s.id === o.boatId);
  const stage = o.stage, spent = m0 - r.marines;
  if (boat) { boat.x = boat.x; boat.y = 60; }
  b.sim(60 * 3);
  return { guarded, stage, spent, boat: boat && boat.name, escaped: boat && boat.state, out: o.out, result: G.result };
});
check(rescue.guarded === 'land', 'no landing while the Mole Battery still fires', failures);
check(rescue.stage === 'boat' && rescue.spent === 10 && rescue.boat === 'Deliverance', `once it is silent, a ship anchored in the ring lands 10 marines and the captives' boat puts off (${JSON.stringify(rescue)})`, failures);
check(rescue.out && rescue.result === 'win', `and when the boat is through, the battle is won (${rescue.result})`, failures);

const take = await B(() => {
  const b = window.__broadside; b.startBattle('gibraltar'); b.step(1);
  const G = b.G, h = G.ships.find((s) => s.name === 'Hopewell'), o = G.goals.find((q) => q.kind === 'take');
  const before = b.GOALS.take.done(o, G);
  h.team = 'player'; h.prize = true;
  return { before, after: b.GOALS.take.done(o, G), bonus: o.bonus, gold: o.gold };
});
check(!take.before && take.after && take.bonus && take.gold > 0, `retaking the Hopewell as a prize meets the bonus (${JSON.stringify(take)})`, failures);

const bonus = await B(() => {
  const b = window.__broadside;
  const play = (fast) => {
    b.startBattle('tangier'); b.step(1);
    const G = b.G;
    if (!fast) G.t = 230;
    for (const s of G.ships) if (s.team === 'enemy') s.state = 'sunk';
    const gold = b.save.gold;
    b.sim(60 * 3);
    return { result: G.result, met: G.goals[2].met, award: G.award && G.award.bonus, paid: b.save.gold - gold };
  };
  return { fast: play(true), slow: play(false) };
});
check(bonus.fast.result === 'win' && bonus.fast.met && bonus.fast.award > 0, `winning Tangier inside the time meets its bonus and pays it (${JSON.stringify(bonus.fast)})`, failures);
check(bonus.slow.result === 'win' && !bonus.slow.met && !bonus.slow.award, `a slower win still wins, without the bonus (${JSON.stringify(bonus.slow)})`, failures);

check(page.errors.length === 0, `no errors (${page.errors.slice(0, 3).join(' | ')})`, failures);

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
