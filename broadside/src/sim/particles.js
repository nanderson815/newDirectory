import { S } from '../state.js';
import { rand, TAU } from '../util.js';

// Particles are simulated in map space with z as height above the water.
const GRAVITY = { drop: 160, splinter: 140, sand: 140, stone: 150 };
const MAX = 900;
// Particle objects are recycled through a free list and removed by swap-pop, so a busy battle doesn't churn the GC.
const free = [];
let wrap = 0;

export function spawn(kind, x, y, vx, vy, life, size, z = 0, vz = 0) {
  const list = S.particles;
  let p;
  if (list.length > MAX) p = list[wrap++ % list.length]; // full: overwrite an old one
  else { p = free.pop() || {}; list.push(p); }
  p.kind = kind; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.life = life; p.max = life; p.size = size; p.rot = rand(0, TAU); p.spin = rand(-6, 6);
}

export function updateParticles(dt) {
  const list = S.particles, G = S.G;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      const last = list.pop();
      if (i < list.length) list[i] = last;
      free.push(p);
      continue;
    }
    const drag = p.kind === 'smoke' || p.kind === 'soot' ? 1.6 : p.kind === 'plank' ? 0.3 : 2.2;
    p.vx -= p.vx * Math.min(1, drag * dt); p.vy -= p.vy * Math.min(1, drag * dt);
    if (p.kind === 'plank' && G) { p.vx += Math.cos(G.wind.dir) * 2 * dt; p.vy += Math.sin(G.wind.dir) * 2 * dt; }
    const g = GRAVITY[p.kind];
    if (g) {
      p.vz -= g * dt;
      if (p.z <= 0.3 && p.vz < 0) {
        if (p.kind === 'drop') { p.life = 0; continue; }
        p.z = 0.3; p.vz = 0; p.vx *= 0.3; p.vy *= 0.3; p.spin = 0;
      }
    } else {
      p.vz -= p.vz * Math.min(1, dt * 1.2);
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.rot += p.spin * dt * (p.kind === 'plank' ? 0.05 : 1);
  }
}

export function clearParticles() {
  for (const p of S.particles) free.push(p);
  S.particles.length = 0;
}
