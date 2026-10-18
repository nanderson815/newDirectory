import { S, afloat, shipById } from '../state.js';
import { COL, FONT, PI, TAU, clamp } from '../util.js';
import { CAPTURE_TIME } from '../config/ships.js';
import { projTo, proj, pxPerUnit, scratchA, scratchB } from '../render/camera.js';
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

// One-time tips: the first time a mechanic shows up in battle, say how to use it. Remembered in the save.
const TIPS = {
  fleet: 'Tap Whole fleet, then draw one course to move every ship together.',
  ammo: 'This ship carries special shot. Chain cuts rigging; Grape thins the crew before you board.',
  mine: 'Tap Drop mine to leave a mine astern. Lure an enemy across it.',
  land: 'Tap Land troops: your ship anchors and the boats row ashore.',
  board: 'She’s crippled! Tap Board! to send your marines across. More marines than defenders wins.',
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
  const w = Math.min(cw - 32, 360), x = (cw - w) / 2, y = Math.round(ch * 0.62);
  ctx.globalAlpha = clamp(Math.min((tip.until - S.clock) * 2, 1), 0, 1);
  ctx.font = `600 14px "Nunito", "Trebuchet MS", sans-serif`;
  const lines = wrap(tip.text, w - 28);
  const h = 22 + lines.length * 19;
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
  hud.cards = []; hud.pause = null; hud.fire = []; hud.actions = []; hud.ammo = [];
  const G = S.G;
  if (!G || !R.renderer) return;
  const sel = S.selected && afloat(S.selected) && S.selected.team === 'player' ? S.selected : null;

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
    if (sel.mines > 0) { acts.push({ kind: 'mine', label: `Drop mine ×${sel.mines}`, ready: true }); offerTip('mine'); }
    const prey = boardingTarget(sel);
    if (prey) {
      const d = defence(prey);
      acts.push({ kind: 'board', shipId: prey.id, ready: sel.marines > d, label: `Board! ${sel.marines} vs ${d}` });
      offerTip('board');
    }
    const fort = landingFor(sel);
    if (fort) {
      const busy = !!fort.capture, ok = sel.marines >= fort.need && !busy;
      offerTip('land');
      acts.push({ kind: 'land', fortId: fort.id, ready: ok, label: busy ? 'Landing…' : ok ? `Land troops (${fort.need})` : `Need ${fort.need} marines` });
    }
    const bw = 158, bh = 46, ax = cw - 16 - bw;
    let ay = ch - 14 - bh - (S.fireMode === 'manual' ? 64 : 0);
    for (const a of acts) {
      pill(ax, ay, bw, bh, a.label, a.ready);
      hud.actions.push({ x: ax, y: ay, w: bw, h: bh, ...a });
      ay -= bh + 10;
    }
    // Shot selector, bottom left, for ships that carry more than round shot.
    if (sel.ammoKinds.length > 1 && !S.selectAll) {
      offerTip('ammo');
      const cwid = 62, chh = 38, cy = ch - 14 - chh - (S.fireMode === 'manual' ? 64 : 0);
      let cx = 16;
      outlinedText('Shot', cx + 2, cy - 12, 12, COL.white, 'left');
      for (const kind of sel.ammoKinds) {
        const on = sel.ammo === kind;
        ctx.fillStyle = on ? 'rgba(242,182,50,0.95)' : COL.hud; roundRect(cx, cy, cwid, chh, 12); ctx.fill();
        ctx.lineWidth = on ? 3 : 2; ctx.strokeStyle = on ? COL.ink : 'rgba(255,255,255,0.4)'; roundRect(cx, cy, cwid, chh, 12); ctx.stroke();
        ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = on ? COL.ink : COL.white; ctx.fillText(AMMO[kind].short, cx + cwid / 2, cy + chh / 2 + 1);
        hud.ammo.push({ x: cx, y: cy, w: cwid, h: chh, kind });
        cx += cwid + 6;
      }
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

  if (playing) drawTip();

  // First-time hint (the tutorial has its own coach)
  if (playing && !G.tut && !G.dragged && G.t < 14) {
    ctx.globalAlpha = clamp(Math.min(G.t * 2, 14 - G.t), 0, 1);
    const raised = S.fireMode === 'manual' || hud.ammo.length || hud.actions.length;
    const hy = raised ? ch - 100 : ch - 34;
    outlinedText('Drag from a ship to draw its course', cw / 2, hy, 18, COL.white, 'center');
    ctx.globalAlpha = 1;
  }
}
