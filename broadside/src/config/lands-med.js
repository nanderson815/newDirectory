// The land of each Mediterranean battle (src/config/battles-med.js), merged into LANDS (src/config/lands.js);
// same format as there. Styles: straits, barbary, malta, aegean, candia, dardanelles (src/sim/land.js
// LAND_STYLES); the art pass gives each its own look, and until then the renderer borrows a West Indies one.

export const MED_LANDS = {
  // ---------- The Straits ----------
  // Tangier behind its new mole, the castle on the hill; Spain a thin far shore across the Straits.
  tangier: {
    style: 'straits',
    relief: [{ island: 0, height: 0.4, cliffs: 0 }, { island: 1, height: 1.0, cliffs: 0.5, at: -90 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.62, inland: 70, houses: 8, look: 'english', name: 'Tangier', team: 'player' },
      { kind: 'castle', coast: 0, at: 0.3, inland: 70 },
      { kind: 'church', coast: 0, at: 0.8, inland: 60 },
      { kind: 'lighthouse', island: 0, at: -25, d: 0.75 },
      { kind: 'harbour', island: 0, at: 150, rate: 2.5, stock: 140 },
      { kind: 'town', coast: 1, at: 0.6, inland: 24, houses: 3, look: 'spanish', name: 'Tarifa' },
      { kind: 'windmill', coast: 1, at: 0.3, inland: 20 },
      { kind: 'stacks', island: 1, at: 0, count: 3 },
      { kind: 'windmill', island: 1, at: 180, d: 0.3 },
    ],
  },
  // The Rock over the European shore and Jebel Musa over the African: each casts its lee across the chase.
  gibraltar: {
    style: 'straits',
    landmarks: [
      { kind: 'peak', coast: 0, at: 0.38, inland: 95, height: 78, size: 0.8, lee: 5 },
      { kind: 'town', coast: 0, at: 0.52, inland: 60, houses: 5, look: 'spanish', name: 'Gibraltar' },
      { kind: 'castle', coast: 0, at: 0.24, inland: 60 },
      { kind: 'lighthouse', coast: 0, at: 0.45, inland: 26 },
      { kind: 'peak', coast: 1, at: 0.62, inland: 85, height: 62, size: 0.7, lee: 3 },
      { kind: 'town', coast: 1, at: 0.78, inland: 60, houses: 6, look: 'spanish', name: 'Ceuta' },
      { kind: 'church', coast: 1, at: 0.88, inland: 60 },
      { kind: 'windmill', coast: 1, at: 0.3, inland: 50 },
      { kind: 'wreck', x: 0.5, y: 0.7 },
    ],
  },
  // Salé and Rabat facing each other across the river mouth, the Kasbah on its rock, a wreck on the bar.
  sale: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.1, cliffs: 0.6, at: 90 }, { island: 1, height: 0.8, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 9, look: 'spanish', name: 'Salé', loot: 150 },
      { kind: 'town', coast: 0, at: 0.36, inland: 40, houses: 6, look: 'spanish', name: 'Rabat' },
      { kind: 'ruin', coast: 0, at: 0.82, inland: 80 },
      { kind: 'lighthouse', coast: 0, at: 0.08, inland: 30 },
      { kind: 'wreck', x: 0.5, y: 0.34 },
      { kind: 'stacks', island: 1, at: 30, count: 3 },
    ],
  },

  // ---------- The Barbary Coast ----------
  // Bougie under Cape Carbon, Roman stones on the islets, a wreck the calm left on the rocks.
  bougie: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.2, cliffs: 0.5, at: -60 }, { island: 1, height: 0.8 }, { island: 2, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.55, inland: 50, houses: 7, look: 'spanish', name: 'Bougie', loot: 120 },
      { kind: 'castle', coast: 0, at: 0.7, inland: 70 },
      { kind: 'peak', coast: 0, at: 0.88, inland: 70, height: 60, lee: 3 },
      { kind: 'stacks', island: 0, at: -60, count: 3 },
      { kind: 'ruin', island: 0, at: 120, d: 0.3 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.4 },
      { kind: 'wreck', island: 1, at: 200, d: 0.85 },
    ],
  },
  // Algiers: the white city climbing to the Kasbah, its harbour behind the Mole Battery.
  bagnio: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.7, cliffs: 0.5, at: 180 }, { island: 1, height: 0.9 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.52, inland: 60, houses: 10, look: 'city', name: 'Algiers' },
      { kind: 'castle', coast: 0, at: 0.4, inland: 110 },
      { kind: 'harbour', coast: 0, at: 0.6, rate: 0, team: 'enemy' },
      { kind: 'lighthouse', coast: 0, at: 0.2, inland: 26 },
      { kind: 'windmill', coast: 0, at: 0.74, inland: 60 },
      { kind: 'ruin', island: 1, at: 0, d: 0.2 },
      { kind: 'stacks', island: 1, at: 200, count: 2 },
    ],
  },
  // Tunis across the lagoon, Carthage's ruins on the point, La Goletta on its spit.
  goletta: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.4, cliffs: 0 }, { island: 1, height: 0.8, cliffs: 0.3 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.45, inland: 40, houses: 9, look: 'city', name: 'Tunis' },
      { kind: 'ruin', coast: 0, at: 0.86, inland: 50 },
      { kind: 'town', island: 0, at: -90, d: 0, houses: 4, look: 'village', name: 'La Goletta', loot: 120 },
      { kind: 'harbour', island: 0, at: -90, rate: 0, team: 'enemy' },
      { kind: 'wreck', x: 0.58, y: 0.36 },
    ],
  },
  // The admiral's harbour at the top of the chart; a high island whose lee shelters the channel's south end.
  algiers: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.2, cliffs: 0.4, at: 0 }, { island: 1, height: 0.9 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.16, inland: 50, houses: 9, look: 'city', name: 'Algiers' },
      { kind: 'castle', coast: 0, at: 0.32, inland: 60 },
      { kind: 'lighthouse', coast: 0, at: 0.04, inland: 26 },
      { kind: 'windmill', coast: 0, at: 0.6, inland: 50 },
      { kind: 'peak', island: 0, at: -90, d: 0.35, height: 55, size: 0.6, lee: 2.5 },
      { kind: 'ruin', island: 0, at: 90, d: 0.4 },
      { kind: 'stacks', island: 1, at: 180, count: 3 },
    ],
  },

  // ---------- Malta and Sicily ----------
  // Valletta and Birgu round the Grand Harbour, whose dockyard patches your hulls; Gozo and Comino to the north.
  knights: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.5, at: -90 }, { island: 1, height: 1.0, cliffs: 0.5, at: -90 }, { island: 2, height: 0.6, cliffs: 0.6 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.38, inland: 60, houses: 10, look: 'city', name: 'Valletta', team: 'player' },
      { kind: 'town', coast: 0, at: 0.64, inland: 60, houses: 7, look: 'city', name: 'Birgu', team: 'player' },
      { kind: 'harbour', coast: 0, at: 0.5, rate: 3, stock: 180 },
      { kind: 'church', coast: 0, at: 0.2, inland: 60 },
      { kind: 'castle', coast: 0, at: 0.78, inland: 60 },
      { kind: 'windmill', coast: 0, at: 0.9, inland: 60 },
      { kind: 'town', island: 1, at: 200, d: 0.4, houses: 4, look: 'village', name: 'Rabat' },
      { kind: 'ruin', island: 1, at: -30, d: 0.45 },
      { kind: 'stacks', island: 2, at: 0, count: 2 },
    ],
  },
  // The Sicilian shore under a smoking Etna, Cape Passero's islet with its light, a wreck on the reef.
  passero: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.6, at: 0 }, { island: 1, height: 0.7 }],
    landmarks: [
      { kind: 'volcano', coast: 0, at: 0.12, inland: 95, height: 72, lee: 0 },
      { kind: 'town', coast: 0, at: 0.36, inland: 50, houses: 6, look: 'village', name: 'Portopalo' },
      { kind: 'windmill', coast: 0, at: 0.82, inland: 50 },
      { kind: 'stacks', coast: 0, at: 0.62, count: 3 },
      { kind: 'lighthouse', island: 0, at: 90, d: 0.3 },
      { kind: 'ruin', island: 1, at: 0, d: 0.3 },
      { kind: 'wreck', x: 0.3, y: 0.46 },
    ],
  },
  // Tripoli behind its reefs, the Red Castle on the shore, two wrecks that found the reefs first.
  tripoli: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.0, cliffs: 0.5, at: 90 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.5, inland: 40, houses: 10, look: 'city', name: 'Tripoli', loot: 160 },
      { kind: 'castle', coast: 0, at: 0.36, inland: 60 },
      { kind: 'lighthouse', coast: 0, at: 0.82, inland: 30 },
      { kind: 'ruin', coast: 0, at: 0.66, inland: 80 },
      { kind: 'wreck', x: 0.14, y: 0.42 },
      { kind: 'wreck', x: 0.79, y: 0.53 },
      { kind: 'stacks', island: 1, at: 60, count: 3 },
    ],
  },

  // ---------- The Morea ----------
  // Zante's white town and windmills, Cephalonia's mountain (its lee shelters the corsairs behind it).
  zante: {
    style: 'aegean',
    relief: [{ island: 0, height: 1.3, cliffs: 0.4, at: 0 }, { island: 1, height: 0.9 }, { island: 2, height: 0.7, cliffs: 0.5 }],
    landmarks: [
      { kind: 'town', island: 1, at: 180, d: 0.5, houses: 7, look: 'village', name: 'Zante', team: 'player' },
      { kind: 'windmill', island: 1, at: 20, d: 0.5 },
      { kind: 'peak', island: 0, at: 0, d: 0, height: 72, size: 0.6, lee: 3 },
      { kind: 'ruin', coast: 0, at: 0.5, inland: 60 },
      { kind: 'town', coast: 0, at: 0.86, inland: 50, houses: 4, look: 'village', name: 'Glarentza' },
      { kind: 'castle', coast: 0, at: 0.14, inland: 60 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.2 },
    ],
  },
  // Navarino: the new castle over the town, the old one over the north channel, Sphacteria's cliffs.
  navarino: {
    style: 'aegean',
    relief: [{ island: 0, height: 1.0, cliffs: 0.6, at: 90 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.8, inland: 60 },
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 6, look: 'village', name: 'Navarino' },
      { kind: 'castle', coast: 0, at: 0.1, inland: 50 },
      { kind: 'windmill', coast: 0, at: 0.42, inland: 40 },
      { kind: 'ruin', island: 0, at: -90, d: 0 },
      { kind: 'stacks', island: 0, at: 180, count: 3 },
      { kind: 'lighthouse', island: 1, at: 0, d: 0.3 },
    ],
  },

  // ---------- Candia ----------
  // The ruined city behind its walls, the Venetian harbour (its carpenters patch your hulls), the Koules fort.
  candia: {
    style: 'candia',
    relief: [{ island: 0, height: 0.7, cliffs: 0.6, at: -90 }, { island: 1, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.44, inland: 60, houses: 10, look: 'city', name: 'Candia', team: 'player' },
      { kind: 'harbour', coast: 0, at: 0.64, rate: 3, stock: 200 },
      { kind: 'castle', coast: 0, at: 0.78, inland: 60 },
      { kind: 'church', coast: 0, at: 0.9, inland: 60 },
      { kind: 'ruin', island: 1, at: 0, d: 0.2 },
      { kind: 'stacks', island: 1, at: 200, count: 2 },
    ],
  },
  // Night off Dia: the Venetian lantern on the Cretan shore lights the water; Dia's peak and old stones.
  dia: {
    style: 'candia',
    relief: [{ island: 0, height: 1.1, cliffs: 0.5, at: -90 }, { island: 1, height: 0.7 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.3, inland: 26, sight: 270 },
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 6, look: 'city', name: 'Candia', team: 'player' },
      { kind: 'peak', island: 0, at: 180, d: 0.55, height: 50, size: 0.4, lee: 2 },
      { kind: 'ruin', island: 0, at: 10, d: 0.6 },
      { kind: 'stacks', island: 1, at: 0, count: 3 },
      { kind: 'wreck', x: 0.16, y: 0.42 },
    ],
  },

  // ---------- The Dardanelles ----------
  // The castles of the Narrows face each other over the strait; Troy's stones on the Asian shore.
  narrows: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 0.8, cliffs: 0.4 }, { island: 1, height: 0.8, cliffs: 0.4 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.36, inland: 70 },
      { kind: 'castle', coast: 1, at: 0.64, inland: 70 },
      { kind: 'town', coast: 1, at: 0.74, inland: 70, houses: 8, look: 'city', name: 'Çanakkale' },
      { kind: 'town', coast: 0, at: 0.24, inland: 60, houses: 5, look: 'village', name: 'Maydos' },
      { kind: 'windmill', coast: 0, at: 0.72, inland: 50 },
      { kind: 'ruin', coast: 1, at: 0.9, inland: 70 },
      { kind: 'lighthouse', coast: 1, at: 0.14, inland: 26 },
    ],
  },
  // Tenedos with its castle and windmills, Troy on the Asian shore, a wreck on the reef.
  kapudan: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 1.0, cliffs: 0.4, at: 180 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', island: 0, at: 120, d: 0.45, houses: 6, look: 'village', name: 'Tenedos' },
      { kind: 'castle', island: 0, at: -40, d: 0.35 },
      { kind: 'windmill', island: 0, at: 220, d: 0.55 },
      { kind: 'ruin', coast: 0, at: 0.6, inland: 70 },
      { kind: 'lighthouse', coast: 0, at: 0.32, inland: 26 },
      { kind: 'stacks', island: 1, at: 90, count: 3 },
      { kind: 'wreck', x: 0.24, y: 0.66 },
    ],
  },
};
