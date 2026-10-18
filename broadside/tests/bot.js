// A simple scripted captain for automated playtests (runs inside the page).
// Each ship circles its target at about 60% of gun range so its broadside bears; on capture battles one
// ship with enough marines goes to land troops as soon as a fort falls silent.
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
    s.pivot = null;
    s.path = [clampTo(G, { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d })];
  }

  window.__bot = {
    tick() {
      const G = B().G;
      if (!G || G.phase !== 'play') return;
      const ships = G.ships.filter((s) => s.team === 'player' && live(s) && !s.escort);
      const escorts = G.ships.filter((s) => s.team === 'player' && live(s) && s.escort);
      const flag = G.ships.find((s) => s.flag && live(s) && s.team === 'player');
      const claimed = new Set();
      const enemies = G.ships.filter((s) => s.team === 'enemy' && live(s));
      const boss = enemies.find((s) => s.boss);
      const hostileForts = G.forts.filter((f) => f.team === 'enemy' && f.state === 'active');
      const silent = G.forts.filter((f) => f.state !== 'active');
      // Give up on a lander that sank, was taken by boarders or no longer has the marines for any fort.
      if (lander && (!live(lander) || lander.team !== 'player' || !silent.some((q) => lander.marines >= q.need || q.capture))) lander = null;
      for (const s of ships) {
        // Landing party: anchor beside a silenced fort and send the marines in.
        if (silent.length && (!lander || lander === s)) {
          const f = silent.find((q) => s.marines >= q.need);
          if (f) {
            lander = s;
            if (f.capture) continue;
            if (B().landingFor(s) === f) { B().startLanding(s, f); continue; }
            const is = G.islands[f.island];
            const a = Math.atan2(s.y - is.y, s.x - is.x);
            const d = is.r * 1.05 + s.L * 0.42 + 18;
            s.pivot = null;
            s.path = [clampTo(G, { x: is.x + Math.cos(a) * d, y: is.y + Math.sin(a) * d })];
            continue;
          }
        }
        if (s.mines > 0 && enemies.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < 120)) B().dropMine(s);
        // Breakthrough: the flagship runs for the exit at the top of the chart.
        if (s === flag) { s.pivot = null; s.path = [G.land ? { x: G.W - 10, y: s.y } : { x: s.x, y: 10 }]; continue; }
        // Treasure: each ship makes for a different floating chest.
        if (G.goal === 'treasure') {
          const c = nearest(s, G.chests.filter((q) => !q.taken && !claimed.has(q)));
          if (c) { claimed.add(c); s.pivot = null; s.path = [{ x: c.x, y: c.y }]; continue; }
        }
        // Fireships closing in come first.
        const fire = enemies.filter((e) => e.fireship && Math.hypot(e.x - s.x, e.y - s.y) < 320);
        let t;
        if (fire.length) t = nearest(s, fire);
        else if (G.goal === 'capture' && hostileForts.length) t = nearest(s, hostileForts);
        else if (G.goal === 'boss' && boss) t = boss;
        else if (G.goal === 'escort' && escorts.length && enemies.length) t = nearest(nearest(s, escorts), enemies);
        else if (G.goal === 'breakthrough' && flag && enemies.length) t = nearest(flag, enemies);
        else if (G.goal === 'defend' && enemies.length) t = nearest(G.forts[0] || s, enemies);
        else t = nearest(s, enemies.length ? enemies : hostileForts);
        if (t) circle(s, t, G);
      }
    },
  };
})();
