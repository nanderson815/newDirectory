import { S, afloat } from '../state.js';
import { lookouts } from './land.js';

// Fog (a battle's `fog`: how far your lookouts see): enemy ships beyond every lookout's sight are hidden,
// so they aren't drawn, aren't shown on the HUD and can't be aimed at. A reveal event lifts it for a while.
export function updateFog() {
  const G = S.G;
  if (!G.fog || G.t < (G.revealUntil || 0)) { for (const s of G.ships) s.hidden = false; return; }
  const eyes = [];
  for (const s of G.ships) if (s.team === 'player' && afloat(s)) eyes.push(s);
  for (const f of G.forts) if (f.team === 'player' && f.state === 'active') eyes.push(f);
  // A lighthouse with sight (src/sim/land.js) lifts the fog around it.
  const towers = lookouts(G);
  for (const s of G.ships) {
    // At night a ship on fire lights herself up for every gunner on the chart.
    if (G.night && (s.burning || s.fireT > 0)) { s.hidden = false; continue; }
    s.hidden = s.team !== 'player' && !eyes.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < G.fog)
      && !towers.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < e.r);
  }
}
