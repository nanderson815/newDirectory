// Combat with decisions and the geography it's fought over, each proven on a small ad-hoc battle (playDef):
// raking fire, critical hits (mast, rudder, fire), shoals that ground big ships but not sloops, reefs, a coast
// that ships collide with and steer round, long islands, and fleetAt openings. Screenshots of every
// geography feature, portrait and landscape, go to SHOTS (default tests/out/combat).
import fs from 'fs';
import path from 'path';
import { launch, open, check, save, OUT } from './lib.mjs';

const SHOTS = process.env.SHOTS || path.join(OUT, 'combat');
fs.mkdirSync(SHOTS, { recursive: true });
const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);
// A lab battle: the frigate Resolute and the sloop Swift. Enemy gunnery does no damage and your crews hold fire,
// so only the mechanic under test changes anything.
const def = (o = {}) => ({
  name: 'Combat lab', wind: 0, islands: [],
  player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.85, h: -90 }, { type: 'sloop', name: 'Swift', x: 0.2, y: 0.9, h: -90 }],
  enemy: [{ type: 'brig', name: 'San Juan', x: 0.85, y: 0.1, h: 90, passive: true }],
  ...o, ai: { dmgMul: 0, ...(o.ai || {}) },
});
const play = (d, p = page) => p.evaluate((x) => { window.__broadside.playDef(x); window.__broadside.setFire('manual'); window.__broadside.step(1); }, d);
// The sea is bigger than the screen and the camera follows the action: `frame` points it by hand instead,
// { ship: name } or { x, y } (map fractions) and how wide: 'close' | 'comfort' | 'wide' | 'all'.
const snap = async (name, p = page, frame = { x: 0.5, y: 0.5, zoom: 'all' }) => {
  await p.evaluate((f) => {
    const b = window.__broadside, G = b.G, cam = b.cam;
    b.setFire('auto'); b.step(2);
    const s = f.ship && G.ships.find((q) => q.name === f.ship);
    cam.mode = 'manual'; cam.idle = -1e9;
    cam.tx = s ? s.x : f.x * G.W; cam.ty = s ? s.y : f.y * G.H;
    cam.d = { close: cam.dClose, comfort: cam.dComfort, wide: cam.dWide, all: cam.dMax }[f.zoom || 'all'];
    b.camTick(0); b.step(1);
  }, frame);
  await p.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 120000 });
  await p.evaluate(() => window.__broadside.setFire('manual'));
};
const f1 = (v) => (typeof v === 'number' ? v.toFixed(1) : String(v));

// ---------- Raking fire ----------
console.log('Raking fire');
await play(def({ enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.4, h: 0, passive: true }] }));
const rake = await B(() => {
  const b = window.__broadside, G = b.G, S = b.S, C = b.hazards.CRIT, saved = { ...C };
  C.chance = 0; C.rakeChance = 0;
  const t = G.ships.find((s) => s.name === 'San Juan');
  // One round shot flying along `ang` straight at her middle.
  const fire = (ang) => {
    t.hp = t.maxHp = 1000; t.rakeAt = -9; S.balls.length = 0; S.floaters.length = 0;
    S.balls.push({ x: t.x - Math.cos(ang) * 70, y: t.y - Math.sin(ang) * 70, vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430, travel: 0, max: 500, team: 'player', dmg: 4, z0: 6, skip: -1, kind: 'round' });
    b.sim(20);
    return { dmg: 1000 - t.hp, words: S.floaters.filter((f) => f.text).map((f) => f.text) };
  };
  const beam = fire(t.h + Math.PI / 2), stern = fire(t.h), bow = fire(t.h + Math.PI), quarter = fire(t.h + 0.6);
  Object.assign(C, saved);
  return { beam, stern, bow, quarter, tip: [...(S.tipAsk || [])].concat(b.save.tips || []), RAKE: b.hazards.RAKE };
});
check(rake.beam.dmg > 3.9 && rake.beam.dmg < 4.1 && !rake.beam.words.length, `a beam hit does plain damage (${f1(rake.beam.dmg)})`, failures);
check(rake.stern.dmg > rake.beam.dmg * 1.6, `a ball in through the stern rakes her: ${f1(rake.stern.dmg)} (x${f1(rake.stern.dmg / rake.beam.dmg)})`, failures);
check(rake.bow.dmg > rake.beam.dmg * 1.45 && rake.bow.dmg < rake.stern.dmg, `through the bow a little less: ${f1(rake.bow.dmg)} (x${f1(rake.bow.dmg / rake.beam.dmg)})`, failures);
check(Math.abs(rake.quarter.dmg - rake.beam.dmg) < 0.1, `a shot from her quarter, outside the ${Math.round(rake.RAKE.cone * 57.3)}° cone, does not rake (${f1(rake.quarter.dmg)})`, failures);
check(rake.stern.words.some((w) => /Raked/.test(w)) && rake.bow.words.some((w) => /Raked/.test(w)), `"${rake.stern.words[0]}" shows over the ship`, failures);
check(rake.tip.includes('rake'), 'and the first rake asks for the one-time raking tip', failures);
await B(() => { const b = window.__broadside; b.S.floaters.length = 0; b.S.balls.length = 0; });
// For the screenshot: the frigate across the brig's stern, guns run out.
await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], t = G.ships.find((s) => s.name === 'San Juan');
  r.x = t.x - 150; r.y = t.y; r.h = -Math.PI / 2; r.v = 0; r.pivot = r.h; t.hp = t.maxHp = 400;
  b.setFire('auto'); r.reload = [0, 0]; b.sim(60); b.setFire('manual');
});
await snap('rake', page, { ship: 'San Juan', zoom: 'close' });

// ---------- Critical hits ----------
console.log('Critical hits');
await play(def());
const crit = await B(() => {
  const b = window.__broadside, G = b.G, S = b.S, C = b.hazards.CRIT, saved = { ...C };
  const t = G.ships.find((s) => s.name === 'San Juan'), out = {};
  // A real ball with a certain crit.
  C.chance = 1;
  S.balls.push({ x: t.x - 70, y: t.y, vx: 430, vy: 0, travel: 0, max: 500, team: 'player', dmg: 4, z0: 6, skip: -1, kind: 'round' });
  b.sim(20);
  out.rolled = (t.mastsDown || 0) + (t.rudderT > 0 ? 1 : 0) + (t.fireT > 0 ? 1 : 0);
  out.rollWords = S.floaters.filter((f) => f.text).map((f) => f.text);
  // Grape and chain never crit.
  t.mastsDown = 0; t.rudderT = 0; t.fireT = 0;
  S.balls.push({ x: t.x - 70, y: t.y, vx: 430, vy: 0, travel: 0, max: 500, team: 'player', dmg: 1, z0: 6, skip: -1, kind: 'grape' });
  b.sim(20);
  out.grape = (t.mastsDown || 0) + (t.rudderT > 0 ? 1 : 0) + (t.fireT > 0 ? 1 : 0);
  Object.assign(C, saved);

  // Mast down: Swift's speed on a steady course, before and after.
  const s = G.ships.find((q) => q.name === 'Swift'), x0 = s.x, y0 = s.y;
  const cruise = () => { s.x = x0; s.y = y0; s.h = -Math.PI / 2; s.path = [{ x: x0, y: 30 }]; b.sim(60 * 7); return s.v; };
  out.v0 = cruise();
  b.hazards.applyCrit(s, 'mast');
  out.v1 = cruise();
  b.sim(60 * 20);
  out.mastsLater = s.mastsDown;
  out.v2 = cruise();
  s.mastsDown = 0;

  // Rudder: how far she swings in a second toward a mark abeam.
  const swing = () => {
    s.x = x0; s.y = y0 - 200; s.h = -Math.PI / 2; s.v = s.speed * 0.8; s.path = [{ x: x0 + 300, y: y0 - 200 }];
    const h0 = s.h; b.sim(45); return Math.abs(s.h - h0);
  };
  out.turn0 = swing();
  b.hazards.applyCrit(s, 'rudder');
  out.rudderT = s.rudderT;
  out.turn1 = swing();
  b.sim(60 * 8);
  out.rudderAfter = s.rudderT;
  out.turn2 = swing();

  // Fire aboard: damage over a few seconds, then out.
  s.hp = s.maxHp; s.path = []; s.pivot = s.h;
  b.hazards.applyCrit(s, 'fire');
  const hp0 = s.hp;
  b.sim(60 * 6);
  out.fireDmg = hp0 - s.hp; out.fireT = s.fireT;
  const hp1 = s.hp;
  b.sim(60 * 3);
  out.fireAfter = hp1 - s.hp;
  out.words = S.floaters.filter((f) => f.text).map((f) => f.text);
  out.CRIT = C;
  return out;
});
check(crit.rolled === 1, `a lucky shot does one critical hit (${crit.rollWords.join(', ')})`, failures);
check(crit.grape === 0, 'grapeshot never does', failures);
check(crit.v1 / crit.v0 > 0.62 && crit.v1 / crit.v0 < 0.78, `mast down: ${f1(crit.v0)} -> ${f1(crit.v1)} (x${(crit.v1 / crit.v0).toFixed(2)})`, failures);
check(crit.mastsLater === 1 && crit.v2 / crit.v0 < 0.78, `and it stays down for the battle (${crit.mastsLater} down, ${f1(crit.v2)} 20 s later)`, failures);
check(crit.turn1 < crit.turn0 * 0.62, `rudder shot away: swing ${f1(crit.turn0)} -> ${f1(crit.turn1)} rad in 0.75 s`, failures);
check(crit.rudderT === crit.CRIT.rudderSecs && crit.rudderAfter === 0 && crit.turn2 > crit.turn0 * 0.9, `repaired after ${crit.CRIT.rudderSecs} s (swing ${f1(crit.turn2)})`, failures);
const fireWant = crit.CRIT.fireDps * crit.CRIT.fireSecs;
check(Math.abs(crit.fireDmg - fireWant) <= 2.5 && crit.fireT === 0, `fire aboard burns ${f1(crit.fireDmg)} hull (about ${fireWant}) and goes out`, failures);
check(crit.fireAfter === 0, 'and does no more once it is out', failures);
check(['Mast down!', 'Rudder shot away!', 'Fire aboard!'].every((w) => crit.words.includes(w)), 'each one says what happened over the ship', failures);
// Screenshot: the brig on fire and dismasted.
await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], t = G.ships.find((s) => s.name === 'San Juan');
  t.x = r.x + 30; t.y = r.y - 260; t.h = 0; b.S.floaters.length = 0;
  b.hazards.applyCrit(t, 'mast'); b.sim(20); b.hazards.applyCrit(t, 'fire'); b.sim(30);
});
await snap('crits', page, { ship: 'San Juan', zoom: 'close' });

// ---------- Shoals ----------
console.log('Shoals');
const shoalDef = def({ shoals: [{ x: 0.5, y: 0.5, r: 56, stretch: 1.4, angle: 0 }], player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.85, h: -90 }, { type: 'sloop', name: 'Swift', x: 0.3, y: 0.85, h: -90 }] });
await play(shoalDef);
const shoal = await B(() => {
  const b = window.__broadside, G = b.G, c = G.shoals[0], out = {};
  const [r, s] = G.ships;
  // Put each straight onto the shallows, under way.
  for (const [q, k] of [[r, 'big'], [s, 'small']]) {
    q.x = c.x; q.y = c.y + c.r * 0.6; q.h = -Math.PI / 2; q.v = q.speed * 0.9; q.path = [{ x: c.x, y: c.y - 400 }];
    const hp = q.hp; let aground = false;
    for (let i = 0; i < 60; i++) { b.sim(1); aground = aground || q.aground; }
    out[k] = { aground, v: q.v / q.speed, dmg: hp - q.hp };
    q.x = 60 + (k === 'big' ? 0 : 120); q.y = G.H - 80; q.path = []; q.v = 0;
  }
  return out;
});
check(shoal.big.aground && shoal.big.v < 0.45 && shoal.big.dmg >= 4, `a frigate runs aground: speed x${shoal.big.v.toFixed(2)}, ${f1(shoal.big.dmg)} hull`, failures);
check(!shoal.small.aground && shoal.small.v > 0.7 && shoal.small.dmg === 0, `a sloop sails over (speed x${shoal.small.v.toFixed(2)})`, failures);
const across = await B(() => {
  const b = window.__broadside, G = b.G, c = G.shoals[0], out = {};
  for (const name of ['Resolute', 'Swift']) {
    const q = G.ships.find((s) => s.name === name);
    q.x = c.x - 10; q.y = Math.min(G.H - 60, c.y + 300); q.h = -Math.PI / 2; q.v = q.speed * 0.6; q.hp = q.maxHp;
    q.path = [{ x: c.x - 10, y: Math.max(60, c.y - 300) }];
    let aground = false, closest = Infinity, t = 0;
    for (; t < 40 && q.path.length; t += 1 / 60) { b.sim(1); aground = aground || q.aground; closest = Math.min(closest, b.terrain.coreDist(c, q.x, q.y)); }
    out[name] = { aground, closest: closest / c.r, left: Math.hypot(q.x - (c.x - 10), q.y - Math.max(60, c.y - 300)), t };
    q.x = name === 'Swift' ? 60 : 160; q.y = G.H - 70; q.path = []; q.v = 0;
  }
  return out;
});
check(!across.Resolute.aground && across.Resolute.closest > 1 && across.Resolute.left < 70, `a frigate ordered across steers round it (closest ${f1(across.Resolute.closest)} r, arrived in ${f1(across.Resolute.t)} s)`, failures);
check(!across.Swift.aground && across.Swift.closest < 0.5, `a sloop takes the short cut straight over (closest ${f1(across.Swift.closest)} r)`, failures);

// ---------- Reefs ----------
console.log('Reefs');
await play(def({ reefs: [{ x: 0.5, y: 0.5, r: 13, stretch: 5, angle: 0 }] }));
const reef = await B(() => {
  const b = window.__broadside, G = b.G, c = G.reefs[0], s = G.ships.find((q) => q.name === 'Swift'), out = {};
  s.x = c.x; s.y = c.y + 6; s.h = -Math.PI / 2; s.v = s.speed; s.path = [{ x: c.x, y: c.y - 300 }];
  const hp = s.hp; let on = false;
  for (let i = 0; i < 90; i++) { b.sim(1); on = on || s.onReef; }
  out.dmg = hp - s.hp; out.on = on;
  // Ordered across from well short of it, she steers round.
  s.hp = s.maxHp; s.x = c.x + 20; s.y = c.y + 260; s.h = -Math.PI / 2; s.v = s.speed * 0.6; s.path = [{ x: c.x + 20, y: c.y - 260 }];
  let crossed = false, t = 0;
  for (; t < 30 && s.path.length; t += 1 / 60) { b.sim(1); crossed = crossed || s.onReef; }
  out.avoided = !crossed && s.hp === s.maxHp; out.t = t;
  return out;
});
check(reef.on && reef.dmg >= 6, `a sloop driven over the reef is holed (${f1(reef.dmg)} hull in 1.5 s)`, failures);
check(reef.avoided, `one ordered across steers round it (${f1(reef.t)} s)`, failures);

// ---------- Coast ----------
console.log('Coast');
const coastDef = def({ coast: { side: 'left', depth: 0.22, rough: 0.2, capes: [{ at: 0.5, width: 0.4, depth: 0.42 }] } });
await play(coastDef);
const coast = await B(() => {
  const b = window.__broadside, G = b.G, c = G.coasts[0], out = {};
  const r = G.ships[0];
  // Ordered with a drawn line that runs straight through the cape.
  const x = G.W * 0.3, y0 = G.H * 0.85, y1 = G.H * 0.14;
  for (const dense of [false, true]) {
    r.x = x; r.y = y0; r.h = -Math.PI / 2; r.v = r.speed * 0.5; r.hp = r.maxHp;
    const m = dense ? Math.ceil((y0 - y1) / 12) : 1;
    r.path = Array.from({ length: m }, (_, i) => ({ x, y: y0 + ((y1 - y0) * (i + 1)) / m }));
    let worst = Infinity, t = 0;
    for (; t < 60 && r.path.length; t += 1 / 60) { b.sim(1); worst = Math.min(worst, b.terrain.coastGap(c, r.x, r.y)); }
    out[dense ? 'dense' : 'single'] = { worst, left: Math.hypot(r.x - x, r.y - y1), t, onLand: b.blockedAt(r, x, y1) };
  }
  // Shoved onto the land, she is pushed back off it.
  r.x = 20; r.y = G.H * 0.5; r.path = []; b.sim(2);
  out.pushed = b.terrain.coastGap(c, r.x, r.y);
  out.capeTip = G.W * (0.22 + 0.42);
  out.L = r.L;
  return out;
});
for (const k of ['single', 'dense']) {
  const o = coast[k];
  check(o.worst > 0, `${k === 'dense' ? 'a drawn line' : 'one waypoint'} past the cape: she never touches land (closest ${f1(o.worst)} units off the shore)`, failures);
  check(o.onLand || o.left < 80, `and gets round to the far side (${f1(o.left)} units short after ${f1(o.t)} s)`, failures);
}
check(coast.pushed >= coast.L * 0.42, `a ship shoved ashore is pushed back to sea (${f1(coast.pushed)} units off)`, failures);
await play({ ...coastDef, shoals: [{ x: 0.6, y: 0.3, r: 40, stretch: 1.6, angle: 25 }], reefs: [{ x: 0.7, y: 0.68, r: 12, stretch: 4, angle: -15 }], islands: [{ x: 0.78, y: 0.47, r: 26, stretch: 2.4, angle: 75 }] });
await snap('coast-portrait');

// ---------- Long islands ----------
console.log('Long islands');
await play(def({ islands: [{ x: 0.5, y: 0.5, r: 24, stretch: 4, angle: 0 }] }));
const isle = await B(() => {
  const b = window.__broadside, G = b.G, is = G.islands[0], r = G.ships[0], out = {};
  out.hl = is.hl;
  // A line that a round island of the same size would leave clear, but the ridge's end lies across.
  const x = is.x - is.hl + 6, y0 = is.y + 300, y1 = is.y - 300;
  out.roundWouldBlock = Math.abs(x - is.x) < is.r * 1.05 + r.L * 0.42;
  r.x = x; r.y = y0; r.h = -Math.PI / 2; r.v = r.speed * 0.5; r.path = [{ x, y: y1 }];
  let worst = Infinity, t = 0;
  for (; t < 40 && r.path.length; t += 1 / 60) { b.sim(1); worst = Math.min(worst, b.terrain.coreDist(is, r.x, r.y) - is.r); }
  out.worst = worst; out.left = Math.hypot(r.x - x, r.y - y1); out.t = t;
  // Dropped onto the ridge, near one end, she's pushed off it, not just away from the middle.
  r.x = is.x + is.hl * 0.8; r.y = is.y + 4; r.path = []; b.sim(2);
  out.pushed = b.terrain.coreDist(is, r.x, r.y) - is.r;
  // Shot can't pass it either.
  const S = b.S; S.balls.length = 0;
  S.balls.push({ x: is.x + is.hl * 0.7, y: is.y + 120, vx: 0, vy: -430, travel: 0, max: 400, team: 'enemy', dmg: 4, z0: 6, skip: -1, kind: 'round' });
  b.sim(30);
  out.ballY = S.balls.length ? S.balls[0].y : null;
  return out;
});
check(!isle.roundWouldBlock && isle.worst > 0, `a ship ordered past the end of a long island keeps off it (closest ${f1(isle.worst)} units off the beach)`, failures);
check(isle.left < 80, `and still gets there (${f1(isle.left)} short after ${f1(isle.t)} s)`, failures);
check(isle.pushed > 0, `a ship dropped near the end of the ridge is pushed off it (${f1(isle.pushed)} units clear)`, failures);
check(isle.ballY === null, 'a ball fired across the ridge stops on it', failures);

// ---------- fleetAt ----------
console.log('Openings (fleetAt)');
const at = await B(() => {
  const b = window.__broadside, out = {};
  for (const where of ['left', 'top', 'center']) {
    b.playDef({ name: 'Opening', wind: 0, islands: [], fleetAt: where, enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.9, h: -90 }], ai: { dmgMul: 0 } });
    const G = b.G, ours = G.ships.filter((s) => s.team === 'player');
    out[where] = { n: ours.length, xs: ours.map((s) => s.x / G.W), ys: ours.map((s) => s.y / G.H), h: ours[0].h };
  }
  return out;
});
check(at.left.n === 3 && at.left.xs.every((x) => x < 0.35), `fleetAt: 'left' starts the fleet on the left (${at.left.xs.map((x) => x.toFixed(2)).join(', ')}) facing east`, failures);
check(at.top.ys.every((y) => y < 0.25) && Math.abs(at.top.h - Math.PI / 2) < 0.01, `'top' starts it at the top, facing down the chart (an enemy astern)`, failures);
check(at.center.ys.every((y) => y > 0.4 && y < 0.7), `'center' starts it mid-chart`, failures);

// ---------- AI captains and raking ----------
console.log('AI captains');
await play(def({ player: [{ type: 'frigate', name: 'Resolute', x: 0.5, y: 0.6, h: -90 }], enemy: [{ type: 'brig', name: 'El Zorro', x: 0.5, y: 0.2, h: 90 }] }));
const ai = await B(() => {
  const b = window.__broadside, G = b.G, r = G.ships[0], e = G.ships[1];
  r.pivot = r.h; r.v = 0; e.crafty = true;
  let astern = false;
  for (let t = 0; t < 40 && !astern; t += 0.25) {
    b.sim(15);
    const a = Math.atan2(e.y - r.y, e.x - r.x), d = Math.hypot(e.x - r.x, e.y - r.y);
    astern = Math.cos(a - (r.h + Math.PI)) > 0.92 && d < e.range;
  }
  return { astern };
});
check(ai.astern, 'a crafty enemy captain works round to cross a stationary frigate’s stern', failures);
check(page.errors.length === 0, `no page errors (${page.errors.slice(0, 2).join(' | ')})`, failures);

// ---------- Geography screenshots ----------
console.log('Screenshots');
const scenes = {
  shoals: def({ shoals: [{ x: 0.35, y: 0.42, r: 54, stretch: 1.6, angle: 30 }, { x: 0.72, y: 0.62, r: 36 }], islands: [{ x: 0.75, y: 0.3, r: 28 }] }),
  reefs: def({ reefs: [{ x: 0.42, y: 0.4, r: 14, stretch: 5, angle: 15 }, { x: 0.7, y: 0.6, r: 22 }, { x: 0.3, y: 0.62, r: 10, stretch: 3, angle: -40 }] }),
  'long-islands': def({ islands: [{ x: 0.3, y: 0.38, r: 30, stretch: 3, angle: 60 }, { x: 0.72, y: 0.55, r: 26, stretch: 2.2, angle: -20 }] }),
  cove: def({ coast: { side: 'top', depth: 0.3, coves: [{ at: 0.5, width: 0.5, depth: 0.22 }] }, reefs: [{ x: 0.3, y: 0.42, r: 10, stretch: 3, angle: 10 }], enemy: [{ type: 'brig', name: 'San Juan', x: 0.5, y: 0.2, h: 90, passive: true }] }),
  channel: def({ coast: { side: 'left', depth: 0.24, capes: [{ at: 0.45, width: 0.35, depth: 0.12 }] }, islands: [{ x: 0.74, y: 0.45, r: 30, stretch: 2.8, angle: 85 }], shoals: [{ x: 0.52, y: 0.22, r: 30 }] }),
};
const land = await open(browser, { width: 844, height: 390, save: save({ stars: { tutorial: 3 } }) });
// Small features close up, shores whole.
const frames = { shoals: { x: 0.5, y: 0.5, zoom: 'wide' }, reefs: { x: 0.5, y: 0.5, zoom: 'wide' }, 'long-islands': { x: 0.5, y: 0.46, zoom: 'wide' } };
for (const [name, d] of Object.entries(scenes)) {
  await play(d);
  await snap(`${name}-portrait`, page, frames[name]);
  await play(d, land);
  await snap(`${name}-landscape`, land, frames[name]);
}
await play({ ...coastDef, shoals: [{ x: 0.6, y: 0.3, r: 40, stretch: 1.6, angle: 25 }], reefs: [{ x: 0.7, y: 0.68, r: 12, stretch: 4, angle: -15 }], islands: [{ x: 0.78, y: 0.47, r: 26, stretch: 2.4, angle: 75 }] }, land);
await snap('coast-landscape', land);
check(land.errors.length === 0, `no page errors in landscape (${land.errors.slice(0, 2).join(' | ')})`, failures);
console.log(`  screenshots in ${SHOTS}`);

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
