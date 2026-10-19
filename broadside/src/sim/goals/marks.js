import { S, afloat } from '../../state.js';
import { EXIT_BAND } from '../battle.js';

// Chart markers that goals draw from their draw(o, G, api) hook. `api` is the HUD's drawing kit (see drawMarkers in
// src/hud/hud.js): ctx, seaTo, seaCircle, ring(x, y, r, colour, { dashed }), stroke(colour, { width, dash }) for the
// current path, label(text, x, y, colour) for a small quiet word, progress(x, y, k), projTo, proj, above(s),
// once(key), and the tokens as P (palette) and C (roles). Keep markers thin and words small: the HUD is quiet.

// The exit band at the top of the chart (the right edge in landscape), drawn once however many goals want it.
const DASH = [10, 9];
export function exitBand(G, api) {
  if (!api.once('exit')) return;
  const n = 24;
  api.ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    if (G.land) api.seaTo(G.W - EXIT_BAND, k * G.H, i === 0); else api.seaTo(k * G.W, EXIT_BAND, i === 0);
  }
  api.stroke(`rgba(159,211,143,${Math.round((0.6 + 0.2 * Math.sin(S.clock * 2.5)) * 50) / 50})`, { width: 2, dash: DASH, offset: S.clock * 18 });
  const q = G.land ? api.projTo(G.W - EXIT_BAND * 0.45, G.H * 0.5, 4) : api.projTo(G.W * 0.5, EXIT_BAND * 0.45, 4);
  api.label(G.land ? 'Exit ›' : 'Exit', q.x, q.y, api.P.greenHi, { size: 11 });
}

// A ring on the sea with a soft dark underlay, so it reads on bright and dark water alike.
export function ring(api, x, y, r, color, dashed) {
  api.ring(x, y, r, color, { dashed, width: 1.5 });
}

// A ring round a ship and a word over her health bar: who to guard, who to hunt.
export function shipMark(api, s, text, color, dashed) {
  if (!afloat(s) || s.hidden) return;
  ring(api, s.x, s.y, s.L * 0.72, color, dashed);
  const q = api.above(s);
  api.label(text, q.x, q.y - 9, color);
}
