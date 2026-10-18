import { S } from '../state.js';
import { rand } from '../util.js';
import { A, play, claim, glide, now, live } from './engine.js';
import { sample } from './samples.js';
import { squeezebox, drone, pad, brass, hz } from './voices.js';
import { FORM, STEPS, CHORDS, TRIADS, SCALES, MELODY, midi } from './score.js';
import { sfx } from './sfx.js';

// Procedural shanty. Notes are queued a little ahead on the AudioContext clock ("a tale of two
// clocks"): the frame loop only wakes the scheduler, every note time comes from the audio clock.
const LOOKAHEAD = 0.5; // seconds of music kept queued; rides out a long frame on a slow phone
const FADE_IN = 1.2, FADE_OUT = 1.8;

// eighth: seconds per eighth note (six to a bar). push: how much battle intensity hurries the tempo.
const MOODS = {
  menu: { eighth: 0.25, scale: 'dorian', drone: 0.22, bass: 0.55, pah: 0.2, lead: 'gentle', cut: 1300, verb: 0.45 },
  calm: { eighth: 0.3, scale: 'dorian', drone: 0.26, bass: 0.45, arp: 0.24, lead: 'sparse', cut: 1000, verb: 0.55 },
  battle: { eighth: 0.205, scale: 'dorian', drone: 0.16, bass: 0.7, pah: 0.22, lead: 'box', cut: 2000, perc: 'jig', fight: true, push: 0.05, verb: 0.25 },
  boss: { eighth: 0.182, scale: 'minor', drone: 0.2, bass: 0.8, pah: 0.18, lead: 'box', cut: 1500, perc: 'boss', pad: true, fight: true, push: 0.06, verb: 0.3 },
};
// Frame drum patterns over the six eighths: [sample, velocity].
const PERC = {
  jig: [['drumLo', 1], ['drumHi', 0.3], ['drumHi', 0.45], ['drumLo', 0.8], ['drumHi', 0.3], ['drumHi', 0.55]],
  boss: [['drumLo', 1], ['drumHi', 0.35], ['drumLo', 0.6], ['drumLo', 0.9], ['drumHi', 0.4], ['drumHi', 0.6]],
};
// Calm arpeggio: indexes into [root, third, fifth, octave].
const ARP = [0, 2, 3, 2, 1, 2];

const tracks = [];
let cur = null, want = null, holdUntil = 0, levelT = 0;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function pluck(kind, m, t, vel, dest) {
  if (!claim('pluck', 16, 0.5)) return;
  const b = sample(kind);
  play(b, { at: t, rate: hz(m) / b.f0, gain: vel * rand(0.88, 1.04), dest });
}
function hit(name, t, vel, dest) {
  if (!claim('drum', 10, 0.3)) return;
  play(sample(name), { at: t, gain: vel * rand(0.88, 1.04), rate: rand(0.97, 1.03), dest });
}

function makeTrack(name, t0) {
  const M = MOODS[name], ac = A.ac, t = ac.currentTime;
  const mk = (v, to) => { const g = ac.createGain(); g.gain.value = v; g.connect(to); return g; };
  const bus = mk(0, A.music);
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(1, t + FADE_IN);
  bus.connect(mk(M.verb, A.verb));
  // Layers come and go with battle intensity: base (drone, oom-pah), lead, percussion, and drive
  // (boots on the deck, tambourine, a harmony line).
  const L = { base: mk(1, bus), lead: mk(1, bus), perc: mk(M.perc ? 0.4 : 0, bus), drive: mk(0, bus) };
  const tr = { name, M, bus, L, lv: { lead: 1, perc: L.perc.gain.value, drive: 0 }, scale: SCALES[M.scale], next: t0, bar: 0, step: 0, I: 0, end: 0, eighth: M.eighth };
  tr.box = squeezebox(L.lead, M.cut);
  tr.drone = drone(mk(M.drone, L.base), [38, 45], M.pad ? 260 : 380);
  if (M.pad) tr.pad = pad(L.base);
  return tr;
}

function fadeOut(tr, t, fade) {
  if (tr.end) return;
  tr.end = t + fade;
  const g = tr.bus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0, tr.end);
  tr.box.stop(tr.end + 0.1); tr.drone.stop(tr.end + 0.1);
  if (tr.pad) tr.pad.stop(tr.end + 0.1);
  if (tr === cur) cur = null;
}

// One eighth note of the arrangement, at audio time t.
function step(tr, t) {
  const M = tr.M, pos = tr.bar % 32, sec = FORM[pos >> 3], bi = pos & 7, part = pos >> 3, st = tr.step;
  const name = CHORDS[sec][bi], raise = M.scale === 'minor' && name === 'Am';
  const ch = TRIADS[name], L = tr.L, I = tr.I;
  const m = (d) => midi(d, tr.scale, raise);
  const loose = () => t + rand(0, 0.008);

  // Oom-pah: bass root on the first beat, the fifth below on the second, the chord on the off-eighths.
  if (st === 0) pluck('bass', m(ch[0] - 14), loose(), M.bass, L.base);
  if (st === 3 && !M.arp) pluck('bass', m(ch[2] - 21), loose(), M.bass * 0.8, L.base);
  if (M.pah && (st === 2 || st === 5)) ch.forEach((d, k) => pluck('pizz', m(d - 7), t + k * 0.012 + rand(0, 0.005), M.pah, L.base));
  if (M.arp) { const k = ARP[st]; pluck('pizz', k === 3 ? m(ch[0]) : m(ch[k] - 7), loose(), M.arp * (st ? 0.8 : 1), L.base); }
  if (tr.pad && st === 0) tr.pad.chord([m(ch[0] - 14), m(ch[2] - 14), m(ch[1] - 7)], t, tr.eighth * STEPS * 2, I);

  const note = MELODY[sec][bi][st];
  if (note) lead(tr, note, sec, part, st, t, m);

  if (M.perc && tr.lv.perc > 0.02) {
    const [s, v] = PERC[M.perc][st];
    if (st === 0 || st === 3 || I > 0.25) hit(s, t, v, L.perc);
    if (M.perc === 'boss' && (st === 0 || st === 3)) hit('stomp', t, 0.8, L.perc);
    // A rim-shot fill into each new strain once things heat up.
    if (bi === 7 && st >= 3 && I > 0.4) hit('drumHi', t + tr.eighth / 2, 0.4, L.perc);
  }
  if (M.fight && tr.lv.drive > 0.02) {
    if (M.perc === 'jig' && (st === 0 || st === 3)) hit('stomp', t, st ? 0.75 : 1, L.drive);
    if (M.pad && bi % 2 === 0 && st === 0) hit('timp', t, 0.7, L.drive);
    if (st === 2 || st === 5 || (I > 0.8 && (st === 1 || st === 4))) hit('jingle', t, st % 3 === 2 ? 0.5 : 0.25, L.drive);
  }
}

function lead(tr, [d, len], sec, part, st, t, m) {
  const M = tr.M, dur = len * tr.eighth, accent = st === 0 ? 1 : st === 3 ? 0.85 : 0.7;
  if (M.lead === 'gentle') {
    // Menu: the tune on pizzicato violin, with the squeezebox taking the middle strain.
    if (sec === 'B') tr.box.note(m(d), t, dur * 0.95, 0.2 * accent);
    else pluck('hi', m(d), t, 0.5 * accent, tr.L.lead);
  } else if (M.lead === 'sparse') {
    // Chart and shipyard: mostly arpeggio; the tune drifts in on the second A strain and the B strain.
    if (sec === 'B') tr.box.note(m(d), t, dur * 0.95, 0.15 * accent);
    else if (part === 1 && st % 3 === 0) pluck('hi', m(d), t, 0.4 * accent, tr.L.lead);
  } else {
    // Battle: squeezebox with folk "cuts"; the boss's first strain growls an octave down.
    const oct = M.pad && sec === 'A' ? -12 : 0;
    const grace = len >= 2 && Math.random() < 0.3 ? m(d + 1) + oct : 0;
    tr.box.note(m(d) + oct, t, dur * 0.92, 0.28 * accent, grace);
    if (tr.lv.drive > 0.02) pluck('hi', m(d - 2), t + 0.004, 0.3 * accent, tr.L.drive);
  }
}

// Layer levels follow intensity; written a few times a second, not every frame.
function levels(tr) {
  const M = tr.M, I = tr.I;
  if (!M.fight) return;
  const lv = tr.lv;
  lv.lead = 0.6 + 0.4 * smooth(0.05, 0.5, I);
  lv.perc = 0.4 + 0.6 * smooth(0.15, 0.5, I);
  lv.drive = smooth(0.5, 0.85, I);
  glide(tr.L.lead.gain, lv.lead, 0.5);
  glide(tr.L.perc.gain, lv.perc, 0.5);
  glide(tr.L.drive.gain, lv.drive, 0.6);
  glide(tr.box.lp.frequency, M.cut * (0.7 + 0.6 * I), 0.5);
}

export function musicTick(dt, I, ending) {
  if (!live()) return;
  const t = now();
  if (S.musicMuted) { for (const tr of tracks) fadeOut(tr, t, 0.4); }
  else if (want && !cur && t >= holdUntil) { cur = makeTrack(want, t + 0.06); tracks.push(cur); }
  else if (want && cur && cur.name !== want) { fadeOut(cur, t, FADE_OUT); cur = makeTrack(want, t + 0.06); tracks.push(cur); }

  for (let i = tracks.length - 1; i >= 0; i--) {
    const tr = tracks[i];
    if (tr.end && t > tr.end + 1) { tr.bus.disconnect(); tracks.splice(i, 1); continue; }
    // Fell behind (a long frame, a throttled tab): skip ahead instead of bursting out the missed notes.
    if (tr.next < t - 0.1) tr.next = t + 0.02;
    while (tr.next < t + LOOKAHEAD && !(tr.end && tr.next >= tr.end)) {
      tr.eighth = tr.M.eighth * (1 - (tr.M.push || 0) * tr.I);
      step(tr, tr.next);
      tr.next += tr.eighth;
      if (++tr.step === STEPS) { tr.step = 0; tr.bar++; }
    }
  }
  if (cur && (levelT -= dt) <= 0) {
    levelT = 0.25;
    cur.I = cur.M.fight && !ending ? I : 0;
    levels(cur);
  }
}

// ---------- Stingers ----------
function victory(t, out) {
  for (let i = 0; i < 6; i++) hit('timp', t + i * 0.06, 0.2 + i * 0.08, out);
  [62, 66, 69].forEach((m, i) => brass(m, t + i * 0.12, 0.1, 0.16, out));
  const T = t + 0.4;
  hit('timp', T, 1, out);
  pluck('bass', 38, T, 0.9, out);
  for (const m of [50, 57, 62, 66]) brass(m, T, 1.5, 0.1, out, 0.8);
  brass(74, T, 1.5, 0.15, out, 1.1);
  [50, 54, 57, 62, 66].forEach((m, i) => pluck('pizz', m, T + i * 0.025, 0.55, out));
  hit('timp', T + 1.6, 0.4, out);
  return 2.6;
}
function defeat(t, out) {
  const box = squeezebox(out, 1100);
  let at = t + 0.25;
  for (const [m, d] of [[69, 0.5], [67, 0.25], [65, 0.5], [64, 0.3], [61, 0.45], [62, 1.6]]) { box.note(m, at, d * 0.95, 0.22); at += d; }
  box.stop(at + 0.5);
  for (const m of [38, 45, 53]) brass(m, t, at - t - 0.3, 0.07, out, 0.5);
  hit('timp', t, 0.5, out);
  hit('timp', at - 1.6, 0.35, out);
  pluck('bass', 38, at - 1.6, 0.8, out);
  return at - t + 0.6;
}

export const music = {
  // menu | calm | battle | boss. The switch happens on the next tick, crossfading the old track out.
  mood(name) { if (name !== want) { want = name; holdUntil = 0; } },
  // Victory or defeat: the current track drops away under a short cue, then the calm theme returns.
  stinger(win) {
    want = 'calm';
    if (!live() || S.musicMuted) { if (win) sfx.fanfare(true); return; }
    const t = now();
    for (const tr of tracks) fadeOut(tr, t, 0.35);
    const out = A.ac.createGain();
    out.connect(A.music);
    const send = A.ac.createGain(); send.gain.value = 0.4; out.connect(send); send.connect(A.verb);
    holdUntil = t + 0.1 + (win ? victory(t + 0.1, out) : defeat(t + 0.1, out)) + 0.5;
  },
};
