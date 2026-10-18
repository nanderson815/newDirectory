import { S, afloat } from '../state.js';
import { CHASER_RELOAD } from '../config/ships.js';
import { PI, clamp, rand, angDiff } from '../util.js';
import { windFactor } from './wind.js';
import { followPath, avoidIslands, aiSteer, shoreClear } from './steering.js';
import { findBroadsideTarget, findChaseTarget, fireBroadside, fireChasers, dropMine } from './combat.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';

export function updateShip(s, dt) {
  const G = S.G;
  if (s.state === 'sinking') {
    s.sinkT += dt;
    s.v *= Math.pow(0.4, dt);
    s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt;
    s.fxT -= dt;
    if (s.fxT <= 0) {
      s.fxT = 0.08;
      spawn('bubble', s.x + rand(-s.L / 3, s.L / 3), s.y + rand(-s.B / 2, s.B / 2), rand(-5, 5), rand(-5, 5), rand(0.6, 1.1), rand(3, 6));
    }
    if (s.sinkT > 3.2) {
      s.state = 'sunk';
      sfx.sunk(s.x, s.y);
      for (let i = 0; i < 9; i++) spawn('plank', s.x + rand(-s.L / 3, s.L / 3), s.y + rand(-s.B / 2, s.B / 2), rand(-6, 6), rand(-6, 6), rand(30, 45), rand(6, 12));
    }
    return;
  }
  if (!afloat(s)) return;

  let desired = s.team === 'player' ? followPath(s) : aiSteer(s, dt);
  // Anchored: turn on the spot toward the chosen heading.
  if (s.pivot != null) desired = s.pivot;
  // Keep everyone on the map.
  const m = 55;
  if (s.pivot == null && !s.passive && (s.x < m || s.x > G.W - m || s.y < m || s.y > G.H - m)) {
    const toC = Math.atan2(G.H / 2 - s.y, G.W / 2 - s.x);
    if (desired == null || s.team === 'enemy') desired = toC;
  }
  // Ships with no orders still dodge islands rather than sailing onto the beach.
  if (desired == null && !s.passive) {
    const dodge = avoidIslands(s, s.h, 140);
    if (dodge !== s.h) desired = dodge;
  }
  if (desired != null) {
    const tr = s.pivot != null ? s.turn * 0.8 : s.turn * (0.55 + 0.45 * Math.min(1, s.v / s.speed));
    s.h += clamp(angDiff(s.h, desired), -tr * dt, tr * dt);
  }
  const hpF = 0.55 + 0.45 * s.hp / s.maxHp;
  const stopped = s.pivot != null || s.passive;
  const targetV = stopped ? 0 : s.speed * windFactor(s.h) * hpF;
  s.v += (targetV - s.v) * Math.min(1, dt * (stopped ? 1.6 : 0.8));
  s.x += Math.cos(s.h) * s.v * dt;
  s.y += Math.sin(s.h) * s.v * dt;
  s.x = clamp(s.x, 18, G.W - 18); s.y = clamp(s.y, 18, G.H - 18);

  // Brace the yards to the wind.
  const r = angDiff(s.h, G.wind.dir);
  s.yard += (clamp(r * 0.45, -0.75, 0.75) - s.yard) * Math.min(1, dt * 2);

  s.reload[0] -= dt; s.reload[1] -= dt;
  s.flash = Math.max(0, s.flash - dt);
  if (!s.passive) {
    if (s.team === 'enemy' || S.fireMode === 'auto') {
      for (let side = 0; side < 2; side++) {
        if (s.reload[side] > 0) continue;
        const tgt = findBroadsideTarget(s, side);
        if (tgt) fireBroadside(s, side, tgt);
      }
    }
    // Bow chasers always fire on their own.
    if (s.chasers) {
      s.chaseT -= dt;
      if (s.chaseT <= 0) {
        const tgt = findChaseTarget(s);
        if (tgt) s.chaseT = CHASER_RELOAD * (s.team === 'enemy' ? G.ai.reloadMul : 1);
        if (tgt) fireChasers(s, tgt);
      }
    }
    // Mine-laying bosses drop one astern whenever an English ship is near.
    if (s.mineEvery) {
      s.mineT -= dt;
      if (s.mineT <= 0 && G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < 300)) {
        dropMine(s);
        s.mineT = s.mineEvery;
      }
    }
  }

  s.fxT -= dt;
  if (s.fxT <= 0) {
    s.fxT = 0.09;
    if (s.v > 12) {
      const bx = s.x - Math.cos(s.h) * s.L * 0.45, by = s.y - Math.sin(s.h) * s.L * 0.45;
      spawn('wake', bx, by, 0, 0, 1.6, s.B * 0.32);
    }
    if (s.hp / s.maxHp < 0.36) {
      const a = rand(-0.3, 0.3) * s.L;
      const fx = s.x + Math.cos(s.h) * a, fy = s.y + Math.sin(s.h) * a;
      spawn('fire', fx, fy, rand(-4, 4), rand(-4, 4), rand(0.3, 0.6), rand(3, 5), 10, 14);
      if (Math.random() < 0.5) spawn('soot', fx, fy, Math.cos(G.wind.dir) * 18, Math.sin(G.wind.dir) * 18, rand(1.4, 2.2), rand(4, 6), 14, 16);
    }
  }
}

export function collide(dt) {
  const G = S.G;
  const live = G.ships.filter(afloat);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const min = (a.L + b.L) * 0.34;
      if (d < min) {
        // Heavier ships shove lighter ones.
        const wa = b.L / (a.L + b.L), wb = 1 - wa;
        const push = min - d, nx = dx / d, ny = dy / d;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
        a.v *= 0.97; b.v *= 0.97;
      }
    }
    for (const is of G.islands) {
      const dx = a.x - is.x, dy = a.y - is.y, d = Math.hypot(dx, dy) || 0.01;
      const min = shoreClear(is, a);
      if (d < min) {
        a.x = is.x + (dx / d) * min; a.y = is.y + (dy / d) * min;
        // Slide along the shore: swing the bow onto the nearer tangent instead of grinding to a halt.
        const n = Math.atan2(dy, dx);
        if (Math.cos(a.h - n) < 0.2 && a.pivot == null) {
          const t1 = n + PI / 2, t2 = n - PI / 2;
          const t = Math.abs(angDiff(a.h, t1)) < Math.abs(angDiff(a.h, t2)) ? t1 : t2;
          a.h += clamp(angDiff(a.h, t), -3 * dt, 3 * dt);
        }
        a.v *= Math.pow(0.6, dt);
      }
    }
  }
}
