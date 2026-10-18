import { S, afloat } from '../../state.js';
import { EXIT_BAND } from '../battle.js';

// Chart markers that goals draw from their draw(o, G, api) hook. `api` is the HUD's drawing kit (see drawHUD):
// ctx, seaTo, seaCircle, outlinedText, projTo, above(s), once(key), COL.

// The exit band at the top of the chart (the right edge in landscape), drawn once however many goals want it.
export function exitBand(G, api) {
  if (!api.once('exit')) return;
  const { ctx } = api, n = 24, pulse = 0.55 + 0.25 * Math.sin(S.clock * 3);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    if (G.land) api.seaTo(G.W - EXIT_BAND, k * G.H, i === 0); else api.seaTo(k * G.W, EXIT_BAND, i === 0);
  }
  ctx.setLineDash([14, 10]); ctx.lineDashOffset = S.clock * 24;
  ctx.lineWidth = 4; ctx.strokeStyle = `rgba(140,230,130,${pulse})`; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  const q = G.land ? api.projTo(G.W - EXIT_BAND * 0.45, G.H * 0.5, 4) : api.projTo(G.W * 0.5, EXIT_BAND * 0.45, 4);
  api.outlinedText(G.land ? 'EXIT ›' : '︿ EXIT ︿', q.x, q.y, 14, '#c6f5b8', 'center');
}

// A ring on the sea with a dark edge, so it reads on bright and dark water alike.
export function ring(api, x, y, r, color, dashed) {
  const { ctx } = api;
  api.seaCircle(x, y, r, 40);
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,40,60,0.45)'; ctx.stroke();
  if (dashed) { ctx.setLineDash([8, 7]); ctx.lineDashOffset = -S.clock * 16; }
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

// A ring round a ship and a word over her health bar: who to guard, who to hunt.
export function shipMark(api, s, text, color, dashed) {
  if (!afloat(s) || s.hidden) return;
  ring(api, s.x, s.y, s.L * 0.72 + Math.sin(S.clock * 4 + s.id) * 2, color, dashed);
  const q = api.above(s);
  api.outlinedText(text, q.x, q.y - 11, 12, color, 'center');
}
