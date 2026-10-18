import { afloat } from '../../state.js';
import { STORY } from '../../config/story.js';

// Sink the boss: the ship carrying boss: { captain, title, hat }.
const bossOf = (B) => B.enemy.find((e) => e.boss).boss;
// How a sentence names the boss ("the Capitán General"), and whether the boss is a "she" (see config/story.js).
const who = (B) => (STORY[B.id] && STORY[B.id].who) || bossOf(B).captain;
const his = (B) => (STORY[B.id] && STORY[B.id].her ? 'her' : 'his');
const cap = (t) => t[0].toUpperCase() + t.slice(1);
export default {
  id: 'boss',
  done: (o, G) => !G.ships.some((s) => s.boss && afloat(s)),
  hud: () => ['Sink the boss'],
  brief: (o, B) => `Sink ${who(B)}’s ${bossOf(B).title}.`,
  won: (o, B) => `${cap(who(B))} strikes ${his(B)} colours.`,
};
