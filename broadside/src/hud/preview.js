import { predictCourse, PREDICT_POINTS } from '../sim/predict.js';

// Cached course previews, one per ship. A preview is recomputed only when its course changes (a new path,
// or new points while a finger is still drawing, at most ~12 times a second), or when the ship has drifted
// well off the predicted track (a collision, a gust); otherwise the HUD just walks along it.
const cache = new Map();
const make = () => ({ xy: new Float32Array(PREDICT_POINTS * 2), n: 0, done: false, t: 0, rest: 0, path: null, last: null, at: -1e9, idx: 0 });

function compute(pv, s, pts, now) {
  predictCourse(s, pts, pv);
  pv.path = pts; pv.last = pts[pts.length - 1]; pv.at = now; pv.idx = 0;
  pv.rest = pv.left; // waypoints the horizon didn't reach
}

export function previewFor(s, pts, live) {
  let pv = cache.get(s.id);
  if (!pv) cache.set(s.id, (pv = make()));
  if (!pts || !pts.length) { pv.path = null; pv.n = 0; return null; }
  const now = performance.now();
  if (pv.path !== pts || pv.last !== pts[pts.length - 1]) {
    // While drawing, keep the old preview for a moment rather than re-sailing on every finger move.
    if (!(live && pv.path === pts && now - pv.at < 80)) compute(pv, s, pts, now);
    return pv;
  }
  // Walk forward to the predicted point nearest the ship.
  let best = pv.idx, bd = Infinity;
  for (let i = pv.idx, end = Math.min(pv.n, pv.idx + 40); i < end; i++) {
    const d = Math.hypot(pv.xy[i * 2] - s.x, pv.xy[i * 2 + 1] - s.y);
    if (d < bd) { bd = d; best = i; }
  }
  pv.idx = best;
  if (!live && bd > 36 && now - pv.at > 600) compute(pv, s, pts, now);
  return pv;
}

export const forgetPreviews = () => cache.clear();
