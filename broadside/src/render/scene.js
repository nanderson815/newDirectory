import * as THREE from 'three';
import { S } from '../state.js';
import { COL, PI, clamp, lerp, rand, angDiff } from '../util.js';
import { R, toon } from './gl.js';
import { wx, wz, fitCamera } from './camera.js';
import { bakeStatic, buildIsland, buildShipMesh, buildFortMesh, sharedIslandGeos, FORT_BASE_Y, FORT_SCALE } from './models.js';
import { WX, applyWeather, syncWeather } from './weather.js';

let worldObjs = [];
export let shipMeshes = new Map();
let fortMeshes = new Map();

const disposeTree = (o, keep) => o.traverse((c) => {
  if (!c.isMesh) return;
  if (!keep || !keep.has(c.geometry)) c.geometry.dispose();
  const mats = Array.isArray(c.material) ? c.material : [c.material];
  for (const m of mats) if (m !== R.vcToon && m !== R.inkMat && !m.userData.shared) m.dispose();
});

// Rebuilds the meshes for the current battle (islands, forts, ships). Templates and pools persist.
export function buildScene() {
  if (!R.renderer) return;
  const G = S.G, scene = R.scene;
  for (const m of shipMeshes.values()) { scene.remove(m.g); m.hullMat.dispose(); }
  for (const m of fortMeshes.values()) { scene.remove(m.g); disposeTree(m.g); }
  for (const o of worldObjs) { scene.remove(o); disposeTree(o); }
  shipMeshes = new Map(); fortMeshes = new Map(); worldObjs = [];

  // All islands bake into three meshes: toon land, ink outlines and the translucent shallows.
  const isles = new THREE.Group();
  for (const is of G.islands) isles.add(buildIsland(is, wx, wz));
  const b = bakeStatic(isles);
  const world = new THREE.Group();
  if (b.solid) world.add(new THREE.Mesh(b.solid, R.vcToon));
  if (b.ink) world.add(new THREE.Mesh(b.ink, R.inkMat));
  if (b.glass) {
    const shallows = new THREE.Mesh(b.glass, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    shallows.renderOrder = 1;
    world.add(shallows);
  }
  const shared = new Set(sharedIslandGeos());
  isles.traverse((c) => { if (c.isMesh && !shared.has(c.geometry)) c.geometry.dispose(); });
  scene.add(world);
  worldObjs.push(world);

  for (const f of G.forts) {
    const m = buildFortMesh(f, wx, wz);
    scene.add(m.g);
    fortMeshes.set(f.id, m);
  }
  for (const s of G.ships) {
    const m = buildShipMesh(s);
    scene.add(m.g);
    shipMeshes.set(s.id, m);
  }
  const u = R.water.material.uniforms;
  u.uHalf.value.set(G.W / 2, G.H / 2);
  // w = squared radius beyond which a fragment can't see this island's foam.
  u.uIsl.value.forEach((v, i) => { const is = G.islands[i]; if (is) v.set(wx(is.x), wz(is.y), is.r, (is.r * 1.8) ** 2); else v.set(0, 0, 0, 0); });
  u.uCount.value.x = Math.min(6, G.islands.length);
  applyWeather(G);
  fitCamera();
}

const kickDir = new THREE.Vector3();
const E = new THREE.Euler(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), M4 = new THREE.Matrix4();
function setInst(mesh, i, x, y, z, sx, sy, sz, rx, ry, rz) {
  E.set(rx || 0, ry || 0, rz || 0); Q.setFromEuler(E);
  P3.set(x, y, z); S3.set(sx, sy, sz);
  M4.compose(P3, Q, S3);
  mesh.setMatrixAt(i, M4);
}

// Copies the simulation into the scene: ship poses, forts, mines, shot and particles.
export function syncScene() {
  const G = S.G, P = R.pools, C3 = R.C3, clock = S.clock;
  const u = R.water.material.uniforms;
  u.uT.value = clock;
  u.uWind.value.set(Math.cos(G.wind.dir), Math.sin(G.wind.dir));
  syncWeather(G, clock);
  // Weather: swell scales the bob and roll; shadows fall `lift` map units per unit of height.
  const sw = WX.swell, [lx, lz] = WX.lift;

  let ns = 0, nf = 0;
  for (const s of G.ships) {
    const m = shipMeshes.get(s.id);
    if (!m) continue;
    if (s.state === 'sunk') { m.g.visible = false; continue; }
    const sinkK = s.state === 'sinking' ? clamp(s.sinkT / 3.2, 0, 1) : 0;
    m.g.position.set(wx(s.x), 0, wz(s.y));
    m.g.rotation.y = -s.h;
    const r = angDiff(s.h, G.wind.dir);
    const heel = Math.sin(r) * 0.07 * Math.min(1, s.v / s.speed);
    m.body.position.y = Math.sin(clock * 2 + s.bob) * 0.9 * sw - sinkK * sinkK * 46;
    // Going down: the bow dips first and she rolls over as she settles.
    m.body.rotation.x = Math.sin(clock * 1.6 + s.bob) * 0.045 * sw + heel + sinkK * 0.9;
    m.body.rotation.z = Math.sin(clock * 1.25 + s.bob * 2) * 0.025 * sw - sinkK * sinkK * 0.6;
    for (const p of m.pivots) p.rotation.y = -s.yard;
    const fill = Math.cos(r - s.yard);
    for (let i = 0; i < m.rigs.length; i++) m.rigs[i].scale.x = fill > 0.15 ? 0.35 + 0.65 * fill : 0.14 * Math.sin(clock * 14 + i);
    if (m.flagPivot) m.flagPivot.rotation.y = -r + Math.sin(clock * 9 + s.bob) * 0.22;
    m.hullMat.emissive.setScalar(s.flash > 0 ? (s.flash / 0.14) * 0.7 : 0);
    // A captured ship hoists her new owner's colours over her old canvas.
    if (s.team !== s.origTeam && m.flagTeam !== s.team && m.flagPivot) {
      m.flagPivot.children[0].material = toon(s.team === 'player' ? COL.blue : COL.red, { side: THREE.DoubleSide });
      m.flagTeam = s.team;
    }
    // Chain shot leaves the rigging in tatters: the sails sag while she's slowed.
    if (s.slowT > 0) for (let i = 0; i < m.rigs.length; i++) m.rigs[i].scale.x *= 0.45;
    if (sinkK < 0.6 && ns < 32) {
      const k = 1.08 * (1 - sinkK * 0.6);
      setInst(P.shipShadow, ns++, wx(s.x) + lx * 24, 0.25, wz(s.y) + lz * 25, s.L * k, 1, s.B * k, 0, -s.h, 0);
    }
    // Foam collar: hugs the waterline, swells with speed, churns wide while the ship goes down.
    if (nf < 32) {
      const spd = clamp(s.v / s.speed, 0, 1);
      const k = (s.state === 'sinking' ? 1 + sinkK * 0.7 : 1 + spd * 0.06) + Math.sin(clock * 5 + s.bob) * 0.025 * sw;
      const fade = s.state === 'sinking' ? 1 - sinkK * sinkK : 0.75 + spd * 0.25;
      setInst(P.foam, nf++, wx(s.x), 0.35, wz(s.y), s.L * 0.5 * k, 1, s.B * 0.5 * k * (0.75 + 0.25 * fade), 0, -s.h, 0);
    }
  }
  P.shipShadow.count = ns; P.foam.count = nf;
  P.shipShadow.instanceMatrix.needsUpdate = P.foam.instanceMatrix.needsUpdate = true;

  // Forts: a silenced tower slumps into a darker ruin and drops its flag; the gun tracks its target.
  for (const f of G.forts) {
    const m = fortMeshes.get(f.id);
    if (!m) continue;
    const ruin = f.state !== 'active';
    m.body.scale.y += ((ruin ? 0.62 : 1) - m.body.scale.y) * 0.12;
    m.mat.color.setScalar(ruin ? 0.62 : 1);
    m.turret.visible = !ruin;
    m.turret.position.y = 26 * m.body.scale.y;
    m.turret.rotation.y = -f.aim;
    m.flagPivot.visible = m.pole.visible = !ruin;
    if (m.team !== f.team) { m.team = f.team; m.flagMat.color.set(f.team === 'player' ? COL.blue : COL.red); }
    m.flagPivot.rotation.y = -G.wind.dir + Math.sin(clock * 9 + f.id) * 0.22;
  }

  // Cannonballs fly a low arc from their muzzle height.
  let n = 0;
  for (const b of S.balls) {
    if (n >= 400) break;
    const k = clamp(b.travel / b.max, 0, 1);
    const z = lerp(b.z0 || 6, 2, k) + Math.sin(PI * k) * 14;
    // Chain shot tumbles as a bar-and-chain; grapeshot is a spray of small pellets.
    if (b.kind === 'chain') setInst(P.ball, n, wx(b.x), z, wz(b.y), 2.3, 0.6, 0.6, 0, b.travel * 0.08, 0);
    else if (b.kind === 'grape') setInst(P.ball, n, wx(b.x), z, wz(b.y), 0.45, 0.45, 0.45);
    else setInst(P.ball, n, wx(b.x), z, wz(b.y), 1, 1, 1);
    setInst(P.ballShadow, n, wx(b.x) + z * lx, 0.3, wz(b.y) + z * lz, 1, 1, 1);
    n++;
  }
  P.ball.count = P.ballShadow.count = n;
  P.ball.instanceMatrix.needsUpdate = P.ballShadow.instanceMatrix.needsUpdate = true;

  let np = 0, ng = 0, nd = 0;
  const nr = [0, 0, 0];
  for (const p of S.particles) {
    const k = p.life / p.max, f = 1 - k;
    const X = wx(p.x), Z = wz(p.y);
    switch (p.kind) {
      case 'smoke': case 'soot': case 'drop': {
        // Cartoon puffs swell, then pop out of existence instead of fading.
        const pop = p.kind === 'drop' ? 1 : (k < 0.35 ? k / 0.35 : 1) * (0.55 + f * 0.9);
        const sc = p.size * pop;
        if (np < 1000) { setInst(P.puff, np, X, p.z, Z, sc, sc, sc, p.rot, p.rot, 0); P.puff.setColorAt(np, C3[p.kind]); np++; }
        break;
      }
      case 'flash': case 'fire': {
        const sc = p.size * (0.4 + k * 0.8);
        if (ng < 400) { setInst(P.glow, ng, X, p.z, Z, sc, sc, sc); P.glow.setColorAt(ng, C3[p.kind]); ng++; }
        break;
      }
      case 'splinter': case 'plank': case 'sand': case 'stone': {
        const fade = p.kind === 'plank' ? Math.min(1, p.life / 4) : 1;
        const len = p.size * fade, th = p.kind === 'plank' ? 2.2 : 1.4;
        const y = p.kind === 'plank' ? 0.6 + Math.sin(clock * 2 + p.rot * 5) * 0.3 * sw : p.z;
        const cube = p.kind === 'sand' || p.kind === 'stone';
        if (nd < 600) { setInst(P.debris, nd, X, y, Z, len, cube ? len : th, cube ? len : th * 1.8, 0, p.rot, p.kind === 'plank' ? 0 : p.rot); P.debris.setColorAt(nd, C3[p.kind]); nd++; }
        break;
      }
      case 'wake': case 'splash': case 'bubble': {
        const grow = p.kind === 'wake' ? 0.7 + f * 1.6 : p.kind === 'splash' ? 0.4 + f * 1.8 : 0.6 + f * 0.6;
        const band = k > 0.6 ? 0 : k > 0.3 ? 1 : 2;
        if (nr[band] < 400) { const sc = p.size * grow; setInst(P.rings[band], nr[band], X, 0.5, Z, sc, 1, sc); nr[band]++; }
        if (p.kind === 'splash' && f < 0.5 && np < 1000) {
          // A white water column that rises and collapses.
          const col = p.size * 0.6 * (1 - f * 2);
          setInst(P.puff, np, X, col * 0.5, Z, p.size * 0.32, col + 0.1, p.size * 0.32); P.puff.setColorAt(np, C3.drop); np++;
        }
        break;
      }
    }
  }

  // Sea mines bob in the swell; once armed, a light on top blinks in their owner's colour.
  let nm = 0;
  for (const mn of G.mines) {
    if (nm >= 64) break;
    const y = 1.5 + Math.sin(clock * 2 + mn.bob) * 0.6 * sw;
    setInst(P.mine, nm, wx(mn.x), y, wz(mn.y), 1, 1, 1, clock * 0.3 + mn.bob, mn.bob, 0);
    setInst(P.mineShadow, nm, wx(mn.x) + lx * 7, 0.3, wz(mn.y) + lz * 7, 1, 1, 1);
    nm++;
    if (mn.arm <= 0 && Math.sin(clock * 6 + mn.bob) > 0.2 && ng < 400) {
      setInst(P.glow, ng, wx(mn.x), y + 5, wz(mn.y), 1.7, 1.7, 1.7);
      P.glow.setColorAt(ng, mn.team === 'player' ? C3.minePlayer : C3.mineEnemy);
      ng++;
    }
  }
  P.mine.count = P.mineShadow.count = nm;
  P.mine.instanceMatrix.needsUpdate = P.mineShadow.instanceMatrix.needsUpdate = true;

  P.puff.count = np; P.glow.count = ng; P.debris.count = nd;
  P.rings.forEach((r, i) => { r.count = nr[i]; r.instanceMatrix.needsUpdate = true; });
  for (const pl of [P.puff, P.glow, P.debris]) {
    pl.instanceMatrix.needsUpdate = true;
    if (pl.instanceColor) pl.instanceColor.needsUpdate = true;
  }

  const base = R.camera.userData.base;
  if (base) {
    R.camera.position.copy(base);
    if (S.shake) { R.camera.position.x += rand(-S.shake, S.shake) * 1.5; R.camera.position.z += rand(-S.shake, S.shake) * 1.5; }
    // Recoil: the view nudges in a touch when your selected ship fires.
    if (S.kick) R.camera.position.addScaledVector(R.camera.getWorldDirection(kickDir), S.kick * S.kick * 7);
  }
}

// A ship that joins mid-battle (Endless Skirmish waves) gets its mesh here.
export function addShipMesh(s) {
  if (!R.renderer || shipMeshes.has(s.id)) return;
  const m = buildShipMesh(s);
  R.scene.add(m.g);
  shipMeshes.set(s.id, m);
}

export function renderScene() {
  if (!R.renderer || !S.G) return;
  syncScene();
  R.renderer.render(R.scene, R.camera);
}

export const fortTopZ = FORT_BASE_Y + 30 * FORT_SCALE;
