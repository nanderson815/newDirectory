import { S, afloat, selfSailing } from '../../state.js';
import sink from './sink.js';
import boss from './boss.js';
import capture from './capture.js';
import treasure from './treasure.js';
import escort from './escort.js';
import hold from './hold.js';
import breakthrough from './breakthrough.js';
import timer from './timer.js';
import waves from './waves.js';
import protect from './protect.js';
import hunt from './hunt.js';
import reach from './reach.js';
import survive from './survive.js';

// Battle goals. A battle lists one or more as `goals: [{ kind, ...params }]` (or the shorthand
// `goal: 'boss'`); it is won when every goal is met and lost when any goal fails or the fleet is gone.
//
// A goal is { id, about, params, setup?, update?, done, failed?, hud?, brief, won?, lost?, ... }:
//   about / params         a one-line description and { param: description }, for docs and validation
//   setup(o, G, ctx)       build its state on `o` (this battle's copy of the goal def). ctx.place(x, y) maps
//                          portrait fractions to the map, ctx.add(def, team) adds a ship
//   update(o, G, dt)       every tick
//   done(o, G)             true once met
//   failed(o, G)           a reason key once it can no longer be met, else null
//   hud(o, G)              objective lines for the top-right of the screen
//   brief(o, B)            the order on the briefing screen; won(o, B) the line on the victory screen
//   lost: { reason: text } the line on the defeat screen for each failure reason
// Optional: draw(o, G, api) (chart markers: the exit band, chests, rings; api is the HUD's drawing kit, see
// drawMarkers in src/hud/hud.js), tip (a one-time HUD tip id), aiForts (enemy captains attack forts; true or a
// function of o), weigh(o, G, s, t, d) (bias an enemy captain's choice of target t at distance d),
// steer(o, G, s) (override an enemy captain's heading), sunk(o, G, s), escaped(o, G, s) (a ship left the
// battle: through the exit, or a runner over the edge), endless (never won; the battle ends when the fleet is
// gone).
// To add one: write a module like these, then list it here.
export const GOALS = Object.fromEntries([sink, boss, capture, treasure, escort, hold, breakthrough, timer, waves, protect, hunt, reach, survive].map((g) => [g.id, g]));

export const goalsOf = (B) => B.goals || [{ kind: B.goal || 'sink' }];
export const mainGoal = (B) => goalsOf(B)[0].kind;

export function setupGoals(G, B, ctx) {
  G.goals = goalsOf(B).map((d) => {
    const o = { ...d };
    const g = GOALS[o.kind];
    if (g && g.setup) g.setup(o, G, ctx, B);
    return o;
  });
}

// Runs fn(goalModule, o) for each of the battle's goals that has `hook`.
export function eachGoal(G, hook, fn) {
  for (const o of G.goals || []) { const g = GOALS[o.kind]; if (g && g[hook]) fn(g, o); }
}
// A flag is true or false, or a function of the goal's def (protect only sets aiForts when it guards forts).
export const hasGoalFlag = (G, flag) => (G.goals || []).some((o) => { const f = GOALS[o.kind] && GOALS[o.kind][flag]; return typeof f === 'function' ? f(o) : !!f; });

export const updateGoals = (G, dt) => eachGoal(G, 'update', (g, o) => g.update(o, G, dt));
export const goalsSunk = (G, s) => eachGoal(G, 'sunk', (g, o) => g.sunk(o, G, s));
export const goalsEscaped = (G, s) => eachGoal(G, 'escaped', (g, o) => g.escaped(o, G, s));

// The battle's verdict so far: { result: 'win' | 'lose' | 'end', reason } or null while it's still on.
export function judge(G) {
  for (const o of G.goals) {
    const g = GOALS[o.kind];
    const reason = g && g.failed ? g.failed(o, G) : null;
    if (reason) return { result: 'lose', reason };
  }
  const endless = hasGoalFlag(G, 'endless');
  if (!endless && G.goals.every((o) => GOALS[o.kind] && GOALS[o.kind].done(o, G))) return { result: 'win' };
  // Merchantmen under escort and allies don't count as the fleet: you can't fight the battle with them.
  const fleet = G.ships.some((s) => s.team === 'player' && afloat(s) && !selfSailing(s));
  if (!fleet) return endless ? { result: 'end' } : { result: 'lose', reason: 'fleet' };
  return null;
}

export const enemiesAfloat = (G) => G.ships.filter((s) => s.team === 'enemy' && afloat(s)).length;

export function goalLines(G) {
  const lines = [];
  eachGoal(G, 'hud', (g, o) => lines.push(...g.hud(o, G)));
  lines.push(`Enemy ships: ${enemiesAfloat(G)}`);
  return lines;
}

// Text for the briefing and results screens.
export const briefText = (B) => goalsOf(B).map((o) => GOALS[o.kind].brief(o, B)).join(' ');
export function winText(B) {
  const o = goalsOf(B)[0];
  return GOALS[o.kind].won ? GOALS[o.kind].won(o, B) : `The ${B.foe} is beaten.`;
}
export function loseText(B, reason) {
  for (const o of goalsOf(B)) { const t = GOALS[o.kind].lost && GOALS[o.kind].lost[reason]; if (t) return t; }
  return `Your fleet is sunk and the ${B.foe} holds the sea. Refit at the shipyard and try again.`;
}

export const currentGoals = () => (S.G ? S.G.goals : []);
