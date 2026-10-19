import { S, afloat, showToast, selfSailing } from '../../state.js';
import { rand } from '../../util.js';
import { avoidIslands } from '../steering.js';
import { spawn } from '../particles.js';
import { sfx } from '../../audio/sfx.js';

// Haul up `need` of the floating `chests` (portrait fractions) by sailing over them. Enemy salvors haul
// them up too; sink one and her chests float free again, board her and they're yours.
const REACH = 14;
export const chestsLeft = (G) => G.chests.filter((c) => !c.taken).length;
const carried = (G) => G.ships.reduce((n, s) => n + (s.team === 'enemy' && afloat(s) && s.loot ? s.loot.length : 0), 0);

export default {
  id: 'treasure',
  about: 'Haul up floating chests by sailing over them; salvors carry chests until sunk or boarded.',
  params: { need: 'chests to haul up', chests: 'chest positions [{ x, y }] (portrait fractions)' },
  tip: 'chest',
  setup(o, G, ctx) {
    o.got = 0;
    for (const c of o.chests) { const [x, y] = ctx.place(c.x, c.y); G.chests.push({ x, y, taken: false }); }
  },
  update(o, G) {
    G.chests.forEach((c, i) => {
      if (c.taken) return;
      for (const s of G.ships) {
        if (!afloat(s) || selfSailing(s) || Math.hypot(s.x - c.x, s.y - c.y) > s.L * 0.5 + REACH) continue;
        c.taken = true;
        for (let k = 0; k < 10; k++) spawn('flash', c.x + rand(-8, 8), c.y + rand(-8, 8), 0, 0, rand(0.2, 0.4), rand(3, 6), rand(4, 12), 0);
        if (s.team === 'player') { o.got++; showToast(`Treasure! ${o.got}/${o.need}`, s, 1.6); sfx.coin(); }
        else { (s.loot = s.loot || []).push(i); showToast('She’s hauled up a chest!', s, 1.6); sfx.splash(c.x, c.y, 0.5); }
        break;
      }
    });
    // A salvor taken as a prize hands over what she was carrying.
    for (const s of G.ships) {
      if (s.team === 'player' && s.loot && s.loot.length) { o.got += s.loot.length; showToast(`Treasure! ${o.got}/${o.need}`, s, 1.6); sfx.coin(); s.loot = []; }
    }
  },
  sunk(o, G, s) {
    if (!s.loot || !s.loot.length) return;
    for (const i of s.loot) { const c = G.chests[i]; c.taken = false; c.x = s.x + rand(-20, 20); c.y = s.y + rand(-20, 20); }
    s.loot = [];
  },
  // Half the enemy captains go salvaging while no English ship is close.
  steer(o, G, s) {
    if (s.id % 2 || s.boss || G.ships.some((p) => p.team !== s.team && afloat(p) && Math.hypot(p.x - s.x, p.y - s.y) < 170)) return null;
    let c = null, cd = Infinity;
    for (const q of G.chests) { if (q.taken) continue; const d = Math.hypot(q.x - s.x, q.y - s.y); if (d < cd) { cd = d; c = q; } }
    return c ? avoidIslands(s, Math.atan2(c.y - s.y, c.x - s.x), cd) : null;
  },
  done: (o) => o.got >= o.need,
  // Chests carried by salvors still count: they can be won back.
  failed: (o, G) => (o.got + chestsLeft(G) + carried(G) < o.need ? 'treasure' : null),
  hud: (o, G) => [`Treasure: ${o.got}/${o.need}`, `Chests in the water: ${chestsLeft(G)}`],
  // A fine gold ring breathes over each chest still in the water.
  draw(o, G, api) {
    if (!api.once('chests')) return;
    for (const c of G.chests) {
      if (c.taken) continue;
      api.ring(c.x, c.y, 15 + Math.sin(S.clock * 2.5 + c.x) * 2, 'rgba(246,210,122,0.9)', { width: 1.5, n: 24 });
    }
  },
  brief: (o) => `Haul up ${o.need} of the ${o.chests.length} floating chests by sailing over them. Sink or board a salvor to take back what she has hauled.`,
  won: (o) => `${o.need} chests of Spanish silver are safe in your hold.`,
  lost: { treasure: 'The treasure is gone. Refit at the shipyard and try again.' },
};
