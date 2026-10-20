import { names } from '../../state.js';
import { shipMark } from './marks.js';
import { BOARDING } from '../../config/ammo.js';

// Take the named enemy ships as prizes: batter each below the boarding mark, come alongside and board her. Sinking
// her or letting her get away fails it. Suits a bonus (retake a captured English merchantman).
const quarry = (o, G) => G.ships.filter((s) => s.origTeam === 'enemy' && names(o.ships).includes(s.name));
const taken = (s) => s.team === 'player' && s.state === 'afloat';
const list = (n) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0]);

export default {
  id: 'take',
  about: 'Board the named enemy ships and take them as prizes; sinking one or letting her escape fails it.',
  params: { ships: 'names of the enemy ships to take (a name or a list)' },
  done: (o, G) => { const q = quarry(o, G); return names(o.ships).every((n) => q.some((s) => s.name === n && taken(s))); },
  failed: (o, G) => (quarry(o, G).some((s) => s.state === 'sinking' || s.state === 'sunk' || s.state === 'escaped') ? 'lost' : null),
  hud(o, G) {
    const q = quarry(o, G), n = names(o.ships);
    return [n.length === 1 ? `Take ${n[0]} as a prize` : `Prizes taken: ${q.filter(taken).length}/${n.length}`];
  },
  draw(o, G, api) { for (const s of quarry(o, G)) if (s.team === 'enemy') shipMark(api, s, 'Take her', api.MARK.enemy, true); },
  validate: (o, B) => names(o.ships).filter((n) => !(B.enemy || []).some((e) => e.name === n) && !(B.events || []).some((e) => (e.spawn || []).some((d) => d.name === n))).map((n) => `no enemy ship named '${n}'`),
  brief: (o) => `Take ${list(names(o.ships))}: batter her below ${Math.round(BOARDING.hpFrac * 100)}% of her hull, come alongside and tap Board. Don’t sink her.`,
  won: (o) => `${list(names(o.ships))} ${names(o.ships).length > 1 ? 'sail' : 'sails'} with you as a prize.`,
  lost: { lost: 'The ship you were to take is sunk or gone. Refit at the shipyard and try again.' },
};
