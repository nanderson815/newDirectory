import { S, selfSailing, showToast } from '../state.js';
import { sfx } from '../audio/sfx.js';
import { inExit } from './battle.js';
import { goalsEscaped } from './goals/index.js';

// Ships leave a battle two ways. Ships marked `exits` (merchantmen under escort, a breakthrough's flagship) sail
// out through the exit band at the top of the chart. A ship that breaks off (`fleeing`: the flee ability, or a
// retreat event) runs for the nearest edge of the map and is gone once she reaches it. Either way her state
// becomes 'escaped': not afloat, so she no longer counts for sink goals, but not sunk either.
const EDGE = 34; // how close to the edge a runner must get to slip away

// Marks a ship as gone from the battle and tells the goals.
function escape(s) {
  const G = S.G;
  s.state = 'escaped'; s.path = []; s.pivot = null;
  goalsEscaped(G, s);
  if (S.selected === s) S.selected = G.ships.find((o) => o.team === 'player' && o.state === 'afloat' && !selfSailing(o)) || null;
}

// Returns true if she just left.
export function checkExit(s) {
  const G = S.G;
  // Only ships with captains of their own run: the enemy, allies and merchantmen.
  if (s.fleeing && (s.team !== 'player' || selfSailing(s))) {
    if (Math.min(s.x, s.y, G.W - s.x, G.H - s.y) > EDGE) return false;
    s.fled = true; s.fledT = 0; s.h = edgeHeading(G, s);
    escape(s);
    sfx.splash(s.x, s.y, 0.5);
    return true;
  }
  if (!s.exits || s.team !== 'player' || !inExit(G, s)) return false;
  escape(s);
  sfx.fanfare(false);
  return true;
}

// The heading straight out over the nearest edge of the map.
export function edgeHeading(G, s) {
  const d = [s.x, G.W - s.x, s.y, G.H - s.y], i = d.indexOf(Math.min(...d));
  return [Math.PI, 0, -Math.PI / 2, Math.PI / 2][i];
}

// She breaks off and runs for it. Hulks get under way; a ship already running, gone or sunk is left alone.
export function startFlee(s, say) {
  if (s.fleeing || s.state !== 'afloat' || (s.team === 'player' && !selfSailing(s))) return; // your own ships take your orders
  s.fleeing = true; s.passive = false; s.targetId = null;
  if (say) showToast(say, s, 2);
}

// A runner that got away keeps sailing off the chart for a moment before she's lost to sight.
export function sailOff(s, dt) {
  s.fledT += dt;
  s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt;
}
