import { names } from '../../state.js';
import { shipMark } from './marks.js';

// Sink (or take) the named enemy ships; the rest of the enemy can be left alone. A quarry that gets away (the
// flee ability, a retreat event) loses the battle. Quarry may arrive later in the battle by a spawn event.
const quarry = (o, G) => G.ships.filter((s) => s.origTeam === 'enemy' && names(o.ships).includes(s.name));
const gone = (s) => s.state === 'sinking' || s.state === 'sunk' || s.team === 'player';
const list = (n) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0]);

export default {
  id: 'hunt',
  about: 'Sink (or take) the named enemy ships before they get away; the rest are optional.',
  params: { ships: 'names of the enemy ships to sink (a name or a list)' },
  tip: 'hunt',
  done(o, G) {
    const q = quarry(o, G);
    return names(o.ships).every((n) => q.some((s) => s.name === n && gone(s)));
  },
  failed: (o, G) => (quarry(o, G).some((s) => s.state === 'escaped') ? 'escaped' : null),
  hud(o, G) {
    const q = quarry(o, G), n = names(o.ships);
    const lines = [n.length === 1 ? `Sink ${n[0]}` : `Quarry sunk: ${q.filter(gone).length}/${n.length}`];
    for (const s of q) if (s.fleeing && s.state === 'afloat') lines.push(`${s.name} is running!`);
    return lines;
  },
  draw(o, G, api) {
    for (const s of quarry(o, G)) if (s.team === 'enemy') shipMark(api, s, 'Target', api.MARK.enemy, false);
  },
  brief(o, B) {
    const n = names(o.ships), runs = B.enemy.some((d) => n.includes(d.name) && d.abilities && d.abilities.flee);
    return `Sink ${list(n)}; the rest don’t matter.${runs ? ` Don’t let ${n.length > 1 ? 'them' : 'her'} get away.` : ''}`;
  },
  won: (o) => `${list(names(o.ships))} ${names(o.ships).length > 1 ? 'are' : 'is'} on the bottom.`,
  lost: { escaped: 'Your quarry got clean away. Refit at the shipyard and try again.' },
};
