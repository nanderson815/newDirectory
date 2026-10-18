import { S } from '../state.js';
import { PI, lerp, angDiff } from '../util.js';

// Points of sail: speed factor by the angle between heading and where the wind blows to.
// Kept gentle: into the wind is slower, never a crawl.
// Fore-and-aft and lateen rigs point higher into the wind but don't run as well before it.
const POINTS = {
  square: [[0, 0.9], [0.785, 0.97], [1.571, 1.0], [2.1, 0.9], [2.6, 0.7], [PI, 0.58]],
  'fore-aft': [[0, 0.82], [0.785, 0.95], [1.571, 1.0], [2.1, 0.97], [2.6, 0.86], [PI, 0.76]],
  lateen: [[0, 0.84], [0.785, 0.96], [1.571, 1.0], [2.1, 0.94], [2.6, 0.8], [PI, 0.7]],
};
const OARS = 0.86; // sweeps keep an oared ship moving whatever the wind

export function windFactor(h, s) {
  const pts = POINTS[(s && s.rig) || 'square'] || POINTS.square;
  const a = Math.abs(angDiff(S.G.wind.dir, h));
  let f = pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, f0] = pts[i], [a1, f1] = pts[i + 1];
    if (a <= a1) { f = lerp(f0, f1, (a - a0) / (a1 - a0)); break; }
  }
  return s && s.oars ? Math.max(f, OARS) : f;
}

// The wind wanders a little around the battle's base direction.
export function updateWind() {
  const G = S.G;
  G.wind.dir = G.wind.base + Math.sin(G.t * 0.05) * 0.2 + Math.sin(G.t * 0.013 + 1) * 0.1;
}
