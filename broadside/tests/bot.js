// A simple scripted captain for automated playtests (runs inside the page).
// Each ship circles its target at about 60% of gun range so its broadside bears; on battles with forts one
// ship with enough marines goes to land troops as soon as a fort falls silent. Each goal can give its own
// orders in GOAL_ORDERS (keyed by goal kind, see src/sim/goals/): return { to: point } to sail somewhere,
// { target } to fight that unit, or null to fall back to the next goal (and finally the nearest enemy).
(() => {
  const B = () => window.__broadside;
  const live = (s) => s.state === 'afloat';
  const clampTo = (G, p) => ({ x: Math.max(40, Math.min(G.W - 40, p.x)), y: Math.max(40, Math.min(G.H - 40, p.y)) });
  let lander = null;

  function nearest(s, list) {
    let best = null, bd = Infinity;
    for (const u of list) { const d = Math.hypot(u.x - s.x, u.y - s.y); if (d < bd) { bd = d; best = u; } }
    return best;
  }

  function circle(s, t, G) {
    const a = Math.atan2(s.y - t.y, s.x - t.x) + 0.9;
    const d = s.range * 0.6 + (t.kind === 'fort' ? G.islands[t.island].r : 0);
    s.pivot = null; s.order = null;
    s.path = [clampTo(G, { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d })];
  }

  const GOAL_ORDERS = {
    capture: (s, o, c) => (c.hostileForts.length ? { target: nearest(s, c.hostileForts) } : null),
    boss: (s, o, c) => (c.boss ? { target: c.boss } : null),
    // Haul up a chest no other ship is going for; hunt salvors carrying chests.
    treasure(s, o, c) {
      const ch = nearest(s, c.G.chests.filter((q) => !q.taken && !c.claimed.has(q)));
      if (ch) { c.claimed.add(ch); return { to: ch }; }
      const thief = nearest(s, c.enemies.filter((e) => e.loot && e.loot.length));
      return thief ? { target: thief } : null;
    },
    escort(s, o, c) {
      const m = nearest(s, c.G.ships.filter((q) => q.team === 'player' && live(q) && q.escort));
      return m && c.enemies.length ? { target: nearest(m, c.enemies) } : null;
    },
    // The flagship runs for the exit at the top of the chart; the rest cover her.
    breakthrough(s, o, c) {
      if (s.id === o.id) return { to: c.G.land ? { x: c.G.W - 10, y: s.y } : { x: s.x, y: 10 } };
      const f = c.G.ships.find((q) => q.id === o.id && live(q));
      return f && c.enemies.length ? { target: nearest(f, c.enemies) } : null;
    },
    hold(s, o, c) {
      const fort = c.G.forts.find((f) => f.team === 'player') || s;
      return c.enemies.length ? { target: nearest(fort, c.enemies) } : null;
    },
    // Fight whoever is closest to what you're guarding.
    protect(s, o, c) {
      const ward = [...c.G.ships.filter((q) => (o.ids || []).includes(q.id) && live(q)), ...c.G.forts.filter((f) => [].concat(o.forts || []).includes(f.name))];
      const w = nearest(s, ward);
      return w && c.enemies.length ? { target: nearest(w, c.enemies) } : null;
    },
    // Chase the quarry, the nearest first; the rest of the enemy can wait.
    hunt(s, o, c) {
      const q = nearest(s, c.enemies.filter((e) => [].concat(o.ships).includes(e.name)));
      return q ? { target: q } : null;
    },
    // The named ship (or whichever ship is closest) sails into the ring; the others fight on.
    reach(s, o, c) {
      if (o.got) return null;
      const runner = o.ship ? c.ships.find((q) => q.name === o.ship) : nearest({ x: o.px, y: o.py }, c.ships);
      return runner === s ? { to: { x: o.px, y: o.py } } : null;
    },
    // Hold out: fight the enemy nearest the middle of the fleet, so the ships stick together.
    survive(s, o, c) {
      if (!c.enemies.length) return null;
      const mid = { x: c.ships.reduce((a, q) => a + q.x, 0) / c.ships.length, y: c.ships.reduce((a, q) => a + q.y, 0) / c.ships.length };
      return { target: nearest(mid, c.enemies) };
    },
  };

  window.__bot = {
    GOAL_ORDERS,
    tick() {
      const G = B().G;
      if (!G || G.phase !== 'play') return;
      const ships = G.ships.filter((s) => s.team === 'player' && live(s) && !s.escort && !s.ally); // allies sail themselves
      const enemies = G.ships.filter((s) => s.team === 'enemy' && live(s));
      const c = {
        G, ships, enemies, boss: enemies.find((s) => s.boss), claimed: new Set(),
        hostileForts: G.forts.filter((f) => f.team === 'enemy' && f.state === 'active'),
      };
      const silent = G.forts.filter((f) => f.state !== 'active');
      // Give up on a lander that sank, was taken by boarders or no longer has the marines for any fort.
      if (lander && (!live(lander) || lander.team !== 'player' || !silent.some((q) => lander.marines >= q.need || q.capture))) lander = null;
      for (const s of ships) {
        // Landing party: anchor beside a silenced fort and send the marines in.
        if (silent.length && (!lander || lander === s) && !s.flag) {
          const f = silent.find((q) => s.marines >= q.need);
          if (f) {
            lander = s;
            if (f.capture) continue;
            if (B().landingFor(s) === f) { B().startLanding(s, f); continue; }
            const is = G.islands[f.island];
            const a = Math.atan2(s.y - is.y, s.x - is.x);
            const d = is.r * 1.05 + s.L * 0.42 + 18;
            s.pivot = null; s.order = null;
            s.path = [clampTo(G, { x: is.x + Math.cos(a) * d, y: is.y + Math.sin(a) * d })];
            continue;
          }
        }
        if (s.mines > 0 && enemies.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < 120)) B().dropMine(s);
        // Fireships closing in come first; then whatever the battle's goals ask for.
        const fire = enemies.filter((e) => e.fireship && Math.hypot(e.x - s.x, e.y - s.y) < 320);
        let order = fire.length && !s.flag ? { target: nearest(s, fire) } : null;
        for (const o of G.goals) {
          if (order) break;
          const fn = GOAL_ORDERS[o.kind];
          if (fn) order = fn(s, o, c);
        }
        if (!order) { const t = nearest(s, enemies.length ? enemies : c.hostileForts); if (t) order = { target: t }; }
        if (!order) continue;
        if (order.to) { s.pivot = null; s.order = null; s.path = [{ x: order.to.x, y: order.to.y }]; } else circle(s, order.target, G);
      }
    },
  };
})();
