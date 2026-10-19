import { S, afloat, showBanner } from '../../state.js';
import { chartWidth } from '../battle.js';
import { sfx } from '../../audio/sfx.js';

// Bring a ship (any English ship, or the one named) into the ring marked on the chart at x, y (portrait
// fractions) with radius r (a fraction of the chart's width), and keep one there for `secs` if given. Once
// reached it stays met. Lose the named ship first and the battle is lost.
const DASH = [9, 8];
const by = (o, G) => G.ships.filter((s) => s.team === 'player' && afloat(s) && (!o.ship || s.name === o.ship));
const inside = (o, G) => by(o, G).some((s) => Math.hypot(s.x - o.px, s.y - o.py) < o.pr);

export default {
  id: 'reach',
  about: 'Bring a ship (or the named one) into a ring marked on the chart, and hold it there if secs is given.',
  params: {
    x: 'centre across the chart (portrait fraction)', y: 'centre down the chart (portrait fraction)',
    r: 'radius as a fraction of the chart\'s width (default 0.1)', ship: 'optional: the name of the English ship that must get there',
    secs: 'optional: seconds a ship must stay inside', label: 'the marker\'s caption (default "Sail here")',
  },
  tip: 'reach',
  setup(o, G, ctx) {
    [o.px, o.py] = ctx.place(o.x, o.y);
    o.pr = (o.r || 0.1) * chartWidth(G);
    o.held = 0; o.got = false;
  },
  update(o, G, dt) {
    if (o.got) return;
    if (!inside(o, G)) { o.held = 0; return; }
    o.held += dt;
    if (o.held < (o.secs || 0)) return;
    o.got = true;
    showBanner(o.secs ? 'Position held!' : 'Made it!', o.label || '', 1.8);
    sfx.fanfare(false);
  },
  done: (o) => o.got,
  failed: (o, G) => (!o.got && o.ship && !by(o, G).length ? 'ship' : null),
  hud(o) {
    const lines = [`${o.ship ? `${o.ship}: ` : ''}${o.label || 'reach the gold ring'}`.replace(/^./, (c) => c.toUpperCase())];
    if (o.secs && !o.got) lines.push(o.held > 0 ? `Hold on: ${Math.max(0, Math.ceil(o.secs - o.held))}s` : `Hold it for ${o.secs}s`);
    return lines;
  },
  // A fine gold ring with a faint wash and its caption, and a timer ring while a ship holds it.
  draw(o, G, api) {
    if (o.got) return;
    const { ctx } = api;
    api.seaCircle(o.px, o.py, o.pr, 48);
    ctx.fillStyle = api.tint(api.MARK.chosen, 0.06 + 0.03 * Math.sin(S.clock * 2.5)); ctx.fill();
    api.stroke(api.tint(api.MARK.chosen, 0.85), { width: api.LINE.thin, dash: DASH, offset: -S.clock * 14 });
    // The caption sits over the ring and the timer under it, clear of a ship inside.
    const top = api.proj(o.px, o.py - o.pr, 0), bot = api.proj(o.px, o.py + o.pr, 0);
    api.label(o.label || 'Sail here', top.x, top.y - 12, api.MARK.chosen, { size: 11 });
    if (o.secs && o.held > 0) api.progress(bot.x, bot.y + 16, Math.min(1, o.held / o.secs));
  },
  brief: (o) => `${o.ship ? `Bring ${o.ship}` : 'Bring a ship'} into the gold ring marked on the chart${o.secs ? ` and hold it there for ${o.secs} seconds` : ''}.`,
  won: (o) => (o.ship ? `${o.ship} reaches the mark.` : 'The fleet reaches the mark.'),
  lost: { ship: 'The ship that had to get through is lost. Refit at the shipyard and try again.' },
};
