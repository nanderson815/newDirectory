import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

// Stylised toon sea: calm water with only very broad, soft variation (nothing with edges that could read as
// land under the surface), faint wind ripples, sparse blinking crescent glints (more toward the sun) and a
// gentle swell rolling in to the islands. Hull foam is a separate instanced collar mesh.
// Weather (render/weather.js) sets the palette, cloud shadows, whitecaps and how fast the sea runs.
const v3 = (r, g, b) => new THREE.Vector3(r, g, b);
export function makeWater() {
  return new THREE.Mesh(
    // Tiled rather than two huge triangles: clipping a giant triangle at the screen edge loses depth precision,
    // and the flat things floating just above the sea (shallows, shadows, the beach line) would flicker under it.
    new THREE.PlaneGeometry(8000, 8000, 24, 24).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uHalf: { value: new THREE.Vector2(300, 600) },
        // Islands (x, z, r, cull radius squared) for the shore ripples.
        uIsl: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
        uCount: { value: new THREE.Vector2(0, 0) },
        uNoise: { value: noiseTexture(128) },
        // Palette (sRGB, written straight to the screen): deep, mid, light tier, crest lines, shore foam, glints.
        uDeep: { value: v3(0.11, 0.47, 0.75) }, uMid: { value: v3(0.17, 0.57, 0.84) }, uLight: { value: v3(0.24, 0.65, 0.89) },
        uCrest: { value: v3(0.55, 0.84, 0.97) }, uFoam: { value: v3(0.93, 0.98, 1.0) }, uGlint: { value: v3(0.93, 0.98, 1.0) },
        // Cloud shadows: strength, noise scale, drift speed. Whitecaps 0..1 and the sea's flow speed.
        uCloud: { value: v3(0, 0.0005, 14) }, uCaps: { value: 0 }, uFlow: { value: 1 },
        // Sparkle 0..1: more, bigger and brighter glints (the Med's clear water).
        uSpark: { value: 0 },
        // A warm glow on the sun's side of the map (rgb + strength) and the sun's direction across the map.
        uGlow: { value: new THREE.Vector4(1, 1, 1, 0) }, uSunXZ: { value: new THREE.Vector2(-1, 0) },
        // Screen grade, applied here because the sea fills the screen (no extra full-screen pass): tint, haze
        // toward the far (top) edge from uHazeY.x up, vignette and lightning flash, each rgb + strength.
        uRes: { value: new THREE.Vector2(1, 1) }, uHazeY: { value: new THREE.Vector2(0.5, 1) },
        uTint: { value: new THREE.Vector4() }, uHaze: { value: new THREE.Vector4() }, uVig: { value: new THREE.Vector4() },
        uFlash: { value: new THREE.Vector4(0.88, 0.95, 1, 0) },
      },
      extensions: { derivatives: true },
      vertexShader: 'varying vec2 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: `
        precision highp float;
        uniform float uT; uniform vec2 uWind; uniform vec2 uHalf;
        uniform vec4 uIsl[6]; uniform vec2 uCount;
        uniform sampler2D uNoise;
        uniform vec3 uDeep, uMid, uLight, uCrest, uFoam, uGlint, uCloud;
        uniform float uCaps, uFlow, uSpark;
        uniform vec4 uGlow; uniform vec2 uSunXZ;
        uniform vec2 uRes, uHazeY; uniform vec4 uTint, uHaze, uVig, uFlash;
        varying vec2 vP;
        float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        void main(){
          float T = uT * uFlow;
          vec2 flow = uWind * T * 5.0;
          vec2 p = vP - flow;
          vec2 q = vP / uHalf;
          // Calm water: a very broad, soft swell of colour (cells several islands across, so it never reads as
          // land under the water) and a gentler medium undulation, both from a baked tileable noise, no edges.
          float nb = texture2D(uNoise, p * 0.00021 + vec2(T * 0.0011, -T * 0.0008)).r;
          float nm = texture2D(uNoise, p * 0.00085 + vec2(-T * 0.003, T * 0.0022) + 0.37).r;
          vec3 col = mix(uDeep, uMid, 0.3 + 0.55 * smoothstep(0.22, 0.78, nb));
          col = mix(col, uLight, smoothstep(0.45, 0.8, nm) * 0.16);
          col *= 1.0 + 0.06 * (1.0 - clamp(dot(q, q) * 0.5, 0.0, 1.0));
          // Ripples: faint broken lines across the wind, catching the light in drifting patches (the water's
          // texture close up; at a distance they melt into a gentle sheen).
          vec2 wn = vec2(-uWind.y, uWind.x);
          float rw = dot(vP, uWind) * 0.085 + (nm - 0.5) * 9.0 + dot(vP, wn) * 0.004 - uT * 1.1;
          float rip = smoothstep(0.92, 0.985, sin(rw)) * smoothstep(0.52, 0.74, texture2D(uNoise, p * 0.0042 + vec2(0.13, uT * 0.004)).r)
                    * smoothstep(0.42, 0.62, texture2D(uNoise, p * 0.013 + vec2(0.71, 0.29)).r); // broken into short dashes
          // They melt away as you zoom out (when a ripple shrinks to a couple of pixels), leaving the water calm.
          col = mix(col, uCrest, rip * 0.12 * (1.0 - smoothstep(0.022, 0.045, fwidth(rw))));
          // Cloud shadows: very large and soft, a slow change of light drifting downwind rather than shapes.
          if (uCloud.x > 0.0) {
            float c = texture2D(uNoise, (vP - uWind * uT * uCloud.z) * uCloud.y * 0.55 + vec2(0.31, 0.77)).r;
            col *= 1.0 - uCloud.x * 0.8 * smoothstep(0.42, 0.8, c);
          }
          col = mix(col, uGlow.rgb, uGlow.a * smoothstep(0.0, 1.4, dot(q, uSunXZ)));
          // Sparse glints: at most one small crescent per cell, blinking slowly. Whitecaps make them denser,
          // bigger and quicker, and add broken white patches along the swell crests.
          float csz = mix(64.0, 34.0, uCaps) * (1.0 - 0.28 * uSpark);
          vec2 g = (vP - flow * 1.4) / csz;
          vec2 cell = floor(g);
          float h = hash(cell);
          vec2 d = fract(g) - 0.5 - (vec2(hash(cell + 17.0), hash(cell + 31.0)) - 0.5) * 0.5;
          d.y += d.x * d.x * 4.0;
          d.x *= 0.36;
          float r0 = 0.03 + 0.012 * uCaps + 0.008 * uSpark;
          // More of them toward the sun, where the light lies on the water.
          float sunward = smoothstep(-0.6, 1.2, dot(q, uSunXZ));
          float glint = (1.0 - smoothstep(r0, r0 + 0.02, length(d))) * smoothstep(0.55, 1.0, sin(uT * (1.1 + uCaps * 0.9 + uSpark * 0.8) + h * 50.0)) * step(0.62 - 0.25 * uCaps - (0.2 + 0.16 * uSpark) * sunward - 0.06 * uSpark, h);
          if (uCaps > 0.0) {
            // Whitecaps: small flecks of foam drawn out along the wind, gathered loosely where the swell runs high.
            vec2 wq = vec2(dot(p, uWind) * 0.38, dot(p, wn));
            float f = texture2D(uNoise, wq * 0.028 + vec2(uT * 0.02, -uT * 0.014)).r;
            float gather = smoothstep(0.64, 0.8, nm);
            glint = max(glint, smoothstep(0.775, 0.79, f) * gather * uCaps * 0.7);
          }
          float foam = 0.0;
          for (int i = 0; i < 6; i++) {
            if (float(i) >= uCount.x) break;
            vec4 I = uIsl[i];
            vec2 v = vP - I.xy;
            if (dot(v, v) > I.w) continue;
            float k = length(v) / I.z - 1.0;
            k += (sin(v.x * 0.11 + uT * 0.7) * sin(v.y * 0.13 - uT * 0.5)) * 0.07;
            // Gentle swell rolling in to the beach: a couple of faint lines close in, fading as they go out.
            float ring = smoothstep(0.86, 0.97, sin(k * 22.0 - uT * 1.7)) * (1.0 - smoothstep(0.08, 0.36, k)) * step(0.1, k);
            foam = max(foam, ring * 0.42);
          }
          col = mix(col, uGlint, clamp(glint, 0.0, 1.0) * (0.85 + 0.15 * uSpark));
          col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
          vec2 dd = abs(vP) - uHalf;
          col *= 1.0 - 0.22 * smoothstep(0.0, 80.0, max(dd.x, dd.y));
          vec2 sv = gl_FragCoord.xy / uRes;
          col = mix(col, uTint.rgb, uTint.a);
          col = mix(col, uHaze.rgb, uHaze.a * smoothstep(uHazeY.x, uHazeY.y, sv.y));
          col = mix(col, uVig.rgb, uVig.a * smoothstep(0.4, 1.05, length(sv - 0.5) * 1.4142));
          col = mix(col, uFlash.rgb, uFlash.a);
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
