import { A } from './engine.js';

// Oscillator instruments. The long-lived ones (squeezebox, drone, pad) are built once per music track
// and re-pitched note by note, so a tune costs automation events rather than new nodes.
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function osc(type, f, to) { const o = A.ac.createOscillator(); o.type = type; o.frequency.value = f; if (to) o.connect(to); return o; }
function gain(v, to) { const g = A.ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function lowpass(f, q, to) { const b = A.ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }

// Squeezebox: a square and a saw reed slightly out of tune with each other (the "wet" musette
// beat), through a reedy filter, with a bellows tremolo after the envelope.
export function squeezebox(dest, cutoff) {
  const trem = gain(1, dest), env = gain(0, trem), lp = lowpass(cutoff, 2.2, env);
  const o1 = osc('square', 293.66, gain(0.55, lp)), o2 = osc('sawtooth', 293.66, lp);
  o2.detune.value = 11;
  const lfo = osc('sine', 5.3, gain(0.1, trem.gain));
  const all = [o1, o2, lfo];
  for (const o of all) o.start();
  return {
    lp,
    // grace: a quick upper "cut" before the note, the way folk players ornament a long note.
    note(m, t, dur, vel, grace) {
      const f = hz(m);
      for (const o of [o1, o2]) {
        o.frequency.setValueAtTime(grace ? hz(grace) : f, t);
        if (grace) o.frequency.setValueAtTime(f, t + 0.045);
      }
      env.gain.setTargetAtTime(vel, t, 0.012);
      env.gain.setTargetAtTime(vel * 0.75, t + 0.07, 0.15);
      env.gain.setTargetAtTime(0, t + Math.max(0.08, dur - 0.03), 0.025);
    },
    stop(t) { for (const o of all) o.stop(t); },
  };
}

// Drone: open fifths on low saws under a slowly breathing filter, like a hurdy-gurdy.
export function drone(dest, notes, cutoff) {
  const lp = lowpass(cutoff, 0.8, dest);
  const oscs = notes.map((m, i) => { const o = osc('sawtooth', hz(m), gain(i ? 0.6 : 1, lp)); o.detune.value = i * 4 - 3; return o; });
  const lfo = osc('sine', 0.13, gain(cutoff * 0.35, lp.frequency));
  oscs.push(lfo);
  for (const o of oscs) o.start();
  return { stop(t) { for (const o of oscs) o.stop(t); } };
}

// Low brass pad for the boss: three saws whose filter swells on each chord like a held horn note.
export function pad(dest) {
  const g = gain(0.0001, dest), lp = lowpass(300, 1.2, g);
  const oscs = [0, 1, 2].map((i) => { const o = osc('sawtooth', 73.42, lp); o.detune.value = (i - 1) * 7; return o; });
  for (const o of oscs) o.start();
  let last = '';
  return {
    chord(ms, t, len, swell) {
      const key = ms.join();
      if (key === last) return;
      last = key;
      ms.forEach((m, i) => oscs[i].frequency.setTargetAtTime(hz(m), t, 0.03));
      lp.frequency.setTargetAtTime(220, t, 0.03);
      lp.frequency.setTargetAtTime(260 + 900 * swell, t + 0.05, len * 0.35);
      g.gain.setTargetAtTime(0.12, t, 0.05);
      g.gain.setTargetAtTime(0.22, t + 0.1, len * 0.4);
    },
    stop(t) { for (const o of oscs) o.stop(t); },
  };
}

// One brass note: detuned saws that scoop up to pitch while the filter "blats" open.
export function brass(m, t, dur, vel, dest, bright = 1) {
  const f = hz(m);
  const g = gain(0, dest), lp = lowpass(f * 1.5, 1.4, g);
  const o1 = osc('sawtooth', f, lp), o2 = osc('sawtooth', f, lp);
  o2.detune.value = 9;
  for (const o of [o1, o2]) {
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.setTargetAtTime(f, t, 0.015);
  }
  lp.frequency.setValueAtTime(f * 1.5, t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 9 * bright), t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 3.5 * bright), t + 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.03);
  g.gain.setTargetAtTime(vel * 0.7, t + 0.08, 0.15);
  g.gain.setTargetAtTime(0, t + Math.max(0.1, dur), 0.08);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.6); o2.stop(t + dur + 0.6);
}

// A plain enveloped tone, for small UI blips.
export function tone(f, t, dur, vel, type, dest) {
  const g = gain(0, dest), o = osc(type, f, g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
