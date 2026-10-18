import { S, afloat, shipById, showBanner, showToast } from '../state.js';
import { CAPTURE_TIME } from '../config/ships.js';
import { rand } from '../util.js';
import { spawn } from './particles.js';
import { shoreClear } from './steering.js';
import { sfx } from '../audio/sfx.js';

// Coastal forts: a stone tower whose guns cover every direction. Pound one silent, then stop a ship
// beside it and land marines; once the garrison is ashore the fort fights for whoever holds it.

export function updateFort(f, dt) {
  const G = S.G;
  f.fxT -= dt;
  if (f.state !== 'active') {
    if (f.fxT <= 0) {
      f.fxT = 0.35;
      spawn('soot', f.x + rand(-6, 6), f.y + rand(-6, 6), Math.cos(G.wind.dir) * 10, Math.sin(G.wind.dir) * 10, rand(1.6, 2.4), rand(5, 8), 26, 12);
    }
    updateCapture(f, dt);
    return;
  }
  f.reload -= dt;
  let best = null, bd = Infinity;
  for (const s of G.ships) {
    if (s.team === f.team || !afloat(s) || (s.hidden && f.team === 'player')) continue;
    const d = Math.hypot(s.x - f.x, s.y - f.y);
    if (d < f.range && d < bd) { bd = d; best = s; }
  }
  if (best) f.aim = Math.atan2(best.y - f.y, best.x - f.x);
  if (best && f.reload <= 0) {
    f.reload = f.reloadTime * rand(0.9, 1.1);
    for (let i = 0; i < f.guns; i++) S.pending.push({ t: i * 0.18, fortId: f.id, targetId: best.id });
  }
}

// Close enough to row ashore: beside the island's beach. The boats only pull away once she's slowed.
export function canLand(s, f) {
  if (!s || !afloat(s) || s.team !== 'player' || f.state === 'active') return false;
  const is = S.G.islands[f.island];
  return Math.hypot(s.x - is.x, s.y - is.y) < shoreClear(is, s) + 50;
}
const SLOW_ENOUGH = 20;

export function startLanding(s, f) {
  if (!canLand(s, f) || s.marines < f.need || f.capture) return false;
  if (S.G.forts.some((q) => q.capture && q.capture.shipId === s.id)) return false; // her boats are already ashore
  f.capture = { shipId: s.id, t: 0 };
  s.path = [];
  s.pivot = s.h; // hold position while the boats are away
  showToast('Landing party away', s, 1.4);
  return true;
}

function updateCapture(f, dt) {
  if (!f.capture) return;
  const s = shipById(f.capture.shipId);
  if (!s || !canLand(s, f) || s.marines < f.need) { f.capture = null; return; }
  if (s.v < SLOW_ENOUGH) f.capture.t += dt;
  if (f.capture.t < CAPTURE_TIME) return;
  s.marines -= f.need;
  f.team = 'player'; f.state = 'active'; f.hp = Math.round(f.maxHp * 0.6);
  f.capture = null; f.reload = 1;
  S.G.stats.captured++;
  showBanner(`${f.name} is ours!`, `The garrison now fires on the ${S.G.faction === 'pirate' ? 'pirates' : 'Spanish'}`);
  sfx.capture();
}

// Nearest fort a selected ship could land troops at right now, if any.
export function landingFor(s) {
  for (const f of S.G.forts) if (canLand(s, f)) return f;
  return null;
}
