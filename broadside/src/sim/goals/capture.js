import { afloat, selfSailing } from '../../state.js';

// Take every enemy fort: shoot it silent, then land troops.
const targets = (G) => G.forts.filter((f) => f.origTeam === 'enemy');
const held = (f) => f.team === 'player' && f.state === 'active';
export default {
  id: 'capture',
  about: 'Take every enemy fort: shoot it silent, then land troops.',
  params: {},
  done: (o, G) => targets(G).length > 0 && targets(G).every(held),
  // Out of marines: no ship afloat can still land at a fort you need.
  failed(o, G) {
    const needed = targets(G).filter((f) => !held(f));
    const stuck = needed.length && !needed.some((f) => f.capture) &&
      !needed.some((f) => G.ships.some((s) => s.team === 'player' && afloat(s) && !selfSailing(s) && s.marines >= f.need));
    return stuck ? 'marines' : null;
  },
  hud: (o, G) => [`Forts taken: ${targets(G).filter(held).length}/${targets(G).length}`],
  brief(o, B) {
    const forts = B.forts.filter((f) => f.team !== 'player');
    return forts.length === 1
      ? `Take ${forts[0].name}: shoot it silent, then land troops.`
      : `Take all ${forts.length} forts: shoot each one silent, then land troops.`;
  },
  won(o, B) {
    const forts = B.forts.filter((f) => f.team !== 'player');
    return `The English flag flies over ${forts.length === 1 ? forts[0].name : forts.length === 2 ? 'both forts' : 'every fort'}.`;
  },
  lost: { marines: 'No ship has enough marines left to take the fort. Buy marines at the shipyard and try again.' },
};
