import { S, afloat, showBanner } from '../state.js';
import { PI } from '../util.js';
import { spawnShip } from './spawn.js';
import { sfx } from '../audio/sfx.js';

// Scripted moments in a battle: `events: [{ ...conditions, ...actions }]`. Each event fires once, the first
// tick all of its conditions hold, and runs all of its actions in order. For example:
//   { at: 40, banner: ['Enemy reinforcements!', 'Two more sail'], spawn: [{ type: 'xebec', name: 'La Lanza', x: 0.2, y: 0.08, h: 90 }] }
//   { bossHp: 0.5, banner: ['She signals for help!'], spawn: [...] }
// To add a condition or an action, add a function here.
export const WHEN = {
  at: (G, secs) => G.t >= secs,                                                     // seconds into the battle
  enemiesLeft: (G, n) => G.ships.filter((s) => s.team === 'enemy' && afloat(s)).length <= n,
  bossHp: (G, k) => G.ships.some((s) => s.boss && afloat(s) && s.hp <= s.maxHp * k), // boss hull at or below k
  fortsHeld: (G, n) => G.forts.filter((f) => f.team === 'player' && f.state === 'active').length >= n,
};
export const DO = {
  spawn: (G, defs) => { for (const d of defs) spawnShip(d, d.team || 'enemy'); },      // ship defs, enemy unless team: 'player'
  banner: (G, [text, sub]) => { showBanner(text, sub || '', 2.4); sfx.fanfare(false); },
  wind: (G, deg) => { G.wind.base = deg * PI / 180 + (G.land ? PI / 2 : 0); },        // the wind backs round to `deg`
  fog: (G, sight) => { G.fog = sight; },                                              // fog rolls in (0 lifts it)
};

export function updateEvents(G) {
  for (const e of G.events) {
    if (e.fired) continue;
    if (!Object.keys(e).every((k) => !(k in WHEN) || WHEN[k](G, e[k]))) continue;
    e.fired = true;
    for (const k of Object.keys(e)) if (k in DO) DO[k](G, e[k]);
  }
}

export const currentEvents = () => (S.G ? S.G.events : []);
