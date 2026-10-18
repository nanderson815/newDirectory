import { S } from '../state.js';
import { PI, lerp, angDiff } from '../util.js';

// Points of sail: speed factor by the angle between heading and where the wind blows to.
// Kept gentle: into the wind is slower, never a crawl.
const POINTS = [[0, 0.9], [0.785, 0.97], [1.571, 1.0], [2.1, 0.9], [2.6, 0.7], [PI, 0.58]];

export function windFactor(h) {
  const a = Math.abs(angDiff(S.G.wind.dir, h));
  for (let i = 0; i < POINTS.length - 1; i++) {
    const [a0, f0] = POINTS[i], [a1, f1] = POINTS[i + 1];
    if (a <= a1) return lerp(f0, f1, (a - a0) / (a1 - a0));
  }
  return POINTS[POINTS.length - 1][1];
}

// The wind wanders a little around the battle's base direction.
export function updateWind() {
  const G = S.G;
  G.wind.dir = G.wind.base + Math.sin(G.t * 0.05) * 0.2 + Math.sin(G.t * 0.013 + 1) * 0.1;
}
