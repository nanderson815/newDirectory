// Captains' hats: the collection you build by finishing the tutorial and beating each boss.
export const HATS = {
  cabin:    { name: "Cabin boy's cap",       from: 'Finish the Shakedown Cruise' },
  rojo:     { name: 'Red tricorne',          from: 'Capitán Rojo of La Bruja' },
  comodoro: { name: "Commodore's bicorne",   from: 'El Comodoro of San Cristóbal' },
  oro:      { name: "Admiral's plumed hat",  from: 'Almirante de Oro of the Santísima Trinidad' },
  kate:     { name: "Calico Kate's skull hat", from: 'Calico Kate of the Black Wyvern' },
  morion:   { name: 'Iron morion',           from: 'Marqués de Hierro of the San Jerónimo' },
  armada:   { name: "Captain-General's crown hat", from: 'The Capitán General of the Real Felipe' },
};
export const HAT_ORDER = ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada'];

const INK = '#3a2414';
const ART = {
  cabin:
    '<path d="M22 60 Q22 22 60 20 Q98 22 98 60 Z" fill="#2f5aa8"/>' +
    '<rect x="18" y="55" width="84" height="16" rx="7" fill="#f4efe2"/>' +
    '<path d="M27 63 H93" fill="none" stroke="#2f5aa8" stroke-width="4"/>' +
    '<circle cx="60" cy="18" r="10" fill="#d23c2c"/>',
  rojo:
    '<path d="M34 46 Q36 18 60 16 Q84 18 86 46 Z" fill="#a82c25"/>' +
    '<path d="M6 52 Q30 30 60 36 Q90 30 114 52 Q90 66 60 60 Q30 66 6 52 Z" fill="#d23c2c"/>' +
    '<path d="M8 51 Q30 31 60 37 Q90 31 112 51" fill="none" stroke="#f2b632" stroke-width="5"/>' +
    '<path d="M76 32 Q94 4 114 8 Q102 20 84 38 Z" fill="#fbf3dc"/>',
  comodoro:
    '<path d="M4 58 Q28 6 60 8 Q92 6 116 58 Q60 46 4 58 Z" fill="#26232b"/>' +
    '<path d="M6 57 Q60 45 114 57" fill="none" stroke="#f2b632" stroke-width="6"/>' +
    '<circle cx="60" cy="30" r="9" fill="#d23c2c"/>' +
    '<circle cx="60" cy="30" r="4" fill="#f2b632" stroke="none"/>',
  oro:
    '<path d="M36 22 Q26 -2 44 4 Q52 12 50 24 Z" fill="#fbf3dc"/>' +
    '<path d="M60 16 Q58 -6 74 2 Q78 12 68 24 Z" fill="#8e5fd1"/>' +
    '<path d="M80 24 Q90 2 102 10 Q98 20 86 28 Z" fill="#fbf3dc"/>' +
    '<path d="M2 62 Q26 12 60 14 Q94 12 118 62 Q60 48 2 62 Z" fill="#1d2a4d"/>' +
    '<path d="M4 61 Q60 47 116 61 M16 44 Q60 30 104 44" fill="none" stroke="#f2b632" stroke-width="5"/>' +
    '<circle cx="60" cy="34" r="8" fill="#f2b632"/>',
  // Placeholder art for the expansion hats (replaced by the chart and story pass).
  kate:
    '<path d="M2 54 Q30 30 60 32 Q90 30 118 54 Q90 64 60 60 Q30 64 2 54 Z" fill="#1d1b20"/>' +
    '<path d="M32 44 Q34 14 60 12 Q86 14 88 44 Z" fill="#26232b"/>' +
    '<circle cx="60" cy="30" r="8" fill="#fbf3dc"/><path d="M54 40 L66 46 M66 40 L54 46" stroke="#fbf3dc" stroke-width="3"/>',
  morion:
    '<path d="M6 54 Q20 40 60 42 Q100 40 114 54 Q100 60 60 58 Q20 60 6 54 Z" fill="#9aa3ad"/>' +
    '<path d="M30 46 Q32 14 60 8 Q88 14 90 46 Z" fill="#b8c0c9"/><path d="M60 8 L60 46" stroke="#7d8690" stroke-width="5"/>',
  armada:
    '<path d="M4 60 Q28 14 60 16 Q92 14 116 60 Q60 48 4 60 Z" fill="#7a1f2b"/>' +
    '<path d="M6 59 Q60 47 114 59" fill="none" stroke="#f2b632" stroke-width="6"/>' +
    '<path d="M42 22 L48 6 L56 18 L60 2 L64 18 L72 6 L78 22 Z" fill="#f2b632"/>',
};

// Inline SVG art for a hat; locked hats render as a faded silhouette.
export function hatSVG(id, locked, cls = 'hat') {
  const label = HATS[id].name + (locked ? ' (not won yet)' : '');
  return `<svg viewBox="0 -4 120 80" class="${cls}${locked ? ' locked' : ''}" role="img" aria-label="${label}">` +
    `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${ART[id]}</g></svg>`;
}
