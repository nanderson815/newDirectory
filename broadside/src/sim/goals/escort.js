import { afloat, showBanner } from '../../state.js';

// Bring `need` of the merchantmen in `ships` (ship defs) out through the exit at the top of the chart.
// They sail themselves and can't be given orders; enemy captains go for them first.
const sailing = (o, G) => G.ships.filter((s) => o.ids.includes(s.id) && s.team === 'player' && afloat(s)).length;
export default {
  id: 'escort',
  exit: true,
  tip: 'exit',
  setup(o, G, ctx) {
    o.got = 0;
    o.ids = o.ships.map((d) => ctx.add({ ...d, escort: true }, 'player').id);
  },
  escaped(o, G, s) {
    if (!o.ids.includes(s.id)) return;
    o.got++;
    showBanner(`${s.name} is through!`, `${o.got}/${o.need} merchantmen safe`, 2);
  },
  weigh: (o, G, s, t, d) => (o.ids.includes(t.id) ? d * 0.6 : d),
  done: (o) => o.got >= o.need,
  failed: (o, G) => (o.got + sailing(o, G) < o.need ? 'escort' : null),
  hud: (o, G) => [`Merchantmen through: ${o.got}/${o.need}`, `Still sailing: ${sailing(o, G)}`],
  brief(o) {
    const names = o.ships.map((d) => d.name).join(' and ');
    return `Bring ${o.need === o.ships.length ? 'both' : `${o.need} of the ${o.ships.length}`} merchantmen (${names}) out through the exit at the top of the chart. They sail themselves; keep the raiders off them.`;
  },
  won: () => 'The merchantmen make harbour with their cargo safe.',
  lost: { escort: 'The merchantmen are lost with all their cargo. Refit at the shipyard and try again.' },
};
