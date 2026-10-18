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
  hud: { cards: [], pause: null, fire: [], actions: [] },
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

export function showBanner(text, sub, secs = 2.6) {
  S.banner = { text, sub, until: S.clock + secs };
}
export function showToast(text, ship, secs = 1.2) {
  S.toast = { text, shipId: ship.id, until: S.clock + secs };
}
