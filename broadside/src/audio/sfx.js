import { S } from '../state.js';
import { clamp, rand } from '../util.js';
import { R } from '../render/gl.js';
import { projTo, wx, wz, cam } from '../render/camera.js';
import { A, init, play, claim, duck, now, live } from './engine.js';
import { sample, warm } from './samples.js';
import { brass, tone } from './voices.js';

// Sound effects. Browsers only allow audio after a tap, so init() runs from a button.
const on = () => live() && !S.muted;
const take = (n) => Math.floor(Math.random() * n);
const heat = (v) => { A.heat = Math.min(1, A.heat + v); };

// Where a sound sits: pan from its x on screen; level and brightness fall off with distance from the
// camera (the far side of the tilted map is further away), and faster once it's off screen.
const spot = { pan: 0, gain: 1, cut: 20000 };
function where(x, y) {
  spot.pan = 0; spot.gain = 1; spot.cut = 20000;
  const G = S.G;
  if (x == null || !G) return spot;
  let nx, ny, ratio = 1;
  if (R.camera) {
    const p = projTo(x, y, 0);
    nx = (p.x / S.view.cw) * 2 - 1; ny = (p.y / S.view.ch) * 2 - 1;
    const c = R.camera.position;
    ratio = Math.hypot(c.x - wx(x), c.y, c.z - wz(y)) / (cam.d || 1); // relative to the point the camera looks at
  } else {
    nx = (x / G.W) * 2 - 1; ny = (y / G.H) * 2 - 1;
  }
  if (!Number.isFinite(nx + ny + ratio) || ratio <= 0) return spot;
  const off = Math.max(0, Math.abs(nx) - 1, Math.abs(ny) - 1);
  spot.pan = clamp(nx * 0.8, -0.85, 0.85);
  spot.gain = clamp(Math.pow(ratio, -1.5), 0.45, 1.4) / (1 + off * 4);
  spot.cut = clamp((18000 * Math.pow(ratio, -4)) / (1 + off * 6), 900, 20000);
  return spot;
}

let warmed = false;
const WARM = [['sea', 0], ['bass', 0], ['pizz', 0], ['hi', 0], ['drumLo', 0], ['drumHi', 0], ['gun', 0], ['gun', 1], ['splash', 0], ['wood', 0],
  ['gun', 2], ['gun', 3], ['splash', 1], ['splash', 2], ['wood', 1], ['wood', 2], ['wood', 3], ['stomp', 0], ['jingle', 0], ['fort', 0], ['fort', 1],
  ['stone', 0], ['stone', 1], ['wash', 0], ['gull', 0], ['creak', 0], ['timp', 0], ['mine', 0], ['sink', 0], ['gurgle', 0],
  ['wash', 1], ['wash', 2], ['gull', 1], ['gull', 2], ['creak', 1], ['creak', 2]];

export const sfx = {
  init() {
    init();
    if (A.ac && !warmed) { warmed = true; warm(WARM); }
  },
  // A ship's gun. Each shot gets its own take, pitch, level and a few ms of slop, so a broadside ripples.
  gun(x, y, vol = 0.8, pitch = 1) {
    if (!on() || !claim('gun', 10, 0.45)) return;
    const p = where(x, y);
    play(sample('gun', take(4)), {
      at: now() + rand(0, 0.02), rate: pitch * rand(0.9, 1.1), gain: vol * p.gain * rand(0.8, 1), pan: p.pan,
      cut: Math.min(p.cut, rand(6000, 16000)), verb: 0.15,
    });
    heat(0.02);
  },
  // Fort guns: heavier, and their report comes back off the stone.
  fortGun(x, y, vol = 0.8) {
    if (!on() || !claim('fort', 4, 0.9)) return;
    const p = where(x, y);
    play(sample('fort', take(2)), { at: now() + rand(0, 0.015), rate: rand(0.92, 1.05), gain: vol * p.gain, pan: p.pan, cut: p.cut, verb: 0.2, echo: 0.45 });
  },
  // A heavy blast (a fort knocked silent).
  boom(vol = 1, pitch = 1, x, y) {
    if (!on() || !claim('big', 4, 1)) return;
    const p = where(x, y);
    play(sample('fort', take(2)), { rate: pitch * rand(0.95, 1.05), gain: vol * 0.8 * p.gain, pan: p.pan, cut: p.cut, verb: 0.25 });
    duck(0.25, 0.4);
  },
  splash(x, y, vol = 1) {
    if (!on() || !claim('splash', 6, 0.35)) return;
    const p = where(x, y);
    play(sample('splash', take(3)), { rate: rand(0.85, 1.25), gain: 0.35 * vol * p.gain, pan: p.pan, cut: p.cut });
  },
  woodHit(x, y) {
    if (!on() || !claim('hit', 8, 0.3)) return;
    const p = where(x, y);
    play(sample('wood', take(4)), { at: now() + rand(0, 0.01), rate: rand(0.85, 1.2), gain: 0.7 * p.gain, pan: p.pan, cut: p.cut, verb: 0.1 });
    heat(0.12);
  },
  stoneHit(x, y) {
    if (!on() || !claim('hit', 8, 0.3)) return;
    const p = where(x, y);
    play(sample('stone', take(2)), { rate: rand(0.85, 1.15), gain: 0.65 * p.gain, pan: p.pan, cut: p.cut, verb: 0.15 });
    heat(0.08);
  },
  mine(x, y) {
    if (!on() || !claim('big', 4, 2)) return;
    const p = where(x, y);
    play(sample('mine'), { rate: rand(0.92, 1.05), gain: p.gain, pan: p.pan, verb: 0.3 });
    duck(0.45, 0.8);
    heat(0.4);
  },
  // A ship going down; bigger hulls go down lower.
  sink(x, y, size = 80) {
    if (!on()) return;
    const p = where(x, y);
    play(sample('sink'), { rate: clamp(80 / size, 0.8, 1.2) * rand(0.95, 1.05), gain: 0.9 * p.gain, pan: p.pan, cut: p.cut, verb: 0.3 });
    duck(0.35, 1.2);
    heat(0.3);
  },
  // The hull slips under.
  sunk(x, y) {
    if (!on() || !claim('big', 4, 1.6)) return;
    const p = where(x, y);
    play(sample('gurgle'), { rate: rand(0.9, 1.1), gain: 0.5 * p.gain, pan: p.pan, cut: p.cut });
  },
  // A short brass stab and a kettle drum when a boss captain is beaten.
  bossDown() {
    if (!on()) return;
    const t = now() + 0.02;
    for (const m of [50, 57, 62, 66, 74]) brass(m, t, 0.32, 0.11, A.sfx, 1.3);
    play(sample('timp'), { at: t, verb: 0.3 });
    duck(0.6, 1.4);
  },
  // A rising flourish for tutorial steps (small) and big moments.
  fanfare(big) {
    if (!on()) return;
    const t = now() + 0.02, notes = big ? [67, 71, 74, 79] : [72, 76];
    notes.forEach((m, i) => brass(m, t + i * 0.11, i === notes.length - 1 ? 0.4 : 0.12, 0.08, A.sfx, 1.1));
  },
  // A fort taken: the fanfare over a kettle-drum roll.
  capture() {
    if (!on()) return;
    const t = now();
    for (let i = 0; i < 5; i++) play(sample('timp'), { at: t + i * 0.06, gain: 0.2 + i * 0.12 });
    sfx.fanfare(true);
  },
  coin() {
    if (!on()) return;
    const t = now();
    tone(988, t, 0.12, 0.1, 'square', A.sfx);
    tone(1319, t + 0.07, 0.2, 0.08, 'square', A.sfx);
  },
};
