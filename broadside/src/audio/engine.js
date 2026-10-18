import { S } from '../state.js';
import { room } from './samples.js';

// The shared WebAudio graph. Every bus ends in one compressor so big moments don't clip:
//   sfx ───────────┐
//   amb ───────────┼─> compressor -> out
//   music -> duck ─┘
// plus a short reverb (music, a little sfx) and a stone-wall echo (fort guns).
export const A = { ac: null, sfx: null, amb: null, music: null, duck: null, verb: null, echo: null, heat: 0, waking: false, tried: -1e9 };

const gain = (v, to) => { const g = A.ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };

export function init() {
  if (A.ac) { power(true); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ac = (A.ac = new AC());
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 10;
    comp.attack.value = 0.002; comp.release.value = 0.22;
    comp.connect(gain(0.9, ac.destination));
    A.sfx = gain(0, comp);
    A.amb = gain(0, comp);
    A.duck = gain(1, comp);
    A.music = gain(0, A.duck);
    const verb = ac.createConvolver();
    verb.buffer = room();
    verb.connect(gain(0.32, comp));
    A.verb = gain(1, verb);
    const delay = ac.createDelay(1), fb = gain(0.34), lp = ac.createBiquadFilter();
    delay.delayTime.value = 0.27; lp.type = 'lowpass'; lp.frequency.value = 1500;
    A.echo = gain(1, delay);
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(gain(0.5, comp));
    document.addEventListener('visibilitychange', () => power());
    power(true);
  } catch (e) { A.ac = null; }
}

// Runs the context only while something can be heard: page visible and at least one toggle on.
// Outside a gesture a resume may be refused (iOS), so those retries are spaced out.
export function power(gesture) {
  const ac = A.ac;
  if (!ac) return;
  const want = !document.hidden && !(S.muted && S.musicMuted);
  if (want && ac.state !== 'running' && !A.waking && (gesture || performance.now() - A.tried > 1000)) {
    A.waking = true;
    A.tried = performance.now();
    ac.resume().catch(() => {}).then(() => { A.waking = false; });
  } else if (!want && ac.state === 'running') ac.suspend().catch(() => {});
}

// Any later tap also counts as a gesture: it lets the menu music start on the first touch, and it
// recovers a context iOS interrupted (a phone call, the lock screen).
function gesture(e) { if (e.isTrusted && (!A.ac || A.ac.state !== 'running')) init(); }
for (const t of ['pointerup', 'touchend', 'keydown']) window.addEventListener(t, gesture, { capture: true, passive: true });

export const now = () => A.ac.currentTime;
export const live = () => !!A.ac && A.ac.state === 'running';

// Eases a param toward v, writing automation only when the target actually changes.
export function glide(param, v, tau = 0.15) {
  if (param._to !== undefined && Math.abs(param._to - v) < 0.005) return;
  param._to = v;
  param.setTargetAtTime(v, A.ac.currentTime, tau);
}

// Polyphony caps per category: a sound is dropped when `max` of its kind are still ringing.
const rings = {};
export function claim(cat, max, dur) {
  const t = A.ac.currentTime, r = rings[cat] || (rings[cat] = []);
  for (let i = r.length - 1; i >= 0; i--) if (r[i] <= t) r.splice(i, 1);
  if (r.length >= max) return false;
  r.push(t + dur);
  return true;
}

// Plays a buffer: source -> optional lowpass -> gain -> optional pan -> dest, plus reverb/echo sends.
export function play(buf, o) {
  const ac = A.ac;
  const src = ac.createBufferSource();
  src.buffer = buf;
  if (o.rate) src.playbackRate.value = o.rate;
  let node = src;
  if (o.cut && o.cut < 15000) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut;
    node.connect(f); node = f;
  }
  const g = gain(o.gain == null ? 1 : o.gain);
  node.connect(g); node = g;
  if (o.pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = o.pan;
    node.connect(p); node = p;
  }
  node.connect(o.dest || A.sfx);
  if (o.verb) node.connect(gain(o.verb, A.verb));
  if (o.echo) node.connect(gain(o.echo, A.echo));
  src.start(Math.max(ac.currentTime, o.at || 0));
  return src;
}

// Briefly pulls the music down under a big hit.
export function duck(depth, hold) {
  const p = A.duck.gain, t = A.ac.currentTime;
  p.cancelScheduledValues(t);
  p.setTargetAtTime(1 - depth, t, 0.02);
  p.setTargetAtTime(1, t + hold, 0.5);
}
