// The second world: England in the Mediterranean, 1666-1670. Same format as src/config/battles.js (read its
// header and docs/EXTENDING.md); merged into BATTLES there after the West Indies, so these indices come after
// the Caribbean's and never move them. Each battle carries world: 'med' and one of MED_REGIONS.
//
// The through-line: Tangier came to the Crown in the Queen's dowry, and the captain who broke La Gran Armada is
// sent to keep the Straits open. From the Salé rovers he works east along the Barbary coast (Algiers, Tunis,
// Tripoli), sails with the Knights of Malta, convoys the currant ships of Zante, goes to the aid of Venice in the
// last summer of Candia, and ends face to face with the Kapudan Pasha himself off the Dardanelles.
//
// Every map has a signature shape and a reason to manoeuvre; the comment over each battle's geography says what
// it is for. Positions are portrait fractions of a sea `sea` times the usual size, so on a big sea islands
// (radii in map units) look smaller and channels wider. Channels a ship of the line must use are kept at least
// ~3 beams plus her shore clearance on each side wide (about 230+ map units), with open water at every spawn.
// TODO(current/tide): a later pass adds sea currents and tides; the battles that want one say so in a TODO.
//
// Factions: 'barbary' (the corsairs of Salé, Algiers, Tunis, Tripoli) and 'ottoman' (the Sultan's fleet); see
// src/config/factions.js. Allies (the Knights, Venice) are allied captains on your side.

export const MED_REGIONS = [
  { id: 'straits', world: 'med', name: 'The Straits', where: 'in the Straits of Gibraltar' },
  { id: 'barbary', world: 'med', name: 'The Barbary Coast', where: 'off the Barbary Coast' },
  { id: 'malta', world: 'med', name: 'Malta and Sicily', where: 'in the Malta Channel' },
  { id: 'morea', world: 'med', name: 'The Morea', where: 'off the coast of the Morea' },
  { id: 'candia', world: 'med', name: 'Candia', where: 'off Candia' },
  { id: 'dardanelles', world: 'med', name: 'The Dardanelles', where: 'at the mouth of the Dardanelles' },
];

const W = 'med';

export const MED_BATTLES = [
  // ---------- The Straits ----------
  {
    id: 'tangier', world: W, region: 'straits', roman: 'I', year: 1666, name: 'The Mole at Tangier', foe: 'Salé galleys',
    faction: 'barbary', reward: 700, wind: 180, sea: 1.25,
    brief: 'The Salé rovers row across to burn the new mole at Tangier. Galleys keep way whatever the wind, ram with their beaks and board any ship they catch hurt. Keep York Castle firing and sink them all.',
    goals: [
      { kind: 'sink' },
      { kind: 'protect', forts: 'York Castle' },
      { kind: 'timer', secs: 210, bonus: true, gold: 140 },
    ],
    enemy: [
      { type: 'galley', name: 'Saqr', x: 0.34, y: 0.34, h: 90 },
      { type: 'galley', name: 'Nasr', x: 0.62, y: 0.3, h: 90 },
      { type: 'tartane', name: 'Rih', x: 0.48, y: 0.4, h: 90 },
      { type: 'tartane', name: 'Zahra', x: 0.78, y: 0.38, h: 90 },
    ],
    events: [
      { at: 45, banner: ['Galleys round Cape Malabata!', 'Two more and a fire galley, rowing hard'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.94, y: 0.42, h: 180 }, { type: 'galley', name: 'Ra’d', x: 0.94, y: 0.5, h: 180 },
          { type: 'firegalley', name: 'Shihab', x: 0.9, y: 0.34, h: 160 }] },
    ],
    // Defend the harbour from inside it: you start in Tangier Bay behind the Mole, Spain a smudge across the
    // Straits, and the galleys come at you from open water and round the cape to the east.
    fleetAt: { slots: [[0.36, 0.79], [0.26, 0.73], [0.46, 0.86], [0.58, 0.86], [0.7, 0.86]], h: -90 },
    coast: [
      { side: 'bottom', depth: 0.2, rough: 0.12, seed: 4, coves: [{ at: 0.56, width: 0.62, depth: 0.12 }], capes: [{ at: 0.06, width: 0.18, depth: 0.05 }, { at: 0.97, width: 0.14, depth: 0.12 }] },
      { side: 'top', depth: 0.05, rough: 0.4, seed: 5 },
    ],
    islands: [{ x: 0.62, y: 0.76, r: 30, stretch: 3.6, angle: -12 }, { x: 0.2, y: 0.5, r: 38, stretch: 1.4, angle: 30 }],
    forts: [{ island: 0, name: 'York Castle', hp: 260, guns: 3, need: 10, team: 'player' }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.7, hpMul: 2.1 },
  },
  {
    id: 'gibraltar', world: W, region: 'straits', roman: 'II', year: 1666, name: 'Under the Rock', foe: 'Salé rovers',
    faction: 'barbary', reward: 740, wind: -90, sea: 1.5,
    brief: 'Two Salé polacres have taken the merchantman Hopewell and run for the Atlantic with the Levanter behind them. Sink the polacres before they clear the Straits. The Rock steals the wind in its lee; keep to the African side.',
    goals: [
      { kind: 'hunt', ships: ['Ghazala', 'Najma'] },
      { kind: 'take', ships: 'Hopewell', bonus: true, gold: 160 },
    ],
    enemy: [
      { type: 'polacre', name: 'Ghazala', x: 0.5, y: 0.4, h: -90, abilities: { flee: { below: 0.55, speed: 1.2, say: 'She crowds on sail for the Atlantic!' } } },
      { type: 'polacre', name: 'Najma', x: 0.6, y: 0.33, h: -90, abilities: { flee: { below: 0.55, speed: 1.2, say: 'She crowds on sail for the Atlantic!' } } },
      { type: 'merchant', name: 'Hopewell', x: 0.42, y: 0.48, h: -90, abilities: { flee: { below: 0.6, speed: 1.1, say: 'The prize crew runs for it!' } } },
      { type: 'tartane', name: 'Rih', x: 0.48, y: 0.26, h: -90 },
    ],
    events: [
      { at: 30, banner: ['A galley out of Ceuta!', 'She rows across to cover the rovers'], spawn: [{ type: 'galley', name: 'Sayf', x: 0.66, y: 0.14, h: 120 }] },
    ],
    // A long chase down a corridor of water: the Rock juts from the European shore and Jebel Musa from the
    // African, with a reef in the wide water astern, the wind dead behind the quarry and the Rock's lee across
    // the middle. TODO(current): the inflowing Atlantic current would make the run west a fight against the water.
    fleetAt: { slots: [[0.5, 0.82], [0.38, 0.86], [0.62, 0.86], [0.44, 0.92], [0.56, 0.92]], h: -90 },
    coast: [
      { side: 'left', depth: 0.22, rough: 0.15, seed: 3, capes: [{ at: 0.38, width: 0.24, depth: 0.16 }] },
      { side: 'right', depth: 0.2, rough: 0.15, seed: 9, capes: [{ at: 0.62, width: 0.22, depth: 0.14 }] },
    ],
    reefs: [{ x: 0.5, y: 0.72, r: 14, stretch: 5, angle: 90 }],
    shoals: [{ x: 0.66, y: 0.46, r: 44, stretch: 1.8, angle: 80 }],
    islands: [],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.4, hpMul: 2.2 },
  },
  {
    id: 'sale', world: W, region: 'straits', roman: 'III', year: 1666, name: 'The Rover of Salé', foe: 'Reis Ibrahim',
    where: 'off the bar of Salé',
    faction: 'barbary', goal: 'boss', hat: 'rover', reward: 840, wind: 90, sea: 1.3,
    goals: [{ kind: 'boss' }, { kind: 'hunt', ships: 'Barq', bonus: true, gold: 140 }],
    brief: 'Reis Ibrahim lies in the river mouth behind the bar of Salé, under the guns of the Kasbah. His polacre slips over the sandbar where your big ships would stick fast: go round it. Hurt him and he will run for the open sea.',
    enemy: [
      { type: 'polacre', name: 'Burak', x: 0.5, y: 0.2, h: 90, hp: 720, chasers: 2,
        abilities: { flee: { below: 0.28, speed: 1.15, say: 'Reis Ibrahim makes for the open sea!' }, grapple: { below: 0.55 } },
        boss: { captain: 'Reis Ibrahim', title: 'Burak', hat: 'rover' } },
      { type: 'galley', name: 'Saqr', x: 0.32, y: 0.24, h: 90 },
      { type: 'galley', name: 'Nasr', x: 0.68, y: 0.24, h: 90 },
      { type: 'tartane', name: 'Qamar', x: 0.4, y: 0.15, h: 90 },
      { type: 'felucca', name: 'Barq', x: 0.6, y: 0.14, h: 90, abilities: { flee: { below: 0.9, speed: 1.1, say: 'The felucca runs for Rabat!' } } },
    ],
    events: [
      { bossHp: 0.6, banner: ['Rovers out of Rabat!', 'Two tartanes slip along the shore'],
        spawn: [{ type: 'tartane', name: 'Rih', x: 0.06, y: 0.42, h: 0 }, { type: 'tartane', name: 'Zahra', x: 0.94, y: 0.42, h: 180 }] },
    ],
    // A river-mouth lair: a deep cove behind a sandbar that light corsairs cross and your ships of the line must
    // go round, the Kasbah on its rock covering the anchorage. TODO(tide): a falling tide over the bar.
    coast: { side: 'top', depth: 0.3, rough: 0.15, seed: 6, coves: [{ at: 0.5, width: 0.8, depth: 0.2 }] },
    fleetAt: { slots: [[0.5, 0.58], [0.38, 0.62], [0.62, 0.62], [0.44, 0.68], [0.56, 0.68]], h: -90 },
    shoals: [{ x: 0.5, y: 0.34, r: 36, stretch: 3, angle: 0 }],
    islands: [{ x: 0.19, y: 0.18, r: 28 }, { x: 0.82, y: 0.6, r: 40 }, { x: 0.16, y: 0.5, r: 32, stretch: 1.6, angle: 60 }],
    forts: [{ island: 0, name: 'the Kasbah', hp: 300, guns: 3, need: 15 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.4, hpMul: 1.85 },
  },

  // ---------- The Barbary Coast ----------
  {
    id: 'bougie', world: W, region: 'barbary', roman: 'IV', year: 1667, name: 'Becalmed off Bougie', foe: 'Algerine galleys',
    faction: 'barbary', reward: 780, wind: 90, sea: 1.45, breeze: 0.3,
    brief: 'Not a breath of wind in the Bay of Bougie, and the Algerine galleys have found you. Your ships barely carry steerage way; theirs are rowed. Anchor and swing your broadsides onto them, and wait for the breeze.',
    goals: [{ kind: 'sink' }, { kind: 'timer', secs: 170, bonus: true, gold: 150 }],
    enemy: [
      { type: 'galley', name: 'Asad', x: 0.24, y: 0.22, h: 60 },
      { type: 'galley', name: 'Saqr', x: 0.36, y: 0.18, h: 80 },
      { type: 'polacre', name: 'Sa’ada', x: 0.62, y: 0.27, h: 90 },
      { type: 'galley', name: 'Fath', x: 0.84, y: 0.9, h: -110 },
      { type: 'firegalley', name: 'Shihab', x: 0.14, y: 0.88, h: -70 },
    ],
    events: [
      { at: 30, banner: ['More oars round Cape Carbon!', 'Two galleys from the east'],
        spawn: [{ type: 'galley', name: 'Ra’d', x: 0.95, y: 0.42, h: 180 }, { type: 'galley', name: 'Sayf', x: 0.95, y: 0.5, h: 180 }] },
      { at: 70, breeze: 1, wind: 45, banner: ['A breeze at last!', 'Your sails fill: now the galleys are in reach'] },
    ],
    // A flat calm in a wide bay: you start becalmed in the middle with galleys in a cove ahead and two more
    // astern; rocky islets to anchor behind, and a sandbank the shallow galleys cross and you can't.
    fleetAt: { slots: [[0.5, 0.54], [0.4, 0.58], [0.6, 0.58], [0.45, 0.66], [0.56, 0.66]], h: -90 },
    coast: { side: 'top', depth: 0.16, rough: 0.3, seed: 8, capes: [{ at: 0.84, width: 0.28, depth: 0.12 }], coves: [{ at: 0.28, width: 0.34, depth: 0.09 }] },
    islands: [{ x: 0.2, y: 0.5, r: 46 }, { x: 0.82, y: 0.66, r: 38, stretch: 1.6, angle: 30 }, { x: 0.5, y: 0.84, r: 34 }],
    shoals: [{ x: 0.52, y: 0.36, r: 50, stretch: 2.4, angle: -10 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.95, hpMul: 2.55 },
  },
  {
    id: 'bagnio', world: W, region: 'barbary', roman: 'V', year: 1667, name: 'The Bagnio of Algiers', foe: 'the Algiers squadron',
    faction: 'barbary', reward: 820, wind: -60, sea: 1.35,
    brief: 'Sixty English seamen lie in the bagnio of Algiers. Silence the battery on the Mole, anchor a ship with marines off the harbour while the boats go in, then see the captives’ boat safely out to sea.',
    goals: [
      { kind: 'rescue', x: 0.78, y: 0.53, r: 0.075, need: 10, fort: 'the Mole Battery', town: 'the bagnio of Algiers', captives: 60,
        boat: { type: 'felucca', name: 'Deliverance', hp: 110 } },
      { kind: 'hunt', ships: 'Asad', bonus: true, gold: 160 },
    ],
    enemy: [
      { type: 'polacre', name: 'Sa’ada', x: 0.48, y: 0.24, h: 90 },
      { type: 'polacre', name: 'Qamar', x: 0.6, y: 0.64, h: 180 },
      { type: 'galley', name: 'Asad', x: 0.6, y: 0.92, h: -120, abilities: { flee: { below: 0.45 } } },
      { type: 'galley', name: 'Saqr', x: 0.5, y: 0.16, h: 90 },
    ],
    events: [
      { at: 55, banner: ['Galleys out of the harbour!', 'The Dey sends his own'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.72, y: 0.62, h: 180 }, { type: 'galley', name: 'Ra’d', x: 0.7, y: 0.42, h: 180 }] },
      { at: 110, banner: ['Polacres from the west!', 'Algiers’ cruisers come home'],
        spawn: [{ type: 'polacre', name: 'Nasr', x: 0.2, y: 0.08, h: 60 }, { type: 'polacre', name: 'Sayf', x: 0.45, y: 0.06, h: 90 }] },
    ],
    // A harbour assault: the city along the right-hand shore with its harbour cove, the Mole Battery on its rock
    // off the mouth, and a reef north of it; the captives' boat must run up the coast to the open sea.
    fleetAt: { slots: [[0.45, 0.74], [0.32, 0.78], [0.58, 0.78], [0.38, 0.84], [0.52, 0.84]], h: -90 },
    coast: { side: 'right', depth: 0.24, rough: 0.12, seed: 2, coves: [{ at: 0.52, width: 0.4, depth: 0.12 }], capes: [{ at: 0.2, width: 0.16, depth: 0.07 }] },
    islands: [{ x: 0.57, y: 0.44, r: 40 }, { x: 0.16, y: 0.6, r: 40, stretch: 1.6, angle: 70 }],
    reefs: [{ x: 0.32, y: 0.3, r: 14, stretch: 5, angle: 25 }],
    forts: [{ island: 0, name: 'the Mole Battery', hp: 280, guns: 3, need: 10 }],
    ai: { spread: 0.095, reloadMul: 1.0, dmgMul: 2.3, hpMul: 2.85 },
  },
  {
    id: 'goletta', world: W, region: 'barbary', roman: 'VI', year: 1668, name: 'Fireships at La Goletta', foe: 'the Tunis corsairs',
    where: 'off Tunis', faction: 'barbary', reward: 840, wind: -90, sea: 1.4,
    brief: 'The Tunis corsairs lie moored in the lagoon behind the spit of La Goletta. You have two fireships: they burn whatever they touch. Steer them in over the shallows with the wind behind them and burn the four ships at anchor. They wake when a warship comes close.',
    goals: [
      { kind: 'hunt', ships: ['Mubarak', 'Hilal', 'Asad', 'Nur'] },
      { kind: 'timer', secs: 330 },
      { kind: 'timer', secs: 180, bonus: true, gold: 170 },
    ],
    enemy: [
      { type: 'kalyon', name: 'Mubarak', x: 0.3, y: 0.22, h: 0, abilities: { moored: true } },
      { type: 'polacre', name: 'Hilal', x: 0.5, y: 0.2, h: 0, abilities: { moored: true } },
      { type: 'galley', name: 'Asad', x: 0.66, y: 0.24, h: 180, abilities: { moored: true } },
      { type: 'polacre', name: 'Nur', x: 0.84, y: 0.22, h: 180, abilities: { moored: true } },
      { type: 'galley', name: 'Saqr', x: 0.18, y: 0.5, h: 90 },
      { type: 'galley', name: 'Nasr', x: 0.82, y: 0.52, h: 90 },
    ],
    events: [
      { banner: ['Fireships in company', 'Little Unicorn and Prosperous: steer them like any ship'],
        spawn: [{ type: 'fireship', name: 'Little Unicorn', team: 'player', x: 0.36, y: 0.72, h: -90 },
          { type: 'fireship', name: 'Prosperous', team: 'player', x: 0.64, y: 0.72, h: -90 }] },
    ],
    // A raid on a lagoon: a long spit, a sandbank and the fort close the harbour mouth; small ships (your
    // fireships) cross the sandbank with the wind behind them, ships of the line go round either end.
    coast: { side: 'top', depth: 0.12, rough: 0.25, seed: 4 },
    islands: [{ x: 0.4, y: 0.36, r: 28, stretch: 5, angle: 0 }, { x: 0.73, y: 0.36, r: 34 }],
    shoals: [{ x: 0.62, y: 0.36, r: 30, stretch: 2.4, angle: 0 }],
    forts: [{ island: 1, name: 'La Goletta', hp: 300, guns: 3, need: 15 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.8, hpMul: 2.4 },
  },
  {
    id: 'algiers', world: W, region: 'barbary', roman: 'VII', year: 1668, name: 'The Admiral of Algiers', foe: 'Kara Hasan Reis',
    faction: 'barbary', goal: 'boss', hat: 'kalpak', reward: 980, wind: 90, sea: 1.4,
    brief: 'Kara Hasan Reis, Admiral of Algiers, comes out at the head of his line with the wind behind him. His ships fight faster near him; break them apart. The channel up to him runs between the shore and a long island.',
    goals: [{ kind: 'boss' }, { kind: 'take', ships: 'Sa’ada', bonus: true, gold: 170 }],
    enemy: [
      { type: 'kalyon', name: 'Mubarak', x: 0.32, y: 0.12, h: 90, hp: 720, chasers: 2,
        abilities: { rally: { radius: 210, reload: 0.72 } },
        boss: { captain: 'Kara Hasan Reis', title: 'Mubarak', hat: 'kalpak' } },
      { type: 'polacre', name: 'Sa’ada', x: 0.46, y: 0.17, h: 90 },
      { type: 'polacre', name: 'Qamar', x: 0.24, y: 0.26, h: 90 },
      { type: 'galley', name: 'Saqr', x: 0.56, y: 0.24, h: 100 },
      { type: 'galley', name: 'Nasr', x: 0.8, y: 0.18, h: 110 },
    ],
    events: [
      { bossHp: 0.6, banner: ['The Dey’s galleys row out!', 'Two more from the harbour'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.2, y: 0.1, h: 30 }, { type: 'galley', name: 'Ra’d', x: 0.3, y: 0.06, h: 60 }] },
      { bossHp: 0.3, banner: ['The Mubarak is hulled!', 'Hasan Reis fights on from the quarterdeck'] },
    ],
    // An upwind fight: the admiral's line comes down on the wind from his harbour, and you beat up to him through
    // a broad channel between the shore and a long island, or round the island's far side past a reef.
    fleetAt: { slots: [[0.46, 0.72], [0.34, 0.76], [0.58, 0.76], [0.4, 0.82], [0.52, 0.82]], h: -90 },
    coast: { side: 'left', depth: 0.18, rough: 0.25, seed: 7, coves: [{ at: 0.16, width: 0.3, depth: 0.1 }] },
    islands: [{ x: 0.7, y: 0.48, r: 40, stretch: 4.5, angle: 90 }, { x: 0.3, y: 0.9, r: 40 }],
    reefs: [{ x: 0.86, y: 0.28, r: 14, stretch: 4, angle: -40 }],
    ai: { spread: 0.095, reloadMul: 1.0, dmgMul: 1.55, hpMul: 2.3 },
  },

  // ---------- Malta and Sicily ----------
  {
    id: 'knights', world: W, region: 'malta', roman: 'VIII', year: 1668, name: 'The Knights’ Galleys', foe: 'Tripoli corsairs',
    where: 'off Valletta', faction: 'barbary', reward: 880, wind: -90, sea: 1.4,
    brief: 'You lie in the Grand Harbour with two galleys of the Knights of St John when a Tripoli squadron is sighted off the mouth. Sortie together and sink them; the Knights fight their own way, but lose either galley and the Grand Master will never forgive you.',
    goals: [
      { kind: 'sink' },
      { kind: 'protect', allies: [
        { type: 'galley', name: 'San Giovanni', x: 0.4, y: 0.68, h: -90, hp: 340, up: { marines: 2 } },
        { type: 'galley', name: 'Santa Ubaldesca', x: 0.6, y: 0.68, h: -90, hp: 340, up: { marines: 2 } },
      ] },
      { kind: 'take', ships: 'Rih', bonus: true, gold: 150 },
    ],
    enemy: [
      { type: 'polacre', name: 'Nur', x: 0.5, y: 0.36, h: 90 },
      { type: 'polacre', name: 'Shihab', x: 0.72, y: 0.42, h: 120 },
      { type: 'galley', name: 'Asad', x: 0.34, y: 0.44, h: 70 },
      { type: 'galley', name: 'Saqr', x: 0.84, y: 0.32, h: 110 },
      { type: 'tartane', name: 'Rih', x: 0.6, y: 0.48, h: 90 },
    ],
    events: [
      { at: 50, banner: ['Galleys from behind Gozo!', 'They mean to take the Knights in the flank'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.06, y: 0.36, h: 20 }, { type: 'galley', name: 'Nasr', x: 0.08, y: 0.5, h: 0 }] },
    ],
    // A sortie: you start inside the Grand Harbour, Fort St Elmo on the western horn of its mouth, and fight
    // the corsairs in the channel off it, with Gozo and Comino to the north to hide galleys behind.
    fleetAt: { slots: [[0.5, 0.74], [0.42, 0.78], [0.58, 0.78], [0.46, 0.84], [0.54, 0.84]], h: -90 },
    coast: { side: 'bottom', depth: 0.32, rough: 0.12, seed: 1, coves: [{ at: 0.5, width: 0.5, depth: 0.24 }] },
    islands: [{ x: 0.3, y: 0.72, r: 26 }, { x: 0.22, y: 0.2, r: 70, stretch: 1.8, angle: -10 }, { x: 0.64, y: 0.27, r: 34 }],
    forts: [{ island: 0, name: 'Fort St Elmo', hp: 240, guns: 3, need: 10, team: 'player' }],
    ai: { spread: 0.095, reloadMul: 1.0, dmgMul: 1.7, hpMul: 2.3 },
  },
  {
    id: 'passero', world: W, region: 'malta', roman: 'IX', year: 1668, name: 'Storm off Cape Passero', foe: 'Tripoli rovers',
    where: 'off the coast of Sicily', faction: 'barbary', reward: 900, wind: 0, sea: 1.4, weather: 'storm',
    brief: 'A Tripoli squadron is running down the Sicilian coast and the sky to the south is black. Sink them before the gale sets you all on the rocks of Cape Passero: when it blows, ships run faster, guns throw wild and the rain hides everything.',
    goals: [{ kind: 'sink' }, { kind: 'timer', secs: 200, bonus: true, gold: 170 }],
    enemy: [
      { type: 'polacre', name: 'Nur', x: 0.3, y: 0.18, h: 60 },
      { type: 'polacre', name: 'Hilal', x: 0.5, y: 0.12, h: 90 },
      { type: 'galley', name: 'Asad', x: 0.66, y: 0.2, h: 110 },
      { type: 'galley', name: 'Saqr', x: 0.18, y: 0.3, h: 30 },
      { type: 'tartane', name: 'Zahra', x: 0.44, y: 0.26, h: 90 },
    ],
    events: [
      { at: 30, breeze: 1.25, banner: ['The sky darkens to the south', 'The wind is getting up'] },
      { at: 55, breeze: 1.55, fog: 260, wind: 30, banner: ['A gale off Cape Passero!', 'Rain squalls: you can barely see your own bowsprit'] },
      { at: 75, banner: ['Rovers running before the gale!', 'Two polacres out of the murk'],
        spawn: [{ type: 'polacre', name: 'Fath', x: 0.06, y: 0.5, h: 0 }, { type: 'polacre', name: 'Sayf', x: 0.06, y: 0.62, h: -20 }] },
      { at: 135, breeze: 1.1, fog: 0, wind: -30, banner: ['The storm blows through', 'Finish them while the sky clears'] },
    ],
    // A lee shore in a rising gale: Cape Passero and its islet stand out from the Sicilian shore with reefs off
    // them, the wind blows you onto it, and the open sea to the west is where you claw off.
    // TODO(current): the set round the cape in the gale would make the lee shore really bite.
    fleetAt: { slots: [[0.48, 0.84], [0.38, 0.88], [0.58, 0.86], [0.44, 0.94], [0.56, 0.93]], h: -90 },
    coast: { side: 'right', depth: 0.22, rough: 0.3, seed: 12, capes: [{ at: 0.6, width: 0.3, depth: 0.22 }] },
    islands: [{ x: 0.32, y: 0.66, r: 40 }, { x: 0.12, y: 0.86, r: 42, stretch: 1.5, angle: -20 }],
    reefs: [{ x: 0.28, y: 0.44, r: 14, stretch: 5, angle: 60 }, { x: 0.58, y: 0.34, r: 16, stretch: 2, angle: 10 }, { x: 0.36, y: 0.58, r: 12, stretch: 3, angle: 90 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 2.55, hpMul: 3.1 },
  },
  {
    id: 'tripoli', world: W, region: 'malta', roman: 'X', year: 1669, name: 'The Reefs of Tripoli', foe: 'Osman Reis',
    faction: 'barbary', goal: 'boss', hat: 'osman', reward: 1040, wind: 0, sea: 1.4,
    goals: [{ kind: 'boss' }, { kind: 'capture', bonus: true, gold: 180 }],
    brief: 'Osman Reis keeps his galleass behind the reefs that guard Tripoli roads and sends fire galleys out through the gaps. Thread the gaps, sink the fire galleys before they touch you, and bring him to action under the Red Castle.',
    enemy: [
      { type: 'galleass', name: 'Hilal', x: 0.5, y: 0.25, h: 90, hp: 800, chasers: 3,
        abilities: { launcher: { type: 'firegalley', name: 'Fire galley', every: 17, max: 2, range: 560, banner: ['Fire galley!', 'She rows straight for you: sink her'] } },
        boss: { captain: 'Osman Reis', title: 'Hilal', hat: 'osman' } },
      { type: 'polacre', name: 'Nur', x: 0.3, y: 0.3, h: 90 },
      { type: 'polacre', name: 'Shihab', x: 0.66, y: 0.36, h: 90 },
      { type: 'galley', name: 'Asad', x: 0.64, y: 0.22, h: 90 },
    ],
    events: [
      { bossHp: 0.5, banner: ['Galleys from the roads!', 'Osman Reis calls in his galleys'],
        spawn: [{ type: 'galley', name: 'Saqr', x: 0.95, y: 0.6, h: 180 }, { type: 'galley', name: 'Fath', x: 0.05, y: 0.6, h: 0 }] },
    ],
    // A reef gauntlet: two long reef lines run in from either side of the roads, staggered, so the only way in is
    // a zigzag between their ends; the boss sits behind them under the castle and sends fire galleys out through it.
    coast: { side: 'top', depth: 0.14, rough: 0.2, seed: 10, coves: [{ at: 0.5, width: 0.4, depth: 0.06 }] },
    islands: [{ x: 0.24, y: 0.15, r: 28 }, { x: 0.8, y: 0.74, r: 40 }],
    reefs: [{ x: 0.21, y: 0.42, r: 26, stretch: 8, angle: 0 }, { x: 0.79, y: 0.53, r: 26, stretch: 8, angle: 0 }, { x: 0.86, y: 0.3, r: 12, stretch: 3, angle: 30 }],
    forts: [{ island: 0, name: 'the Red Castle', hp: 280, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.65, hpMul: 2.35 },
  },

  // ---------- The Morea ----------
  {
    id: 'zante', world: W, region: 'morea', roman: 'XI', year: 1669, name: 'The Currant Ships', foe: 'Dulcigno corsairs',
    where: 'between Zante and Cephalonia', faction: 'barbary', reward: 920, wind: 0, sea: 1.6,
    fleetAt: { slots: [[0.45, 0.76], [0.3, 0.82], [0.56, 0.8], [0.36, 0.92], [0.5, 0.94]], h: -90 },
    brief: 'Three Levant Company ships are loaded with Zante currants for the London Christmas puddings. They sail up the channel on their own; the Dulcigno corsairs wait in the coves of the Morea and behind Cephalonia. Two must get through.',
    goals: [
      { kind: 'escort', need: 2, ships: [
        { type: 'merchant', name: 'Levant Merchant', x: 0.4, y: 0.88, h: -90, hp: 200, up: { marines: 2 } },
        { type: 'merchant', name: 'Smyrna Factor', x: 0.54, y: 0.86, h: -90, hp: 200, up: { marines: 2 } },
        { type: 'merchant', name: 'Zante Rose', x: 0.62, y: 0.92, h: -90, hp: 200, up: { marines: 2 } },
      ] },
      { kind: 'hunt', ships: 'Asad', bonus: true, gold: 170 },
    ],
    enemy: [
      { type: 'polacre', name: 'Nur', x: 0.5, y: 0.22, h: 90 },
      { type: 'polacre', name: 'Hilal', x: 0.34, y: 0.14, h: 90 },
      { type: 'galley', name: 'Asad', x: 0.6, y: 0.1, h: 90, abilities: { flee: { below: 0.4 } } },
    ],
    events: [
      { at: 16, banner: ['Galleys from the Morea shore!', 'They lay in wait in the coves'],
        spawn: [{ type: 'galley', name: 'Saqr', x: 0.22, y: 0.68, h: 0 }, { type: 'galley', name: 'Nasr', x: 0.22, y: 0.32, h: 20 }] },
      { at: 40, banner: ['Corsairs from behind Cephalonia!', 'Two polacres come round the island'],
        spawn: [{ type: 'polacre', name: 'Shihab', x: 0.94, y: 0.18, h: 150 }, { type: 'polacre', name: 'Fath', x: 0.93, y: 0.48, h: 180 }] },
    ],
    // A long channel and an ambush: the convoy's road runs up between the Morea's coves and the long island of
    // Cephalonia, with an islet splitting it; corsairs wait in the coves and behind the island, off the screen.
    // TODO(current): a current up the channel would carry the convoy and make the corsairs row against it.
    coast: { side: 'left', depth: 0.16, rough: 0.3, seed: 14, coves: [{ at: 0.3, width: 0.16, depth: 0.07 }, { at: 0.68, width: 0.14, depth: 0.07 }] },
    islands: [{ x: 0.8, y: 0.32, r: 46, stretch: 7, angle: 92 }, { x: 0.82, y: 0.8, r: 60, stretch: 1.5, angle: 60 }, { x: 0.44, y: 0.55, r: 34 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.3, hpMul: 2.0 },
  },
  {
    id: 'navarino', world: W, region: 'morea', roman: 'XII', year: 1669, name: 'Navarino Bay', foe: 'the Ottoman squadron',
    faction: 'ottoman', reward: 960, wind: 180, sea: 1.4,
    brief: 'The Venetian galleass San Marco is trapped in Navarino Bay with you, and an Ottoman squadron is coming in. Cork the mouth of the bay with a ship for twenty seconds, and keep the San Marco afloat until the Venetian fleet arrives. The north channel is too shallow for anything bigger than a sloop.',
    fleetAt: { slots: [[0.46, 0.2], [0.34, 0.2], [0.56, 0.22], [0.4, 0.24], [0.5, 0.25]], h: 0 },
    goals: [
      { kind: 'protect', secs: 160, allies: [{ type: 'galleass', name: 'San Marco', x: 0.62, y: 0.2, h: 0, hp: 440 }] },
      { kind: 'reach', x: 0.68, y: 0.36, r: 0.1, secs: 20, label: 'Hold the mouth' },
      { kind: 'hunt', ships: 'Kaplan', bonus: true, gold: 180 },
    ],
    enemy: [
      { type: 'kalyon', name: 'Yıldız', x: 0.72, y: 0.56, h: -100 },
      { type: 'kalyon', name: 'Kaplan', x: 0.5, y: 0.62, h: -60 },
      { type: 'galley', name: 'Doğan', x: 0.86, y: 0.5, h: -120 },
      { type: 'galley', name: 'Şahin', x: 0.3, y: 0.52, h: -40 },
    ],
    events: [
      { at: 40, banner: ['More galleys!', 'They make for the north channel'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.06, y: 0.5, h: -45 }, { type: 'galley', name: 'Yunus', x: 0.1, y: 0.62, h: -60 }] },
      { at: 90, banner: ['An Ottoman galleass!', 'The Ejder comes in on the second wave'],
        spawn: [{ type: 'galleass', name: 'Ejder', x: 0.6, y: 0.9, h: -90 }, { type: 'kalyon', name: 'Arslan', x: 0.85, y: 0.82, h: -110 }] },
      { at: 150, banner: ['Venetian sails!', 'The fleet of the Serenissima is coming in'] },
    ],
    // A bay with two mouths: the long island of Sphacteria lies across it, the wide south entrance (the gold
    // ring) is yours to hold, and the north channel is a sandbank only small ships cross. You start inside.
    coast: { side: 'top', depth: 0.34, rough: 0.12, seed: 15, coves: [{ at: 0.45, width: 0.8, depth: 0.24 }] },
    islands: [{ x: 0.38, y: 0.32, r: 30, stretch: 5, angle: 0 }, { x: 0.8, y: 0.72, r: 40 }],
    shoals: [{ x: 0.17, y: 0.33, r: 36, stretch: 1.6, angle: 0 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.65, hpMul: 2.35 },
  },

  // ---------- Candia ----------
  {
    id: 'candia', world: W, region: 'candia', roman: 'XIII', year: 1669, name: 'The Walls of Candia', foe: 'the Ottoman siege fleet',
    faction: 'ottoman', hat: 'corno', reward: 1000, wind: 90, sea: 1.25,
    goals: [{ kind: 'hold', secs: 150 }, { kind: 'hunt', ships: 'Kartal', bonus: true, gold: 180 }],
    brief: 'The last summer of the siege. Hold the Sabbionara bastion while the Sultan’s bomb galleys shell it from the sea. Your ships can patch their hulls in the Venetian harbour by lying still in its anchorage.',
    forts: [{ island: 0, name: 'the Sabbionara', hp: 240, guns: 3, need: 10, team: 'player' }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.2, y: 0.2, h: 90, abilities: { mortar: { range: 420, reload: 8, dmg: 15, radius: 32 } } },
      { type: 'galley', name: 'Şahin', x: 0.46, y: 0.14, h: 90, abilities: { mortar: { range: 420, reload: 8, dmg: 15, radius: 32 } } },
      { type: 'kalyon', name: 'Yıldız', x: 0.74, y: 0.2, h: 110 },
      { type: 'kalyon', name: 'Arslan', x: 0.36, y: 0.28, h: 90 },
    ],
    events: [
      { at: 35, banner: ['Bomb galleys from the west!', 'Hunt them before they find the range'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.05, y: 0.4, h: 0, abilities: { mortar: { range: 430, reload: 7, dmg: 20, radius: 36 } } },
          { type: 'galley', name: 'Yunus', x: 0.05, y: 0.52, h: 0, abilities: { mortar: { range: 430, reload: 7, dmg: 20, radius: 36 } } }] },
      { at: 75, banner: ['The Kapudan’s squadron!', 'A kalyon and a galleass bear down'],
        spawn: [{ type: 'kalyon', name: 'Fatih', x: 0.6, y: 0.06, h: 90 }, { type: 'galleass', name: 'Ejder', x: 0.85, y: 0.1, h: 120 }] },
      { at: 100, banner: ['The Santa Giustina!', 'A Venetian galleass comes out to stand with you'],
        spawn: [{ type: 'galleass', name: 'Santa Giustina', team: 'player', ally: true, x: 0.9, y: 0.66, h: 180, hp: 380 }] },
      { at: 122, banner: ['The final assault!', 'Fire galleys and the last kalyons'],
        spawn: [{ type: 'firegalley', name: 'Alev', x: 0.3, y: 0.06, h: 90 }, { type: 'kalyon', name: 'Zafer', x: 0.12, y: 0.12, h: 60 }] },
    ],
    // A besieged fortress: the walls of Candia run along the bottom of the chart with the Sabbionara bastion on
    // its point and the Venetian harbour (repairs) in the cove behind it; an islet out in the roads is the only cover.
    coast: { side: 'bottom', depth: 0.22, rough: 0.12, seed: 16, capes: [{ at: 0.26, width: 0.2, depth: 0.1 }], coves: [{ at: 0.64, width: 0.3, depth: 0.12 }] },
    islands: [{ x: 0.26, y: 0.66, r: 28 }, { x: 0.64, y: 0.38, r: 52, stretch: 1.4, angle: 20 }],
    fleetAt: { slots: [[0.5, 0.66], [0.4, 0.6], [0.62, 0.62], [0.46, 0.72], [0.58, 0.74]], h: -90 },
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.3, hpMul: 2.0 },
  },
  {
    id: 'dia', world: W, region: 'candia', roman: 'XIV', year: 1669, name: 'Night off Dia', foe: 'the Dia battery',
    faction: 'ottoman', night: true, reward: 980, wind: -45, sea: 1.35,
    goals: [{ kind: 'capture' }, { kind: 'hunt', ships: 'Yıldız', bonus: true, gold: 180 }],
    brief: 'A new Ottoman battery on the island of Dia sinks every relief boat bound for Candia. Take it tonight. Your lookouts see only a little way in the dark, but a burning ship lights up the whole sea, and so does the Venetian lantern on the shore.',
    forts: [{ island: 0, name: 'the Dia battery', hp: 340, guns: 3, need: 15 }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.28, y: 0.2, h: 0 },
      { type: 'galley', name: 'Şahin', x: 0.72, y: 0.16, h: 180 },
      { type: 'kalyon', name: 'Yıldız', x: 0.5, y: 0.12, h: 0, abilities: { moored: { wake: 260 } } },
      { type: 'felucca', name: 'Yunus', x: 0.5, y: 0.56, h: 0 },
    ],
    events: [
      { at: 50, banner: ['Oars in the dark!', 'A night patrol and a galleass come round the island'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.06, y: 0.36, h: 0 }, { type: 'galley', name: 'Ejder', x: 0.94, y: 0.4, h: 180 }, { type: 'galleass', name: 'Sancak', x: 0.5, y: 0.04, h: 90 }] },
      { fortsHeld: 1, banner: ['The Dia battery is ours!', 'Its guns turn on the Sultan’s ships'] },
    ],
    // Night round a big island: Dia fills the middle of the chart with reefs off both ends, the battery on its
    // seaward side; you come out from the Cretan shore, where a lantern lights the water for your lookouts.
    // TODO(tide): a falling tide off Dia's reefs would open and close a short cut across them.
    fleetAt: { slots: [[0.5, 0.72], [0.38, 0.74], [0.62, 0.74], [0.44, 0.79], [0.56, 0.79]], h: -90 },
    coast: { side: 'bottom', depth: 0.1, rough: 0.3, seed: 17 },
    islands: [{ x: 0.5, y: 0.36, r: 74, stretch: 2.2, angle: 8 }, { x: 0.8, y: 0.62, r: 32 }],
    reefs: [{ x: 0.14, y: 0.42, r: 14, stretch: 5, angle: 80 }, { x: 0.87, y: 0.3, r: 14, stretch: 5, angle: -70 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 2.8, hpMul: 3.4 },
  },

  // ---------- The Dardanelles ----------
  {
    id: 'narrows', world: W, region: 'dardanelles', roman: 'XV', year: 1670, name: 'The Castles of the Narrows', foe: 'the castles',
    faction: 'ottoman', reward: 1020, wind: -90, sea: 1.4,
    brief: 'The Levant Company’s ships are held at Gallipoli. Run Resolute up the Dardanelles past the castles of Kilitbahir and Çanakkale and out at the top of the chart, with the fleet to draw their fire. The castles’ guns cover the Narrows from both shores.',
    goals: [{ kind: 'breakthrough' }, { kind: 'timer', secs: 150, bonus: true, gold: 190 }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.42, y: 0.36, h: 90 },
      { type: 'galleass', name: 'Ejder', x: 0.56, y: 0.22, h: 90 },
      { type: 'kalyon', name: 'Yıldız', x: 0.5, y: 0.12, h: 90 },
    ],
    events: [
      { at: 35, banner: ['Galleys from Maydos!', 'They row out astern of you'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.36, y: 0.7, h: -30 }, { type: 'galley', name: 'Yunus', x: 0.64, y: 0.72, h: -150 }] },
    ],
    // A long, narrow strait: the castles stand on points of the European and Asian shores, offset so the
    // channel snakes between their guns, and the Ottoman line waits beyond. TODO(current): the Dardanelles
    // current runs down the strait, against you; a later pass should add it.
    fleetAt: { slots: [[0.5, 0.84], [0.4, 0.88], [0.6, 0.88], [0.45, 0.94], [0.55, 0.94]], h: -90 },
    coast: [
      { side: 'left', depth: 0.22, rough: 0.12, seed: 2, capes: [{ at: 0.46, width: 0.18, depth: 0.14 }] },
      { side: 'right', depth: 0.22, rough: 0.12, seed: 13, capes: [{ at: 0.58, width: 0.18, depth: 0.14 }] },
    ],
    islands: [{ x: 0.36, y: 0.46, r: 32 }, { x: 0.64, y: 0.58, r: 32 }],
    forts: [
      { island: 0, name: 'Kilitbahir', hp: 280, guns: 2, need: 15 },
      { island: 1, name: 'Çanakkale', hp: 280, guns: 2, need: 15 },
    ],
    ai: { spread: 0.09, reloadMul: 1.05, dmgMul: 0.65, hpMul: 1.4 },
  },
  {
    id: 'kapudan', world: W, region: 'dardanelles', roman: 'XVI', year: 1670, name: 'The Kapudan Pasha', foe: 'Bahri Ömer Pasha',
    where: 'off Tenedos', faction: 'ottoman', goal: 'boss', hat: 'kavuk', reward: 1500, wind: 0, sea: 1.6,
    goals: [{ kind: 'boss' }, { kind: 'take', ships: 'Arslan', bonus: true, gold: 240 }],
    brief: 'Bahri Ömer Pasha, Kapudan Pasha of the Ottoman fleet, comes out of the Dardanelles in his sultana Kara Ejder with galleasses on his wings and galleys behind Tenedos. His ships fight faster near him. Break his line and sink the flagship.',
    enemy: [
      // The Kapudan's sultana carries demi-cannon on both broadsides (src/config/guns.js).
      { type: 'sultana', name: 'Kara Ejder', x: 0.55, y: 0.14, h: 90, hp: 1100, chasers: 3, loadout: { port: 'demicannon', starboard: 'demicannon' },
        abilities: { rally: { radius: 230, reload: 0.75 }, mortar: { range: 460, reload: 9, dmg: 20, radius: 34 } },
        boss: { captain: 'Bahri Ömer Pasha', title: 'Kara Ejder', hat: 'kavuk' } },
      { type: 'galleass', name: 'Sancak', x: 0.3, y: 0.12, h: 90 },
      { type: 'galleass', name: 'Ejder', x: 0.72, y: 0.12, h: 100 },
      { type: 'kalyon', name: 'Arslan', x: 0.42, y: 0.22, h: 90 },
    ],
    events: [
      { at: 35, wind: 45, banner: ['The wind veers!', 'The Ottoman line loses the weather gauge'] },
      { bossHp: 0.65, banner: ['Galleys from behind Tenedos!', 'The Kapudan’s reserve rows into the fight'],
        spawn: [{ type: 'galley', name: 'Doğan', x: 0.2, y: 0.14, h: 60 }, { type: 'galley', name: 'Şahin', x: 0.06, y: 0.56, h: 0 },
          { type: 'firegalley', name: 'Alev', x: 0.08, y: 0.2, h: 60 }] },
      { bossHp: 0.35, banner: ['Venetian galleasses!', 'San Marco and Santa Giustina join the fight'],
        spawn: [{ type: 'galleass', name: 'San Marco', team: 'player', ally: true, x: 0.12, y: 0.92, h: -60, hp: 380 },
          { type: 'galleass', name: 'Santa Giustina', team: 'player', ally: true, x: 0.72, y: 0.94, h: -110, hp: 380 }] },
    ],
    // The great fleet action on a wide sea: Tenedos to the north-west hiding the galley reserve, the Asian shore
    // close on the right, a reef and an islet to split the Ottoman crescent as it comes down on you.
    coast: { side: 'right', depth: 0.14, rough: 0.3, seed: 18, capes: [{ at: 0.32, width: 0.2, depth: 0.07 }] },
    islands: [{ x: 0.22, y: 0.36, r: 80, stretch: 1.8, angle: -20 }, { x: 0.62, y: 0.6, r: 40 }],
    reefs: [{ x: 0.26, y: 0.66, r: 14, stretch: 5, angle: 30 }],
    shoals: [{ x: 0.44, y: 0.5, r: 46, stretch: 2, angle: 40 }],
    ai: { spread: 0.085, reloadMul: 1.0, dmgMul: 1.05, hpMul: 1.6 },
  },
];
