import { S, afloat } from '../state.js';
import { clamp } from '../util.js';
import { A, glide, power } from './engine.js';
import { musicTick } from './music.js';
import { ambienceTick } from './ambience.js';

// Runs once a frame from the game loop: follows the toggles, reads how hot the battle is, and wakes
// the music scheduler and the ambience.
const MUSIC_LEVEL = 0.5, SFX_LEVEL = 0.6;
let I = 0, target = 0, readT = 0;

// 0 when the fleets are far apart and quiet, 1 when they're trading broadsides at close range.
function intensity(G) {
  let near = Infinity;
  for (const p of G.ships) {
    if (p.team !== 'player' || !afloat(p)) continue;
    for (const e of G.ships) if (e.team === 'enemy' && afloat(e)) near = Math.min(near, Math.hypot(e.x - p.x, e.y - p.y));
    for (const f of G.forts) if (f.team === 'enemy' && f.state === 'active') near = Math.min(near, Math.hypot(f.x - p.x, f.y - p.y) - 20);
  }
  const close = clamp((520 - near) / 320, 0, 1); // gun range is about 250
  const shots = clamp(S.balls.length / 12, 0, 1);
  return clamp(0.6 * close + 0.35 * shots + 0.4 * A.heat, 0, 1);
}

export function audioTick(dt) {
  if (!A.ac) return;
  power();
  if (A.ac.state !== 'running') return;
  dt = Math.min(0.1, Math.max(0, dt));
  const G = S.G, phase = G ? G.phase : 'title', fighting = phase === 'play' || phase === 'paused';
  glide(A.sfx.gain, S.muted ? 0 : SFX_LEVEL, 0.05);
  glide(A.amb.gain, S.muted ? 0 : 1, 0.3);
  glide(A.music.gain, S.musicMuted ? 0 : MUSIC_LEVEL * (phase === 'paused' ? 0.5 : 1), 0.3);
  if ((readT -= dt) <= 0) { readT = 0.2; target = phase === 'play' ? intensity(G) : 0; }
  // Rises quickly when the shooting starts, lingers a while after it stops.
  I += (target - I) * (1 - Math.exp(-dt / (target > I ? 0.8 : 3.5)));
  A.heat = Math.max(0, A.heat - dt * 0.3);
  musicTick(dt, I, !!G && G.endAt != null);
  if (!S.muted) ambienceTick(dt, fighting);
}
