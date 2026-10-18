import { S, afloat, shipById, unitById } from '../state.js';
import { COL, FONT, PI, TAU, clamp } from '../util.js';
import { CAPTURE_TIME } from '../config/ships.js';
import { projTo, proj, pxPerUnit, scratchA, scratchB, cam } from '../render/camera.js';
import { previewFor } from './preview.js';
import { commandable, haptic, tapFx } from './orders.js';
import { shipMeshes, fortTopZ } from '../render/scene.js';
import { sideDir } from '../sim/combat.js';
import { EXIT_BAND } from '../sim/battle.js';
import { goalLines, eachGoal, hasGoalFlag } from '../sim/goals/index.js';
import { landingFor } from '../sim/forts.js';
import { boardingTarget, defence } from '../sim/boarding.js';
import { AMMO, BOARDING } from '../config/ammo.js';
import { R } from '../render/gl.js';
import { save, writeSave } from '../save.js';

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

// Broadside arcs for the selected ship as thin lines: the arc's edges, its rim, and a gold sweep along the rim
// as the guns reload (solid gold when they're ready). The camera is close now, so no filled wedges.
function drawArcs(s) {
  const SPREAD = 0.62;
  for (let side = 0; side < 2; side++) {
    const dir = sideDir(s, side), rad = s.range;
    const prog = clamp(1 - s.reload[side] / s.reloadTime, 0, 1);
    ctx.beginPath();
    seaTo(s.x + Math.cos(dir - SPREAD) * s.L * 0.45, s.y + Math.sin(dir - SPREAD) * s.L * 0.45, true);
    for (let i = 0; i <= 20; i++) { const a = dir - SPREAD + (2 * SPREAD * i) / 20; seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, false); }
    seaTo(s.x + Math.cos(dir + SPREAD) * s.L * 0.45, s.y + Math.sin(dir + SPREAD) * s.L * 0.45, false);
    ctx.setLineDash([3, 7]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.stroke(); ctx.setLineDash([]);
    if (prog > 0.02) {
      ctx.beginPath();
      const n = Math.max(2, Math.round(20 * prog));
      for (let i = 0; i <= n; i++) { const a = dir - SPREAD + (2 * SPREAD * prog * i) / n; seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, i === 0); }
      ctx.lineCap = 'round'; ctx.lineWidth = prog >= 1 ? 2.4 : 1.6;
      ctx.strokeStyle = prog >= 1 ? 'rgba(242,182,50,0.9)' : 'rgba(255,255,255,0.4)'; ctx.stroke();
    }
  }
}

// The course preview: the track she will really sail, as a soft ribbon on the water with a small end marker.
// Past the preview's horizon the rest of the drawn course shows as a faint dotted line.
const CREAM = '255,248,230';
function drawCourse(s, pts, selected, live) {
  const pv = previewFor(s, pts, live);
  if (!pv || pv.n < 2) return;
  const xy = pv.xy, k = pxPerUnit(s.x, s.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  seaTo(s.x, s.y, true);
  for (let i = pv.idx + 1; i < pv.n; i++) seaTo(xy[i * 2], xy[i * 2 + 1], false);
  ctx.lineWidth = Math.max(7, s.B * 0.85 * k); ctx.strokeStyle = `rgba(${CREAM},${selected ? 0.17 : 0.09})`; ctx.stroke();
  ctx.lineWidth = selected ? 1.6 : 1.2; ctx.strokeStyle = `rgba(${CREAM},${selected ? 0.8 : 0.4})`; ctx.stroke();
  let ex = xy[(pv.n - 1) * 2], ey = xy[(pv.n - 1) * 2 + 1];
  const rest = Math.min(pv.rest, pts.length);
  if (!pv.done && rest > 0) {
    ctx.beginPath();
    seaTo(ex, ey, true);
    for (let i = pts.length - rest; i < pts.length; i++) seaTo(pts[i].x, pts[i].y, false);
    ctx.setLineDash([1.5, 7]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${CREAM},${selected ? 0.55 : 0.28})`; ctx.stroke(); ctx.setLineDash([]);
    ex = pts[pts.length - 1].x; ey = pts[pts.length - 1].y;
  }
  seaCircle(ex, ey, 9, 18);
  ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${CREAM},${selected ? 0.9 : 0.45})`; ctx.stroke();
  const q = projTo(ex, ey, 0.5);
  ctx.beginPath(); ctx.arc(q.x, q.y, selected ? 2.6 : 2, 0, TAU); ctx.fillStyle = `rgba(${CREAM},${selected ? 0.95 : 0.5})`; ctx.fill();
}

// The finger's own line while drawing, faint, so you can see how the ship will round it off.
function drawStroke(pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) seaTo(pts[i].x, pts[i].y, i === 0);
  ctx.setLineDash([1, 9]); ctx.lineCap = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${CREAM},0.45)`; ctx.stroke(); ctx.setLineDash([]);
}

// Engage orders: a thin red ring under each target, with ticks for the selected ship's own.
function drawEngage(sel) {
  for (const s of S.G.ships) {
    if (!commandable(s) || !s.order || s.order.kind !== 'engage') continue;
    const t = unitById(s.order.targetId);
    if (!t) continue;
    const mine = s === sel, rr = t.kind === 'fort' ? S.G.islands[t.island].r * 1.15 : t.L * 0.72;
    seaCircle(t.x, t.y, rr, 40);
    ctx.lineWidth = mine ? 1.8 : 1.2; ctx.strokeStyle = mine ? 'rgba(255,120,100,0.9)' : 'rgba(255,120,100,0.45)'; ctx.stroke();
    if (!mine) continue;
    const a0 = S.clock * 0.6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * PI / 2;
      seaTo(t.x + Math.cos(a) * rr * 1.1, t.y + Math.sin(a) * rr * 1.1, true);
      seaTo(t.x + Math.cos(a) * rr * 1.35, t.y + Math.sin(a) * rr * 1.35, false);
    }
    ctx.lineWidth = 2; ctx.stroke();
  }
}

// A ripple where a tap gave an order.
function drawTapFx() {
  const age = S.clock - tapFx.t;
  if (age < 0 || age > 0.6) return;
  const k = age / 0.6;
  seaCircle(tapFx.x, tapFx.y, (tapFx.kind === 'engage' ? 30 : 8) + k * 26, 24);
  ctx.lineWidth = 2 * (1 - k) + 0.5;
  ctx.strokeStyle = tapFx.kind === 'engage' ? `rgba(255,120,100,${1 - k})` : `rgba(${CREAM},${1 - k})`;
  ctx.stroke();
}

// Enemies off screen: small red chevrons on the screen edge, pointing at them.
function drawChevrons() {
  const { cw, ch } = S.view, G = S.G;
  const m = 16, cx = cw / 2, cy = ch / 2;
  for (const s of G.ships) {
    if (s.team === 'player' || !afloat(s) || s.hidden) continue;
    const q = projTo(s.x, s.y, 8);
    if (q.x > -4 && q.x < cw + 4 && q.y > -4 && q.y < ch + 4) continue;
    const dx = q.x - cx, dy = q.y - cy;
    const k = Math.min((cw / 2 - m) / Math.max(1e-3, Math.abs(dx)), (ch / 2 - m) / Math.max(1e-3, Math.abs(dy)));
    const x = cx + dx * k, y = cy + dy * k, a = Math.atan2(dy, dx), r = s.boss ? 9 : 7;
    const far = Math.hypot(dx, dy) / Math.hypot(cw, ch);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = clamp(1.25 - far * 0.6, 0.5, 1);
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.85); ctx.lineTo(-r * 0.25, 0); ctx.lineTo(-r * 0.7, r * 0.85); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4;
    ctx.fillStyle = s.boss ? '#ff4636' : '#e2483a'; ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Heading dial for an anchored ship: a thin ring plus an arrow toward where she's turning.
function drawPivot(s, active) {
  const rr = s.L * 0.8;
  seaCircle(s.x, s.y, rr, 40);
  ctx.lineWidth = active ? 2 : 1.4; ctx.strokeStyle = active ? COL.gold : `rgba(${CREAM},0.65)`; ctx.stroke();
  const a = s.pivot, tip = s.L * 1.45, c = Math.cos(a), sn = Math.sin(a);
  const at = (d, side, o) => projTo(s.x + c * d - sn * side, s.y + sn * d + c * side, 0.5, o);
  const r0 = at(rr, 0, scratchA);
  ctx.beginPath(); ctx.moveTo(r0.x, r0.y);
  const t = at(tip, 0, scratchB); ctx.lineTo(t.x, t.y);
  ctx.lineWidth = active ? 2.5 : 1.8; ctx.strokeStyle = active ? COL.gold : `rgba(${CREAM},0.85)`; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(t.x, t.y);
  const b1 = at(tip - 14, -8, scratchA); ctx.lineTo(b1.x, b1.y);
  const b2 = at(tip - 14, 8, scratchA); ctx.lineTo(b2.x, b2.y);
  ctx.closePath(); ctx.fillStyle = active ? COL.gold : `rgba(${CREAM},0.9)`; ctx.fill();
}

function drawRing(s) {
  seaCircle(s.x, s.y, s.L * 0.62, 40);
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = -S.clock * 20; ctx.lineWidth = 2.2; ctx.strokeStyle = COL.gold; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

const hpColour = (k) => (k > 0.6 ? '#6fd36a' : k > 0.3 ? COL.gold : '#ff5a4a');

function drawBars(s) {
  if (!afloat(s) || s.hidden) return;
  const m = shipMeshes.get(s.id);
  const top = projTo(s.x, s.y, (m ? m.top : 40) + 12);
  const tx = top.x, y = top.y;
  const w = Math.max(26, s.L * 0.62 * pxPerUnit(s.x, s.y)), x = tx - w / 2;
  const k = s.hp / s.maxHp;
  ctx.fillStyle = 'rgba(20,30,40,0.6)'; roundRect(x - 1.5, y - 1.5, w + 3, 8, 4); ctx.fill();
  ctx.fillStyle = s.boss ? '#e2483a' : hpColour(k);
  roundRect(x, y, Math.max(2, w * k), 5, 2.5); ctx.fill();
  if (s.fireship) outlinedText('Fireship!', tx, y + 15, 11, '#ffb27a', 'center');
  else if (s.flag) outlinedText('★ Flagship', tx, y + 15, 11, '#ffe08a', 'center');
  else if (s.escort) outlinedText('Escort', tx, y + 15, 11, '#f4e3b8', 'center');
  else if (s.slowT > 0) outlinedText('Rigging cut', tx, y + 15, 11, '#ffd6cf', 'center');
  else if (s.prize) outlinedText('Prize', tx, y + 15, 11, '#bfe3ff', 'center');
}

// Two ships lashed together: a progress ring between them while the boarders fight it out.
function drawBoarding(s) {
  const e = shipById(s.boarding.targetId);
  if (!e) return;
  const q = projTo((s.x + e.x) / 2, (s.y + e.y) / 2, 30);
  const qx = q.x, qy = q.y;
  const k = clamp(s.boarding.t / BOARDING.time, 0, 1);
  outlinedText(`Boarding! ${s.marines} vs ${defence(e)}`, qx, qy - 30, 15, '#ffe08a', 'center');
  ctx.beginPath(); ctx.arc(qx, qy - 8, 10, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,40,60,0.6)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(qx, qy - 8, 10, -PI / 2, -PI / 2 + TAU * k); ctx.strokeStyle = COL.gold; ctx.stroke();
}

// Damage numbers rise and fade off whatever was hit; hits on the English show in red.
function drawFloaters() {
  const fl = S.floaters;
  for (let i = fl.length - 1; i >= 0; i--) {
    const f = fl[i], age = S.clock - f.born;
    if (age > 1.1) { fl.splice(i, 1); continue; }
    const q = projTo(f.x, f.y, 60 + age * 40);
    const size = Math.min(26, 14 + f.value * 0.5);
    ctx.globalAlpha = clamp((1.1 - age) * 3, 0, 1);
    const pop = age < 0.12 ? 1 + (0.12 - age) * 3 : 1;
    ctx.save(); ctx.translate(q.x + Math.sin(f.born * 13) * 10, q.y); ctx.scale(pop, pop);
    outlinedText(`-${Math.round(f.value)}`, 0, 0, size, f.team === 'player' ? '#ff8a7a' : '#fff1b0', 'center');
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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

// One-time tips: the first time a mechanic shows up in battle, say how to use it. Remembered in the save.
const TIPS = {
  fleet: 'Tap Whole fleet, then drag one course (or tap an enemy) to order every ship at once.',
  ammo: 'This ship carries special shot: tap Shot to switch. Chain cuts rigging; Grape thins the crew before you board.',
  mine: 'Tap Mine to leave a mine astern. Lure an enemy across it.',
  land: 'Tap Land: your ship anchors and the boats row ashore.',
  board: 'She’s crippled! Tap Board to send your marines across. More marines than defenders wins.',
  fireship: 'A fireship! She explodes when she touches you. Sink her at range or steer clear.',
  mortar: 'A red ring marks where a mortar shell will land. Sail out of it!',
  exit: 'Get through the green dashed line at the top of the chart.',
  chest: 'Sail over the gold rings to haul the treasure chests aboard.',
  fog: 'Fog! You only see ships near your own. Keep the fleet together.',
};
let tip = null;
function offerTip(id) {
  save.tips = save.tips || [];
  if (tip || save.tips.includes(id) || S.G.tut) return;
  save.tips.push(id);
  writeSave();
  tip = { text: TIPS[id], until: S.clock + 6.5 };
}
function drawTip() {
  if (!tip) return;
  if (S.clock > tip.until) { tip = null; return; }
  const { cw, ch } = S.view;
  const w = Math.min(cw - 32, 360), x = (cw - w) / 2;
  ctx.globalAlpha = clamp(Math.min((tip.until - S.clock) * 2, 1), 0, 1);
  ctx.font = `600 14px "Nunito", "Trebuchet MS", sans-serif`;
  const lines = wrap(tip.text, w - 28);
  const h = 22 + lines.length * 19;
  const y = Math.round((S.hud.actions.length ? S.hud.actions[0].y : ch) - 14 - h); // just above the action bar
  ctx.fillStyle = COL.parchment; roundRect(x, y, w, h, 14); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((ln, i) => ctx.fillText(ln, x + 14, y + 11 + i * 19));
  ctx.globalAlpha = 1;
}
function wrap(text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
export const resetTip = () => { tip = null; };

// The exit band at the top of the chart (the right edge in landscape) for escorts and breakthroughs.
function drawExit() {
  const G = S.G, n = 24, pulse = 0.55 + 0.25 * Math.sin(S.clock * 3);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    if (G.land) seaTo(G.W - EXIT_BAND, k * G.H, i === 0); else seaTo(k * G.W, EXIT_BAND, i === 0);
  }
  ctx.setLineDash([14, 10]); ctx.lineDashOffset = S.clock * 24;
  ctx.lineWidth = 4; ctx.strokeStyle = `rgba(140,230,130,${pulse})`; ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  const q = G.land ? projTo(G.W - EXIT_BAND * 0.45, G.H * 0.5, 4) : projTo(G.W * 0.5, EXIT_BAND * 0.45, 4);
  outlinedText(G.land ? 'EXIT ›' : '︿ EXIT ︿', q.x, q.y, 14, '#c6f5b8', 'center');
}

// Mortar shells in flight: a pulsing red ring where each will land.
function drawShellTargets() {
  for (const b of S.balls) {
    if (b.kind !== 'shell') continue;
    const k = Math.min(1, b.u), r = b.radius * (0.55 + 0.45 * k);
    seaCircle(b.tx, b.ty, r, 28);
    ctx.fillStyle = b.team === 'enemy' ? `rgba(255,70,50,${0.1 + 0.2 * k})` : `rgba(80,160,255,${0.1 + 0.2 * k})`; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = b.team === 'enemy' ? '#ff5a4a' : '#6fc0ff'; ctx.stroke();
  }
}

// Floating treasure: a gold marker over each chest still in the water.
function drawChests() {
  for (const c of S.G.chests) {
    if (c.taken) continue;
    seaCircle(c.x, c.y, 15 + Math.sin(S.clock * 4 + c.x) * 2.5, 20);
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,214,90,0.85)'; ctx.stroke();
  }
}

export function drawHUD() {
  const { cw, ch, dpr } = S.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const hud = S.hud;
  hud.cards = []; hud.pause = null; hud.recentre = null; hud.actions.length = 0;
  const G = S.G;
  if (!G || !R.renderer) return;
  // A ship is always selected: if yours goes down (or is taken), the next one in the line steps up.
  if (!commandable(S.selected)) S.selected = G.ships.find(commandable) || S.selected;
  const sel = commandable(S.selected) ? S.selected : null;
  if (G.phase === 'play') feel(sel);

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
    const dr = S.drag;
    for (const s of G.ships) {
      if (s.team !== 'player' || !afloat(s)) continue;
      const live = !!(dr && dr.ship === s && dr.mode === 'course' && dr.pts.length);
      if (live) drawStroke(dr.pts);
      drawCourse(s, live ? dr.pts : s.path, s === sel || S.selectAll, live);
    }
    drawEngage(sel);
    drawTapFx();
    for (const s of G.ships) if (s.team === 'player' && afloat(s) && s.pivot != null) drawPivot(s, dr && dr.mode === 'rotate' && (dr.ship === s || (dr.fleet && commandable(s))));
    if (S.selectAll) { for (const s of G.ships) if (s.team === 'player' && afloat(s) && !s.escort) drawRing(s); }
    else if (sel) drawRing(sel);
    for (const s of G.ships) if (s.boarding && s.boarding.attacker) drawBoarding(s);
  }
  if (hasGoalFlag(G, 'exit')) drawExit();
  if (G.chests && G.chests.length) drawChests();
  drawShellTargets();
  if (G.phase === 'play' && G.t > 1.5) {
    eachGoal(G, 'tip', (g) => offerTip(g.tip));
    if (G.fog) offerTip('fog');
    if (S.balls.some((b) => b.kind === 'shell' && b.team === 'enemy')) offerTip('mortar');
    if (G.ships.some((s) => s.fireship && afloat(s) && !s.hidden)) offerTip('fireship');
  }
  for (const s of G.ships) drawBars(s);
  for (const f of G.forts) drawFort(f);
  if (G.phase === 'title') return;
  drawFloaters();
  if (G.phase === 'play') drawChevrons();

  // Fleet cards (tap to select)
  let y = 10;
  const x = 10, w = 132, h = 32;
  for (const s of G.ships) {
    if (s.team !== 'player' && s.origTeam !== 'player') continue;
    const alive = afloat(s) && s.team === 'player'; // a ship taken by Spanish boarders is lost to you
    const safe = s.state === 'escaped';
    ctx.fillStyle = s.escort ? 'rgba(92,70,40,0.78)' : COL.hud; roundRect(x, y, w, h, 10); ctx.fill();
    if (s === sel || (S.selectAll && alive)) { ctx.lineWidth = 2.5; ctx.strokeStyle = COL.gold; ctx.stroke(); }
    ctx.font = `15px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = alive || safe ? COL.white : 'rgba(255,255,255,0.45)';
    ctx.fillText(s.flag ? `★ ${s.name}` : s.name, x + 10, y + 12);
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillStyle = safe ? '#9fe08a' : alive ? 'rgba(255,255,255,0.7)' : '#ff8a7a';
    ctx.fillText(safe ? 'Through!' : alive ? (s.escort ? 'Escort' : s.label) : afloat(s) ? 'Captured' : 'Sunk', x + w - 10, y + 12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(x + 10, y + 21, w - 20, 5, 2.5); ctx.fill();
    const k = s.hp / s.maxHp;
    if (k > 0) { ctx.fillStyle = hpColour(k); roundRect(x + 10, y + 21, Math.max(3, (w - 20) * k), 5, 2.5); ctx.fill(); }
    if (!s.escort) hud.cards.push({ x, y, w, h, ship: s }); // merchantmen can't be given orders
    y += h + 6;
  }
  // Fleet orders: select every ship, then one drawn course moves the whole squadron.
  if (G.ships.filter((s) => s.team === 'player' && afloat(s) && !s.escort).length > 1) {
    if (G.phase === 'play' && G.t > 3) offerTip('fleet');
    ctx.fillStyle = S.selectAll ? 'rgba(242,182,50,0.92)' : COL.hud; roundRect(x, y, w, 26, 10); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = S.selectAll ? COL.ink : 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = S.selectAll ? COL.ink : COL.white;
    ctx.fillText('Whole fleet', x + w / 2, y + 13);
    hud.cards.push({ x, y, w, h: 26, fleet: true });
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
  goalLines(G).forEach((t, i) => outlinedText(t, wxs + wr, wys + wr + 28 + i * 18, 14, '#ffd6cf', 'right'));

  const playing = G.phase === 'play';
  if (sel && playing) drawActionBar(sel);
  // The camera is in your hands: a small button (or a double-tap on the sea) gives it back to the director.
  if (playing && cam.mode === 'manual') {
    const r = 19, x = cw - 14 - r, y = (hud.actions.length ? hud.actions[0].y : ch - 14) - 14 - r;
    ctx.fillStyle = 'rgba(12,30,44,0.58)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#f4ead2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 9); ctx.moveTo(x, y + 9); ctx.lineTo(x, y + 12);
    ctx.moveTo(x - 12, y); ctx.lineTo(x - 9, y); ctx.moveTo(x + 9, y); ctx.lineTo(x + 12, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fillStyle = '#f4ead2'; ctx.fill();
    hud.recentre = { x, y, r: r + 6 };
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

  if (playing) drawTip();

  // First-time hint (the tutorial has its own coach)
  if (playing && !G.tut && !G.dragged && G.t < 14) {
    ctx.globalAlpha = clamp(Math.min(G.t * 2, 14 - G.t), 0, 1);
    const hy = (hud.actions.length ? hud.actions[0].y : ch) - 22;
    outlinedText('Drag on the sea to set a course · tap an enemy to engage', cw / 2, hy, Math.min(15, cw / 26), COL.white, 'center');
    ctx.globalAlpha = 1;
  }
}

// ---------- Action bar ----------
// A compact row of buttons for the selected ship, bottom centre: Anchor, Fire port / starboard (manual
// gunnery), shot type, Mine, Board and Land, each only when it applies. Hit targets are at least 50 x 50.
const UI_FONT = '"Nunito", "Trebuchet MS", system-ui, sans-serif';
const ICON = '#f4ead2';
const pool = [];
function act(kind, label, w) {
  const a = pool[S.hud.actions.length] || (pool[S.hud.actions.length] = {});
  a.kind = kind; a.label = label; a.w = w; a.h = 50; a.x = 0; a.y = 0; a.on = false; a.ready = true; a.prog = -1;
  a.side = 0; a.shipId = null; a.fortId = null; a.sub = null;
  S.hud.actions.push(a);
  return a;
}

function drawActionBar(sel) {
  const { cw, ch } = S.view, hud = S.hud, manual = S.fireMode === 'manual';
  if (manual) {
    const a = act('fire', 'Port', 62); a.side = 0;
    a.ready = sel.reload[0] <= 0; a.prog = clamp(1 - sel.reload[0] / sel.reloadTime, 0, 1);
  }
  const an = act('anchor', sel.pivot != null ? 'Weigh' : 'Anchor', 54); an.on = sel.pivot != null;
  if (sel.ammoKinds.length > 1 && !S.selectAll) { act('ammo', AMMO[sel.ammo].short, 54); offerTip('ammo'); }
  if (sel.mines > 0) { act('mine', `Mine ×${sel.mines}`, 58); offerTip('mine'); }
  const prey = boardingTarget(sel);
  if (prey) {
    const d = defence(prey), a = act('board', 'Board', 58);
    a.shipId = prey.id; a.ready = sel.marines > d; a.sub = `${sel.marines} v ${d}`; a.on = a.ready;
    offerTip('board');
  }
  const fort = landingFor(sel);
  if (fort) {
    const busy = !!fort.capture, ok = sel.marines >= fort.need && !busy, a = act('land', busy ? 'Landing' : 'Land', 58);
    a.fortId = fort.id; a.ready = ok; a.on = ok; a.sub = busy ? null : ok ? `${fort.need} men` : `need ${fort.need}`;
    offerTip('land');
  }
  if (manual) {
    const a = act('fire', 'Starboard', 62); a.side = 1;
    a.ready = sel.reload[1] <= 0; a.prog = clamp(1 - sel.reload[1] / sel.reloadTime, 0, 1);
  }
  const gap = 8, list = hud.actions;
  let total = -gap;
  for (const a of list) total += a.w + gap;
  let x = Math.round((cw - total) / 2);
  const y = ch - 14 - 50;
  for (const a of list) { a.x = x; a.y = y; x += a.w + gap; drawAction(a, sel); }
}

function drawAction(a, sel) {
  const { x, y, w, h } = a;
  ctx.globalAlpha = a.ready ? 1 : 0.6;
  ctx.fillStyle = a.on ? 'rgba(242,182,50,0.94)' : 'rgba(12,30,44,0.6)';
  roundRect(x, y, w, h, 14); ctx.fill();
  if (a.prog >= 0 && a.prog < 1) {
    ctx.save(); roundRect(x, y, w, h, 14); ctx.clip();
    ctx.fillStyle = 'rgba(242,182,50,0.3)'; ctx.fillRect(x, y + h * (1 - a.prog), w, h * a.prog);
    ctx.restore();
  } else if (a.prog >= 1) { ctx.fillStyle = 'rgba(242,182,50,0.94)'; roundRect(x, y, w, h, 14); ctx.fill(); }
  const lit = a.on || a.prog >= 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 13.5);
  ctx.lineWidth = 1; ctx.strokeStyle = lit ? 'rgba(255,244,214,0.95)' : 'rgba(255,255,255,0.16)'; ctx.stroke();
  const c = lit ? COL.ink : ICON;
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawIcon(a, x + w / 2, y + 19, sel);
  ctx.font = `700 ${a.label.length > 7 ? 9.5 : 10.5}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = c;
  ctx.fillText(a.sub || a.label, x + w / 2, y + 38);
  ctx.globalAlpha = 1;
}

function drawIcon(a, cx, cy, sel) {
  ctx.beginPath();
  switch (a.kind) {
    case 'anchor':
      ctx.arc(cx, cy - 7, 2.6, 0, TAU);
      ctx.moveTo(cx, cy - 4.4); ctx.lineTo(cx, cy + 8);
      ctx.moveTo(cx - 5, cy - 1.5); ctx.lineTo(cx + 5, cy - 1.5);
      ctx.moveTo(cx - 8, cy + 2); ctx.quadraticCurveTo(cx - 6, cy + 8, cx, cy + 8); ctx.quadraticCurveTo(cx + 6, cy + 8, cx + 8, cy + 2);
      ctx.stroke(); return;
    case 'fire': {
      const d = a.side === 0 ? -1 : 1;
      ctx.moveTo(cx - 9 * d, cy); ctx.lineTo(cx + 7 * d, cy);
      ctx.moveTo(cx + 2 * d, cy - 5); ctx.lineTo(cx + 7 * d, cy); ctx.lineTo(cx + 2 * d, cy + 5);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - 9 * d, cy, 2.4, 0, TAU); ctx.fill(); return;
    }
    case 'ammo':
      if (sel.ammo === 'chain') {
        ctx.arc(cx - 6, cy, 3, 0, TAU); ctx.moveTo(cx + 9, cy); ctx.arc(cx + 6, cy, 3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.quadraticCurveTo(cx, cy + 4, cx + 3, cy); ctx.stroke();
      } else if (sel.ammo === 'grape') {
        for (const [ox, oy] of GRAPE) { ctx.moveTo(cx + ox + 2, cy + oy); ctx.arc(cx + ox, cy + oy, 2, 0, TAU); }
        ctx.fill();
      } else { ctx.arc(cx, cy, 5, 0, TAU); ctx.fill(); }
      return;
    case 'mine':
      ctx.arc(cx, cy, 4.5, 0, TAU); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const t = i * PI / 4; ctx.moveTo(cx + Math.cos(t) * 5, cy + Math.sin(t) * 5); ctx.lineTo(cx + Math.cos(t) * 8, cy + Math.sin(t) * 8); }
      ctx.stroke(); return;
    case 'board':
      ctx.moveTo(cx - 7, cy + 7); ctx.lineTo(cx + 7, cy - 7); ctx.moveTo(cx + 7, cy + 7); ctx.lineTo(cx - 7, cy - 7);
      ctx.moveTo(cx - 7, cy + 2); ctx.lineTo(cx - 2, cy + 7); ctx.moveTo(cx + 7, cy + 2); ctx.lineTo(cx + 2, cy + 7);
      ctx.stroke(); return;
    case 'land':
      ctx.moveTo(cx - 5, cy + 8); ctx.lineTo(cx - 5, cy - 8);
      ctx.moveTo(cx - 9, cy + 8); ctx.lineTo(cx + 3, cy + 8);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - 8); ctx.lineTo(cx + 7, cy - 4.5); ctx.lineTo(cx - 5, cy - 1); ctx.closePath(); ctx.fill();
      return;
  }
}
const GRAPE = [[-4, -3], [2, -4], [5, 1], [-1, 1], [-5, 3], [1, 5]];

// Haptic ticks for the selected ship: a tiny one when she fires, a firmer one when she's hit.
const fb = { id: -1, hp: 0, r0: 0, r1: 0, hitT: -9 };
function feel(sel) {
  if (!sel) { fb.id = -1; return; }
  if (fb.id === sel.id) {
    if (sel.hp < fb.hp - 0.5 && S.clock - fb.hitT > 0.25) { haptic(18); fb.hitT = S.clock; }
    else if (sel.reload[0] > fb.r0 + 0.5 || sel.reload[1] > fb.r1 + 0.5) haptic(7);
  }
  fb.id = sel.id; fb.hp = sel.hp; fb.r0 = sel.reload[0]; fb.r1 = sel.reload[1];
}
