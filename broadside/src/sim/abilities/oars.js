// Sweeps along the sides keep an oared ship moving whatever the wind.
export default {
  id: 'oars',
  about: 'Rowed: keeps moving whatever the wind.',
  params: { min: 'lowest wind speed factor' },
  defaults: { min: 0.86 },
  init(s) { s.oars = true; },
  wind: (s, a, f) => Math.max(f, a.min),
};
