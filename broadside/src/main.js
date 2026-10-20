import './styles.css';
import { S } from './state.js';
import { $ } from './util.js';
import { save, replaceSave, writeSave, isUnlocked, migrate, fitGun, fitOffer, buyGreatShip, greatOffer, fleetStats } from './save.js';
import { BATTLES, REGIONS, FLEET_SLOTS, battleIndex } from './config/battles.js';
import { battleDef, ENDLESS, ENDLESS_ID, waveEnemies } from './config/endless.js';
import { LAB_ID, setLab } from './config/lab.js';
import { TYPES } from './config/ships.js';
import { HATS, HAT_ORDER } from './config/hats.js';
import { R, initGL } from './render/gl.js';
import { renderScene } from './render/scene.js';
import { WX } from './render/weather.js';
import { proj, toWorld, cam, updateCamera, settleCamera } from './render/camera.js';
import { previewFor } from './hud/preview.js';
import { bindInput, dragTick } from './hud/input.js';
import { drawHUD } from './hud/hud.js';
import { update } from './sim/update.js';
import { loadBattle, adoptBattle, resize, perf, watchPerf } from './game.js';
import { dropMine } from './sim/combat.js';
import { startLanding, landingFor } from './sim/forts.js';
import { windFactor } from './sim/wind.js';
import { GOALS } from './sim/goals/index.js';
import { ABILITIES } from './sim/abilities/index.js';
import { WHEN, DO } from './sim/events.js';
import { spawnShip } from './sim/spawn.js';
import { TERRAIN, fleetLayout, coreDist, coastGap } from './sim/terrain.js';
import { applyCrit, RAKE, CRIT } from './sim/hazards.js';
import { blockedAt } from './sim/steering.js';
import { LANDMARKS, landOf, checkLand, leeAt } from './sim/land.js';
import { LANDS } from './config/lands.js';
import { GUNS, GUN_PARAMS } from './config/guns.js';
import { POSITIONS, checkLoadout, checkSlots } from './config/slots.js';
import { AMMO } from './config/ammo.js';
import { fireBroadside, gunRange } from './sim/combat.js';
import { sideLoad } from './sim/guns.js';
import { shipById, fortById } from './state.js';
import { audioTick } from './audio/director.js';
import { ui, initUI, openMenu, openBrief, startPlay, pauseGame, restoreScreen, syncSettings } from './ui/screens.js';

function render(dt) {
  dragTick(dt);
  updateCamera(Math.min(0.1, dt));
  renderScene();
  drawHUD();
}

let lastT = performance.now();
function frame(now) {
  const raw = now - lastT;
  lastT = now;
  watchPerf(raw);
  const t0 = performance.now();
  update(Math.min(0.05, raw / 1000));
  audioTick(raw / 1000);
  render(raw / 1000);
  if (perf.rec) {
    perf.rec.raw.push(raw); perf.rec.js.push(performance.now() - t0);
    perf.rec.calls.push(R.renderer ? R.renderer.info.render.calls : 0);
  }
  requestAnimationFrame(frame);
}

// The battle behind the main menu: whichever one is up next on the chart.
function backdropBattle() {
  const i = BATTLES.findIndex((b, k) => isUnlocked(k) && !save.stars[b.id]);
  return i < 0 ? 1 : i;
}

function start(data) {
  const ok = initGL();
  if (!ok) { $('glError').hidden = false; $('startBtn').disabled = true; }
  resize();
  initUI();
  bindInput(pauseGame);
  // A snapshot from an older build of the game has a different battle shape; ignore it and boot fresh.
  const usable = data && data.snap === SNAP && data.G && Array.isArray(data.G.ships) && Array.isArray(data.G.forts) &&
    Array.isArray(data.G.mines) && battleDef(data.G.battle);
  let restored = false;
  if (usable) {
    try {
      if (data.save) replaceSave(data.save);
      adoptBattle(data.G);
      S.selected = S.G.ships.find((s) => s.id === data.selectedId) || S.selected;
      ui.yardSel = data.yardSel || 0;
      restoreScreen(data.screen);
      restored = true;
    } catch (e) { restored = false; }
  }
  if (!restored) {
    const wanted = battleParam();
    if (wanted != null) { openBrief(wanted); startPlay(); } else { loadBattle(backdropBattle()); openMenu(); }
  }
  syncSettings();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseGame(); writeSave(); } });
  requestAnimationFrame((t) => { lastT = t; frame(t); });
}

// ?battle=<id> (or a campaign index, or 'endless') skips the menu and starts that battle: handy while making
// content. Unknown ids just warn and boot to the menu.
function battleParam() {
  let v = null;
  try { v = new URLSearchParams(location.search).get('battle'); } catch (e) { return null; }
  if (v == null || v === '') return null;
  if (v === ENDLESS_ID) return v;
  const i = /^\d+$/.test(v) ? +v : battleIndex(v);
  if (BATTLES[i]) return i;
  console.warn(`?battle=${v}: no such battle (ids: ${BATTLES.map((b) => b.id).join(', ')}, ${ENDLESS_ID})`);
  return null;
}

// Dev builds check the content tables against the primitive registries at boot (npm run check does the same).
if (import.meta.env.DEV) {
  import('./config/validate.js').then(({ validateContent }) => {
    const problems = validateContent({ BATTLES, REGIONS, FLEET_SLOTS, TYPES, HATS, HAT_ORDER, GOALS, ABILITIES, WHEN, DO, ENDLESS, waveEnemies, TERRAIN, fleetLayout, LANDS, landOf, checkLand, GUNS, GUN_PARAMS, POSITIONS, AMMO, checkLoadout, checkSlots });
    if (problems.length) console.warn(`Broadside content: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  });
}

// Hot reloads inside the Claude artifact viewer keep the current battle and screen.
const SNAP = 4; // bump when the shape of G changes
function snapshot() {
  if (!S.G) return {};
  return { snap: SNAP, G: JSON.parse(JSON.stringify(S.G)), selectedId: S.selected ? S.selected.id : null, screen: ui.screen, yardSel: ui.yardSel, save };
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(snapshot);
const boot = () => (hot && hot.ready ? hot.ready(start) : start((hot && hot.data) || {}));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();

// Exposed for automated playtesting.
window.__broadside = {
  get G() { return S.G; }, get S() { return S; }, get save() { return save; },
  battleIndex, openBrief, startPlay, dropMine, startLanding, landingFor, shipById, fortById, windFactor,
  GOALS, ABILITIES, events: { WHEN, DO }, spawnShip, blockedAt,
  // Combat rules and geography (src/sim/hazards.js, src/sim/terrain.js), for tests.
  hazards: { applyCrit, RAKE, CRIT }, terrain: { coreDist, coastGap },
  // Land and landmarks (src/sim/land.js, src/config/lands.js), for tests.
  land: { LANDMARKS, LANDS, leeAt: (x, y) => leeAt(S.G, x, y) },
  // Guns, slots and the great ship (src/config/guns.js, src/config/slots.js, src/save.js), for tests.
  guns: { GUNS, fireBroadside, gunRange, sideLoad, migrate, fitGun, fitOffer, buyGreatShip, greatOffer, fleetStats },
  startBattle(id) { openBrief(typeof id === 'number' ? id : battleIndex(id)); startPlay(); },
  // Plays an ad-hoc battle definition (same shape as src/config/battles.js; see src/config/lab.js for the
  // defaults). It goes through the briefing and results screens but never touches the save. brief: true stops
  // at the briefing.
  playDef(def, { brief = false } = {}) { setLab(def); openBrief(LAB_ID); if (!brief) startPlay(); return S.G; },
  proj: (x, y, z) => proj(x, y, z),
  setFire(m) { S.fireMode = m; syncSettings(); },
  // step advances the camera by the same game time (in one go, so tests stay fast); settle snaps it to
  // where the director wants it.
  step(n) { for (let i = 0; i < n; i++) update(1 / 60); updateCamera(n / 60); render(0); },
  settle() { settleCamera(); render(0); },
  camTick(dt) { updateCamera(dt); },
  get cam() { return cam; },
  toWorld: (x, y) => toWorld(x, y),
  // The course preview HUD draws for a ship (points as [x, y] pairs), or null.
  preview(id) { const s = shipById(id); const pv = s && previewFor(s, s.path, false); return pv ? { pts: Array.from(pv.xy.slice(0, pv.n * 2)), done: pv.done, t: pv.t, n: pv.n } : null; },
  sim(n) { for (let i = 0; i < n; i++) update(1 / 60); },
  get drawCalls() { return R.renderer ? R.renderer.info.render.calls : 0; },
  get weather() { return WX; },
  lockDpr(v) { perf.locked = true; S.view.maxDpr = v; resize(); },
  record(on) { if (on) { perf.rec = { raw: [], js: [], calls: [] }; return null; } const r = perf.rec; perf.rec = null; return r; },
};
