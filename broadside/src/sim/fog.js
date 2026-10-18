import { S, afloat } from '../state.js';

// Fog (a battle's `fog`: how far your lookouts see): enemy ships beyond every lookout's sight are hidden,
// so they aren't drawn, aren't shown on the HUD and can't be aimed at.
export function updateFog() {
  const G = S.G;
  if (!G.fog) { for (const s of G.ships) s.hidden = false; return; }
  const eyes = [];
  for (const s of G.ships) if (s.team === 'player' && afloat(s)) eyes.push(s);
  for (const f of G.forts) if (f.team === 'player' && f.state === 'active') eyes.push(f);
  for (const s of G.ships) s.hidden = s.team !== 'player' && !eyes.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < G.fog);
}
