import { afloat } from '../../state.js';

// Sink the boss: the ship carrying boss: { captain, title, hat }.
const bossOf = (B) => B.enemy.find((e) => e.boss).boss;
export default {
  id: 'boss',
  about: 'Sink the ship carrying boss: { captain, title, hat }; wins that captain\'s hat.',
  params: {},
  done: (o, G) => !G.ships.some((s) => s.boss && afloat(s)),
  // A boss who runs (the flee ability, a retreat event) and makes the edge has got away.
  failed: (o, G) => (G.ships.some((s) => s.boss && s.state === 'escaped') ? 'escaped' : null),
  hud: () => ['Sink the boss'],
  brief: (o, B) => `Sink ${bossOf(B).captain}’s ${bossOf(B).title}.`,
  won: (o, B) => `${bossOf(B).captain} strikes the colours.`,
  lost: { escaped: 'The boss slipped away to fight another day. Refit at the shipyard and try again.' },
};
