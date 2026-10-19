import { showBanner } from '../state.js';
import { PI, clamp } from '../util.js';
import { callout } from './hazards.js';
import { spawn } from './particles.js';
import { sfx } from '../audio/sfx.js';
import { LANDS } from '../config/lands.js';
import { capsuleRadius, coastDepth, coastPoint, coastList, coreDist, coastGap } from './terrain.js';

// Land with a sense of place: the look of a battle's islands and shores (its style and relief) and the
// landmarks on them, from src/config/lands.js (keyed by battle id) or a battle def's own `land`. Most landmarks
// are scenery the renderer builds (render/land.js); a few change the battle:
//   harbour     your ships patch their hulls while they lie still in its anchorage
//   town        with loot, an enemy town can be bombarded and sacked for prize gold
//   peak        high land (volcano too) steals the wind: ships in its lee, downwind, sail slower
//   lighthouse  with sight, it lifts the fog around it for your lookouts
// Pure state and geometry, so it loads in node for the content check and the docs.
//
// A landmark sits on land given by one of:
//   island: i, at, d     on islands[i], `at` degrees from its centre (0 = east, 90 = down the chart), d of the
//                        way out to the shore (0 = the middle, 1 = the beach)
//   coast: i, at, inland on coast i (0 for a single coast), `at` along its edge (0-1), `inland` map units in
//                        from the shore
//   x, y                 a spot on the chart (portrait fractions), for things in the water (a wreck on a reef)
// In the battle state G.landmarks holds them in map units: { kind, x, y, face (seaward, radians), host, ... }.

export const LAND_STYLES = ['port', 'windward', 'main', 'golden', 'pirate', 'campeche', 'armada'];
export const REGION_STYLE = { port: 'port', windward: 'windward', main: 'main', golden: 'golden', pirate: 'pirate', campeche: 'campeche', armada: 'armada' };
export const TOWN_LOOKS = ['english', 'spanish', 'shanty', 'village', 'city'];
export const STYLE_TOWN = { port: 'english', windward: 'shanty', main: 'spanish', golden: 'spanish', pirate: 'shanty', campeche: 'village', armada: 'city' };

// The land for a battle def: its own `land`, else LANDS by id.
export const landOf = (B) => (B && (B.land || LANDS[B.id])) || null;

// Placement fields every landmark takes (see the header).
const PLACE = {
  island: 'island index it stands on (or use coast, or x and y)',
  coast: 'coast index it stands on (0 for a single coast)',
  x: 'optional: across the chart (portrait fraction), for a landmark in the water',
  y: 'optional: down the chart (portrait fraction)',
  at: 'optional: on an island, degrees from its centre (0 = east, 90 = down the chart; default 90); on a coast, how far along its edge (0-1; default 0.5)',
  d: 'optional: on an island, how far out from the centre toward the shore (0-1; default 0)',
  inland: 'optional: on a coast, map units in from the shore (default 50)',
};
const PLACE_KEYS = [...Object.keys(PLACE), 'note'];

// Wind shadow of high land and anchorage defaults, for the docs.
export const LEE = { len: 4, calm: 0.5 };

// ---------- The registry ----------
// Each entry: about and params (docs and validation), defaults, extent(o) (how far it reaches from its spot,
// map units, for the "does it fit on its land" check), where ('land': inside the footprint; 'shore': at the
// water's edge, d and inland are ignored; 'sea': x, y in the water), and optional sim hooks:
// setup(o, G), update(o, G, dt), hit(o, G, x, y, dmg, team) (shot landed nearby).
export const LANDMARKS = {
  town: {
    about: 'Houses round a square in the region’s style: English timber and brick, Spanish whitewash and terracotta, a pirate shanty on stilts, a fishing village of palm-thatched huts or a pastel harbour city. Chimneys smoke and a flag flies. Given loot, an enemy town can be bombarded: shot that lands on it sets it burning, and once it is ruined its loot is yours (prize gold, paid if you win).',
    params: {
      houses: 'optional: how many buildings (default 6)',
      look: `optional: ${TOWN_LOOKS.join(', ')} (default: the region's)`,
      name: 'optional: what the banner calls it (default "the town")',
      loot: 'optional: prize gold for sacking it, 0 = scenery only (default 0)',
      hp: 'optional: how much shot it takes to sack (default 60, about fifteen balls)',
      team: "optional: whose town it is, 'enemy' or 'player' (default 'enemy'); only the other side's shot can sack it",
    },
    defaults: { houses: 6, look: '', name: 'the town', loot: 0, hp: 60, team: 'enemy' },
    where: 'land',
    extent: (o) => 6 + 4.5 * Math.sqrt(o.houses),
    setup(o) { o.dmg = 0; o.sacked = false; o.burn = 0; },
    hit(o, G, x, y, dmg, team) {
      if (team === o.team || o.sacked || Math.hypot(x - o.x, y - o.y) > o.rad + 26) return false;
      o.dmg += dmg;
      o.burn = Math.min(1, o.burn + dmg / Math.max(1, o.hp) * 1.6);
      if (o.loot > 0 && o.dmg >= o.hp) {
        o.sacked = true;
        G.stats.plunder = (G.stats.plunder || 0) + o.loot;
        showBanner(`${o.name[0].toUpperCase()}${o.name.slice(1)} is sacked!`, `+${o.loot} gold in plunder, yours if you win`, 2.6);
        sfx.fanfare(false);
      }
      return true;
    },
    update(o, G, dt) { if (!o.sacked) o.burn = Math.max(0, o.burn - dt * 0.02); },
  },
  harbour: {
    about: 'A wharf with boats moored alongside and an anchorage off it (a ring of buoys). Your ships that lie still in the anchorage (anchored or barely moving) have their hulls patched by the yard’s carpenters, until its timber runs out. A harbour on a fort’s island serves whoever holds the fort. rate 0 makes it scenery.',
    params: {
      r: 'optional: anchorage radius in map units (default 75)',
      rate: 'optional: hull points a second for each ship in the anchorage (default 3; 0 = scenery)',
      upTo: 'optional: share of her full hull the carpenters can restore (default 0.85)',
      stock: 'optional: hull points of timber in the yard for the whole battle (default 160)',
      team: "optional: whose ships it serves, 'player' or 'enemy' (default 'player'); a fort on its island overrides it",
    },
    defaults: { r: 75, rate: 3, upTo: 0.85, stock: 160, team: 'player' },
    where: 'shore',
    extent: () => 0,
    setup(o, G) {
      // The anchorage lies off the wharf, clear of the shore.
      const off = o.hostR * 0.05 + o.r * 0.78;
      o.ax = o.x + Math.cos(o.face) * off; o.ay = o.y + Math.sin(o.face) * off;
      o.used = 0; o.fort = o.host && o.host.island != null ? (G.forts.find((f) => f.island === o.host.island) || null) : null;
      if (o.fort) o.fort = o.fort.id;
    },
    update(o, G, dt) {
      if (o.rate <= 0 || o.used >= o.stock) return;
      const f = o.fort != null ? G.forts.find((q) => q.id === o.fort) : null;
      const team = f ? (f.state === 'active' ? f.team : null) : o.team;
      if (!team) return;
      for (const s of G.ships) {
        if (s.team !== team || s.state !== 'afloat' || s.boarding) continue;
        if (Math.hypot(s.x - o.ax, s.y - o.ay) > o.r) { s.yardT = 0; continue; }
        const still = s.pivot != null || s.v < s.speed * 0.3;
        const cap = s.maxHp * o.upTo;
        if (!still || s.hp >= cap) continue;
        const add = Math.min(o.rate * dt, cap - s.hp, o.stock - o.used);
        s.hp += add; o.used += add; s.yardAt = G.t;
        if (!s.yardT && s.team === 'player') callout(s, 'Carpenters at work', 'good');
        s.yardT = (s.yardT || 0) + dt;
        if (o.used >= o.stock) { callout(s, 'The yard’s timber is spent', 'sea'); break; }
      }
    },
  },
  lighthouse: {
    about: 'A striped lighthouse with a lamp that glows in fog and dusk; gulls circle it. Given sight, it lifts the fog around it for your lookouts: enemy ships within that range of it show (and can be shot at) wherever your fleet is.',
    params: { sight: 'optional: fog sight radius around it in map units, 0 = just a light (default 0)' },
    defaults: { sight: 0 },
    where: 'land',
    extent: () => 7,
  },
  peak: {
    about: `A high hill or mountain on an island or coast. High land steals the wind: in its lee (downwind of it, about ${LEE.len} times its island's radius) ships sail slower, at worst ${Math.round(LEE.calm * 100)}% of the wind's speed right under it. Calm, glassy water shows where the lee lies, and it swings with the wind.`,
    params: {
      height: 'optional: how high, in map units (default 55)',
      size: 'optional: how wide its foot is, as a share of the island radius (default 0.75)',
      lee: `optional: how far its wind shadow reaches, in island radii (default ${LEE.len}; 0 = none)`,
      calm: `optional: share of the wind left right under it (default ${LEE.calm})`,
    },
    defaults: { height: 55, size: 0.75, lee: LEE.len, calm: LEE.calm },
    where: 'land',
    extent: (o, R) => o.size * R * 0.75,
  },
  volcano: {
    about: 'A peak with a smoking crater; like any peak it casts a lee downwind.',
    params: {
      height: 'optional: how high (default 65)', size: 'optional: foot as a share of the island radius (default 0.65)',
      lee: `optional: wind shadow length in island radii (default ${LEE.len})`, calm: `optional: wind left under it (default ${LEE.calm})`,
    },
    defaults: { height: 65, size: 0.65, lee: LEE.len, calm: LEE.calm },
    where: 'land',
    extent: (o, R) => o.size * R * 0.75,
  },
  church: {
    about: 'A church in the region’s style: an English chapel with a spire, or a whitewashed Spanish mission with a bell tower.',
    params: {}, defaults: {}, where: 'land', extent: () => 13,
  },
  windmill: { about: 'A stone windmill whose sails turn in the wind.', params: {}, defaults: {}, where: 'land', extent: () => 9 },
  ruin: {
    about: 'A crumbling stone temple overgrown with jungle: a stepped platform, broken columns and fallen blocks.',
    params: {}, defaults: {}, where: 'land', extent: () => 17,
  },
  castle: {
    about: 'A honey-stone bastion on a headland in the style of El Morro, its walls angled to the sea, with a watchtower.',
    params: {}, defaults: {}, where: 'land', extent: () => 24,
  },
  skull: { about: 'Skull Rock: a great white boulder with hollow eyes, staring out to sea.', params: {}, defaults: {}, where: 'land', extent: () => 12 },
  wreck: {
    about: 'An old hull heeled over, ribs showing, on a beach, a reef or a shoal (ships can’t pass the land, and steer clear of the reef anyway). Gulls pick at it.',
    params: {}, defaults: {}, where: 'any', extent: () => 14,
  },
  stacks: {
    about: 'Sea stacks: tall rock pillars with grassy tops standing in the surf at the shore, inside the land’s outline.',
    params: { count: 'optional: how many (default 3)' }, defaults: { count: 3 }, where: 'shore', extent: () => 0,
  },
  mangroves: {
    about: 'A fringe of mangroves on their stilt roots along the shore, inside the land’s outline.',
    params: { span: 'optional: on an island, how many degrees of shore they cover; on a coast, how much of the edge (default 90 / 0.3)' },
    defaults: { span: 0 }, where: 'shore', extent: () => 0,
  },
};

// ---------- Placement ----------
// Distance from a coast's edge to its far side in map units (to turn inland units into depth fractions).
function acrossOf(def, place) {
  const a0 = place(...coastPoint(def, 0.5, 0)), a1 = place(...coastPoint(def, 0.5, 1));
  return Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
}
const withDefaults = (d) => ({ ...(LANDMARKS[d.kind] ? LANDMARKS[d.kind].defaults : {}), ...d });

// Builds G.style, G.landmarks, G.lee and G.scorch for a battle. ctx: { place, rot }.
export function setupLand(G, B, ctx) {
  const L = landOf(B) || {};
  G.style = LAND_STYLES.includes(L.style) ? L.style : REGION_STYLE[B.region] || 'port';
  G.relief = (L.relief || []).map((r) => ({ ...r, at: r.at == null ? null : (r.at * PI) / 180 + ctx.rot }));
  G.landmarks = [];
  G.lee = [];
  G.scorch = [];
  G.stats.plunder = 0;
  for (const def of L.landmarks || []) {
    const M = LANDMARKS[def.kind];
    if (!M) continue;
    const o = withDefaults(def);
    if (!placeLandmark(G, o, ctx)) continue;
    o.id = 9000 + G.landmarks.length;
    if (o.kind === 'town') { o.look = TOWN_LOOKS.includes(o.look) ? o.look : STYLE_TOWN[G.style]; o.rad = M.extent(o); }
    if (M.setup) M.setup(o, G);
    G.landmarks.push(o);
    if ((o.kind === 'peak' || o.kind === 'volcano') && o.lee > 0) {
      const R = o.hostR || 60;
      G.lee.push({ x: o.x, y: o.y, r: Math.max(24, R * 0.85), len: o.lee * R, calm: clamp(o.calm, 0, 1) });
    }
  }
}

function placeLandmark(G, o, { place, rot }) {
  const M = LANDMARKS[o.kind];
  if (o.island != null) {
    const is = G.islands[o.island];
    if (!is) return false;
    const a = ((o.at == null ? 90 : o.at) * PI) / 180 + rot, R = capsuleRadius(is, a);
    const d = M.where === 'shore' ? 0.97 : clamp(o.d || 0, 0, 1);
    o.x = is.x + Math.cos(a) * R * d; o.y = is.y + Math.sin(a) * R * d;
    o.face = a; o.hostR = is.r; o.host = { island: o.island, a, d };
    return true;
  }
  if (o.coast != null) {
    const co = (G.coasts || [])[o.coast];
    if (!co) return false;
    const def = co.def, t = o.at == null ? 0.5 : o.at, across = acrossOf(def, place);
    const inland = M.where === 'shore' ? 3 : o.inland == null ? 50 : o.inland;
    const dep = coastDepth(def, t);
    const [x, y] = place(...coastPoint(def, t, dep - inland / across));
    const [ix, iy] = place(...coastPoint(def, t, dep - 0.05)), [sx, sy] = place(...coastPoint(def, t, dep + 0.05));
    o.x = x; o.y = y; o.face = Math.atan2(sy - iy, sx - ix); o.hostR = 90; o.host = { coast: o.coast, t, inland };
    return true;
  }
  if (o.x != null && o.y != null) {
    [o.x, o.y] = place(o.x, o.y);
    o.face = ((o.at || 0) * PI) / 180 + rot; o.hostR = 40; o.host = null;
    return true;
  }
  return false;
}

// ---------- The sim ----------
export function updateLand(G, dt) {
  for (const o of G.landmarks || []) { const M = LANDMARKS[o.kind]; if (M && M.update) M.update(o, G, dt); }
  // Your captains say so when they sail into the lee of high land (once a while per ship).
  if (G.lee && G.lee.length) {
    for (const s of G.ships) {
      if (s.team !== 'player' || s.state !== 'afloat') continue;
      const k = leeAt(G, s.x, s.y);
      if (k < 0.75 && !s.inLee) { s.inLee = true; if (G.t - (s.leeSaid || -99) > 20) { s.leeSaid = G.t; callout(s, 'In the lee: the wind drops', 'sea'); } }
      else if (k > 0.92) s.inLee = false;
    }
  }
}

// A ball or shell came down on land at (x, y): a scorch mark, and any town there takes the damage.
export function landHit(G, x, y, dmg, team) {
  if (!G.scorch) return;
  if (G.scorch.length >= 40) G.scorch.shift();
  G.scorch.push([x, y, G.t]);
  // A brown cloud of dust where it struck.
  for (let k = 0; k < 3; k++) spawn('dust', x + (k - 1) * 4, y + ((k * 7) % 3 - 1) * 4, (k - 1) * 9, ((k * 5) % 3 - 1) * 9, 0.9 + k * 0.25, 5 + k, 6 + k * 3, 10 + k * 6);
  for (const o of G.landmarks || []) { const M = LANDMARKS[o.kind]; if (M && M.hit) M.hit(o, G, x, y, dmg, team); }
}

// Is (x, y) on land? (islands by their beach, coasts by their shore)
export function onLand(G, x, y) {
  for (const is of G.islands) if (coreDist(is, x, y) < is.r * 0.95) return true;
  for (const c of G.coasts || []) if (coastGap(c, x, y) < -4) return true;
  return false;
}

// The share of the wind left at (x, y) in the lee of high land (1 = full wind). The shadow runs downwind of each
// peak, as wide as its foot and spreading a little, strongest close under it.
export function leeAt(G, x, y) {
  const L = G && G.lee;
  if (!L || !L.length) return 1;
  const wx = Math.cos(G.wind.dir), wy = Math.sin(G.wind.dir);
  let k = 1;
  for (const c of L) {
    const dx = x - c.x, dy = y - c.y, along = dx * wx + dy * wy;
    if (along < -c.r || along > c.len + c.r) continue;
    const across = Math.abs(dx * wy - dy * wx), w = c.r * (1 + 0.35 * Math.max(0, along) / c.len);
    if (across > w * 1.3) continue;
    const ka = 1 - smooth(w * 0.7, w * 1.3, across), kl = 1 - smooth(c.len * 0.45, c.len + c.r, along);
    k = Math.min(k, 1 - (1 - c.calm) * ka * kl);
  }
  return k;
}
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Points your lookouts see from in fog besides your ships: lighthouses with sight. [{ x, y, r }]
let lookG = null, lookList = [];
export function lookouts(G) {
  if (lookG !== G) { lookG = G; lookList = (G.landmarks || []).filter((o) => o.kind === 'lighthouse' && o.sight > 0).map((o) => ({ x: o.x, y: o.y, r: o.sight })); }
  return lookList;
}

// ---------- Content checks ----------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v) => isNum(v) && v >= 0 && v <= 1;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const LAND_KEYS = { style: 1, relief: 1, landmarks: 1, note: 1 };
const RELIEF = { island: 'island index', height: 'optional: hill height multiplier (default 1)', cliffs: 'optional: share of the shore that is cliff, 0-1 (default the style\'s)', at: 'optional: which side the cliffs face, degrees (default random)' };
export const LAND_FIELDS = {
  style: `optional: the look of the land: ${LAND_STYLES.join(', ')} (default: the battle's region)`,
  relief: `optional: per-island shape, [{ ${Object.keys(RELIEF).join(', ')} }]: ${Object.entries(RELIEF).map(([k, v]) => `${k} = ${v}`).join('; ')}`,
  landmarks: 'optional: a list of landmarks, { kind, ...placement, ...params }',
};

// Problems with a battle's land (empty = fine). B is the battle def; checked on nominal portrait maps.
export function checkLand(L, B, MAPS = [[520, 1100], [620, 930]]) {
  if (L == null) return [];
  if (!isObj(L)) return ['land must be { style?, relief?, landmarks? }'];
  const out = [];
  for (const k of Object.keys(L)) if (!LAND_KEYS[k]) out.push(`land: unknown field '${k}' (known: style, relief, landmarks)`);
  if (L.style !== undefined && !LAND_STYLES.includes(L.style)) out.push(`land: style must be one of ${LAND_STYLES.join(', ')}, got ${JSON.stringify(L.style)}`);
  const islands = Array.isArray(B.islands) ? B.islands : [], coasts = coastList(B.coast);
  if (L.relief !== undefined) {
    if (!Array.isArray(L.relief)) out.push('land: relief must be a list of { island, height?, cliffs?, at? }');
    else L.relief.forEach((r, i) => {
      if (!isObj(r) || !Number.isInteger(r.island) || !islands[r.island]) { out.push(`land relief[${i}]: island must index islands (0-${islands.length - 1})`); return; }
      for (const k of Object.keys(r)) if (!(k in RELIEF) && k !== 'note') out.push(`land relief[${i}]: unknown field '${k}'`);
      if (r.height !== undefined && !(isNum(r.height) && r.height >= 0 && r.height <= 3)) out.push(`land relief[${i}]: height must be 0-3`);
      if (r.cliffs !== undefined && !isFrac(r.cliffs)) out.push(`land relief[${i}]: cliffs must be 0-1`);
      if (r.at !== undefined && !isNum(r.at)) out.push(`land relief[${i}]: at must be degrees`);
    });
  }
  if (L.landmarks === undefined) return out;
  if (!Array.isArray(L.landmarks)) return [...out, 'land: landmarks must be a list'];
  const placed = [];
  L.landmarks.forEach((m, i) => {
    const at = `land landmarks[${i}]${isObj(m) && m.kind ? ` (${m.kind})` : ''}`;
    if (!isObj(m)) { out.push(`${at}: must be { kind, ... }`); return; }
    const M = LANDMARKS[m.kind];
    if (!M) { out.push(`${at}: unknown kind ${JSON.stringify(m.kind)} (known: ${Object.keys(LANDMARKS).join(', ')})`); return; }
    for (const [k, v] of Object.entries(m)) {
      if (k === 'kind' || PLACE_KEYS.includes(k)) continue;
      if (!(k in M.params)) { out.push(`${at}: unknown param '${k}' (known: ${[...PLACE_KEYS.filter((p) => p !== 'note'), ...Object.keys(M.params)].join(', ')})`); continue; }
      const dv = M.defaults[k];
      if (isNum(dv) && !(isNum(v) && v >= 0)) out.push(`${at}: '${k}' should be a number of at least 0, got ${JSON.stringify(v)}`);
      if (typeof dv === 'string' && typeof v !== 'string') out.push(`${at}: '${k}' should be text, got ${JSON.stringify(v)}`);
    }
    if (m.kind === 'town' && m.look !== undefined && !TOWN_LOOKS.includes(m.look)) out.push(`${at}: look must be one of ${TOWN_LOOKS.join(', ')}`);
    if (m.team !== undefined && m.team !== 'player' && m.team !== 'enemy') out.push(`${at}: team must be 'player' or 'enemy'`);
    const o = withDefaults(m);
    const hosts = [m.island !== undefined, m.coast !== undefined, m.x !== undefined || m.y !== undefined].filter(Boolean).length;
    if (hosts !== 1) { out.push(`${at}: needs exactly one of island, coast, or x and y`); return; }
    if (m.at !== undefined && !isNum(m.at)) out.push(`${at}: at must be a number`);
    if (m.island !== undefined) {
      const is = islands[m.island];
      if (!Number.isInteger(m.island) || !is) { out.push(`${at}: island ${JSON.stringify(m.island)} is not an index into islands (0-${islands.length - 1})`); return; }
      if (m.d !== undefined && !isFrac(m.d)) out.push(`${at}: d must be 0-1`);
      if (M.where === 'sea') out.push(`${at}: goes in the water (x, y), not on an island`);
      if (M.where === 'land') {
        // It must fit inside the island's outline, which is what ships collide with.
        const st = Math.max(1, is.stretch || 1), c = { r: is.r, hl: is.r * (st - 1), ang: ((is.angle || 0) * PI) / 180 };
        const R = capsuleRadius(c, ((m.at == null ? 90 : m.at) * PI) / 180);
        // A town on a fort's island strings its houses round the fort in an arc, one house deep.
        const ringTown = m.kind === 'town' && (B.forts || []).some((f) => f && f.island === m.island);
        const reach = (o.d || 0) * R + (ringTown ? RING : M.extent(o, is.r));
        if (reach > R * 0.93 + 2) out.push(`${at}: reaches ${Math.round(reach)} out on island ${m.island}, past its shore (${Math.round(R * 0.93)}); move it in (d) or make it smaller`);
        // Clear of a fort's tower in the middle, and of the other landmarks on the island.
        const fort = (B.forts || []).some((f) => f && f.island === m.island);
        const ext = ringTown ? RING : M.extent(o, is.r), spot = spotOf(o, R);
        if (fort && Math.hypot(spot[0], spot[1]) - ext < FORT_CLEAR - 2) out.push(`${at}: stands on the fort in the middle of island ${m.island}; move it out toward the shore (d)`);
        placed.forEach((q) => {
          if (q.island !== m.island) return;
          const gap = Math.hypot(spot[0] - q.spot[0], spot[1] - q.spot[1]) - ext - q.ext;
          if (gap < -4) out.push(`${at}: overlaps landmarks[${q.i}] (${q.kind}) on island ${m.island}`);
        });
        placed.push({ i, kind: m.kind, island: m.island, spot, ext });
      }
    } else if (m.coast !== undefined) {
      if (!Number.isInteger(m.coast) || !coasts[m.coast]) { out.push(`${at}: coast ${JSON.stringify(m.coast)} is not an index into the battle's coasts (${coasts.length})`); return; }
      if (m.at !== undefined && !isFrac(m.at)) out.push(`${at}: on a coast, at must be 0-1 along the edge`);
      if (M.where === 'land') {
        const inland = m.inland == null ? 50 : m.inland, ext = M.extent(o, 90);
        if (!(isNum(inland) && inland >= ext + 4)) out.push(`${at}: inland ${inland} puts it in the sea; it needs at least ${Math.round(ext + 4)}`);
      }
    } else {
      if (!isFrac(m.x) || !isFrac(m.y)) { out.push(`${at}: x and y must be map fractions`); return; }
      if (M.where !== 'any' && M.where !== 'sea') out.push(`${at}: stands on land: give it an island or a coast`);
      // A wreck in the water lies on a reef, a shoal or the land itself, never in open water ships sail through.
      const onSomething = MAPS.every(([W, H]) => [...(B.reefs || []), ...(B.shoals || []), ...islands].some((c) => capGap(c, m, W, H) < 4));
      if (m.kind === 'wreck' && !onSomething) out.push(`${at}: a wreck in the water must lie on a reef, a shoal or an island`);
    }
  });
  return out;
}
// How far from a fort's centre other landmarks keep (its tower's foot).
const FORT_CLEAR = 24;
// A town strung round a fort is one house deep: this far either side of its ring.
export const RING = 8;
const spotOf = (o, R) => { const a = ((o.at == null ? 90 : o.at) * PI) / 180, r = (o.d || 0) * R; return [Math.cos(a) * r, Math.sin(a) * r]; };
function capGap(c, p, W, H) {
  if (!isObj(c) || !isNum(c.r)) return Infinity;
  const st = Math.max(1, c.stretch || 1), hl = c.r * (st - 1), a = ((c.angle || 0) * PI) / 180;
  const dx = (p.x - c.x) * W, dy = (p.y - c.y) * H, ux = Math.cos(a), uy = Math.sin(a);
  const t = clamp(dx * ux + dy * uy, -hl, hl);
  return Math.hypot(dx - ux * t, dy - uy * t) - c.r;
}
// For the docs: the placement fields.
export const LANDMARK_PLACE = PLACE;
