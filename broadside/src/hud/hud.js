import { S, afloat, shipById } from '../state.js';
import { COL, FONT, PI, TAU, clamp } from '../util.js';
import { CAPTURE_TIME } from '../config/ships.js';
import { projTo, proj, pxPerUnit, scratchA, scratchB } from '../render/camera.js';
import { shipMeshes, fortTopZ } from '../render/scene.js';
import { sideDir } from '../sim/combat.js';
import { landingFor } from '../sim/forts.js';
import { R } from '../render/gl.js';

// The 2D layer over the 3D sea: courses, arcs, health bars, fleet cards, wind, buttons and messages.
const hudCv = document.getElementById('hud');
const ctx = hudCv.getContext('2d');
export const hudCanvas = hudCv;

export function sizeHud() {
  const { cw, ch, dpr } = S.view;
  hudCv.width = Math.round(cw * dpr); hudCv.height = Math.round(ch * dpr);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One vertex of a path laid on the sea surface, without building point arrays.
function seaTo(x, y, first) {
  const q = projTo(x, y, 0.5);
  if (first) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
}
function seaCircle(cx, cy, rr, n) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; seaTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, i === 0); }
}

function wedge(s, dir, rad) {
  ctx.beginPath();
  seaTo(s.x, s.y, true);
  for (let i = 0; i <= 16; i++) { const a = dir - 0.62 + (1.24 * i) / 16; seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, false); }
  ctx.closePath();
}

// Broadside arcs for the selected ship; they fill up as the guns reload.
function drawArcs(s) {
  for (let side = 0; side < 2; side++) {
    const dir = sideDir(s, side);
    const prog = clamp(1 - s.reload[side] / s.reloadTime, 0, 1);
    wedge(s, dir, s.range);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.setLineDash([6, 8]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke(); ctx.setLineDash([]);
    if (prog > 0.02) {
      wedge(s, dir, s.range * prog);
      ctx.fillStyle = prog >= 1 ? 'rgba(242,182,50,0.22)' : 'rgba(255,255,255,0.1)'; ctx.fill();
    }
  }
}

function drawPath(s, pts, active) {
  if (!pts.length) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  seaTo(s.x, s.y, true);
  for (let i = 0; i < pts.length; i++) seaTo(pts[i].x, pts[i].y, false);
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,52,82,0.35)'; ctx.stroke();
  ctx.setLineDash([2, 11]); ctx.lineWidth = 4;
  ctx.strokeStyle = active ? COL.gold : 'rgba(255,255,255,0.85)'; ctx.stroke(); ctx.setLineDash([]);
  const last = pts[pts.length - 1], e = projTo(last.x, last.y, 0.5);
  ctx.strokeStyle = active ? COL.gold : COL.white; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 6); ctx.lineTo(e.x + 6, e.y + 6); ctx.moveTo(e.x + 6, e.y - 6); ctx.lineTo(e.x - 6, e.y + 6); ctx.stroke();
}

// Heading dial for an anchored ship: a ring plus an arrow toward where it's turning.
function drawPivot(s, active) {
  const rr = s.L * 0.85;
  seaCircle(s.x, s.y, rr, 40);
  ctx.lineWidth = active ? 4 : 2.5; ctx.strokeStyle = active ? COL.gold : 'rgba(255,255,255,0.7)'; ctx.stroke();
  const a = s.pivot, tip = s.L * 1.7, c = Math.cos(a), sn = Math.sin(a);
  const at = (d, side) => proj(s.x + c * d - sn * side, s.y + sn * d + c * side, 0.5);
  const t = at(tip, 0), b1 = at(tip - 20, -11), b2 = at(tip - 20, 11), r0 = at(rr, 0);
  ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(t.x, t.y);
  ctx.lineWidth = 5; ctx.strokeStyle = active ? COL.gold : COL.white; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
  ctx.fillStyle = active ? COL.gold : COL.white; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,52,82,0.6)'; ctx.stroke();
}

function drawRing(s) {
  seaCircle(s.x, s.y, s.L * 0.62, 40);
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.clock * 20; ctx.lineWidth = 3; ctx.strokeStyle = COL.gold; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

const hpColour = (k) => (k > 0.6 ? '#6fd36a' : k > 0.3 ? COL.gold : '#ff5a4a');

function drawBars(s) {
  if (!afloat(s)) return;
  const m = shipMeshes.get(s.id);
  const top = projTo(s.x, s.y, (m ? m.top : 40) + 12);
  const tx = top.x, y = top.y;
  const w = Math.max(26, s.L * 0.62 * pxPerUnit(s.x, s.y)), x = tx - w / 2;
  const k = s.hp / s.maxHp;
  ctx.fillStyle = 'rgba(20,30,40,0.6)'; roundRect(x - 1.5, y - 1.5, w + 3, 8, 4); ctx.fill();
  ctx.fillStyle = s.boss ? '#e2483a' : hpColour(k);
  roundRect(x, y, Math.max(2, w * k), 5, 2.5); ctx.fill();
}

function drawFort(f) {
  const q = projTo(f.x, f.y, fortTopZ + 14);
  const qx = q.x, qy = q.y;
  if (f.state === 'active') {
    const w = 52, x = qx - w / 2;
    ctx.fillStyle = 'rgba(20,30,40,0.6)'; roundRect(x - 1.5, qy - 1.5, w + 3, 8, 4); ctx.fill();
    ctx.fillStyle = f.team === 'player' ? '#6fc0ff' : '#ff6a5a';
    roundRect(x, qy, Math.max(2, (w * f.hp) / f.maxHp), 5, 2.5); ctx.fill();
  } else {
    outlinedText(f.capture ? 'Landing party ashore' : 'Silenced', qx, qy, 13, '#ffe7a8', 'center');
    if (f.capture) {
      const k = clamp(f.capture.t / CAPTURE_TIME, 0, 1);
      ctx.beginPath(); ctx.arc(qx, qy + 22, 11, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,40,60,0.6)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(qx, qy + 22, 11, -PI / 2, -PI / 2 + TAU * k); ctx.strokeStyle = COL.gold; ctx.stroke();
    }
  }
}

function outlinedText(text, x, y, size, color, align) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,40,60,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function pill(x, y, w, h, label, ready, prog) {
  ctx.fillStyle = COL.hud; roundRect(x, y, w, h, 14); ctx.fill();
  ctx.save(); roundRect(x, y, w, h, 14); ctx.clip();
  ctx.fillStyle = ready ? 'rgba(242,182,50,0.95)' : 'rgba(242,182,50,0.35)';
  ctx.fillRect(x, y, w * (prog == null ? (ready ? 1 : 0) : prog), h); ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; roundRect(x, y, w, h, 14); ctx.stroke();
  ctx.font = `${w < 130 ? 15 : 17}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ready ? COL.ink : COL.white;
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function drawBoss() {
  const b = S.G.ships.find((s) => s.boss && s.state !== 'sunk');
  if (!b) return;
  const { cw } = S.view;
  const x0 = 152, w = cw - 80 - x0;
  if (w < 110) return;
  ctx.fillStyle = 'rgba(48,18,20,0.82)'; roundRect(x0, 10, w, 42, 11); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#e2b13a'; ctx.stroke();
  ctx.font = `14px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe08a';
  ctx.fillText(b.boss.captain, x0 + 10, 23);
  ctx.font = `11px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,230,200,0.75)';
  if (w > 190) ctx.fillText(b.boss.title, x0 + w - 10, 23);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(x0 + 10, 34, w - 20, 8, 4); ctx.fill();
  const k = b.hp / b.maxHp;
  if (k > 0) { ctx.fillStyle = '#e2483a'; roundRect(x0 + 10, 34, Math.max(4, (w - 20) * k), 8, 4); ctx.fill(); }
}

function objectiveLines() {
  const G = S.G;
  const ships = G.ships.filter((s) => s.team === 'enemy' && afloat(s)).length;
  if (G.goal === 'capture') {
    const held = G.forts.filter((f) => f.team === 'player' && f.state === 'active').length;
    return [`Forts taken: ${held}/${G.forts.length}`, `Enemy ships: ${ships}`];
  }
  if (G.goal === 'boss') return ['Sink the boss', `Enemy ships: ${ships}`];
  return [`Enemy ships: ${ships}`];
}

export function drawHUD() {
  const { cw, ch, dpr } = S.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const hud = S.hud;
  hud.cards = []; hud.pause = null; hud.fire = []; hud.actions = [];
  const G = S.G;
  if (!G || !R.renderer) return;
  const sel = S.selected && afloat(S.selected) ? S.selected : null;

  if (G.phase !== 'title') {
    // Tutorial buoy
    if (G.tut && G.tut.step === 0 && G.buoy) {
      const pulse = 26 + Math.sin(S.clock * 4) * 4;
      seaCircle(G.buoy.x, G.buoy.y, pulse, 32);
      ctx.lineWidth = 4; ctx.strokeStyle = COL.gold; ctx.stroke();
      seaCircle(G.buoy.x, G.buoy.y, 8, 16); ctx.fillStyle = COL.gold; ctx.fill();
      const q = projTo(G.buoy.x, G.buoy.y, 26);
      outlinedText('Sail here', q.x, q.y, 15, '#ffe08a', 'center');
    }
    if (sel) drawArcs(sel);
    for (const s of G.ships) {
      if (s.team !== 'player' || !afloat(s)) continue;
      const live = S.drag && S.drag.ship === s && S.drag.pts.length;
      drawPath(s, live ? S.drag.pts : s.path, s === sel);
    }
    for (const s of G.ships) if (s.team === 'player' && afloat(s) && s.pivot != null) drawPivot(s, S.drag && S.drag.ship === s && S.drag.mode === 'rotate');
    if (sel) drawRing(sel);
  }
  for (const s of G.ships) drawBars(s);
  for (const f of G.forts) drawFort(f);
  if (G.phase === 'title') return;

  // Fleet cards (tap to select)
  let y = 10;
  const x = 10, w = 132, h = 32;
  for (const s of G.ships) {
    if (s.team !== 'player') continue;
    const alive = afloat(s);
    ctx.fillStyle = COL.hud; roundRect(x, y, w, h, 10); ctx.fill();
    if (s === sel) { ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold; ctx.stroke(); }
    ctx.font = `15px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = alive ? COL.white : 'rgba(255,255,255,0.45)';
    ctx.fillText(s.name, x + 10, y + 12);
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillStyle = alive ? 'rgba(255,255,255,0.7)' : '#ff8a7a';
    ctx.fillText(alive ? s.label : 'Sunk', x + w - 10, y + 12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(x + 10, y + 21, w - 20, 5, 2.5); ctx.fill();
    const k = s.hp / s.maxHp;
    if (k > 0) { ctx.fillStyle = hpColour(k); roundRect(x + 10, y + 21, Math.max(3, (w - 20) * k), 5, 2.5); ctx.fill(); }
    hud.cards.push({ x, y, w, h, ship: s });
    y += h + 6;
  }

  drawBoss();

  // Pause button
  const pr = 20, px = cw - 10 - pr, py = 10 + pr;
  ctx.fillStyle = COL.hud; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.white; ctx.fillRect(px - 6, py - 7, 4, 14); ctx.fillRect(px + 2, py - 7, 4, 14);
  hud.pause = { x: px, y: py, r: pr + 8 };
  // Wind rose: the arrow follows the wind as seen through the tilted camera.
  const wr = 27, wxs = cw - 10 - wr, wys = py + pr + 12 + wr;
  ctx.fillStyle = COL.parchment; ctx.strokeStyle = COL.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(wxs, wys, wr, 0, TAU); ctx.fill(); ctx.stroke();
  const c0 = projTo(G.W / 2, G.H / 2, 0, scratchA), c1 = projTo(G.W / 2 + Math.cos(G.wind.dir) * 50, G.H / 2 + Math.sin(G.wind.dir) * 50, 0, scratchB);
  ctx.save(); ctx.translate(wxs, wys); ctx.rotate(Math.atan2(c1.y - c0.y, c1.x - c0.x));
  ctx.fillStyle = '#4b8fd6'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(4, -10); ctx.lineTo(4, -4); ctx.lineTo(-17, -4); ctx.lineTo(-17, 4); ctx.lineTo(4, 4); ctx.lineTo(4, 10); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
  outlinedText('WIND', wxs, wys + wr + 11, 12, COL.white, 'center');
  objectiveLines().forEach((t, i) => outlinedText(t, wxs + wr, wys + wr + 28 + i * 18, 14, '#ffd6cf', 'right'));

  const playing = G.phase === 'play';
  // Manual fire buttons for the selected ship
  if (S.fireMode === 'manual' && sel && playing) {
    const bw = Math.min(150, (cw - 48) / 2), bh = 54, by = ch - 14 - bh;
    for (const b of [{ side: 0, label: 'Fire port', x: 16 }, { side: 1, label: 'Fire starboard', x: cw - 16 - bw }]) {
      const ready = sel.reload[b.side] <= 0;
      pill(b.x, by, bw, bh, ready ? b.label : 'Reloading', ready, clamp(1 - sel.reload[b.side] / sel.reloadTime, 0, 1));
      hud.fire.push({ x: b.x, y: by, w: bw, h: bh, side: b.side });
    }
  }

  // Action buttons for the selected ship: drop a mine, land troops at a silenced fort.
  if (sel && playing) {
    const acts = [];
    if (sel.mines > 0) acts.push({ kind: 'mine', label: `Drop mine ×${sel.mines}`, ready: true });
    const fort = landingFor(sel);
    if (fort) {
      const busy = !!fort.capture, ok = sel.marines >= fort.need && !busy;
      acts.push({ kind: 'land', fortId: fort.id, ready: ok, label: busy ? 'Landing…' : ok ? `Land troops (${fort.need})` : `Need ${fort.need} marines` });
    }
    const bw = 158, bh = 46, ax = cw - 16 - bw;
    let ay = ch - 14 - bh - (S.fireMode === 'manual' ? 64 : 0);
    for (const a of acts) {
      pill(ax, ay, bw, bh, a.label, a.ready);
      hud.actions.push({ x: ax, y: ay, w: bw, h: bh, ...a });
      ay -= bh + 10;
    }
  }

  // Small label over a ship (course cleared, anchored, landing party away)
  const toast = S.toast;
  if (toast && S.clock < toast.until) {
    const ts = shipById(toast.shipId);
    if (ts && afloat(ts)) {
      const m = shipMeshes.get(ts.id), q = projTo(ts.x, ts.y, (m ? m.top : 40) + 30);
      ctx.globalAlpha = clamp((toast.until - S.clock) * 3, 0, 1);
      outlinedText(toast.text, q.x, q.y - (1.2 - (toast.until - S.clock)) * 14, 15, COL.white, 'center');
      ctx.globalAlpha = 1;
    }
  }

  // Big centred messages: fort silenced, fort captured, boss beaten
  const bn = S.banner;
  if (bn && S.clock < bn.until) {
    const left = bn.until - S.clock;
    ctx.globalAlpha = clamp(Math.min(left * 2, 1), 0, 1);
    const by = ch * 0.34, pop = 1 + Math.max(0, 0.25 - (2.6 - left)) * 0.6;
    ctx.save(); ctx.translate(cw / 2, by); ctx.scale(pop, pop);
    outlinedText(bn.text, 0, 0, Math.min(30, cw / 14), '#ffe08a', 'center');
    if (bn.sub) outlinedText(bn.sub, 0, 30, 16, COL.white, 'center');
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // First-time hint (the tutorial has its own coach)
  if (playing && !G.tut && !G.dragged && G.t < 14) {
    ctx.globalAlpha = clamp(Math.min(G.t * 2, 14 - G.t), 0, 1);
    const hy = S.fireMode === 'manual' ? ch - 92 : ch - 34;
    outlinedText('Drag from a ship to draw its course', cw / 2, hy, 18, COL.white, 'center');
    ctx.globalAlpha = 1;
  }
}
