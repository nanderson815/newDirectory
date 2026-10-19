// Land that matters (src/sim/land.js, src/config/lands.js, render/land.js): every battle has its own land and
// it builds cleanly within budget; landmarks stand inside the outline ships collide with; and the four land
// rules work: a peak's lee steals the wind, a harbour patches hulls, an enemy town can be sacked for plunder,
// and a lighthouse with sight lifts the fog. Plus the living details show only when you zoom in.
import { launch, open, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);
const CAMPAIGN = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];

// ---------- Every battle has its land ----------
console.log('Every battle');
const all = await B((ids) => {
  const b = window.__broadside, R = window.__broadsideR, out = [];
  for (const id of ids) {
    b.startBattle(id); b.step(2);
    const G = b.G, land = R.scene.children.find((o) => o.userData.land);
    let verts = 0, calls = 0;
    land.traverse((o) => { if (o.isMesh && o.visible) { calls++; verts += o.geometry.attributes.position.count * (o.isInstancedMesh ? Math.max(1, o.count) : 1); } });
    // Collision and visuals agree: landmarks on an island stay inside the radius ships are kept off.
    const bad = [];
    for (const o of G.landmarks) {
      if (o.host && o.host.island != null) {
        const is = G.islands[o.host.island], d = b.terrain.coreDist(is, o.x, o.y);
        if (d > is.r * 1.0) bad.push(`${o.kind} ${Math.round(d)} > r ${is.r}`);
      }
      if (o.kind === 'harbour' && o.rate > 0 && b.blockedAt(G.ships[0], o.ax, o.ay)) bad.push('harbour anchorage on land');
      if (o.kind === 'wreck' && !o.host) {
        const on = [...G.reefs, ...G.shoals, ...G.islands].some((c) => b.terrain.coreDist(c, o.x, o.y) < c.r + 4);
        if (!on) bad.push('wreck in open water');
      }
    }
    out.push({ id, n: G.landmarks.length, kinds: [...new Set(G.landmarks.map((o) => o.kind))].length, style: G.style, verts, calls, bad });
  }
  return { out, entries: Object.keys(b.land.LANDS), kinds: Object.entries(b.land.LANDMARKS).filter(([, M]) => !M.about || !M.params).map(([k]) => k) };
}, CAMPAIGN);
check(all.kinds.length === 0, `every landmark kind has about and params (${all.kinds.join(', ') || 'all do'})`, failures);
check(CAMPAIGN.every((id) => all.entries.includes(id)), 'every campaign battle has an entry in src/config/lands.js', failures);
for (const r of all.out) {
  check(r.n >= 3 && r.kinds >= 3, `${r.id}: ${r.n} landmarks of ${r.kinds} kinds (${r.style})`, failures);
  check(r.bad.length === 0, `${r.id}: landmarks inside the land ships collide with${r.bad.length ? ': ' + r.bad.join('; ') : ''}`, failures);
  check(r.calls <= 9 && r.verts < 150000, `${r.id}: land draws in ${r.calls} calls, ${r.verts} vertices`, failures);
}
check(page.errors.length === 0, `no page errors building every battle ${page.errors.slice(0, 3).join(' | ')}`, failures);

// A lab battle with no enemy gunnery: the frigate Resolute and whatever the test adds.
const def = (o = {}) => ({
  name: 'Land test', wind: 0, islands: [{ x: 0.5, y: 0.42, r: 44 }],
  player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.85, h: -90 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.12, y: 0.08, h: 90, passive: true }],
  ...o, ai: { dmgMul: 0, ...(o.ai || {}) },
});
const play = (d) => B((x) => { window.__broadside.playDef(x); window.__broadside.setFire('manual'); window.__broadside.step(1); }, d);

// ---------- The lee of high land ----------
console.log('Lee');
await play(def({ wind: 90, land: { landmarks: [{ kind: 'peak', island: 0, d: 0.1, height: 80 }] } }));
const lee = await B(() => {
  const b = window.__broadside, G = b.G, is = G.islands[0], s = G.ships[0];
  const lee = G.lee[0];
  // Sail across the wind (on the beam) just under the island, then the same course out in clear air.
  const run = (x, y) => {
    s.v = s.speed * 0.6; s.path = []; s.pivot = null; s.hp = s.maxHp;
    for (let i = 0; i < 300; i++) { s.x = x; s.y = y; s.h = 0; b.sim(1); }
    return s.v;
  };
  const dn = G.land ? [-1, 0] : [0, 1]; // downwind is down the chart
  const vLee = run(is.x + dn[0] * (is.r + 70), is.y + dn[1] * (is.r + 70));
  const vClear = run(is.x + dn[0] * (is.r + 70) + dn[1] * 280, is.y + dn[1] * (is.r + 70) + dn[0] * 280);
  return { lee: !!lee, kLee: b.land.leeAt(is.x + dn[0] * (is.r + 60), is.y + dn[1] * (is.r + 60)), kUp: b.land.leeAt(is.x - dn[0] * (is.r + 60), is.y - dn[1] * (is.r + 60)), vLee, vClear };
});
check(lee.lee, 'a peak casts a lee', failures);
check(lee.kLee < 0.7 && lee.kUp === 1, `wind share under the lee ${lee.kLee.toFixed(2)}, upwind ${lee.kUp}`, failures);
check(lee.vLee < lee.vClear * 0.8, `a frigate in the lee sails slower (${lee.vLee.toFixed(1)} vs ${lee.vClear.toFixed(1)} in clear air)`, failures);

// ---------- Harbour ----------
console.log('Harbour');
await play(def({ land: { landmarks: [{ kind: 'harbour', island: 0, at: 90, rate: 3, stock: 40 }] } }));
const yard = await B(() => {
  const b = window.__broadside, G = b.G, s = G.ships[0], h = G.landmarks[0];
  s.hp = s.maxHp * 0.4;
  // Moving fast through the anchorage: nothing.
  s.x = h.ax - 60; s.y = h.ay; s.h = 0; s.v = s.speed; s.path = [{ x: h.ax + 200, y: h.ay }];
  const hp0 = s.hp;
  for (let i = 0; i < 60; i++) { s.v = s.speed; b.sim(1); }
  const moving = s.hp - hp0;
  // Anchored in it: the carpenters go to work.
  s.x = h.ax; s.y = h.ay; s.path = []; s.pivot = s.h; s.v = 0;
  const hp1 = s.hp;
  b.sim(300);
  const fixed = s.hp - hp1;
  b.sim(1200);
  return { moving, fixed, used: h.used, stock: h.stock, hp: s.hp, max: s.maxHp };
});
check(yard.moving < 0.5, `no repairs while sailing through (${yard.moving.toFixed(1)})`, failures);
check(yard.fixed > 12 && yard.fixed < 18, `anchored in the harbour she patches about 3 hull a second (${yard.fixed.toFixed(1)} in 5 s)`, failures);
check(Math.abs(yard.used - yard.stock) < 0.01 && yard.hp < yard.max * 0.85, `the yard's timber runs out (${yard.used.toFixed(0)} of ${yard.stock})`, failures);
// A harbour on a fort's island serves whoever holds the fort.
await play(def({ forts: [{ island: 0, name: 'Fort Test', hp: 100, guns: 0, need: 5 }], land: { landmarks: [{ kind: 'harbour', island: 0, at: 90 }] } }));
const fortYard = await B(() => {
  const b = window.__broadside, G = b.G, s = G.ships[0], h = G.landmarks[0], f = G.forts[0];
  s.hp = s.maxHp * 0.4; s.x = h.ax; s.y = h.ay; s.path = []; s.pivot = s.h; s.v = 0;
  b.sim(120);
  const enemyHeld = s.hp - s.maxHp * 0.4;
  f.team = 'player';
  b.sim(120);
  return { enemyHeld, ours: s.hp - s.maxHp * 0.4 - enemyHeld };
});
check(fortYard.enemyHeld < 0.1 && fortYard.ours > 4, `a fort's harbour serves only whoever holds the fort (${fortYard.enemyHeld.toFixed(1)} then ${fortYard.ours.toFixed(1)})`, failures);

// ---------- Town ----------
console.log('Town');
await play(def({ land: { landmarks: [{ kind: 'town', island: 0, at: 90, d: 0.45, houses: 5, loot: 100, hp: 20, name: 'Testville' }] } }));
const town = await B(() => {
  const b = window.__broadside, G = b.G, S = b.S, t = G.landmarks[0];
  // Shot from the south, straight at the town: it lands on the beach in front of it.
  const fire = (team) => { for (let k = 0; k < 8; k++) S.balls.push({ x: t.x + (k - 4) * 3, y: t.y + 160, vx: 0, vy: -430, travel: 0, max: 400, team, dmg: 4, z0: 6, skip: -1, kind: 'round' }); };
  fire('enemy'); b.sim(60);
  const own = { dmg: t.dmg, sacked: t.sacked };
  fire('player'); b.sim(60);
  return { own, dmg: t.dmg, sacked: t.sacked, plunder: G.stats.plunder, scorch: G.scorch.length };
});
check(town.own.dmg === 0, 'its own side’s shot leaves an enemy town alone', failures);
check(town.sacked && town.plunder === 100, `bombarded, the town is sacked for its loot (${town.plunder} gold)`, failures);
check(town.scorch > 0, `shot scorches the land (${town.scorch} marks)`, failures);
// Plunder is paid with the battle's reward on a win.
const award = await B(async () => {
  const b = window.__broadside, G0 = b.save.gold;
  b.startBattle('sanlucas');
  const G = b.G, t = G.landmarks.find((o) => o.kind === 'town' && o.loot > 0);
  t.dmg = t.hp; b.land.LANDMARKS.town.hit(t, G, t.x, t.y, 1, 'player');
  for (const s of G.ships) if (s.team === 'enemy') { s.hp = 0; s.state = 'sunk'; }
  for (const f of G.forts) { f.team = 'player'; f.state = 'active'; }
  b.sim(200);
  await new Promise((r) => setTimeout(r, 50));
  return { plunder: G.stats.plunder, award: G.award, gold: b.save.gold - G0 };
});
check(award.award && award.award.plunder === award.plunder && award.plunder > 0 && award.award.gold >= award.plunder, `a win pays the plunder with the reward (+${award.award && award.award.gold} gold, ${award.plunder} of it plunder)`, failures);

// ---------- Lighthouse ----------
console.log('Lighthouse');
await play(def({
  fog: 140, islands: [{ x: 0.5, y: 0.3, r: 40 }],
  enemy: [{ type: 'brig', name: 'Near Light', x: 0.5, y: 0.19, h: 0, passive: true }, { type: 'brig', name: 'Far Off', x: 0.15, y: 0.6, h: 0, passive: true }],
  land: { landmarks: [{ kind: 'lighthouse', island: 0, at: -90, d: 0.5, sight: 220 }] },
}));
const light = await B(() => { const b = window.__broadside; b.sim(10); return b.G.ships.filter((s) => s.team === 'enemy').map((s) => [s.name, s.hidden]); });
check(light[0][1] === false && light[1][1] === true, `the lighthouse lifts the fog round it (${JSON.stringify(light)})`, failures);

// ---------- Life by zoom ----------
console.log('Life');
const life = await B(() => {
  const b = window.__broadside, R = window.__broadsideR;
  b.startBattle('tutorial'); b.step(30);
  const cam = b.cam, t = b.G.landmarks.find((o) => o.kind === 'harbour');
  cam.mode = 'manual'; cam.idle = 0; cam.tx = t.x; cam.ty = t.y; cam.d = cam.dMax; b.step(2);
  const far = R.debug.land();
  cam.d = cam.dMin; b.step(2);
  const near = R.debug.land();
  return { far, near };
});
check(life.far.birds === 0 && life.far.people === 0, `zoomed out the land is quiet (${JSON.stringify(life.far)})`, failures);
check(life.near.birds > 0 && life.near.people > 0, `zoomed in: gulls and people (${JSON.stringify(life.near)})`, failures);

check(page.errors.length === 0, `no page errors ${page.errors.slice(0, 3).join(' | ')}`, failures);
await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
