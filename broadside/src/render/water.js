import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

// Stylised toon sea: broad swells quantised into soft bands, a calm centre-weighted gradient, sparse
// blinking crescent glints and foam ripples off the shores. Hull foam is a separate instanced collar mesh.
export function makeWater() {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uHalf: { value: new THREE.Vector2(300, 600) },
        // Islands (x, z, r, cull radius squared) for the shore ripples.
        uIsl: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
        uCount: { value: new THREE.Vector2(0, 0) },
        uNoise: { value: noiseTexture(128) },
      },
      vertexShader: 'varying vec2 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `
        precision highp float;
        uniform float uT; uniform vec2 uWind; uniform vec2 uHalf;
        uniform vec4 uIsl[6]; uniform vec2 uCount;
        uniform sampler2D uNoise;
        varying vec2 vP;
        float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        void main(){
          vec2 flow = uWind * uT * 5.0;
          vec2 p = vP - flow;
          // Two drifting samples of a baked tileable noise (8 lattice cells per tile) instead of arithmetic noise.
          float n = texture2D(uNoise, p * 0.00056 + vec2(uT * 0.0025, -uT * 0.0019)).r * 0.6 + texture2D(uNoise, p * 0.0014 + vec2(-uT * 0.005, uT * 0.0037) + 0.37).r * 0.4;
          // Calm base gradient, one gentle lighter tier and thin soft crest lines along its edge.
          vec3 col = mix(vec3(0.11, 0.47, 0.75), vec3(0.17, 0.57, 0.84), smoothstep(0.25, 0.75, n));
          col = mix(col, vec3(0.24, 0.65, 0.89), smoothstep(0.60, 0.64, n) * 0.45);
          col = mix(col, vec3(0.55, 0.84, 0.97), (1.0 - smoothstep(0.0, 0.01, abs(n - 0.6))) * 0.2);
          vec2 q = vP / uHalf;
          col *= 1.0 + 0.07 * (1.0 - clamp(dot(q, q) * 0.5, 0.0, 1.0));
          // Sparse glints: at most one small crescent per 64-unit cell, half the cells, blinking slowly.
          vec2 g = (vP - flow * 1.4) / 64.0;
          vec2 cell = floor(g);
          float h = hash(cell);
          vec2 d = fract(g) - 0.5 - (vec2(hash(cell + 17.0), hash(cell + 31.0)) - 0.5) * 0.5;
          d.y += d.x * d.x * 4.0;
          d.x *= 0.36;
          float foam = (1.0 - smoothstep(0.03, 0.05, length(d))) * smoothstep(0.55, 1.0, sin(uT * 1.1 + h * 50.0)) * step(0.5, h);
          for (int i = 0; i < 6; i++) {
            if (float(i) >= uCount.x) break;
            vec4 I = uIsl[i];
            vec2 v = vP - I.xy;
            if (dot(v, v) > I.w) continue;
            float k = length(v) / I.z - 1.0;
            k += (sin(v.x * 0.11 + uT * 0.7) * sin(v.y * 0.13 - uT * 0.5)) * 0.07;
            float ring = smoothstep(0.78, 0.95, sin(k * 24.0 - uT * 2.2)) * (1.0 - smoothstep(0.15, 0.75, k)) * step(0.12, k);
            foam = max(foam, ring * 0.75);
          }
          col = mix(col, vec3(0.93, 0.98, 1.0), clamp(foam, 0.0, 1.0) * 0.85);
          vec2 dd = abs(vP) - uHalf;
          col *= 1.0 - 0.22 * smoothstep(0.0, 80.0, max(dd.x, dd.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
}

// Tileable smooth noise baked once: three octaves of wrapped value noise (8, 16 and 32 lattice cells per tile).
function noiseTexture(n) {
  const oct = [[8, 0.6], [16, 0.28], [32, 0.12]];
  const lat = oct.map(([g]) => Float32Array.from({ length: g * g }, () => Math.random()));
  const data = new Uint8Array(n * n * 4);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0;
      oct.forEach(([g, w], o) => {
        const fx = (x / n) * g, fy = (y / n) * g, ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = sm(fx - ix), ty = sm(fy - iy), L = lat[o];
        const at = (a, b) => L[(b % g) * g + (a % g)];
        v += w * lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
      });
      const k = (y * n + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(clamp(v, 0, 1) * 255); data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Each texel covers several screen pixels at this zoom, so plain bilinear (no mipmaps) is enough.
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
