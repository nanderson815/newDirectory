import { S, afloat, shipById, showBanner, showToast } from '../state.js';
import { BOARDING } from '../config/ammo.js';
import { rand } from '../util.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';

// Boarding: lash alongside a crippled enemy ship and send your marines across. If they win the fight on deck,
// the ship strikes her colours and joins your squadron as a prize for the rest of the battle.
// The Spanish do the same to crippled English ships that drift too close.

// The defenders' strength: their surviving marines, stiffened by whatever hull they have left.
export const defence = (e) => Math.max(1, Math.round(e.marines * (0.6 + 0.4 * e.hp / e.maxHp)));

export function canBoard(s, e) {
  return s && e && afloat(s) && afloat(e) && s.team !== e.team && !e.boss && !e.passive && !s.passive &&
    !s.boarding && !e.boarding && s.marines > 0 && e.hp <= e.maxHp * BOARDING.hpFrac &&
    Math.hypot(s.x - e.x, s.y - e.y) < (s.L + e.L) * BOARDING.reach;
}

// The enemy a ship could board right now, if any.
export function boardingTarget(s) {
  let best = null, bd = Infinity;
  for (const e of S.G.ships) {
    if (!canBoard(s, e)) continue;
    const d = Math.hypot(s.x - e.x, s.y - e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function startBoarding(s, e) {
  if (!canBoard(s, e)) return false;
  s.boarding = { targetId: e.id, t: 0, attacker: true };
  e.boarding = { targetId: s.id, t: 0, attacker: false };
  s.path = []; s.pivot = null; e.path = []; e.pivot = null;
  if (s.team === 'player') showToast('Boarders away!', s, 1.4);
  else { showToast('Spanish boarders!', e, 1.6); showBanner(`${e.name} is being boarded!`, 'Sink the boarder or bring help'); }
  sfx.crack();
  return true;
}

function release(s, e) {
  if (s) s.boarding = null;
  if (e) e.boarding = null;
}

// Spanish captains board when they have the numbers, now and then rather than the instant it's possible.
function enemyBoarders(dt) {
  for (const e of S.G.ships) {
    if (e.team !== 'enemy' || e.boarding || e.boss || e.passive || !afloat(e) || Math.random() > dt * 0.7) continue;
    for (const p of S.G.ships) {
      if (p.team === 'player' && canBoard(e, p) && e.marines > defence(p) * 1.2) { startBoarding(e, p); break; }
    }
  }
}

export function updateBoardings(dt) {
  enemyBoarders(dt);
  for (const s of S.G.ships) {
    const b = s.boarding;
    if (!b || !b.attacker) continue;
    const e = shipById(b.targetId);
    if (!afloat(s) || !e || !afloat(e)) { release(s, e); continue; }
    b.t += dt;
    if (e.boarding) e.boarding.t = b.t;
    // Smoke and the clatter of cutlasses while the fight goes on.
    if (Math.random() < dt * 6) {
      const mx = (s.x + e.x) / 2 + rand(-8, 8), my = (s.y + e.y) / 2 + rand(-8, 8);
      spawn('smoke', mx, my, rand(-6, 6), rand(-6, 6), rand(0.5, 0.9), rand(3, 5), 10, 10);
      spawn('flash', mx, my, 0, 0, 0.08, 3, 10, 0);
      if (Math.random() < 0.4) sfx.crack();
    }
    if (b.t < BOARDING.time) continue;
    const def = defence(e);
    if (s.marines > def) {
      s.marines = Math.max(0, s.marines - Math.max(1, Math.ceil(def * 0.5)));
      e.team = s.team; e.marines = 0; e.path = []; e.pivot = null; e.targetId = null;
      e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.3));
      if (s.team === 'player') {
        e.prize = true; e.label = 'Prize';
        S.G.stats.prizes = (S.G.stats.prizes || 0) + 1;
        showBanner(`${e.name} strikes her colours!`, 'She sails with you now as a prize');
        sfx.fanfare(false);
      } else {
        e.prize = false; e.label = 'Captured';
        if (S.selected === e) S.selected = S.G.ships.find((x) => x.team === 'player' && afloat(x)) || null;
        showBanner(`${e.name} has been taken!`, 'She fights for Spain now');
      }
    } else {
      s.marines = Math.max(0, s.marines - Math.max(1, Math.ceil(s.marines * 0.6)));
      e.marines = Math.max(0, e.marines - Math.ceil(def * 0.3));
      if (s.team === 'player') showToast('Boarders repelled!', s, 1.6);
      else showToast('Boarders beaten off!', e, 1.6);
    }
    release(s, e);
  }
}
