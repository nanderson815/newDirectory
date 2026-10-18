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
  return geo;
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

export function islandShape(is, k) {
  const n = is.verts.length;
  const sh = new THREE.Shape();
  const pt = (i) => {
    const a = (i / n) * TAU, r = is.r * k * is.verts[i % n];
    return [Math.cos(a) * r, -Math.sin(a) * r];
  };
  const p0 = pt(0);
  sh.moveTo(p0[0], p0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pt(i);
    const am = ((i - 0.5) / n) * TAU, rm = is.r * k * (is.verts[i % n] + is.verts[(i - 1) % n]) / 2 * 1.05;
    sh.quadraticCurveTo(Math.cos(am) * rm, -Math.sin(am) * rm, p[0], p[1]);
  }
  return sh;
}
