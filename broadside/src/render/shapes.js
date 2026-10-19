import * as THREE from 'three';
import { TAU, clamp, lerp } from '../util.js';

// Flat outlines and procedural geometry shared by the models.

export function hullShape(L, B, k) {
  const l = (L / 2) * (k || 1), b = (B / 2) * (k || 1);
  const sh = new THREE.Shape();
  sh.moveTo(l, 0);
  sh.quadraticCurveTo(l * 0.6, -b * 1.08, -l * 0.1, -b);
  sh.quadraticCurveTo(-l * 0.82, -b * 0.96, -l, -b * 0.66);
  sh.lineTo(-l, b * 0.66);
  sh.quadraticCurveTo(-l * 0.82, b * 0.96, -l * 0.1, b);
  sh.quadraticCurveTo(l * 0.6, b * 1.08, l, 0);
  return sh;
}

// Extrudes a flat shape upward (three's y axis), optionally tapering toward the keel.
export function liftedExtrude(shape, depth, bevel, taper) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  if (taper) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) / depth, 0, 1);
      pos.setZ(i, pos.getZ(i) * lerp(taper, 1, t));
      pos.setX(i, pos.getX(i) * lerp(0.92, 1, t));
    }
    geo.computeVertexNormals();
  }
  return geo;
}

export function sailGeometry(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 4);
  geo.rotateY(Math.PI / 2); // spans the beam (z), faces forward (+x)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) / (w / 2), y = pos.getY(i) / (h / 2);
    pos.setX(i, w * 0.22 * (1 - z * z) * (0.75 + 0.25 * (1 - y * y)));
  }
  geo.computeVertexNormals();
  // The belly at full draw; the rig shader takes it back out as the sail spills wind (see models.js).
  const belly = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) belly[i * 3] = pos.getX(i);
  geo.setAttribute('bulge', new THREE.BufferAttribute(belly, 3));
  return geo;
}

// A fore-and-aft or lateen sail: a bilinear patch over four corners ([x, y] in the pivot's x-y plane, u along
// the foot from luff to leech, v from foot to head; pass the same point twice for a triangle). It bellies out
// along z by up to `belly`, most at mid-chord.
export function sailPatch(c00, c10, c01, c11, belly, su = 6, sv = 4) {
  const pos = [], uv = [], bul = [], idx = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv;
    for (let i = 0; i <= su; i++) {
      const u = i / su;
      const bx = lerp(c00[0], c10[0], u), by = lerp(c00[1], c10[1], u);
      const tx = lerp(c01[0], c11[0], u), ty = lerp(c01[1], c11[1], u);
      const z = belly * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(Math.PI * v));
      pos.push(lerp(bx, tx, v), lerp(by, ty, v), z);
      uv.push(u, v);
      bul.push(0, 0, z);
    }
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
    const a = j * (su + 1) + i, b = a + 1, c = a + su + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('bulge', new THREE.Float32BufferAttribute(bul, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A fluyt's deck plan: a bluff bow, the beam carried well aft, then pinched in to a narrow high stern.
export function pearShape(L, B) {
  const l = L / 2, b = B / 2;
  const sh = new THREE.Shape();
  sh.moveTo(l, 0);
  sh.bezierCurveTo(l * 0.98, -b * 0.72, l * 0.55, -b * 1.04, -l * 0.05, -b * 1.02);
  sh.bezierCurveTo(-l * 0.6, -b, -l * 0.9, -b * 0.62, -l, -b * 0.42);
  sh.lineTo(-l, b * 0.42);
  sh.bezierCurveTo(-l * 0.9, b * 0.62, -l * 0.6, b, -l * 0.05, b * 1.02);
  sh.bezierCurveTo(l * 0.55, b * 1.04, l * 0.98, b * 0.72, l, 0);
  return sh;
}

// A unit-ellipse foam band with a scalloped edge, thicker at the bow (+x), for the hull foam collars.
export function foamCollarGeometry() {
  const n = 56, pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), sn = Math.sin(a);
    const bow = Math.max(0, c);
    const r0 = 0.98 + 0.03 * Math.sin(a * 9), r1 = r0 + 0.1 + 0.22 * bow * bow + 0.04 * Math.sin(a * 13 + 1);
    pos.push(c * r0, 0, sn * r0, c * r1, 0, sn * r1);
    if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
