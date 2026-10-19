import { TYPES, FORT } from '../config/ships.js';
import { FLEET_SLOTS } from '../config/battles.js';
import { battleDef, ENDLESS_ID, randomIslands, waveEnemies, waveAI } from '../config/endless.js';
import { PI, TAU, rand } from '../util.js';
import { initAbilities } from './abilities/index.js';
import { makeCapsule, makeCoast, capsuleRadius, coastList, fleetLayout } from './terrain.js';
import { setupGoals } from './goals/index.js';
import { setupLand } from './land.js';

// Builds one ship's battle state from a battle definition plus (for the player) its shipyard upgrades.
export function makeShip(def, team, place, rot, id, ai) {
  const T = TYPES[def.type];
  const up = def.up || {};
  const [x, y] = place(def.x, def.y);
  const sails = 1 + 0.07 * (up.sails || 0);
  const hp = Math.round(def.hp || (team === 'enemy' ? T.hp * ai.hpMul : T.hp * (1 + 0.2 * (up.hull || 0))));
  const s = {
    id, team, origTeam: team, name: def.name, type: def.type, label: def.boss ? 'Boss' : T.label,
    L: T.L, B: T.B, masts: T.masts, range: T.range,
    guns: T.guns + (up.guns || 0),
    reloadTime: T.reload * (def.reloadMul || 1),
    speed: T.speed * sails, turn: T.turn * sails,
    chasers: def.chasers || up.chasers || 0, chaseT: rand(0.5, 1.5),
    mines: 2 * (up.mines || 0), minesMax: 2 * (up.mines || 0),
    marines: T.marines + 10 * (up.marines || 0),
    passive: !!def.passive, boss: def.boss || null,
    ammo: 'round', ammoKinds: ['round', ...(up.chain ? ['chain'] : []), ...(up.grape ? ['grape'] : [])],
    slowT: 0, crewHit: 0, boarding: null, prize: false,
    x, y, h: def.h * PI / 180 + rot, v: def.passive ? 0 : T.speed * 0.5,
    hp, maxHp: hp, reload: [rand(0.6, 1.6), rand(0.6, 1.6)],
    path: [], pivot: null, state: 'afloat', sinkT: 0, flash: 0, yard: 0, bob: rand(0, TAU),
    aiT: 0, targetId: null, ideal: rand(0.5, 0.72), fxT: 0,
    // Some enemy captains work round to rake (src/sim/steering.js); bosses more often.
    crafty: team !== 'player' && Math.random() < (def.boss ? 0.5 : 0.3),
    // Critical hits (src/sim/hazards.js): masts shot away, seconds the rudder is out, seconds a fire burns.
    mastsDown: 0, rudderT: 0, fireT: 0,
    rig: T.rig || 'square', escort: !!def.escort, ally: !!def.ally, exits: !!(def.escort || def.exits), flag: false,
    faction: def.faction || null, hidden: false,
  };
  initAbilities(s, { ...T.abilities, ...def.abilities });
  return s;
}

// The next free unit id in a battle.
export const nextId = (G) => Math.max(0, ...G.ships.map((s) => s.id), ...G.forts.map((f) => f.id)) + 1;

// Map placement for fractions of the portrait layout (landscape rotates it 90°: "up" the chart is to the right).
export const placer = (G) => (G.land ? (x, y) => [(1 - y) * G.W, x * G.H] : (x, y) => [x * G.W, y * G.H]);
// The width of the portrait chart in map units: radii given as portrait fractions are fractions of this.
export const chartWidth = (G) => (G.land ? G.H : G.W);

// Ships leave the map through the exit band at the top of the chart (the right edge in landscape).
export const EXIT_BAND = 70;
export const inExit = (G, s) => (G.land ? s.x > G.W - EXIT_BAND : s.y < EXIT_BAND);
export const upChart = (G) => (G.land ? 0 : -PI / 2);

// Creates the serialisable battle state G. size = { W, H, land } comes from the camera's framing.
export function createBattle(idx, size, fleet) {
  const endless = idx === ENDLESS_ID;
  // The skirmish rolls its own islands and first wave each time.
  const B = endless ? { ...battleDef(idx), islands: randomIslands(), enemy: waveEnemies(1), ai: waveAI(1) } : battleDef(idx);
  const { W, H, land } = size;
  // Landscape screens rotate the layout 90°: the player starts on the left.
  const place = land ? (x, y) => [(1 - y) * W, x * H] : (x, y) => [x * W, y * H];
  const rot = land ? PI / 2 : 0;
  let id = 1;
  const ships = [];
  // fleetAt puts the campaign fleet somewhere other than the bottom of the chart (an ambush, an enemy astern).
  const lay = fleetLayout(B, FLEET_SLOTS);
  const playerDefs = B.player || fleet.map((f, i) => ({
    type: f.cls, name: f.name, x: lay.slots[i][0], y: lay.slots[i][1], h: lay.h, up: f.up,
  }));
  for (const d of playerDefs) ships.push(makeShip(d, 'player', place, rot, id++, B.ai));
  for (const d of B.enemy) ships.push(makeShip({ ...d, faction: B.faction }, 'enemy', place, rot, id++, B.ai));

  const fortIslands = new Set((B.forts || []).map((f) => f.island));
  const islands = B.islands.map((d, ii) => {
    const is = makeCapsule(d, place, rot);
    const fort = fortIslands.has(ii);
    // The outline: radius multipliers round the centre (render/land.js shapes the shore from them). A long island bakes its
    // capsule into them, with more points so the ends stay round.
    const n = is.hl ? Math.round(14 + 10 * (is.hl / is.r)) : 14;
    const verts = Array.from({ length: n }, (_, i) => rand(0.86, 1.08) * capsuleRadius(is, (i / n) * TAU) / is.r);
    // seed: the renderer's dice for this island's hills, cliffs and trees (render/land.js), kept with the battle.
    return { ...is, verts, fort, seed: Math.floor(rand(1, 1e6)) };
  });
  // Shallows, reef rocks and coastlines (src/sim/terrain.js); the renderer builds them in render/land.js.
  const shoals = (B.shoals || []).map((d) => makeCapsule(d, place, rot));
  const reefs = (B.reefs || []).map((d) => makeCapsule(d, place, rot));
  const coasts = coastList(B.coast).map((d) => makeCoast(d, place));

  const forts = (B.forts || []).map((f) => {
    const is = islands[f.island];
    return {
      id: id++, kind: 'fort', team: f.team || 'enemy', origTeam: f.team || 'enemy', name: f.name, island: f.island, x: is.x, y: is.y,
      hp: f.hp, maxHp: f.hp, guns: f.guns, range: f.range || FORT.range, reloadTime: FORT.reload,
      reload: rand(1, 2.5), need: f.need || 10, state: 'active', capture: null, aim: rand(0, TAU), fxT: 0,
    };
  });

  let buoy = null;
  if (B.buoy) { const [bx, by] = place(B.buoy.x, B.buoy.y); buoy = { x: bx, y: by }; }

  const G = {
    battle: idx, W, H, land: !!land, ships, islands, shoals, reefs, coasts, forts, mines: [], buoy, chests: [],
    fog: B.fog || 0, faction: B.faction || null,
    events: (B.events || []).map((e) => ({ ...e, fired: false })),
    wind: { base: B.wind * PI / 180 + rot, dir: B.wind * PI / 180 + rot },
    t: 0, phase: 'title', endAt: null, result: null, dragged: false, award: null,
    stats: { shots: 0, hits: 0, captured: 0 }, ai: B.ai, goal: null, goals: [],
    tut: B.tutorial ? { step: 0, rotated: false, raised: false } : null,
    wave: 0, wavesCleared: 0, nextWaveAt: null,
  };
  // Goals may add ships of their own (merchantmen to escort, say).
  const add = (def, team) => { const s = makeShip(def, team, place, rot, nextId(G), B.ai); ships.push(s); return s; };
  setupGoals(G, B, { place, rot, add });
  G.goal = G.goals[0].kind;
  // The look of the land and its landmarks (src/config/lands.js, src/sim/land.js).
  setupLand(G, B, { place, rot });
  return G;
}
