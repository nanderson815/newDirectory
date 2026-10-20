import { S, afloat, shipById, unitById, selfSailing } from '../state.js';
import { COL, PI, TAU, clamp } from '../util.js';
import { CAPTURE_TIME } from '../config/ships.js';
import { projTo, proj, pxPerUnit, scratchA, scratchB, cam } from '../render/camera.js';
import { previewFor } from './preview.js';
import { commandable, haptic, tapFx } from './orders.js';
import {
  HUD as K, text, caption, measure, wrapText, button, iconButton, badge, bar, ring, banner, toast, tipCard,
  floater, windRose, edgeChevron, seaStroke, hpColor, life, tint, MARK,
} from './style.js';
import { drawIcon } from '../ui/icons.js';
import { COLOR as C, PALETTE as P, EASE, CANVAS_SHADOW, LINE } from '../ui/tokens.js';
import { shipMeshes, fortTopZ } from '../render/scene.js';
import { sideDir } from '../sim/combat.js';
import { sideLoad } from '../sim/guns.js';
import { goalLines, eachGoal } from '../sim/goals/index.js';
import { eachAbility } from '../sim/abilities/index.js';
import { landingFor } from '../sim/forts.js';
import { boardingTarget, defence } from '../sim/boarding.js';
import { AMMO, BOARDING } from '../config/ammo.js';
import { R } from '../render/gl.js';
import { save, writeSave } from '../save.js';

// The 2D layer over the 3D sea, drawn every frame with the HUD style kit (./style.js; docs/DESIGN.md, "Style"):
// a slim fleet dock, a pause button, the wind rose and a quiet objective line up top; the action bar for the
// selected ship at the bottom; thin lines on the water for courses, arcs and goal markers; small quiet labels
// over ships; damage numbers, toasts, banners and tips with eased motion. Hit rects for input.js go in S.hud.
const hudCv = document.getElementById('hud');
const ctx = hudCv.getContext('2d');
export const hudCanvas = hudCv;

// The HUD always draws at the device's full pixel ratio (up to 3), even when the 3D sea drops its resolution to
// keep the frame rate: text and hairlines stay crisp, and a 2D canvas this light costs little.
let dpr = 1;
// Safe-area insets (notch, home indicator), read from CSS env() through a hidden probe.
const ins = { t: 0, r: 0, b: 0, l: 0 };
let probe = null;
function readInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  ins.t = parseFloat(cs.paddingTop) || 0; ins.r = parseFloat(cs.paddingRight) || 0;
  ins.b = parseFloat(cs.paddingBottom) || 0; ins.l = parseFloat(cs.paddingLeft) || 0;
}
export function sizeHud() {
  const { cw, ch } = S.view;
  dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  hudCv.width = Math.round(cw * dpr); hudCv.height = Math.round(ch * dpr);
  readInsets();
}

// ---------- Lines on the sea ----------
// One vertex of a path laid on the sea surface, without building point arrays.
function seaTo(x, y, first) {
  const q = projTo(x, y, 0.5);
  if (first) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
}
function seaCircle(cx, cy, rr, n) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; seaTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, i === 0); }
}
const line = (a) => tint(MARK.line, a);
// A ring on the sea, as a thin line with a soft underlay. dashed: marching dashes.
function seaRing(x, y, r, color, { width = 1.5, dashed = false, n = 40 } = {}) {
  seaCircle(x, y, r, n);
  seaStroke(ctx, { color, width, dash: dashed ? DASH_RING : null, offset: dashed ? -S.clock * 14 : 0 });
}
const DASH_RING = [7, 6], DASH_RIM = [2, 6], DASH_DOT = [1.5, 7];

// Broadside arcs for the selected ship: only the rim at gun range (a fine dotted line with a short tick at each
// end), and a sweep along it as the guns reload, gold once they're ready. No wedges, no long radials. A great ship
// with batteries of different reach (long guns below, carronades above) gets a rim for each.
function drawArcs(s) {
  for (let side = 0; side < 2; side++) {
    const rims = new Map();
    for (const g of sideLoad(s, side)) rims.set(g.range, Math.min(rims.has(g.range) ? rims.get(g.range) : 1, g.k));
    for (const [rad, prog] of rims) drawRim(s, side, rad, prog);
  }
}
function drawRim(s, side, rad, prog) {
  const SPREAD = 0.62, N = 22;
  const dir = sideDir(s, side);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const a = dir - SPREAD + (2 * SPREAD * i) / N; seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, i === 0); }
  seaStroke(ctx, { color: line(0.34), width: 1, dash: DASH_RIM, under: 0.14 });
  ctx.beginPath();
  for (let e = -1; e <= 1; e += 2) {
    const a = dir + e * SPREAD;
    seaTo(s.x + Math.cos(a) * rad * 0.9, s.y + Math.sin(a) * rad * 0.9, true);
    seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, false);
  }
  seaStroke(ctx, { color: line(0.45), width: 1, under: 0.14 });
  if (prog > 0.02) {
    ctx.beginPath();
    const n = Math.max(2, Math.round(N * prog));
    for (let i = 0; i <= n; i++) { const a = dir - SPREAD + (2 * SPREAD * prog * i) / n; seaTo(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad, i === 0); }
    seaStroke(ctx, prog >= 1 ? { color: tint(MARK.chosen, 0.9), width: 1.75, under: 0.2 } : { color: line(0.6), width: 1.25, under: 0.16 });
  }
}

// The course preview: the track she will really sail, as a soft ribbon on the water with a small end marker.
// Past the preview's horizon the rest of the drawn course shows as a faint dotted line.
function drawCourse(s, pts, selected, live) {
  const pv = previewFor(s, pts, live);
  if (!pv || pv.n < 2) return;
  const xy = pv.xy, k = pxPerUnit(s.x, s.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  seaTo(s.x, s.y, true);
  for (let i = pv.idx + 1; i < pv.n; i++) seaTo(xy[i * 2], xy[i * 2 + 1], false);
  ctx.lineWidth = Math.max(7, s.B * 0.85 * k); ctx.strokeStyle = line(selected ? 0.13 : 0.07); ctx.stroke();
  seaStroke(ctx, { color: line(selected ? 0.85 : 0.4), width: selected ? 1.5 : 1.1, under: selected ? 0.22 : 0.1 });
  let ex = xy[(pv.n - 1) * 2], ey = xy[(pv.n - 1) * 2 + 1];
  const rest = Math.min(pv.rest, pts.length);
  if (!pv.done && rest > 0) {
    ctx.beginPath();
    seaTo(ex, ey, true);
    for (let i = pts.length - rest; i < pts.length; i++) seaTo(pts[i].x, pts[i].y, false);
    seaStroke(ctx, { color: line(selected ? 0.55 : 0.28), width: 2, dash: DASH_DOT, under: 0 });
    ex = pts[pts.length - 1].x; ey = pts[pts.length - 1].y;
  }
  seaCircle(ex, ey, 8, 18);
  seaStroke(ctx, { color: line(selected ? 0.9 : 0.45), width: 1.25, under: 0.18 });
  const q = projTo(ex, ey, 0.5);
  ctx.beginPath(); ctx.arc(q.x, q.y, selected ? 2.4 : 1.8, 0, TAU); ctx.fillStyle = line(selected ? 0.95 : 0.5); ctx.fill();
}

// The finger's own line while drawing, faint, so you can see how the ship will round it off.
function drawStroke(pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) seaTo(pts[i].x, pts[i].y, i === 0);
  seaStroke(ctx, { color: line(0.45), width: 2.25, dash: [1, 9], under: 0 });
}

// Engage orders: a thin red ring under each target, with four ticks for the selected ship's own.
const ENEMY_LINE = tint(MARK.enemy, 0.9), ENEMY_SOFT = tint(MARK.enemy, 0.45);
function drawEngage(sel) {
  for (const s of S.G.ships) {
    if (!commandable(s) || !s.order || s.order.kind !== 'engage') continue;
    const t = unitById(s.order.targetId);
    if (!t || t.hidden || (t.kind !== 'fort' && !afloat(t))) continue;
    const mine = s === sel, rr = t.kind === 'fort' ? S.G.islands[t.island].r * 1.15 : t.L * 0.72;
    seaCircle(t.x, t.y, rr, 40);
    seaStroke(ctx, { color: mine ? ENEMY_LINE : ENEMY_SOFT, width: mine ? 1.5 : 1, under: mine ? 0.22 : 0.12 });
    if (!mine) continue;
    const a0 = S.clock * 0.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * PI / 2;
      seaTo(t.x + Math.cos(a) * rr * 1.12, t.y + Math.sin(a) * rr * 1.12, true);
      seaTo(t.x + Math.cos(a) * rr * 1.3, t.y + Math.sin(a) * rr * 1.3, false);
    }
    seaStroke(ctx, { color: ENEMY_LINE, width: 1.75, under: 0.22 });
  }
}

// A ripple where a tap gave an order.
function drawTapFx() {
  const age = S.clock - tapFx.t;
  if (age < 0 || age > 0.6) return;
  const k = EASE.out(age / 0.6), a = 1 - age / 0.6;
  seaCircle(tapFx.x, tapFx.y, (tapFx.kind === 'engage' ? 30 : 8) + k * 26, 24);
  ctx.lineWidth = 1.5 * a + 0.5;
  ctx.strokeStyle = tint(tapFx.kind === 'engage' ? MARK.enemy : MARK.line, a);
  ctx.stroke();
}

// Heading dial for an anchored ship: a thin ring plus an arrow toward where she's turning.
function drawPivot(s, active) {
  const rr = s.L * 0.8, col = active ? MARK.chosen : line(0.7);
  seaCircle(s.x, s.y, rr, 40);
  seaStroke(ctx, { color: col, width: active ? 1.5 : 1.1, under: 0.2 });
  const a = s.pivot, tip = s.L * 1.4, c = Math.cos(a), sn = Math.sin(a);
  const at = (d, side, o) => projTo(s.x + c * d - sn * side, s.y + sn * d + c * side, 0.5, o);
  const r0 = at(rr, 0, scratchA);
  ctx.beginPath(); ctx.moveTo(r0.x, r0.y);
  const t = at(tip, 0, scratchB); ctx.lineTo(t.x, t.y);
  seaStroke(ctx, { color: col, width: active ? 1.75 : 1.4, under: 0.22 });
  ctx.beginPath(); ctx.moveTo(t.x, t.y);
  const b1 = at(tip - 12, -6, scratchA); ctx.lineTo(b1.x, b1.y);
  const b2 = at(tip - 12, 6, scratchA); ctx.lineTo(b2.x, b2.y);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// The chosen ship: a fine gilt ring on the water.
function drawSelected(s) {
  seaCircle(s.x, s.y, s.L * 0.62, 40);
  seaStroke(ctx, { color: tint(MARK.chosen, 0.92), width: LINE.thin, under: 0.24 });
}

// ---------- Over the ships ----------
// Recently lost hull, per unit, for the bars' ghost drain: it holds for a beat, then drains away.
const ghosts = new Map();
let ghostsOf = null;
function ghostOf(u, k) {
  let g = ghosts.get(u.id);
  if (!g) { ghosts.set(u.id, { k, from: k, t: -9 }); return null; }
  if (k < g.k - 1e-4) { const cur = ghostNow(g); g.from = Math.max(cur == null ? g.k : cur, g.k); g.t = S.clock; }
  g.k = k;
  return ghostNow(g);
}
function ghostNow(g) {
  const age = S.clock - g.t;
  if (age > 0.9 || age < 0) return null;
  return g.from + (g.k - g.from) * (age < 0.3 ? 0 : EASE.inOut((age - 0.3) / 0.6));
}

// The status word under a ship's bar, if she has one. [text, colour]
const TAG = { fireship: ['Fireship', MARK.warn], escort: ['Escort', C.onGlass2], fleeing: ['Fleeing', MARK.chosen], ally: ['Ally', MARK.friend], rigging: ['Rigging cut', MARK.hurt], prize: ['Prize', MARK.friend] };
const tagOf = (s) => (s.fireship ? TAG.fireship : s.escort ? TAG.escort : s.fleeing ? TAG.fleeing : s.ally ? TAG.ally : s.slowT > 0 ? TAG.rigging : s.prize ? TAG.prize : null);

// A slim hull bar over each ship you can see (yours by how sound she is, theirs in enemy red), with a small star
// for a flagship and a quiet status word.
function drawShipBar(s) {
  if (!afloat(s) || s.hidden) return;
  const m = shipMeshes.get(s.id);
  const top = projTo(s.x, s.y, (m ? m.top : 40) + 12);
  const w = clamp(s.L * 0.5 * pxPerUnit(s.x, s.y), 24, 46), x = top.x - w / 2, y = top.y;
  const k = s.hp / s.maxHp, h = s.boss ? 4 : 3;
  bar(ctx, x, y, w, h, k, { color: s.team === 'player' ? hpColor(k) : MARK.enemy, ghost: ghostOf(s, k), track: MARK.track });
  if (s.flag) drawIcon(ctx, 'star', x - 7, y + h / 2, 9, MARK.chosen, { shadow: CANVAS_SHADOW.textTight });
  const tag = tagOf(s);
  if (tag) caption(ctx, tag[0], top.x, y + h + 9, { size: 9, color: tag[1], align: 'center' });
}

// Two ships lashed together: the odds and a progress ring between them while the boarders fight it out.
function drawBoarding(s) {
  const e = shipById(s.boarding.targetId);
  if (!e || e.hidden) return;
  const q = projTo((s.x + e.x) / 2, (s.y + e.y) / 2, 30);
  const k = clamp(s.boarding.t / BOARDING.time, 0, 1);
  caption(ctx, `Boarding  ${s.marines} v ${defence(e)}`, clamp(q.x, 70, S.view.cw - 70), q.y - 28, { size: 10, color: MARK.chosen, align: 'center', halo: 'strong' });
  ring(ctx, q.x, q.y - 8, 9, k, { width: 2.5 });
}

// Forts: a hull bar while the guns fire; once silenced, a quiet word and the landing party's progress.
function drawFort(f) {
  const q = projTo(f.x, f.y, fortTopZ + 14);
  if (f.state === 'active') {
    const w = 48, k = f.hp / f.maxHp;
    bar(ctx, q.x - w / 2, q.y, w, 4, k, { color: f.team === 'player' ? MARK.friend : MARK.enemy, ghost: ghostOf(f, k), track: MARK.track });
  } else {
    caption(ctx, f.capture ? 'Landing party ashore' : 'Silenced', q.x, q.y, { size: 10, color: MARK.chosen, align: 'center', halo: 'strong' });
    if (f.capture) ring(ctx, q.x, q.y + 20, 9, clamp(f.capture.t / CAPTURE_TIME, 0, 1), { width: 2.5 });
  }
}

// Damage numbers (and words: "Raked!", "Mast down!") rise and fade off whatever was hit. A floater is
// { id, x, y, born, team, value?, text?, tone?, life?, z0? } (addDamage, addFloater in state.js; callout in
// src/sim/hazards.js); hits on the English show in coral.
const RISE = 34;
function drawFloaters() {
  const fl = S.floaters;
  for (let i = fl.length - 1; i >= 0; i--) {
    const f = fl[i], age = S.clock - f.born, word = !!f.text && !f.value;
    const dur = f.life || (word ? 1.5 : 1.1);
    if (age > dur) { fl.splice(i, 1); continue; }
    const u = f.id != null ? unitById(f.id) : null;
    if (u && u.hidden) continue;
    // Callouts (f.text: "Raked!", "Mast down!", src/sim/hazards.js) ride higher (f.z0 stacks them) and stay longer.
    const q = projTo(f.x, f.y, (f.z0 || 60) + (word ? RISE * 0.7 : RISE) * EASE.out(Math.min(1, age / dur)));
    const v = word || f.value == null ? null : Math.round(f.value);
    const tone = f.tone || (f.team === 'player' ? 'hurt' : 'hit');
    const size = v != null ? Math.min(24, 15 + Math.sqrt(Math.max(0, v)) * 1.4) : 13;
    const fx = q.x + (word ? 0 : Math.sin(f.born * 13) * 8);
    // Behind the fleet dock, the objective lines or a banner a callout would only be noise: let it ghost.
    ctx.globalAlpha = behindChrome(fx, q.y) ? 0.14 : 1;
    floater(ctx, fx, q.y, { value: v != null ? numStr(v) : null, word: f.text || null, tone, age, dur, size });
    ctx.globalAlpha = 1;
  }
}
function behindChrome(x, y) {
  if (inBox(lastDock, x, y, 18) || inBox(lastObj, x, y, 18)) return true;
  // A banner sits a third of the way down the screen.
  const bn = S.banner;
  return !!bn && S.clock < bn.until && Math.abs(y - S.view.ch * 0.3) < 70;
}

// "−12" with a true minus sign, cached.
const nums = new Map();
const numStr = (v) => { let s = nums.get(v); if (!s) { s = `−${v}`; nums.set(v, s); } return s; };

// Mortar shells in flight: a pulsing red ring where each will land.
function drawShellTargets() {
  for (const b of S.balls) {
    if (b.kind !== 'shell') continue;
    const k = Math.min(1, b.u), r = b.radius * (0.55 + 0.45 * k), enemy = b.team === 'enemy';
    seaCircle(b.tx, b.ty, r, 28);
    ctx.fillStyle = tint(enemy ? MARK.enemy : MARK.friend, 0.08 + 0.16 * k); ctx.fill();
    seaStroke(ctx, { color: enemy ? MARK.enemy : MARK.friend, width: LINE.thin, under: 0.22 });
  }
}

// ---------- Messages ----------
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
  reach: 'Sail into the gold ring marked on the chart.',
  protect: 'Keep the ships and forts ringed in blue safe. Lose one and the battle is lost.',
  hunt: 'Sink the ships ringed in red. The rest don’t matter.',
  fog: 'Fog! You only see ships near your own. Keep the fleet together.',
  rake: 'Raked! Shot that flies the length of a ship, in through her stern or bow, does far more damage. Cross an enemy’s stern to rake her, and never show her yours.',
  crit: 'A lucky hit! Shot can bring down a mast (slower for good), smash the rudder (sluggish helm) or start a fire. Raking shots do it more often.',
  shoal: 'Aground! Pale water is shallow. Brigs and bigger stick fast there; sloops, schooners and xebecs sail right over.',
  reef: 'Reef! The rocks under the surf hole any ship that crosses them. Steer round the white water.',
};
const TIP_SECS = 6.5;
let tip = null;
function offerTip(id) {
  save.tips = save.tips || [];
  if (tip || save.tips.includes(id) || S.G.tut) return;
  save.tips.push(id);
  writeSave();
  tip = { text: TIPS[id], t0: S.clock, lines: null, w: 0 };
}
// Just above the action bar in portrait; in landscape, where the sea is short, at the top between the dock and
// the right-hand column (under the boss card if there is one).
function drawTip(bottom) {
  if (!tip) return;
  const age = S.clock - tip.t0;
  if (age > TIP_SECS) { tip = null; return; }
  const { cw, ch } = S.view, wide = cw > ch;
  const x0 = wide ? dockBox.x + dockBox.w + K.gap * 2 : box.L, x1 = wide ? colBox.x - K.gap * 2 : box.R;
  const w = Math.min(x1 - x0, 340), x = Math.round((x0 + x1 - w) / 2);
  if (!tip.lines || tip.w !== w) { tip.lines = wrapText(ctx, tip.text, w - 32, 14, 500); tip.w = w; }
  const h = 26 + 16 + tip.lines.length * 19.5;
  const a = life(age, TIP_SECS, 0.42, 0.5), e = 1 - EASE.out(Math.min(1, age / 0.42));
  const y = wide ? box.T + (bossBottom ? bossBottom - box.T + K.gap : 0) - e * 10 : bottom - 12 - h + e * 14;
  tipCard(ctx, x, Math.round(y), w, tip.text, { step: 'Tip', alpha: a, lines: tip.lines });
}
export const resetTip = () => { tip = null; S.tipAsk = null; };

// The big centred message (fort silenced, boss beaten): glides in, holds, fades.
let bannerSeen = null, bannerT0 = 0;
function drawBanner() {
  const bn = S.banner;
  if (!bn || S.clock >= bn.until) return;
  if (bn !== bannerSeen) { bannerSeen = bn; bannerT0 = S.clock; }
  const { cw, ch } = S.view;
  const t = Math.min(1, (S.clock - bannerT0) / 0.42), out = clamp((bn.until - S.clock) / 0.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = out < 1 ? EASE.out(out) : 1;
  banner(ctx, cw / 2, Math.round(ch * 0.3), { title: bn.text, sub: bn.sub || null, t, maxWidth: Math.min(360, cw - 64) });
  ctx.restore();
}

// A short line over a ship (course set, anchored, landing party away, a captain's words): a small glass capsule.
function drawToast() {
  const ts = S.toast;
  if (!ts || S.clock >= ts.until) return;
  const s = shipById(ts.shipId);
  if (!s || !afloat(s) || s.hidden) return;
  const m = shipMeshes.get(s.id), q = projTo(s.x, s.y, (m ? m.top : 40) + 12), { cw, ch } = S.view;
  if (q.x < 0 || q.x > cw || q.y < 0 || q.y > ch) return; // her words are for when you can see her
  const secs = ts.secs || 1.2, maxWidth = Math.min(300, cw - 32);
  const half = Math.min(maxWidth, measure(ctx, ts.text, 13, 600) + 26) / 2 + 8;
  toast(ctx, clamp(q.x, half, cw - half), q.y - 24, ts.text, { t: 1 - (ts.until - S.clock) / secs, maxWidth });
}

// ---------- The kit goals and abilities draw with ----------
// draw(o, G, api) on a goal, draw(s, a, api) on an ability. above(s) is the point over a ship's health bar;
// once(key) is true the first time a key is asked for in a frame, so markers several goals share (the exit band)
// are drawn once. Draw rings with ring() and words with label(); outlinedText() is the old name for a label.
const drawn = new Set();
const api = {
  ctx, seaTo, seaCircle, projTo, proj, COL, P, C, MARK, tint, LINE,
  above(s) { const m = shipMeshes.get(s.id); return proj(s.x, s.y, (m ? m.top : 40) + 12); },
  once(key) { if (drawn.has(key)) return false; drawn.add(key); return true; },
  // A ring on the sea: thin, with a soft underlay so it reads on bright and dark water. dashed: marching dashes.
  ring: (x, y, r, color, o) => seaRing(x, y, r, color, o),
  // Strokes the current path the same way (after seaTo / seaCircle).
  stroke: (color, o = {}) => seaStroke(ctx, { color, width: o.width || 1.5, dash: o.dash || null, offset: o.offset || 0 }),
  // A small quiet word on the sea: spaced capitals with a soft shadow.
  label: (str, x, y, color = C.onGlass, o = {}) => caption(ctx, str, x, y, { size: 10, color, align: 'center', halo: 'strong', ...o }),
  // A progress ring (a hold timer, a capture).
  progress: (x, y, k, color) => ring(ctx, x, y, 9, k, color ? { width: 2.5, color } : { width: 2.5 }),
  text: (str, x, y, o) => text(ctx, str, x, y, o),
  outlinedText: (str, x, y, size, color, align) => caption(ctx, str, x, y, { size: Math.min(11, size * 0.8), color, align: align || 'left', halo: 'strong' }),
};
function drawMarkers(G) {
  drawn.clear();
  eachGoal(G, 'draw', (g, o) => g.draw(o, G, api));
  for (const s of G.ships) if (afloat(s) && !s.hidden) eachAbility(s, 'draw', (A, a) => A.draw(s, a, api));
}

// ---------- Chrome ----------
// Layout edges for this frame (safe area + the 12 px HUD edge), and the boxes chevrons keep clear of.
const box = { L: 0, T: 0, R: 0, B: 0 };
const dockBox = { x: 0, y: 0, w: 0, h: 0 }, colBox = { x: 0, y: 0, w: 0, h: 0 }, barBox = { x: 0, y: 0, w: 0, h: 0 };
// The objective lines under the wind rose. Floaters are drawn before the dock and the column measure themselves,
// so they fade behind last frame's boxes.
const objBox = { x: 0, y: 0, w: 0, h: 0 };
const lastDock = { x: 0, y: 0, w: 0, h: 0 }, lastObj = { x: 0, y: 0, w: 0, h: 0 };
const pauseRect = { x: 0, y: 0, r: 0 }, recentreRect = { x: 0, y: 0, r: 0 };

// The fleet dock, top left, with no box round it: a 44 px row per ship you command, her name (soft-shadowed, like
// every word on the sea) over a thin hull bar. The chosen ship's name is gold with a short gold rule beside it;
// with Whole fleet on, every name turns gold and the rule marks the Whole fleet row. Words appear only when they
// say something (Sunk, Captured, Through, Prize). Merchantmen or allies share one compact row of short bars.
const ROW = 44, ROW_SM = 28;
const cardPool = [];
function card(i) { return cardPool[i] || (cardPool[i] = { x: 0, y: 0, w: 0, h: 0, ship: null, fleet: false }); }
const GROUP_NAME = { escort: 'Merchantmen', ally: 'Allies' };
let rows = [], rowsKey = -1, fleetRow = false;
// Rebuilt only when the fleet changes (a ship joins, is lost, captured or gets through).
function dockRows(G) {
  let key = 7;
  for (const s of G.ships) if (s.team === 'player' || s.origTeam === 'player') key = (key * 31 + s.id * 8 + (s.team === 'player' ? 4 : 0) + (afloat(s) ? 2 : 0) + (s.state === 'escaped' ? 1 : 0)) % 2147483647;
  if (key === rowsKey) return rows;
  rowsKey = key;
  const own = G.ships.filter((s) => s.team === 'player' || s.origTeam === 'player');
  rows = [];
  const groups = {};
  for (const s of own) {
    const kind = s.escort ? 'escort' : s.ally ? 'ally' : null;
    if (kind && own.filter((o) => (kind === 'escort' ? o.escort : o.ally && !o.escort)).length > 1) {
      if (!groups[kind]) rows.push((groups[kind] = { kind: 'group', name: GROUP_NAME[kind], ships: [], h: ROW_SM + 6 }));
      groups[kind].ships.push(s);
    } else rows.push({ kind: 'ship', ship: s, h: commandable(s) ? ROW : ROW_SM });
  }
  fleetRow = own.filter(commandable).length > 1;
  return rows;
}
// The mark of "this one" in the dock: a short vertical rule just left of the row.
const chosenRule = (x, cy) => { ctx.fillStyle = MARK.chosen; ctx.fillRect(x - 8, cy - 9, LINE.base, 18); };
function drawDock(G, sel) {
  const hud = S.hud, list = dockRows(G);
  if (fleetRow && G.phase === 'play' && G.t > 3) offerTip('fleet');
  const w = Math.round(clamp(S.view.cw * 0.32, 120, 144)), x = box.L, y0 = box.T - 6;
  const ix = x + 8, iw = w - 16; // the row's hit rect is wider than its ink
  let y = y0, n = 0;
  for (let i = 0; i < list.length; i++) {
    const row = list[i], rh = row.h;
    if (row.kind === 'group') { drawGroupRow(row, ix, y, iw); y += rh; continue; }
    const s = row.ship, alive = afloat(s) && s.team === 'player', safe = s.state === 'escaped', big = rh === ROW;
    const chosen = big && (s === sel || S.selectAll);
    const cy = y + (big ? rh / 2 - 4 : rh / 2);
    if (chosen && !S.selectAll) chosenRule(ix, cy + 4);
    let nx = ix;
    if (s.flag) { drawIcon(ctx, 'star', nx + 4.5, cy, 10, alive ? MARK.chosen : C.onGlass3, { shadow: CANVAS_SHADOW.textTight }); nx += 14; }
    const status = safe ? 'Through' : !alive ? (afloat(s) ? 'Captured' : 'Sunk') : s.prize ? 'Prize' : s.escort ? 'Escort' : s.ally ? 'Ally' : null;
    const sw = status ? caption(ctx, status, ix + iw, cy + 0.5, { size: 9, align: 'right', color: safe ? MARK.exit : !alive ? MARK.warn : C.onGlass2, halo: 'soft' }) + 8 : 0;
    text(ctx, s.name, nx, cy, { size: big ? 14 : 12.5, weight: 600, color: !alive && !safe ? C.onGlass3 : chosen ? MARK.chosen : C.onGlass, halo: 'strong', maxWidth: ix + iw - sw - nx });
    if (alive) {
      const k = s.hp / s.maxHp;
      bar(ctx, ix, cy + (big ? 12 : 9), iw, big ? 3 : 2, k, { color: hpColor(k), ghost: ghostOf(s, k), track: MARK.track, shine: false });
    }
    if (!selfSailing(s)) { // merchantmen and allies can't be given orders
      const c = card(n++); c.x = x - 4; c.y = y; c.w = w + 4; c.h = rh; c.ship = s; c.fleet = false; hud.cards.push(c);
    }
    y += rh;
  }
  if (fleetRow) {
    const on = S.selectAll, cy = y + ROW / 2;
    if (on) chosenRule(ix, cy);
    const col = on ? MARK.chosen : C.onGlass;
    drawIcon(ctx, 'fleet', ix + 8, cy, 17, col, { shadow: CANVAS_SHADOW.textTight });
    text(ctx, 'Whole fleet', ix + 22, cy + 0.5, { size: 12.5, weight: 600, color: col, halo: 'strong' });
    const c = card(n++); c.x = x - 4; c.y = y; c.w = w + 4; c.h = ROW; c.ship = null; c.fleet = true; hud.cards.push(c);
    y += ROW;
  }
  dockBox.x = x; dockBox.y = y0; dockBox.w = w; dockBox.h = y - y0;
}
// Merchantmen (or allies) in company: a caption, how many are through, and a short bar for each ship.
function drawGroupRow(row, ix, y, iw) {
  const ships = row.ships, cy = y + 12;
  let through = 0;
  for (const s of ships) if (s.state === 'escaped') through++;
  caption(ctx, row.name, ix, cy, { size: 9, color: C.onGlass2 });
  if (through) caption(ctx, `${through} through`, ix + iw, cy, { size: 9, align: 'right', color: MARK.exit });
  const gap = 5, bw = (iw - gap * (ships.length - 1)) / ships.length;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i], safe = s.state === 'escaped', alive = afloat(s) && s.team === 'player';
    const k = safe ? 1 : alive ? s.hp / s.maxHp : 0;
    bar(ctx, ix + i * (bw + gap), cy + 11, bw, 3, k, { color: safe ? MARK.exit : hpColor(k), ghost: alive ? ghostOf(s, k) : null, track: alive || safe ? MARK.track : tint(MARK.warn, 0.4), shine: false });
  }
}

let bossBottom = 0;
// The boss: her name and a long red bar, top centre between the dock and the pause button (or under the dock if
// there's no room). No card: the name and the bar are the whole of it.
function drawBoss(G) {
  let b = null;
  for (const s of G.ships) if (s.boss && s.state !== 'sunk') { b = s; break; }
  if (!b) return;
  const gap = K.gap * 2;
  let x0 = dockBox.x + dockBox.w + gap, x1 = colBox.x - gap, y = box.T + 2;
  if (x1 - x0 < 120) { x0 = box.L; x1 = box.L + dockBox.w; y = dockBox.y + dockBox.h + K.gap; }
  const w = Math.min(280, x1 - x0), x = Math.round((x0 + x1 - w) / 2), cx = x + w / 2;
  bossBottom = y + 40;
  text(ctx, b.boss.captain, cx, y + 10, { size: 15, weight: 600, face: 'display', color: C.onGlass, align: 'center', halo: 'strong', maxWidth: w });
  const k = b.hp / b.maxHp;
  bar(ctx, x, y + 23, w, 4, k, { color: MARK.enemy, ghost: ghostOf(b, k), track: MARK.track });
  if (w > 190) caption(ctx, b.boss.title, cx, y + 37, { size: 9, align: 'center', color: C.onGlass2, halo: 'strong' });
}

// The right-hand column: pause, the wind rose, and the objective as a quiet right-aligned caption block.
function drawColumn(G) {
  const r = K.button / 2, px = box.R - r, py = box.T + r;
  iconButton(ctx, px, py, { icon: 'pause' });
  pauseRect.x = px; pauseRect.y = py; pauseRect.r = r + 6;
  S.hud.pause = pauseRect;
  // The wind arrow follows the wind as seen through the tilted camera.
  const wr = 21, wy = py + r + K.gap + 4 + wr;
  const c0 = projTo(G.W / 2, G.H / 2, 0, scratchA), x0 = c0.x, y0 = c0.y;
  const c1 = projTo(G.W / 2 + Math.cos(G.wind.dir) * 50, G.H / 2 + Math.sin(G.wind.dir) * 50, 0, scratchB);
  windRose(ctx, px, wy, wr, Math.atan2(c1.y - y0, c1.x - x0), { strength: 0.8 });
  let y = wy + wr + 30;
  const lines = goalLines(G);
  const maxW = Math.min(220, S.view.cw * 0.5);
  for (let i = 0; i < lines.length; i++) {
    const first = i === 0;
    text(ctx, lines[i], box.R, y, { size: first ? 13 : 12, weight: first ? 600 : 500, color: first ? C.onGlass : C.onGlass2, align: 'right', halo: 'soft', maxWidth: maxW });
    y += first ? 18 : 16;
  }
  objBox.x = box.R - maxW; objBox.y = wy + wr + 16; objBox.w = maxW; objBox.h = y - objBox.y;
  colBox.x = box.R - K.button; colBox.y = box.T; colBox.w = K.button; colBox.h = wy + wr + 14 - box.T;
}

// ---------- Action bar ----------
// A row of tiles for the selected ship, bottom centre: Fire port / starboard (manual gunnery: a reload line,
// gold ink over a full line when loaded), Anchor, Shot (round / chain / grape: tap to cycle), Mine (with a count),
// Board and Land, each only when it applies. Tiles are 52 tall, so every target is at least 44 x 44.
const pool = [];
const TILE_H = 52;
function act(kind, label, w) {
  const a = pool[S.hud.actions.length] || (pool[S.hud.actions.length] = {});
  a.kind = kind; a.label = label; a.w = w; a.h = TILE_H; a.x = 0; a.y = 0; a.on = false; a.ready = true; a.prog = -1;
  a.side = 0; a.shipId = null; a.fortId = null; a.sub = null; a.count = null; a.gold = false;
  S.hud.actions.push(a);
  return a;
}

// A Fire tile for one side. With one battery a side its reload is a single rule; with several (a great ship's
// lower and upper tiers) the rule splits into a segment per battery, each lit as it loads, and a tap fires
// whichever are loaded. The tile inverts to paper once the whole side is loaded.
function fireTile(sel, side, label) {
  const a = act('fire', label, 62), load = sideLoad(sel, side);
  a.side = side;
  a.ready = load.every((g) => g.k >= 1);
  a.prog = load.length > 1 ? load : load.length ? load[0].k : 1;
  return a;
}

function drawActionBar(sel) {
  const { cw } = S.view, hud = S.hud, manual = S.fireMode === 'manual';
  if (manual) fireTile(sel, 0, 'Port');
  const an = act('anchor', sel.pivot != null ? 'Weigh' : 'Anchor', 60); an.on = sel.pivot != null;
  if (sel.ammoKinds.length > 1 && !S.selectAll) { act('ammo', AMMO[sel.ammo].short, 20 + sel.ammoKinds.length * 22); offerTip('ammo'); }
  if (sel.mines > 0) { const a = act('mine', 'Mine', 60); a.count = sel.mines; offerTip('mine'); }
  const prey = boardingTarget(sel);
  if (prey) {
    const d = defence(prey), a = act('board', 'Board', 62);
    a.shipId = prey.id; a.ready = sel.marines > d; a.sub = `${sel.marines} v ${d}`; a.on = a.ready; a.gold = a.ready;
    offerTip('board');
  }
  const fort = landingFor(sel);
  if (fort) {
    const busy = !!fort.capture, ok = sel.marines >= fort.need && !busy, a = act('land', busy ? 'Landing' : 'Land', 62);
    a.fortId = fort.id; a.ready = ok; a.on = ok; a.gold = ok; a.sub = busy ? null : ok ? `${fort.need} men` : `need ${fort.need}`;
    offerTip('land');
  }
  if (manual) fireTile(sel, 1, 'Starboard');
  const gap = K.gap, list = hud.actions;
  let total = -gap;
  for (const a of list) total += a.w + gap;
  // On a narrow phone with every button up, squeeze the tiles (never under 48 wide).
  const room = cw - box.L - (cw - box.R) - 8;
  if (total > room) {
    const k = Math.max(0, (room - gap * (list.length - 1))) / (total - gap * (list.length - 1));
    total = -gap;
    for (const a of list) { a.w = Math.max(48, Math.floor(a.w * k)); total += a.w + gap; }
  }
  let x = Math.round((cw - total) / 2);
  const y = box.B - TILE_H;
  // Only one gold thing at a time: if Board and Land both apply, Board is the one.
  let gold = false;
  for (const a of list) { if (a.gold && gold) a.gold = false; gold = gold || a.gold; }
  for (const a of list) { a.x = x; a.y = y; x += a.w + gap; drawAction(a, sel); }
  barBox.x = list[0].x; barBox.y = y; barBox.w = total; barBox.h = TILE_H;
}

function drawAction(a, sel) {
  const { x, y, w, h } = a;
  if (a.kind === 'ammo') { drawShot(a, sel); return; }
  const icon = a.kind === 'fire' ? (a.side === 0 ? 'firePort' : 'fireStarboard') : a.kind;
  const fire = a.kind === 'fire';
  button(ctx, x, y, w, h, {
    icon, label: a.sub || a.label, stack: true, r: K.radius,
    variant: a.gold ? 'gold' : 'glass',
    state: a.on && !a.gold ? 'active' : !a.ready && a.kind === 'land' ? 'disabled' : 'normal',
    ready: fire && a.ready, progress: fire && !a.ready ? a.prog : null,
  });
  if (a.count != null) badge(ctx, x + w - 8, y + 8, a.count, { tone: 'gold', size: 10 });
}

// The shot selector: one tile showing every shot she carries, the loaded one in gold; a tap loads the next.
function drawShot(a, sel) {
  const { x, y, w, h } = a, kinds = sel.ammoKinds;
  button(ctx, x, y, w, h, { label: a.label, stack: true, r: K.radius });
  const step = 22, x0 = x + w / 2 - ((kinds.length - 1) * step) / 2, cy = y + h / 2 - 7.5;
  for (let i = 0; i < kinds.length; i++) {
    const on = kinds[i] === sel.ammo, cx = x0 + i * step;
    drawIcon(ctx, kinds[i], cx, cy, on ? 16 : 13, on ? MARK.chosen : C.onGlass3);
    if (on) { ctx.fillStyle = MARK.chosen; ctx.fillRect(cx - 5, cy + 11, 10, 1.5); }
  }
}

// ---------- Off screen ----------
// Enemies off screen: small red chevrons on the screen edge, pointing at them, clear of the HUD's own panels.
const inBox = (b, x, y, m) => b.w > 0 && x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m;
function drawChevrons() {
  const { cw, ch } = S.view, G = S.G;
  const mL = ins.l + 14, mR = ins.r + 14, mT = ins.t + 14, mB = ins.b + 14;
  const cx = (mL + cw - mR) / 2, cy = (mT + ch - mB) / 2, hw = (cw - mL - mR) / 2, hh = (ch - mT - mB) / 2;
  S.hud.chevrons = 0;
  for (const s of G.ships) {
    if (s.team === 'player' || !afloat(s) || s.hidden) continue;
    const q = projTo(s.x, s.y, 8);
    if (q.x > -4 && q.x < cw + 4 && q.y > -4 && q.y < ch + 4) continue;
    const dx = q.x - cx, dy = q.y - cy;
    const k = Math.min(hw / Math.max(1e-3, Math.abs(dx)), hh / Math.max(1e-3, Math.abs(dy)));
    let x = cx + dx * k, y = cy + dy * k;
    const a = Math.atan2(dy, dx), size = s.boss ? 15 : 12;
    // Slide along the edge out from under the dock, the right-hand column and the action bar.
    if (inBox(dockBox, x, y, 10)) { if (Math.abs(dy) * hw > Math.abs(dx) * hh) x = dockBox.x + dockBox.w + 14; else y = dockBox.y + dockBox.h + 14; }
    if (inBox(colBox, x, y, 10)) { if (Math.abs(dy) * hw > Math.abs(dx) * hh) x = colBox.x - 14; else y = colBox.y + colBox.h + 14; }
    // Below the wind rose the objective lines run along the right edge: an arrow there slides down past them.
    if (inBox(objBox, x, y, 8) && x > objBox.x + objBox.w * 0.5) y = objBox.y + objBox.h + 14;
    if (inBox(barBox, x, y, 12)) x = x < barBox.x + barBox.w / 2 ? barBox.x - 16 : barBox.x + barBox.w + 16;
    S.hud.chevrons++;
    const far = Math.hypot(dx, dy) / Math.hypot(cw, ch);
    edgeChevron(ctx, x, y, a, { size, color: s.boss ? MARK.chosen : MARK.enemy, alpha: clamp(1.2 - far * 0.6, 0.45, 0.95) });
  }
}

// ---------- The frame ----------
export function drawHUD() {
  const { cw, ch } = S.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const hud = S.hud;
  hud.cards.length = 0; hud.pause = null; hud.recentre = null; hud.actions.length = 0;
  const G = S.G;
  if (!G || !R.renderer) return;
  if (ghostsOf !== G) { ghosts.clear(); ghostsOf = G; rowsKey = -1; }
  box.L = ins.l + K.edge; box.T = ins.t + K.edge; box.R = cw - ins.r - K.edge; box.B = ch - ins.b - K.edge;
  Object.assign(lastDock, dockBox); Object.assign(lastObj, objBox);
  dockBox.w = colBox.w = barBox.w = objBox.w = 0; bossBottom = 0;
  // A ship is always selected: if yours goes down (or is taken), the next one in the line steps up.
  if (!commandable(S.selected)) S.selected = G.ships.find(commandable) || S.selected;
  const sel = commandable(S.selected) ? S.selected : null;
  if (G.phase === 'play') feel(sel);

  if (G.phase !== 'title') {
    // Tutorial buoy
    if (G.tut && G.tut.step === 0 && G.buoy) {
      const pulse = 24 + Math.sin(S.clock * 3) * 3;
      seaRing(G.buoy.x, G.buoy.y, pulse, MARK.chosen, { width: LINE.base, n: 32 });
      seaCircle(G.buoy.x, G.buoy.y, 6, 16); ctx.fillStyle = MARK.chosen; ctx.fill();
      const q = projTo(G.buoy.x, G.buoy.y, 26);
      caption(ctx, 'Sail here', q.x, q.y - 6, { size: 11, color: MARK.chosen, align: 'center', halo: 'strong' });
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
    if (S.selectAll) { for (const s of G.ships) if (s.team === 'player' && afloat(s) && !selfSailing(s)) drawSelected(s); }
    else if (sel) drawSelected(sel);
    for (const s of G.ships) if (s.boarding && s.boarding.attacker) drawBoarding(s);
  }
  drawMarkers(G);
  drawShellTargets();
  if (G.phase === 'play' && G.t > 1.5) {
    eachGoal(G, 'tip', (g) => offerTip(g.tip));
    if (G.fog) offerTip('fog');
    if (S.balls.some((b) => b.kind === 'shell' && b.team === 'enemy')) offerTip('mortar');
    if (G.ships.some((s) => s.fireship && afloat(s) && !s.hidden)) offerTip('fireship');
    // Tips the sim asks for when something first happens (a rake, a lucky hit, running aground).
    if (S.tipAsk) for (const id of S.tipAsk) { offerTip(id); if ((save.tips || []).includes(id)) S.tipAsk.delete(id); }
  }
  for (const s of G.ships) drawShipBar(s);
  for (const f of G.forts) drawFort(f);
  if (G.phase === 'title') return;
  drawFloaters();
  drawToast();

  drawDock(G, sel);
  drawColumn(G);
  drawBoss(G);

  const playing = G.phase === 'play';
  if (sel && playing) drawActionBar(sel);
  if (playing) drawChevrons();
  const barTop = hud.actions.length ? hud.actions[0].y : box.B;
  // The camera is in your hands: a small button (or a double-tap on the sea) gives it back to the director.
  if (playing && cam.mode === 'manual') {
    const r = K.button / 2, x = box.R - r, y = barTop - K.gap - 4 - r;
    iconButton(ctx, x, y, { icon: 'recentre' });
    recentreRect.x = x; recentreRect.y = y; recentreRect.r = r + 6;
    hud.recentre = recentreRect;
  }

  drawBanner();
  if (playing) drawTip(hud.recentre ? hud.recentre.y - K.button / 2 - 4 : barTop); // clear of the recentre button too

  // First-time hint (the tutorial has its own coach)
  if (playing && !G.tut && !G.dragged && G.t < 14 && !tip) {
    const a = life(G.t, 14, 0.6, 1);
    text(ctx, 'Drag on the sea to set a course · tap an enemy to engage', cw / 2, barTop - 20, {
      size: 13, weight: 500, color: C.onGlass, align: 'center', halo: 'strong', alpha: a * 0.92, maxWidth: cw - ins.l - ins.r - 32,
    });
  }
}

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
