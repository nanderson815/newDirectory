// Weather and time of day. Each campaign region has a preset; BATTLE_WEATHER can override one battle by id.
// render/weather.js applies the preset when a battle's scene is built. Colours are sRGB hex.
//
// water   sea colours (deep, mid, light tier, ripple crests, shore foam, glints, shallow = the turquoise of the
//         water over sand at the shore, rim = the dark wet edge where it meets the land); clouds = cloud-shadow strength
//         (0 = none) and scale; caps = whitecaps 0..1; flow = how fast the sea moves; glow + glowA = a warm
//         wash on the sun's side of the map; sparkle (0..1, optional) = more and brighter glints, the light
//         dancing on clear water; clear (optional, default 1) = how far the shallows reach out from the shore.
// light   hemisphere sky/ground and intensity; sun (the key light) colour, intensity and direction.
// shadow  colour and opacity of the flat shadows; lift = how far a shadow falls (x, z) per unit of height.
// swell   multiplies ship and mine bob and roll.
// land    a grade on the land's colours: sat = saturation kept (0-1), tint = a multiply (a storm greys and cools
//         the land, fog washes it out, a sunset warms it). Omit for none.
// screen  screen grade drawn over the sea: tint, haze toward the far (top) edge, vignette. Omit for none.
// gulls, rain, lightning: ambient extras. Omit for none.
// fog     low-lying fog banks drawn over the map (colour, alpha far from your ships, wisp = alpha of the thin
//         wisps inside your lookouts' sight, radius = sight radius when the battle doesn't set G.fog).
// boss    boss battles (goal 'boss'): vignette added, its colour, and a multiplier on both lights.
// night   (optional) it is dark: lanterns, windows, lamps and fires glow (render/scene.js, render/land.js), every gun's
//         flash lights the sea for a moment, and a burning ship shows through the dark (render/weather.js).

export const PRESETS = {
  // Bright Caribbean noon: the classic look, with drifting cloud shadows and a few gulls.
  sunny: {
    clear: '#2a8cc4',
    water: {
      deep: '#1c78bf', mid: '#2b91d6', light: '#3da6e3', crest: '#8cd6f7', foam: '#edfaff', glint: '#f4fcff', shallow: '#6fd9d6', rim: '#2f6a73',
      clouds: 0.12, cloudScale: 1, caps: 0, flow: 1,
    },
    light: { sky: '#ffffff', ground: '#6a9cc0', hemi: 1.6, sun: '#fff4e0', sunI: 2.4, dir: [-0.55, 1, 0.45] },
    shadow: { color: '#0b2d4a', opacity: 0.28, lift: [0.3, 0.36] },
    swell: 1,
    land: { sat: 0.94 },
    screen: { vignette: 0.12, vignetteColor: '#0b2d4a' },
    gulls: 7,
    boss: { vignette: 0.22, vignetteColor: '#1a0a26', light: 0.86 },
  },

  // Golden late afternoon: a low warm sun, peach water and long shadows, warm haze on the horizon.
  sunset: {
    clear: '#e08a5a',
    water: {
      deep: '#1f569e', mid: '#3172bc', light: '#5c93d6', crest: '#ffc38f', foam: '#fff0dc', glint: '#ffd36a', shallow: '#7cc6cf', rim: '#4a4660',
      clouds: 0.07, cloudScale: 0.8, caps: 0, flow: 0.8, glow: '#ffa452', glowA: 0.5,
    },
    light: { sky: '#fff0e0', ground: '#6a5a96', hemi: 1.5, sun: '#ffcf96', sunI: 2.6, dir: [-0.6, 0.42, -0.8] },
    shadow: { color: '#3a1840', opacity: 0.32, lift: [0.42, 0.6] },
    swell: 1.1,
    land: { sat: 0.9, tint: '#fff4e6' },
    screen: { tint: '#ff8a3a', tintA: 0.04, haze: '#ffb25e', hazeA: 0.34, hazeFrom: 0.5, vignette: 0.16, vignetteColor: '#4a1a3a' },
    boss: { vignette: 0.16, vignetteColor: '#2a0a2a', light: 0.88 },
  },

  // Tropical storm: teal-grey sea with whitecaps, heavy swell, slanting rain and lightning.
  storm: {
    clear: '#24525e',
    water: {
      deep: '#195563', mid: '#226b78', light: '#3a8a90', crest: '#a6dcd8', foam: '#f2fbfa', glint: '#ffffff', shallow: '#5fb0a8', rim: '#1d4a4c',
      clouds: 0.2, cloudScale: 1.3, caps: 1, flow: 1.9,
    },
    light: { sky: '#cfe4ee', ground: '#3d6470', hemi: 1.5, sun: '#e2f0ff', sunI: 1.7, dir: [-0.4, 1, 0.3] },
    shadow: { color: '#06202a', opacity: 0.3, lift: [0.2, 0.26] },
    swell: 1.9,
    land: { sat: 0.72, tint: '#d2dede' },
    screen: { tint: '#2a4a66', tintA: 0.06, haze: '#a8c4d0', hazeA: 0.16, hazeFrom: 0.5, vignette: 0.42, vignetteColor: '#04141e' },
    rain: { count: 900, speed: 520, slant: 0.42, length: 34, width: 0.9, color: '#e4f4ff', alpha: 0.36 },
    lightning: { every: [7, 15], thunder: [0.5, 1.6] },
    boss: { vignette: 0.14, vignetteColor: '#04141e', light: 0.9 },
  },

  // Sea fog: a pale, flat light, muted grey-green water and banks of fog everywhere your lookouts can't see.
  fog: {
    clear: '#c3cdcf',
    water: {
      deep: '#4f6f7a', mid: '#5f808b', light: '#7495a0', crest: '#b4c9cd', foam: '#eef3f2', glint: '#f2f6f6', shallow: '#9cbcbc', rim: '#4d6266',
      clouds: 0, cloudScale: 1, caps: 0, flow: 0.55,
    },
    light: { sky: '#f3f5f3', ground: '#7d8f96', hemi: 2.0, sun: '#f2eee6', sunI: 1.15, dir: [-0.3, 1, 0.25] },
    shadow: { color: '#2c3c44', opacity: 0.17, lift: [0.12, 0.15] },
    swell: 0.7,
    land: { sat: 0.68, tint: '#e4eae8' },
    screen: { tint: '#dfe6e6', tintA: 0.1, haze: '#e6ecec', hazeA: 0.4, hazeFrom: 0.4, vignette: 0.16, vignetteColor: '#8fa2a8' },
    fog: { color: '#e7ecec', alpha: 0.86, wisp: 0.16, radius: 230 },
    boss: { vignette: 0.12, vignetteColor: '#34444a', light: 0.92 },
  },
};

// ---------- The Mediterranean ----------
Object.assign(PRESETS, {
  // A Mediterranean noon: clearer, deeper blue water than the Indies' with wide turquoise shallows, the sun
  // dancing on it, hardly a cloud, white houses bright on the shore.
  med: {
    clear: '#2478ba',
    water: {
      deep: '#1462ad', mid: '#1d7ac4', light: '#3299da', crest: '#a2e4fa', foam: '#f4fcff', glint: '#ffffff', shallow: '#46d4cc', rim: '#285e6c',
      clouds: 0.05, cloudScale: 1.3, caps: 0, flow: 0.9, sparkle: 1, clear: 1.35,
    },
    light: { sky: '#ffffff', ground: '#6898c6', hemi: 1.62, sun: '#fff6e8', sunI: 2.55, dir: [-0.5, 1, 0.5] },
    shadow: { color: '#0a2a4c', opacity: 0.3, lift: [0.32, 0.38] },
    swell: 0.9,
    land: { sat: 0.97, tint: '#fffaf2' },
    screen: { vignette: 0.1, vignetteColor: '#0a2a4c' },
    gulls: 6,
    boss: { vignette: 0.2, vignetteColor: '#1a0a26', light: 0.88 },
  },
  // The Barbary coast in summer: a high white sun, short shadows, a heat haze on the far water and over the land.
  barbary: {
    clear: '#5a98bf',
    water: {
      deep: '#1b66a6', mid: '#287ebd', light: '#469bd0', crest: '#c2e7f2', foam: '#fcf8ee', glint: '#fff7dc', shallow: '#62cfc4', rim: '#56685c',
      clouds: 0, cloudScale: 1, caps: 0, flow: 0.7, glow: '#ffdca6', glowA: 0.28, sparkle: 0.7, clear: 1.25,
    },
    light: { sky: '#fff6e8', ground: '#998a72', hemi: 1.66, sun: '#fff1d4', sunI: 2.5, dir: [-0.42, 1.15, 0.25] },
    shadow: { color: '#22304a', opacity: 0.25, lift: [0.18, 0.2] },
    swell: 0.85,
    land: { sat: 0.92, tint: '#fff3de' },
    screen: { tint: '#ffcf8a', tintA: 0.05, haze: '#f2e2c4', hazeA: 0.36, hazeFrom: 0.42, vignette: 0.1, vignetteColor: '#5a3a1a' },
    gulls: 4,
    boss: { vignette: 0.18, vignetteColor: '#2a1206', light: 0.9 },
  },
  // The meltemi: a hard, clear north wind down the Aegean, white horses on a deep blue sea.
  meltemi: {
    clear: '#2072b4',
    water: {
      deep: '#125aa4', mid: '#1b70ba', light: '#2f8ed0', crest: '#c2ecff', foam: '#ffffff', glint: '#ffffff', shallow: '#44cdd0', rim: '#285868',
      clouds: 0.08, cloudScale: 1.4, caps: 0.55, flow: 1.55, sparkle: 1, clear: 1.25,
    },
    light: { sky: '#ffffff', ground: '#6a98c8', hemi: 1.6, sun: '#fff8ee', sunI: 2.5, dir: [-0.5, 1, 0.4] },
    shadow: { color: '#082848', opacity: 0.3, lift: [0.3, 0.36] },
    swell: 1.35,
    land: { sat: 0.96 },
    screen: { vignette: 0.12, vignetteColor: '#082848' },
    gulls: 5,
    boss: { vignette: 0.2, vignetteColor: '#140a26', light: 0.88 },
  },
  // Candia in the last summer of the siege: a low gold sun through the smoke of the guns.
  candia: {
    clear: '#b98a66',
    water: {
      deep: '#1b5a9c', mid: '#2a72b6', light: '#4a8fca', crest: '#ffdcb6', foam: '#fff4e6', glint: '#ffe2a6', shallow: '#62bcc0', rim: '#4a4858',
      clouds: 0.04, cloudScale: 0.9, caps: 0, flow: 0.8, glow: '#ffb478', glowA: 0.34, sparkle: 0.5, clear: 1.15,
    },
    light: { sky: '#fff2e2', ground: '#7a6a8e', hemi: 1.55, sun: '#ffd8aa', sunI: 2.6, dir: [-0.62, 0.55, -0.6] },
    shadow: { color: '#2c1c3a', opacity: 0.3, lift: [0.36, 0.5] },
    swell: 1,
    land: { sat: 0.92, tint: '#fff1e2' },
    screen: { tint: '#ff9a4a', tintA: 0.03, haze: '#e6c39e', hazeA: 0.3, hazeFrom: 0.5, vignette: 0.16, vignetteColor: '#3a1a2a' },
    gulls: 3,
    boss: { vignette: 0.16, vignetteColor: '#2a0a2a', light: 0.88 },
  },
  // A Mediterranean gale (Cape Passero): steel-blue water streaked with foam, a short steep sea, rain squalls.
  gale: {
    clear: '#3a5566',
    water: {
      deep: '#22465e', mid: '#2d5970', light: '#477287', crest: '#c8dce4', foam: '#f4f8fa', glint: '#ffffff', shallow: '#6a9aa2', rim: '#283a42',
      clouds: 0.24, cloudScale: 1.5, caps: 1, flow: 2.1,
    },
    light: { sky: '#d6e2ea', ground: '#46596a', hemi: 1.5, sun: '#e8f0f8', sunI: 1.6, dir: [-0.35, 1, 0.3] },
    shadow: { color: '#0c1a24', opacity: 0.28, lift: [0.2, 0.24] },
    swell: 2.1,
    land: { sat: 0.66, tint: '#d4dce0' },
    screen: { tint: '#36506a', tintA: 0.08, haze: '#b8c8d2', hazeA: 0.2, hazeFrom: 0.45, vignette: 0.4, vignetteColor: '#0a1822' },
    rain: { count: 1100, speed: 600, slant: 0.6, length: 38, width: 0.9, color: '#eaf4ff', alpha: 0.34 },
    lightning: { every: [9, 18], thunder: [0.6, 1.8] },
    boss: { vignette: 0.14, vignetteColor: '#0a1822', light: 0.9 },
  },
  // Night: a moon over the water, the land blue-grey, the dark beyond your lookouts' sight; lanterns, windows and
  // fires glow, every broadside lights up the sea.
  night: {
    clear: '#0b1626',
    water: {
      deep: '#0b2442', mid: '#103252', light: '#1a4668', crest: '#6a90b2', foam: '#a6bed2', glint: '#d8e8ff', shallow: '#1f5260', rim: '#0a1a24',
      clouds: 0.1, cloudScale: 1, caps: 0, flow: 0.7, glow: '#86aee0', glowA: 0.22, sparkle: 0.6,
    },
    light: { sky: '#7a98c8', ground: '#0e1c30', hemi: 1.0, sun: '#a8c4ff', sunI: 1.0, dir: [0.4, 1, -0.5] },
    shadow: { color: '#000814', opacity: 0.3, lift: [0.22, 0.28] },
    swell: 0.9,
    land: { sat: 0.55, tint: '#8496c0' },
    screen: { tint: '#0a1a3a', tintA: 0.1, haze: '#1a2a48', hazeA: 0.25, hazeFrom: 0.5, vignette: 0.5, vignetteColor: '#000510' },
    fog: { color: '#0c1626', alpha: 0.72, wisp: 0.1, radius: 250 },
    night: true,
    boss: { vignette: 0.1, vignetteColor: '#000510', light: 0.95 },
  },
});

export const REGION_WEATHER = {
  port: 'sunny', windward: 'sunny', main: 'sunset', golden: 'storm', pirate: 'sunny', campeche: 'sunset', armada: 'storm',
  // The Mediterranean (src/config/battles-med.js).
  straits: 'med', barbary: 'barbary', malta: 'med', morea: 'meltemi', candia: 'candia', dardanelles: 'meltemi',
};

// Per-battle overrides by battle id, e.g. { tortuga: 'storm' }. A battle def's own `weather` wins over both.
// Tripoli lies in the Malta region but on the Barbary shore.
export const BATTLE_WEATHER = { fog: 'fog', tripoli: 'barbary' };

// The resolved preset for a battle definition: a fresh object, with the boss mood applied.
export function weatherFor(battle) {
  // A night battle (`night: true`) takes the 'night' preset.
  const night = battle && battle.night ? (PRESETS.night ? 'night' : 'fog') : null;
  const name = (battle && (battle.weather || night || BATTLE_WEATHER[battle.id] || REGION_WEATHER[battle.region])) || 'sunny';
  const p = PRESETS[name] || PRESETS.sunny;
  const w = { ...p, name, light: { ...p.light }, screen: { ...(p.screen || {}) }, isBoss: !!battle && battle.goal === 'boss' };
  if (w.isBoss && p.boss) {
    w.screen.vignette = (w.screen.vignette || 0) + p.boss.vignette;
    w.screen.vignetteColor = p.boss.vignetteColor;
    w.light.hemi *= p.boss.light;
    w.light.sunI *= p.boss.light;
  }
  return w;
}
