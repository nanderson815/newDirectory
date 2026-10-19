import { PALETTE, COLOR, FONT as TOKEN_FONT } from './ui/tokens.js';

// Small shared helpers.
export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
// Signed shortest turn from angle a to angle b.
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > PI) d -= TAU;
  else if (d < -PI) d += TAU;
  return d;
};
export const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (id) => document.getElementById(id);

// localStorage can be missing or throw (private windows, previews); every access is guarded.
export const store = {
  get(k, d) { try { const v = localStorage.getItem('broadside.' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('broadside.' + k, v); } catch (e) { /* storage unavailable */ } },
};

// Shorthands from the design tokens (src/ui/tokens.js). The 3D scene's flags, trim and outlines keep their own
// brighter values (toon shading darkens them); everything drawn flat uses the tokens.
export const COL = {
  ink: '#3a2414', gold: PALETTE.gold, white: PALETTE.cream, parchment: PALETTE.paper, hud: COLOR.glass,
  blue: '#2f6fd6', red: '#d23c2c',
};
export const FONT = TOKEN_FONT.ui;
