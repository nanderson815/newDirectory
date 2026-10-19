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
  tutorial: {
    relief: [{ island: 0, height: 1.1 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', island: 0, at: 70, d: 0.4, houses: 4, look: 'english', name: 'Port Royal' },
      { kind: 'harbour', island: 0, at: 15, rate: 0 },
      { kind: 'lighthouse', island: 0, at: -70, d: 0.55 },
      { kind: 'windmill', island: 1, at: 200, d: 0.35 },
      { kind: 'church', island: 1, at: 20, d: 0.42 },
    ],
  },

  // ---------- The Windward Passage ----------
  // Tortuga: buccaneers' cliffs on the cape, a rocky ridge across the narrows.
  tortuga: {
    relief: [{ island: 0, height: 1.3, cliffs: 0.5, at: 180 }, { island: 1, cliffs: 0.6, at: 90 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.47, inland: 34 },
      { kind: 'town', coast: 0, at: 0.24, inland: 60, houses: 6, look: 'shanty', name: 'Cayona' },
      { kind: 'castle', coast: 0, at: 0.62, inland: 60 },
      { kind: 'stacks', island: 0, at: 200, count: 3 },
      { kind: 'stacks', island: 1, at: 130, count: 2 },
      { kind: 'ruin', island: 0, at: 0, d: 0.15 },
    ],
  },
  // The Caymans: low turtle islands, a brig that found the shoals first.
  cayman: {
    relief: [{ island: 0, height: 0.5, cliffs: 0 }, { island: 1, height: 0.6, cliffs: 0.3, at: -60 }],
    landmarks: [
      { kind: 'wreck', x: 0.18, y: 0.63 },
      { kind: 'town', island: 0, at: 120, d: 0.45, houses: 3, look: 'village', name: 'the turtlers’ camp' },
      { kind: 'mangroves', island: 0, at: 300, span: 120 },
      { kind: 'lighthouse', island: 1, at: 150, d: 0.45 },
      { kind: 'stacks', island: 1, at: -40, count: 2 },
    ],
  },
  // La Bruja's lair: a smoking volcano and a sea-stack island. The volcano's lee lies downwind (south-east).
  rojo: {
    relief: [{ island: 0, height: 1.2, cliffs: 0.4, at: 200 }, { island: 1, cliffs: 0.5, at: -30 }],
    landmarks: [
      { kind: 'volcano', island: 0, at: 200, d: 0.12, height: 70 },
      { kind: 'ruin', island: 1, at: 160, d: 0.45 },
      { kind: 'stacks', island: 1, at: -40, count: 4 },
      { kind: 'wreck', island: 0, at: 60, d: 0.8 },
    ],
  },

  // ---------- The Spanish Main ----------
  // San Lucas: a whitewashed town under the fort, a harbour that serves whoever holds it, a mission on the hill.
  sanlucas: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.9 }, { island: 2, height: 1.1, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', island: 0, at: 115, d: 0.66, houses: 6, name: 'San Lucas', loot: 120 },
      { kind: 'harbour', island: 0, at: 50 },
      { kind: 'church', island: 1, at: 200, d: 0.25 },
      { kind: 'windmill', island: 2, at: 160, d: 0.3 },
    ],
  },
  // The silver coast: a mission town in the cove, a lighthouse on the point, a reef that has claimed a galleon.
  silver: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, cliffs: 0.4, at: 200 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.27, inland: 50, houses: 7, name: 'Santa Cruz', loot: 110 },
      { kind: 'church', coast: 0, at: 0.4, inland: 52 },
      { kind: 'lighthouse', coast: 0, at: 0.62, inland: 26 },
      { kind: 'windmill', coast: 0, at: 0.8, inland: 44 },
      { kind: 'wreck', x: 0.52, y: 0.14 },
      { kind: 'ruin', island: 1, at: 0, d: 0.2 },
    ],
  },
  // San Cristóbal: the Comodoro's anchorage between two fort islands.
  comodoro: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.8 }, { island: 2, height: 1.2, cliffs: 0.3, at: 90 }],
    landmarks: [
      { kind: 'town', island: 0, at: 150, d: 0.75, houses: 5, name: 'Santa Fe' },
      { kind: 'town', island: 1, at: 30, d: 0.75, houses: 5, name: 'Santa Inés' },
      { kind: 'harbour', island: 1, at: 100, rate: 0 },
      { kind: 'church', island: 2, at: 0, d: 0.1 },
    ],
  },

  // ---------- The Golden Isles ----------
  // Cartagena: the walled harbour town under Fort San Felipe; jungle and an old temple on the islets.
  cartagena: {
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 1.4 }, { island: 2, height: 1.2 }, { island: 3, height: 1.1 }],
    landmarks: [
      { kind: 'town', island: 0, at: 130, d: 0.69, houses: 6, name: 'Cartagena', loot: 150 },
      { kind: 'church', island: 3, at: 200, d: 0.2 },
      { kind: 'ruin', island: 1, at: 180, d: 0.3 },
      { kind: 'peak', island: 2, at: 0, d: 0.1, height: 60, lee: 2.5 },
      { kind: 'wreck', island: 3, at: 90, d: 0.82 },
    ],
  },
  // Santa Marta: twin towers over a jungle bay; a smoking mountain on the islet between them.
  santamarta: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 0.9 }, { island: 2, height: 1.4 }],
    landmarks: [
      { kind: 'town', island: 0, at: 200, d: 0.72, houses: 5, name: 'Santa Marta' },
      { kind: 'windmill', island: 1, at: 330, d: 0.73 },
      { kind: 'volcano', island: 2, at: 0, d: 0.05, height: 70, size: 0.7, lee: 3 },
    ],
  },
  // The Almirante's golden isles: a temple of gold in the jungle and a mountain whose lee steals the wind.
  oro: {
    relief: [{ island: 0, height: 1.5 }, { island: 1, height: 1.2, cliffs: 0.3, at: -40 }, { island: 2, height: 1.1 }],
    landmarks: [
      { kind: 'peak', island: 0, at: 200, d: 0.15, height: 70 },
      { kind: 'ruin', island: 1, at: 150, d: 0.35 },
      { kind: 'lighthouse', island: 1, at: -60, d: 0.6 },
      { kind: 'ruin', island: 2, at: 0, d: 0.1 },
    ],
  },

  // ---------- The Pirate Coast ----------
  // Smugglers' Cove: a shanty town on stilts round the cove, Skull Rock on the point, a wreck on the reef.
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
  // The Treasure Wreck: the galleon's bones on the beach, pirates camped by them.
  wreck: {
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 1.1 }, { island: 2, height: 1.2, cliffs: 0.3, at: 60 }],
    landmarks: [
      { kind: 'wreck', island: 0, at: -40, d: 0.78 },
      { kind: 'wreck', island: 1, at: 230, d: 0.8 },
      { kind: 'town', island: 1, at: 20, d: 0.45, houses: 3, look: 'shanty', name: 'the salvors’ camp' },
      { kind: 'skull', island: 2, at: 90, d: 0.38 },
    ],
  },
  // Calico Kate's lair: a pirate town to sack and Skull Rock; a volcano's lee off the western isle.
  kate: {
    relief: [{ island: 0, height: 1.2 }, { island: 1, height: 1.0, cliffs: 0.3, at: 0 }, { island: 2, height: 0.8 }],
    landmarks: [
      { kind: 'volcano', island: 0, at: 180, d: 0.15, height: 80 },
      { kind: 'town', island: 1, at: 150, d: 0.42, houses: 6, name: 'Kate’s Landing', loot: 150 },
      { kind: 'skull', island: 1, at: -40, d: 0.55 },
      { kind: 'wreck', island: 2, at: 90, d: 0.78 },
    ],
  },

  // ---------- The Bay of Campeche ----------
  // Low mangrove islands and fishing villages along the convoy's road.
  convoy: {
    relief: [{ island: 0, height: 0.6 }, { island: 1, height: 0.6 }, { island: 2, height: 0.7 }],
    landmarks: [
      { kind: 'town', island: 0, at: 200, d: 0.45, houses: 4, name: 'San Román' },
      { kind: 'mangroves', island: 0, at: 30, span: 140 },
      { kind: 'mangroves', island: 1, at: 200, span: 160 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.4 },
      { kind: 'town', island: 1, at: 20, d: 0.45, houses: 3, name: 'Champotón' },
    ],
  },
  // Port Royal under siege: the English town and Fort Charles, its harbour full of carpenters.
  siege: {
    style: 'port',
    relief: [{ island: 0, height: 0.9 }, { island: 1, height: 1.0 }, { island: 2, height: 1.1, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', island: 0, at: 150, d: 0.66, houses: 6, team: 'player', name: 'Port Royal' },
      { kind: 'church', island: 1, at: 30, d: 0.3 },
      { kind: 'harbour', island: 0, at: -60, r: 80 },
      { kind: 'windmill', island: 2, at: 180, d: 0.35 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.45 },
    ],
  },
  // The Iron Marquis: fishing villages to sack in the shallows of the bay.
  hierro: {
    relief: [{ island: 0, height: 0.7 }, { island: 1, height: 0.7 }, { island: 2, height: 0.9 }],
    landmarks: [
      { kind: 'town', island: 0, at: 160, d: 0.45, houses: 4, name: 'Sisal', loot: 90 },
      { kind: 'mangroves', island: 0, at: 30, span: 120 },
      { kind: 'mangroves', island: 1, at: 200, span: 120 },
      { kind: 'church', island: 1, at: 30, d: 0.4 },
      { kind: 'ruin', island: 2, at: 90, d: 0.3 },
    ],
  },

  // ---------- The Last Armada ----------
  // The Mosquito Coast in fog: a lighthouse that lifts the fog round its point, mangroves and a village.
  fog: {
    style: 'golden',
    relief: [{ island: 0, height: 0.8 }, { island: 1, height: 0.9 }, { island: 2, height: 0.7 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.7, inland: 26, sight: 230 },
      { kind: 'town', coast: 0, at: 0.3, inland: 50, houses: 5, look: 'village', name: 'Bluefields' },
      { kind: 'mangroves', island: 0, at: 0, span: 140 },
      { kind: 'mangroves', island: 2, at: 0, span: 160 },
      { kind: 'ruin', island: 1, at: 180, d: 0.3 },
    ],
  },
  // The blockade strait: El Morro on one shore, the city on the other.
  blockade: {
    relief: [{ island: 0, height: 0.9, cliffs: 0.3, at: -90 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.3, inland: 50 },
      { kind: 'lighthouse', coast: 0, at: 0.16, inland: 26 },
      { kind: 'town', coast: 1, at: 0.35, inland: 54, houses: 9, look: 'city', name: 'La Habana' },
      { kind: 'church', coast: 1, at: 0.6, inland: 52 },
      { kind: 'town', coast: 1, at: 0.82, inland: 54, houses: 5, look: 'city', name: 'Regla' },
      { kind: 'windmill', coast: 0, at: 0.62, inland: 60 },
      { kind: 'ruin', island: 0, at: 0, d: 0.2 },
    ],
  },
  // La Gran Armada: Castillo del Morro over the harbour city.
  armada: {
    relief: [{ island: 0, height: 0.9, cliffs: 0.5, at: -90 }, { island: 1, height: 1.0 }, { island: 2, height: 1.0 }],
    landmarks: [
      { kind: 'lighthouse', island: 0, at: -120, d: 0.76 },
      { kind: 'castle', island: 1, at: 0, d: 0.1 },
      { kind: 'town', island: 2, at: 180, d: 0.4, houses: 4, name: 'La Habana' },
      { kind: 'harbour', island: 2, at: 120, rate: 0 },
    ],
  },
};
