import { S, afloat, addDamage } from '../state.js';
import { PI, clamp, rand, angDiff, reduceMotion } from '../util.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';
import { sinkShip } from './combat.js';
import { SHOAL, REEF, grounds, coreDist } from './terrain.js';

// Combat with decisions: raking fire, critical hits and the sea's own hazards (shoals and reefs).

// Raking: a ball that flies within `cone` (radians, ~22°) of the target's bow-stern line has come in through
// her stern or her bow and runs the length of her decks. Through the stern it does `stern` times the damage,
// through the bow `bow` times. Crossing an enemy's stern is the move to learn; never show her yours.
export const RAKE = { cone: 0.38, stern: 1.75, bow: 1.5 };

// Critical hits: each round-shot ball that lands (bow chasers too; not chain or grape) has `chance` of a lucky
// hit, `rakeChance` when it rakes. A stern rake is twice as likely to find the rudder.
//   mast down:   the ship sails at 70% speed for the rest of the battle (two masts down: 55%); the mast lies
//                toppled over the side (render/scene.js). A ship always keeps her main mast.
//   rudder:      her helm answers at half rate for `rudderSecs` seconds.
//   fire aboard: `fireDps` hull a second for `fireSecs` seconds (12 in all), smoke and flame meanwhile.
export const CRIT = { chance: 0.03, rakeChance: 0.08, mastSlow: 0.3, mastMin: 0.55, rudderSecs: 8, rudderTurn: 0.5, fireSecs: 5, fireDps: 2.4 };

// Words over a ship (the HUD draws them like damage numbers, a little higher and longer).
// The tone names the HUD kit's floater colours (src/hud/style.js, floater()).
const TONE = { good: 'gold', bad: 'hurt', crit: 'hit', sea: 'cold' };
export function callout(u, text, tone = 'crit') {
  if (S.floaters.length > 40) S.floaters.shift();
  // Two at once (a mast and a fire from one broadside) stack rather than overprint.
  const stack = S.floaters.filter((f) => f.text && f.id === u.id && S.clock - f.born < 0.9).length;
  S.floaters.push({ id: u.id, x: u.x, y: u.y, value: 0, text, tone: TONE[tone] || tone, born: S.clock, life: 1.6, z0: 128 + stack * 34, team: u.team });
}
// Asks the HUD for a one-time tip (src/hud/hud.js TIPS); it shows once a tip slot is free.
export function askTip(id) { (S.tipAsk || (S.tipAsk = new Set())).add(id); }

// Damage from anything but a cannonball: fire, rocks, sand.
export function hurt(e, dmg) {
  if (!afloat(e) || dmg <= 0) return;
  e.hp -= dmg;
  addDamage(e, dmg);
  if (e.hp <= 0) sinkShip(e);
}

// Which end of ship e a flying ball came in through: 'stern', 'bow' or null (the beam).
export function rakeEnd(e, b) {
  if (b.vx == null || b.mine) return null;
  const rel = Math.abs(angDiff(e.h, Math.atan2(b.vy, b.vx)));
  return rel < RAKE.cone ? 'stern' : rel > PI - RAKE.cone ? 'bow' : null;
}

// A raking hit: words, a burst of splinters and a heavier crack, at most once a moment per ship.
export function raked(e, b, end) {
  const byUs = b.team === 'player';
  if (byUs || e.team === 'player') askTip('rake');
  for (let k = 0; k < 8; k++) spawn('splinter', b.x, b.y, rand(-80, 80), rand(-80, 80), rand(0.7, 1.1), rand(2.5, 5), 12, rand(40, 90));
  if (S.clock - (e.rakeAt || -9) < 0.7) return;
  e.rakeAt = S.clock;
  callout(e, end === 'stern' ? 'Raked astern!' : 'Raked!', e.team === 'player' ? 'bad' : 'good');
  sfx.crit('rake', b.x, b.y);
  if (e.team === 'player' && !reduceMotion) S.shake = Math.max(S.shake, 7);
}

// Rolls for a critical hit when a round-shot ball lands.
export function rollCrit(e, b, end) {
  if (b.vx == null || b.mine || (b.kind && b.kind !== 'round')) return;
  if (Math.random() >= (end ? CRIT.rakeChance : CRIT.chance)) return;
  const kinds = [];
  if (e.mastsDown < Math.max(0, (e.masts || 2) - 1)) kinds.push(['mast', 1]);
  kinds.push(['rudder', end === 'stern' ? 2 : 1]);
  if (!e.burning) kinds.push(['fire', 1]);
  let r = Math.random() * kinds.reduce((a, k) => a + k[1], 0);
  const kind = (kinds.find((k) => (r -= k[1]) < 0) || kinds[kinds.length - 1])[0];
  applyCrit(e, kind);
  if (b.team === 'player' || e.team === 'player') askTip('crit');
}

export function applyCrit(e, kind, secs = 0) {
  const c = Math.cos(e.h), sn = Math.sin(e.h);
  if (kind === 'mast') {
    e.mastsDown = (e.mastsDown || 0) + 1;
    callout(e, 'Mast down!', e.team === 'player' ? 'bad' : 'crit');
    // The mast goes over the side with a great splash.
    const side = Math.random() < 0.5 ? -1 : 1, mx = e.x - sn * side * (e.B * 0.5 + 22), my = e.y + c * side * (e.B * 0.5 + 22);
    spawn('splash', mx, my, 0, 0, 0.9, 22);
    for (let k = 0; k < 10; k++) spawn('drop', mx, my, rand(-30, 30), rand(-30, 30), rand(0.6, 1), rand(2, 3.5), 1, rand(60, 110));
    for (let k = 0; k < 4; k++) spawn('plank', mx + rand(-14, 14), my + rand(-14, 14), rand(-8, 8), rand(-8, 8), rand(14, 22), rand(8, 14));
  } else if (kind === 'rudder') {
    e.rudderT = CRIT.rudderSecs;
    callout(e, 'Rudder shot away!', e.team === 'player' ? 'bad' : 'crit');
    const sx = e.x - c * e.L * 0.5, sy = e.y - sn * e.L * 0.5;
    for (let k = 0; k < 10; k++) spawn('splinter', sx, sy, rand(-60, 60), rand(-60, 60), rand(0.6, 1), rand(2, 4), 6, rand(30, 70));
  } else {
    // A fire-pot (src/config/guns.js) passes how long it burns; one landing on a ship already alight feeds the fire.
    const already = e.fireT > 0;
    e.fireT = Math.max(e.fireT || 0, secs || CRIT.fireSecs);
    spawn('flash', e.x, e.y, 0, 0, 0.25, 16, 12, 0);
    if (already) return;
    callout(e, 'Fire aboard!', e.team === 'player' ? 'bad' : 'crit');
  }
  sfx.crit(kind, e.x, e.y);
}

// Her speed and helm factors from what has befallen her (pure, so the course preview can use it too).
export const hazardSpeed = (s) => (s.mastsDown ? Math.max(CRIT.mastMin, 1 - CRIT.mastSlow * s.mastsDown) : 1) * (s.aground ? SHOAL.slow : 1) * (s.onReef ? REEF.slow : 1);
export const hazardTurn = (s) => (s.rudderT > 0 ? CRIT.rudderTurn : 1) * (s.aground ? SHOAL.turn : 1);

// Every tick for each ship afloat: crits wear off or burn, shoals and reefs bite (setting s.aground, s.onReef).
export function updateHazards(s, dt) {
  const G = S.G;
  if (s.rudderT > 0) {
    s.rudderT = Math.max(0, s.rudderT - dt);
    if (Math.random() < dt * 3) spawn('smoke', s.x - Math.cos(s.h) * s.L * 0.5, s.y - Math.sin(s.h) * s.L * 0.5, rand(-6, 6), rand(-6, 6), rand(0.8, 1.3), rand(3, 5), 6, rand(6, 12));
  }
  if (s.fireT > 0) {
    s.fireT = Math.max(0, s.fireT - dt);
    tick(s, 'fireAcc', CRIT.fireDps * dt);
  }
  // Shoals ground big ships: a thud as she strikes, then she crawls (and grinds) until she's off.
  let aground = false;
  if (grounds(s)) for (const c of G.shoals || []) if (coreDist(c, s.x, s.y) < c.r) { aground = true; break; }
  if (aground) {
    if (!s.aground) {
      s.v *= 0.5;
      hurt(s, SHOAL.bump);
      callout(s, 'Aground!', 'sea');
      sfx.crit('ground', s.x, s.y);
      for (let k = 0; k < 10; k++) spawn('sand', s.x + rand(-s.L / 3, s.L / 3), s.y + rand(-s.B / 2, s.B / 2), rand(-30, 30), rand(-30, 30), rand(0.4, 0.8), rand(1.5, 3), 3, rand(20, 50));
      if (s.team === 'player') askTip('shoal');
    }
    if (s.v > 3) tick(s, 'groundAcc', SHOAL.dps * dt);
  }
  s.aground = aground;
  // Reefs hole any hull that crosses them, faster the harder she drives over.
  let reef = false;
  for (const c of G.reefs || []) if (coreDist(c, s.x, s.y) < c.r + s.B * 0.3) { reef = true; break; }
  if (reef) {
    if (!s.onReef) {
      callout(s, 'On the reef!', 'sea');
      sfx.crit('reef', s.x, s.y);
      if (s.team === 'player') askTip('reef');
    }
    tick(s, 'reefAcc', REEF.dps * dt * (0.4 + 0.6 * clamp(s.v / s.speed, 0, 1)));
    if (Math.random() < dt * 8) spawn('drop', s.x + rand(-s.L / 3, s.L / 3), s.y + rand(-s.B / 2, s.B / 2), rand(-20, 20), rand(-20, 20), rand(0.4, 0.7), rand(1.6, 2.6), 1, rand(40, 70));
  }
  s.onReef = reef;
}

// Damage over time lands in small bites, so it shows as a few numbers rather than a blur.
function tick(s, key, amt) {
  s[key] = (s[key] || 0) + amt;
  if (s[key] >= 2) { const d = s[key]; s[key] = 0; hurt(s, d); }
}
