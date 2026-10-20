// The land of each Mediterranean battle (src/config/battles-med.js), merged into LANDS (src/config/lands.js);
// same format as there. Styles: straits, barbary, malta, aegean, candia, dardanelles (src/sim/land.js
// LAND_STYLES); the art pass gives each its own look, and until then the renderer borrows a West Indies one.

export const MED_LANDS = {
  // ---------- The Straits ----------
  // Tangier round its bay, the castle on the hill, the Mole running out to York Castle's rock (its wharf
  // patches your hulls in the pond behind it); Malabata's hill at the east end; Spain a thin far shore.
  tangier: {
    style: 'straits',
    relief: [{ island: 0, height: 0.7, cliffs: 0.5, at: -90 }, { island: 1, height: 0.25, cliffs: 0 }, { island: 2, height: 1.0, cliffs: 0.5, at: -90 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.2, inland: 60, houses: 8, look: 'english', name: 'Tangier', team: 'player' },
      { kind: 'castle', coast: 0, at: 0.1, inland: 90 },
      { kind: 'church', coast: 0, at: 0.32, inland: 70 },
      { kind: 'peak', coast: 0, at: 0.92, inland: 90, height: 55, size: 0.5, lee: 2 },
      { kind: 'lighthouse', island: 1, at: 180, d: 0.8 },
      { kind: 'harbour', island: 1, at: 90, rate: 2.5, stock: 140 },
      { kind: 'town', coast: 1, at: 0.6, inland: 24, houses: 3, look: 'spanish', name: 'Tarifa' },
      { kind: 'windmill', coast: 1, at: 0.3, inland: 20 },
      { kind: 'stacks', island: 2, at: 0, count: 3 },
      { kind: 'windmill', island: 2, at: 180, d: 0.3 },
    ],
  },
  // The Rock standing down from Spain over its bay, Jebel Musa and Ceuta's hill on the African side: each high
  // point casts its lee down the wind across the chase. Europa Point's light on the Rock's tip.
  gibraltar: {
    style: 'straits',
    landmarks: [
      { kind: 'peak', coast: 0, at: 0.66, inland: 130, height: 82, size: 0.6, lee: 5 },
      { kind: 'town', coast: 0, at: 0.6, inland: 50, houses: 5, look: 'spanish', name: 'Gibraltar' },
      { kind: 'castle', coast: 0, at: 0.71, inland: 70 },
      { kind: 'lighthouse', coast: 0, at: 0.66, inland: 22 },
      { kind: 'town', coast: 0, at: 0.36, inland: 50, houses: 4, look: 'spanish', name: 'Algeciras' },
      { kind: 'peak', coast: 1, at: 0.28, inland: 95, height: 62, size: 0.7, lee: 3 },
      { kind: 'town', coast: 1, at: 0.84, inland: 50, houses: 6, look: 'spanish', name: 'Ceuta' },
      { kind: 'church', coast: 1, at: 0.89, inland: 70 },
      { kind: 'windmill', coast: 1, at: 0.5, inland: 50 },
      { kind: 'wreck', x: 0.62, y: 0.51 },
    ],
  },
  // Salé and Rabat facing each other across the river, the Kasbah on its rock at the mouth, a wreck on the bar.
  sale: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.1, cliffs: 0.6, at: 180 }, { island: 1, height: 0.8, cliffs: 0.4, at: 0 }, { island: 2, height: 0.7 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.3, inland: 40, houses: 9, look: 'spanish', name: 'Salé', loot: 150 },
      { kind: 'town', coast: 0, at: 0.58, inland: 40, houses: 6, look: 'spanish', name: 'Rabat' },
      { kind: 'ruin', coast: 0, at: 0.74, inland: 80 },
      { kind: 'lighthouse', coast: 0, at: 0.12, inland: 30 },
      { kind: 'wreck', x: 0.67, y: 0.34 },
      { kind: 'stacks', island: 1, at: 30, count: 3 },
    ],
  },

  // ---------- The Barbary Coast ----------
  // Bougie in the corner of its gulf under Cape Carbon, Roman stones on the islets, a wreck the calm left.
  bougie: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.2, cliffs: 0.5, at: -60 }, { island: 1, height: 0.8 }, { island: 2, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.74, inland: 50, houses: 7, look: 'spanish', name: 'Bougie', loot: 120 },
      { kind: 'castle', coast: 0, at: 0.62, inland: 70 },
      { kind: 'peak', coast: 0, at: 0.3, inland: 80, height: 60, lee: 3 },
      { kind: 'lighthouse', coast: 0, at: 0.3, inland: 20 },
      { kind: 'stacks', island: 0, at: -60, count: 3 },
      { kind: 'ruin', island: 0, at: 120, d: 0.3 },
      { kind: 'windmill', coast: 1, at: 0.3, inland: 50 },
      { kind: 'wreck', island: 1, at: 200, d: 0.85 },
    ],
  },
  // Algiers: the white city climbing to the Kasbah, the Mole out to the Peñón and its lighthouse.
  bagnio: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.7, cliffs: 0.5, at: 0 }, { island: 1, height: 0.2, cliffs: 0 }, { island: 2, height: 0.9 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.54, inland: 60, houses: 10, look: 'city', name: 'Algiers' },
      { kind: 'castle', coast: 0, at: 0.44, inland: 120 },
      { kind: 'harbour', coast: 0, at: 0.6, rate: 0, team: 'enemy' },
      { kind: 'lighthouse', island: 0, at: 0, d: 0.8 },
      { kind: 'windmill', coast: 0, at: 0.76, inland: 60 },
      { kind: 'ruin', island: 2, at: 0, d: 0.2 },
      { kind: 'stacks', island: 2, at: 200, count: 2 },
    ],
  },
  // Tunis across its lake, Carthage's ruins along the shore, La Goletta on its spit.
  goletta: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.3, cliffs: 0 }, { island: 1, height: 0.8, cliffs: 0.3 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.48, inland: 40, houses: 9, look: 'city', name: 'Tunis' },
      { kind: 'ruin', coast: 0, at: 0.94, inland: 50 },
      { kind: 'town', island: 0, at: 90, d: 0, houses: 4, look: 'village', name: 'La Goletta', loot: 120 },
      { kind: 'harbour', island: 0, at: 90, rate: 0, team: 'enemy' },
      { kind: 'wreck', x: 0.17, y: 0.66 },
    ],
  },
  // The admiral's harbour in the corner; the chain of islets down the sea, the big one high enough to cast a lee.
  algiers: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.0, cliffs: 0.4, at: -90 }, { island: 1, height: 0.7 }, { island: 2, height: 1.2, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', coast: 1, at: 0.3, inland: 50, houses: 9, look: 'city', name: 'Algiers' },
      { kind: 'castle', coast: 1, at: 0.44, inland: 60 },
      { kind: 'lighthouse', coast: 0, at: 0.16, inland: 26 },
      { kind: 'windmill', coast: 0, at: 0.5, inland: 50 },
      { kind: 'peak', island: 2, at: -90, d: 0.35, height: 55, size: 0.6, lee: 2.5 },
      { kind: 'ruin', island: 0, at: 90, d: 0.4 },
      { kind: 'stacks', island: 1, at: 180, count: 3 },
      { kind: 'wreck', x: 0.62, y: 0.57 },
    ],
  },

  // ---------- Malta and Sicily ----------
  // Valletta on its ridge and Birgu on its finger round the Grand Harbour, whose dockyard on Senglea patches
  // your hulls; Gozo and Comino across the channel.
  knights: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.5, at: -90 }, { island: 1, height: 1.0, cliffs: 0.5, at: -90 }, { island: 2, height: 0.6, cliffs: 0.6 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.34, inland: 50, houses: 10, look: 'city', name: 'Valletta', team: 'player' },
      { kind: 'town', coast: 0, at: 0.78, inland: 40, houses: 7, look: 'city', name: 'Birgu', team: 'player' },
      { kind: 'harbour', coast: 0, at: 0.68, rate: 3, stock: 180 },
      { kind: 'church', coast: 0, at: 0.08, inland: 60 },
      { kind: 'castle', coast: 0, at: 0.9, inland: 60 },
      { kind: 'windmill', coast: 0, at: 0.97, inland: 60 },
      { kind: 'town', island: 1, at: 200, d: 0.4, houses: 4, look: 'village', name: 'Rabat' },
      { kind: 'ruin', island: 1, at: -30, d: 0.45 },
      { kind: 'stacks', island: 2, at: 0, count: 2 },
    ],
  },
  // The Sicilian shore under a smoking Etna, Cape Passero's rocky finger and its islet with the light.
  passero: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.6, at: 180 }, { island: 1, height: 0.7 }],
    landmarks: [
      { kind: 'volcano', coast: 0, at: 0.1, inland: 95, height: 72, lee: 0 },
      { kind: 'town', coast: 0, at: 0.62, inland: 50, houses: 6, look: 'village', name: 'Portopalo' },
      { kind: 'windmill', coast: 0, at: 0.3, inland: 50 },
      { kind: 'stacks', coast: 0, at: 0.5, count: 3 },
      { kind: 'lighthouse', island: 0, at: 180, d: 0.3 },
      { kind: 'ruin', island: 1, at: 0, d: 0.3 },
      { kind: 'wreck', x: 0.25, y: 0.5 },
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
    relief: [{ island: 0, height: 1.3, cliffs: 0.4, at: 180 }, { island: 1, height: 0.9 }, { island: 2, height: 0.7, cliffs: 0.5 }],
    landmarks: [
      { kind: 'town', island: 1, at: 200, d: 0.5, houses: 7, look: 'village', name: 'Zante', team: 'player' },
      { kind: 'windmill', island: 1, at: 20, d: 0.5 },
      { kind: 'peak', island: 0, at: 0, d: 0, height: 72, size: 0.6, lee: 3 },
      { kind: 'ruin', coast: 0, at: 0.62, inland: 60 },
      { kind: 'town', coast: 0, at: 0.16, inland: 50, houses: 4, look: 'village', name: 'Glarentza' },
      { kind: 'castle', coast: 0, at: 0.24, inland: 60 },
      { kind: 'lighthouse', island: 2, at: 0, d: 0.2 },
    ],
  },
  // Navarino: the new castle over the town on the south headland, the old one on Pylos over the north
  // channel, Sphacteria's long cliffs across the bay.
  navarino: {
    style: 'aegean',
    relief: [{ island: 0, height: 1.0, cliffs: 0.6, at: 90 }, { island: 1, height: 0.8 }, { island: 2, height: 0.5 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.95, inland: 60 },
      { kind: 'town', coast: 0, at: 0.86, inland: 40, houses: 6, look: 'village', name: 'Navarino' },
      { kind: 'castle', coast: 0, at: 0.06, inland: 60 },
      { kind: 'windmill', coast: 0, at: 0.5, inland: 40 },
      { kind: 'ruin', island: 0, at: -90, d: 0 },
      { kind: 'stacks', island: 0, at: 90, count: 3 },
      { kind: 'lighthouse', island: 1, at: 0, d: 0.3 },
    ],
  },

  // ---------- Candia ----------
  // The ruined city behind its walls, the Venetian harbour in their face (its carpenters patch your hulls) with
  // the Koules fort at its mouth, the Sultan's siege lines along the shore either side.
  candia: {
    style: 'candia',
    relief: [{ island: 0, height: 0.7, cliffs: 0.6, at: 0 }, { island: 1, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.52, inland: 70, houses: 10, look: 'city', name: 'Candia', team: 'player' },
      { kind: 'harbour', coast: 0, at: 0.45, rate: 3, stock: 200 },
      { kind: 'castle', coast: 0, at: 0.41, inland: 30 },
      { kind: 'church', coast: 0, at: 0.56, inland: 120 },
      { kind: 'ruin', coast: 0, at: 0.2, inland: 40 },
      { kind: 'ruin', coast: 0, at: 0.82, inland: 40 },
      { kind: 'stacks', island: 1, at: 200, count: 2 },
    ],
  },
  // Night off Dia: the Venetian lantern on the Cretan shore lights the water; Dia's peak and old stones, and
  // the rocks of the islets all round.
  dia: {
    style: 'candia',
    relief: [{ island: 0, height: 1.1, cliffs: 0.5, at: -90 }, { island: 1, height: 0.7 }, { island: 2, height: 0.7, cliffs: 0.5 }, { island: 4, height: 0.8 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.3, inland: 26, sight: 270 },
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 6, look: 'city', name: 'Candia', team: 'player' },
      { kind: 'peak', island: 0, at: 180, d: 0.55, height: 50, size: 0.4, lee: 2 },
      { kind: 'ruin', island: 0, at: 10, d: 0.6 },
      { kind: 'stacks', island: 2, at: 0, count: 3 },
      { kind: 'stacks', island: 4, at: 90, count: 2 },
      { kind: 'wreck', x: 0.27, y: 0.265 },
    ],
  },

  // ---------- The Dardanelles ----------
  // The castles of the Narrows on the tips of their points; Maydos and Çanakkale; Troy's stones on the Asian shore.
  narrows: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 0.8, cliffs: 0.4 }, { island: 1, height: 0.8, cliffs: 0.4 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.66, inland: 70 },
      { kind: 'castle', coast: 1, at: 0.34, inland: 70 },
      { kind: 'town', coast: 1, at: 0.24, inland: 70, houses: 8, look: 'city', name: 'Çanakkale' },
      { kind: 'town', coast: 0, at: 0.8, inland: 60, houses: 5, look: 'village', name: 'Maydos' },
      { kind: 'windmill', coast: 0, at: 0.4, inland: 50 },
      { kind: 'ruin', coast: 1, at: 0.62, inland: 70 },
      { kind: 'lighthouse', coast: 1, at: 0.9, inland: 26 },
    ],
  },
  // Tenedos with its castle and windmills, Troy behind Besika Bay, Kum Kale's light at the mouth of the strait.
  kapudan: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 1.0, cliffs: 0.4, at: 180 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', island: 0, at: 60, d: 0.45, houses: 6, look: 'village', name: 'Tenedos' },
      { kind: 'castle', island: 0, at: -20, d: 0.5 },
      { kind: 'windmill', island: 0, at: 220, d: 0.55 },
      { kind: 'ruin', coast: 0, at: 0.56, inland: 70 },
      { kind: 'lighthouse', coast: 0, at: 0.08, inland: 26 },
      { kind: 'stacks', island: 1, at: 90, count: 3 },
      { kind: 'wreck', x: 0.3, y: 0.68 },
    ],
  },
};
