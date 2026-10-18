import { S } from './state.js';
import { save } from './save.js';
import { createBattle } from './sim/battle.js';
import { clearParticles } from './sim/particles.js';
import { R } from './render/gl.js';
import { worldSize, fitCamera, isLandscape } from './render/camera.js';
import { buildScene, addShipMesh } from './render/scene.js';
import { sizeHud } from './hud/hud.js';

S.hooks.onSpawn = addShipMesh;

// Sets up a battle (idle, in the 'title' phase) and builds its scene.
export function loadBattle(idx) {
  S.G = createBattle(idx, worldSize(), save.fleet);
  resetTransient();
  buildScene();
}

// Adopts a battle restored from a snapshot.
export function adoptBattle(G) {
  S.G = G;
  resetTransient();
  buildScene();
}

function resetTransient() {
  S.balls.length = 0;
  S.pending.length = 0;
  clearParticles();
  S.selected = S.G.ships.find((s) => s.team === 'player') || null;
  S.drag = null; S.toast = null; S.banner = null;
  S.floaters.length = 0; S.kick = 0; S.slowmo = null; S.selectAll = false;
}

export function resize() {
  const r = document.getElementById('hud').getBoundingClientRect();
  const v = S.view;
  v.cw = Math.max(1, r.width); v.ch = Math.max(1, r.height);
  v.dpr = Math.min(v.maxDpr, window.devicePixelRatio || 1);
  sizeHud();
  if (R.renderer) { R.renderer.setPixelRatio(v.dpr); R.renderer.setSize(v.cw, v.ch, false); }
  // Before the first shot, a turned phone gets the battle laid out for its new orientation.
  if (S.G && S.G.phase === 'title' && (S.G.W > S.G.H) !== isLandscape()) loadBattle(S.G.battle);
  else fitCamera();
}

// Adaptive resolution: if frames run long for a couple of seconds, render fewer pixels.
export const perf = { acc: 0, n: 0, cooldown: 3, locked: false, rec: null };
export function watchPerf(dtMs) {
  // A frame after the tab was hidden spans the whole absence; it says nothing about rendering speed.
  if (!R.renderer || document.hidden || perf.locked || dtMs > 250) return;
  perf.acc += dtMs; perf.n++;
  perf.cooldown -= dtMs / 1000;
  if (perf.n >= 90) {
    const avg = perf.acc / perf.n;
    perf.acc = 0; perf.n = 0;
    if (perf.cooldown <= 0 && avg > 24 && S.view.maxDpr > 1) {
      S.view.maxDpr = Math.max(1, S.view.maxDpr - 0.25);
      perf.cooldown = 3;
      resize();
    }
  }
}
