import { TYPES, FORT } from '../config/ships.js';
import { BATTLES, FLEET_SLOTS } from '../config/battles.js';
import { PI, TAU, rand } from '../util.js';

// Builds one ship's battle state from a battle definition plus (for the player) its shipyard upgrades.
export function makeShip(def, team, place, rot, id, ai) {
  const T = TYPES[def.type];
  const up = def.up || {};
  const [x, y] = place(def.x, def.y);
  const sails = 1 + 0.07 * (up.sails || 0);
  const hp = Math.round(def.hp || (team === 'enemy' ? T.hp * ai.hpMul : T.hp * (1 + 0.2 * (up.hull || 0))));
  return {
    id, team, name: def.name, type: def.type, label: def.boss ? 'Boss' : T.label,
    L: T.L, B: T.B, masts: T.masts, range: T.range,
    guns: T.guns + (up.guns || 0),
    reloadTime: T.reload * (def.reloadMul || 1),
    speed: T.speed * sails, turn: T.turn * sails,
    chasers: def.chasers || up.chasers || 0, chaseT: rand(0.5, 1.5),
    mines: 2 * (up.mines || 0), mineEvery: def.mineEvery || 0, mineT: def.mineEvery || 0,
    marines: T.marines + 10 * (up.marines || 0),
    passive: !!def.passive, boss: def.boss || null,
    x, y, h: def.h * PI / 180 + rot, v: def.passive ? 0 : T.speed * 0.5,
    hp, maxHp: hp, reload: [rand(0.6, 1.6), rand(0.6, 1.6)],
    path: [], pivot: null, state: 'afloat', sinkT: 0, flash: 0, yard: 0, bob: rand(0, TAU),
    aiT: 0, targetId: null, ideal: rand(0.5, 0.72), fxT: 0,
  };
}

// Creates the serialisable battle state G. size = { W, H, land } comes from the camera's framing.
export function createBattle(idx, size, fleet) {
  const B = BATTLES[idx];
  const { W, H, land } = size;
  // Landscape screens rotate the layout 90°: the player starts on the left.
  const place = land ? (x, y) => [(1 - y) * W, x * H] : (x, y) => [x * W, y * H];
  const rot = land ? PI / 2 : 0;
  let id = 1;
  const ships = [];
  const playerDefs = B.player || fleet.map((f, i) => ({
    type: f.cls, name: f.name, x: FLEET_SLOTS[i][0], y: FLEET_SLOTS[i][1], h: -90, up: f.up,
  }));
  for (const d of playerDefs) ships.push(makeShip(d, 'player', place, rot, id++, B.ai));
  for (const d of B.enemy) ships.push(makeShip(d, 'enemy', place, rot, id++, B.ai));

  const fortIslands = new Set((B.forts || []).map((f) => f.island));
  const islands = B.islands.map((d, ii) => {
    const [x, y] = place(d.x, d.y);
    const fort = fortIslands.has(ii);
    const verts = Array.from({ length: 14 }, () => rand(0.86, 1.08));
    // A fort takes the middle of its island, so its palms keep to the edges.
    const palms = Array.from({ length: fort ? 2 : d.r > 40 ? 3 : d.r > 30 ? 2 : 1 }, () => {
      const a = rand(0, TAU), rr = fort ? rand(d.r * 0.62, d.r * 0.72) : rand(0, d.r * 0.4);
      return { x: Math.cos(a) * rr, y: Math.sin(a) * rr, s: rand(0.85, 1.15), rot: rand(0, TAU), lean: rand(0.08, 0.25) };
    });
    const rocks = Array.from({ length: 3 }, () => ({ a: rand(0, TAU), d: d.r * rand(1.02, 1.2), s: rand(3, 6) }));
    return { x, y, r: d.r, verts, palms, rocks, fort };
  });

  const forts = (B.forts || []).map((f) => {
    const is = islands[f.island];
    return {
      id: id++, kind: 'fort', team: 'enemy', name: f.name, island: f.island, x: is.x, y: is.y,
      hp: f.hp, maxHp: f.hp, guns: f.guns, range: f.range || FORT.range, reloadTime: FORT.reload,
      reload: rand(1, 2.5), need: f.need || 10, state: 'active', capture: null, aim: rand(0, TAU), fxT: 0,
    };
  });

  let buoy = null;
  if (B.buoy) { const [bx, by] = place(B.buoy.x, B.buoy.y); buoy = { x: bx, y: by }; }

  return {
    battle: idx, W, H, ships, islands, forts, mines: [], buoy,
    wind: { base: B.wind * PI / 180 + rot, dir: B.wind * PI / 180 + rot },
    t: 0, phase: 'title', endAt: null, result: null, dragged: false, award: null,
    stats: { shots: 0, hits: 0, captured: 0 }, ai: B.ai, goal: B.goal || 'sink',
    tut: B.tutorial ? { step: 0, rotated: false, raised: false } : null,
  };
}
