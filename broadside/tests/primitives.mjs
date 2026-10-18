// The newer battle primitives, each proven on a small ad-hoc battle built with playDef (src/config/lab.js):
// goals protect, hunt, reach, survive; abilities repair, ram, flee, rally; events shipSunk, shipNear, goalDone,
// say, retreat, reveal, heal; plus the lab itself (never touches the save) and one battle that combines them.
import path from 'path';
import { launch, open, check, save, OUT } from './lib.mjs';

const failures = [];
const browser = await launch();
const seed = save({ gold: 77, stars: { tutorial: 3 } });
const page = await open(browser, { save: seed });
const B = (fn, arg) => page.evaluate(fn, arg);
// A lab battle: the frigate Resolute and the sloop Swift against whatever the test adds. Enemy gunnery does no
// damage unless a test asks for it, so only the primitive under test changes the outcome.
const def = (o = {}) => ({
  name: 'Lab test', wind: 0, islands: [],
  player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90 }, { type: 'sloop', name: 'Swift', x: 0.3, y: 0.85, h: -90 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.15, h: 90, passive: true }],
  ...o, ai: { dmgMul: 0, ...(o.ai || {}) },
});
const play = (d) => B((x) => { window.__broadside.playDef(x); window.__broadside.step(1); }, d);
const named = (n) => `window.__broadside.G.ships.find((s) => s.name === ${JSON.stringify(n)})`;
const sinkNamed = (n) => B((name) => { const s = window.__broadside.G.ships.find((q) => q.name === name); s.hp = 0; s.state = 'sinking'; }, n);
const result = () => B(() => [window.__broadside.G.result, window.__broadside.G.reason]);
// Your gun crews hold fire so that only the primitive under test hurts anyone; screenshots show the usual HUD.
await B(() => window.__broadside.setFire('manual'));
const snap = async (name, p = page) => {
  await p.evaluate(() => { window.__broadside.setFire('auto'); window.__broadside.step(1); });
  await p.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 }); // swiftshader is slow on a busy machine
  await p.evaluate(() => window.__broadside.setFire('manual'));
};

// ---------- Registries ----------
console.log('Registries');
const reg = await B(() => {
  const b = window.__broadside, bad = [];
  for (const id of ['protect', 'hunt', 'reach', 'survive']) { const g = b.GOALS[id]; if (!g || !g.about || !g.params || !g.brief || !g.done) bad.push(id); }
  for (const id of ['repair', 'ram', 'flee', 'rally']) { const a = b.ABILITIES[id]; if (!a || !a.about || !a.params || !a.defaults) bad.push(id); }
  for (const id of ['shipSunk', 'shipNear', 'goalDone']) { const e = b.events.WHEN[id]; if (!e || !e.about || !e.fn) bad.push(id); }
  for (const id of ['say', 'retreat', 'reveal', 'heal']) { const e = b.events.DO[id]; if (!e || !e.about || !e.fn) bad.push(id); }
  return bad;
});
check(reg.length === 0, `every new primitive is registered with about/params (${reg.join(', ') || 'all there'})`, failures);

// ---------- The battle lab ----------
console.log('Battle lab');
const lab = await B((d) => {
  const b = window.__broadside;
  b.playDef(d, { brief: true });
  const brief = { screen: !document.getElementById('briefScreen').hidden, eyebrow: document.getElementById('briefEyebrow').textContent, orders: document.getElementById('briefOrders').textContent };
  b.startPlay(); b.step(1);
  return { brief, battle: b.G.battle, phase: b.G.phase, ships: b.G.ships.map((s) => s.name) };
}, def({ name: 'Lab crossing' }));
check(lab.brief.screen && lab.brief.eyebrow.startsWith('Battle lab'), `playDef opens a briefing for an ad-hoc battle ("${lab.brief.eyebrow}")`, failures);
check(lab.battle === 'lab' && lab.phase === 'play', 'and plays it', failures);
check(lab.ships.join() === 'Resolute,Swift,San Juan', `with exactly the ships it was given (${lab.ships.join(', ')})`, failures);
await sinkNamed('San Juan');
const labEnd = await B(() => {
  const b = window.__broadside; b.sim(60 * 7);
  const stored = JSON.parse(localStorage.getItem('broadside.save.v1') || '{}');
  return {
    result: b.G.result, end: !document.getElementById('endScreen').hidden, eyebrow: document.getElementById('endEyebrow').textContent,
    reward: document.getElementById('endReward').hidden, primary: document.getElementById('endPrimary').textContent,
    gold: b.save.gold, stars: Object.keys(b.save.stars), storedGold: stored.gold, storedStars: Object.keys(stored.stars || {}),
  };
});
check(labEnd.result === 'win' && labEnd.end && labEnd.eyebrow.startsWith('Battle lab'), `a lab battle ends on the results screen (${labEnd.eyebrow})`, failures);
check(labEnd.gold === 77 && labEnd.stars.join() === 'tutorial' && labEnd.reward, `and pays nothing and records no stars (gold ${labEnd.gold}, stars ${labEnd.stars.join()})`, failures);
check(labEnd.storedGold === undefined || (labEnd.storedGold === 77 && !labEnd.storedStars.includes('lab')), 'nothing about it reaches the stored save', failures);
check(labEnd.primary === 'Play again', `its results offer another go, not a next battle (${labEnd.primary})`, failures);

// ---------- Protect ----------
console.log('Protect');
await play(def({
  goals: [{ kind: 'sink' }, { kind: 'protect', ships: ['Swift'], forts: ['Fort Charles'], allies: [{ type: 'brig', name: 'Zeeland', x: 0.7, y: 0.7 }] }],
  forts: [{ island: 0, name: 'Fort Charles', hp: 60, guns: 2, team: 'player' }],
  islands: [{ x: 0.22, y: 0.55, r: 34 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.7, y: 0.3, h: 90 }],
}));
const ally = await B(() => {
  const b = window.__broadside, G = b.G, z = G.ships.find((s) => s.name === 'Zeeland'), e = G.ships.find((s) => s.name === 'San Juan');
  const d0 = Math.hypot(z.x - e.x, z.y - e.y);
  e.passive = true; e.v = 0;
  b.sim(180);
  return { ally: z.ally && z.team === 'player', card: b.S.hud.cards.some((c) => c.ship === z), closed: d0 - Math.hypot(z.x - e.x, z.y - e.y), ids: G.goals[1].ids.length };
});
check(ally.ally && !ally.card, 'protect adds Zeeland as an ally who takes no orders', failures);
check(ally.closed > 40, `the ally sails at the enemy on her own (${Math.round(ally.closed)} closer)`, failures);
check(ally.ids === 2, `the goal guards Swift and Zeeland (${ally.ids})`, failures);
await snap('p2-protect');
await sinkNamed('Swift');
await B(() => window.__broadside.sim(5));
const protLose = await result();
check(protLose[0] === 'lose' && protLose[1] === 'lost', `losing a guarded ship loses the battle (${protLose})`, failures);
// Forts: enemy captains go for a guarded fort; silence it and the battle is lost. With secs, holding out wins.
await play(def({
  goals: [{ kind: 'protect', forts: ['Fort Charles'], secs: 30 }],
  forts: [{ island: 0, name: 'Fort Charles', hp: 60, guns: 2, team: 'player' }],
  islands: [{ x: 0.5, y: 0.4, r: 34 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.2, h: 90 }],
}));
const fortAim = await B(() => {
  const b = window.__broadside, G = b.G, e = G.ships.find((s) => s.name === 'San Juan');
  for (const s of G.ships) if (s.team === 'player') { s.x = 60; s.y = G.H - 60; s.pivot = s.h; }
  e.aiT = 0; b.sim(2);
  return e.targetId === G.forts[0].id;
});
check(fortAim, 'enemy captains go for a guarded fort', failures);
const protWin = await B(() => { const b = window.__broadside, G = b.G; G.t = 29.5; b.sim(60); return [G.result, G.reason]; });
check(protWin[0] === 'win', `keeping the fort safe for the time given wins (${protWin})`, failures);
await play(def({ goals: [{ kind: 'sink' }, { kind: 'protect', forts: ['Fort Charles'] }], forts: [{ island: 0, name: 'Fort Charles', hp: 60, guns: 2, team: 'player' }], islands: [{ x: 0.5, y: 0.4, r: 34 }] }));
await B(() => { const b = window.__broadside, f = b.G.forts[0]; f.hp = 0; f.state = 'silenced'; b.sim(3); });
const fortLose = await result();
check(fortLose[0] === 'lose' && fortLose[1] === 'lost', `a guarded fort silenced loses the battle (${fortLose})`, failures);

// ---------- Hunt and flee ----------
console.log('Hunt and flee');
const huntDef = def({
  goals: [{ kind: 'hunt', ships: 'La Paga' }],
  enemy: [
    { type: 'brig', name: 'San Juan', x: 0.5, y: 0.2, h: 90, passive: true },
    { type: 'sloop', name: 'La Paga', x: 0.12, y: 0.4, h: 90, abilities: { flee: { below: 0.6 } } },
  ],
});
await play(huntDef);
await sinkNamed('San Juan');
await B(() => window.__broadside.sim(60 * 4));
const huntOn = await result();
check(huntOn[0] == null, `sinking the rest doesn't win a hunt (${huntOn[0]})`, failures);
await snap('p3-hunt');
await sinkNamed('La Paga');
await B(() => window.__broadside.sim(5));
const huntWin = await result();
check(huntWin[0] === 'win', `sinking the quarry wins (${huntWin[0]})`, failures);
await play(huntDef);
const flee = await B(() => {
  const b = window.__broadside, G = b.G, p = G.ships.find((s) => s.name === 'La Paga');
  b.sim(30);
  const calm = p.fleeing;
  p.hp = p.maxHp * 0.55; b.sim(2);
  const out = { calm, fleeing: p.fleeing, label: b.S.toast && b.S.toast.text, steps: 0 };
  while (p.state === 'afloat' && out.steps < 60 * 30) { b.sim(30); out.steps += 30; }
  out.state = p.state; out.result = G.result; out.reason = G.reason;
  b.sim(150); out.fledT = p.fledT;
  return out;
});
check(!flee.calm && flee.fleeing, 'a ship with flee runs once her hull drops below the mark', failures);
check(/run/.test(flee.label || ''), `and says so ("${flee.label}")`, failures);
check(flee.state === 'escaped', `she makes the edge of the chart and escapes (${flee.state} after ${(flee.steps / 60).toFixed(1)}s)`, failures);
check(flee.result === 'lose' && flee.reason === 'escaped', `a quarry that gets away loses the hunt (${flee.result}, ${flee.reason})`, failures);
check(flee.fledT > 1.8, 'and sails off the chart out of sight', failures);
// Under a sink goal a runner that escapes counts as gone (beaten), not as sunk or taken.
await play(def({ enemy: [{ type: 'sloop', name: 'La Paga', x: 0.1, y: 0.4, h: 180, abilities: { flee: true } }] }));
const fleeSink = await B(() => {
  const b = window.__broadside, G = b.G, p = G.ships[2];
  p.hp = p.maxHp * 0.4;
  for (let i = 0; i < 60 && p.state === 'afloat'; i++) b.sim(30);
  b.sim(10);
  return { state: p.state, result: G.result, prizes: G.stats.prizes || 0, team: p.team };
});
check(fleeSink.state === 'escaped' && fleeSink.result === 'win', `an enemy that escapes counts as gone for a sink goal (${fleeSink.state}, ${fleeSink.result})`, failures);
check(fleeSink.prizes === 0 && fleeSink.team === 'enemy', 'but not as a sunk ship or a prize', failures);

// ---------- Reach ----------
console.log('Reach');
await play(def({ goals: [{ kind: 'reach', x: 0.5, y: 0.35, r: 0.1, label: 'Make for the cove' }] }));
const reach = await B(() => {
  const b = window.__broadside, G = b.G, o = G.goals[0], r = G.ships[0];
  const start = o.got;
  r.x = o.px + o.pr * 0.5; r.y = o.py; r.pivot = r.h; b.sim(2);
  return { start, got: o.got, result: G.result, ring: [Math.round(o.px), Math.round(o.py), Math.round(o.pr)], W: G.W };
});
check(!reach.start && reach.got && reach.result === 'win', `sailing into the ring wins (${reach.result}; ring ${reach.ring})`, failures);
check(Math.abs(reach.ring[0] - reach.W / 2) < 2 && Math.abs(reach.ring[2] - reach.W * 0.1) < 2, 'the ring sits where the battle data put it', failures);
await play(def({ goals: [{ kind: 'reach', ship: 'Swift', x: 0.5, y: 0.35, r: 0.1, secs: 3, label: 'Take soundings' }] }));
const hold = await B(() => {
  const b = window.__broadside, G = b.G, o = G.goals[0], [r, sw] = G.ships;
  r.x = o.px; r.y = o.py; r.pivot = r.h; b.sim(60);
  const other = o.got;
  r.x = 80; r.y = G.H - 80;
  sw.x = o.px; sw.y = o.py; sw.pivot = sw.h; b.sim(80);
  return { other, mid: o.got, held: o.held };
});
check(!hold.other, 'a named reach ignores the other ships', failures);
check(!hold.mid && hold.held > 1, `the named ship must hold the spot for the time given (${hold.held.toFixed(1)}s so far)`, failures);
await snap('p1-reach');
const holdWin = await B(() => { const b = window.__broadside; b.sim(120); return [b.G.goals[0].got, b.G.result]; });
check(holdWin[0] && holdWin[1] === 'win', `holding it long enough wins (${holdWin[1]})`, failures);
await play(def({ goals: [{ kind: 'reach', ship: 'Swift', x: 0.5, y: 0.35 }] }));
await sinkNamed('Swift');
await B(() => window.__broadside.sim(5));
const reachLose = await result();
check(reachLose[0] === 'lose' && reachLose[1] === 'ship', `losing the named ship loses a reach (${reachLose})`, failures);
// A landscape phone lays the chart on its side; the ring goes with it.
const land = await open(browser, { width: 844, height: 390, save: seed });
await land.evaluate((d) => { window.__broadside.playDef(d); window.__broadside.step(1); }, def({ goals: [{ kind: 'reach', x: 0.3, y: 0.3, r: 0.12, label: 'Make for the cove' }] }));
const landRing = await land.evaluate(() => { const G = window.__broadside.G, o = G.goals[0]; return { land: G.land, x: o.px / G.W, y: o.py / G.H }; });
check(landRing.land && Math.abs(landRing.x - 0.7) < 0.01 && Math.abs(landRing.y - 0.3) < 0.01, `in landscape the ring turns with the chart (${landRing.x.toFixed(2)}, ${landRing.y.toFixed(2)})`, failures);
await snap('p1-reach-landscape', land);
await land.context().close();

// ---------- Survive ----------
console.log('Survive');
await play(def({ goals: [{ kind: 'survive', secs: 20 }] }));
const surv = await B(() => { const b = window.__broadside, G = b.G; b.sim(60); const early = G.result; G.t = 19.5; b.sim(60); return [early, G.result, b.G.goals.length]; });
check(surv[0] == null && surv[1] === 'win', `holding out until the clock runs out wins (${surv[0]} then ${surv[1]})`, failures);
await play(def({ goals: [{ kind: 'survive', secs: 20 }] }));
await sinkNamed('Resolute'); await sinkNamed('Swift');
await B(() => window.__broadside.sim(10));
const survLose = await result();
check(survLose[0] === 'lose' && survLose[1] === 'fleet', `losing the fleet first loses (${survLose})`, failures);

// ---------- Repair ----------
console.log('Repair');
await play(def({ player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90, abilities: { repair: { rate: 6, idle: 2 } } }] }));
const rep = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships[1];
  r.pivot = r.h; r.hp = r.maxHp * 0.5;
  b.sim(60); const early = r.hp;
  b.sim(60 * 3); const later = r.hp;
  // An enemy in gun range stops the work.
  e.x = r.x + 150; e.y = r.y; b.sim(60); const a = r.hp; b.sim(60 * 3);
  return { start: r.maxHp * 0.5, early, later, near: r.hp - a, repairing: r.repairing };
});
check(Math.abs(rep.early - rep.start) < 0.01, 'repair waits until she is out of action', failures);
check(rep.later - rep.start > 8, `then the carpenters patch the hull (${Math.round(rep.start)} -> ${Math.round(rep.later)})`, failures);
check(rep.near === 0 && !rep.repairing, 'and stop while an enemy is within gun range', failures);
await play(def({ player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90, abilities: { repair: { rate: 0, always: 3 } } }] }));
const always = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships[1];
  r.pivot = r.h; r.hp = 50; e.x = r.x + 150; e.y = r.y; b.sim(180); return r.hp;
});
check(always > 55, `always-on repair works even in action (50 -> ${Math.round(always)})`, failures);

// ---------- Ram ----------
console.log('Ram');
await play(def({ player: [{ type: 'sloop', name: 'Swift', x: 0.5, y: 0.8, h: -90, abilities: { ram: true } }] }));
const ram = await B(() => {
  const b = window.__broadside, G = b.G, s = G.ships[0], e = G.ships[1];
  e.x = s.x; e.y = s.y - 120; e.h = 0; e.v = 0;
  s.h = -Math.PI / 2; s.v = s.speed; s.path = [{ x: e.x, y: e.y - 40 }];
  const hp = e.hp;
  for (let i = 0; i < 40 && e.hp === hp; i++) b.sim(5);
  return { dmg: hp - e.hp, slowE: e.slowT, slowS: s.slowT, toast: b.S.toast && b.S.toast.text };
});
check(ram.dmg >= 10, `a ram bow stoves in the ship she runs into (-${ram.dmg})`, failures);
check(ram.slowE > 0 && ram.slowS > 0, 'and slows both ships', failures);
check(ram.toast === 'Rammed!', 'the HUD calls it', failures);
await snap('p4-ram');
await play(def({ ai: { dmgMul: 1 }, enemy: [{ type: 'brig', name: 'El Toro', x: 0.5, y: 0.5, h: 90, abilities: { ram: { charge: 400 } } }] }));
const aiRam = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships[2];
  r.pivot = r.h; r.v = 0; G.ships[1].x = 40; G.ships[1].y = 40; G.ships[1].pivot = 0;
  e.x = r.x + 200; e.y = r.y - 60; e.h = Math.PI;
  for (let i = 0; i < 80 && e.abilities.ram.t === 0; i++) b.sim(10);
  return { rammed: e.abilities.ram.t > 0, slow: r.slowT };
});
check(aiRam.rammed && aiRam.slow > 0, 'an enemy with a ram bow charges and rams', failures);

// ---------- Rally ----------
console.log('Rally');
await play(def({
  player: [
    { type: 'frigate', name: 'Resolute', x: 0.5, y: 0.8, h: -90, abilities: { rally: { radius: 150, reload: 0.5 } } },
    { type: 'sloop', name: 'Swift', x: 0.62, y: 0.8, h: -90 },
    { type: 'sloop', name: 'Kestrel', x: 0.1, y: 0.95, h: -90 },
  ],
}));
const rally = await B(() => {
  const b = window.__broadside, G = b.G, [r, sw, k] = G.ships;
  for (const s of [r, sw, k]) { s.pivot = s.h; s.reload = [3, 3]; }
  b.sim(60);
  return { near: 3 - sw.reload[0], far: 3 - k.reload[0], self: 3 - r.reload[0] };
});
check(rally.near > rally.far * 1.8, `ships near a rally ship reload faster (${rally.near.toFixed(2)}s vs ${rally.far.toFixed(2)}s in one second)`, failures);
check(Math.abs(rally.self - rally.far) < 0.01, 'the rally ship herself reloads as usual', failures);
await snap('p5-rally');

// ---------- Events ----------
console.log('Events');
await play(def({
  fog: 120,
  enemy: [
    { type: 'brig', name: 'San Juan', x: 0.5, y: 0.15, h: 90, passive: true },
    { type: 'sloop', name: 'La Paga', x: 0.85, y: 0.2, h: 90 },
    { type: 'brig', name: 'San Mateo', x: 0.15, y: 0.15, h: 90, passive: true },
  ],
  events: [
    { shipSunk: 'San Juan', say: ['La Paga', 'Huid!'], retreat: 'La Paga' },
    { shipNear: { x: 0.5, y: 0.5, r: 0.08 }, heal: 0.5 },
    { shipNear: { name: 'San Mateo', x: 0.15, y: 0.15, r: 0.1 }, at: 3, reveal: 4 },
    { goalDone: 0, banner: ['All gone'] },
  ],
}));
const ev = await B(() => {
  const b = window.__broadside, G = b.G, [r, sw] = G.ships, sj = G.ships.find((s) => s.name === 'San Juan'), lp = G.ships.find((s) => s.name === 'La Paga');
  const out = {};
  b.sim(30);
  const sm = G.ships.find((s) => s.name === 'San Mateo');
  out.hiddenAtStart = sm.hidden;
  out.early = G.events.map((e) => e.fired);
  sj.hp = 0; sj.state = 'sinking'; b.sim(2);
  out.sunk = G.events[0].fired; out.say = b.S.toast && b.S.toast.text; out.sayShip = b.S.toast && b.S.toast.shipId === lp.id; out.retreat = lp.fleeing;
  out.mateo = sm.fleeing;
  r.hp = r.maxHp * 0.3; sw.hp = sw.maxHp * 0.3;
  const [px, py] = [G.W * 0.5, G.H * 0.5]; sw.x = px; sw.y = py; sw.pivot = sw.h; b.sim(2);
  out.heal = [r.hp / r.maxHp, sw.hp / sw.maxHp];
  b.sim(60 * 3);
  out.reveal = G.events[2].fired; out.seen = !sm.hidden;
  b.sim(60 * 5);
  out.fogBack = sm.hidden;
  out.goalDone = G.events[3].fired;
  return out;
});
check(ev.early.every((f) => !f), 'no event fires before its conditions hold', failures);
check(ev.sunk && ev.say === 'Huid!' && ev.sayShip, `shipSunk fires and say puts a line over the named ship ("${ev.say}")`, failures);
check(ev.retreat && !ev.mateo, 'retreat sends only the named ship running', failures);
check(Math.abs(ev.heal[0] - 0.8) < 0.02 && Math.abs(ev.heal[1] - 0.8) < 0.02, `shipNear fires and heal patches every English ship (${ev.heal.map((k) => k.toFixed(2))})`, failures);
check(ev.hiddenAtStart && ev.reveal && ev.seen, 'reveal lifts the fog', failures);
check(ev.fogBack, 'for the seconds given, then it closes in again', failures);
check(!ev.goalDone, 'goalDone waits for its goal', failures);
const gd = await B(() => {
  const b = window.__broadside, G = b.G;
  for (const s of G.ships) if (s.team === 'enemy' && s.state === 'afloat') { s.hp = 0; s.state = 'sinking'; }
  b.sim(2);
  return { fired: G.events[3].fired, banner: b.S.banner && b.S.banner.text };
});
check(gd.fired && gd.banner === 'All gone', 'goalDone fires once the goal is met', failures);

// ---------- All together ----------
// "The paymaster's sloop": hunt her before she gets away while keeping the Dutch ally afloat. When her escort
// goes down she runs (a retreat event); the ally has carpenters (repair).
console.log('Combined');
await play(def({
  goals: [{ kind: 'hunt', ships: 'La Paga' }, { kind: 'protect', allies: [{ type: 'frigate', name: 'Zeeland', x: 0.7, y: 0.75, abilities: { repair: { always: 1 } } }] }],
  enemy: [
    { type: 'brig', name: 'San Juan', x: 0.5, y: 0.2, h: 90, passive: true },
    { type: 'sloop', name: 'La Paga', x: 0.5, y: 0.3, h: 90, abilities: { flee: { below: 0.3, say: 'Save the silver!' } } },
  ],
  events: [{ shipSunk: 'San Juan', retreat: 'La Paga', say: ['La Paga', 'Run for it!'] }],
}));
const combo = await B(() => {
  const b = window.__broadside, G = b.G, z = G.ships.find((s) => s.name === 'Zeeland'), lp = G.ships.find((s) => s.name === 'La Paga');
  const sj = G.ships.find((s) => s.name === 'San Juan');
  b.sim(30);
  z.hp = z.maxHp * 0.7; const zhp = z.hp;
  sj.hp = 0; sj.state = 'sinking'; b.sim(60);
  const out = { running: lp.fleeing, toast: b.S.toast && b.S.toast.text, zRepair: z.hp > zhp, before: G.result };
  lp.hp = 0; lp.state = 'sinking'; b.sim(10);
  out.result = G.result; out.zAfloat = z.state === 'afloat';
  return out;
});
check(combo.running && combo.toast === 'Run for it!', 'the escort sunk, the event sends the paymaster running', failures);
check(combo.zRepair, 'the allied frigate patches her hull as she goes', failures);
check(combo.before == null && combo.result === 'win' && combo.zAfloat, `sinking the runner with the ally afloat wins the battle (${combo.result})`, failures);
await B(() => window.__broadside.step(1));

check(page.errors.length === 0, `no page errors (${page.errors.length})`, failures);
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
