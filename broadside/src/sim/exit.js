import { S } from '../state.js';
import { sfx } from '../audio/sfx.js';
import { inExit } from './battle.js';
import { goalsEscaped } from './goals/index.js';

// Ships marked `exits` (merchantmen under escort, a breakthrough's flagship) leave the battle through the exit
// band at the top of the chart. Returns true if she just left.
export function checkExit(s) {
  const G = S.G;
  if (!s.exits || s.team !== 'player' || !inExit(G, s)) return false;
  s.state = 'escaped'; s.path = []; s.pivot = null;
  goalsEscaped(G, s);
  sfx.fanfare(false);
  if (S.selected === s) S.selected = G.ships.find((o) => o.team === 'player' && o.state === 'afloat' && !o.escort) || null;
  return true;
}
