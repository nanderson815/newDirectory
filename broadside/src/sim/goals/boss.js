import { afloat } from '../../state.js';

// Sink the boss: the ship carrying boss: { captain, title, hat }.
const bossOf = (B) => B.enemy.find((e) => e.boss).boss;
export default {
  id: 'boss',
  about: 'Sink the ship carrying boss: { captain, title, hat }; wins that captain\'s hat.',
  params: {},
  done: (o, G) => !G.ships.some((s) => s.boss && afloat(s)),
  hud: () => ['Sink the boss'],
  brief: (o, B) => `Sink ${bossOf(B).captain}’s ${bossOf(B).title}.`,
  won: (o, B) => `${bossOf(B).captain} strikes the colours.`,
};
