import { S, afloat } from '../state.js';
import { updateWind } from './wind.js';
import { updateShip, collide } from './ships.js';
import { fireQueued, updateBalls, updateMines } from './combat.js';
import { updateFort } from './forts.js';
import { updateBoardings } from './boarding.js';
import { updateGoals, judge } from './goals/index.js';
import { updateEvents } from './events.js';
import { updateFog } from './fog.js';
import { updateParticles } from './particles.js';
import { updateLand } from './land.js';
import { updateFlow } from './flow.js';
import { sfx } from '../audio/sfx.js';

// One simulation tick. Only a battle in play advances; menus keep the sea and particles alive.
export function update(dt) {
  S.clock += dt;
  const G = S.G;
  // A boss going down plays out in slow motion for a moment.
  if (S.slowmo && S.clock < S.slowmo.until) dt *= S.slowmo.k;
  if (G && G.phase === 'play') {
    G.t += dt;
    updateWind();
    const pending = S.pending;
    for (let i = pending.length - 1; i >= 0; i--) {
      pending[i].t -= dt;
      if (pending[i].t <= 0) { const p = pending[i]; pending.splice(i, 1); fireQueued(p); }
    }
    for (const s of G.ships) updateShip(s, dt);
    for (const f of G.forts) updateFort(f, dt);
    collide(dt);
    updateFlow(G, dt); // currents, the tide, harbour booms (before shot flies, so a boom can stop it)
    updateBalls(dt);
    updateMines(dt);
    updateBoardings(dt);
    updateLand(G, dt);
    updateGoals(G, dt);
    updateEvents(G);
    updateFog();
    updateTutorial();
    checkEnd();
  }
  updateParticles(dt);
  S.shake = Math.max(0, S.shake - dt * 20);
  S.kick = Math.max(0, S.kick - dt * 6);
}

export function checkEnd() {
  const G = S.G;
  if (G.endAt != null) {
    if (G.t >= G.endAt && S.hooks.onEnd) S.hooks.onEnd();
    return;
  }
  const v = judge(G);
  if (!v) return;
  G.result = v.result; G.reason = v.reason || null; G.endAt = G.t + 2.4;
}

// ---------- Tutorial ----------
// Steps: 0 drag a course to the buoy, 1 tap the sea to sail there, 2 anchor and turn on the spot,
// 3 tap the hulk to engage her, 4 sink her (the battle's own goal). Input sets the tapped / rotated /
// engaged flags.
export const TUTORIAL_STEPS = 5;

function updateTutorial() {
  const G = S.G, T = G.tut;
  if (!T) return;
  const swift = G.ships.find((s) => s.team === 'player');
  if (!swift) return;
  let next = T.step;
  if (T.step === 0 && G.buoy && Math.hypot(swift.x - G.buoy.x, swift.y - G.buoy.y) < 55) next = 1;
  else if (T.step === 1 && T.tapped) next = 2;
  else if (T.step === 2 && T.rotated) next = 3;
  else if (T.step === 3 && T.engaged) next = 4;
  if (next !== T.step) {
    T.step = next;
    sfx.fanfare(false);
    if (S.hooks.onTutorialStep) S.hooks.onTutorialStep(next);
  }
}
