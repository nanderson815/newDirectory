// Weather and time of day. Each campaign region has a preset; BATTLE_WEATHER can override one battle by id.
// render/weather.js applies the preset when a battle's scene is built. Colours are sRGB hex.
//
// water   sea colours (deep, mid, light tier, crest lines, shore foam, glints); clouds = cloud-shadow strength
//         (0 = none) and scale; caps = whitecaps 0..1; flow = how fast the sea moves; glow + glowA = a warm
//         wash on the sun's side of the map.
// light   hemisphere sky/ground and intensity; sun (the key light) colour, intensity and direction.
// shadow  colour and opacity of the flat shadows; lift = how far a shadow falls (x, z) per unit of height.
// swell   multiplies ship and mine bob and roll.
// screen  screen grade drawn over the sea: tint, haze toward the far (top) edge, vignette. Omit for none.
// gulls, rain, lightning: ambient extras. Omit for none.
// boss    boss battles (goal 'boss'): vignette added, its colour, and a multiplier on both lights.

export const PRESETS = {
  // Bright Caribbean noon: the classic look, with drifting cloud shadows and a few gulls.
  sunny: {
    clear: '#2a8cc4',
    water: {
      deep: '#1c78bf', mid: '#2b91d6', light: '#3da6e3', crest: '#8cd6f7', foam: '#edfaff', glint: '#f4fcff',
      clouds: 0.12, cloudScale: 1, caps: 0, flow: 1,
    },
    light: { sky: '#ffffff', ground: '#6a9cc0', hemi: 1.6, sun: '#fff4e0', sunI: 2.4, dir: [-0.55, 1, 0.45] },
    shadow: { color: '#0b2d4a', opacity: 0.28, lift: [0.3, 0.36] },
    swell: 1,
    screen: { vignette: 0.12, vignetteColor: '#0b2d4a' },
    gulls: 7,
    boss: { vignette: 0.22, vignetteColor: '#1a0a26', light: 0.86 },
  },

  // Golden late afternoon: a low warm sun, peach water and long shadows, warm haze on the horizon.
  sunset: {
    clear: '#e08a5a',
    water: {
      deep: '#1f569e', mid: '#3172bc', light: '#5c93d6', crest: '#ffc38f', foam: '#fff0dc', glint: '#ffd36a',
      clouds: 0.07, cloudScale: 0.8, caps: 0, flow: 0.8, glow: '#ffa452', glowA: 0.5,
    },
    light: { sky: '#fff0e0', ground: '#6a5a96', hemi: 1.5, sun: '#ffcf96', sunI: 2.6, dir: [-0.6, 0.42, -0.8] },
    shadow: { color: '#3a1840', opacity: 0.32, lift: [0.42, 0.6] },
    swell: 1.1,
    screen: { tint: '#ff8a3a', tintA: 0.04, haze: '#ffb25e', hazeA: 0.34, hazeFrom: 0.5, vignette: 0.16, vignetteColor: '#4a1a3a' },
    boss: { vignette: 0.16, vignetteColor: '#2a0a2a', light: 0.88 },
  },

  // Tropical storm: teal-grey sea with whitecaps, heavy swell, slanting rain and lightning.
  storm: {
    clear: '#24525e',
    water: {
      deep: '#195563', mid: '#226b78', light: '#3a8a90', crest: '#a6dcd8', foam: '#f2fbfa', glint: '#ffffff',
      clouds: 0.2, cloudScale: 1.3, caps: 1, flow: 1.9,
    },
    light: { sky: '#cfe4ee', ground: '#3d6470', hemi: 1.5, sun: '#e2f0ff', sunI: 1.7, dir: [-0.4, 1, 0.3] },
    shadow: { color: '#06202a', opacity: 0.3, lift: [0.2, 0.26] },
    swell: 1.9,
    screen: { tint: '#2a4a66', tintA: 0.06, haze: '#a8c4d0', hazeA: 0.16, hazeFrom: 0.5, vignette: 0.42, vignetteColor: '#04141e' },
    rain: { count: 900, speed: 520, slant: 0.42, length: 34, width: 0.9, color: '#e4f4ff', alpha: 0.36 },
    lightning: { every: [7, 15], thunder: [0.5, 1.6] },
    boss: { vignette: 0.14, vignetteColor: '#04141e', light: 0.9 },
  },
};

export const REGION_WEATHER = { port: 'sunny', windward: 'sunny', main: 'sunset', golden: 'storm', pirate: 'sunny', campeche: 'sunset', armada: 'storm' };

// Per-battle overrides by battle id, e.g. { tortuga: 'storm' }. A battle def's own `weather` wins over both.
export const BATTLE_WEATHER = {};

// The resolved preset for a battle definition: a fresh object, with the boss mood applied.
export function weatherFor(battle) {
  const name = (battle && (battle.weather || BATTLE_WEATHER[battle.id] || REGION_WEATHER[battle.region])) || 'sunny';
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
