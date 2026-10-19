import * as THREE from 'three';
import { S } from '../state.js';
import { battleDef } from '../config/endless.js';
import { weatherFor } from '../config/weather.js';
import { sfx } from '../audio/sfx.js';
import { COL, PI, TAU, clamp, rand, reduceMotion } from '../util.js';
import { R } from './gl.js';

// Weather, time of day and atmosphere. A battle's preset (config/weather.js) sets the sea palette, lights,
// shadows and a screen grade (tint, far-edge haze, vignette, lightning flash) that the water shader draws, since
// the sea already fills the screen. Three extras cost one draw call each: seagulls with their shadows, rain
// streaks and a fog veil. Rain and wing flaps run in the vertex shader; the CPU only moves a few gull instances.

// Read by syncScene: swell scales ship and mine bob and roll; lift is the shadow offset per unit of height.
// name and flash (the current lightning level, 0..1) are for tests.
export const WX = { name: null, swell: 1, lift: [0.3, 0.36], flash: 0 };

const GULLS = 12, GULL_SIZE = 1.3;
let fx = null, cur = null, lastClock = 0;
const storm = { next: 0, flashAt: -9, thunderAt: -1 };
const gulls = [];

// Weather colours go straight into shaders that write sRGB, so they skip three's colour management.
const hexRGB = (hex) => { const c = parseInt(hex.slice(1), 16); return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; };
const setRGB = (v, hex) => v.set(...hexRGB(hex));

// Applies the current battle's weather. Called from buildScene.
export function applyWeather(G) {
  if (!R.renderer) return;
  if (!fx) fx = buildFx();
  const w = cur = weatherFor(battleDef(G.battle));
  R.renderer.setClearColor(w.clear);

  const u = R.water.material.uniforms, wa = w.water;
  setRGB(u.uDeep.value, wa.deep); setRGB(u.uMid.value, wa.mid); setRGB(u.uLight.value, wa.light);
  setRGB(u.uCrest.value, wa.crest); setRGB(u.uFoam.value, wa.foam); setRGB(u.uGlint.value, wa.glint);
  u.uCloud.value.set(wa.clouds, 0.0005 * wa.cloudScale, 14);
  u.uGlow.value.set(...hexRGB(wa.glow || '#ffffff'), wa.glowA || 0);
  u.uCaps.value = wa.caps; u.uFlow.value = wa.flow;

  const L = w.light;
  R.hemi.color.set(L.sky); R.hemi.groundColor.set(L.ground); R.hemi.intensity = L.hemi;
  R.sun.color.set(L.sun); R.sun.intensity = L.sunI; R.sun.position.set(...L.dir);
  u.uSunXZ.value.set(L.dir[0], L.dir[2]).normalize();

  const P = R.pools, sh = w.shadow;
  for (const m of [P.ballShadow, P.mineShadow, P.shipShadow]) m.material.color.set(sh.color);
  P.ballShadow.material.opacity = P.mineShadow.material.opacity = sh.opacity;
  P.shipShadow.material.opacity = sh.opacity - 0.04;
  WX.lift = sh.lift; WX.swell = w.swell; WX.name = w.name; WX.flash = 0;

  setupScreen(w.screen);
  setupGulls(G, w.gulls || 0, sh);
  setupRain(G, w.rain);
  setupFog(G, w);
  storm.next = S.clock + rand(2, 5); storm.flashAt = -9; storm.thunderAt = -1;
  lastClock = S.clock;
}

// Animates the weather. Called from syncScene every frame.
export function syncWeather(G, clock) {
  if (!fx || !cur) return;
  const dt = clamp(clock - lastClock, 0, 0.1);
  lastClock = clock;
  let flash = 0;
  if (cur.lightning) {
    const L = cur.lightning;
    if (clock >= storm.next) {
      storm.next = clock + rand(L.every[0], L.every[1]);
      if (!reduceMotion) storm.flashAt = clock;
      storm.thunderAt = clock + rand(L.thunder[0], L.thunder[1]);
    }
    // Thunder rolls in after the flash; placeholder sound until the new audio lands.
    if (storm.thunderAt > 0 && clock >= storm.thunderAt) {
      storm.thunderAt = -1;
      if (G.phase === 'play') sfx.boom(0.6, 0.4);
    }
    // A bright blink, a flicker, then a quick fade.
    const t = clock - storm.flashAt;
    flash = t < 0 ? 0 : t < 0.07 ? 1 : t < 0.13 ? 0.2 : t < 0.2 ? 0.8 : Math.max(0, 0.8 * (1 - (t - 0.2) / 0.45));
  }
  WX.flash = flash;
  R.hemi.intensity = cur.light.hemi * (1 + flash * 0.9);
  // The flash lights the sky: the sea brightens and the vignette lifts.
  const wu = R.water.material.uniforms;
  wu.uFlash.value.w = flash * 0.45;
  wu.uVig.value.w = (cur.screen.vignette || 0) * (1 - flash * 0.7);
  R.renderer.getDrawingBufferSize(wu.uRes.value);

  if (fx.rain.visible) {
    const ru = fx.rain.material.uniforms, sl = fx.rain.userData.slant;
    ru.uT.value = clock;
    ru.uFall.value.set(Math.cos(G.wind.dir) * sl, -1, Math.sin(G.wind.dir) * sl).normalize();
  }
  if (gulls.length) moveGulls(G, clock, dt);
  if (fx.veil.visible) moveFog(G, clock);
}

// ---------- Meshes ----------
function buildFx() {
  const scene = R.scene;
  const gull = new THREE.InstancedMesh(gullGeometry(), gullMaterial(), GULLS * 2);
  gull.geometry.setAttribute('aFlap', new THREE.InstancedBufferAttribute(new Float32Array(GULLS * 2), 1).setUsage(THREE.DynamicDrawUsage));
  gull.geometry.setAttribute('aShadow', new THREE.InstancedBufferAttribute(new Float32Array(GULLS * 2), 1));
  gull.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gull.frustumCulled = false; gull.count = 0; gull.visible = false; gull.renderOrder = 3;
  scene.add(gull);
  const rain = new THREE.Mesh(new THREE.BufferGeometry(), rainMaterial());
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 4;
  scene.add(rain);
  const veil = new THREE.Mesh(veilGeometry(), veilMaterial());
  veil.frustumCulled = false; veil.visible = false; veil.renderOrder = 3;
  scene.add(veil);
  return { gull, rain, veil };
}

// ---------- Screen grade: tint, far haze and vignette, drawn by the water shader ----------
function setupScreen(sc) {
  const u = R.water.material.uniforms;
  u.uTint.value.set(...hexRGB(sc.tint || '#000000'), sc.tintA || 0);
  u.uHaze.value.set(...hexRGB(sc.haze || '#000000'), sc.hazeA || 0);
  u.uHazeY.value.set(sc.hazeFrom == null ? 0.5 : sc.hazeFrom, 1);
  u.uVig.value.set(...hexRGB(sc.vignetteColor || '#000000'), sc.vignette || 0);
}

// ---------- Seagulls ----------
// A flat cartoon gull (beak along +x, wings along z) with an ink rim drawn first underneath. aWing is how far
// a vertex moves when the wings beat; aInk marks the rim, which shadows leave out.
function gullGeometry() {
  const pos = [], col = [], wing = [], ink = [];
  const white = [1, 1, 1], grey = [0.8, 0.85, 0.9], tip = [0.22, 0.22, 0.27], rim = hexRGB(COL.ink);
  const tris = [];
  const tri = (a, b, c, ca, cb, cc) => tris.push([a, b, c, ca, cb, cc]);
  tri([4.6, 0, 0], [0.3, 0, 1.1], [-4, 0, 0], white, white, white);
  tri([4.6, 0, 0], [-4, 0, 0], [0.3, 0, -1.1], white, white, white);
  tri([-3.4, 0, 0], [-6.4, 0, 1.6], [-6.4, 0, -1.6], grey, grey, grey);
  for (const s of [1, -1]) {
    const rf = [1.8, 0, 0.8 * s], rb = [-1.6, 0, 0.8 * s], ef = [1.7, 0.8, 5.6 * s], eb = [-0.9, 0.8, 5.2 * s], tp = [-3.4, -0.2, 11 * s];
    tri(rf, ef, eb, white, white, white);
    tri(rf, eb, rb, white, white, white);
    tri(ef, tp, eb, grey, tip, grey);
  }
  const push = (p, c, isInk) => {
    if (isInk) pos.push(p[0] * 1.2, p[1] - 0.5, p[2] * 1.16); else pos.push(p[0], p[1], p[2]);
    col.push(...(isInk ? rim : c));
    wing.push(Math.abs(p[2]) / 11 * 5.5);
    ink.push(isInk ? 1 : 0);
  };
  for (const isInk of [true, false]) for (const t of tris) for (let k = 0; k < 3; k++) push(t[k], t[k + 3], isInk);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  g.setAttribute('aInk', new THREE.Float32BufferAttribute(ink, 1));
  return g;
}

function gullMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uShadow: { value: new THREE.Vector4(0, 0, 0, 0.2) } },
    vertexShader: `
      attribute vec3 aCol; attribute float aWing, aInk, aFlap, aShadow;
      uniform vec4 uShadow;
      varying vec4 vC;
      void main(){
        vec3 p = position;
        p.y += aFlap * aWing;
        p *= 1.0 - aInk * aShadow;
        vC = mix(vec4(aCol, 1.0), uShadow, aShadow);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'varying vec4 vC; void main(){ gl_FragColor = vC; }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function setupGulls(G, n, sh) {
  const m = fx.gull;
  gulls.length = 0;
  n = Math.min(GULLS, n);
  m.visible = n > 0; m.count = n * 2;
  if (!n) return;
  // Shadows take the first n instances so they draw before (under) the birds.
  const kind = m.geometry.attributes.aShadow;
  for (let i = 0; i < n * 2; i++) kind.array[i] = i < n ? 1 : 0;
  kind.needsUpdate = true;
  const [r, g, b] = hexRGB(sh.color);
  m.material.uniforms.uShadow.value.set(r, g, b, sh.opacity * 0.7);
  for (let i = 0; i < n; i++) {
    gulls.push({
      cx: rand(-0.45, 0.45) * G.W, cz: rand(-0.45, 0.45) * G.H, r: rand(35, 85),
      w: (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.6), th: rand(0, TAU), alt: rand(70, 100), ph: rand(0, TAU),
    });
  }
}

const gE = new THREE.Euler(0, 0, 0, 'YXZ'), gQ = new THREE.Quaternion(), gP = new THREE.Vector3(), gS = new THREE.Vector3(), gM = new THREE.Matrix4();
function moveGulls(G, clock, dt) {
  const m = fx.gull, n = gulls.length, flap = m.geometry.attributes.aFlap.array;
  const wdx = Math.cos(G.wind.dir) * 7, wdz = Math.sin(G.wind.dir) * 7;
  const bx = G.W / 2 + 120, bz = G.H / 2 + 120;
  const wrap = (v, b) => (v > b ? v - 2 * b : v < -b ? v + 2 * b : v);
  for (let i = 0; i < n; i++) {
    const q = gulls[i];
    // Circle a centre that drifts downwind and wraps around the map.
    q.th += q.w * dt;
    q.cx = wrap(q.cx + wdx * dt, bx); q.cz = wrap(q.cz + wdz * dt, bz);
    const x = q.cx + Math.cos(q.th) * q.r, z = q.cz + Math.sin(q.th) * q.r;
    const yaw = -(q.th + Math.sign(q.w) * PI / 2);
    // Glide most of the time, with short bursts of flapping.
    const beat = clamp((Math.sin(clock * 0.5 + q.ph) - 0.35) * 3, 0, 1);
    const f = Math.sin(clock * 10 + q.ph * 7) * beat + (1 - beat) * 0.12;
    const y = q.alt + Math.sin(clock * 0.8 + q.ph) * 4;
    gE.set(Math.sign(q.w) * 0.3, yaw, 0); gQ.setFromEuler(gE);
    m.setMatrixAt(n + i, gM.compose(gP.set(x, y, z), gQ, gS.setScalar(GULL_SIZE)));
    gE.set(0, yaw, 0); gQ.setFromEuler(gE);
    m.setMatrixAt(i, gM.compose(gP.set(x + y * WX.lift[0], 0.4, z + y * WX.lift[1]), gQ, gS.set(GULL_SIZE, 0.02, GULL_SIZE)));
    flap[i] = flap[n + i] = f;
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.attributes.aFlap.needsUpdate = true;
}

// ---------- Rain ----------
// Every streak is a camera-facing quad whose fall, wind slant and wrap-around are worked out in the vertex
// shader from a per-streak seed, so the whole shower is one static geometry and one draw.
function rainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uBox: { value: new THREE.Vector3(300, 260, 600) }, uFall: { value: new THREE.Vector3(0, -1, 0) },
      uSpeed: { value: 500 }, uLen: { value: 30 }, uWidth: { value: 1 }, uCol: { value: new THREE.Vector3(1, 1, 1) }, uAlpha: { value: 0.4 },
    },
    vertexShader: `
      attribute vec4 aSeed; attribute vec2 aCorner;
      uniform float uT, uSpeed, uLen, uWidth, uAlpha; uniform vec3 uBox, uFall;
      varying float vA;
      void main(){
        float life = uBox.y / -uFall.y;
        float t = fract(aSeed.z + uT * uSpeed * aSeed.w / life);
        vec3 head = vec3(aSeed.x * uBox.x, uBox.y, aSeed.y * uBox.z) + uFall * (t * life);
        head.xz = mod(head.xz + uBox.xz, 2.0 * uBox.xz) - uBox.xz;
        vec3 side = normalize(cross(uFall, cameraPosition - head));
        vec3 p = head - uFall * (uLen * aSeed.w * aCorner.y) + side * (aCorner.x * uWidth * (1.0 - aCorner.y * 0.6));
        vA = uAlpha * (1.0 - aCorner.y) * smoothstep(0.0, 0.12, t);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function rainGeometry(n) {
  const seed = new Float32Array(n * 16), corner = new Float32Array(n * 8), idx = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    const s = [rand(-1, 1), rand(-1, 1), Math.random(), rand(0.75, 1.25)];
    for (let k = 0; k < 4; k++) {
      seed.set(s, (i * 4 + k) * 4);
      corner[(i * 4 + k) * 2] = k & 1 ? 1 : -1; corner[(i * 4 + k) * 2 + 1] = k >> 1;
    }
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  // three needs a position attribute to draw; the shader places every vertex itself.
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function setupRain(G, rain) {
  const m = fx.rain;
  m.visible = !!rain;
  if (!rain) return;
  // Reduced motion: a lighter, slower, straighter shower.
  const calm = reduceMotion;
  const n = Math.round(rain.count * (calm ? 0.45 : 1));
  if (m.userData.n !== n) { m.geometry.dispose(); m.geometry = rainGeometry(n); m.userData.n = n; }
  const u = m.material.uniforms;
  // The box reaches past the map so streaks high above it still cover the screen edges.
  u.uBox.value.set(G.W / 2 + 200, 260, G.H / 2 + 200);
  u.uSpeed.value = rain.speed * (calm ? 0.5 : 1);
  u.uLen.value = rain.length * (calm ? 0.7 : 1);
  u.uWidth.value = rain.width;
  u.uCol.value.set(...hexRGB(rain.color));
  u.uAlpha.value = rain.alpha * (calm ? 0.8 : 1);
  m.userData.slant = rain.slant * (calm ? 0.5 : 1);
}

// ---------- Fog ----------
// A sheet of drifting fog over the whole map, one draw (a single layer: it covers the screen, so fill rate is
// what it costs). The fragment shader thins the fog to faint
// wisps inside the lookouts' sight (a clear bubble around each of your ships) and thickens it into banks
// beyond, so whatever lies out there is lost in it.
const FOG_EYES = 8;
function veilGeometry() {
  const pos = [], layer = [], idx = [];
  [22].forEach((y, l) => {
    const b = l * 4;
    pos.push(-0.5, y, -0.5, 0.5, y, -0.5, -0.5, y, 0.5, 0.5, y, 0.5);
    layer.push(l, l, l, l);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 1));
  g.setIndex(idx);
  return g;
}

function veilMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uNoise: { value: null },
      uCol: { value: new THREE.Vector3(1, 1, 1) }, uAlpha: { value: 0.85 }, uWisp: { value: 0.14 }, uR: { value: 0 },
      uEye: { value: Array.from({ length: FOG_EYES }, () => new THREE.Vector3()) },
    },
    vertexShader: `
      attribute float aLayer;
      varying vec3 vP;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vP = vec3(wp.xz, aLayer);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D uNoise; uniform float uT, uAlpha, uWisp, uR; uniform vec2 uWind; uniform vec3 uCol;
      uniform vec3 uEye[${FOG_EYES}];
      varying vec3 vP;
      void main(){
        vec2 p = vP.xy; float L = vP.z;
        vec2 drift = uWind * uT * (5.0 + L * 4.0);
        float n = texture2D(uNoise, (p - drift) * (0.0012 + L * 0.0006) + L * 0.37).r * 0.65
                + texture2D(uNoise, (p - drift * 1.7) * 0.0036 + 0.5 + L * 0.21).r * 0.35;
        float bank = smoothstep(0.36, 0.7, n);
        float d = 1e5;
        // z: an eye's sight over the battle's (1 for a ship; a lighthouse sees further).
        for (int i = 0; i < ${FOG_EYES}; i++) if (uEye[i].z > 0.01) d = min(d, distance(p, uEye[i].xy) / uEye[i].z);
        float far = uR > 0.0 ? smoothstep(uR * 0.6, uR * 1.08, d + (n - 0.5) * uR * 0.4) : 1.0;
        float a = mix(uWisp * bank, uAlpha * (0.5 + 0.5 * bank), far) * (L > 0.5 ? 0.55 : 1.0);
        gl_FragColor = vec4(uCol * (0.94 + 0.08 * bank - L * 0.03), a);
      }`,
    transparent: true, depthWrite: false,
  });
}

function setupFog(G, w) {
  const m = fx.veil, b = battleDef(G.battle);
  const cfg = w.fog || (G.fog > 0 ? PRESETS_FOG : null);
  m.visible = !!cfg;
  if (!cfg) return;
  const u = m.material.uniforms;
  u.uNoise.value = R.water.material.uniforms.uNoise.value;
  u.uCol.value.set(...hexRGB(cfg.color));
  u.uAlpha.value = cfg.alpha * (reduceMotion ? 0.9 : 1);
  u.uWisp.value = cfg.wisp;
  m.userData.radius = (b && b.fog) || cfg.radius || 0;
  m.scale.set(G.W + 900, 1, G.H + 900);
}
const PRESETS_FOG = { color: '#e7ecec', alpha: 0.85, wisp: 0.16, radius: 230 };

function moveFog(G, clock) {
  const u = fx.veil.material.uniforms;
  u.uT.value = reduceMotion ? clock * 0.4 : clock;
  u.uWind.value.set(Math.cos(G.wind.dir), Math.sin(G.wind.dir));
  u.uR.value = G.fog > 0 ? G.fog : fx.veil.userData.radius;
  let k = 0;
  for (const s of G.ships) {
    if (k >= FOG_EYES) break;
    if (s.team !== 'player' || s.state === 'sunk' || s.state === 'escaped') continue;
    u.uEye.value[k++].set(s.x - G.W / 2, s.y - G.H / 2, 1);
  }
  // Lighthouses with sight (src/sim/land.js) clear the fog round them too.
  const R0 = u.uR.value || 1;
  for (const o of G.landmarks || []) {
    if (k >= FOG_EYES) break;
    if (o.kind === 'lighthouse' && o.sight > 0) u.uEye.value[k++].set(o.x - G.W / 2, o.y - G.H / 2, o.sight / R0);
  }
  for (; k < FOG_EYES; k++) u.uEye.value[k].z = 0;
}
