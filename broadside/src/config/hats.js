// Captains' hats: the collection you build by finishing the tutorial and beating each boss (and one given as a
// gift). `world` says which campaign's cabinet shelf it sits on (src/config/worlds.js; the West Indies by default).
export const HATS = {
  cabin:    { name: "Cabin boy's cap",       from: 'Finish the Shakedown Cruise' },
  rojo:     { name: 'Red tricorne',          from: 'Capitán Rojo of La Bruja' },
  comodoro: { name: "Commodore's bicorne",   from: 'El Comodoro of San Cristóbal' },
  oro:      { name: "Admiral's plumed hat",  from: 'Almirante de Oro of the Santísima Trinidad' },
  kate:     { name: "Calico Kate's skull hat", from: 'Calico Kate of the Black Wyvern' },
  morion:   { name: 'Iron morion',           from: 'Marqués de Hierro of the San Jerónimo' },
  armada:   { name: "Captain-General's crown hat", from: 'The Capitán General of the Real Felipe' },
  // short: how a sentence names it after "the" (otherwise the name in lower case); gift: given, not taken.
  rover:    { name: "Rover's white turban", short: 'white turban', from: 'Reis Ibrahim of the Burak', world: 'med' },
  kalpak:   { name: 'Admiral of Algiers’s kalpak', short: 'kalpak of the Admiral of Algiers', from: 'Kara Hasan Reis of the Mubarak', world: 'med' },
  osman:    { name: 'Green turban of Tripoli', short: 'green turban of Tripoli', from: 'Osman Reis of the Hilal', world: 'med' },
  corno:    { name: 'Provveditore’s corno', short: 'Provveditore’s corno', from: 'A gift of the Provveditore of Candia', gift: true, world: 'med' },
  kavuk:    { name: 'Kapudan Pasha’s plumed kavuk', short: 'plumed kavuk of the Kapudan Pasha', from: 'Bahri Ömer Pasha of the Kara Ejder', world: 'med' },
};
export const HAT_ORDER = ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada', 'rover', 'kalpak', 'osman', 'corno', 'kavuk'];
export const hatWorld = (id) => (HATS[id] && HATS[id].world) || 'caribbean';

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
  // Calico Kate: a black pirate tricorne with a calico band, a skull and crossbones and a red feather.
  kate:
    '<path d="M78 34 Q90 4 114 -2 Q110 14 88 40 Z" fill="#d23c2c"/>' +
    '<path d="M84 34 Q96 12 111 1" fill="none" stroke-width="2"/>' +
    '<path d="M32 46 Q33 14 60 11 Q87 14 88 46 Z" fill="#2a2630"/>' +
    '<path d="M33 37 Q60 30 87 37 L88 45 Q60 38 32 45 Z" fill="#c8402f"/>' +
    '<g stroke="none" fill="#fbf3dc"><circle cx="40" cy="39" r="1.8"/><circle cx="52" cy="35.5" r="1.8"/><circle cx="68" cy="35.5" r="1.8"/><circle cx="80" cy="39" r="1.8"/></g>' +
    '<path d="M3 50 Q20 28 42 36 Q52 24 60 25 Q68 24 78 36 Q100 28 117 50 Q92 67 60 61 Q28 67 3 50 Z" fill="#1d1b20"/>' +
    '<path d="M8 50 Q22 33 41 40 M79 40 Q98 33 112 50" fill="none" stroke="#c8402f" stroke-width="2.5"/>' +
    '<path d="M44 36 L76 58 M76 36 L44 58" stroke-width="9"/>' +
    '<path d="M44 36 L76 58 M76 36 L44 58" stroke="#fbf3dc" stroke-width="4"/>' +
    '<path d="M49 47 Q48 30 60 30 Q72 30 71 47 Q67 51 67 55 L53 55 Q53 51 49 47 Z" fill="#fbf3dc" stroke-width="2.5"/>' +
    '<g stroke="none" fill="#1d1b20"><circle cx="55.5" cy="42" r="3.1"/><circle cx="64.5" cy="42" r="3.1"/><path d="M58.4 49 L60 46 L61.6 49 Z"/></g>',
  // The Marqués de Hierro: a Spanish steel morion with a high comb, a brass band and a red-and-white plume.
  morion:
    '<path d="M34 40 Q12 34 4 8 Q20 16 28 12 Q26 26 42 34 Z" fill="#d23c2c"/>' +
    '<path d="M38 36 Q22 26 18 4 Q30 12 36 10 Q34 22 46 31 Z" fill="#fbf3dc"/>' +
    '<path d="M40 30 Q42 -3 60 -4 Q78 -3 80 30 Q60 24 40 30 Z" fill="#c9d0d8"/>' +
    '<path d="M46 27 Q47 4 60 3 Q73 4 74 27" fill="none" stroke="#7d8690" stroke-width="2"/>' +
    '<path d="M50 20 Q51 9 58 7" fill="none" stroke="#eef2f5" stroke-width="2.5"/>' +
    '<path d="M25 54 Q25 24 60 20 Q95 24 95 54 Z" fill="#b8c0c9"/>' +
    '<path d="M36 42 Q40 31 52 27" fill="none" stroke="#eef2f5" stroke-width="3.5"/>' +
    '<path d="M26 47 Q60 40 94 47" fill="none" stroke="#c98a17" stroke-width="5"/>' +
    '<path d="M3 38 Q18 56 60 56 Q102 56 117 38 Q108 64 60 66 Q12 64 3 38 Z" fill="#9aa3ad"/>' +
    '<g stroke="none" fill="#3a2414"><circle cx="30" cy="59" r="2"/><circle cx="46" cy="61" r="2"/><circle cx="60" cy="61.5" r="2"/><circle cx="74" cy="61" r="2"/><circle cx="90" cy="59" r="2"/></g>',
  // The Capitán General: a grand crimson cavalier hat with gold braid, a jewelled crown and three plumes.
  armada:
    '<path d="M34 34 Q8 22 10 -2 Q26 4 42 26 Z" fill="#fbf3dc"/>' +
    '<path d="M52 18 Q46 -4 62 -4 Q70 6 64 22 Z" fill="#d23c2c"/>' +
    '<path d="M72 28 Q92 -6 118 2 Q114 20 86 36 Z" fill="#fbf3dc"/>' +
    '<path d="M80 26 Q96 6 113 5" fill="none" stroke-width="2"/>' +
    '<path d="M30 50 Q30 17 60 15 Q90 17 90 50 Z" fill="#7a1f2b"/>' +
    '<path d="M31 41 Q60 34 89 41 L90 49 Q60 42 30 49 Z" fill="#f2b632"/>' +
    '<path d="M36 45 L41 40 L46 44 L51 39 L56 43 L61 38 L66 43 L71 39 L76 44 L81 40 L86 45" fill="none" stroke="#c98a17" stroke-width="2"/>' +
    '<path d="M2 58 Q14 42 36 48 Q60 42 84 48 Q106 42 118 58 Q100 71 60 67 Q20 71 2 58 Z" fill="#9c2a36"/>' +
    '<path d="M5 59 Q22 69 60 66 Q98 69 115 59" fill="none" stroke="#f2b632" stroke-width="4.5"/>' +
    '<path d="M45 38 L42 18 L51 26 L60 10 L69 26 L78 18 L75 38 Q60 34 45 38 Z" fill="#f2b632"/>' +
    '<circle cx="42" cy="17" r="3" fill="#f2b632"/><circle cx="60" cy="9" r="3.4" fill="#f2b632"/><circle cx="78" cy="17" r="3" fill="#f2b632"/>' +
    '<circle cx="60" cy="29" r="3.6" fill="#d23c2c" stroke-width="2"/>' +
    '<circle cx="50.5" cy="32" r="2.4" fill="#2f5aa8" stroke-width="2"/><circle cx="69.5" cy="32" r="2.4" fill="#2f5aa8" stroke-width="2"/>',
  // Reis Ibrahim of Salé: a Moroccan turban of white muslin wound in swathes round a red cap, its loose end hanging
  // at the back, pinned with a silver brooch set with a green stone.
  rover:
    '<path d="M84 32 Q104 38 103 64 Q97 70 92 64 Q94 48 80 40 Z" fill="#ebe3cf"/>' +
    '<path d="M46 20 Q48 5 60 4 Q72 5 74 20 Q60 16 46 20 Z" fill="#c8402f"/>' +
    '<path d="M22 52 Q15 30 36 19 Q60 9 84 19 Q105 30 98 52 Q60 63 22 52 Z" fill="#f8f2e4"/>' +
    '<path d="M27 45 Q50 27 89 31 M25 36 Q48 20 81 21 M35 53 Q63 36 96 43" fill="none" stroke="#cfc5ad" stroke-width="3"/>' +
    '<path d="M20 51 Q60 66 100 51 Q99 62 60 66 Q21 62 20 51 Z" fill="#e8dfca"/>' +
    '<circle cx="57" cy="36" r="6.5" fill="#d3d9df"/><circle cx="57" cy="36" r="3" fill="#3f8a4f" stroke="none"/>',
  // Kara Hasan Reis, Admiral of Algiers: a tall black fur kalpak, its red crown-cloth tumbling over one side, a
  // gold band set with stones and a gold aigrette holding a white plume.
  kalpak:
    '<path d="M50 13 Q30 3 18 19 Q24 31 37 23 Q42 17 52 19 Z" fill="#c8402f"/>' +
    '<path d="M30 62 L33 16 Q60 6 87 16 L90 62 Q60 70 30 62 Z" fill="#2a2630"/>' +
    '<path d="M39 25 l2 -4 M49 21 l2 -4 M61 20 l2 -4 M73 21 l2 -4 M82 25 l2 -4 M37 39 l2 -4 M51 35 l2 -4 M66 35 l2 -4 M79 38 l2 -4 M40 51 l2 -4 M56 49 l2 -4 M71 49 l2 -4 M84 51 l2 -4" fill="none" stroke="#5c5666" stroke-width="2"/>' +
    '<path d="M28 58 Q60 68 92 58 L92 66 Q60 76 28 66 Z" fill="#f2b632"/>' +
    '<g stroke="none"><circle cx="42" cy="64" r="2.2" fill="#2f5aa8"/><circle cx="60" cy="67" r="2.4" fill="#c8402f"/><circle cx="78" cy="64" r="2.2" fill="#2f5aa8"/></g>' +
    '<path d="M61 16 Q53 0 65 -2 Q71 7 63 19 Z" fill="#fbf3dc"/>' +
    '<path d="M57 36 L60 15 L63 36 Z" fill="#f2b632"/><circle cx="60" cy="38" r="4.5" fill="#c8402f"/>',
  // Osman Reis of Tripoli: a full green turban wound over a red cap, a gold crescent pinned at the front and a
  // white plume.
  osman:
    '<path d="M71 23 Q83 -2 103 -3 Q99 12 81 29 Z" fill="#fbf3dc"/>' +
    '<path d="M79 25 Q90 9 99 2" fill="none" stroke-width="2"/>' +
    '<path d="M49 19 Q51 7 60 6 Q69 7 71 19 Z" fill="#c8402f"/>' +
    '<path d="M20 54 Q13 30 38 20 Q60 12 82 20 Q107 30 100 54 Q60 64 20 54 Z" fill="#3f8a4f"/>' +
    '<path d="M24 46 Q53 26 92 32 M27 36 Q55 20 86 24 M31 55 Q62 37 98 45" fill="none" stroke="#2c6a3a" stroke-width="3"/>' +
    '<path d="M18 54 Q60 68 102 54 Q100 64 60 68 Q20 64 18 54 Z" fill="#2c6a3a"/>' +
    '<path d="M51 29 A11 11 0 1 0 66 46 A9 9 0 1 1 51 29 Z" fill="#f2b632"/>',
  // The Provveditore of Candia: the Venetian corno, crimson brocade rising at the back into its rounded horn,
  // over a white linen coif, a gold band and a ruby at the front.
  corno:
    '<path d="M25 58 Q60 70 97 58 L98 66 Q60 78 23 66 Z" fill="#f5efe0"/>' +
    '<path d="M26 60 Q21 40 34 31 Q52 21 71 13 Q88 5 97 9 Q103 16 101 30 Q101 46 97 60 Q60 68 26 60 Z" fill="#a8262a"/>' +
    '<path d="M38 46 Q46 39 54 43 Q62 47 70 39 Q78 32 86 37 M42 56 Q50 50 58 53 Q66 57 74 50 Q82 44 90 49" fill="none" stroke="#e2a93a" stroke-width="2.5"/>' +
    '<path d="M79 14 Q91 9 96 18" fill="none" stroke="#d65a4c" stroke-width="3"/>' +
    '<path d="M25 55 Q60 66 98 55 L98 61 Q60 72 25 61 Z" fill="#f2b632"/>' +
    '<circle cx="60" cy="61" r="3.2" fill="#d23c2c" stroke-width="2"/>',
  // Bahri Ömer Pasha, Kapudan Pasha: a tall kavuk wound slantwise in white muslin, a gold band, and a jewelled
  // aigrette holding heron plumes, one dyed red.
  kavuk:
    '<g transform="translate(6 5) scale(0.9)">' +
    '<path d="M56 15 Q43 -3 53 -2 Q61 3 60 17 Z" fill="#fbf3dc"/>' +
    '<path d="M63 15 Q68 -3 78 -2 Q76 8 65 19 Z" fill="#fbf3dc"/>' +
    '<path d="M60 17 Q56 0 62 -2 Q67 5 63 19 Z" fill="#d23c2c"/>' +
    '<path d="M30 64 Q26 38 34 15 Q60 7 86 15 Q94 38 90 64 Q60 72 30 64 Z" fill="#f6f0e2"/>' +
    '<path d="M35 22 Q60 14 86 28 M32 33 Q60 25 88 40 M31 45 Q60 37 89 52 M33 56 Q60 49 90 62" fill="none" stroke="#c9bfa8" stroke-width="3"/>' +
    '<path d="M28 60 Q60 70 92 60 L92 68 Q60 78 28 68 Z" fill="#f2b632"/>' +
    '<path d="M53 31 Q60 19 67 31 Q60 38 53 31 Z" fill="#f2b632"/>' +
    '<circle cx="60" cy="30" r="3" fill="#2f5aa8"/><circle cx="60" cy="39" r="2.4" fill="#d23c2c" stroke-width="2"/>' + '</g>',
};

// Inline SVG art for a hat; locked hats render as a faded silhouette.
export function hatSVG(id, locked, cls = 'hat') {
  const label = HATS[id].name + (locked ? ' (not won yet)' : '');
  return `<svg viewBox="0 -4 120 80" class="${cls}${locked ? ' locked' : ''}" role="img" aria-label="${label}">` +
    `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${ART[id]}</g></svg>`;
}
