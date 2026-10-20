import { S, afloat, alive, shipById, unitById, fortById, showBanner, addDamage, selfSailing } from '../state.js';
import { BALL_SPEED, BALL_DMG, MINE_DMG, FORT } from '../config/ships.js';
import { AMMO } from '../config/ammo.js';
import { PI, clamp, lerp, rand, angDiff, reduceMotion } from '../util.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';
import { updateShell, lobShell, shellTarget } from './abilities/mortar.js';
import { GUNS } from '../config/guns.js';
import { applyReloadWrites, syncReload, handFired, shotFor, batteryRange, gunPoint } from './guns.js';
import { abilitiesSunk } from './abilities/index.js';
import { goalsSunk } from './goals/index.js';
import { RAKE, rakeEnd, raked, rollCrit, applyCrit } from './hazards.js';
import { coreDist, coastGap } from './terrain.js';
import { landHit } from './land.js';

const FORT_SIZE = 20;        // a fort counts as in range once its walls are
// Gunnery scatter scales with the hulls. The fleet pass cut every hull to 3/4 on the same sea
// (src/config/ships.js), so every gun (ships, chasers, forts, both sides) lays its shot 3/4 as wide in bearing
// and in range: a ship is then exactly as easy a mark at any range as she was, and the campaign's difficulty
// stays where it was tuned (tests/balance.mjs).
export const AIM = 0.75;
const scatter = (lo, hi) => 1 + rand(lo - 1, hi - 1) * AIM; // a range error, as a factor on the distance

export const sideDir = (s, side) => s.h + (side === 0 ? -PI / 2 : PI / 2); // 0 = port, 1 = starboard

// Everything an enemy of `team` could shoot at: ships afloat and forts with working guns.
// In fog the English can't aim at what their lookouts can't see.
function* targets(team) {
  for (const e of S.G.ships) if (e.team !== team && afloat(e) && !(e.hidden && team === 'player')) yield e;
  for (const f of S.G.forts) if (f.team !== team && f.state === 'active') yield f;
}

// The nearest target within `range` (and beyond `min`) inside `arc` of `dir`; an arc of PI or more is all round.
function nearestInArc(s, dir, arc, range, min = 0) {
  let best = null, bd = Infinity;
  for (const e of targets(s.team)) {
    const d = Math.hypot(e.x - s.x, e.y - s.y) - (e.kind === 'fort' ? FORT_SIZE : 0);
    if (d > range || d >= bd || d < min) continue;
    if (arc >= PI || Math.abs(angDiff(dir, Math.atan2(e.y - s.y, e.x - s.x))) < arc) { best = e; bd = d; }
  }
  return best;
}
// What one battery (src/sim/guns.js) could hit now: the nearest target in its own arc and reach.
const batteryTarget = (s, b) => nearestInArc(s, b.face == null ? s.h : s.h + b.face, b.arc, batteryRange(s, b), b.minRange);
// Her broadside reach (one side, or either): the longest of the hand-fired batteries with the shot they load.
export const gunRange = (s, side = null) => {
  let r = 0;
  for (const b of s.batteries) if (handFired(b) && (side == null || b.side === side)) r = Math.max(r, batteryRange(s, b));
  return r;
};
export const findBroadsideTarget = (s, side) => {
  let arc = 0;
  for (const b of s.batteries) if (b.side === side && handFired(b)) arc = Math.max(arc, b.arc);
  return arc ? nearestInArc(s, sideDir(s, side), arc, gunRange(s, side)) : null;
};
export const findChaseTarget = (s) => {
  const b = s.batteries.find((q) => q.pos === 'bow');
  return b ? batteryTarget(s, b) : null;
};

// Where to aim at a moving target so the ball arrives where it will be.
function leadPoint(t, gx, gy) {
  const v = t.kind === 'fort' ? 0 : t.v, h = t.kind === 'fort' ? 0 : t.h;
  const lead = Math.hypot(t.x - gx, t.y - gy) / BALL_SPEED;
  return [t.x + Math.cos(h) * v * lead, t.y + Math.sin(h) * v * lead];
}

function launch(team, gx, gy, ang, dist, dmg, z0, skip, kind = 'round', extra = null) {
  const b = { x: gx, y: gy, vx: Math.cos(ang) * BALL_SPEED, vy: Math.sin(ang) * BALL_SPEED, travel: 0, max: dist, team, dmg, z0, skip, kind };
  S.balls.push(extra ? Object.assign(b, extra) : b);
}

// Flash and smoke at a muzzle; `k` scales it with the bore (a swivel puffs, a demi-cannon billows).
function muzzle(x, y, dir, z, k = 1) {
  spawn('flash', x + Math.cos(dir) * 5, y + Math.sin(dir) * 5, 0, 0, 0.14, 6 * k, z, 0);
  const w = S.G.wind.dir;
  for (let n = 0; n < Math.max(1, Math.round(3 * k)); n++) {
    spawn('smoke', x + Math.cos(dir) * 8, y + Math.sin(dir) * 8,
      Math.cos(dir) * rand(20, 45) + Math.cos(w) * 12, Math.sin(dir) * rand(20, 45) + Math.sin(w) * 12,
      rand(1.2, 2.0), rand(5, 8) * k, z + 1, rand(6, 14));
  }
}

const enemyMul = (team, k) => (team === 'enemy' ? S.G.ai[k] : 1);

// Crews cut down by grapeshot reload more slowly.
export const crewMul = (s) => 1 + Math.min(0.5, 0.06 * s.crewHit);

// Every tick for a ship afloat: her batteries (src/sim/guns.js) load, and those that may fire on their own do.
// `fire: false` (a hulk, a boarding action) only loads. Broadside batteries fire on their own when `broadsides`
// (the enemy, Auto, ships that sail themselves); swivels, chasers, mortars and fire-pots (guns marked auto) always
// do. Each battery waits for a target inside its own reach and arc, so carronades hold fire until the enemy is
// close and swivels only speak at pistol shot.
export function updateGuns(s, dt, { fire = true, broadsides = true } = {}) {
  applyReloadWrites(s);
  for (const b of s.batteries) b.t -= dt;
  if (fire) {
    for (let i = 0; i < s.batteries.length; i++) {
      const b = s.batteries[i];
      if (b.t > 0 || (!b.auto && !broadsides)) continue;
      const tgt = GUNS[b.gun].fires === 'shell' ? shellTarget(s, b.range, b.minRange) : batteryTarget(s, b);
      if (tgt) fireBattery(s, i, tgt);
    }
  }
  syncReload(s);
}

// Fires one battery at a target (or, with none, out along its facing to full reach): a rippling discharge of its
// guns, a mortar shell, or a fire-pot.
export function fireBattery(s, bi, tgt) {
  const b = s.batteries[bi], G = GUNS[b.gun];
  if (G.fires === 'shell' && !tgt) return;
  b.t = b.reloadTime * enemyMul(s.team, 'reloadMul') * crewMul(s) * rand(0.95, 1.05);
  if (G.fires === 'shell') { lobShell(s, tgt, { dmg: b.dmg, radius: G.radius }); return; }
  const shot = shotFor(s, b);
  for (let i = 0; i < b.count; i++) {
    S.pending.push({ t: i * (b.pos === 'broadside' ? 0.075 : 0.12) + rand(0, 0.04), shipId: s.id, bi, gi: i, targetId: tgt ? tgt.id : null, ammo: shot });
  }
  if (s.team === 'player') S.G.stats.shots += b.count * (G.pellets || (AMMO[shot] && AMMO[shot].pellets) || 1);
  if (s.team === 'player' && s === S.selected && handFired(b) && !reduceMotion) S.kick = Math.max(S.kick, 1);
}

// Fires a side's loaded broadside (manual fire, or the AI): every hand-fired battery on that side that is ready,
// each at the target if it has one, else abeam to its own reach. Returns how many batteries fired.
export function fireBroadside(s, side, tgt) {
  let n = 0;
  for (let i = 0; i < s.batteries.length; i++) {
    const b = s.batteries[i];
    if (b.side !== side || !handFired(b) || b.t > 0) continue;
    fireBattery(s, i, tgt);
    n++;
  }
  syncReload(s);
  return n;
}

export function fireQueued(p) {
  if (p.fortId != null) fireFortGun(p); else fireGun(p);
}

// One gun of a battery goes off: a ball (or a spray of pellets, or a fire-pot) toward the target, trained as far
// as the gun will traverse.
function fireGun(p) {
  const s = shipById(p.shipId);
  if (!s || !afloat(s)) return;
  const b = s.batteries && s.batteries[p.bi];
  if (!b) return;
  const G = GUNS[b.gun];
  const [gx, gy, z] = gunPoint(s, b, p.gi);
  const t = p.targetId != null ? unitById(p.targetId) : null;
  const live = t && alive(t);
  const dir = b.face != null ? s.h + b.face : live ? Math.atan2(t.y - gy, t.x - gx) : s.h;
  const kind = p.ammo || 'round', A = AMMO[kind] || { hull: 1, range: 1 }, range = batteryRange(s, b, kind);
  let ang = dir, dist = range * 0.95;
  if (live) {
    const [ax, ay] = leadPoint(t, gx, gy);
    // Guns only traverse a little; clamp the aim to what this one can train.
    const trav = G.traverse != null ? G.traverse : 0.7;
    ang = dir + clamp(angDiff(dir, Math.atan2(ay - gy, ax - gx)), -trav, trav);
    dist = Math.hypot(ax - gx, ay - gy);
  }
  const spread = (s.team === 'enemy' ? S.G.ai.spread : b.pos === 'broadside' ? 0.07 : 0.06) * AIM;
  const dmg = b.dmg * enemyMul(s.team, 'dmgMul') * A.hull;
  const pellets = G.pellets || A.pellets || 1;
  const extra = G.crewKill != null || G.burn ? { crew: G.crewKill, burn: G.burn || 0 } : null;
  // Grapeshot leaves the muzzle as a spray of pellets; everything else is one ball.
  for (let k = 0; k < pellets; k++) {
    const a = ang + rand(-spread, spread) * (pellets > 1 ? 2.5 : 1);
    launch(s.team, gx, gy, a, clamp(dist * scatter(0.9, 1.12), 40, range * 1.1), dmg, z, -1, kind === 'pot' ? 'firepot' : kind, extra);
  }
  const bore = G.render ? G.render.bore : 1;
  muzzle(gx, gy, ang, z, clamp(bore, 0.4, 1.4));
  // A little recoil from the great guns.
  if (b.pos === 'broadside' && bore >= 0.9) { s.x -= Math.cos(dir) * 0.6; s.y -= Math.sin(dir) * 0.6; }
  if (b.pos === 'broadside') sfx.gun(gx, gy, (s.team === 'player' ? 0.9 : 0.6) * clamp(bore, 0.45, 1.2));
  else if (p.gi === 0) sfx.gun(gx, gy, (s.team === 'player' ? 0.55 : 0.4) * clamp(bore, 0.45, 1.2), 1.2);
}

// Bow chasers on demand (older callers); the bow battery normally fires on its own (updateGuns).
export function fireChasers(s, t) {
  const i = s.batteries.findIndex((b) => b.pos === 'bow');
  if (i >= 0) fireBattery(s, i, t);
}

// A fort's tower gun, fired from high up so its shot clears its own island.
function fireFortGun(p) {
  const f = fortById(p.fortId);
  if (!f || f.state !== 'active') return;
  const t = shipById(p.targetId);
  if (!t || !afloat(t)) return;
  const gx = f.x + Math.cos(f.aim) * 12, gy = f.y + Math.sin(f.aim) * 12;
  const [ax, ay] = leadPoint(t, gx, gy);
  const spread = (f.team === 'enemy' ? S.G.ai.spread : 0.08) * AIM;
  const ang = Math.atan2(ay - gy, ax - gx) + rand(-spread, spread);
  const dist = clamp(Math.hypot(ax - gx, ay - gy) * scatter(0.92, 1.08), 40, f.range * 1.1);
  launch(f.team, gx, gy, ang, dist, BALL_DMG * FORT.dmgMul * enemyMul(f.team, 'dmgMul'), FORT.gunHeight, f.island);
  if (f.team === 'player') S.G.stats.shots++;
  muzzle(gx, gy, f.aim, FORT.gunHeight);
  sfx.fortGun(gx, gy, f.team === 'player' ? 0.8 : 0.7);
}

export function updateBalls(dt) {
  const G = S.G, balls = S.balls;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    // Mortar shells fly high over everything and burst where they land.
    if (b.kind === 'shell') {
      if (updateShell(b, dt)) { const last = balls.pop(); if (i < balls.length) balls[i] = last; }
      continue;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.travel += BALL_SPEED * dt;
    let done = false;
    for (const e of G.ships) {
      if (e.team === b.team || !afloat(e)) continue;
      const dx = b.x - e.x, dy = b.y - e.y;
      const c = Math.cos(-e.h), sn = Math.sin(-e.h);
      const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      if ((lx * lx) / (e.L * e.L * 0.25) + (ly * ly) / (e.B * e.B * 0.3) < 1) {
        hitShip(e, b); done = true; break;
      }
    }
    if (!done) {
      for (let ii = 0; ii < G.islands.length; ii++) {
        if (ii === b.skip) continue;
        const is = G.islands[ii];
        if (coreDist(is, b.x, b.y) >= is.r * 0.95) continue;
        // Shot that lands on a fort's island hits the fort if it's the enemy's and still firing.
        const f = is.fort ? G.forts.find((q) => q.island === ii) : null;
        if (f && f.team !== b.team && f.state === 'active') hitFort(f, b);
        else {
          for (let k = 0; k < 6; k++) spawn('sand', b.x, b.y, rand(-40, 40), rand(-40, 40), rand(0.4, 0.7), rand(1.5, 3), 8, rand(20, 50));
          landHit(G, b.x, b.y, b.dmg, b.team); // a scorch mark; a town there takes the hit (src/sim/land.js)
        }
        done = true;
        break;
      }
    }
    // Shot that falls short on a coast throws up sand.
    if (!done && G.coasts) {
      for (const c of G.coasts) {
        if (coastGap(c, b.x, b.y) > -4) continue;
        for (let k = 0; k < 6; k++) spawn('sand', b.x, b.y, rand(-40, 40), rand(-40, 40), rand(0.4, 0.7), rand(1.5, 3), 8, rand(20, 50));
        landHit(G, b.x, b.y, b.dmg, b.team);
        done = true;
        break;
      }
    }
    if (!done && b.travel >= b.max) {
      spawn('splash', b.x, b.y, 0, 0, 0.6, 8);
      for (let k = 0; k < 6; k++) spawn('drop', b.x, b.y, rand(-25, 25), rand(-25, 25), rand(0.5, 0.8), rand(1.6, 3), 1, rand(50, 90));
      sfx.splash(b.x, b.y);
      done = true;
    }
    if (done || b.x < -50 || b.y < -50 || b.x > G.W + 50 || b.y > G.H + 50) {
      const last = balls.pop();
      if (i < balls.length) balls[i] = last;
    }
  }
}

export function hitShip(e, b) {
  const G = S.G;
  // A ball that runs her length, in through the stern or the bow, rakes her (src/sim/hazards.js).
  const end = rakeEnd(e, b), dmg = end ? b.dmg * RAKE[end] : b.dmg;
  e.hp -= dmg; e.flash = 0.14;
  addDamage(e, dmg);
  if (end) raked(e, b, end);
  rollCrit(e, b, end);
  if (b.kind === 'chain') e.slowT = Math.max(e.slowT, AMMO.chain.slow);
  // Each pellet that lands has a fair chance of cutting down a man; a full grape broadside from a frigate kills three or four.
  // Swivels (crewKill in src/config/guns.js) are deadlier still.
  if (b.kind === 'grape') { if (Math.random() < (b.crew != null ? b.crew : 0.25)) e.marines = Math.max(0, e.marines - 1); e.crewHit = Math.min(8, e.crewHit + 0.15); }
  // A fire-pot that lands sets her burning (or keeps her burning).
  if (b.burn && e.state === 'afloat') applyCrit(e, 'fire', b.burn);
  if (b.team === 'player' && !b.mine) G.stats.hits++;
  for (let k = 0; k < 7; k++) spawn('splinter', b.x, b.y, rand(-60, 60), rand(-60, 60), rand(0.6, 1.0), rand(2, 4.5), 10, rand(30, 70));
  spawn('smoke', b.x, b.y, rand(-8, 8), rand(-8, 8), 0.8, 5, 10, 8);
  sfx.woodHit(b.x, b.y);
  if (e.team === 'player' && !reduceMotion) S.shake = Math.max(S.shake, b.mine ? 8 : 5);
  if (e.hp <= 0 && e.state === 'afloat') sinkShip(e);
}

export function sinkShip(e) {
  const G = S.G;
  e.hp = 0; e.state = 'sinking'; e.sinkT = 0; e.path = []; e.pivot = null;
  spawn('splash', e.x, e.y, 0, 0, 1.0, e.L * 0.45);
  sfx.sink(e.x, e.y, e.L);
  if (e.boss) {
    showBanner(`${e.boss.captain} is beaten!`, `${e.boss.title} is going down`, 3);
    sfx.bossDown();
    if (!reduceMotion) S.slowmo = { until: S.clock + 1.8, k: 0.3 };
  }
  abilitiesSunk(e);
  goalsSunk(G, e);
  if (S.selected === e) S.selected = G.ships.find((s) => s.team === 'player' && afloat(s) && !selfSailing(s)) || null;
}

export function hitFort(f, b) {
  f.hp -= b.dmg;
  addDamage(f, b.dmg);
  if (b.team === 'player') S.G.stats.hits++;
  for (let k = 0; k < 6; k++) spawn('stone', f.x + rand(-10, 10), f.y + rand(-10, 10), rand(-50, 50), rand(-50, 50), rand(0.6, 1.0), rand(2, 4), 22, rand(30, 70));
  spawn('smoke', f.x + rand(-8, 8), f.y + rand(-8, 8), rand(-8, 8), rand(-8, 8), 0.9, 7, 24, 10);
  sfx.stoneHit(f.x, f.y);
  if (f.hp <= 0 && f.state === 'active') {
    f.hp = 0; f.state = 'silenced'; f.capture = null;
    for (let k = 0; k < 8; k++) spawn('smoke', f.x + rand(-14, 14), f.y + rand(-14, 14), rand(-12, 12), rand(-12, 12), rand(1.4, 2.2), rand(8, 12), 20, rand(10, 20));
    sfx.boom(1.1, 0.7, f.x, f.y);
    if (f.team === 'enemy') showBanner(`${f.name} is silenced!`, 'Stop a ship beside it and land troops');
    else showBanner(`${f.name} is silenced`, 'Land troops again to retake it');
  }
}

// ---------- Sea mines ----------
export function dropMine(s) {
  if (!afloat(s) || (s.team === 'player' && s.mines <= 0)) return;
  if (s.team === 'player') s.mines--;
  const x = s.x - Math.cos(s.h) * s.L * 0.62, y = s.y - Math.sin(s.h) * s.L * 0.62;
  if (S.G.mines.length >= 60) S.G.mines.shift(); // the oldest mine drifts off (and the render pool tops out at 64)
  S.G.mines.push({ x, y, team: s.team, arm: 1.2, bob: rand(0, 6) });
  spawn('splash', x, y, 0, 0, 0.5, 6);
  sfx.splash(x, y, 0.6);
}

export function updateMines(dt) {
  const G = S.G;
  for (let i = G.mines.length - 1; i >= 0; i--) {
    const m = G.mines[i];
    if (m.arm > 0) { m.arm -= dt; continue; }
    for (const s of G.ships) {
      if (s.team === m.team || !afloat(s)) continue;
      if (Math.hypot(s.x - m.x, s.y - m.y) < s.L * 0.42 + 8) {
        explodeMine(m, s);
        G.mines.splice(i, 1);
        break;
      }
    }
  }
}

function explodeMine(m, s) {
  const dmg = m.team === 'player' ? MINE_DMG : MINE_DMG * 0.8 * S.G.ai.dmgMul;
  hitShip(s, { dmg, team: m.team, x: m.x, y: m.y, mine: true });
  spawn('splash', m.x, m.y, 0, 0, 1.0, 26);
  spawn('flash', m.x, m.y, 0, 0, 0.25, 18, 6, 0);
  for (let k = 0; k < 14; k++) spawn('drop', m.x, m.y, rand(-40, 40), rand(-40, 40), rand(0.6, 1.0), rand(2, 4), 1, rand(80, 140));
  for (let k = 0; k < 5; k++) spawn('smoke', m.x + rand(-8, 8), m.y + rand(-8, 8), rand(-10, 10), rand(-10, 10), rand(1.2, 1.8), rand(8, 12), 6, rand(10, 20));
  sfx.mine(m.x, m.y);
  if (!reduceMotion) S.shake = Math.max(S.shake, 7);
}
