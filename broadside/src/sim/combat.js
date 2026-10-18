import { S, afloat, alive, shipById, unitById, fortById, showBanner, addDamage } from '../state.js';
import { BALL_SPEED, BALL_DMG, MINE_DMG, FORT } from '../config/ships.js';
import { AMMO } from '../config/ammo.js';
import { PI, clamp, lerp, rand, angDiff, reduceMotion } from '../util.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';
import { fireshipBurst, updateShell } from './special.js';

const BROADSIDE_ARC = 0.62;  // half-angle of each side's firing arc
const CHASER_ARC = 0.32;     // half-angle of the bow chasers' arc
const FORT_SIZE = 20;        // a fort counts as in range once its walls are

export const sideDir = (s, side) => s.h + (side === 0 ? -PI / 2 : PI / 2); // 0 = port, 1 = starboard

// Everything an enemy of `team` could shoot at: ships afloat and forts with working guns.
// In fog the English can't aim at what their lookouts can't see.
function* targets(team) {
  for (const e of S.G.ships) if (e.team !== team && afloat(e) && !(e.hidden && team === 'player')) yield e;
  for (const f of S.G.forts) if (f.team !== team && f.state === 'active') yield f;
}

function nearestInArc(s, dir, arc, range) {
  let best = null, bd = Infinity;
  for (const e of targets(s.team)) {
    const d = Math.hypot(e.x - s.x, e.y - s.y) - (e.kind === 'fort' ? FORT_SIZE : 0);
    if (d > range || d >= bd) continue;
    if (Math.abs(angDiff(dir, Math.atan2(e.y - s.y, e.x - s.x))) < arc) { best = e; bd = d; }
  }
  return best;
}
export const gunRange = (s) => s.range * AMMO[s.ammo || 'round'].range;
export const findBroadsideTarget = (s, side) => nearestInArc(s, sideDir(s, side), BROADSIDE_ARC, gunRange(s));
export const findChaseTarget = (s) => nearestInArc(s, s.h, CHASER_ARC, s.range * 0.85);

// Where to aim at a moving target so the ball arrives where it will be.
function leadPoint(t, gx, gy) {
  const v = t.kind === 'fort' ? 0 : t.v, h = t.kind === 'fort' ? 0 : t.h;
  const lead = Math.hypot(t.x - gx, t.y - gy) / BALL_SPEED;
  return [t.x + Math.cos(h) * v * lead, t.y + Math.sin(h) * v * lead];
}

function launch(team, gx, gy, ang, dist, dmg, z0, skip, kind = 'round') {
  S.balls.push({ x: gx, y: gy, vx: Math.cos(ang) * BALL_SPEED, vy: Math.sin(ang) * BALL_SPEED, travel: 0, max: dist, team, dmg, z0, skip, kind });
}

function muzzle(x, y, dir, z) {
  spawn('flash', x + Math.cos(dir) * 5, y + Math.sin(dir) * 5, 0, 0, 0.14, 6, z, 0);
  const w = S.G.wind.dir;
  for (let k = 0; k < 3; k++) {
    spawn('smoke', x + Math.cos(dir) * 8, y + Math.sin(dir) * 8,
      Math.cos(dir) * rand(20, 45) + Math.cos(w) * 12, Math.sin(dir) * rand(20, 45) + Math.sin(w) * 12,
      rand(1.2, 2.0), rand(5, 8), z + 1, rand(6, 14));
  }
}

const enemyMul = (team, k) => (team === 'enemy' ? S.G.ai[k] : 1);

// Fires a rippling broadside. With no target (manual fire) the shot goes out to full range abeam.
// Crews cut down by grapeshot reload more slowly.
export const crewMul = (s) => 1 + Math.min(0.5, 0.06 * s.crewHit);

export function fireBroadside(s, side, tgt) {
  if (s.guns <= 0) return;
  s.reload[side] = s.reloadTime * enemyMul(s.team, 'reloadMul') * crewMul(s) * rand(0.95, 1.05);
  for (let i = 0; i < s.guns; i++) {
    S.pending.push({ t: i * 0.075 + rand(0, 0.04), shipId: s.id, side, gi: i, targetId: tgt ? tgt.id : null, ammo: s.ammo });
  }
  if (s.team === 'player') S.G.stats.shots += s.guns * (AMMO[s.ammo].pellets || 1);
  if (s.team === 'player' && s === S.selected && !reduceMotion) S.kick = Math.max(S.kick, 1);
}

export function fireQueued(p) {
  if (p.fortId != null) fireFortGun(p); else fireGun(p);
}

function fireGun(p) {
  const s = shipById(p.shipId);
  if (!s || !afloat(s)) return;
  const sgn = p.side === 0 ? -1 : 1;
  const along = s.guns === 1 ? 0 : lerp(-s.L * 0.28, s.L * 0.28, p.gi / (s.guns - 1));
  const c = Math.cos(s.h), sn = Math.sin(s.h);
  const oy = sgn * s.B * 0.55;
  const gx = s.x + c * along - sn * oy, gy = s.y + sn * along + c * oy;
  const dir = sideDir(s, p.side);
  const t = p.targetId != null ? unitById(p.targetId) : null;
  const kind = p.ammo || 'round', A = AMMO[kind], range = s.range * A.range;
  let ang = dir, dist = range * 0.95;
  if (t && alive(t)) {
    const [ax, ay] = leadPoint(t, gx, gy);
    // Guns only traverse a little; clamp the aim to the broadside arc.
    ang = dir + clamp(angDiff(dir, Math.atan2(ay - gy, ax - gx)), -0.7, 0.7);
    dist = Math.hypot(ax - gx, ay - gy);
  }
  const spread = s.team === 'enemy' ? S.G.ai.spread : 0.07;
  const dmg = BALL_DMG * enemyMul(s.team, 'dmgMul') * A.hull;
  // Grapeshot leaves the muzzle as a spray of pellets; everything else is one ball.
  for (let k = 0; k < (A.pellets || 1); k++) {
    const a = ang + rand(-spread, spread) * (A.pellets ? 2.5 : 1);
    launch(s.team, gx, gy, a, clamp(dist * rand(0.9, 1.12), 40, range * 1.1), dmg, 6, -1, kind);
  }
  muzzle(gx, gy, dir, 6);
  // A little recoil.
  s.x -= Math.cos(dir) * 0.6; s.y -= Math.sin(dir) * 0.6;
  sfx.gun(gx, gy, s.team === 'player' ? 0.9 : 0.6);
}

// Bow chasers: one or two long guns in the bow that hit whatever sits dead ahead.
export function fireChasers(s, t) {
  const c = Math.cos(s.h), sn = Math.sin(s.h);
  for (let i = 0; i < s.chasers; i++) {
    const off = s.chasers === 1 ? 0 : (i ? 1 : -1) * s.B * 0.18;
    const gx = s.x + c * s.L * 0.5 - sn * off, gy = s.y + sn * s.L * 0.5 + c * off;
    const [ax, ay] = leadPoint(t, gx, gy);
    const spread = s.team === 'enemy' ? S.G.ai.spread : 0.06;
    const ang = s.h + clamp(angDiff(s.h, Math.atan2(ay - gy, ax - gx)), -0.35, 0.35) + rand(-spread, spread);
    const dist = clamp(Math.hypot(ax - gx, ay - gy) * rand(0.94, 1.08), 40, s.range);
    launch(s.team, gx, gy, ang, dist, BALL_DMG * enemyMul(s.team, 'dmgMul'), 7, -1);
    muzzle(gx, gy, s.h, 7);
  }
  if (s.team === 'player') S.G.stats.shots += s.chasers;
  sfx.gun(s.x, s.y, 0.55, 1.2);
}

// A fort's tower gun, fired from high up so its shot clears its own island.
function fireFortGun(p) {
  const f = fortById(p.fortId);
  if (!f || f.state !== 'active') return;
  const t = shipById(p.targetId);
  if (!t || !afloat(t)) return;
  const gx = f.x + Math.cos(f.aim) * 12, gy = f.y + Math.sin(f.aim) * 12;
  const [ax, ay] = leadPoint(t, gx, gy);
  const spread = f.team === 'enemy' ? S.G.ai.spread : 0.08;
  const ang = Math.atan2(ay - gy, ax - gx) + rand(-spread, spread);
  const dist = clamp(Math.hypot(ax - gx, ay - gy) * rand(0.92, 1.08), 40, f.range * 1.1);
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
        if (Math.hypot(b.x - is.x, b.y - is.y) >= is.r * 0.95) continue;
        // Shot that lands on a fort's island hits the fort if it's the enemy's and still firing.
        const f = is.fort ? G.forts.find((q) => q.island === ii) : null;
        if (f && f.team !== b.team && f.state === 'active') hitFort(f, b);
        else for (let k = 0; k < 6; k++) spawn('sand', b.x, b.y, rand(-40, 40), rand(-40, 40), rand(0.4, 0.7), rand(1.5, 3), 8, rand(20, 50));
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
  e.hp -= b.dmg; e.flash = 0.14;
  addDamage(e, b.dmg);
  if (b.kind === 'chain') e.slowT = Math.max(e.slowT, AMMO.chain.slow);
  // Each pellet that lands has a fair chance of cutting down a man; a full grape broadside from a frigate kills three or four.
  if (b.kind === 'grape') { if (Math.random() < 0.25) e.marines = Math.max(0, e.marines - 1); e.crewHit = Math.min(8, e.crewHit + 0.15); }
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
  if (e.fireship) fireshipBurst(e);
  if (S.selected === e) S.selected = G.ships.find((s) => s.team === 'player' && afloat(s) && !s.escort) || null;
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
