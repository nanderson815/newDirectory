import { rand } from '../util.js';
import { A, play, glide } from './engine.js';
import { sample } from './samples.js';

// The sea: a looping noise bed whose filters and levels breathe on slow LFOs, with occasional waves
// washing past, gulls over the calm screens and the hull creaking in battle.
let sea = null, washT = 1, gullT = 2.5, creakT = 2;
const take = (n) => Math.floor(Math.random() * n);

function startSea() {
  const ac = A.ac, t = ac.currentTime;
  sea = ac.createGain();
  sea.gain.value = 0;
  sea.connect(A.amb);
  const lfo = (f, depth, param) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f; g.gain.value = depth;
    o.connect(g); g.connect(param); o.start(t);
  };
  // Two layers on unrelated LFO periods, so the swell never settles into an obvious loop.
  const bed = (type, cut, level, swell, rate, period) => {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = sample('sea'); src.loop = true; src.playbackRate.value = rate;
    f.type = type; f.frequency.value = cut; f.Q.value = 0.6; g.gain.value = level;
    src.connect(f); f.connect(g); g.connect(sea);
    lfo(1 / period, cut * 0.45, f.frequency);
    lfo(1 / (period * 1.37), level * swell, g.gain);
    src.start(t, rand(0, 3));
  };
  bed('lowpass', 520, 1, 0.5, 1, 14);       // the low wash
  bed('bandpass', 2200, 0.4, 0.8, 0.83, 21); // foam hiss
}

export function ambienceTick(dt, battle) {
  if (!sea) startSea();
  glide(sea.gain, battle ? 0.35 : 0.6, 1.5);
  if ((washT -= dt) <= 0) {
    washT = rand(3.5, 8);
    play(sample('wash', take(3)), { gain: rand(0.25, 0.45) * (battle ? 0.6 : 1), pan: rand(-0.6, 0.6), rate: rand(0.85, 1.15), dest: A.amb });
  }
  if (!battle && (gullT -= dt) <= 0) {
    gullT = rand(6, 16);
    play(sample('gull', take(3)), { gain: rand(0.06, 0.15), pan: rand(-0.8, 0.8), rate: rand(0.9, 1.12), cut: rand(3500, 7000), dest: A.amb, verb: 0.3 });
  }
  if (battle && (creakT -= dt) <= 0) {
    creakT = rand(2.5, 7);
    play(sample('creak', take(3)), { gain: rand(0.1, 0.22), pan: rand(-0.5, 0.5), rate: rand(0.8, 1.25), dest: A.amb });
  }
}
