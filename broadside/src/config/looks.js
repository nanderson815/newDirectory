// Ship looks: the cosmetics a ship wears (paint, canvas, a device on her courses, a figurehead, the colours she
// flies, stern lanterns and gilding). Cosmetic only: nothing here changes how a ship sails or fights.
//
// A look is plain JSON, every field optional (a missing field means the default):
//   { paint, cloth, emblem, figurehead, flag, lanterns, gilding }
// Each field but `lanterns` names an entry in its catalogue below; `lanterns` is 1-3.
//
// Your ships keep theirs in the save (fleet[i].look, src/save.js) and dress at the shipyard. An entry offers itself
// there for `cost` gold (bought once, then any ship of the squadron may wear it), or comes free once you hold the
// hat named by `hat` (you take the boss's style along with the hat). Entries marked `foe` are only for the enemy
// (Spanish, pirate, Barbary and Ottoman fashions). render/models.js draws every entry; the colours live here.
//
// Enemies are dressed from their faction's palette (FACTION_LOOKS), seeded by the ship so two brigs in one battle
// differ; bosses wear their own (BOSS_LOOKS, by hat), and a battle's ship def may set `look` itself.
//
// Team colours stay out of reach of the looks: whatever she wears, an English ship keeps a blue rail, blue colours
// and canvas edged in blue; the enemy keeps red (render/models.js).

// What a look may hold (the save docs and the validator read this).
export const LOOK_FIELDS = {
  paint: 'paint scheme (PAINTS): her sides, upperworks, wales and the insides of her gunports',
  cloth: 'sail cloth (CLOTHS)',
  emblem: 'the device painted on her courses (EMBLEMS)',
  figurehead: 'the carving at her stem (FIGUREHEADS)',
  flag: 'the colours she flies (FLAGS): a flag, a long pennant or an admiral\'s flag at the main; all but the plain flag add a great ensign aft',
  lanterns: 'how many stern lanterns she shows, 1-3',
  gilding: 'carving and gilt about her stern (GILDING)',
};

// side/castle/wale/ports: hull sides, the upperworks (castle), the wale (the thick strake along her side), and
// the gunport lids' insides; band (optional): a painted band along her upper strake; deck (optional): her deck
// planking, sun-bleached or dark (default the warm pine of every West Indies ship). Colours are "#rrggbb".
export const PAINTS = {
  oak: { name: 'Oiled oak', about: 'Bright oak sides and a blue wale, as she came off the slip.', cost: 0,
    side: '#a5672f', castle: '#c28145', wale: '#2f6fd6', ports: '#6e2a1c' },
  ochre: { name: 'Yellow ochre', about: 'Ochre sides between black wales, upperworks in blue: the Navy\'s own colours.', cost: 140,
    side: '#c99a45', castle: '#35609e', wale: '#2a221c', ports: '#a3271c' },
  black: { name: 'Black and white', about: 'Tarred black with a white strake, in the Dutch fashion.', cost: 120,
    side: '#2d2825', castle: '#463c35', wale: '#ece2c8', ports: '#a3271c' },
  verdigris: { name: 'Verdigris', about: 'Sea-green sides, cream upperworks and red ports.', cost: 180,
    side: '#3e6e5c', castle: '#dcc89e', wale: '#2a221c', ports: '#a3271c' },
  venetian: { name: 'Venetian red', about: 'Rojo\'s own red, with black wales and gilt ports.', hat: 'rojo',
    side: '#8a3a26', castle: '#a64d33', wale: '#2a221c', ports: '#e2b13a' },
  iron: { name: 'Hierro grey', about: 'Gunmetal grey with a red wale, as the Marqués kept the San Jerónimo.', hat: 'morion',
    side: '#5a626c', castle: '#7a828b', wale: '#8a2a20', ports: '#2a221c' },
  royal: { name: 'Royal blue and gilt', about: 'Deep blue sides and gilt wales, fit for a Captain-General.', hat: 'armada',
    side: '#253a66', castle: '#2f5d9a', wale: '#d9a441', ports: '#a3271c' },
  calico: { name: 'Calico black', about: 'Kate\'s black, with a red wale and gilt ports.', hat: 'kate',
    side: '#211d20', castle: '#3a2b2b', wale: '#a3271c', ports: '#d9a441' },
  // The Mediterranean's.
  sale: { name: 'Salé green and white', about: 'Reis Ibrahim\'s green sides and white upperworks, with a red wale and a gilt band.', hat: 'rover',
    side: '#2f5a46', castle: '#efe6cf', wale: '#a3271c', ports: '#d9a441', band: '#e2b13a' , deck: '#e3c08a' },
  serenissima: { name: 'Serenissima crimson', about: 'Venetian crimson and gold, as the Provveditore\'s galleys wore it.', hat: 'corno',
    side: '#7a1f2b', castle: '#a8262a', wale: '#e2b13a', ports: '#e2b13a' , deck: '#b98352' },
  // The enemy's.
  spain: { foe: true, name: 'Spanish brown', side: '#7a3a28', castle: '#93483a', wale: '#c9a227', ports: '#2a1d17' },
  spainBlack: { foe: true, name: 'Spanish black', side: '#2e2523', castle: '#7a3a28', wale: '#c9a227', ports: '#a3271c' },
  spainOchre: { foe: true, name: 'Spanish ochre', side: '#b98a3e', castle: '#8e3b2a', wale: '#2a221c', ports: '#8e3b2a' },
  spainGreen: { foe: true, name: 'Spanish green', side: '#47604a', castle: '#93483a', wale: '#c9a227', ports: '#a3271c' },
  spainGold: { foe: true, name: 'Crimson and gold', side: '#6e1f1c', castle: '#8e2a22', wale: '#e2b13a', ports: '#e2b13a' },
  pirate: { foe: true, name: 'Tarred', side: '#3a2c28', castle: '#4c3934', wale: '#7a2620', ports: '#1c1614' },
  pirateGrey: { foe: true, name: 'Weathered grey', side: '#5c554e', castle: '#6e655b', wale: '#2a221c', ports: '#7a2620' },
  pirateRed: { foe: true, name: 'Dried-blood red', side: '#4e2420', castle: '#5e302a', wale: '#1c1614', ports: '#c9a227' },
  // The corsairs paint their sides bright, with a band of a second colour along the upper strake.
  barbaryGreen: { foe: true, name: 'Algiers green', side: '#2f5a46', castle: '#e9dfc2', wale: '#a3271c', ports: '#a3271c', band: '#e9dfc2' , deck: '#e3c08a' },
  barbaryRed: { foe: true, name: 'Barbary red', side: '#8c3324', castle: '#e9dfc2', wale: '#2f5a46', ports: '#2a221c', band: '#e2b13a' , deck: '#e3c08a' },
  barbaryOchre: { foe: true, name: 'Sand', side: '#c7a46a', castle: '#8c3324', wale: '#2a221c', ports: '#8c3324', band: '#2f5a46' , deck: '#e3c08a' },
  barbaryBlack: { foe: true, name: 'Tripoli black', side: '#2b2623', castle: '#c9a24a', wale: '#a3271c', ports: '#a3271c', band: '#e9dfc2' , deck: '#e3c08a' },
  barbaryWhite: { foe: true, name: 'Whitewash', side: '#e6dcc0', castle: '#2f6a4a', wale: '#a3271c', ports: '#2f6a4a', band: '#2f6a4a' , deck: '#e3c08a' },
  // The Sultan's: deep reds and greens, gilt wales.
  ottomanRed: { foe: true, name: 'Ottoman red', side: '#7e2420', castle: '#2f5a46', wale: '#e2b13a', ports: '#e2b13a', band: '#e9dfc2' , deck: '#b98352' },
  ottomanGreen: { foe: true, name: 'Ottoman green', side: '#2c4c3e', castle: '#7e2420', wale: '#e2b13a', ports: '#7e2420', band: '#e2b13a' , deck: '#b98352' },
  ottomanBlack: { foe: true, name: 'Ottoman black', side: '#26211f', castle: '#7e2420', wale: '#e2b13a', ports: '#e2b13a', band: '#7e2420' , deck: '#b98352' },
  karaEjder: { foe: true, name: 'The Black Dragon', side: '#1f1b1d', castle: '#7e2420', wale: '#e2b13a', ports: '#e2b13a', band: '#e2b13a' , deck: '#9a6a42' },
  // Allies: the Order of St John's black and red.
  religion: { foe: true, name: 'The Religion', side: '#24201e', castle: '#a8262a', wale: '#e2b13a', ports: '#a8262a', band: '#a8262a' , deck: '#b98352' },
  merchant: { foe: true, name: 'Merchant', side: '#a8743f', castle: '#c4925a', wale: '#3d7a52', ports: '#3a2a1e' },
};

// color: the cloth; stripe: a second colour sewn in every other cloth (optional), stripeW: how wide that cloth's
// stripe is, of 16 (default all of it).
export const CLOTHS = {
  natural: { name: 'Natural canvas', about: 'Unbleached duck, the colour of fresh bread.', cost: 0, color: '#fbf3dc' },
  white: { name: 'Bleached white', about: 'Bleached in the Port Royal sun until it hurts to look at.', cost: 60, color: '#fffcf3' },
  tan: { name: 'Tanbark', about: 'Barked brown, the fishermen\'s cloth: it never rots.', cost: 80, color: '#d6a66c' },
  striped: { name: 'Striped duck', about: 'Cream with a tan cloth sewn in between every other.', cost: 120, color: '#f8efd6', stripe: '#cf9f5f' },
  dyed: { name: 'Indigo-dyed', about: 'Dyed deep blue in the vats behind the Point. Dear, and unmistakably yours.', cost: 200, color: '#56709f' },
  black: { name: 'Black canvas', about: 'Calico Kate\'s black canvas: seen at night by no one.', hat: 'kate', color: '#2f2a30' },
  algerine: { name: 'Algerine stripes', about: 'White duck with green cloths between, off the Mubarak\'s yards.', hat: 'kalpak', color: '#f4ecd8', stripe: '#2f5a46' },
  tripoli: { name: 'Tripoli green', about: 'Osman Reis\'s green lateens, cut square for your yards.', hat: 'osman', color: '#9fc7a2' },
  // The enemy's.
  crimson: { foe: true, name: 'Crimson', color: '#a8262a' },
  patched: { foe: true, name: 'Patched', color: '#b9ad95', stripe: '#8f8471' },
  barbary: { foe: true, name: 'Barbary stripes', color: '#f4ecd8', stripe: '#b8402f' },
  corsair: { foe: true, name: 'Corsair pinstripe', color: '#f6eedb', stripe: '#3f7a52', stripeW: 4 },
  ottoman: { foe: true, name: 'Ottoman pinstripe', color: '#f6efdc', stripe: '#b8402f', stripeW: 3 },
  merchant: { foe: true, name: 'Merchant', color: '#f7eed6', stripe: '#d9a873' },
};

// Devices are drawn in render/models.js.
export const EMBLEMS = {
  band: { name: 'The squadron\'s band', about: 'A blue band across every course, the squadron\'s mark.', cost: 0 },
  none: { name: 'Plain canvas', about: 'No device at all.', cost: 0 },
  george: { name: 'Cross of St George', about: 'A red cross the height of the sail.', cost: 90 },
  rose: { name: 'Tudor rose', about: 'Red and white, with a gilt heart.', cost: 140 },
  lion: { name: 'Lion\'s head', about: 'A gilt lion\'s head, mane and all.', cost: 180 },
  sun: { name: 'Sun in splendour', about: 'A gilt sun with a face, painted on every course.', cost: 240 },
  anchor: { name: 'Fouled anchor', about: 'An anchor and its cable, the badge you earned on the shakedown cruise.', hat: 'cabin' },
  skull: { name: 'Kate\'s skull', about: 'The skull and crossbones off the Black Wyvern\'s canvas.', hat: 'kate' },
  crown: { name: 'Crown', about: 'The Captain-General\'s crown, red-jewelled.', hat: 'armada' },
  markLion: { name: 'Lion of St Mark', about: 'Venice\'s winged lion in gold on a red roundel, as the Provveditore\'s galleys carry it.', hat: 'corno' },
  // The enemy's.
  saltire: { foe: true, name: 'Cross of Burgundy' },
  santiago: { foe: true, name: 'Cross of Santiago' },
  swords: { foe: true, name: 'Crossed cutlasses' },
  hourglass: { foe: true, name: 'Hourglass' },
  crescent: { foe: true, name: 'Crescent' },
  crescents: { foe: true, name: 'Three crescents' },
  zulfiqar: { foe: true, name: 'Zulfiqar' },
  maltese: { foe: true, name: 'Cross of the Order' },
  merchant: { foe: true, name: 'Merchant\'s bands' },
};

export const FIGUREHEADS = {
  scroll: { name: 'Plain scroll', about: 'A carved scroll at the stem head, and nothing more.', cost: 0 },
  lion: { name: 'Gilt lion', about: 'The lion of England, gilt, leaping off the stem.', cost: 150 },
  unicorn: { name: 'Unicorn', about: 'White, with a gilt horn.', cost: 180 },
  mermaid: { name: 'Mermaid', about: 'She looks out ahead so the lookouts needn\'t.', cost: 220 },
  eagle: { name: 'Spread eagle', about: 'El Comodoro\'s eagle, sawn off San Cristóbal\'s stem.', hat: 'comodoro' },
  wyvern: { name: 'Black wyvern', about: 'Wings, teeth and a red eye, off Calico Kate\'s own stem.', hat: 'kate' },
  markLion: { name: 'Lion of St Mark', about: 'Venice\'s winged lion with his book, a gift from Candia.', hat: 'corno' },
  // The enemy's.
  saint: { foe: true, name: 'A saint' },
  ejder: { foe: true, name: 'The black dragon' },
};

// Every flag but the plain one also flies a great ensign at the stern staff.
export const FLAGS = {
  colours: { name: 'Her colours', about: 'A plain flag at the main.', cost: 0 },
  ensign: { name: 'Great ensign', about: 'A great ensign at the stern staff besides.', cost: 60 },
  pennant: { name: 'Long pennant', about: 'A long swallow-tailed pennant streaming from the main, and the ensign aft.', cost: 110 },
  admiral: { name: 'Admiral\'s flag', about: 'A great square flag at the main with a gilt anchor, as the Almirante flew his.', hat: 'oro' },
};

export const LANTERNS = {
  1: { name: 'One lantern', about: 'A single lantern at the taffrail.', cost: 0 },
  2: { name: 'Two lanterns', about: 'A lantern either quarter, for keeping station at night.', cost: 80 },
  3: { name: 'Three lanterns', about: 'Three great lanterns, as a flagship shows them.', cost: 150 },
};

export const GILDING = {
  plain: { name: 'Plain stern', about: 'Stern windows and honest paint.', cost: 0 },
  gilt: { name: 'Gilt carving', about: 'Gilt quarter-badges, a carved taffrail and a name board.', cost: 200 },
  almirante: { name: 'The Almirante\'s gilding', about: 'The Santísima Trinidad\'s gold leaf, stern to stem: gilt galleries, mouldings and figurehead.', hat: 'oro' },
  kapudan: { name: 'The Kapudan\'s gilding', about: 'The Kara Ejder\'s gilt galleries and lanterns, given with the Kapudan Pasha\'s kavuk.', hat: 'kavuk' },
};

export const LOOK_CATALOGUE = { paint: PAINTS, cloth: CLOTHS, emblem: EMBLEMS, figurehead: FIGUREHEADS, flag: FLAGS, lanterns: LANTERNS, gilding: GILDING };
// The order the shipyard lists them in.
export const LOOK_ORDER = ['paint', 'cloth', 'emblem', 'figurehead', 'flag', 'lanterns', 'gilding'];
// Your ships' usual look.
export const LOOK_DEFAULT = { paint: 'oak', cloth: 'natural', emblem: 'band', figurehead: 'scroll', flag: 'colours', lanterns: 1, gilding: 'plain' };

// The catalogue entry a look field names (null if none).
export const lookItem = (field, id) => (LOOK_CATALOGUE[field] && id != null ? LOOK_CATALOGUE[field][String(id)] || null : null);
// Problems with a look (empty = fine). foe: enemy-only entries are allowed (a battle's ship def).
export function checkLook(look, { foe = false } = {}) {
  const P = [];
  if (look == null) return P;
  if (typeof look !== 'object' || Array.isArray(look)) return ['look must be { field: id }'];
  for (const [k, v] of Object.entries(look)) {
    if (!(k in LOOK_FIELDS)) { P.push(`look: unknown field '${k}' (known: ${Object.keys(LOOK_FIELDS).join(', ')})`); continue; }
    if (k === 'lanterns') { if (![1, 2, 3].includes(v)) P.push(`look: lanterns must be 1, 2 or 3, got ${JSON.stringify(v)}`); continue; }
    const it = lookItem(k, v);
    if (!it) P.push(`look: unknown ${k} ${JSON.stringify(v)} (known: ${Object.keys(LOOK_CATALOGUE[k]).filter((id) => foe || !LOOK_CATALOGUE[k][id].foe).join(', ')})`);
    else if (it.foe && !foe) P.push(`look: ${k} '${v}' is only for the enemy`);
  }
  return P;
}
// A look with anything invalid dropped (the save keeps only what it can draw).
export function cleanLook(look, opts) {
  if (!look || typeof look !== 'object' || Array.isArray(look)) return {};
  const out = {};
  for (const [k, v] of Object.entries(look)) if (!checkLook({ [k]: v }, opts).length) out[k] = v;
  return out;
}

// ---------- The enemy ----------
// Each faction's wardrobe: a ship draws one entry from each list, seeded by her name and id. Unknown factions dress
// as Spain does. A faction may leave a field out (it then takes Spain's).
export const FACTION_LOOKS = {
  spain: {
    paint: ['spain', 'spainBlack', 'spainOchre', 'spainGreen'], cloth: ['natural', 'white', 'tan', 'striped'],
    emblem: ['saltire', 'saltire', 'santiago', 'none'], figurehead: ['lion', 'saint', 'scroll'],
    flag: ['colours', 'colours', 'pennant', 'ensign'], lanterns: [1, 1, 2], gilding: ['plain', 'plain', 'gilt'],
  },
  pirate: {
    paint: ['pirate', 'pirateGrey', 'pirateRed'], cloth: ['black', 'black', 'patched'],
    emblem: ['skull', 'skull', 'swords', 'hourglass'], figurehead: ['mermaid', 'scroll', 'wyvern'],
    flag: ['colours', 'pennant'], lanterns: [1, 1, 2], gilding: ['plain'],
  },
  barbary: {
    paint: ['barbaryGreen', 'barbaryRed', 'barbaryOchre', 'barbaryBlack', 'barbaryWhite'], cloth: ['barbary', 'white', 'corsair', 'natural'],
    emblem: ['crescent', 'zulfiqar', 'none', 'crescent'], figurehead: ['lion', 'scroll'],
    flag: ['colours', 'pennant', 'ensign'], lanterns: [1, 2], gilding: ['plain', 'gilt'],
  },
  ottoman: {
    paint: ['ottomanRed', 'ottomanGreen', 'ottomanBlack'], cloth: ['white', 'ottoman', 'natural', 'ottoman'],
    emblem: ['crescents', 'crescent', 'none'], figurehead: ['lion', 'scroll'],
    flag: ['colours', 'pennant', 'ensign'], lanterns: [1, 2, 3], gilding: ['plain', 'gilt', 'gilt'],
  },
};

// Allied captains on your side (a ship def with ally: true and faction 'venice' or 'knights') wear their nation's
// dress; their rail and canvas edge stay a friend's blue (render/models.js).
export const ALLY_LOOKS = {
  venice: { paint: 'serenissima', cloth: 'white', emblem: 'markLion', figurehead: 'markLion', flag: 'ensign', lanterns: 3, gilding: 'gilt' },
  knights: { paint: 'religion', cloth: 'white', emblem: 'maltese', figurehead: 'scroll', flag: 'ensign', lanterns: 3, gilding: 'gilt' },
};

// Bosses dress as themselves, by the hat they wear (a boss with a hat not listed here takes the richest of her
// faction's wardrobe).
export const BOSS_LOOKS = {
  rojo: { paint: 'venetian', cloth: 'crimson', emblem: 'saltire', figurehead: 'mermaid', flag: 'pennant', lanterns: 3, gilding: 'gilt' },
  comodoro: { paint: 'spainBlack', cloth: 'white', emblem: 'santiago', figurehead: 'eagle', flag: 'pennant', lanterns: 3, gilding: 'gilt' },
  oro: { paint: 'spainGold', cloth: 'white', emblem: 'sun', figurehead: 'lion', flag: 'admiral', lanterns: 3, gilding: 'almirante' },
  kate: { paint: 'calico', cloth: 'black', emblem: 'skull', figurehead: 'wyvern', flag: 'pennant', lanterns: 2, gilding: 'plain' },
  morion: { paint: 'iron', cloth: 'tan', emblem: 'saltire', figurehead: 'saint', flag: 'pennant', lanterns: 3, gilding: 'gilt' },
  armada: { paint: 'spainGold', cloth: 'white', emblem: 'crown', figurehead: 'lion', flag: 'admiral', lanterns: 3, gilding: 'almirante' },
  // The Mediterranean's bosses (src/config/battles-med.js).
  rover: { paint: 'sale', cloth: 'barbary', emblem: 'zulfiqar', figurehead: 'scroll', flag: 'pennant', lanterns: 2, gilding: 'gilt' },
  kalpak: { paint: 'barbaryGreen', cloth: 'algerine', emblem: 'crescent', figurehead: 'lion', flag: 'admiral', lanterns: 3, gilding: 'gilt' },
  osman: { paint: 'barbaryRed', cloth: 'tripoli', emblem: 'crescent', figurehead: 'scroll', flag: 'pennant', lanterns: 3, gilding: 'gilt' },
  kavuk: { paint: 'karaEjder', cloth: 'white', emblem: 'crescents', figurehead: 'ejder', flag: 'admiral', lanterns: 3, gilding: 'kapudan' },
};

// A small, stable string hash (FNV-1a).
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// The look an enemy ship wears when her battle doesn't say: from her faction's palette, seeded by her name and id
// (ids run in order through a battle, so the paint alone steps on for each ship of a class), or her boss's own.
// s: { name, id, type, faction, boss }.
export function enemyLook(s, faction) {
  const pal = { ...FACTION_LOOKS.spain, ...(FACTION_LOOKS[faction] || {}) };
  if (s.boss) {
    const own = BOSS_LOOKS[s.boss.hat];
    if (own) return { ...own };
    const last = (k) => pal[k][pal[k].length - 1];
    return { paint: pal.paint[0], cloth: pal.cloth[0], emblem: pal.emblem[0], figurehead: last('figurehead'), flag: 'pennant', lanterns: 3, gilding: last('gilding') };
  }
  const h = hash(`${faction}|${s.type}|${s.name || ''}`), id = s.id || 0;
  // Odd primes step each field on with the id (none divides a palette's length, so neighbours always differ).
  const STEP = { 3: 5, 7: 7, 11: 11, 13: 13, 17: 17, 19: 19 };
  const pick = (k, salt) => pal[k][(((h >>> salt) & 0xffff) + id * STEP[salt]) % pal[k].length];
  return {
    paint: pal.paint[((h & 0xff) + id) % pal.paint.length], cloth: pick('cloth', 3), emblem: pick('emblem', 7), figurehead: pick('figurehead', 11),
    flag: pick('flag', 13), lanterns: pick('lanterns', 17), gilding: pick('gilding', 19),
  };
}
