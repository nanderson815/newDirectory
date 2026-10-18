import { S } from '../state.js';
import { rand } from '../util.js';

// Synthesised sound effects. Browsers only allow audio after a tap, so init() runs from a button.
let ac = null, master = null, noise = null, last = 0;

function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.45;
    master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}

function burst(type, freq, dur, vol, q) {
  const now = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(now, rand(0, 0.5)); src.stop(now + dur + 0.05);
}

function tone(freq, dur, vol, type = 'triangle', at = 0) {
  const now = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + dur + 0.05);
}

const on = () => ac && !S.muted;

export const sfx = {
  init,
  boom(vol = 1, pitch = 1) {
    if (!on()) return;
    const now = ac.currentTime; if (now - last < 0.035) return; last = now;
    burst('lowpass', 520 * pitch, 0.7, 0.9 * vol);
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(90 * pitch, now); o.frequency.exponentialRampToValueAtTime(35, now + 0.25);
    g.gain.setValueAtTime(0.6 * vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    o.connect(g); g.connect(master); o.start(now); o.stop(now + 0.32);
  },
  splash() { if (on()) burst('bandpass', 1400, 0.28, 0.12, 0.8); },
  crack() { if (on()) burst('bandpass', 2400, 0.12, 0.35, 1.5); },
  // A short rising fanfare for captures, boss kills and tutorial steps.
  fanfare(big) {
    if (!on()) return;
    const notes = big ? [392, 494, 587, 784] : [523, 659];
    notes.forEach((f, i) => tone(f, 0.28, 0.18, 'triangle', i * 0.11));
  },
  coin() { if (on()) { tone(988, 0.12, 0.12, 'square'); tone(1319, 0.2, 0.1, 'square', 0.07); } },
};
