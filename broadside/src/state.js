import { store } from './util.js';

// Live game state shared across modules. S.G is the serialisable battle; everything else is transient.
export const S = {
  G: null,
  balls: [],
  pending: [],
  particles: [],
  selected: null,
  drag: null,
  shake: 0,
  clock: 0,
  toast: null,   // small label over a ship: { text, shipId, until }
  banner: null,  // big centred message: { text, sub, until }
  floaters: [],  // damage numbers rising off ships and forts
  kick: 0,       // camera kick after the selected ship fires
  slowmo: null,  // { until, k }: brief slow motion when a boss goes down
  selectAll: false, // fleet orders: the next course goes to every ship
  formation: store.get('formation', 'line') === 'abreast' ? 'abreast' : 'line', // the whole fleet's formation for a course
  bumps: 0,         // ticks two hulls have spent touching (src/sim/ships.js collide; tests read it)
  hud: { cards: [], pause: null, fire: [], actions: [], ammo: [] },
  fireMode: store.get('fire', 'auto') === 'manual' ? 'manual' : 'auto',
  muted: store.get('sound', 'on') === 'off',
  musicMuted: store.get('music', 'on') === 'off',
  view: { cw: 1, ch: 1, dpr: 1, maxDpr: 2 },
  // Set by the UI layer so the simulation can report without importing it.
  hooks: { onEnd: null, onTutorialStep: null },
};

export const afloat = (s) => s.state === 'afloat';
// A unit is a ship or a fort; forts are "alive" while their guns are working.
export const alive = (u) => (u.kind === 'fort' ? u.state === 'active' : u.state === 'afloat');
export const shipById = (id) => S.G.ships.find((s) => s.id === id);
export const fortById = (id) => S.G.forts.find((f) => f.id === id);
export const unitById = (id) => shipById(id) || fortById(id);
// Battle data names ships; a name may also be given as a list of names.
export const names = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
export const shipNamed = (G, name) => G.ships.find((s) => s.name === name);
// Merchantmen under escort and allied captains sail themselves: they take no orders and aren't your fleet.
export const selfSailing = (s) => !!(s.escort || s.ally);

export function showBanner(text, sub, secs = 2.6) {
  S.banner = { text, sub, until: S.clock + secs };
}
export function showToast(text, ship, secs = 1.2) {
  S.toast = { text, shipId: ship.id, until: S.clock + secs, secs };
}

// Damage numbers: hits on the same target within a moment add up into one number instead of a pile.
export function addDamage(u, dmg) {
  const f = S.floaters.find((q) => q.id === u.id && !q.text && S.clock - q.born < 0.35);
  if (f) { f.value += dmg; f.x = u.x; f.y = u.y; return; }
  if (S.floaters.length > 40) S.floaters.shift();
  S.floaters.push({ id: u.id, x: u.x, y: u.y, value: dmg, born: S.clock, team: u.team });
}
// A word thrown up off a unit ("Raked!", "Mast down!"). It joins the damage number of the same hit if there is one
// (shown as a small caption over it); otherwise it rises on its own. tone: 'gold' | 'hit' | 'hurt' | 'heal' | 'cold'.
export function addFloater(u, text, tone = 'gold') {
  const f = S.floaters.find((q) => q.id === u.id && S.clock - q.born < 0.35);
  if (f) { f.text = text; f.tone = tone; return; }
  if (S.floaters.length > 40) S.floaters.shift();
  S.floaters.push({ id: u.id, x: u.x, y: u.y, value: null, text, tone, born: S.clock, team: u.team });
}
