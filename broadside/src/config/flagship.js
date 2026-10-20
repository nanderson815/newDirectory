// The flagship class: a great ship of the first rate, the only class with gun slots (src/config/slots.js) to fit
// slot by slot at the shipyard. src/config/ships.js merges FLAGSHIP_TYPES into TYPES, so she is a ship type like
// any other (battles may put one to sea, as Spain does at La Gran Armada).
//
// Her `guns`, `reload` and `range` are what the rest of the game reads at a glance (the type table, the AI's
// idea of her reach before her batteries are built); in battle every slot fires with its own gun's numbers.
// `speed` and `turn` are with the default loadout; heavier guns slow her, lighter ones quicken her (WEIGHT).
// This file imports nothing, so ships.js can import it without a cycle.

export const FLAGSHIP_TYPES = {
  greatship: {
    label: 'Great ship', L: 87, B: 31.5, hp: 320, guns: 9, reload: 3.4, speed: 42, turn: 0.58, range: 300, masts: 3, marines: 40,
    tons: 92,
    slots: {
      portLower: { label: 'Lower tier', pos: 'broadside', side: 'port', tier: 'lower', count: 5, accepts: ['long', 'demicannon'], default: 'long', at: [-0.3, 0.3] },
      portUpper: { label: 'Upper tier', pos: 'broadside', side: 'port', tier: 'upper', count: 4, accepts: ['long', 'carronade', 'swivel'], default: 'long', at: [-0.24, 0.2] },
      starboardLower: { label: 'Lower tier', pos: 'broadside', side: 'starboard', tier: 'lower', count: 5, accepts: ['long', 'demicannon'], default: 'long', at: [-0.3, 0.3] },
      starboardUpper: { label: 'Upper tier', pos: 'broadside', side: 'starboard', tier: 'upper', count: 4, accepts: ['long', 'carronade', 'swivel'], default: 'long', at: [-0.24, 0.2] },
      bow: { label: 'Bow', pos: 'bow', count: 2, accepts: ['bowChaser', 'swivel'], default: 'bowChaser' },
      stern: { label: 'Stern', pos: 'stern', count: 2, accepts: ['sternChaser', 'swivel'], default: 'sternChaser' },
      forecastle: { label: 'Forecastle', pos: 'deck', count: 2, accepts: ['swivel', 'mortar', 'firepot'], default: 'swivel', at: [0.3, 0.36] },
      quarterdeck: { label: 'Quarterdeck', pos: 'deck', count: 2, accepts: ['swivel', 'mortar', 'firepot'], default: 'swivel', at: [-0.3, -0.36] },
    },
  },
};

// How the campaign offers her: once `unlock` (a battle id) is won, any ship of a class in `from` can be rebuilt
// as a great ship for that much gold (one great ship to a squadron). Her old extra guns and bow chasers give way
// to the gun decks; hull, canvas, marines, mines and shot carry over.
export const FLAGSHIP = { type: 'greatship', unlock: 'armada', from: { manowar: 1000, frigate: 1500 } };
