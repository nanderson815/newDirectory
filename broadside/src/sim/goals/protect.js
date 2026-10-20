import { afloat, names } from '../../state.js';
import { ring, shipMark } from './marks.js';

// Keep the named ships afloat and the named forts firing; lose one and the battle is lost. `ships` are names
// of any English ship (your own, a merchantman, an ally), or a number for your fleet's nth ship (0 = the
// first); `allies` are ship defs this goal adds as allied captains who fight on their own. Without `secs` it is
// met as long as nothing is lost, so pair it with a goal that ends the battle; with `secs` it ends the battle.
// Enemy captains go for whatever you're guarding first.
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// The guarded ships, found by name the first time they're needed: other goals may add them after this one's setup.
function guarded(o, G) {
  if (!o.ids) {
    const by = names(o.ships).map((n) => (typeof n === 'number' ? G.ships.filter((s) => s.origTeam === 'player')[n] : G.ships.find((s) => s.name === n && s.team === 'player')));
    o.ids = [...o.allyIds, ...by.filter(Boolean).map((s) => s.id)];
  }
  return G.ships.filter((s) => o.ids.includes(s.id));
}
const forts = (o, G) => G.forts.filter((f) => names(o.forts).includes(f.name));
const lostShip = (s) => s.team !== 'player' || (s.state !== 'afloat' && s.state !== 'escaped');
const lostFort = (f) => f.team !== 'player' || f.state !== 'active';
function who(o, B) {
  const n = [...names(o.ships).map((x) => (typeof x === 'number' ? (x ? `your ship no. ${x + 1}` : 'your leading ship') : x)),
    ...(o.allies || []).map((d) => d.name), ...names(o.forts)];
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0] || 'your charges';
}

export default {
  id: 'protect',
  about: 'Keep named ships afloat and named forts firing; lose any one and the battle is lost.',
  params: {
    ships: 'optional: names of English ships to keep afloat (a number is your fleet\'s nth ship, 0 = the first)',
    allies: 'optional: ship defs added as allied captains who sail and fight on their own (also guarded)',
    forts: 'optional: names of your forts that must keep firing',
    secs: 'optional: seconds to keep them safe, after which this goal is met (without it, pair with another goal)',
  },
  tip: 'protect',
  aiForts: (o) => names(o.forts).length > 0,
  setup(o, G, ctx) {
    o.allyIds = (o.allies || []).map((d) => ctx.add({ x: 0.5, y: 0.7, h: -90, ...d, ally: true }, 'player').id);
    o.ids = null;
  },
  weigh: (o, G, s, t, d) => ((t.kind === 'fort' ? names(o.forts).includes(t.name) : guarded(o, G).includes(t)) ? d * 0.7 : d),
  done: (o, G) => !o.secs || G.t >= o.secs,
  failed: (o, G) => (guarded(o, G).some(lostShip) || forts(o, G).some(lostFort) ? 'lost' : null),
  hud(o, G) {
    const left = guarded(o, G).length + forts(o, G).length;
    const head = o.secs ? `Keep them safe: ${clock(Math.max(0, Math.ceil(o.secs - G.t)))}` : null;
    return [head, `Protect: ${left === 1 ? (guarded(o, G)[0] || forts(o, G)[0]).name : `${left} in your care`}`].filter(Boolean);
  },
  draw(o, G, api) {
    for (const s of guarded(o, G)) shipMark(api, s, 'Protect', api.MARK.friend, true);
    for (const f of forts(o, G)) {
      if (lostFort(f)) continue;
      const is = G.islands[f.island];
      ring(api, f.x, f.y, is.r + 16, api.MARK.friend, true);
      const q = api.projTo(f.x, f.y + is.r + 16, 4);
      api.label('Protect', q.x, q.y + 10, api.MARK.friend);
    }
  },
  brief: (o, B) => `Keep ${who(o, B)} safe${o.secs ? ` for ${clock(o.secs)}` : ''}: lose ${names(o.ships).length + (o.allies || []).length + names(o.forts).length > 1 ? 'any of them' : 'it'} and the battle is lost.`,
  won: (o, B) => { const w = who(o, B); return `${w[0].toUpperCase()}${w.slice(1)} came through safe.`; },
  lost: { lost: 'What you were sent to protect is lost. Refit at the shipyard and try again.' },
};
