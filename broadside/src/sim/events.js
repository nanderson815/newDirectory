import { S, afloat, names, shipNamed, showBanner, showToast } from '../state.js';
import { PI } from '../util.js';
import { spawnShip } from './spawn.js';
import { placer, chartWidth } from './battle.js';
import { startFlee } from './exit.js';
import { GOALS } from './goals/index.js';
import { sfx } from '../audio/sfx.js';

// Scripted moments in a battle: `events: [{ ...conditions, ...actions }]`. Each event fires once, the first
// tick all of its conditions hold, and runs all of its actions in order. For example:
//   { at: 40, banner: ['Enemy reinforcements!', 'Two more sail'], spawn: [{ type: 'xebec', name: 'La Lanza', x: 0.2, y: 0.08, h: 90 }] }
//   { bossHp: 0.5, banner: ['She signals for help!'], spawn: [...] }
//   { shipNear: { x: 0.5, y: 0.3, r: 0.15 }, say: ['La Paga', 'Ingleses! Run!'], retreat: 'La Paga' }
//   { shipSunk: ['San Juan', 'San Mateo'], reveal: 8, heal: 0.2 }
// Ship names refer to ships in the battle (a list where a condition says so); positions are portrait fractions
// and radii fractions of the chart's width, as for the reach goal.
// To add a condition or an action, add a function here.
// Each entry is { about, fn(G, value) }.
export const WHEN = {
  at: { about: 'seconds into the battle', fn: (G, secs) => G.t >= secs },
  enemiesLeft: { about: 'at most this many enemy ships afloat', fn: (G, n) => G.ships.filter((s) => s.team === 'enemy' && afloat(s)).length <= n },
  bossHp: { about: 'the boss hull at or below this share (0-1)', fn: (G, k) => G.ships.some((s) => s.boss && afloat(s) && s.hp <= s.maxHp * k) },
  fortsHeld: { about: 'you hold at least this many forts', fn: (G, n) => G.forts.filter((f) => f.team === 'player' && f.state === 'active').length >= n },
  shipSunk: { about: 'the named ship (or every ship in a list) has gone down', fn: (G, n) => names(n).every((name) => G.ships.some((s) => s.name === name && (s.state === 'sinking' || s.state === 'sunk'))) },
  shipNear: {
    about: '{ name?, x, y, r }: an English ship (or the named ship, either side) within r of the spot',
    fn(G, { name, x, y, r = 0.1 }) {
      const [px, py] = placer(G)(x, y), pr = r * chartWidth(G);
      return G.ships.some((s) => afloat(s) && (name ? s.name === name : s.team === 'player') && Math.hypot(s.x - px, s.y - py) < pr);
    },
  },
  goalDone: { about: 'the goal at this index in goals is met', fn: (G, i) => { const o = G.goals[i]; return !!o && !!GOALS[o.kind] && GOALS[o.kind].done(o, G); } },
};
export const DO = {
  spawn: { about: "ship defs to add (enemy unless team: 'player')", fn: (G, defs) => { for (const d of defs) spawnShip(d, d.team || 'enemy'); } },
  banner: { about: '[title, subtitle] across the screen', fn: (G, [text, sub]) => { showBanner(text, sub || '', 2.4); sfx.fanfare(false); } },
  wind: { about: 'the wind backs round to blow toward this heading (degrees)', fn: (G, deg) => { G.wind.base = deg * PI / 180 + (G.land ? PI / 2 : 0); } },
  fog: { about: 'fog rolls in to this sight distance (0 lifts it)', fn: (G, sight) => { G.fog = sight; } },
  say: { about: '[ship name, text]: a line spoken over that ship', fn: (G, [name, text]) => { const s = shipNamed(G, name); if (s && afloat(s)) showToast(text, s, 2.8); } },
  retreat: {
    about: 'the named enemy ships (true: every enemy ship) break off and run for the edge of the chart',
    fn: (G, who) => { for (const s of G.ships) if (s.team === 'enemy' && (who === true || names(who).includes(s.name))) startFlee(s); },
  },
  reveal: { about: 'the fog lifts and every ship shows for this many seconds (true: the fog clears for good)', fn: (G, v) => { if (v === true) G.fog = 0; else G.revealUntil = G.t + v; } },
  heal: {
    about: 'every English ship afloat patches this share (0-1) of her full hull',
    fn: (G, k) => { for (const s of G.ships) if (s.team === 'player' && afloat(s)) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * k); },
  },
};

export function updateEvents(G) {
  for (const e of G.events) {
    if (e.fired) continue;
    if (!Object.keys(e).every((k) => !(k in WHEN) || WHEN[k].fn(G, e[k]))) continue;
    e.fired = true;
    for (const k of Object.keys(e)) if (k in DO) DO[k].fn(G, e[k]);
  }
}

export const currentEvents = () => (S.G ? S.G.events : []);
