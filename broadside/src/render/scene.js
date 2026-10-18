import * as THREE from 'three';
import { S } from '../state.js';
import { BATTLES } from '../config/battles.js';
import { TYPES } from '../config/ships.js';
import { COL, PI, TAU, clamp, lerp, rand, angDiff } from '../util.js';
import { R, toon } from './gl.js';
import { wx, wz, fitCamera } from './camera.js';
import { bakeStatic, buildIsland, buildShipMesh, buildFortMesh, sharedIslandGeos, chestGeometries, sailTexture, FORT_BASE_Y, FORT_SCALE } from './models.js';
import { WX, applyWeather, syncWeather } from './weather.js';

let worldObjs = [];
export let shipMeshes = new Map();
let fortMeshes = new Map();
let lastClock = 0;
// Clock time each chest was hauled aboard (for its sparkle), by index into G.chests; null while afloat.
let chestTaken = [];
// Recent positions of each mortar shell in flight, for its smoke trail.
const shellTrail = new WeakMap();

const disposeTree = (o, keep) => o.traverse((c) => {
  if (!c.isMesh) return;
  if (!keep || !keep.has(c.geometry)) c.geometry.dispose();
  const mats = Array.isArray(c.material) ? c.material : [c.material];
  for (const m of mats) if (m !== R.vcToon && m !== R.inkMat && !m.userData.shared) m.dispose();
});

const battleFaction = (G) => { const b = BATTLES[G.battle]; return b ? b.faction : undefined; };
function makeShipMesh(s, G) {
  const m = buildShipMesh(s, battleFaction(G));
  m.vis = s.hidden === true || s.state === 'escaped' ? 0 : 1;
  m.g.visible = m.vis > 0;
  return m;
}

// Rebuilds the meshes for the current battle (islands, forts, ships). Templates and pools persist.
export function buildScene() {
  if (!R.renderer) return;
  const G = S.G, scene = R.scene;
  for (const m of shipMeshes.values()) { scene.remove(m.g); for (const mt of m.mats) mt.dispose(); }
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
    const m = makeShipMesh(s, G);
    scene.add(m.g);
    shipMeshes.set(s.id, m);
  }
  chestTaken = (G.chests || []).map((c) => (c.taken ? -99 : null));
  const u = R.water.material.uniforms;
  u.uHalf.value.set(G.W / 2, G.H / 2);
  // w = squared radius beyond which a fragment can't see this island's foam.
  u.uIsl.value.forEach((v, i) => { const is = G.islands[i]; if (is) v.set(wx(is.x), wz(is.y), is.r, (is.r * 1.8) ** 2); else v.set(0, 0, 0, 0); });
  u.uCount.value.x = Math.min(6, G.islands.length);
  applyWeather(G);
  fitCamera();
}

// The chest pools are only built once a battle has chests.
function chestPools() {
  const P = R.pools;
  if (!P.chest) {
    const g = chestGeometries();
    P.chest = P.mk(g.solid, R.vcToon, 32);
    P.chestInk = P.mk(g.ink, R.inkMat, 32);
    P.chestShadow = P.mk(new THREE.CircleGeometry(6, 12).rotateX(-PI / 2), P.flatShadow(), 32);
    P.chestShadow.renderOrder = 1;
    P.chestShadow.material.color.copy(P.mineShadow.material.color);
    P.chestShadow.material.opacity = P.mineShadow.material.opacity;
  }
  return P;
}

const kickDir = new THREE.Vector3();
const E = new THREE.Euler(), Q = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), M4 = new THREE.Matrix4();
function setInst(mesh, i, x, y, z, sx, sy, sz, rx, ry, rz) {
  E.set(rx || 0, ry || 0, rz || 0); Q.setFromEuler(E);
  P3.set(x, y, z); S3.set(sx, sy, sz);
  M4.compose(P3, Q, S3);
  mesh.setMatrixAt(i, M4);
}

// Player ship positions, for what the lookouts can see in fog.
const eyes = [];
const inSight = (x, y, r2) => { for (let i = 0; i < eyes.length; i += 2) { const dx = x - eyes[i], dy = y - eyes[i + 1]; if (dx * dx + dy * dy < r2) return true; } return false; };

// Copies the simulation into the scene: ship poses, forts, mines, shot and particles.
export function syncScene() {
  const G = S.G, P = R.pools, C3 = R.C3, clock = S.clock;
  const dt = clamp(clock - lastClock, 0, 0.1);
  lastClock = clock;
  const u = R.water.material.uniforms;
  u.uT.value = clock;
  u.uWind.value.set(Math.cos(G.wind.dir), Math.sin(G.wind.dir));
  syncWeather(G, clock);
  // Weather: swell scales the bob and roll; shadows fall `lift` map units per unit of height.
  const sw = WX.swell, [lx, lz] = WX.lift;
  const fogR = G.fog > 0 ? G.fog : 0;
  eyes.length = 0;
  if (fogR) for (const s of G.ships) if (s.team === 'player' && s.state !== 'sunk' && s.state !== 'escaped') eyes.push(s.x, s.y);
  const fogR2 = (fogR * 1.05) ** 2;

  let ns = 0, nf = 0;
  for (const s of G.ships) {
    const m = shipMeshes.get(s.id);
    if (!m) continue;
    if (s.state === 'sunk') { m.g.visible = false; continue; }
    // Out of sight in the fog, or gone through the exit: a quick dissolve, then nothing (wake and shadow too).
    const escaped = s.state === 'escaped';
    if (escaped || s.hidden === true) m.vis = Math.max(0, m.vis - dt * (escaped ? 1.5 : 5));
    else m.vis = Math.min(1, m.vis + dt * 5);
    if (m.vis <= 0) { m.g.visible = false; continue; }
    m.g.visible = true;
    m.u.uFade.value = m.vis;
    const sinking = s.state === 'sinking';
    const sinkK = sinking ? clamp(s.sinkT / 3.2, 0, 1) : 0;
    m.g.position.set(wx(s.x), 0, wz(s.y));
    m.g.rotation.y = -s.h;
    const r = angDiff(s.h, G.wind.dir);
    const heel = Math.sin(r) * 0.07 * Math.min(1, s.v / s.speed);
    m.body.position.y = Math.sin(clock * 2 + s.bob) * 0.9 * sw - sinkK * sinkK * 46;
    // Going down: the bow dips first and she rolls over as she settles.
    m.body.rotation.x = Math.sin(clock * 1.6 + s.bob) * 0.045 * sw + heel + sinkK * 0.9;
    m.body.rotation.z = Math.sin(clock * 1.25 + s.bob * 2) * 0.025 * sw - sinkK * sinkK * 0.6;

    // Sails: square yards brace to the wind; gaff and lateen booms swing out to leeward (and gybe across).
    const fill = Math.cos(r - s.yard);
    let sq = fill > 0.15 ? 0.35 + 0.65 * fill : 9;
    const off = PI - Math.abs(r);
    let fa = off > 0.35 ? 0.35 + 0.65 * clamp((off - 0.35) / 0.8, 0, 1) : 9;
    const boomTo = (r < 0 ? -1 : 1) * Math.min(1.35, off * 0.45);
    m.boom += (boomTo - m.boom) * Math.min(1, dt * 2.5);
    // Chain shot leaves the rigging in tatters: the sails sag while she's slowed.
    if (s.slowT > 0) { if (sq < 2) sq *= 0.45; if (fa < 2) fa *= 0.45; }
    if (fa < 2 && m.boom < 0) fa = -fa;
    // Damage: scorched paint and canvas, shot-through sails below half, the main topmast gone below a quarter.
    const hpK = s.maxHp ? clamp(s.hp / s.maxHp, 0, 1) : 1;
    const broken = hpK < 0.25 ? m.tpl.mainIdx : -1;
    m.u.uSail.value.set(sq, fa, clock, broken);
    const scorch = clamp((0.8 - hpK) / 0.8, 0, 1);
    m.hullMat.color.setScalar(1 - 0.36 * scorch);
    if (m.rigMat) {
      m.rigMat.color.setScalar(1 - 0.24 * scorch);
      const torn = m.tpl.torn || hpK < 0.5;
      if (torn !== m.torn) { m.torn = torn; m.rigMat.map = sailTexture(m.tpl.look, torn); }
    }
    // Sinking: the masts go by the board one after another, alternating sides.
    const mu = m.u.uMast.value;
    mu.set(0, 0, 0, broken);
    if (sinking) for (let i = 0; i < 3; i++) { const t = clamp((s.sinkT - 0.25 - i * 0.22) / 1.5, 0, 1); mu.setComponent(i, t * t * 1.55 * ((s.id + i) & 1 ? 1 : -1)); }
    for (const p of m.pivots) { p.rotation.y = p.userData.fa ? m.boom : -s.yard; p.rotation.x = mu.getComponent(p.userData.mast); }
    if (m.tpl.oars && !sinking) m.oar += dt * (1.6 + 3.2 * clamp(s.v / s.speed, 0, 1));
    m.u.uMastH.value.w = m.oar;
    if (m.flagPivot) {
      m.flagPivot.rotation.y = -r + Math.sin(clock * 9 + s.bob) * 0.22;
      m.flagPivot.position.y = broken >= 0 ? m.tpl.brokenFlagY : m.tpl.flagY;
      m.flagPivot.visible = m.vis > 0.98 && Math.abs(mu.getComponent(m.tpl.mainIdx)) < 0.2;
    }
    m.hullMat.emissive.setScalar(s.flash > 0 ? (s.flash / 0.14) * 0.7 : 0);
    // A captured ship hoists her new owner's colours over her old canvas.
    if (s.team !== s.origTeam && m.flagTeam !== s.team && m.flagPivot) {
      m.flagPivot.children[0].material = toon(s.team === 'player' ? COL.blue : COL.red, { side: THREE.DoubleSide });
      m.flagTeam = s.team;
    }
    if (sinkK < 0.6 && ns < 32) {
      const k = 1.08 * (1 - sinkK * 0.6) * m.vis;
      setInst(P.shipShadow, ns++, wx(s.x) + lx * 24, 0.25, wz(s.y) + lz * 25, s.L * k, 1, s.B * k, 0, -s.h, 0);
    }
    // Foam collar: hugs the waterline, swells with speed, churns wide while the ship goes down.
    if (nf < 32) {
      const spd = clamp(s.v / s.speed, 0, 1);
      const k = ((sinking ? 1 + sinkK * 0.7 : 1 + spd * 0.06) + Math.sin(clock * 5 + s.bob) * 0.025 * sw) * m.vis;
      const fade = sinking ? 1 - sinkK * sinkK : 0.75 + spd * 0.25;
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

  let np = 0, ng = 0, nd = 0;
  // Cannonballs fly a low arc from their muzzle height; mortar shells carry their own (high) height.
  let n = 0;
  for (const b of S.balls) {
    if (n >= 400) break;
    const X = wx(b.x), Zp = wz(b.y);
    if (b.kind === 'shell') {
      const z = typeof b.h === 'number' ? Math.max(0, b.h) : lerp(b.z0 || 6, 2, clamp(b.travel / b.max, 0, 1)) + Math.sin(PI * clamp(b.travel / b.max, 0, 1)) * 90;
      setInst(P.ball, n, X, z + 2, Zp, 1.5, 1.5, 1.5, b.x * 0.05, 0, b.y * 0.05);
      // The shadow stays on the water under the shell, spreading as it climbs.
      const hz = Math.min(z, 30), sc = 0.85 + Math.min(z, 220) / 260;
      setInst(P.ballShadow, n, X + hz * lx, 0.3, Zp + hz * lz, sc, 1, sc);
      np = shellSmoke(b, X, z + 2, Zp, clock, np);
    } else {
      const k = clamp(b.travel / b.max, 0, 1);
      const z = lerp(b.z0 || 6, 2, k) + Math.sin(PI * k) * 14;
      // Chain shot tumbles as a bar-and-chain; grapeshot is a spray of small pellets.
      if (b.kind === 'chain') setInst(P.ball, n, X, z, Zp, 2.3, 0.6, 0.6, 0, b.travel * 0.08, 0);
      else if (b.kind === 'grape') setInst(P.ball, n, X, z, Zp, 0.45, 0.45, 0.45);
      else setInst(P.ball, n, X, z, Zp, 1, 1, 1);
      setInst(P.ballShadow, n, X + z * lx, 0.3, Zp + z * lz, 1, 1, 1);
    }
    n++;
  }
  P.ball.count = P.ballShadow.count = n;
  P.ball.instanceMatrix.needsUpdate = P.ballShadow.instanceMatrix.needsUpdate = true;

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
        // In fog, a wake out beyond the lookouts' sight would give a hidden ship away.
        if (fogR && p.kind !== 'splash' && !inSight(p.x, p.y, fogR2)) break;
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

  // Ship effects drawn straight from the ship state (no sim particles): bow spray and deck fires.
  for (const s of G.ships) {
    const m = shipMeshes.get(s.id);
    if (!m || !m.g.visible || m.vis < 0.6 || s.state === 'sunk') continue;
    const c = Math.cos(s.h), sn = Math.sin(s.h);
    const sinking = s.state === 'sinking';
    const deck = m.tpl.deckY + m.body.position.y;
    const scale = s.L / 70;
    // Bow spray: sheets of white water thrown off either bow, more and higher the faster she goes.
    const spd = clamp(s.v / (s.speed || 1), 0, 1);
    if (!sinking && spd > 0.15 && s.state !== 'escaped') {
      const kk = (spd - 0.15) / 0.85;
      for (let j = 0; j < 8 && np < 1000; j++) {
        const side = j & 1 ? 1 : -1;
        if (j < 4) {
          // The bow wave: flat white curls pushed out along each side of the bow.
          const back = j >> 1, fl = 1 + Math.sin(clock * 7 + j + s.bob) * 0.08;
          const ax = s.L * (0.42 - back * 0.13), az = side * s.B * (0.36 + back * 0.16) * (0.9 + 0.2 * kk);
          const len = s.L * (0.09 + 0.05 * kk) * fl, wid = s.B * (0.07 + 0.06 * kk) * fl;
          setInst(P.puff, np, wx(s.x + ax * c - az * sn), 0.5, wz(s.y + ax * sn + az * c), len, 0.6, wid, 0, -s.h - side * (0.42 + back * 0.12), 0);
        } else {
          // Spray thrown up off either bow, more and higher the faster she goes.
          const t = (clock * 1.8 + ((j - 4) >> 1) * 0.5 + s.bob) % 1;
          const ax = s.L * (0.47 - t * 0.14), az = side * (s.B * 0.22 + t * s.B * (0.3 + 0.35 * kk));
          const h = 0.8 + Math.sin(PI * t) * (2 + 6 * kk) * scale;
          const sc = (1.2 + 2.4 * kk) * (1 - t * 0.75) * scale;
          setInst(P.puff, np, wx(s.x + ax * c - az * sn), h, wz(s.y + ax * sn + az * c), sc * 1.2, sc, sc * 1.2, t * 3, j, 0);
        }
        P.puff.setColorAt(np, C3.drop); np++;
      }
    }
    // Burning: licking flames along the deck and a column of black smoke streaming downwind.
    // Fireships burn from the start unless the sim says otherwise.
    const T = TYPES[s.type], burning = s.burning === true || (s.burning === undefined && !!(s.fireship || (s.abilities && s.abilities.fireship) || (T && T.abilities && T.abilities.fireship)));
    if (burning && (!sinking || s.sinkT < 2.2)) {
      const wdx = Math.cos(G.wind.dir), wdy = Math.sin(G.wind.dir);
      // Each tongue of flame: a broad orange base and a yellow tip that rises, shrinks and starts again.
      for (let i = 0; i < 7 && ng < 397; i++) {
        const ax = (i / 6 - 0.5) * s.L * 0.62, az = (((i * 7) % 3) - 1) * s.B * 0.17;
        const x = s.x + ax * c - az * sn, y = s.y + ax * sn + az * c;
        const fl = 0.8 + 0.2 * Math.sin(clock * (11 + i) + i * 2.3) + 0.1 * Math.sin(clock * 23 + i * 5);
        const sz = (4.6 + (i % 3) * 1.4) * fl * scale;
        const t = (clock * 2.4 + i * 0.37) % 1;
        setInst(P.glow, ng, wx(x), deck + sz * 0.7, wz(y), sz * 1.1, sz * 1.5, sz * 1.1); P.glow.setColorAt(ng, i % 2 ? C3.fire : C3.ember); ng++;
        setInst(P.glow, ng, wx(x), deck + sz * (1.2 + t * 1.6), wz(y), sz * 0.7 * (1 - t * 0.7), sz * 1.4 * (1 - t * 0.6), sz * 0.7 * (1 - t * 0.7)); P.glow.setColorAt(ng, C3.flame); ng++;
        setInst(P.glow, ng, wx(x), deck + sz * 0.9, wz(y), sz * 0.45, sz * 0.9, sz * 0.45); P.glow.setColorAt(ng, C3.flash); ng++;
      }
      for (let j = 0; j < 9 && np < 1000; j++) {
        const t = (clock * 0.5 + j / 9 + s.bob * 0.1) % 1;
        const ax = ((j * 5) % 7 / 6 - 0.5) * s.L * 0.5;
        const x = s.x + ax * c + wdx * (6 + t * 70), y = s.y + ax * sn + wdy * (6 + t * 70);
        const sz = (2 + t * 8) * (t < 0.15 ? t / 0.15 : 1) * (t > 0.85 ? (1 - t) / 0.15 : 1) * scale;
        setInst(P.puff, np, wx(x), deck + 14 + t * 40, wz(y), sz, sz, sz, j, t * 2, 0); P.puff.setColorAt(np, C3.soot); np++;
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

  // Treasure chests bob among the waves with a glint of gold; hauled aboard, one bursts into sparkles.
  const chests = G.chests || [];
  if (chests.length || (P.chest && P.chest.count)) {
    chestPools();
    let nc = 0;
    for (let i = 0; i < chests.length; i++) {
      const ch = chests[i];
      if (ch.taken) {
        if (chestTaken[i] == null) chestTaken[i] = clock;
        const t = (clock - chestTaken[i]) / 0.9;
        if (t < 1) ng = sparkle(wx(ch.x), wz(ch.y), t, i, ng);
        continue;
      }
      chestTaken[i] = null;
      if (nc >= 32) continue;
      const y = 0.4 + Math.sin(clock * 2 + i * 1.9) * 0.7 * sw;
      if (nr[1] < 400) { const rs = 9 + Math.sin(clock * 2 + i) * 0.8; setInst(P.rings[1], nr[1]++, wx(ch.x), 0.45, wz(ch.y), rs, 1, rs); }
      setInst(P.chest, nc, wx(ch.x), y, wz(ch.y), 1.5, 1.5, 1.5, Math.sin(clock * 1.6 + i) * 0.12, i * 1.3 + clock * 0.15, Math.cos(clock * 1.3 + i) * 0.1);
      P.chestInk.setMatrixAt(nc, M4);
      setInst(P.chestShadow, nc, wx(ch.x) + lx * 5, 0.3, wz(ch.y) + lz * 5, 1, 1, 1);
      const gl = Math.sin(clock * 2.3 + i * 1.7);
      if (gl > 0.9 && ng < 400) {
        const sz = 2.6 * (gl - 0.9) / 0.1;
        setInst(P.glow, ng, wx(ch.x) + 3.2, y + 10, wz(ch.y) + 2.5, sz * 0.5, sz * 2, sz * 0.5); P.glow.setColorAt(ng++, C3.glint);
        if (ng < 400) { setInst(P.glow, ng, wx(ch.x) + 3.2, y + 10, wz(ch.y) + 2.5, sz * 2, sz * 0.5, sz * 0.5); P.glow.setColorAt(ng++, C3.glint); }
      }
      nc++;
    }
    P.chest.count = P.chestInk.count = P.chestShadow.count = nc;
    P.chest.instanceMatrix.needsUpdate = P.chestInk.instanceMatrix.needsUpdate = P.chestShadow.instanceMatrix.needsUpdate = true;
  }

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

// A faint smoke trail behind a mortar shell: the last few positions it passed through, sampled every 50 ms.
function shellSmoke(b, X, Y, Z, clock, np) {
  const P = R.pools;
  let tr = shellTrail.get(b);
  if (!tr) { tr = { pts: [], at: -1 }; shellTrail.set(b, tr); }
  if (clock - tr.at > 0.05 || clock < tr.at) {
    tr.at = clock;
    tr.pts.unshift(X, Y, Z);
    if (tr.pts.length > 24) tr.pts.length = 24;
  }
  for (let i = 3, k = 1; i < tr.pts.length && np < 1000; i += 3, k++) {
    const sc = 2.6 * (1 - k / 9) + 0.6;
    setInst(P.puff, np, tr.pts[i], tr.pts[i + 1], tr.pts[i + 2], sc, sc, sc, k, k * 2, 0);
    P.puff.setColorAt(np, R.C3.shellSmoke); np++;
  }
  return np;
}

// A burst of gold and white sparks rising off a chest as it's hauled aboard (t runs 0..1).
function sparkle(X, Z, t, seed, ng) {
  const P = R.pools, e = 1 - (1 - t) * (1 - t);
  for (let j = 0; j < 12 && ng < 400; j++) {
    const a = (j / 12) * TAU + seed;
    const rr = e * (10 + (j % 3) * 7), sz = (1 - t) * (j % 2 ? 2.6 : 1.8);
    setInst(P.glow, ng, X + Math.cos(a) * rr, 3 + e * (8 + (j % 4) * 5) - t * t * 6, Z + Math.sin(a) * rr, sz, sz, sz);
    P.glow.setColorAt(ng++, j % 3 ? R.C3.gold : R.C3.glint);
  }
  if (t < 0.3 && ng < 400) { const sz = 9 * (1 - t / 0.3); setInst(P.glow, ng, X, 4, Z, sz, sz * 0.6, sz); P.glow.setColorAt(ng++, R.C3.gold); }
  return ng;
}

// A ship that joins mid-battle (Endless Skirmish waves) gets its mesh here.
export function addShipMesh(s) {
  if (!R.renderer || shipMeshes.has(s.id)) return;
  const m = makeShipMesh(s, S.G);
  R.scene.add(m.g);
  shipMeshes.set(s.id, m);
}

export function renderScene() {
  if (!R.renderer || !S.G) return;
  syncScene();
  R.renderer.render(R.scene, R.camera);
}

export const fortTopZ = FORT_BASE_Y + 30 * FORT_SCALE;

// For tests and screenshots: rebuild the scene after editing G by hand.
R.debug = { buildScene, addShipMesh, get shipMeshes() { return shipMeshes; } };
