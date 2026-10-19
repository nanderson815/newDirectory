// Design tokens: the one place the game's colours, type, spacing, radii, shadows and motion are defined.
// The DOM menus read them as CSS custom properties (set on :root when this module first loads); the canvas
// HUD reads the same values from the exported objects (see src/hud/style.js). docs/DESIGN.md, "Style",
// explains the choices.
//
// The idea: everything you read is printed matter from Port Royal, 1655. Ink on rag paper, the Fell types,
// one red. Pressable things are blocks of solid ink; on the sea they invert to paper.

// ---------- Colour ----------
export const PALETTE = {
  // Rag paper: the sheet, a shade for the chart, a darker fold.
  paper: '#efe5cf', paper2: '#e6d9bb', paper3: '#d6c39b', paperEdge: '#b49a6c',
  // Ink: warm lamp-black, never pure black.
  ink: '#211a14', ink2: '#5b4e42', ink3: '#86786a', inkDeep: '#140f0b',
  // The one red: printer's vermilion. `red` on paper; `redHi` where it sits on ink or the sea.
  red: '#a3271c', redHi: '#e0573c', redDeep: '#7a1c13',
  // The sea at night, for screens with no live battle behind them (the chart).
  night: '#121a1d', night2: '#1b2529',
  // Sides in battle: English blue, enemy red (the HUD's red is the same vermilion).
  blue: '#2f5d9a', blueHi: '#7ea6d8',
  // Literal gold: coins, nothing else.
  gold: '#d9a441', goldHi: '#f0cf7e', goldDeep: '#8f6418',
  // Hull: sound, wounded, sinking.
  green: '#6f9a55', greenHi: '#a3c98a',
  // Kept for code that still names them; they now resolve into the printed palette.
  cream: '#efe5cf', cream2: '#e6d9bb',
  teal950: '#0d1416', teal900: '#121a1d', teal800: '#1b2529', teal700: '#26333a', teal600: '#33444c',
  teal500: '#4a5f68', teal400: '#6f848c', teal300: '#9aaab0', teal200: '#c5cfd2',
  wood: '#7b4c2b', woodDark: '#4d301c',
  terracotta: '#a3271c', terracottaDeep: '#7a1c13', terracottaHi: '#e0573c',
  redHiOld: '#ef6a58', crimson: '#2a1210', crimson2: '#4a1b16',
};
const P = PALETTE;

// What things are, rather than what colour they are. Use these in new code.
export const COLOR = {
  // Ink surfaces: solid ink blocks (buttons on paper) and the translucent ink slips the HUD sits on.
  // (The `glass*` names are kept so existing callers keep working: "glass" now means an ink slip.)
  glass: 'rgba(33, 26, 20, 0.88)', glassStrong: 'rgba(24, 19, 15, 0.94)', glassSoft: 'rgba(33, 26, 20, 0.7)',
  glassLine: 'rgba(239, 229, 207, 0.16)', glassLineStrong: 'rgba(239, 229, 207, 0.32)',
  onGlass: P.paper, onGlass2: 'rgba(239, 229, 207, 0.74)', onGlass3: 'rgba(239, 229, 207, 0.5)',
  // Paper: every sheet you read (briefing, results, shipyard, hats, pause, settings, the chart).
  paper: P.paper, paper2: P.paper2, paper3: P.paper3,
  paperLine: 'rgba(33, 26, 20, 0.16)', paperRule: 'rgba(33, 26, 20, 0.4)',
  onPaper: P.ink, onPaper2: P.ink2, onPaper3: P.ink3,
  // The accent is the red, spent once a screen. On ink or the sea use accentHi.
  accent: P.red, accentHi: P.redHi, accentDeep: P.redDeep, onAccent: P.paper,
  warm: P.red, warmDeep: P.redDeep, warmHi: P.redHi,
  // Sides.
  enemy: P.redHi, enemyHi: '#f08a70', player: P.blue, playerHi: P.blueHi,
  // States.
  ok: P.green, okHi: P.greenHi, warn: P.gold, danger: P.red,
  hpHigh: '#86b06a', hpMid: '#d9a441', hpLow: '#e0573c',
  scrim: 'rgba(14, 12, 10, 0.5)', scrimStrong: 'rgba(14, 12, 10, 0.74)',
  shadow: 'rgba(10, 8, 6, 0.5)', focus: P.redHi,
  coin: P.gold,
};

// ---------- Type ----------
// IM Fell English: the Fell types, cut in the 1670s and printed at Oxford: titles, names, big numbers.
// IM Fell English SC: its small capitals, for button labels and run-in heads.
// EB Garamond: everything you read, with real small caps and oldstyle figures.
// Fallbacks keep an old-style book face offline (Hoefler Text, Iowan, Palatino, Georgia).
export const FONT = {
  display: '"IM Fell English", "Hoefler Text", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  caps: '"IM Fell English SC", "IM Fell English", "Hoefler Text", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  ui: '"EB Garamond", Garamond, "Hoefler Text", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
};
// The Google Fonts request (index.html links the same URL). Lilita One is the old HUD face, kept only until
// the HUD moves onto src/hud/style.js; drop it then.
export const FONT_URL = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..600&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=Lilita+One&display=swap';

// Type scale in CSS px: [size, line-height, weight]. hero..h2 are Fell; the rest EB Garamond.
// Garamond is small on the body, so text runs a size larger than a sans would.
export const TYPE = {
  hero: [76, 0.9, 400], display: [44, 1, 400], h1: [36, 1.05, 400], h2: [26, 1.1, 400], h3: [20, 1.2, 500],
  bodyLg: [19, 1.42, 400], body: [17, 1.42, 400], small: [15, 1.35, 400], caption: [14, 1.3, 500],
  button: [20, 1, 400], buttonSm: [17, 1, 400], number: [22, 1, 400],
};
// Letterspacing, as a fraction of the font size: small caps get a little air; nothing is tracked wide.
export const TRACKING = { caption: 0.06, label: 0.04, display: -0.01 };

// ---------- Space, radii, lines ----------
export const SPACE = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56 };
// Paper is cut square. Radii only soften a corner enough to stop it looking like a rendering error.
export const RADIUS = { xs: 1, sm: 2, md: 3, lg: 3, xl: 4, pill: 999 };
export const LINE = { hair: 1, thin: 1.5, base: 2 };

// ---------- Elevation ----------
// Only paper lying on the sea casts a shadow; nothing on a sheet does.
export const SHADOW = {
  1: '0 1px 2px rgba(10, 8, 6, 0.3)',
  2: '0 6px 14px -6px rgba(10, 8, 6, 0.55), 0 1px 2px rgba(10, 8, 6, 0.25)',
  3: '0 24px 48px -18px rgba(10, 8, 6, 0.7), 0 4px 10px -4px rgba(10, 8, 6, 0.35)',
  text: '0 1px 2px rgba(10, 8, 6, 0.55), 0 2px 12px rgba(10, 8, 6, 0.4)',
};
export const CANVAS_SHADOW = {
  1: { color: 'rgba(10, 8, 6, 0.32)', blur: 2, y: 1 },
  2: { color: 'rgba(10, 8, 6, 0.4)', blur: 8, y: 3 },
  3: { color: 'rgba(10, 8, 6, 0.5)', blur: 22, y: 8 },
  text: { color: 'rgba(10, 8, 6, 0.62)', blur: 7, y: 1.5 },
  textTight: { color: 'rgba(10, 8, 6, 0.78)', blur: 2, y: 1 },
};

// ---------- Motion ----------
// Cubic-bezier control points, so CSS and canvas tweens share one curve.
export const CURVE = {
  out: [0.22, 1, 0.36, 1], // things arriving: fast start, long settle
  inOut: [0.65, 0, 0.35, 1], // things moving across the screen
  in: [0.55, 0, 1, 0.45], // things leaving
  spring: [0.34, 1.56, 0.64, 1], // a small overshoot: stars, a hat landing
};
export const DURATION = { press: 90, fast: 160, base: 240, slow: 420, stagger: 45, count: 900 };

// Evaluates a cubic-bezier easing at t in [0, 1] (Newton's method on x, like the browser does).
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (sx(t) - x) / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
export const EASE = Object.fromEntries(Object.entries(CURVE).map(([k, v]) => [k, bezier(v)]));

// ---------- CSS custom properties ----------
// teal900 -> teal-900, onGlass2 -> on-glass-2, but h1 stays h1.
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/([a-z]{2,})(\d+)/g, '$1-$2');
export function cssVars() {
  const v = {};
  for (const [k, c] of Object.entries(PALETTE)) v['--p-' + kebab(k)] = c;
  for (const [k, c] of Object.entries(COLOR)) v['--c-' + kebab(k)] = c;
  for (const [k, f] of Object.entries(FONT)) v['--font-' + k] = f;
  for (const [k, [size, lh, w]] of Object.entries(TYPE)) {
    v['--fs-' + kebab(k)] = size + 'px'; v['--lh-' + kebab(k)] = String(lh); v['--fw-' + kebab(k)] = String(w);
  }
  for (const [k, t] of Object.entries(TRACKING)) v['--track-' + k] = t + 'em';
  for (const [k, s] of Object.entries(SPACE)) v['--s-' + k] = s + 'px';
  for (const [k, r] of Object.entries(RADIUS)) v['--r-' + k] = r + 'px';
  for (const [k, s] of Object.entries(SHADOW)) v['--shadow-' + k] = s;
  for (const [k, c] of Object.entries(CURVE)) v['--ease-' + kebab(k)] = `cubic-bezier(${c.join(', ')})`;
  for (const [k, d] of Object.entries(DURATION)) v['--dur-' + k] = d + 'ms';
  return v;
}

// True once the real IM Fell English SC has loaded. Offline its fallback has no small capitals of its own,
// so the CSS asks the browser for them instead (html.no-fell-sc).
export const hasFellSC = () => typeof document !== 'undefined' && !!document.fonts &&
  [...document.fonts].some((f) => /Fell English SC/.test(f.family) && f.status === 'loaded');

// Sets the tokens on :root once, as early as possible (this module loads before any screen is built).
export function applyTokens(root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  for (const [k, val] of Object.entries(cssVars())) root.style.setProperty(k, val);
  root.dataset.tokens = '';
  root.classList.add('no-fell-sc');
  // The canvas only draws with a webfont once something has asked for it; ask for the HUD's faces up front.
  if (document.fonts && document.fonts.load) {
    const faces = ['400 16px "IM Fell English"', 'italic 400 16px "IM Fell English"', '400 16px "IM Fell English SC"',
      '400 15px "EB Garamond"', '500 15px "EB Garamond"', '600 15px "EB Garamond"', 'italic 400 15px "EB Garamond"'];
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {}))).then(() => {
      if (hasFellSC()) root.classList.remove('no-fell-sc');
    });
  }
}
applyTokens();
