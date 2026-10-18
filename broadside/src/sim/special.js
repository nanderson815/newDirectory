import { S, afloat, showBanner, showToast } from '../state.js';
import { FIRESHIP } from '../config/ships.js';
import { PI, TAU, clamp, lerp, rand, reduceMotion } from '../util.js';
import { makeShip, nextId, placer, inExit } from './battle.js';
import { hitShip, hitFort, sinkShip } from './combat.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';

// The expansion's special rules: fireships, mortars, treasure, escorts and the exit, defended forts and fog.

const FORT_SIZE = 20;

function spawnShip(def, team, x, y, h) {
  const G = S.G;
  const s = makeShip({ ...def, faction: team === 'enemy' ? G.faction : null }, team, placer(G), G.land ? PI / 2 : 0, nextId(G), G.ai);
  if (x != null) { s.x = x; s.y = y; s.h = h; }
  G.ships.push(s);
  if (S.hooks.onSpawn) S.hooks.onSpawn(s);
  return s;
}

// ---------- Fireships ----------
// A fireship steers for the nearest enemy and blows up alongside. Sinking her early still sets off a smaller blast.
export function fireshipTarget(s) {
  let best = null, bd = Infinity;
  for (const o of S.G.ships) {
    if (o.team === s.team || !afloat(o)) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export function updateFireship(s) {
  const t = fireshipTarget(s);
  if (!t) return;
  if (Math.hypot(t.x - s.x, t.y - s.y) < (s.L + t.L) * 0.42) {
    const dmg = FIRESHIP.dmg * (s.team === 'enemy' ? S.G.ai.dmgMul : 1);
    hitShip(t, { dmg, team: s.team, x: (s.x + t.x) / 2, y: (s.y + t.y) / 2, fire: true });
    t.slowT = Math.max(t.slowT, 2);
    sinkShip(s); // she goes down and bursts
  }
}

// The blast when a fireship goes down: scorches everything close by, friend or foe.
export function fireshipBurst(s) {
  const G = S.G;
  for (const o of G.ships) {
    if (o === s || !afloat(o)) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < FIRESHIP.splashRadius + o.L * 0.3) {
      const dmg = Math.round(FIRESHIP.splash * (1 - 0.5 * d / FIRESHIP.splashRadius));
      if (dmg > 0) hitShip(o, { dmg, team: s.team === o.team ? 'none' : s.team, x: o.x, y: o.y, fire: true });
    }
  }
  spawn('flash', s.x, s.y, 0, 0, 0.35, 34, 8, 0);
  for (let k = 0; k < 16; k++) spawn('fire', s.x + rand(-18, 18), s.y + rand(-18, 18), rand(-30, 30), rand(-30, 30), rand(0.5, 1.0), rand(5, 9), 8, rand(20, 50));
  for (let k = 0; k < 8; k++) spawn('soot', s.x + rand(-14, 14), s.y + rand(-14, 14), rand(-14, 14), rand(-14, 14), rand(1.6, 2.6), rand(8, 13), 14, rand(14, 24));
  sfx.boom(1.3, 0.8, s.x, s.y);
  if (!reduceMotion) S.shake = Math.max(S.shake, 9);
}

// A boss with fireEvery launches a fireship from her side every so often, up to three at a time.
export function updateFireLauncher(s, dt) {
  const G = S.G;
  s.fireT -= dt;
  if (s.fireT > 0) return;
  s.fireT = s.fireEvery;
  const live = G.ships.filter((o) => o.fireship && afloat(o) && o.team === s.team).length;
  if (live >= 3 || !G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < 520)) return;
  const side = Math.random() < 0.5 ? -1 : 1, a = s.h + side * PI / 2;
  const x = clamp(s.x + Math.cos(a) * s.B * 2.2, 40, G.W - 40), y = clamp(s.y + Math.sin(a) * s.B * 2.2, 40, G.H - 40);
  spawnShip({ type: 'fireship', name: 'Fireship', x: 0, y: 0, h: 0 }, s.team, x, y, s.h);
  showBanner('Fireship!', 'Sink her before she reaches you', 1.8);
}

// ---------- Mortars ----------
// A mortar lobs a shell high over islands onto a spot; a red ring shows where it will land.
const SHELL_SPEED = 240;

export function updateMortar(s, dt) {
  const G = S.G, M = s.mortar;
  s.mortarT -= dt;
  if (s.mortarT > 0) return;
  let best = null, bd = Infinity;
  for (const o of G.ships) {
    if (o.team === s.team || !afloat(o) || (o.hidden && s.team === 'player')) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d > 110 && d < M.range && d < bd) { bd = d; best = o; }
  }
  for (const f of G.forts) {
    if (f.team === s.team || f.state !== 'active') continue;
    const d = Math.hypot(f.x - s.x, f.y - s.y) * 0.8; // a fort is the juicier target
    if (d > 110 && d < M.range && d < bd) { bd = d; best = f; }
  }
  if (!best) { s.mortarT = 0.6; return; }
  s.mortarT = M.reload * (s.team === 'enemy' ? G.ai.reloadMul : 1) * rand(0.92, 1.08);
  const d = Math.hypot(best.x - s.x, best.y - s.y), T = 0.9 + d / SHELL_SPEED;
  // Lead a moving ship a little, and scatter by the gun crew's skill.
  const lead = best.kind === 'fort' ? 0 : best.v * T * 0.7, h = best.kind === 'fort' ? 0 : best.h;
  const sc = d * (s.team === 'enemy' ? G.ai.spread : 0.08) * 0.8, sa = rand(0, TAU), sr = rand(0, sc);
  const tx = clamp(best.x + Math.cos(h) * lead + Math.cos(sa) * sr, 10, G.W - 10);
  const ty = clamp(best.y + Math.sin(h) * lead + Math.sin(sa) * sr, 10, G.H - 10);
  const dmg = M.dmg * (s.team === 'enemy' ? G.ai.dmgMul : 1);
  S.balls.push({
    kind: 'shell', team: s.team, sx: s.x, sy: s.y, x: s.x, y: s.y, tx, ty, u: 0, T, h: 10, apex: 90 + d * 0.25,
    dmg, radius: M.radius, travel: 0, max: d, z0: 10, vx: 0, vy: 0, skip: -1,
  });
  spawn('flash', s.x, s.y, 0, 0, 0.2, 12, 12, 0);
  for (let k = 0; k < 5; k++) spawn('smoke', s.x + rand(-5, 5), s.y + rand(-5, 5), rand(-10, 10), rand(-10, 10), rand(1.4, 2.0), rand(7, 10), 14, rand(18, 30));
  sfx.boom(0.7, 1.3, s.x, s.y);
}

// Moves a shell along its arc; returns true once it has landed.
export function updateShell(b, dt) {
  b.u += dt / b.T;
  const u = Math.min(1, b.u);
  b.x = lerp(b.sx, b.tx, u); b.y = lerp(b.sy, b.ty, u);
  b.h = lerp(10, 2, u) + 4 * b.apex * u * (1 - u);
  b.travel = b.max * u;
  if (Math.random() < dt * 14) spawn('soot', b.x, b.y, 0, 0, 0.6, 2.5, b.h, 0);
  if (u < 1) return false;
  shellBurst(b);
  return true;
}

function shellBurst(b) {
  const G = S.G;
  for (const o of G.ships) {
    if (o.team === b.team || !afloat(o)) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < b.radius + o.L * 0.3) hitShip(o, { dmg: Math.round(b.dmg * (1 - 0.5 * clamp(d / b.radius, 0, 1))), team: b.team, x: o.x, y: o.y, shell: true });
  }
  for (const f of G.forts) {
    if (f.team === b.team || f.state !== 'active') continue;
    if (Math.hypot(f.x - b.x, f.y - b.y) < b.radius + FORT_SIZE) hitFort(f, { dmg: b.dmg, team: b.team });
  }
  const onLand = G.islands.some((is) => Math.hypot(b.x - is.x, b.y - is.y) < is.r);
  spawn('flash', b.x, b.y, 0, 0, 0.25, 22, 4, 0);
  if (onLand) for (let k = 0; k < 10; k++) spawn('sand', b.x, b.y, rand(-60, 60), rand(-60, 60), rand(0.5, 0.9), rand(2, 4), 8, rand(30, 70));
  else {
    spawn('splash', b.x, b.y, 0, 0, 0.9, 20);
    for (let k = 0; k < 12; k++) spawn('drop', b.x, b.y, rand(-40, 40), rand(-40, 40), rand(0.6, 1.0), rand(2, 4), 1, rand(80, 140));
  }
  for (let k = 0; k < 4; k++) spawn('smoke', b.x + rand(-8, 8), b.y + rand(-8, 8), rand(-10, 10), rand(-10, 10), rand(1.0, 1.6), rand(7, 11), 6, rand(10, 18));
  sfx.boom(0.9, 1.0, b.x, b.y);
}

// ---------- Treasure ----------
export function updateChests() {
  const G = S.G;
  for (const c of G.chests) {
    if (c.taken) continue;
    for (const s of G.ships) {
      if (!afloat(s) || s.escort || Math.hypot(s.x - c.x, s.y - c.y) > s.L * 0.5 + 14) continue;
      c.taken = true; c.by = s.team;
      for (let k = 0; k < 10; k++) spawn('flash', c.x + rand(-8, 8), c.y + rand(-8, 8), 0, 0, rand(0.2, 0.4), rand(3, 6), rand(4, 12), 0);
      if (s.team === 'player') { G.got++; showToast(`Treasure! ${G.got}/${G.need}`, s, 1.6); sfx.coin(); }
      else { showToast('Pirates took a chest', s, 1.6); sfx.splash(c.x, c.y, 0.5); }
      break;
    }
  }
}
export const chestsLeft = (G) => G.chests.filter((c) => !c.taken).length;

// ---------- Escorts and the exit ----------
export function checkExit(s) {
  const G = S.G;
  if (!(s.escort || s.flag) || s.team !== 'player' || !inExit(G, s)) return false;
  s.state = 'escaped'; s.path = []; s.pivot = null;
  if (s.escort) { G.escaped++; showBanner(`${s.name} is through!`, `${G.escaped}/${G.need} merchantmen safe`, 2); }
  else showBanner(`${s.name} breaks through!`, 'The blockade is run', 2.4);
  sfx.fanfare(false);
  if (S.selected === s) S.selected = G.ships.find((o) => o.team === 'player' && afloat(o) && !o.escort) || null;
  return true;
}

// ---------- Defending forts ----------
// Reinforcement waves arrive on schedule; the defended forts must hold until the timer runs out.
export const GRACE = 18; // seconds you have to retake a silenced fort before the position is lost

export function updateDefend(dt) {
  const G = S.G;
  if (G.goal !== 'defend') return;
  G.holdT += dt;
  for (const w of G.waveDefs) {
    if (w.sent || G.holdT < w.at) continue;
    w.sent = true;
    const place = placer(G);
    for (const d of w.enemy) {
      const [x, y] = place(d.x, d.y);
      spawnShip(d, 'enemy', x, y, d.h * PI / 180 + (G.land ? PI / 2 : 0));
    }
    showBanner('Enemy reinforcements!', `${w.enemy.length} more sail on the horizon`, 2.2);
    sfx.fanfare(false);
  }
  const held = G.forts.some((f) => f.team === 'player' && f.state === 'active');
  if (held) G.downT = 0;
  else {
    if (G.downT === 0) showBanner('The fort is silenced!', `Land troops to retake it within ${GRACE}s`, 2.4);
    G.downT += dt;
  }
}

// ---------- Fog ----------
// Enemy ships beyond every lookout's sight are hidden: not drawn, not shown on the HUD and not targeted.
export function updateFog() {
  const G = S.G;
  if (!G.fog) return;
  const eyes = [];
  for (const s of G.ships) if (s.team === 'player' && afloat(s)) eyes.push(s);
  for (const f of G.forts) if (f.team === 'player' && f.state === 'active') eyes.push(f);
  for (const s of G.ships) {
    if (s.team === 'player') { s.hidden = false; continue; }
    s.hidden = !eyes.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < G.fog);
  }
}
