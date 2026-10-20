import { S, afloat, selfSailing, showBanner, showToast } from '../../state.js';
import { chartWidth } from '../battle.js';
import { spawnShip } from '../spawn.js';
import { sfx } from '../../audio/sfx.js';
import { exitBand, shipMark } from './marks.js';

// Free captives held ashore: anchor a ship carrying `need` marines in the gold ring off the town (once the named
// battery, if any, is silenced or taken) and hold her there `secs` seconds while the boats go in. The landing party
// brings the captives off in a boat of their own, which sails for the exit at the top of the chart by herself;
// get her through. Enemy captains go for the boat. Lose the boat, or every ship with marines enough, and it's lost.
const DASH = [9, 8];
const still = (s) => s.pivot != null || s.v < s.speed * 0.35;
const fortOf = (o, G) => (o.fort ? G.forts.find((f) => f.name === o.fort) : null);
// The battery must be silent (or yours) before the boats can go in.
const guarded = (o, G) => { const f = fortOf(o, G); return !!f && f.team !== 'player' && f.state === 'active'; };
const landers = (o, G) => G.ships.filter((s) => s.team === 'player' && afloat(s) && !selfSailing(s) && s.marines >= o.need);
const boatOf = (o, G) => (o.boatId != null ? G.ships.find((s) => s.id === o.boatId) : null);

export default {
  id: 'rescue',
  about: 'Land marines from a ship anchored in the gold ring off a town to free the captives, then get their boat out through the exit.',
  params: {
    x: 'the landing ring, across the chart (portrait fraction; in the water off the town)',
    y: 'the landing ring, down the chart (portrait fraction)',
    r: 'optional: ring radius as a fraction of the chart\'s width (default 0.09)',
    need: 'optional: marines the landing takes (default 10)',
    secs: 'optional: seconds she must lie in the ring while the boats are away (default 4)',
    fort: 'optional: name of the enemy fort that must be silenced or taken first',
    town: 'optional: what the briefing calls the place (default "the town")',
    captives: 'optional: how many captives come off, for the banner (default 40)',
    boat: 'optional: ship def of the captives\' boat (default a felucca, the Deliverance)',
  },
  tip: 'rescue',
  setup(o, G, ctx) {
    [o.px, o.py] = ctx.place(o.x, o.y);
    o.pr = (o.r || 0.09) * chartWidth(G);
    o.need = o.need || 10; o.secs = o.secs == null ? 4 : o.secs;
    o.held = 0; o.stage = 'land'; o.boatId = null; o.out = false; o.landerId = null;
  },
  update(o, G, dt) {
    if (o.stage !== 'land') return;
    if (guarded(o, G)) { o.held = 0; return; }
    const s = landers(o, G).find((q) => Math.hypot(q.x - o.px, q.y - o.py) < o.pr && still(q));
    if (!s) { o.held = 0; o.landerId = null; return; }
    if (o.landerId !== s.id) { o.landerId = s.id; o.held = 0; showToast('Boats away for the shore', s, 1.6); }
    o.held += dt;
    if (o.held < o.secs) return;
    s.marines -= o.need;
    o.stage = 'boat';
    const def = { type: 'felucca', name: 'Deliverance', ...(o.boat || {}) };
    const b = spawnShip({ ...def, x: o.x, y: o.y, h: -90, escort: true }, 'player', { x: o.px, y: o.py, h: Math.atan2(-1, 0) + (G.land ? Math.PI / 2 : 0) });
    o.boatId = b.id;
    showBanner(`${o.captives || 40} captives are free!`, `Get the ${b.name} out through the exit`, 2.6);
    sfx.fanfare(false);
  },
  escaped(o, G, s) {
    if (s.id !== o.boatId) return;
    o.out = true;
    showBanner(`The ${s.name} is through!`, 'The captives are safe', 2.4);
  },
  weigh: (o, G, s, t, d) => (t.id === o.boatId ? d * 0.5 : d),
  done: (o) => o.out,
  failed(o, G) {
    if (o.out) return null;
    const b = boatOf(o, G);
    if (b) return b.team !== 'player' || (b.state !== 'afloat' && b.state !== 'escaped') ? 'boat' : null;
    return o.stage === 'land' && !landers(o, G).length ? 'marines' : null;
  },
  hud(o, G) {
    if (o.stage === 'land') {
      if (guarded(o, G)) return [`Silence ${o.fort}`, `Then land ${o.need} marines`];
      return [o.held > 0 ? `Landing: ${Math.max(0, Math.ceil(o.secs - o.held))}s` : `Anchor in the ring: ${o.need} marines`];
    }
    return [o.out ? 'The captives are safe' : `Get the ${(boatOf(o, G) || {}).name || 'boat'} to the exit`];
  },
  draw(o, G, api) {
    if (o.stage === 'land') {
      const { ctx } = api, shut = guarded(o, G);
      api.seaCircle(o.px, o.py, o.pr, 48);
      ctx.fillStyle = api.tint(api.MARK.chosen, shut ? 0.03 : 0.06 + 0.03 * Math.sin(S.clock * 2.5)); ctx.fill();
      api.stroke(api.tint(api.MARK.chosen, shut ? 0.45 : 0.85), { width: api.LINE.thin, dash: DASH, offset: -S.clock * 14 });
      const top = api.proj(o.px, o.py - o.pr, 0), bot = api.proj(o.px, o.py + o.pr, 0);
      api.label(shut ? 'Land here, once the battery is silent' : 'Land here', top.x, top.y - 12, api.MARK.chosen, { size: 11 });
      if (o.held > 0) api.progress(bot.x, bot.y + 16, Math.min(1, o.held / o.secs));
      return;
    }
    const b = boatOf(o, G);
    if (b && !o.out) { shipMark(api, b, 'Captives', api.MARK.friend, true); exitBand(G, api); }
  },
  validate(o, B) {
    const out = [];
    for (const k of ['x', 'y']) if (!(typeof o[k] === 'number' && o[k] >= 0 && o[k] <= 1)) out.push(`${k} must be a map fraction`);
    if (o.fort && !(B.forts || []).some((f) => f && f.name === o.fort && f.team !== 'player')) out.push(`no enemy fort named '${o.fort}'`);
    if (o.boat && (typeof o.boat !== 'object' || !o.boat.name)) out.push('boat must be a ship def with a name');
    return out;
  },
  brief: (o) => `Free the English captives held in ${o.town || 'the town'}: ${o.fort ? `silence ${o.fort}, then ` : ''}anchor a ship with ${o.need || 10} marines in the gold ring until the boats are back. Then get the captives’ boat out through the exit at the top of the chart.`,
  won: (o) => `The captives of ${o.town || 'the town'} are free and on their way home.`,
  lost: {
    boat: 'The captives’ boat is lost. Refit at the shipyard and try again.',
    marines: 'No ship has marines enough left to go ashore. Buy marines at the shipyard and try again.',
  },
};
