import { desiredHeading, helm, shorePush } from './ships.js';

// Course preview: sails a stand-in for a ship along a course with the real helm (turning circle, wind,
// waypoint skipping and island avoidance), so the HUD can draw the track she will actually take.
// Run once each time a course changes, not every frame.
export const PREDICT = { step: 1 / 60, horizon: 11, every: 6 }; // the sim's own tick, so the track matches it
export const PREDICT_POINTS = Math.ceil(PREDICT.horizon / PREDICT.step / PREDICT.every) + 2;

const NONE = {};
const ghost = {
  id: -1, team: 'player', origTeam: 'player', state: 'afloat', kind: 'ship', escort: false, passive: false, boarding: null,
  pivot: null, order: null, path: [], x: 0, y: 0, h: 0, v: 0, L: 60, B: 20, turn: 1, speed: 50, hp: 1, maxHp: 1,
  slowT: 0, rig: 'square', oars: false, abilities: {},
};

// out = { xy: Float32Array(PREDICT_POINTS * 2), n, done, t, left }: points every `every` steps, whether the
// course is finished inside the horizon, how long that took and how many waypoints it had still to reach.
export function predictCourse(s, path, out) {
  const g = ghost;
  g.x = s.x; g.y = s.y; g.h = s.h; g.v = s.v; g.L = s.L; g.B = s.B; g.turn = s.turn; g.speed = s.speed;
  g.hp = s.hp; g.maxHp = s.maxHp; g.slowT = s.slowT; g.rig = s.rig; g.oars = s.oars; g.abilities = s.abilities;
  g.path.length = 0;
  for (let i = 0; i < path.length; i++) g.path.push(path[i]);
  const xy = out.xy, max = PREDICT_POINTS;
  let n = 0, k = 0, t = 0;
  xy[0] = g.x; xy[1] = g.y; n = 1;
  const steps = Math.round(PREDICT.horizon / PREDICT.step);
  out.done = false;
  for (; k < steps; k++) {
    const dt = PREDICT.step;
    const want = desiredHeading(g, dt);
    g.slowT = Math.max(0, g.slowT - dt);
    helm(g, want, dt);
    shorePush(g, dt);
    t += dt;
    if (!g.path.length) { out.done = true; break; }
    if ((k + 1) % PREDICT.every === 0 && n < max) { xy[n * 2] = g.x; xy[n * 2 + 1] = g.y; n++; }
  }
  if (n < max) { xy[n * 2] = g.x; xy[n * 2 + 1] = g.y; n++; }
  out.n = n; out.t = t; out.left = g.path.length;
  g.abilities = NONE; g.path.length = 0;
  return out;
}
