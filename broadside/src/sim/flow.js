import { S, afloat, showBanner } from '../state.js';
import { PI, clamp, rand, lerp } from '../util.js';
import { corePt, coreDist, makeCapsule, tideStage } from './terrain.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';
import { callout } from './hazards.js';

// The sea that changes under you (battle fields documented in TERRAIN, src/sim/terrain.js):
//   currents  zones where the water sets every ship along (drift(), applied after the helm, preview too)
//   tide      a level from high water (1) to low (0) that covers and uncovers shoals marked tidal
//   booms     log booms across harbour mouths: land for every ship until shot through or their fort falls
// All state lives in the battle G as plain JSON (G.currents, G.tide, G.booms), so it saves with the battle.
// One call a tick from src/sim/update.js (updateFlow), one from the course preview (drift).

// ---------- Setup ----------
export function setupFlow(G, B, { place, rot }) {
  G.currents = (B.currents || []).map((d) => {
    const c = makeCapsule(d, place, rot);
    const a = ((d.dir != null ? d.dir : d.angle || 0) * PI) / 180 + rot;
    return { ...c, speed: d.speed, fx: Math.cos(a), fy: Math.sin(a) };
  });
  G.tide = null;
  if (B.tide) {
    const lv = B.tide.level == null ? 1 : B.tide.level;
    G.tide = { level: lv, stage: tideStage(lv), turns: (B.tide.turns || []).map((t) => ({ at: t.at, to: t.to, secs: t.secs || 12, from: null })) };
  }
  G.booms = (B.booms || []).map((d, i) => {
    const [ax, ay] = place(d.from[0], d.from[1]), [bx, by] = place(d.to[0], d.to[1]);
    const hl = Math.hypot(bx - ax, by - ay) / 2;
    const fort = d.fort != null && G.forts[d.fort] ? G.forts[d.fort].id : null;
    return { id: 9500 + i, x: (ax + bx) / 2, y: (ay + by) / 2, r: 7, hl, ang: Math.atan2(by - ay, bx - ax), hp: d.hp || 60, maxHp: d.hp || 60,
      fort, team: d.team || 'enemy', name: d.name || 'the boom', open: false, openAt: null };
  });
}

// A short fingerprint of what the tide and the booms have done, so planners know when the sea has changed.
export const geoStamp = (G) => `${G.tide ? G.tide.stage : ''}|${(G.booms || []).map((b) => (b.open ? 1 : 0)).join('')}`;
// Booms still across their mouths (capsules, as steering treats islands).
const NONE = [];
export const activeBooms = (G) => (G.booms && G.booms.length ? G.booms.filter((b) => !b.open) : NONE);

// ---------- Currents ----------
// The set of the sea at (x, y): [vx, vy] in map units a second (shared scratch, copy it out).
const V = [0, 0];
export function currentAt(G, x, y) {
  V[0] = 0; V[1] = 0;
  for (const c of G.currents || NONE) {
    const d = coreDist(c, x, y);
    if (d >= c.r) continue;
    const t = clamp((c.r - d) / (c.r * 0.45), 0, 1), k = t * t * (3 - 2 * t);
    V[0] += c.fx * c.speed * k; V[1] += c.fy * c.speed * k;
  }
  return V;
}
// Carries ship s along with the water for dt seconds (anchored ships hold their ground; boarding ships drift together).
export function drift(s, dt) {
  const G = S.G;
  if (!G.currents || !G.currents.length || s.pivot != null) return;
  const [vx, vy] = currentAt(G, s.x, s.y);
  if (!vx && !vy) return;
  s.x = clamp(s.x + vx * dt, 18, G.W - 18); s.y = clamp(s.y + vy * dt, 18, G.H - 18);
}

// ---------- The tide ----------
function updateTide(G, dt) {
  const T = G.tide;
  for (const t of T.turns) {
    if (G.t < t.at || t.done) continue;
    if (t.from == null) {
      t.from = T.level;
      const falling = t.to < t.from;
      showBanner(falling ? 'The tide is falling' : 'The tide is making', falling
        ? (t.to <= 0.33 ? 'The sandbars will soon be dry, even for a sloop' : 'Big ships beware the bars')
        : (t.to >= 0.66 ? 'Soon there will be water over the bars for any ship' : 'Small ships can cross the bars again'), 2.6);
    }
    const k = clamp((G.t - t.at) / t.secs, 0, 1);
    T.level = lerp(t.from, t.to, k);
    if (k >= 1) t.done = true;
  }
  const st = tideStage(T.level);
  if (st !== T.stage) T.stage = st;
}
// Starts a turn of the tide now (the `tide` event action).
export function turnTide(G, to, secs = 10) {
  if (!G.tide) G.tide = { level: 1, stage: 'covered', turns: [] };
  for (const t of G.tide.turns) if (t.from != null) t.done = true;
  G.tide.turns.push({ at: G.t, to, secs, from: null });
}

// ---------- Booms ----------
function lower(G, b, how) {
  b.open = true; b.openAt = G.t;
  const n = `${b.name[0].toUpperCase()}${b.name.slice(1)}`;
  showBanner(how === 'shot' ? `${n} is shot through!` : `${n} is lowered`, how === 'shot' ? 'The harbour mouth lies open' : 'With the fort fallen, the chain goes slack', 2.6);
  sfx.fanfare(false);
  for (let k = 0; k < 14; k++) {
    const t = rand(-b.hl, b.hl), x = b.x + Math.cos(b.ang) * t, y = b.y + Math.sin(b.ang) * t;
    spawn('plank', x, y, rand(-10, 10), rand(-10, 10), rand(14, 22), rand(7, 12));
  }
}
function updateBooms(G, dt) {
  for (const b of G.booms) {
    if (b.open) continue;
    // The fort that works the windlass: silence it or take it and the boom comes down.
    if (b.fort != null) {
      const f = G.forts.find((q) => q.id === b.fort);
      if (f && (f.state !== 'active' || f.team !== b.team)) { lower(G, b, 'fort'); continue; }
    }
    // Round shot from either side lands on the logs (mortar shells fly over); only the attackers' breaks them.
    const balls = S.balls;
    for (let i = balls.length - 1; i >= 0; i--) {
      const q = balls[i];
      if (q.kind === 'shell' || q.mine || coreDist(b, q.x, q.y) > b.r + 7) continue;
      spawn('splash', q.x, q.y, 0, 0, 0.5, 7);
      if (q.team !== b.team) {
        b.hp -= q.dmg;
        for (let k = 0; k < 6; k++) spawn('splinter', q.x, q.y, rand(-60, 60), rand(-60, 60), rand(0.5, 0.9), rand(2, 4), 6, rand(30, 60));
        sfx.woodHit(q.x, q.y);
      }
      const last = balls.pop();
      if (i < balls.length) balls[i] = last;
      if (b.hp <= 0) { lower(G, b, 'shot'); break; }
    }
    if (b.open) continue;
    // Ships that run onto it are held off like a beach.
    for (const s of G.ships) {
      if (!afloat(s)) continue;
      const p = corePt(b, s.x, s.y), dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 0.01, min = b.r + s.B * 0.62;
      if (d >= min) continue;
      s.x = p.x + (dx / d) * min; s.y = p.y + (dy / d) * min;
      s.v *= Math.pow(0.5, dt);
    }
  }
}

// One tick: the tide moves, booms take their shot and hold ships off, currents set every ship along.
export function updateFlow(G, dt) {
  if (G.tide) updateTide(G, dt);
  if (G.booms && G.booms.length) updateBooms(G, dt);
  if (G.currents && G.currents.length) {
    for (const s of G.ships) {
      if (!afloat(s) || s.boarding) continue;
      drift(s, dt);
      // Your captains say so when the stream first takes hold of them (once a while per ship).
      if (s.team !== 'player') continue;
      const [vx, vy] = currentAt(G, s.x, s.y), on = vx * vx + vy * vy > 36;
      if (on && !s.inSet && G.t - (s.setSaid || -99) > 25) { s.setSaid = G.t; callout(s, 'The current takes her', 'sea'); }
      s.inSet = on;
    }
  }
}
