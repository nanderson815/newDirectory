// The land of each Mediterranean battle (src/config/battles-med.js), merged into LANDS (src/config/lands.js);
// same format as there. Styles: straits, barbary, malta, aegean, candia, dardanelles (src/sim/land.js
// LAND_STYLES), each drawn in its own manner (render/land.js STYLES): Gibraltar's pale rock and scrub, the ochre
// Barbary hills under date palms, Malta's honey limestone and small fields, the Morea's olives and cypresses,
// Candia under its walls and the Turkish lines, the green hills of the Dardanelles.
//
// Towns take the region's look unless they say otherwise: a Barbary kasbah of whitewashed cubes, Malta's honey
// stone, white Greek houses, Candia's Venetian stucco, Turkish timber houses (src/sim/land.js TOWN_LOOKS); the
// English at Tangier and the Spanish across the Straits keep their own. The Med's own landmarks: mosque, kasbah,
// walls (a bastioned front), chapel, cypresses and siegeworks; windmills, lights, churches, castles and ruins
// build in the Med's manner here (white windmills, stone lanterns, classical ruins).

export const MED_LANDS = {
  // ---------- The Straits ----------
  // English Tangier on its headland, the castle on the hill, the Mole running out to York Castle's rock (its
  // wharf patches your hulls in the pond behind it); Malabata's hill at the east end; Spain a thin far shore.
  tangier: {
    style: 'straits',
    relief: [{ island: 0, height: 0.7, cliffs: 0.5, at: -90 }, { island: 1, height: 0.25, cliffs: 0 }, { island: 2, height: 1.0, cliffs: 0.5, at: -90 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.14, inland: 60, houses: 8, look: 'english', name: 'Tangier', team: 'player' },
      { kind: 'castle', coast: 0, at: 0.08, inland: 110, flag: 'english' },
      { kind: 'church', coast: 0, at: 0.2, inland: 90 },
      { kind: 'mosque', coast: 0, at: 0.44, inland: 46, look: 'maghrebi' },
      { kind: 'peak', coast: 0, at: 0.93, inland: 90, height: 55, size: 0.5, lee: 2 },
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
      { kind: 'cypresses', coast: 0, at: 0.5, inland: 40, count: 4 },
      { kind: 'peak', coast: 1, at: 0.28, inland: 95, height: 62, size: 0.7, lee: 3 },
      { kind: 'town', coast: 1, at: 0.84, inland: 50, houses: 6, look: 'spanish', name: 'Ceuta' },
      { kind: 'church', coast: 1, at: 0.89, inland: 70 },
      { kind: 'windmill', coast: 1, at: 0.5, inland: 50 },
      { kind: 'wreck', x: 0.62, y: 0.51 },
    ],
  },
  // Salé and Rabat facing each other across the river, the Kasbah of the Udayas on its rock at the mouth, the
  // Roman stones of Sala up the river, a wreck on the bar.
  sale: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.1, cliffs: 0.6, at: 180 }, { island: 1, height: 0.8, cliffs: 0.4, at: 0 }, { island: 2, height: 0.7 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.3, inland: 40, houses: 9, name: 'Salé', loot: 150 },
      { kind: 'town', coast: 0, at: 0.58, inland: 44, houses: 6, name: 'Rabat' },
      { kind: 'kasbah', coast: 0, at: 0.66, inland: 34 },
      { kind: 'mosque', coast: 0, at: 0.2, inland: 70 },
      { kind: 'ruin', coast: 0, at: 0.76, inland: 80 },
      { kind: 'lighthouse', coast: 0, at: 0.1, inland: 30 },
      { kind: 'wreck', x: 0.67, y: 0.34 },
      { kind: 'stacks', island: 1, at: 30, count: 3 },
    ],
  },

  // ---------- The Barbary Coast ----------
  // Bougie in the corner of its gulf under Cape Carbon, its kasbah over the white town, Roman stones on the
  // islet, a wreck the calm left on the rocks.
  bougie: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.2, cliffs: 0.5, at: -60 }, { island: 1, height: 0.8 }, { island: 2, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.74, inland: 50, houses: 7, name: 'Bougie', loot: 120 },
      { kind: 'kasbah', coast: 0, at: 0.62, inland: 70 },
      { kind: 'mosque', coast: 1, at: 0.66, inland: 46 },
      { kind: 'peak', coast: 0, at: 0.3, inland: 80, height: 60, lee: 3 },
      { kind: 'lighthouse', coast: 0, at: 0.3, inland: 20 },
      { kind: 'stacks', island: 0, at: -60, count: 3 },
      { kind: 'ruin', island: 0, at: 120, d: 0.3 },
      { kind: 'wreck', island: 1, at: 200, d: 0.85 },
    ],
  },
  // Algiers: the white city climbing to the Kasbah, the Mole out to the Peñón and its lighthouse.
  bagnio: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.7, cliffs: 0.5, at: 0 }, { island: 1, height: 0.2, cliffs: 0 }, { island: 2, height: 0.9 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.54, inland: 60, houses: 10, name: 'Algiers' },
      { kind: 'kasbah', coast: 0, at: 0.44, inland: 112 },
      { kind: 'harbour', coast: 0, at: 0.6, rate: 0, team: 'enemy' },
      { kind: 'mosque', coast: 0, at: 0.66, inland: 50 },
      { kind: 'lighthouse', island: 0, at: 0, d: 0.8 },
      { kind: 'cypresses', coast: 0, at: 0.76, inland: 70, count: 4 },
      { kind: 'ruin', island: 2, at: 0, d: 0.2 },
      { kind: 'stacks', island: 2, at: 200, count: 2 },
    ],
  },
  // Tunis across its lake, Carthage's columns along the shore, the fortress of La Goletta on its spit.
  goletta: {
    style: 'barbary',
    relief: [{ island: 0, height: 0.3, cliffs: 0 }, { island: 1, height: 0.8, cliffs: 0.3 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.48, inland: 40, houses: 9, name: 'Tunis' },
      { kind: 'mosque', coast: 0, at: 0.34, inland: 50 },
      { kind: 'ruin', coast: 0, at: 0.94, inland: 50 },
      { kind: 'town', island: 0, at: 90, d: 0, houses: 4, look: 'kasbah', name: 'La Goletta', loot: 120 },
      { kind: 'harbour', island: 0, at: 90, rate: 0, team: 'enemy' },
      { kind: 'wreck', x: 0.17, y: 0.66 },
    ],
  },
  // The admiral's harbour in the corner; the chain of islets down the sea, the big one high enough to cast a lee.
  algiers: {
    style: 'barbary',
    relief: [{ island: 0, height: 1.0, cliffs: 0.4, at: -90 }, { island: 1, height: 0.7 }, { island: 2, height: 1.2, cliffs: 0.4, at: 0 }],
    landmarks: [
      { kind: 'town', coast: 1, at: 0.3, inland: 50, houses: 9, name: 'Algiers' },
      { kind: 'kasbah', coast: 1, at: 0.44, inland: 64 },
      { kind: 'lighthouse', coast: 0, at: 0.16, inland: 26 },
      { kind: 'mosque', coast: 0, at: 0.5, inland: 50 },
      { kind: 'peak', island: 2, at: -90, d: 0.35, height: 55, size: 0.6, lee: 2.5 },
      { kind: 'ruin', island: 0, at: 90, d: 0.4 },
      { kind: 'stacks', island: 1, at: 180, count: 3 },
      { kind: 'wreck', x: 0.59, y: 0.57 },
    ],
  },

  // ---------- Malta and Sicily ----------
  // Valletta behind its bastions on the ridge between the two harbours and Birgu on its finger across the Grand
  // Harbour, whose dockyard on Senglea patches your hulls; the Knights' domed church; Gozo and Comino to the north.
  knights: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.5, at: -90 }, { island: 1, height: 1.0, cliffs: 0.5, at: -90 }, { island: 2, height: 0.6, cliffs: 0.6 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.34, inland: 70, houses: 10, name: 'Valletta', team: 'player' },
      { kind: 'walls', coast: 0, at: 0.34, inland: 28, length: 60 },
      { kind: 'town', coast: 0, at: 0.78, inland: 40, houses: 7, name: 'Birgu', team: 'player' },
      { kind: 'harbour', coast: 0, at: 0.68, rate: 3, stock: 180 },
      { kind: 'church', coast: 0, at: 0.08, inland: 64 },
      { kind: 'castle', coast: 0, at: 0.9, inland: 60 },
      { kind: 'windmill', coast: 0, at: 0.97, inland: 60 },
      { kind: 'town', island: 1, at: 200, d: 0.4, houses: 4, name: 'Rabat' },
      { kind: 'ruin', island: 1, at: -30, d: 0.45 },
      { kind: 'stacks', island: 2, at: 0, count: 2 },
    ],
  },
  // The Sicilian shore under a smoking Etna, Cape Passero's rocky finger and its islet with the light, a wreck
  // on the reef beyond.
  passero: {
    style: 'malta',
    relief: [{ island: 0, height: 0.8, cliffs: 0.6, at: 180 }, { island: 1, height: 0.7 }],
    landmarks: [
      { kind: 'volcano', coast: 0, at: 0.1, inland: 95, height: 72, lee: 0 },
      { kind: 'town', coast: 0, at: 0.62, inland: 50, houses: 6, name: 'Portopalo' },
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
      { kind: 'town', coast: 0, at: 0.5, inland: 40, houses: 10, name: 'Tripoli', loot: 160 },
      { kind: 'castle', coast: 0, at: 0.36, inland: 60, flag: 'tripoli' },
      { kind: 'mosque', coast: 0, at: 0.63, inland: 48 },
      { kind: 'lighthouse', coast: 0, at: 0.82, inland: 30 },
      { kind: 'ruin', coast: 0, at: 0.74, inland: 80 },
      { kind: 'wreck', x: 0.14, y: 0.42 },
      { kind: 'wreck', x: 0.79, y: 0.53 },
      { kind: 'stacks', island: 1, at: 60, count: 3 },
    ],
  },

  // ---------- The Morea ----------
  // Zante's white town and windmills under the Venetian flag, a chapel on the point, Cephalonia's mountain (its
  // lee shelters the corsairs behind it), the Morea's olive shore.
  zante: {
    style: 'aegean',
    relief: [{ island: 0, height: 1.3, cliffs: 0.4, at: 180 }, { island: 1, height: 0.9 }, { island: 2, height: 0.7, cliffs: 0.5 }],
    landmarks: [
      { kind: 'town', island: 1, at: 200, d: 0.5, houses: 7, name: 'Zante', team: 'player' },
      { kind: 'windmill', island: 1, at: 20, d: 0.5 },
      { kind: 'chapel', island: 1, at: 100, d: 0.55 },
      { kind: 'peak', island: 0, at: 0, d: 0, height: 72, size: 0.6, lee: 3 },
      { kind: 'ruin', coast: 0, at: 0.62, inland: 60 },
      { kind: 'town', coast: 0, at: 0.16, inland: 50, houses: 4, name: 'Glarentza' },
      { kind: 'castle', coast: 0, at: 0.24, inland: 60 },
      { kind: 'cypresses', coast: 0, at: 0.76, inland: 44, count: 5 },
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
      { kind: 'town', coast: 0, at: 0.86, inland: 40, houses: 6, name: 'Navarino' },
      { kind: 'mosque', coast: 0, at: 0.76, inland: 64, look: 'ottoman' },
      { kind: 'castle', coast: 0, at: 0.06, inland: 60 },
      { kind: 'windmill', coast: 0, at: 0.5, inland: 40 },
      { kind: 'chapel', coast: 0, at: 0.3, inland: 50 },
      { kind: 'ruin', island: 0, at: -90, d: 0 },
      { kind: 'stacks', island: 0, at: 90, count: 3 },
      { kind: 'lighthouse', island: 1, at: 0, d: 0.3 },
    ],
  },

  // ---------- Candia ----------
  // The battered city on its bastioned block (the walls face the Turkish lines inland), the harbour in their
  // face (its carpenters patch your hulls) with the Koules fort at its mouth, the Ottoman trenches beyond and the
  // siege lines along the shore either side.
  candia: {
    style: 'candia',
    relief: [{ island: 0, height: 0.7, cliffs: 0.6, at: 0 }, { island: 1, height: 0.9, cliffs: 0.4 }],
    landmarks: [
      { kind: 'town', coast: 0, at: 0.53, inland: 70, houses: 10, name: 'Candia', team: 'player' },
      { kind: 'walls', coast: 0, at: 0.5, inland: 230, length: 150, landward: 1, flag: 'venice' },
      { kind: 'siegeworks', coast: 0, at: 0.5, inland: 300 },
      { kind: 'harbour', coast: 0, at: 0.45, rate: 3, stock: 200 },
      { kind: 'castle', coast: 0, at: 0.41, inland: 30, flag: 'venice' },
      { kind: 'church', coast: 0, at: 0.57, inland: 130 },
      { kind: 'cypresses', coast: 0, at: 0.2, inland: 60, count: 5 },
      { kind: 'ruin', coast: 0, at: 0.82, inland: 40 },
      { kind: 'stacks', island: 1, at: 200, count: 2 },
    ],
  },
  // Night off Dia: the Venetian lantern on the Cretan shore lights the water; Dia's peak, old stones and chapel,
  // and the rocks of the islets all round.
  dia: {
    style: 'candia',
    relief: [{ island: 0, height: 1.1, cliffs: 0.5, at: -90 }, { island: 1, height: 0.7 }, { island: 2, height: 0.7, cliffs: 0.5 }, { island: 4, height: 0.8 }],
    landmarks: [
      { kind: 'lighthouse', coast: 0, at: 0.3, inland: 26, sight: 270 },
      { kind: 'town', coast: 0, at: 0.62, inland: 40, houses: 6, name: 'Candia', team: 'player' },
      { kind: 'peak', island: 0, at: 180, d: 0.55, height: 50, size: 0.4, lee: 2 },
      { kind: 'ruin', island: 0, at: 10, d: 0.6 },
      { kind: 'chapel', island: 0, at: 100, d: 0.5 },
      { kind: 'stacks', island: 2, at: 0, count: 3 },
      { kind: 'stacks', island: 4, at: 90, count: 2 },
      { kind: 'wreck', x: 0.7, y: 0.2 },
    ],
  },

  // ---------- The Dardanelles ----------
  // The castles of the Narrows on the tips of their points; Çanakkale's mosque and its cypresses; Maydos; Troy's
  // stones on the Asian shore.
  narrows: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 0.8, cliffs: 0.4 }, { island: 1, height: 0.8, cliffs: 0.4 }],
    landmarks: [
      { kind: 'castle', coast: 0, at: 0.66, inland: 70 },
      { kind: 'castle', coast: 1, at: 0.34, inland: 70 },
      { kind: 'town', coast: 1, at: 0.24, inland: 70, houses: 8, name: 'Çanakkale' },
      { kind: 'mosque', coast: 1, at: 0.14, inland: 60 },
      { kind: 'cypresses', coast: 1, at: 0.5, inland: 60, count: 5 },
      { kind: 'town', coast: 0, at: 0.8, inland: 60, houses: 5, name: 'Maydos' },
      { kind: 'mosque', coast: 0, at: 0.92, inland: 56 },
      { kind: 'windmill', coast: 0, at: 0.4, inland: 50 },
      { kind: 'ruin', coast: 1, at: 0.62, inland: 120 },
      { kind: 'lighthouse', coast: 1, at: 0.9, inland: 26 },
    ],
  },
  // Tenedos with its castle and windmills, Troy behind Besika Bay, Kum Kale's light at the mouth of the strait.
  kapudan: {
    style: 'dardanelles',
    relief: [{ island: 0, height: 1.0, cliffs: 0.4, at: 180 }, { island: 1, height: 0.8 }],
    landmarks: [
      { kind: 'town', island: 0, at: 90, d: 0.45, houses: 6, name: 'Tenedos' },
      { kind: 'castle', island: 0, at: -20, d: 0.5 },
      { kind: 'windmill', island: 0, at: 220, d: 0.55 },
      { kind: 'windmill', island: 0, at: 250, d: 0.62 },
      { kind: 'mosque', island: 0, at: 40, d: 0.6 },
      { kind: 'ruin', coast: 0, at: 0.56, inland: 70 },
      { kind: 'cypresses', coast: 0, at: 0.44, inland: 50, count: 4 },
      { kind: 'lighthouse', coast: 0, at: 0.08, inland: 26 },
      { kind: 'stacks', island: 1, at: 90, count: 3 },
      { kind: 'wreck', x: 0.3, y: 0.68 },
    ],
  },
};
