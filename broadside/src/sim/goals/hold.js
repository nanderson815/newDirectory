import { showBanner } from '../../state.js';

// Hold your forts (forts with team: 'player') for `secs` seconds. A silenced fort must be retaken
// (land troops) within `grace` seconds. Enemy captains go for the forts.
const held = (G) => G.forts.some((f) => f.team === 'player' && f.state === 'active');
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export default {
  id: 'hold',
  about: 'Hold your forts (team: \'player\') until the clock runs out.',
  params: { secs: 'seconds to hold', grace: 'seconds to retake a silenced fort (default 18)' },
  aiForts: true,
  setup(o) { o.grace = o.grace || 18; o.t = 0; o.down = 0; },
  update(o, G, dt) {
    o.t += dt;
    if (held(G)) { o.down = 0; return; }
    if (o.down === 0) showBanner('The fort is silenced!', `Land troops to retake it within ${o.grace}s`, 2.4);
    o.down += dt;
  },
  done: (o, G) => o.t >= o.secs && held(G),
  failed: (o) => (o.down >= o.grace ? 'fort' : null),
  hud(o) {
    const lines = [`Hold the fort: ${clock(Math.max(0, Math.ceil(o.secs - o.t)))}`];
    if (o.down > 0) lines.push(`Retake it! ${Math.max(0, Math.ceil(o.grace - o.down))}s`);
    return lines;
  },
  brief(o, B) {
    const forts = B.forts.filter((f) => f.team === 'player').map((f) => f.name).join(' and ');
    return `Hold ${forts} for ${clock(o.secs)}. If it falls silent, land troops to retake it within ${o.grace || 18} seconds.`;
  },
  won: (o, B) => `${B.forts.find((f) => f.team === 'player').name} still flies the English flag.`,
  lost: { fort: 'The fort fell and the harbour with it. Refit at the shipyard and try again.' },
};
