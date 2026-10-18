import { showBanner } from '../../state.js';
import { exitBand } from './marks.js';

// Get the flagship (your fleet's `ship`th ship, the first by default) out through the exit at the top of
// the chart. Lose her and the battle is lost; enemy captains go for her first.
export default {
  id: 'breakthrough',
  about: 'Get the flagship out through the exit at the top of the chart.',
  params: { ship: 'which of your ships is the flagship (default 0, the first)' },
  tip: 'exit',
  draw: (o, G, api) => exitBand(G, api),
  setup(o, G) {
    const s = G.ships.filter((q) => q.team === 'player')[o.ship || 0];
    s.flag = true; s.exits = true;
    o.id = s.id; o.through = false;
  },
  escaped(o, G, s) {
    if (s.id !== o.id) return;
    o.through = true;
    showBanner(`${s.name} breaks through!`, 'The blockade is run', 2.4);
  },
  weigh: (o, G, s, t, d) => (t.id === o.id ? d * 0.65 : d),
  done: (o) => o.through,
  failed(o, G) {
    const s = G.ships.find((q) => q.id === o.id);
    return !o.through && (!s || s.team !== 'player' || s.state !== 'afloat') ? 'flagship' : null;
  },
  hud: () => ['Get the ★ flagship to the exit'],
  brief: () => 'Get your flagship (★) out through the exit at the top of the chart. The rest of the fleet can cover her.',
  won: () => 'The flagship runs the blockade.',
  lost: { flagship: 'The flagship is lost and the blockade holds. Refit at the shipyard and try again.' },
};
