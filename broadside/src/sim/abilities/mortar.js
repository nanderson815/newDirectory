import { S, afloat } from '../../state.js';
import { TAU, clamp, lerp, rand } from '../../util.js';
import { hitShip, hitFort } from '../combat.js';
import { spawn } from '../particles.js';
import { sfx } from '../../audio/sfx.js';

// A mortar lobs a shell high over islands onto a spot `range` away at most, every `reload` seconds; it bursts
// for up to `dmg` across `radius`. The HUD rings where each shell will land. AI mortar ships (bosses aside)
// stand off at long range.
const SHELL_SPEED = 240;
const FORT_SIZE = 20;
const MIN_RANGE = 110;

export default {
  id: 'mortar',
  defaults: { range: 430, reload: 6.5, dmg: 22, radius: 36 },
  init(s, a) { a.t = rand(2, 4); if (!s.boss) s.standoff = a.range * 0.75; },
  update(s, a, dt) {
    const G = S.G;
    a.t -= dt;
    if (a.t > 0) return;
    let best = null, bd = Infinity;
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o) || (o.hidden && s.team === 'player')) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d > MIN_RANGE && d < a.range && d < bd) { bd = d; best = o; }
    }
    for (const f of G.forts) {
      if (f.team === s.team || f.state !== 'active') continue;
      const d = Math.hypot(f.x - s.x, f.y - s.y) * 0.8; // a fort is the juicier target
      if (d > MIN_RANGE && d < a.range && d < bd) { bd = d; best = f; }
    }
    if (!best) { a.t = 0.6; return; }
    a.t = a.reload * (s.team === 'enemy' ? G.ai.reloadMul : 1) * rand(0.92, 1.08);
    const d = Math.hypot(best.x - s.x, best.y - s.y), T = 0.9 + d / SHELL_SPEED;
    // Lead a moving ship a little, and scatter by the gun crew's skill.
    const lead = best.kind === 'fort' ? 0 : best.v * T * 0.7, h = best.kind === 'fort' ? 0 : best.h;
    const sc = d * (s.team === 'enemy' ? G.ai.spread : 0.08) * 0.8, sa = rand(0, TAU), sr = rand(0, sc);
    const tx = clamp(best.x + Math.cos(h) * lead + Math.cos(sa) * sr, 10, G.W - 10);
    const ty = clamp(best.y + Math.sin(h) * lead + Math.sin(sa) * sr, 10, G.H - 10);
    S.balls.push({
      kind: 'shell', team: s.team, sx: s.x, sy: s.y, x: s.x, y: s.y, tx, ty, u: 0, T, h: 10, apex: 90 + d * 0.25,
      dmg: a.dmg * (s.team === 'enemy' ? G.ai.dmgMul : 1), radius: a.radius, travel: 0, max: d, z0: 10, vx: 0, vy: 0, skip: -1,
    });
    spawn('flash', s.x, s.y, 0, 0, 0.2, 12, 12, 0);
    for (let k = 0; k < 5; k++) spawn('smoke', s.x + rand(-5, 5), s.y + rand(-5, 5), rand(-10, 10), rand(-10, 10), rand(1.4, 2.0), rand(7, 10), 14, rand(18, 30));
    sfx.boom(0.7, 1.3, s.x, s.y);
  },
};

// Moves a shell along its arc; returns true once it has landed (combat.js calls this for every shell).
export function updateShell(b, dt) {
  b.u += dt / b.T;
  const u = Math.min(1, b.u);
  b.x = lerp(b.sx, b.tx, u); b.y = lerp(b.sy, b.ty, u);
  b.h = lerp(10, 2, u) + 4 * b.apex * u * (1 - u);
  b.travel = b.max * u;
  if (Math.random() < dt * 14) spawn('soot', b.x, b.y, 0, 0, 0.6, 2.5, b.h, 0);
  if (u < 1) return false;
  burst(b);
  return true;
}

function burst(b) {
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
