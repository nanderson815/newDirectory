// The expansion's rules: rigs and oars, fireships, mortars, treasure, escorts, defending a fort,
// running a blockade, fog and the pirate faction. Each is set up directly and checked through the sim.
import { launch, open, shot, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ gold: 0, stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);
const start = (id) => B((i) => { window.__broadside.startBattle(i); window.__broadside.step(1); }, id);
// Parks every enemy but the ones a test uses well out of the way.
const park = () => B(() => { for (const s of window.__broadside.G.ships) if (s.team === 'enemy') { s.passive = true; s.v = 0; s.x = 30; s.y = 30; } });

// ---------- Rigs and oars ----------
console.log('Rigs and oars');
await start('cove');
const wind = await B(() => {
  const b = window.__broadside, G = b.G, up = G.wind.dir + Math.PI;
  return { square: b.windFactor(up, { rig: 'square' }), foreAft: b.windFactor(up, { rig: 'fore-aft' }), oars: b.windFactor(up, { rig: 'lateen', oars: true }),
    runSquare: b.windFactor(G.wind.dir, { rig: 'square' }), runFore: b.windFactor(G.wind.dir, { rig: 'fore-aft' }) };
});
check(wind.foreAft > wind.square, `a schooner sails closer to the wind than a square-rigger (${wind.foreAft.toFixed(2)} vs ${wind.square.toFixed(2)})`, failures);
check(wind.oars >= 0.85, `oars keep a xebec moving into the wind (${wind.oars.toFixed(2)})`, failures);
check(wind.runFore < wind.runSquare, 'but a square-rigger runs faster before the wind', failures);
const pirates = await B(() => window.__broadside.G.ships.filter((s) => s.team === 'enemy').every((s) => s.faction === 'pirate'));
check(pirates, 'the Pirate Coast fields pirate ships', failures);

// ---------- Fireships ----------
console.log('Fireships');
await start('kate');
await park();
const fire = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], f = G.ships.find((s) => s.fireship);
  f.passive = false; r.pivot = r.h; r.v = 0;
  f.x = r.x + Math.cos(r.h) * 150; f.y = r.y + Math.sin(r.h) * 150; f.h = r.h + Math.PI;
  const hp = r.hp;
  b.sim(400);
  return { before: hp, after: r.hp, fireState: f.state, burning: f.burning };
});
check(fire.burning, 'fireships sail burning', failures);
check(fire.fireState !== 'afloat', `the fireship blows up alongside (${fire.fireState})`, failures);
check(fire.before - fire.after >= 35, `and badly burns her target (${fire.before} -> ${Math.round(fire.after)})`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x1-fireship');
const launched = await B(() => {
  const b = window.__broadside, G = b.G, boss = G.ships.find((s) => s.boss), r = G.ships[0];
  boss.passive = false; boss.x = r.x; boss.y = r.y - 300; boss.abilities.launcher.t = 0;
  const n = G.ships.filter((s) => s.fireship).length;
  b.sim(2);
  return G.ships.filter((s) => s.fireship).length - n;
});
check(launched === 1, 'Calico Kate launches fireships from her side', failures);

// ---------- Mortars ----------
console.log('Mortars');
await start('hierro');
await park();
const mortar = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], k = G.ships.find((s) => s.type === 'bomb');
  G.ai.spread = 0; r.pivot = r.h; r.v = 0; r.hp = r.maxHp;
  k.passive = false; k.pivot = k.h; k.x = r.x; k.y = r.y - 320; k.abilities.mortar.t = 0;
  b.sim(3);
  const shell = b.S.balls.find((x) => x.kind === 'shell');
  const out = { fired: !!shell, h: 0, hp: r.hp };
  for (let i = 0; i < 40; i++) { b.sim(5); const s = b.S.balls.find((x) => x.kind === 'shell'); if (s) out.h = Math.max(out.h, s.h); }
  b.step(1);
  out.after = r.hp;
  return out;
});
check(mortar.fired, 'a bomb ketch lobs a mortar shell', failures);
check(mortar.h > 60, `the shell flies high (${Math.round(mortar.h)})`, failures);
check(mortar.after < mortar.hp, `and bursts on its target (${mortar.hp} -> ${Math.round(mortar.after)})`, failures);
await B(() => { const b = window.__broadside, G = b.G, k = G.ships.find((s) => s.type === 'bomb'); k.abilities.mortar.t = 0; b.sim(70); b.step(1); });
await shot(page, 'x2-mortar-ring');

// ---------- Treasure ----------
console.log('Treasure');
await start('wreck');
await park();
const chest = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], c = G.chests[0];
  r.x = c.x; r.y = c.y; r.pivot = r.h; b.sim(2);
  return { got: G.goals[0].got, taken: c.taken };
});
check(chest.taken && chest.got === 1, 'sailing over a chest hauls it aboard', failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x3-treasure');
const treasureWin = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0];
  for (const c of G.chests.filter((q) => !q.taken).slice(0, G.goals[0].need - G.goals[0].got)) { r.x = c.x; r.y = c.y; b.sim(2); }
  b.sim(5);
  return G.result;
});
check(treasureWin === 'win', `hauling ${4} chests wins the battle (${treasureWin})`, failures);

// ---------- Escort ----------
console.log('Escort');
await start('convoy');
const esc = await B(() => {
  const b = window.__broadside, G = b.G;
  const m = G.ships.filter((s) => s.escort);
  return { n: m.length, team: m.every((s) => s.team === 'player'), cards: b.S.hud.cards.some((c) => c.ship && c.ship.escort) };
});
check(esc.n === 2 && esc.team, 'two merchantmen sail with the fleet', failures);
check(!esc.cards, 'merchantmen cannot be given orders', failures);
const sails = await B(() => { const b = window.__broadside, m = b.G.ships.find((s) => s.escort), y = m.y; b.sim(300); return y - m.y; });
check(sails > 30, `merchantmen sail for the exit on their own (${Math.round(sails)})`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x4-escort');
const escWin = await B(() => { const b = window.__broadside, G = b.G, m = G.ships.find((s) => s.escort); m.y = 60; b.sim(5); return { st: m.state, n: G.goals[0].got, r: G.result }; });
check(escWin.st === 'escaped' && escWin.n === 1, 'a merchantman through the exit is safe', failures);
check(escWin.r === 'win', `getting one through wins (${escWin.r})`, failures);
await start('convoy');
const escLose = await B(() => { const b = window.__broadside, G = b.G; for (const m of G.ships.filter((s) => s.escort)) { m.hp = 1; m.state = 'sinking'; } b.sim(5); return [G.result, G.reason]; });
check(escLose[0] === 'lose' && escLose[1] === 'escort', 'losing every merchantman loses the battle', failures);

// ---------- Defend ----------
console.log('Defend');
await start('siege');
const def = await B(() => {
  const b = window.__broadside, G = b.G, f = G.forts[0], n = G.ships.length;
  G.t = 39.5; b.sim(60);
  return { team: f.team, waves: G.ships.length - n };
});
check(def.team === 'player', 'Fort Charles fights for England', failures);
check(def.waves === 2, `reinforcements arrive on schedule (+${def.waves})`, failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x5-siege');
const defWin = await B(() => { const b = window.__broadside, G = b.G; G.goals[0].t = G.goals[0].secs - 0.5; b.sim(60); return G.result; });
check(defWin === 'win', `holding until the timer runs out wins (${defWin})`, failures);
await start('siege');
const defLose = await B(() => { const b = window.__broadside, G = b.G, f = G.forts[0]; f.hp = 0; f.state = 'silenced'; b.sim(60 * 19); return [G.result, G.reason]; });
check(defLose[0] === 'lose' && defLose[1] === 'fort', 'a fort left silenced too long is lost', failures);

// ---------- Breakthrough ----------
console.log('Breakthrough');
await start('blockade');
const flag = await B(() => { const G = window.__broadside.G; return G.ships.filter((s) => s.flag).map((s) => s.name); });
check(flag.length === 1 && flag[0] === 'Resolute', 'the leading ship is the flagship', failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x6-blockade');
const brk = await B(() => { const b = window.__broadside, G = b.G, s = G.ships.find((q) => q.flag); s.y = 60; b.sim(5); return [s.state, G.result]; });
check(brk[0] === 'escaped' && brk[1] === 'win', 'the flagship through the exit wins', failures);
await start('blockade');
const brkLose = await B(() => { const b = window.__broadside, G = b.G, s = G.ships.find((q) => q.flag); s.hp = 0; s.state = 'sinking'; b.sim(5); return [G.result, G.reason]; });
check(brkLose[0] === 'lose' && brkLose[1] === 'flagship', 'losing the flagship loses the battle', failures);

// ---------- Fog ----------
console.log('Fog');
await start('fog');
const fog = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0];
  b.sim(1);
  const eyes = G.ships.filter((s) => s.team === 'player');
  const far = G.ships.filter((s) => s.team === 'enemy' && eyes.every((o) => Math.hypot(s.x - o.x, s.y - o.y) > G.fog + 20));
  const hidden = far.every((s) => s.hidden);
  const e = G.ships.find((s) => s.team === 'enemy');
  e.passive = true; e.x = r.x + Math.cos(r.h + Math.PI / 2) * 150; e.y = r.y + Math.sin(r.h + Math.PI / 2) * 150; b.sim(1);
  return { far: far.length, hidden, near: !e.hidden };
});
check(fog.far > 0 && fog.hidden, `ships beyond the lookouts' sight are hidden (${fog.far})`, failures);
check(fog.near, 'ships inside it are seen', failures);
await B(() => window.__broadside.step(1));
await shot(page, 'x7-fog');

check(page.errors.length === 0, `no page errors (${page.errors.length})`, failures);
if (page.errors.length) console.log(page.errors.slice(0, 5).join('\n'));
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
