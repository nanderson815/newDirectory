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
// The sea that moves (src/sim/flow.js): currents in the Straits, off Cape Passero, up the Ionian channel and down the
// Dardanelles; tides over the bar at Salé and off Dia's reefs.
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
        spawn: [{ type: 'galley', name: 'Fath', x: 0.95, y: 0.5, h: 180 }, { type: 'galley', name: 'Ra’d', x: 0.95, y: 0.44, h: 180 },
          { type: 'firegalley', name: 'Shihab', x: 0.9, y: 0.38, h: 160 }] },
    ],
    // A breakwater on a long, low shore: the African coast runs flat along the bottom of the chart, Tangier on
    // its headland at the west end and Cape Malabata standing up tall at the east, hiding the second wave until
    // it is round. From the town's headland the Mole runs straight out east to York Castle on its rock, walling off
    // a long pond between the arm and the beach: you start in it, the galleys can only reach you round the
    // castle's end, and the castle fires down both sides of the arm. Spain is a smudge across the Straits.
    fleetAt: { slots: [[0.48, 0.85], [0.38, 0.85], [0.58, 0.86], [0.68, 0.84], [0.28, 0.86]], h: 0 },
    coast: [
      { side: 'bottom', depth: 0.075, rough: 0.2, seed: 4, capes: [{ at: 0.14, width: 0.26, depth: 0.18 }, { at: 0.93, width: 0.16, depth: 0.36 }] },
      { side: 'top', depth: 0.05, rough: 0.4, seed: 5 },
    ],
    islands: [{ x: 0.54, y: 0.74, r: 38 }, { x: 0.37, y: 0.75, r: 18, stretch: 8, angle: -4 }, { x: 0.2, y: 0.42, r: 38, stretch: 1.4, angle: 30 }],
    forts: [{ island: 0, name: 'York Castle', hp: 260, guns: 3, need: 10, team: 'player' }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 2.02, hpMul: 2.5 },
  },
  {
    id: 'gibraltar', world: W, region: 'straits', roman: 'II', year: 1666, name: 'Under the Rock', foe: 'Salé rovers',
    faction: 'barbary', reward: 740, wind: 180, sea: 1.9,
    brief: 'Two Salé polacres have taken the merchantman Hopewell and run for the Atlantic with the Levanter behind them. Sink the polacres before they clear the Straits. The Rock steals the wind in its lee; keep to the African side.',
    goals: [
      { kind: 'hunt', ships: ['Ghazala', 'Najma'] },
      { kind: 'take', ships: 'Hopewell', bonus: true, gold: 160 },
    ],
    enemy: [
      { type: 'polacre', name: 'Ghazala', x: 0.5, y: 0.5, h: 180, abilities: { flee: { below: 0.7, speed: 1.3, say: 'She crowds on sail for the Atlantic!' } } },
      { type: 'polacre', name: 'Najma', x: 0.56, y: 0.44, h: 180, abilities: { flee: { below: 0.7, speed: 1.3, say: 'She crowds on sail for the Atlantic!' } } },
      { type: 'merchant', name: 'Hopewell', x: 0.6, y: 0.56, h: 180, abilities: { flee: { below: 0.6, speed: 1.1, say: 'The prize crew runs for it!' } } },
      { type: 'tartane', name: 'Rih', x: 0.42, y: 0.46, h: 180 },
    ],
    events: [
      { at: 30, banner: ['A galley out of Ceuta!', 'She rows across to cover the rovers'], spawn: [{ type: 'galley', name: 'Sayf', x: 0.72, y: 0.62, h: -150 }] },
    ],
    // The Straits run ACROSS the chart: Spain along the top, Africa along the bottom, the Atlantic off the left
    // edge. The Rock stands down from the Spanish shore like a tooth with the Bay of Algeciras tucked in behind it,
    // Jebel Musa and Ceuta's hill rise from the African side. The quarry runs west before the Levanter; the Rock
    // throws its lee over the bay and the northern water, so the African side keeps the wind, and the Atlantic
    // pours in down the middle (src/sim/flow.js) against everyone running west. The edges of the shore water are
    // slack: hug a coast to cheat the current, but mind the lee.
    fleetAt: { slots: [[0.88, 0.5], [0.92, 0.44], [0.92, 0.56], [0.96, 0.47], [0.96, 0.53]], h: 180 },
    coast: [
      { side: 'top', depth: 0.3, rough: 0.12, seed: 3, capes: [{ at: 0.66, width: 0.14, depth: 0.15 }, { at: 0.04, width: 0.14, depth: 0.04 }], coves: [{ at: 0.42, width: 0.36, depth: 0.15 }] },
      { side: 'bottom', depth: 0.3, rough: 0.15, seed: 9, capes: [{ at: 0.28, width: 0.3, depth: 0.07 }, { at: 0.84, width: 0.14, depth: 0.1 }], coves: [{ at: 0.6, width: 0.2, depth: 0.06 }] },
    ],
    currents: [{ x: 0.48, y: 0.52, r: 130, stretch: 4, angle: 0, speed: 10 }],
    reefs: [{ x: 0.62, y: 0.51, r: 12, stretch: 3, angle: 20 }],
    islands: [],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 2.15, hpMul: 3.14 },
  },
  {
    id: 'sale', world: W, region: 'straits', roman: 'III', year: 1666, name: 'The Rover of Salé', foe: 'Reis Ibrahim',
    where: 'off the bar of Salé',
    faction: 'barbary', goal: 'boss', hat: 'rover', reward: 840, wind: 10, sea: 1.35,
    goals: [{ kind: 'boss' }, { kind: 'hunt', ships: 'Barq', bonus: true, gold: 140 }],
    brief: 'Reis Ibrahim lies in the river mouth behind the bar of Salé, under the guns of the Kasbah. His polacre slips over the sandbar where your big ships would stick fast: take the deep channel under the Kasbah, or wait for the ebb, when the bar dries and he too must come out that way. Hurt him and he will run for the open sea.',
    enemy: [
      { type: 'polacre', name: 'Burak', x: 0.8, y: 0.42, h: 180, hp: 950, chasers: 2,
        abilities: { flee: { below: 0.35, speed: 1.15, say: 'Reis Ibrahim makes for the open sea!' }, grapple: { below: 0.55 } },
        boss: { captain: 'Reis Ibrahim', title: 'Burak', hat: 'rover' } },
      { type: 'galley', name: 'Saqr', x: 0.5, y: 0.32, h: 180 },
      { type: 'galley', name: 'Nasr', x: 0.5, y: 0.56, h: 180 },
      { type: 'tartane', name: 'Qamar', x: 0.72, y: 0.36, h: 180 },
      { type: 'felucca', name: 'Barq', x: 0.86, y: 0.46, h: 180, abilities: { flee: { below: 0.9, speed: 1.1, say: 'The felucca runs for Rabat!' } } },
    ],
    events: [
      { bossHp: 0.6, banner: ['Rovers out of Rabat!', 'Two tartanes slip along the shore'],
        spawn: [{ type: 'tartane', name: 'Rih', x: 0.5, y: 0.06, h: 90 }, { type: 'tartane', name: 'Zahra', x: 0.5, y: 0.94, h: -90 }] },
    ],
    // A river-mouth lair on an Atlantic shore: the Bou Regreg cuts deep into the coast between Salé and Rabat,
    // and Reis Ibrahim lies in its mouth. A sandbar lies across the mouth: the light corsairs cross it, your ships
    // of the line must take the one deep channel, which runs right under the Kasbah on its rock. Or wait: the tide
    // falls at 80 s and the bar dries, and then even the corsairs must come out by the Kasbah's channel.
    coast: { side: 'right', depth: 0.42, rough: 0.1, seed: 6, coves: [{ at: 0.43, width: 0.26, depth: 0.26 }, { at: 0.43, width: 0.12, depth: 0.13 }] },
    fleetAt: { slots: [[0.16, 0.44], [0.1, 0.38], [0.1, 0.5], [0.05, 0.41], [0.05, 0.47]], h: 0 },
    shoals: [{ x: 0.67, y: 0.34, r: 34, stretch: 2.4, angle: 90, tidal: true }],
    tide: { level: 0.5, turns: [{ at: 80, to: 0.2, secs: 16 }] },
    islands: [{ x: 0.64, y: 0.53, r: 44 }, { x: 0.3, y: 0.16, r: 34, stretch: 1.5, angle: 30 }, { x: 0.36, y: 0.8, r: 40 }],
    forts: [{ island: 0, name: 'the Kasbah', hp: 300, guns: 3, need: 15 }],
    ai: { spread: 0.1, reloadMul: 0.9, dmgMul: 1.54, hpMul: 2.04 },
  },

  // ---------- The Barbary Coast ----------
  {
    id: 'bougie', world: W, region: 'barbary', roman: 'IV', year: 1667, name: 'Becalmed off Bougie', foe: 'Algerine galleys',
    faction: 'barbary', reward: 780, wind: 90, sea: 1.45, breeze: 0.3,
    brief: 'Not a breath of wind in the Bay of Bougie, and the Algerine galleys have found you. Your ships barely carry steerage way; theirs are rowed. Anchor and swing your broadsides onto them, and wait for the breeze.',
    goals: [{ kind: 'sink' }, { kind: 'timer', secs: 170, bonus: true, gold: 150 }],
    enemy: [
      { type: 'galley', name: 'Asad', x: 0.3, y: 0.28, h: 60 },
      { type: 'galley', name: 'Saqr', x: 0.44, y: 0.22, h: 80 },
      { type: 'polacre', name: 'Sa’ada', x: 0.42, y: 0.36, h: 90 },
      { type: 'galley', name: 'Fath', x: 0.16, y: 0.74, h: -30 },
      { type: 'firegalley', name: 'Shihab', x: 0.08, y: 0.64, h: -20 },
    ],
    events: [
      { at: 30, banner: ['More oars round Cape Carbon!', 'Three galleys from the east'],
        spawn: [{ type: 'galley', name: 'Ra’d', x: 0.72, y: 0.08, h: 150 }, { type: 'galley', name: 'Sayf', x: 0.62, y: 0.04, h: 120 },
          { type: 'galley', name: 'Hamza', x: 0.54, y: 0.08, h: 120 }] },
      { at: 70, breeze: 1, wind: 45, banner: ['A breeze at last!', 'Your sails fill: now the galleys are in reach'] },
    ],
    // A flat calm in the corner of a gulf: the Kabylie shore closes the bottom and the right of the chart, Bougie
    // in the corner and Cape Carbon standing out from the right-hand shore. You start becalmed in the gulf with
    // a sandbank across its mouth that the galleys row over and you can't, and three rocky islets about you to
    // anchor behind: pick one so the galleys must come round it into your broadside. The breeze, when it comes,
    // blows you out past the cape.
    fleetAt: { slots: [[0.56, 0.68], [0.46, 0.7], [0.64, 0.74], [0.52, 0.76], [0.42, 0.78]], h: -60 },
    coast: [
      { side: 'right', depth: 0.2, rough: 0.25, seed: 8, capes: [{ at: 0.3, width: 0.12, depth: 0.3 }], coves: [{ at: 0.68, width: 0.3, depth: 0.12 }] },
      { side: 'bottom', depth: 0.14, rough: 0.3, seed: 11, coves: [{ at: 0.6, width: 0.5, depth: 0.08 }], capes: [{ at: 0.06, width: 0.16, depth: 0.06 }] },
    ],
    islands: [{ x: 0.3, y: 0.6, r: 50 }, { x: 0.7, y: 0.58, r: 36, stretch: 1.6, angle: -30 }, { x: 0.46, y: 0.88, r: 30 }],
    shoals: [{ x: 0.5, y: 0.46, r: 46, stretch: 3, angle: -20 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 2.2, hpMul: 3.12 },
  },
  {
    id: 'bagnio', world: W, region: 'barbary', roman: 'V', year: 1667, name: 'The Bagnio of Algiers', foe: 'the Algiers squadron',
    faction: 'barbary', reward: 820, wind: -60, sea: 1.35,
    brief: 'Sixty English seamen lie in the bagnio of Algiers. Silence the battery on the Mole, anchor a ship with marines off the harbour while the boats go in, then see the captives’ boat safely out to sea.',
    goals: [
      { kind: 'rescue', x: 0.38, y: 0.57, r: 0.075, need: 10, fort: 'the Mole Battery', town: 'the bagnio of Algiers', captives: 60,
        boat: { type: 'felucca', name: 'Deliverance', hp: 110 } },
      { kind: 'hunt', ships: 'Asad', bonus: true, gold: 160 },
    ],
    enemy: [
      { type: 'polacre', name: 'Sa’ada', x: 0.6, y: 0.24, h: 90 },
      { type: 'polacre', name: 'Qamar', x: 0.66, y: 0.6, h: 180 },
      { type: 'galley', name: 'Asad', x: 0.44, y: 0.9, h: -60, abilities: { flee: { below: 0.45 } } },
      { type: 'galley', name: 'Saqr', x: 0.74, y: 0.14, h: 90 },
    ],
    events: [
      { at: 55, banner: ['Galleys out of the harbour!', 'The Dey sends his own'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.32, y: 0.62, h: 0 }, { type: 'galley', name: 'Ra’d', x: 0.44, y: 0.64, h: 0 }] },
      { at: 110, banner: ['Polacres from the west!', 'Algiers’ cruisers come home'],
        spawn: [{ type: 'polacre', name: 'Nasr', x: 0.42, y: 0.06, h: 60 }, { type: 'polacre', name: 'Sayf', x: 0.6, y: 0.04, h: 90 }] },
    ],
    // A harbour behind a mole: the white city climbs the left-hand shore, and from it the Mole runs straight out
    // to sea to the Peñón, the lighthouse rock where the Mole Battery stands. The harbour lies in the crook below
    // the Mole, the ring at its heart, so the battery covers it from the end of the arm: silence it, anchor in the
    // crook, and the captives' boat must row out round the Peñón and the whole length of the chart to the open
    // sea at the top, past the reef north of the Mole.
    fleetAt: { slots: [[0.66, 0.78], [0.56, 0.8], [0.76, 0.8], [0.62, 0.86], [0.72, 0.86]], h: -120 },
    coast: { side: 'left', depth: 0.3, rough: 0.1, seed: 2, coves: [{ at: 0.57, width: 0.22, depth: 0.1 }], capes: [{ at: 0.86, width: 0.16, depth: 0.06 }] },
    islands: [{ x: 0.55, y: 0.47, r: 42 }, { x: 0.4, y: 0.47, r: 18, stretch: 6, angle: 0 }, { x: 0.84, y: 0.4, r: 40, stretch: 1.6, angle: 70 }],
    reefs: [{ x: 0.5, y: 0.3, r: 14, stretch: 5, angle: 20 }],
    forts: [{ island: 0, name: 'the Mole Battery', hp: 280, guns: 3, need: 10 }],
    ai: { spread: 0.095, reloadMul: 0.92, dmgMul: 2.68, hpMul: 3.33 },
  },
  {
    id: 'goletta', world: W, region: 'barbary', roman: 'VI', year: 1668, name: 'Fireships at La Goletta', foe: 'the Tunis corsairs',
    where: 'off Tunis', faction: 'barbary', reward: 840, wind: 90, sea: 1.4,
    brief: 'The Tunis corsairs lie moored in the lagoon behind the spit of La Goletta. You have two fireships: they burn whatever they touch. Steer them in over the shallows with the wind behind them and burn the four ships at anchor. They wake when a warship comes close.',
    goals: [
      { kind: 'hunt', ships: ['Mubarak', 'Hilal', 'Asad', 'Nur'] },
      { kind: 'timer', secs: 330 },
      { kind: 'timer', secs: 180, bonus: true, gold: 170 },
    ],
    enemy: [
      { type: 'kalyon', name: 'Mubarak', x: 0.3, y: 0.8, h: 0, abilities: { moored: true } },
      { type: 'polacre', name: 'Hilal', x: 0.46, y: 0.76, h: 0, abilities: { moored: true } },
      { type: 'galley', name: 'Asad', x: 0.6, y: 0.8, h: 180, abilities: { moored: true } },
      { type: 'polacre', name: 'Nur', x: 0.72, y: 0.76, h: 180, abilities: { moored: true } },
      { type: 'galley', name: 'Saqr', x: 0.18, y: 0.5, h: -90 },
      { type: 'galley', name: 'Nasr', x: 0.84, y: 0.52, h: -90 },
      { type: 'galley', name: 'Hamza', x: 0.66, y: 0.46, h: -90 },
    ],
    events: [
      { banner: ['Fireships in company', 'Little Unicorn and Prosperous: steer them like any ship'],
        spawn: [{ type: 'fireship', name: 'Little Unicorn', team: 'player', x: 0.24, y: 0.36, h: 90 },
          { type: 'fireship', name: 'Prosperous', team: 'player', x: 0.34, y: 0.34, h: 90 }] },
    ],
    // A raid on a lagoon: the Lake of Tunis is a round bowl bitten deep into the shore at the bottom of the chart,
    // closed across its mouth by the spit of La Goletta, so it shows as a pond behind a line. The west half of
    // the mouth is a broad sandbank your fireships cross with the wind behind them; the only way in for a ship of
    // the line is the canal at the spit's east end, under the guns of La Goletta. Go in by the canal and draw
    // the fort, or keep the big ships outside and send the fireships over the bank.
    coast: { side: 'bottom', depth: 0.36, rough: 0.12, seed: 4, coves: [{ at: 0.48, width: 0.9, depth: 0.27 }] },
    islands: [{ x: 0.44, y: 0.66, r: 22, stretch: 6, angle: 4 }, { x: 0.62, y: 0.665, r: 34 }],
    shoals: [{ x: 0.17, y: 0.66, r: 46, stretch: 2.6, angle: -4 }],
    fleetAt: { slots: [[0.5, 0.3], [0.42, 0.26], [0.58, 0.26], [0.46, 0.2], [0.54, 0.2]], h: 90 },
    forts: [{ island: 1, name: 'La Goletta', hp: 300, guns: 3, need: 15 }],
    ai: { spread: 0.1, reloadMul: 0.8, dmgMul: 2.45, hpMul: 2.75 },
  },
  {
    id: 'algiers', world: W, region: 'barbary', roman: 'VII', year: 1668, name: 'The Admiral of Algiers', foe: 'Kara Hasan Reis',
    faction: 'barbary', goal: 'boss', hat: 'kalpak', reward: 980, wind: 90, sea: 1.4,
    brief: 'Kara Hasan Reis, Admiral of Algiers, comes out at the head of his line with the wind behind him. His ships fight faster near him; break them apart. A chain of islets runs down the sea between you: pick your gap.',
    goals: [{ kind: 'boss' }, { kind: 'take', ships: 'Sa’ada', bonus: true, gold: 170 }],
    enemy: [
      { type: 'kalyon', name: 'Mubarak', x: 0.4, y: 0.2, h: 60, hp: 720, chasers: 2,
        abilities: { rally: { radius: 210, reload: 0.72 } },
        boss: { captain: 'Kara Hasan Reis', title: 'Mubarak', hat: 'kalpak' } },
      { type: 'polacre', name: 'Sa’ada', x: 0.54, y: 0.2, h: 70 },
      { type: 'polacre', name: 'Qamar', x: 0.34, y: 0.3, h: 60 },
      { type: 'galley', name: 'Saqr', x: 0.62, y: 0.28, h: 80 },
      { type: 'galley', name: 'Nasr', x: 0.8, y: 0.2, h: 100 },
    ],
    events: [
      { bossHp: 0.6, banner: ['The Dey’s galleys row out!', 'Two more from the harbour'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.32, y: 0.14, h: 30 }, { type: 'galley', name: 'Ra’d', x: 0.46, y: 0.18, h: 60 }] },
      { bossHp: 0.3, banner: ['The Mubarak is hulled!', 'Hasan Reis fights on from the quarterdeck'] },
    ],
    // An upwind fight across a chain: the admiral's harbour is tucked into the top-left corner of the chart, and
    // a chain of rocky islets runs from it diagonally down across the sea, reefs filling one of its gaps. His
    // line comes down the wind on your side of the chain; you beat up to him. Each gap you choose splits his
    // line (his ships fight faster near him), and the islets are cover while you claw up to windward.
    fleetAt: { slots: [[0.66, 0.84], [0.56, 0.86], [0.76, 0.86], [0.62, 0.92], [0.72, 0.92]], h: -110 },
    coast: [
      { side: 'left', depth: 0.1, rough: 0.25, seed: 7, coves: [{ at: 0.1, width: 0.1, depth: 0.05 }] },
      { side: 'top', depth: 0.09, rough: 0.2, seed: 17, coves: [{ at: 0.3, width: 0.24, depth: 0.05 }] },
    ],
    islands: [{ x: 0.2, y: 0.42, r: 72, stretch: 1.6, angle: 30 }, { x: 0.48, y: 0.52, r: 54 }, { x: 0.7, y: 0.62, r: 68, stretch: 1.5, angle: 35 }],
    reefs: [{ x: 0.59, y: 0.57, r: 14, stretch: 3, angle: 30 }],
    ai: { spread: 0.095, reloadMul: 1.0, dmgMul: 2.1, hpMul: 3.22 },
  },

  // ---------- Malta and Sicily ----------
  {
    id: 'knights', world: W, region: 'malta', roman: 'VIII', year: 1668, name: 'The Knights’ Galleys', foe: 'Tripoli corsairs',
    where: 'off Valletta', faction: 'barbary', reward: 880, wind: -90, sea: 1.5,
    brief: 'You lie in the Grand Harbour with two galleys of the Knights of St John when a Tripoli squadron is sighted off the mouth. Sortie together and sink them; the Knights fight their own way, but lose either galley and the Grand Master will never forgive you.',
    goals: [
      { kind: 'sink' },
      { kind: 'protect', allies: [
        { type: 'galley', name: 'San Giovanni', faction: 'knights', x: 0.46, y: 0.7, h: -90, hp: 340, up: { marines: 2 } },
        { type: 'galley', name: 'Santa Ubaldesca', faction: 'knights', x: 0.58, y: 0.72, h: -90, hp: 340, up: { marines: 2 } },
      ] },
      { kind: 'take', ships: 'Rih', bonus: true, gold: 150 },
    ],
    enemy: [
      { type: 'polacre', name: 'Nur', x: 0.42, y: 0.4, h: 90 },
      { type: 'polacre', name: 'Shihab', x: 0.72, y: 0.42, h: 120 },
      { type: 'galley', name: 'Asad', x: 0.34, y: 0.44, h: 70 },
      { type: 'galley', name: 'Saqr', x: 0.84, y: 0.32, h: 110 },
      { type: 'tartane', name: 'Rih', x: 0.6, y: 0.48, h: 90 },
      { type: 'galley', name: 'Hamza', x: 0.5, y: 0.38, h: 90 },
    ],
    events: [
      { at: 50, banner: ['Galleys from behind Gozo!', 'They mean to take the Knights in the flank'],
        spawn: [{ type: 'galley', name: 'Fath', x: 0.06, y: 0.36, h: 20 }, { type: 'galley', name: 'Nasr', x: 0.08, y: 0.5, h: 0 }] },
    ],
    // A sortie from a harbour of fingers: Malta's high shore fills the bottom of the chart, cut by two long
    // inlets, Marsamxett and the Grand Harbour, with the thin ridge of Valletta between them and Fort St Elmo on
    // its point. Senglea and Birgu stick up into the Grand Harbour like fingers from its far shore, the dockyard
    // creeks between them. You start inside, and must get the Knights out of the narrow mouth before the corsairs
    // cork it; Gozo and Comino across the channel to the north hide the galleys' second wave.
    fleetAt: { slots: [[0.56, 0.76], [0.52, 0.81], [0.6, 0.83], [0.55, 0.87], [0.6, 0.91]], h: -90 },
    coast: { side: 'bottom', depth: 0.34, rough: 0.08, seed: 1,
      coves: [{ at: 0.2, width: 0.22, depth: 0.2 }, { at: 0.62, width: 0.5, depth: 0.3 }],
      capes: [{ at: 0.68, width: 0.05, depth: 0.14 }, { at: 0.78, width: 0.05, depth: 0.16 }] },
    islands: [{ x: 0.34, y: 0.655, r: 36 }, { x: 0.22, y: 0.16, r: 120, stretch: 1.6, angle: -12 }, { x: 0.54, y: 0.3, r: 36 }],
    forts: [{ island: 0, name: 'Fort St Elmo', hp: 240, guns: 3, need: 10, team: 'player' }],
    ai: { spread: 0.095, reloadMul: 1.0, dmgMul: 2.3, hpMul: 2.8 },
  },
  {
    id: 'passero', world: W, region: 'malta', roman: 'IX', year: 1668, name: 'Storm off Cape Passero', foe: 'Tripoli rovers',
    where: 'off the coast of Sicily', faction: 'barbary', reward: 900, wind: -20, sea: 1.4, weather: 'gale',
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
      { at: 55, breeze: 1.55, fog: 260, wind: -40, banner: ['A gale off Cape Passero!', 'Rain squalls: you can barely see your own bowsprit'] },
      { at: 75, banner: ['Rovers running before the gale!', 'Two polacres out of the murk'],
        spawn: [{ type: 'polacre', name: 'Fath', x: 0.06, y: 0.5, h: 0 }, { type: 'polacre', name: 'Sayf', x: 0.06, y: 0.62, h: -20 }] },
      { at: 135, breeze: 1.1, fog: 0, wind: 10, banner: ['The storm blows through', 'Finish them while the sky clears'] },
    ],
    // A lee shore in a rising gale, cut in two by a finger of rock: Cape Passero runs out from the Sicilian shore
    // on the right most of the way across the chart, with its islet and a reef beyond the tip, so the only way
    // between the two halves is the gap out by the left edge. The rovers come down from the north; the gale
    // blows from the south-west, straight onto the cape's southern face, and the set round the tip
    // (src/sim/flow.js) carries you toward the reef and the rocks. Claw off to the west, or be pinned.
    fleetAt: { slots: [[0.48, 0.84], [0.38, 0.88], [0.58, 0.86], [0.44, 0.94], [0.56, 0.93]], h: -90 },
    coast: { side: 'right', depth: 0.12, rough: 0.3, seed: 12, capes: [{ at: 0.5, width: 0.1, depth: 0.48 }, { at: 0.86, width: 0.2, depth: 0.08 }] },
    islands: [{ x: 0.34, y: 0.5, r: 40 }, { x: 0.16, y: 0.74, r: 36, stretch: 1.5, angle: -20 }],
    reefs: [{ x: 0.25, y: 0.5, r: 12, stretch: 3, angle: 0 }, { x: 0.7, y: 0.7, r: 16, stretch: 2, angle: 10 }, { x: 0.62, y: 0.3, r: 12, stretch: 3, angle: 80 }],
    currents: [{ x: 0.4, y: 0.6, r: 90, stretch: 3, angle: 0, dir: -20, speed: 11 }],
    ai: { spread: 0.09, reloadMul: 0.9, dmgMul: 2.89, hpMul: 3.56 },
  },
  {
    id: 'tripoli', world: W, region: 'malta', roman: 'X', year: 1669, name: 'The Reefs of Tripoli', foe: 'Osman Reis',
    faction: 'barbary', goal: 'boss', hat: 'osman', reward: 1040, wind: 0, sea: 1.4,
    goals: [{ kind: 'boss' }, { kind: 'capture', bonus: true, gold: 180 }],
    brief: 'Osman Reis keeps his galleass behind the reefs that guard Tripoli roads and sends fire galleys out through the gaps. Thread the gaps, sink the fire galleys before they touch you, and bring him to action under the Red Castle.',
    enemy: [
      { type: 'galleass', name: 'Hilal', x: 0.5, y: 0.25, h: 90, hp: 950, chasers: 3,
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
    ai: { spread: 0.09, reloadMul: 0.9, dmgMul: 2.05, hpMul: 2.91 },
  },

  // ---------- The Morea ----------
  {
    id: 'zante', world: W, region: 'morea', roman: 'XI', year: 1669, name: 'The Currant Ships', foe: 'Dulcigno corsairs',
    where: 'between Zante and Cephalonia', faction: 'barbary', reward: 920, wind: 0, sea: 1.5,
    fleetAt: { slots: [[0.38, 0.76], [0.26, 0.8], [0.48, 0.8], [0.2, 0.88], [0.62, 0.9]], h: -90 },
    brief: 'Three Levant Company ships are loaded with Zante currants for the London Christmas puddings. They sail up the channel on their own; the Dulcigno corsairs wait in the coves of the Morea and behind Cephalonia. Two must get through.',
    goals: [
      { kind: 'escort', need: 2, ships: [
        { type: 'merchant', name: 'Levant Merchant', x: 0.32, y: 0.88, h: -90, hp: 200, up: { marines: 2 } },
        { type: 'merchant', name: 'Smyrna Factor', x: 0.44, y: 0.87, h: -90, hp: 200, up: { marines: 2 } },
        { type: 'merchant', name: 'Zante Rose', x: 0.4, y: 0.94, h: -90, hp: 200, up: { marines: 2 } },
      ] },
      { kind: 'hunt', ships: 'Asad', bonus: true, gold: 170 },
    ],
    enemy: [
      { type: 'polacre', name: 'Nur', x: 0.5, y: 0.22, h: 90 },
      { type: 'polacre', name: 'Hilal', x: 0.44, y: 0.1, h: 90 },
      { type: 'galley', name: 'Asad', x: 0.6, y: 0.1, h: 90, abilities: { flee: { below: 0.4 } } },
    ],
    events: [
      { at: 16, banner: ['Galleys from the Morea shore!', 'They lay in wait in the coves'],
        spawn: [{ type: 'galley', name: 'Saqr', x: 0.84, y: 0.36, h: 180 }, { type: 'galley', name: 'Nasr', x: 0.82, y: 0.46, h: 200 },
          { type: 'galley', name: 'Hamza', x: 0.8, y: 0.28, h: 180 }] },
      { at: 40, banner: ['Corsairs from behind Cephalonia!', 'Two polacres come round the island'],
        spawn: [{ type: 'polacre', name: 'Shihab', x: 0.05, y: 0.6, h: -30 }, { type: 'polacre', name: 'Fath', x: 0.3, y: 0.04, h: 30 }] },
    ],
    // Two great islands and the water between: Zante's bulk fills the lower right, Cephalonia's the upper left,
    // and the convoy's road is the diagonal sound between them, past an islet that splits it, to the open sea at
    // the top. The Morea's low shore closes the right-hand edge; corsairs lie in its bays and behind
    // Cephalonia. A current sets up the sound (src/sim/flow.js): it carries the convoy and the corsairs row
    // against it, while the inshore water off either island is slack.
    coast: { side: 'right', depth: 0.03, rough: 0.5, seed: 14, capes: [{ at: 0.18, width: 0.24, depth: 0.12 }] },
    islands: [{ x: 0.12, y: 0.32, r: 96, stretch: 2.4, angle: 72 }, { x: 0.78, y: 0.67, r: 94, stretch: 2, angle: -50 }, { x: 0.5, y: 0.48, r: 40 }],
    currents: [{ x: 0.48, y: 0.5, r: 110, stretch: 5, angle: -72, speed: 9 }],
    ai: { spread: 0.09, reloadMul: 0.88, dmgMul: 2.1, hpMul: 2.53 },
  },
  {
    id: 'navarino', world: W, region: 'morea', roman: 'XII', year: 1669, name: 'Navarino Bay', foe: 'the Ottoman squadron',
    faction: 'ottoman', reward: 960, wind: 180, sea: 1.5,
    brief: 'The Venetian galleass San Marco is trapped in Navarino Bay with you, and an Ottoman squadron is coming in. Cork the mouth of the bay with a ship for twenty seconds, and keep the San Marco afloat until the Venetian fleet arrives. The north channel is too shallow for anything bigger than a sloop.',
    fleetAt: { slots: [[0.46, 0.2], [0.34, 0.2], [0.56, 0.22], [0.4, 0.24], [0.5, 0.25]], h: 0 },
    goals: [
      { kind: 'protect', secs: 160, allies: [{ type: 'galleass', name: 'San Marco', faction: 'venice', x: 0.62, y: 0.2, h: 0, hp: 440 }] },
      { kind: 'reach', x: 0.82, y: 0.42, r: 0.1, secs: 20, label: 'Hold the mouth' },
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
    // A lake with a wall across it: Navarino Bay is a broad sheet of water under the Morea's shore at the top of
    // the chart, and the long, high ridge of Sphacteria lies right across it, so from outside you see only the
    // wall. The wide south entrance is open water off its east end (the gold ring: cork it); at its west end,
    // under the Pylos headland, the north channel is a sandbank only small ships cross. You start inside, with
    // the whole bay to manoeuvre in and the Ottomans coming at the ring from the open sea below.
    coast: { side: 'top', depth: 0.08, rough: 0.15, seed: 15, capes: [{ at: 0.06, width: 0.14, depth: 0.3 }, { at: 0.96, width: 0.1, depth: 0.22 }] },
    islands: [{ x: 0.44, y: 0.4, r: 46, stretch: 6.5, angle: 0 }, { x: 0.8, y: 0.72, r: 40 }, { x: 0.76, y: 0.2, r: 22 }],
    shoals: [{ x: 0.13, y: 0.39, r: 34 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.92, hpMul: 2.3 },
  },

  // ---------- Candia ----------
  {
    id: 'candia', world: W, region: 'candia', roman: 'XIII', year: 1669, name: 'The Walls of Candia', foe: 'the Ottoman siege fleet',
    faction: 'ottoman', hat: 'corno', reward: 1000, wind: 180, sea: 1.3,
    goals: [{ kind: 'hold', secs: 150 }, { kind: 'hunt', ships: 'Kartal', bonus: true, gold: 180 }],
    brief: 'The last summer of the siege. Hold the Sabbionara bastion while the Sultan’s bomb galleys shell it from the sea. Your ships can patch their hulls in the Venetian harbour by lying still in its anchorage.',
    forts: [{ island: 0, name: 'the Sabbionara', hp: 240, guns: 3, need: 10, team: 'player' }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.78, y: 0.22, h: 180, abilities: { mortar: { range: 420, reload: 8, dmg: 15, radius: 32 } } },
      { type: 'galley', name: 'Şahin', x: 0.86, y: 0.5, h: 180, abilities: { mortar: { range: 420, reload: 8, dmg: 15, radius: 32 } } },
      { type: 'kalyon', name: 'Yıldız', x: 0.76, y: 0.78, h: -160 },
      { type: 'kalyon', name: 'Arslan', x: 0.68, y: 0.34, h: 160 },
    ],
    events: [
      { at: 35, banner: ['Bomb galleys from the west!', 'Hunt them before they find the range'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.34, y: 0.05, h: 90, abilities: { mortar: { range: 430, reload: 7, dmg: 20, radius: 36 } } },
          { type: 'galley', name: 'Yunus', x: 0.46, y: 0.04, h: 90, abilities: { mortar: { range: 430, reload: 7, dmg: 20, radius: 36 } } }] },
      { at: 75, banner: ['The Kapudan’s squadron!', 'A kalyon and a galleass bear down'],
        spawn: [{ type: 'kalyon', name: 'Fatih', x: 0.94, y: 0.3, h: 180 }, { type: 'galleass', name: 'Ejder', x: 0.94, y: 0.42, h: 170 }] },
      { at: 100, banner: ['The Santa Giustina!', 'A Venetian galleass comes out to stand with you'],
        spawn: [{ type: 'galleass', name: 'Santa Giustina', team: 'player', ally: true, faction: 'venice', x: 0.5, y: 0.44, h: 0, hp: 380 }] },
      { at: 122, banner: ['The final assault!', 'Fire galleys and the last kalyons'],
        spawn: [{ type: 'firegalley', name: 'Alev', x: 0.94, y: 0.62, h: 180 }, { type: 'kalyon', name: 'Zafer', x: 0.9, y: 0.94, h: -150 }] },
    ],
    // A fortress front: Crete is the left-hand edge, and the walls of Candia jut far out from it as a broad,
    // square bastioned block in the middle of the chart, the Ottoman siege lines dug along the shore above and
    // below it. The little Venetian harbour (repairs) is a notch in the block's face, the Sabbionara bastion
    // stands on its seaward corner below. The Sultan's ships come at it from the open sea on the right, the bomb
    // galleys along the coast from the west (the top); one islet in the roads is the only cover between.
    coast: { side: 'left', depth: 0.1, rough: 0.05, seed: 16, capes: [{ at: 0.5, width: 0.3, depth: 0.3 }], coves: [{ at: 0.45, width: 0.07, depth: 0.12 }] },
    islands: [{ x: 0.42, y: 0.58, r: 40 }, { x: 0.7, y: 0.62, r: 48, stretch: 1.4, angle: 70 }],
    fleetAt: { slots: [[0.56, 0.5], [0.54, 0.42], [0.62, 0.45], [0.58, 0.57], [0.66, 0.53]], h: 0 },
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 1.42, hpMul: 2.19 },
  },
  {
    id: 'dia', world: W, region: 'candia', roman: 'XIV', year: 1669, name: 'Night off Dia', foe: 'the Dia battery',
    faction: 'ottoman', night: true, reward: 980, wind: -45, sea: 1.35,
    goals: [{ kind: 'capture' }, { kind: 'hunt', ships: 'Yıldız', bonus: true, gold: 180 }],
    brief: 'A new Ottoman battery on the island of Dia sinks every relief boat bound for Candia. Take it tonight. Your lookouts see only a little way in the dark, but a burning ship lights up the whole sea, and so does the Venetian lantern on the shore.',
    forts: [{ island: 0, name: 'the Dia battery', hp: 340, guns: 3, need: 15 }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.32, y: 0.15, h: 0 },
      { type: 'galley', name: 'Şahin', x: 0.72, y: 0.16, h: 180 },
      { type: 'kalyon', name: 'Yıldız', x: 0.5, y: 0.12, h: 0, abilities: { moored: { wake: 260 } } },
      { type: 'felucca', name: 'Yunus', x: 0.5, y: 0.56, h: 0 },
    ],
    events: [
      { at: 50, banner: ['Oars in the dark!', 'A night patrol and a galleass come round the island'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.06, y: 0.36, h: 0 }, { type: 'galley', name: 'Ejder', x: 0.94, y: 0.4, h: 180 }, { type: 'galleass', name: 'Sancak', x: 0.5, y: 0.04, h: 90 }] },
      { fortsHeld: 1, banner: ['The Dia battery is ours!', 'Its guns turn on the Sultan’s ships'] },
    ],
    // Night in an archipelago: Dia and a scatter of rocky islets off the Cretan shore, the battery on Dia's
    // seaward side, every islet a place for a galley to lurk in the dark. You come out from the shore at the
    // bottom, where a Venetian lantern lights the water for your lookouts. The tide (src/sim/flow.js) falls at
    // 60 s: until then a sandbar joining Dia's west end to its islet is a short cut for any ship; after, it
    // dries and the way to the battery is round the east end, past the reef.
    fleetAt: { slots: [[0.5, 0.76], [0.4, 0.78], [0.6, 0.78], [0.45, 0.83], [0.55, 0.83]], h: -90 },
    coast: { side: 'bottom', depth: 0.08, rough: 0.3, seed: 17, capes: [{ at: 0.18, width: 0.16, depth: 0.04 }] },
    islands: [{ x: 0.52, y: 0.3, r: 82, stretch: 1.8, angle: 10 }, { x: 0.12, y: 0.22, r: 30 }, { x: 0.86, y: 0.44, r: 32 },
      { x: 0.3, y: 0.52, r: 28 }, { x: 0.7, y: 0.57, r: 36, stretch: 1.4, angle: 30 }, { x: 0.14, y: 0.68, r: 26 }],
    reefs: [{ x: 0.7, y: 0.2, r: 12, stretch: 3, angle: -40 }],
    shoals: [{ x: 0.27, y: 0.265, r: 46, stretch: 2.2, angle: -30, tidal: true }],
    tide: { level: 1, turns: [{ at: 60, to: 0.2, secs: 16 }] },
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 2.8, hpMul: 3.4 },
  },

  // ---------- The Dardanelles ----------
  {
    id: 'narrows', world: W, region: 'dardanelles', roman: 'XV', year: 1670, name: 'The Castles of the Narrows', foe: 'the castles',
    faction: 'ottoman', reward: 1020, wind: -90, sea: 1.3,
    brief: 'The Levant Company’s ships are held at Gallipoli. Run Resolute up the Dardanelles past the castles of Kilitbahir and Çanakkale and out at the top of the chart, with the fleet to draw their fire. The castles’ guns cover the Narrows from both shores.',
    goals: [{ kind: 'breakthrough' }, { kind: 'timer', secs: 150, bonus: true, gold: 190 }],
    enemy: [
      { type: 'galley', name: 'Doğan', x: 0.5, y: 0.5, h: 120 },
      { type: 'galleass', name: 'Ejder', x: 0.28, y: 0.26, h: 90 },
      { type: 'kalyon', name: 'Yıldız', x: 0.6, y: 0.1, h: 90 },
    ],
    events: [
      { at: 35, banner: ['Galleys from Maydos!', 'They row out astern of you'],
        spawn: [{ type: 'galley', name: 'Kartal', x: 0.2, y: 0.82, h: -30 }, { type: 'galley', name: 'Yunus', x: 0.78, y: 0.74, h: -150 }] },
    ],
    // A snaking strait: the European and Asian shores throw long points out across the Dardanelles in turn, so
    // the channel bends right round Kilitbahir's point, back left round Çanakkale's and right again at the top:
    // an S you can't see down. Each castle stands on the tip of its point, at the elbow of a bend, so you round
    // it under its guns at the slowest moment of the turn. The current runs down the strait against you
    // (src/sim/flow.js), strongest in the outside of each bend: cut the corners close under the castles to
    // cheat it, or swing wide and fight the stream.
    fleetAt: { slots: [[0.46, 0.86], [0.36, 0.88], [0.56, 0.9], [0.42, 0.94], [0.52, 0.95]], h: -90 },
    coast: [
      { side: 'left', depth: 0.06, rough: 0.12, seed: 2, capes: [{ at: 0.66, width: 0.13, depth: 0.46 }, { at: 0.12, width: 0.12, depth: 0.24 }] },
      { side: 'right', depth: 0.06, rough: 0.12, seed: 13, capes: [{ at: 0.34, width: 0.13, depth: 0.46 }, { at: 0.9, width: 0.12, depth: 0.24 }] },
    ],
    islands: [{ x: 0.51, y: 0.66, r: 40 }, { x: 0.49, y: 0.34, r: 40 }],
    currents: [{ x: 0.3, y: 0.3, r: 100, stretch: 2.5, angle: 90, speed: 12 }, { x: 0.5, y: 0.5, r: 90, stretch: 2, angle: 50, speed: 11 },
      { x: 0.7, y: 0.7, r: 100, stretch: 2.5, angle: 90, speed: 12 }],
    forts: [
      { island: 0, name: 'Kilitbahir', hp: 280, guns: 3, need: 15 },
      { island: 1, name: 'Çanakkale', hp: 280, guns: 3, need: 15 },
    ],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 2.0, hpMul: 2.6 },
  },
  {
    id: 'kapudan', world: W, region: 'dardanelles', roman: 'XVI', year: 1670, name: 'The Kapudan Pasha', foe: 'Bahri Ömer Pasha',
    where: 'off Tenedos', faction: 'ottoman', goal: 'boss', hat: 'kavuk', reward: 1500, wind: 0, sea: 1.7,
    goals: [{ kind: 'boss' }, { kind: 'take', ships: 'Arslan', bonus: true, gold: 240 }],
    brief: 'Bahri Ömer Pasha, Kapudan Pasha of the Ottoman fleet, comes out of the Dardanelles in his sultana Kara Ejder with galleasses on his wings and galleys behind Tenedos. His ships fight faster near him. Break his line and sink the flagship.',
    enemy: [
      // The Kapudan's sultana carries demi-cannon on both broadsides (src/config/guns.js).
      { type: 'sultana', name: 'Kara Ejder', x: 0.5, y: 0.12, h: 90, hp: 1300, chasers: 3, loadout: { port: 'demicannon', starboard: 'demicannon' },
        abilities: { rally: { radius: 230, reload: 0.75 }, mortar: { range: 460, reload: 9, dmg: 20, radius: 34 } },
        boss: { captain: 'Bahri Ömer Pasha', title: 'Kara Ejder', hat: 'kavuk' } },
      { type: 'galleass', name: 'Sancak', x: 0.38, y: 0.06, h: 70 },
      { type: 'galleass', name: 'Ejder', x: 0.56, y: 0.24, h: 110 },
      { type: 'kalyon', name: 'Arslan', x: 0.46, y: 0.2, h: 90 },
    ],
    events: [
      { at: 35, wind: 45, banner: ['The wind veers!', 'The Ottoman line loses the weather gauge'] },
      { bossHp: 0.65, banner: ['Galleys from behind Tenedos!', 'The Kapudan’s reserve rows into the fight'],
        spawn: [{ type: 'galley', name: 'Doğan', x: 0.16, y: 0.05, h: 30 }, { type: 'galley', name: 'Şahin', x: 0.06, y: 0.56, h: 0 },
          { type: 'firegalley', name: 'Alev', x: 0.06, y: 0.36, h: 30 }] },
      { bossHp: 0.35, banner: ['Venetian galleasses!', 'San Marco and Santa Giustina join the fight'],
        spawn: [{ type: 'galleass', name: 'San Marco', team: 'player', ally: true, faction: 'venice', x: 0.12, y: 0.92, h: -60, hp: 380 },
          { type: 'galleass', name: 'Santa Giustina', team: 'player', ally: true, faction: 'venice', x: 0.56, y: 0.94, h: -110, hp: 380 }] },
    ],
    // The great fleet action, in a wide bay: the Asian shore down the right is scooped out into the great
    // crescent of Besika Bay, with Kum Kale's point at the top where the Kapudan comes out of the Dardanelles and
    // Tenedos lying across the top-left corner, hiding the galley reserve behind it. The crescent's wide water is
    // the widest in the Mediterranean campaign: room for the Ottoman line to come down on you and for you to
    // break it, an islet and a reef to split it, and the bay's banks to drive its heavy ships onto.
    fleetAt: { slots: [[0.46, 0.84], [0.36, 0.86], [0.56, 0.86], [0.41, 0.91], [0.51, 0.91]], h: -90 },
    coast: { side: 'right', depth: 0.34, rough: 0.2, seed: 18, capes: [{ at: 0.06, width: 0.14, depth: 0.08 }], coves: [{ at: 0.56, width: 0.66, depth: 0.28 }] },
    islands: [{ x: 0.18, y: 0.2, r: 100, stretch: 1.8, angle: -10 }, { x: 0.5, y: 0.58, r: 42 }],
    reefs: [{ x: 0.3, y: 0.68, r: 14, stretch: 5, angle: 30 }],
    shoals: [{ x: 0.84, y: 0.56, r: 60, stretch: 2.6, angle: 90 }, { x: 0.36, y: 0.48, r: 40, stretch: 1.6, angle: 40 }],
    ai: { spread: 0.085, reloadMul: 1.0, dmgMul: 1.3, hpMul: 1.68 },
  },
];
