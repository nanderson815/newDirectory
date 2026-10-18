import * as THREE from 'three';
import { COL, $ } from '../util.js';
import { makeWater } from './water.js';
import { hullShape, foamCollarGeometry } from './shapes.js';

// Renderer, shared materials and the instanced pools every frame writes into.
export const R = {
  renderer: null, scene: null, camera: null, water: null, pools: null,
  toonRamp: null, inkMat: null, vcToon: null, C3: null,
};

const matCache = new Map();
// Shared toon materials keyed by colour; pass opts for a one-off.
export function toon(color, opts) {
  if (!opts && matCache.has(color)) return matCache.get(color);
  const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: R.toonRamp }, opts || {}));
  if (!opts) { m.userData.shared = true; matCache.set(color, m); }
  return m;
}

// Inverted-hull ink outline, the classic cel-shaded look.
export function withOutline(mesh, grow) {
  const o = new THREE.Mesh(mesh.geometry, R.inkMat);
  o.scale.setScalar(1 + (grow || 0.06));
  mesh.add(o);
  return mesh;
}

export function initGL() {
  try {
    R.renderer = new THREE.WebGLRenderer({ canvas: $('sea'), antialias: true, powerPreference: 'high-performance' });
  } catch (e) { R.renderer = null; return false; }
  R.renderer.setClearColor(0x2a8cc4);
  R.scene = new THREE.Scene();
  R.camera = new THREE.PerspectiveCamera(32, 1, 5, 20000);
  R.toonRamp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
  R.toonRamp.minFilter = R.toonRamp.magFilter = THREE.NearestFilter;
  R.toonRamp.needsUpdate = true;
  R.inkMat = new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.BackSide });
  R.C3 = {
    smoke: new THREE.Color('#f4f6f8'), soot: new THREE.Color('#55565c'), drop: new THREE.Color('#ffffff'),
    flash: new THREE.Color('#ffd65a'), fire: new THREE.Color('#ff8a2a'),
    splinter: new THREE.Color('#c48a4a'), plank: new THREE.Color('#9a6233'), sand: new THREE.Color('#e3c27e'),
    stone: new THREE.Color('#a39b8d'), minePlayer: new THREE.Color('#6fc0ff'), mineEnemy: new THREE.Color('#ff4a3a'),
  };
  const scene = R.scene;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a9cc0, 1.6));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-0.55, 1, 0.45);
  scene.add(sun);

  R.water = makeWater();
  scene.add(R.water);

  // Instanced pools: one draw call each for every cannonball, mine and particle on screen.
  const mkPool = (geo, mat, n, colored) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false; m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (colored) { m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    scene.add(m);
    return m;
  };
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const ringGeo = new THREE.RingGeometry(0.72, 1, 24).rotateX(-Math.PI / 2);
  const flatShadow = () => new THREE.MeshBasicMaterial({ color: 0x0b2d4a, transparent: true, opacity: 0.3, depthWrite: false });
  const P = {
    ball: mkPool(new THREE.SphereGeometry(3.2, 10, 8), toon('#1e1a18'), 400),
    ballShadow: mkPool(new THREE.CircleGeometry(3, 10).rotateX(-Math.PI / 2), flatShadow(), 400),
    puff: mkPool(puffGeo, toon('#ffffff', {}), 1000, true),
    glow: mkPool(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 400, true),
    debris: mkPool(new THREE.BoxGeometry(1, 1, 1), toon('#ffffff', {}), 600, true),
    rings: [0.55, 0.32, 0.14].map((op) => mkPool(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false }), 400)),
    // A faceted ball reads as a spiky sea mine at this size.
    mine: mkPool(new THREE.IcosahedronGeometry(4.6, 0), toon('#2d2a30'), 64),
    mineShadow: mkPool(new THREE.CircleGeometry(5, 10).rotateX(-Math.PI / 2), flatShadow(), 64),
  };
  P.ballShadow.renderOrder = 1;
  P.mineShadow.renderOrder = 1;
  P.rings.forEach((r) => (r.renderOrder = 1));
  // Every ship's shadow in one draw: hullShape is linear in L and B, so a unit hull scales to any class.
  P.shipShadow = mkPool(new THREE.ShapeGeometry(hullShape(1, 1)).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b2d4a, transparent: true, opacity: 0.26, depthWrite: false }), 32);
  P.shipShadow.renderOrder = 1;
  P.foam = mkPool(foamCollarGeometry(), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.8, depthWrite: false }), 32);
  P.foam.renderOrder = 2;
  R.pools = P;
  R.vcToon = toon('#ffffff', { vertexColors: true });
  return true;
}
