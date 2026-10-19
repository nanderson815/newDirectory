// Design tokens: the one place the game's colours, type, spacing, radii, shadows and motion are defined.
// The DOM menus read them as CSS custom properties (set on :root when this module first loads); the canvas
// HUD reads the same values from the exported objects (see src/hud/style.js). docs/DESIGN.md, "Style",
// explains the choices.

// ---------- Colour ----------
// Raw palette. Sea teals for chrome, parchment and ink for documents, brass gold and terracotta accents.
export const PALETTE = {
  teal950: '#06191e', teal900: '#0b252c', teal800: '#10323a', teal700: '#17434d', teal600: '#205863',
  teal500: '#2d727c', teal400: '#4f939a', teal300: '#86b9ba', teal200: '#bcd9d6',
  cream: '#fbf4e3', cream2: '#f2e6cb',
  paper: '#f3e6c8', paper2: '#eadab2', paper3: '#dcc490', paperEdge: '#b8945c',
  ink: '#2a1d13', ink2: '#5a4431', ink3: '#86694c',
  wood: '#7b4c2b', woodDark: '#4d301c',
  gold: '#e4ab45', goldHi: '#f6d27a', goldDeep: '#a5711f',
  terracotta: '#c05a3c', terracottaDeep: '#963f27', terracottaHi: '#e08a68',
  red: '#c93d31', redHi: '#ef6a58', blue: '#2f609f', blueHi: '#79a6dc',
  green: '#6aa66a', greenHi: '#9fd38f',
  crimson: '#3b1618', crimson2: '#561f22',
};
const P = PALETTE;

// What things are, rather than what colour they are. Use these in new code.
export const COLOR = {
  // "Glass": the clean dark-teal surface for chrome (menus, pause, HUD).
  glass: 'rgba(11, 37, 44, 0.86)', glassStrong: 'rgba(8, 29, 35, 0.94)', glassSoft: 'rgba(16, 50, 58, 0.66)',
  glassLine: 'rgba(188, 217, 214, 0.16)', glassLineStrong: 'rgba(188, 217, 214, 0.3)',
  onGlass: P.cream, onGlass2: 'rgba(251, 244, 227, 0.72)', onGlass3: 'rgba(251, 244, 227, 0.5)',
  // "Paper": parchment for documents (chart, briefing, captain's log, results).
  paper: P.paper, paper2: P.paper2, paper3: P.paper3, paperLine: 'rgba(42, 29, 19, 0.16)', paperRule: 'rgba(42, 29, 19, 0.28)',
  onPaper: P.ink, onPaper2: P.ink2, onPaper3: P.ink3,
  // Accents.
  accent: P.gold, accentHi: P.goldHi, accentDeep: P.goldDeep, onAccent: P.ink,
  warm: P.terracotta, warmDeep: P.terracottaDeep, warmHi: P.terracottaHi,
  // Sides.
  enemy: P.red, enemyHi: P.redHi, player: P.blue, playerHi: P.blueHi,
  // States.
  ok: P.green, okHi: P.greenHi, warn: P.gold, danger: P.red,
  hpHigh: '#7cc46e', hpMid: P.gold, hpLow: '#e5533f',
  scrim: 'rgba(6, 25, 30, 0.55)', scrimStrong: 'rgba(6, 25, 30, 0.78)',
  shadow: 'rgba(4, 14, 17, 0.55)', focus: P.goldHi,
};

// ---------- Type ----------
// Fraunces (soft, high-contrast display serif) for titles and numbers that matter; Source Sans 3 (humanist sans)
// for everything you read. Fallbacks are chosen to keep the same character offline.
export const FONT = {
  display: '"Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, "Bitstream Charter", Georgia, "Noto Serif", serif',
  ui: '"Source Sans 3", "Source Sans Pro", Seravek, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Inter, system-ui, sans-serif',
};
// The Google Fonts request (index.html links the same URL).
export const FONT_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,500..800,60;1,9..144,400..600,60&family=Source+Sans+3:wght@400..700&display=swap';

// Type scale in CSS px: [size, line-height, weight]. Display sizes use Fraunces, the rest Source Sans 3.
export const TYPE = {
  hero: [56, 1, 700], display: [40, 1.05, 650], h1: [30, 1.1, 650], h2: [23, 1.15, 600], h3: [18, 1.2, 600],
  bodyLg: [17, 1.45, 400], body: [15, 1.45, 400], small: [13, 1.4, 400], caption: [11, 1.3, 700],
  button: [16, 1, 600], buttonSm: [14, 1, 600], number: [20, 1, 600],
};
// Caption (eyebrow) tracking, as a fraction of the font size.
export const TRACKING = { caption: 0.14, label: 0.06, display: -0.01 };

// ---------- Space, radii, lines ----------
export const SPACE = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56 };
export const RADIUS = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const LINE = { hair: 1, thin: 1.5, base: 2 };

// ---------- Elevation ----------
// CSS box-shadows, and the canvas equivalents ({ color, blur, y } in CSS px).
export const SHADOW = {
  1: '0 1px 2px rgba(4, 14, 17, 0.28), 0 1px 1px rgba(4, 14, 17, 0.16)',
  2: '0 8px 18px -6px rgba(4, 14, 17, 0.45), 0 2px 5px rgba(4, 14, 17, 0.22)',
  3: '0 28px 56px -16px rgba(4, 14, 17, 0.62), 0 10px 22px -10px rgba(4, 14, 17, 0.42)',
  text: '0 1px 2px rgba(4, 14, 17, 0.55), 0 2px 12px rgba(4, 14, 17, 0.35)',
};
export const CANVAS_SHADOW = {
  1: { color: 'rgba(4, 14, 17, 0.32)', blur: 3, y: 1 },
  2: { color: 'rgba(4, 14, 17, 0.42)', blur: 12, y: 4 },
  3: { color: 'rgba(4, 14, 17, 0.55)', blur: 28, y: 10 },
  text: { color: 'rgba(4, 14, 17, 0.6)', blur: 7, y: 1.5 },
  textTight: { color: 'rgba(4, 14, 17, 0.75)', blur: 2, y: 1 },
};

// ---------- Motion ----------
// Cubic-bezier control points, so CSS and canvas tweens share one curve.
export const CURVE = {
  out: [0.22, 1, 0.36, 1], // things arriving: fast start, long settle
  inOut: [0.65, 0, 0.35, 1], // things moving across the screen
  in: [0.55, 0, 1, 0.45], // things leaving
  spring: [0.34, 1.56, 0.64, 1], // a small overshoot: pops, stars, badges
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
  v['--font-display'] = FONT.display;
  v['--font-ui'] = FONT.ui;
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

// Sets the tokens on :root once, as early as possible (this module loads before any screen is built).
export function applyTokens(root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  for (const [k, val] of Object.entries(cssVars())) root.style.setProperty(k, val);
  root.dataset.tokens = '';
  // The canvas only draws with a webfont once something has asked for it; ask for the HUD's faces up front.
  if (document.fonts && document.fonts.load) {
    for (const f of ['600 16px Fraunces', '700 16px Fraunces', '400 15px "Source Sans 3"', '600 15px "Source Sans 3"', '700 15px "Source Sans 3"']) {
      document.fonts.load(f).catch(() => {});
    }
  }
}
applyTokens();
