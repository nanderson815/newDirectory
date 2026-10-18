import { S } from '../state.js';
import { PI } from '../util.js';
import { makeShip, nextId, placer } from './battle.js';

// Adds a ship to a battle already under way. A def is the same as in a battle definition (positions are
// portrait fractions); `at` ({ x, y, h }) places her in map coordinates instead.
export function spawnShip(def, team = 'enemy', at = null) {
  const G = S.G;
  const d = { x: 0.5, y: 0.08, h: 90, ...def, faction: def.faction ?? (team === 'enemy' ? G.faction : null) };
  const s = makeShip(d, team, placer(G), G.land ? PI / 2 : 0, nextId(G), G.ai);
  if (at) { s.x = at.x; s.y = at.y; if (at.h != null) s.h = at.h; }
  G.ships.push(s);
  if (S.hooks.onSpawn) S.hooks.onSpawn(s);
  return s;
}
