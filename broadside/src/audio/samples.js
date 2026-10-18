import { A } from './engine.js';
import { rand } from '../util.js';

// One-shot sounds rendered once into AudioBuffers, sample by sample. At runtime each is a single
// buffer source plus a gain, far cheaper on a phone than a graph of oscillators and filters per hit.
// Several takes of each are rendered with random settings, so repeats don't sound identical.
const TAU = Math.PI * 2;
const cache = new Map();

export function sample(name, take = 0) {
  const key = name + take;
  let b = cache.get(key);
  if (!b) { b = RECIPES[name](); cache.set(key, b); }
  return b;
}

// Renders takes one at a time between frames after start-up, so the first broadside doesn't hitch.
export function warm(list) {
  let i = 0;
  const step = () => {
    if (i >= list.length) return;
    const [name, take] = list[i++];
    sample(name, take);
    setTimeout(step, 40);
  };
  setTimeout(step, 300);
}

// Rendered at 32 kHz at most: the engine resamples on playback, and it halves start-up work on phones.
function render(dur, fill, channels = 1, peak = 0.9, full = false) {
  const ac = A.ac, sr = full ? ac.sampleRate : Math.min(ac.sampleRate, 32000), n = Math.ceil(dur * sr);
  const b = ac.createBuffer(channels, n, sr);
  let max = 0;
  for (let c = 0; c < channels; c++) {
    const d = b.getChannelData(c);
    fill(d, sr, n);
    const fade = Math.min(n, Math.floor(sr * 0.01));
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    for (let i = 0; i < n; i++) { const v = Math.abs(d[i]); if (v > max) max = v; }
  }
  if (max > 0) for (let c = 0; c < channels; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= peak / max; }
  return b;
}

// ---------- DSP primitives (no Math.exp per sample: phones render these at start-up) ----------
const white = () => Math.random() * 2 - 1;
// Soft clip, a rational tanh.
const clip = (x) => (x > 3 ? 1 : x < -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x));
// Exponential decay with time constant tau; each call advances one sample (the first returns 1).
function decay(tau, sr) { const k = Math.exp(-1 / (tau * sr)); let v = 1 / k; return () => (v *= k); }
// One-pole lowpass at a fixed cutoff.
function lowpass(fc, sr) { const a = 1 - Math.exp(-TAU * fc / sr); let y = 0; return (x) => (y += a * (x - y)); }
// One-pole lowpass whose cutoff moves every sample (approximate coefficient).
function sweepLP(sr) { let y = 0; return (x, fc) => { const w = TAU * fc / sr; return (y += (w / (1 + w)) * (x - y)); }; }
// RBJ bandpass (0 dB peak). Call .set(f) to move it.
function bandpass(f, q, sr) {
  let b0, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const run = (x) => { const y = b0 * (x - x2) - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  run.set = (fc) => { const w = TAU * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al; b0 = al / a0; a1 = -2 * Math.cos(w) / a0; a2 = (1 - al) / a0; };
  run.set(f);
  return run;
}
// Sine whose frequency may change every sample.
function sine(sr) { let ph = 0; return (f) => Math.sin((ph += TAU * f / sr)); }
// Adds short events into d, each over its own span only: fn(u, sampleIndexInGrain) for u in [0, len).
function scatter(d, sr, starts, len, fn) {
  const n = Math.floor(len * sr);
  starts.forEach((t0, k) => {
    const i0 = Math.floor(t0 * sr);
    for (let j = 0; j < n && i0 + j < d.length; j++) d[i0 + j] += fn(j / sr, k, j);
  });
}
const times = (count, a, b) => Array.from({ length: count }, () => rand(a, b));

// Bubbles: sines rising in pitch as they collapse.
function bubbles(d, sr, count, a, b, gain) {
  const fs = times(count, 180, 600), amps = times(count, 0.15, 0.4).map((v) => v * gain);
  const k = Math.exp(-1 / (0.025 * sr));
  scatter(d, sr, times(count, a, b), 0.08, (u, i, j) => Math.sin(TAU * fs[i] * (u + 9 * u * u)) * amps[i] * Math.pow(k, j));
}

// ---------- Recipes ----------
const RECIPES = {
  // A cannon: a pitch-dropping thump, a noise blast through a closing lowpass, a rumble tail and a crack.
  gun() {
    const f0 = rand(95, 140), f1 = rand(36, 46), tf = rand(0.04, 0.07), ta = rand(0.13, 0.2);
    const c0 = rand(2400, 3800), tc = rand(0.03, 0.055), tb = rand(0.09, 0.15), tr = rand(0.45, 0.7);
    return render(1.3, (d, sr) => {
      const osc = sine(sr), lp1 = sweepLP(sr), lp2 = sweepLP(sr), hp = lowpass(2500, sr);
      const eF = decay(tf, sr), eA = decay(ta, sr), eC = decay(tc, sr), eB = decay(tb, sr), eR = decay(tr, sr), eOn = decay(0.0015, sr), eK = decay(0.005, sr);
      for (let i = 0; i < d.length; i++) {
        const n = white(), fc = 140 + c0 * eC();
        const thump = osc(f1 + (f0 - f1) * eF()) * eA();
        const blast = lp2(lp1(n, fc), fc) * (eB() + 0.3 * eR()) * (1 - eOn());
        d[i] = clip(1.3 * (0.8 * thump + 5 * blast + 0.3 * (n - hp(n)) * eK()));
      }
    });
  },
  // Fort guns are bigger bores: lower, slower and with a longer roll.
  fort() {
    const f0 = rand(70, 90), c0 = rand(1600, 2200);
    return render(1.9, (d, sr) => {
      const osc = sine(sr), lp1 = sweepLP(sr), lp2 = sweepLP(sr), hp = lowpass(2000, sr);
      const eF = decay(0.08, sr), eA = decay(0.28, sr), eC = decay(0.07, sr), eB = decay(0.2, sr), eR = decay(0.9, sr), eOn = decay(0.002, sr), eK = decay(0.006, sr);
      for (let i = 0; i < d.length; i++) {
        const n = white(), fc = 90 + c0 * eC();
        const thump = osc(30 + (f0 - 30) * eF()) * eA();
        const blast = lp2(lp1(n, fc), fc) * (eB() + 0.4 * eR()) * (1 - eOn());
        d[i] = clip(1.4 * (thump + 6 * blast + 0.25 * (n - hp(n)) * eK()));
      }
    });
  },
  // A sea mine: a deep blast, then the water column climbing and falling back as spray.
  mine() {
    return render(2.6, (d, sr) => {
      const osc = sine(sr), lp1 = sweepLP(sr), lp2 = sweepLP(sr), col = bandpass(1100, 0.8, sr);
      const eF = decay(0.09, sr), eA = decay(0.35, sr), eOn = decay(0.003, sr), eC = decay(0.12, sr), eB = decay(0.3, sr), eR = decay(0.9, sr);
      const eCol = decay(0.5, sr), eRise = decay(0.08, sr), eFall = decay(0.5, sr), start = Math.floor(0.1 * sr);
      for (let i = 0; i < d.length; i++) {
        const n = white(), fc = 110 + 1500 * eC();
        const thump = osc(28 + 50 * eF()) * eA() * (1 - eOn());
        const blast = lp2(lp1(n, fc), fc) * (eB() + 0.35 * eR()) * 7;
        const cf = eCol();
        if ((i & 63) === 0) col.set(600 + 700 * cf);
        const geyser = i < start ? 0 : col(n) * (1 - eRise()) * eFall() * 1.6;
        d[i] = 1.1 * thump + blast + geyser;
      }
      const hi = bandpass(3200, 4, sr), amps = times(16, 0.4, 1.2), k = Math.exp(-1 / (0.008 * sr));
      scatter(d, sr, times(16, 0.6, 2.1), 0.06, (u, g, j) => hi(white()) * amps[g] * Math.pow(k, j));
      for (let i = 0; i < d.length; i++) d[i] = clip(d[i]);
    });
  },
  // Shot into a hull: a thud, a crunch of planking, two knock resonances and flying splinters.
  wood() {
    const m1 = rand(280, 380), m2 = rand(700, 900);
    return render(0.5, (d, sr) => {
      const osc = sine(sr), s1 = sine(sr), s2 = sine(sr), crunch = bandpass(rand(1200, 1900), 1.1, sr);
      const eF = decay(0.02, sr), eA = decay(0.035, sr), eN = decay(0.045, sr), e1 = decay(0.06, sr), e2 = decay(0.03, sr);
      for (let i = 0; i < d.length; i++) {
        const thump = osc(90 + 110 * eF()) * eA();
        const knock = s1(m1) * e1() * 0.35 + s2(m2) * e2() * 0.25;
        d[i] = 0.8 * thump + crunch(white()) * eN() * 2.5 + knock;
      }
      const hi = bandpass(rand(2800, 4200), 3, sr), amps = times(5, 1, 2.4), k = Math.exp(-1 / (0.007 * sr));
      scatter(d, sr, times(5, 0.012, 0.17), 0.05, (u, g, j) => hi(white()) * amps[g] * Math.pow(k, j));
      for (let i = 0; i < d.length; i++) d[i] = clip(d[i]);
    });
  },
  // Shot into a fort: a dull thud, grit, and gravel trickling down.
  stone() {
    return render(0.7, (d, sr) => {
      const osc = sine(sr), grit = lowpass(2600, sr), crumble = lowpass(1600, sr);
      const eF = decay(0.03, sr), eA = decay(0.05, sr), eG = decay(0.06, sr), eP = decay(0.18, sr);
      for (let i = 0; i < d.length; i++) {
        const thump = osc(60 + 90 * eF()) * eA();
        const pebble = Math.random() < (300 / sr) * eP() ? white() * 8 : 0;
        d[i] = clip(0.9 * thump + grit(white()) * eG() * 2 + crumble(pebble));
      }
    });
  },
  // A ball into the water: a falling "plunk" and a spray that darkens as it settles.
  splash() {
    const f0 = rand(800, 1200);
    return render(0.8, (d, sr) => {
      const osc = sine(sr), spray = bandpass(2500, 0.9, sr), hp = lowpass(3000, sr);
      const eF = decay(0.025, sr), eA = decay(0.035, sr), eOn = decay(0.001, sr), eS = decay(0.15, sr), eSOn = decay(0.004, sr), eSA = decay(0.11, sr), eZ = decay(0.28, sr);
      for (let i = 0; i < d.length; i++) {
        const n = white(), sf = eS();
        if ((i & 63) === 0) spray.set(800 + 1900 * sf);
        const plunk = osc(260 + f0 * eF()) * eA() * (1 - eOn());
        d[i] = 0.45 * plunk + spray(n) * (1 - eSOn()) * eSA() * 2.2 + (n - hp(n)) * eZ() * 0.1;
      }
    });
  },
  // A ship going down: the crash of the hull settling, a timber groan and the first bubbles.
  sink() {
    return render(2.8, (d, sr) => {
      const osc = sine(sr), crash = bandpass(500, 0.7, sr), r1 = bandpass(420, 9, sr), r2 = bandpass(1100, 7, sr);
      const eF = decay(0.3, sr), eA = decay(0.45, sr), eH = decay(0.55, sr), riseN = Math.floor(0.18 * sr);
      const g0 = Math.floor(0.3 * sr), g1 = Math.floor(2.1 * sr);
      let ph = 0, hump = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        hump = i < riseN ? i / riseN : eH();
        if ((i & 63) === 0) crash.set(380 + 1100 * hump);
        const whomp = osc(34 + 30 * eF()) * eA() * Math.min(1, t / 0.02);
        // The groan is a slowing click train ringing two hull resonances (stick-slip, like a door hinge).
        let imp = 0, groan = 0;
        if (i > g0 && i < g1) {
          ph += (22 - 5 * (t - 0.3)) / sr;
          if (ph >= 1) { ph -= 1; imp = 1; }
          groan = Math.sin(Math.PI * (t - 0.3) / 1.8);
        }
        d[i] = crash(white()) * hump * 2.2 + 0.9 * whomp + (r1(imp) + 0.6 * r2(imp)) * groan * 60;
      }
      bubbles(d, sr, 16, 0.35, 2.5, 1);
      for (let i = 0; i < d.length; i++) d[i] = clip(d[i]);
    });
  },
  // The last of the hull slipping under.
  gurgle() {
    return render(1.6, (d, sr) => {
      const glug = bandpass(260, 5, sr), e = decay(0.5, sr);
      for (let i = 0; i < d.length; i++) d[i] = glug(white()) * e() * 2;
      bubbles(d, sr, 22, 0, 1.3, 1);
      for (let i = 0; i < d.length; i++) d[i] = clip(d[i]);
    }, 1, 0.7);
  },
  // Timber working in a seaway: the same stick-slip groan, short and ringing higher.
  creak() {
    const dur = rand(0.8, 1.3), f1 = rand(550, 850), f2 = rand(1400, 2000), r0 = rand(25, 40), r1 = rand(15, 35);
    return render(dur, (d, sr) => {
      const a = bandpass(f1, 14, sr), b = bandpass(f2, 9, sr);
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const s = Math.sin(Math.PI * i / sr / dur);
        ph += (r0 + r1 * s) / sr;
        let imp = 0;
        if (ph >= 1) { ph -= 1; imp = 1 + 0.3 * white(); }
        d[i] = (a(imp) + 0.5 * b(imp)) * s * Math.sqrt(s);
      }
    }, 1, 0.8);
  },
  // A herring gull: a few "kyow" calls, each a quick rise and a long harsh fall.
  gull() {
    const calls = 2 + Math.floor(Math.random() * 3), gap = rand(0.26, 0.36), base = rand(1150, 1400), peak = rand(1900, 2300);
    return render(calls * gap + 0.3, (d, sr) => {
      const rasp = bandpass(2200, 1.5, sr), kFall = Math.exp(-1 / (0.08 * sr)), kEnv = Math.exp(-1 / (0.07 * sr));
      const starts = Array.from({ length: calls }, (_, k) => k * gap);
      let ph = 0;
      scatter(d, sr, starts, 0.24, (u, k, j) => {
        const rise = Math.floor(0.035 * sr), hold = Math.floor(0.03 * sr);
        const f = base + (peak - base) * (j < rise ? j / rise : Math.pow(kFall, j - rise)) + 35 * Math.sin(TAU * 27 * u);
        ph += TAU * f / sr;
        const env = Math.min(1, u / 0.012) * (j < hold ? 1 : Math.pow(kEnv, j - hold));
        return (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.18 * Math.sin(3 * ph) + rasp(white()) * 1.5) * env;
      });
    }, 1, 0.8);
  },
  // One wave washing past: noise swelling up through an opening filter and hissing away.
  wash() {
    const dur = rand(2.8, 4);
    return render(dur, (d, sr) => {
      const lp = sweepLP(sr), hp = lowpass(4000, sr);
      let h = 0;
      for (let i = 0; i < d.length; i++) {
        if ((i & 255) === 0) h = Math.pow(Math.sin(Math.PI * Math.pow(i / sr / dur, 0.6)), 2);
        const n = white();
        d[i] = (lp(n, 250 + 1400 * h) * 3 + (n - hp(n)) * 0.08 * h) * h;
      }
    }, 2, 0.8);
  },
  // The sea bed loop: pinkish noise plus a little brown, de-trended so the loop point doesn't click.
  sea() {
    return render(4, (d, sr, n) => {
      const lp = lowpass(1500, sr);
      let br = 0;
      for (let i = 0; i < n; i++) { const w = white(); br = 0.996 * br + w * 0.05; d[i] = lp(w) + br * 0.6; }
      const e = d[n - 1] - d[0];
      for (let i = 0; i < n; i++) d[i] -= (e * i) / (n - 1);
    }, 2, 0.6);
  },

  // ---------- Instruments ----------
  bass() { return pluck(73.42, 1.3, 0.42, 0.22); },   // D2 pizzicato double bass
  pizz() { return pluck(146.83, 0.9, 0.26, 0.45); },  // D3 pizzicato cello
  hi() { return pluck(440, 0.7, 0.22, 0.55); },       // A4 pizzicato violin
  // Frame drum, struck in the middle (low) and at the rim (high).
  drumLo() {
    return render(0.45, (d, sr) => {
      const osc = sine(sr), slap = lowpass(1800, sr), skin = bandpass(350, 2, sr);
      const eF = decay(0.04, sr), eA = decay(0.12, sr), eS = decay(0.012, sr), eK = decay(0.05, sr);
      for (let i = 0; i < d.length; i++) {
        const n = white();
        d[i] = osc(62 + 58 * eF()) * eA() + slap(n) * eS() * 1.2 + skin(n) * eK() * 0.8;
      }
    });
  },
  drumHi() {
    return render(0.25, (d, sr) => {
      const osc = sine(sr), slap = lowpass(3500, sr), eF = decay(0.02, sr), eA = decay(0.05, sr), eS = decay(0.008, sr);
      for (let i = 0; i < d.length; i++) d[i] = osc(150 + 60 * eF()) * eA() * 0.7 + slap(white()) * eS() * 1.4;
    });
  },
  // A boot on deck planking: a low thud plus the knock of the boards.
  stomp() {
    return render(0.5, (d, sr) => {
      const osc = sine(sr), s1 = sine(sr), s2 = sine(sr), s3 = sine(sr), click = lowpass(4000, sr);
      const eF = decay(0.05, sr), eA = decay(0.11, sr), e1 = decay(0.03, sr), e2 = decay(0.02, sr), e3 = decay(0.012, sr), eC = decay(0.004, sr);
      for (let i = 0; i < d.length; i++) {
        const knock = s1(260) * e1() * 0.5 + s2(620) * e2() * 0.3 + s3(1450) * e3() * 0.15;
        d[i] = osc(40 + 40 * eF()) * eA() + knock + click(white()) * eC() * 1.5;
      }
    });
  },
  // Tambourine: bright noise in three quick jingles over a few metallic partials.
  jingle() {
    return render(0.3, (d, sr) => {
      const lp = lowpass(6000, sr), s1 = sine(sr), s2 = sine(sr), s3 = sine(sr), eM = decay(0.07, sr);
      for (let i = 0; i < d.length; i++) d[i] = (s1(5200) + s2(6700) + s3(8300)) * eM() * 0.08;
      const k = Math.exp(-1 / (0.045 * sr)), amps = [1, 0.6, 0.35];
      scatter(d, sr, [0, 0.011, 0.024], 0.25, (u, g, j) => { const n = white(); return (n - lp(n)) * amps[g] * Math.pow(k, j); });
    }, 1, 0.7);
  },
  // Kettle drum tuned to D, for stingers and the boss going down.
  timp() {
    return render(1.6, (d, sr) => {
      const parts = [[1, 1, 0.7], [1.5, 0.5, 0.4], [1.99, 0.3, 0.3], [2.44, 0.2, 0.2]].map(([m, a, tau]) => ({ m, a, osc: sine(sr), e: decay(tau, sr) }));
      const mallet = lowpass(1200, sr), eB = decay(0.05, sr), eM = decay(0.01, sr);
      for (let i = 0; i < d.length; i++) {
        const f = 73.42 * (1 + 0.03 * eB());
        let v = 0;
        for (const p of parts) v += p.osc(f * p.m) * p.a * p.e();
        d[i] = v + mallet(white()) * eM() * 1.5;
      }
    });
  },
};

// Karplus-Strong: a noise burst circulating in a delay line with an averaging filter. The buffer's f0
// is its true pitch (the delay is a whole number of samples), so players can transpose it exactly.
function pluck(freq, dur, tau, bright) {
  let f0 = freq;
  const b = render(dur, (d, sr) => {
    const N = Math.max(2, Math.round(sr / freq + 0.5));
    f0 = sr / (N - 0.5);
    let lp = 0, mean = 0;
    for (let i = 0; i < N; i++) { lp += bright * (white() - lp); d[i] = lp; mean += lp / N; }
    for (let i = 0; i < N; i++) d[i] -= mean;
    for (let i = N; i < d.length; i++) d[i] = 0.498 * (d[i - N] + d[i - N + 1]);
    const e = decay(tau, sr), on = decay(0.002, sr);
    for (let i = 0; i < d.length; i++) d[i] *= e() * (1 - on());
  });
  b.f0 = f0;
  return b;
}

// A small room for the reverb send: decaying stereo noise that darkens as it fades.
export function room() {
  return render(1.1, (d, sr) => {
    const lp = sweepLP(sr), eC = decay(0.35, sr), eA = decay(0.28, sr), pre = Math.floor(0.012 * sr);
    for (let i = 0; i < d.length; i++) {
      const c = eC(), a = eA();
      d[i] = i < pre ? 0 : lp(white(), 7000 * c + 400) * a;
    }
  }, 2, 0.5, true); // a convolver needs the context's own rate
}
