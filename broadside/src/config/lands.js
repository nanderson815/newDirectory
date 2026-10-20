// The land of each battle, keyed by battle id (see battles.js): how its islands and shores look and what stands
// on them. Merged in when the battle is built (src/sim/land.js); a battle def may carry its own `land` instead.
//
//   style:     the look: port, windward, main, golden, pirate, campeche, armada (default: the battle's region)
//   relief:    [{ island, height?, cliffs?, at? }] per-island shape: hill height multiplier, share of the shore
//              that is cliff (0-1) and which way the cliffs face (degrees)
//   landmarks: [{ kind, ...placement, ...params }] from LANDMARKS in src/sim/land.js. Placement is one of
//                island: i, at (degrees from its centre: 0 east, 90 down the chart), d (0 middle .. 1 shore)
//                coast: i, at (0-1 along the edge), inland (map units in from the shore)
//                x, y (portrait fractions; a wreck on a reef)
//
// Most landmarks are scenery. These change the battle (docs/PRIMITIVES.md has every param):
//   harbour (rate > 0)  your ships lying still in its anchorage patch their hulls
//   town (loot > 0)     bombard an enemy town to sack it for prize gold
//   peak, volcano       high land casts a lee downwind where ships sail slower
//   lighthouse (sight)  lifts the fog around it
// Islands and coasts are indexed as in battles.js, so `npm run check` catches a landmark left behind when the
// geography changes.

export const LANDS = {
  // ---------- Port Royal ----------
  // Port Royal at the end of the Palisadoes spit, its harbour behind; a windmill cay out in the bay.
  tutorial: {
    relief: [{ island: 0, height: 0.7, cliffs: 0 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', island: 0, at: -6, d: 0.72, houses: 4, look: 'english', name: 'Port Royal' },
      { kind: 'harbour', island: 0, at: 14, rate: 0 },
      { kind: 'lighthouse', island: 0, at: -6, d: 0.9 },
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 3, look: 'english', name: 'Kingston' },
      { kind: 'windmill', island: 1, at: 200, d: 0.35 },
      { kind: 'church', island: 1, at: 20, d: 0.42 },
    ],
  },

  // ---------- The Windward Passage ----------
  // Tortuga: buccaneers' cliffs and a light on the cape, a rocky ridge across the narrows.
  tortuga: {
    relief: [{ island: 0, height: 1.3, cliffs: 0.5, at: 180 }, { island: 1, cliffs: 0.6, at: 90 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.46, inland: 34 },
      { kind: 'town', coast: 0, at: 0.22, inland: 60, houses: 6, look: 'shanty', name: 'Cayona' },
      { kind: 'castle', coast: 0, at: 0.66, inland: 60 },
      { kind: 'stacks', island: 0, at: 200, count: 3 },
      { kind: 'stacks', island: 1, at: 130, count: 2 },
      { kind: 'ruin', island: 0, at: 0, d: 0.15 },
    ],
  },
  // The Caymans: low turtle cays among the banks, a brig that found the sand first.
  cayman: {
    relief: [{ island: 0, height: 0.5, cliffs: 0 }, { island: 1, height: 0.6, cliffs: 0.3, at: -60 }, { island: 2, height: 0.5, cliffs: 0 }],
    landmarks: [
      { kind: 'wreck', x: 0.5, y: 0.7 },
      { kind: 'town', island: 0, at: 120, d: 0.45, houses: 3, look: 'village', name: 'the turtlers’ camp' },
      { kind: 'mangroves', island: 0, at: 300, span: 120 },
      { kind: 'lighthouse', island: 1, at: 150, d: 0.45 },
      { kind: 'stacks', island: 1, at: -40, count: 2 },
      { kind: 'mangroves', island: 2, at: 0, span: 140 },
    ],
  },
  // La Bruja's lair: a smoking volcano whose lee runs away east of it, and a sea-stack island.
  rojo: {
    relief: [{ island: 0, height: 1.2, cliffs: 0.4, at: 200 }, { island: 1, cliffs: 0.5, at: -30 }],
    landmarks: [
      { kind: 'volcano', island: 0, at: 200, d: 0.1, height: 62, size: 0.8 },
      { kind: 'ruin', island: 1, at: 160, d: 0.45 },
      { kind: 'stacks', island: 1, at: -40, count: 4 },
      { kind: 'wreck', x: 0.24, y: 0.6 },
    ],
  },

  // ---------- The Spanish Main ----------
  // San Lucas: a whitewashed town at the head of the estuary (bombard it for its silver), the fort on its islet
  // in the river mouth, a mission on the hill.
  sanlucas: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.9 }, { island: 2, height: 1.1, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.42, inland: 40, houses: 7, name: 'San Lucas', loot: 120 },
      { kind: 'harbour', coast: 0, at: 0.32, rate: 0 },
      { kind: 'church', coast: 0, at: 0.56, inland: 60 },
      { kind: 'church', island: 1, at: 200, d: 0.25 },
      { kind: 'windmill', island: 2, at: 160, d: 0.3 },
      { kind: 'wreck', x: 0.38, y: 0.68 },
    ],
  },
  // The silver coast: a mission town in the cove, a light on the northern cape, a reef that has claimed a galleon.
  silver: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, cliffs: 0.4, at: 200 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.25, inland: 50, houses: 7, name: 'Santa Cruz', loot: 110 },
      { kind: 'church', coast: 0, at: 0.42, inland: 52 },
      { kind: 'lighthouse', coast: 0, at: 0.9, inland: 26 },
      { kind: 'windmill', coast: 0, at: 0.64, inland: 44 },
      { kind: 'wreck', x: 0.53, y: 0.41 },
      { kind: 'ruin', island: 1, at: 0, d: 0.2 },
    ],
  },
  // San Cristóbal: the Comodoro's anchorage behind two fort islands. Take Santa Inés and its harbour patches
  // your hulls.
  comodoro: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.8 }, { island: 2, height: 1.2, cliffs: 0.3, at: 90 }, { island: 3, height: 1.1, cliffs: 0.5, at: 120 }],
    landmarks: [
      { kind: 'town', island: 0, at: 150, d: 0.75, houses: 5, name: 'Santa Fe' },
      { kind: 'town', island: 1, at: 30, d: 0.75, houses: 5, name: 'Santa Inés' },
      { kind: 'harbour', island: 1, at: 100 },
      { kind: 'church', island: 2, at: 0, d: 0.1 },
      { kind: 'windmill', island: 3, at: -18, d: 0.5 },
      { kind: 'stacks', island: 3, at: 110, count: 3 },
      { kind: 'wreck', x: 0.15, y: 0.37 },
    ],
  },

  // ---------- The Golden Isles ----------
  // Cartagena: the walled city at the head of the bay, Fort San Felipe over Boca Chica, jungle and an old temple
  // on Tierra Bomba, a peak whose lee lies off the western islet.
  cartagena: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 1.1 }, { island: 2, height: 1.3 }, { island: 3, height: 1.1 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.42, inland: 50, houses: 8, name: 'Cartagena', loot: 150 },
      { kind: 'church', coast: 0, at: 0.6, inland: 52 },
      { kind: 'harbour', coast: 0, at: 0.3, rate: 0 },
      { kind: 'ruin', island: 1, at: 180, d: 0.3 },
      { kind: 'peak', island: 2, at: 0, d: 0.1, height: 45, lee: 2.5 },
      { kind: 'wreck', island: 3, at: 90, d: 0.82 },
    ],
  },
  // Santa Marta: twin towers on the atoll's islets; a smoking islet in the lagoon between them.
  santamarta: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 0.9 }, { island: 2, height: 1.4 }],
    landmarks: [
      { kind: 'town', island: 0, at: 200, d: 0.72, houses: 5, name: 'Santa Marta' },
      { kind: 'windmill', island: 1, at: 330, d: 0.73 },
      { kind: 'volcano', island: 2, at: 0, d: 0.05, height: 52, size: 0.85, lee: 3 },
      { kind: 'mangroves', island: 2, at: 90, span: 120 },
      { kind: 'stacks', island: 1, at: 0, count: 3 },
      { kind: 'harbour', island: 0, at: 120, rate: 0 },
      { kind: 'wreck', x: 0.82, y: 0.33 },
    ],
  },
  // The Almirante's golden isles: a temple of gold in the jungle and a mountain whose lee steals the wind from
  // the middle channel.
  oro: {
    relief: [{ island: 0, height: 1.5 }, { island: 1, height: 1.2, cliffs: 0.3, at: -40 }, { island: 2, height: 1.1 }, { island: 5, height: 1.0 }, { island: 7, cliffs: 0.6, at: -30 }],
    landmarks: [
      { kind: 'peak', island: 0, at: 200, d: 0.1, height: 58, size: 0.85 },
      { kind: 'ruin', island: 1, at: 150, d: 0.35 },
      { kind: 'lighthouse', island: 1, at: -60, d: 0.6 },
      { kind: 'ruin', island: 2, at: 0, d: 0.1 },
      { kind: 'mangroves', island: 3, at: 0, span: 120 },
      { kind: 'mangroves', island: 4, at: 180, span: 100 },
      { kind: 'ruin', island: 5, at: 180, d: 0.3 },
      { kind: 'stacks', island: 7, at: -30, count: 3 },
    ],
  },

  // ---------- The Pirate Coast ----------
  // Smugglers' Cove: a shanty town on stilts round the cove, Skull Rock on the point, a light over the deep gut,
  // a wreck on the reef.
  cove: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 1.0, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.5, inland: 26, houses: 9, name: 'Smugglers’ Cove' },
      { kind: 'skull', coast: 0, at: 0.2, inland: 30 },
      { kind: 'lighthouse', coast: 0, at: 0.8, inland: 30 },
      { kind: 'wreck', x: 0.5, y: 0.6 },
      { kind: 'stacks', island: 1, at: 30, count: 3 },
      { kind: 'mangroves', island: 0, at: 180, span: 110 },
    ],
  },
  // The Treasure Wreck: the galleon's bones on the reef in the middle of the field, more on the bank, salvors
  // camped on the cay.
  wreck: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 1.1, cliffs: 0.3, at: 60 }],
    landmarks: [
      { kind: 'wreck', x: 0.5, y: 0.44 },
      { kind: 'wreck', x: 0.53, y: 0.3 },
      { kind: 'wreck', island: 0, at: -40, d: 0.78 },
      { kind: 'town', island: 0, at: 20, d: 0.35, houses: 3, look: 'shanty', name: 'the salvors’ camp' },
      { kind: 'skull', island: 1, at: 90, d: 0.38 },
    ],
  },
  // Calico Kate's lair: a volcano on the western island, her town to sack on the eastern, Skull Rock over the alley.
  kate: {
    relief: [{ island: 0, height: 1.2 }, { island: 1, height: 1.0, cliffs: 0.3, at: 0 }, { island: 2, height: 0.8 }],
    landmarks: [
      { kind: 'volcano', island: 0, at: 180, d: 0.1, height: 60, size: 0.8 },
      { kind: 'town', island: 1, at: 150, d: 0.42, houses: 6, name: 'Kate’s Landing', loot: 150 },
      { kind: 'skull', island: 1, at: -140, d: 0.55 },
      { kind: 'wreck', island: 2, at: 90, d: 0.78 },
    ],
  },

  // ---------- The Bay of Campeche ----------
  // Mangrove shores and fishing villages in the creeks along the convoy's road; a light on the barrier cay.
  convoy: {
    relief: [{ island: 0, height: 0.6 }, { island: 1, height: 0.7 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.4, inland: 40, houses: 4, name: 'San Román' },
      { kind: 'town', coast: 0, at: 0.72, inland: 40, houses: 3, name: 'Champotón' },
      { kind: 'mangroves', island: 0, at: 0, span: 140 },
      { kind: 'mangroves', island: 3, at: 180, span: 120 },
      { kind: 'stacks', island: 2, at: 0, count: 2 },
      { kind: 'lighthouse', island: 0, at: -90, d: 0.85 },
      { kind: 'wreck', x: 0.8, y: 0.26 },
    ],
  },
  // Port Royal under siege: the English town on the Palisadoes, Fort Charles at its tip, the harbour behind it full
  // of carpenters.
  siege: {
    style: 'port',
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 0.7, cliffs: 0 }, { island: 2, height: 1.1, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', island: 1, at: 184, d: 0.7, houses: 6, team: 'player', name: 'Port Royal' },
      { kind: 'church', island: 1, at: 150, d: 0.3 },
      { kind: 'harbour', island: 0, at: 60, r: 80 },
      { kind: 'town', coast: 0, at: 0.3, inland: 40, houses: 4, team: 'player', name: 'Kingston' },
      { kind: 'windmill', island: 2, at: 180, d: 0.35 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.45 },
    ],
  },
  // The Iron Marquis: fishing villages to sack by the flats, a church and an old temple on the cays.
  hierro: {
    relief: [{ island: 0, height: 0.7 }, { island: 1, height: 0.7 }, { island: 2, height: 0.9 }],
    landmarks: [
      { kind: 'town', island: 0, at: 160, d: 0.45, houses: 4, name: 'Sisal', loot: 90 },
      { kind: 'mangroves', island: 0, at: 30, span: 120 },
      { kind: 'mangroves', island: 1, at: 200, span: 120 },
      { kind: 'church', island: 1, at: 30, d: 0.4 },
      { kind: 'ruin', island: 2, at: 90, d: 0.3 },
      { kind: 'wreck', x: 0.22, y: 0.45 },
    ],
  },

  // ---------- The Last Armada ----------
  // The Mosquito Coast in fog: a lighthouse on Bluefields Point that lifts the fog far round it, mangroves and a
  // village in the cove.
  fog: {
    style: 'golden',
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.9 }, { island: 2, height: 0.7 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.7, inland: 26, sight: 300 },
      { kind: 'town', coast: 0, at: 0.24, inland: 50, houses: 5, look: 'village', name: 'Bluefields' },
      { kind: 'mangroves', island: 0, at: 0, span: 140 },
      { kind: 'mangroves', island: 2, at: 0, span: 160 },
      { kind: 'ruin', island: 1, at: 180, d: 0.3 },
      { kind: 'wreck', x: 0.56, y: 0.76 },
    ],
  },
  // The blockade strait: El Morro on the western cape at the narrows, the city on the eastern shore.
  blockade: {
    relief: [{ island: 0, height: 0.9, cliffs: 0.3, at: -90 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.15, inland: 50 },
      { kind: 'lighthouse', coast: 0, at: 0.08, inland: 26 },
      { kind: 'town', coast: 1, at: 0.3, inland: 54, houses: 9, look: 'city', name: 'La Habana' },
      { kind: 'church', coast: 1, at: 0.55, inland: 52 },
      { kind: 'town', coast: 1, at: 0.82, inland: 54, houses: 5, look: 'city', name: 'Regla' },
      { kind: 'windmill', coast: 0, at: 0.62, inland: 60 },
      { kind: 'ruin', island: 0, at: 0, d: 0.2 },
    ],
  },
  // La Gran Armada: El Morro and its light on the western headland, La Cabaña on the eastern, the harbour city
  // between them.
  armada: {
    relief: [{ island: 0, height: 0.9, cliffs: 0.5, at: -90 }, { island: 1, height: 1.0, cliffs: 0.4, at: -60 }, { island: 2, height: 0.8 }],
    landmarks: [
      { kind: 'lighthouse', island: 0, at: -120, d: 0.76 },
      { kind: 'castle', island: 1, at: 0, d: 0.1 },
      { kind: 'town', coast: 0, at: 0.44, inland: 50, houses: 9, look: 'city', name: 'La Habana' },
      { kind: 'church', coast: 0, at: 0.58, inland: 52 },
      { kind: 'harbour', coast: 0, at: 0.5, rate: 0 },
      { kind: 'town', island: 2, at: 180, d: 0.4, houses: 4, name: 'Cojímar' },
      { kind: 'wreck', x: 0.5, y: 0.7 },
    ],
  },
};
