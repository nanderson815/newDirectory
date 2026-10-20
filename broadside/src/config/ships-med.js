// Ship classes of the Mediterranean, merged into TYPES (src/config/ships.js). Same fields as there; on top:
//   chasers   bow guns every ship of the class carries (a battle's ship def can still set its own)
//   plural    how the briefing's roster names several ("three war galleys")
//   shallow   draws little water: crosses shoals whatever her length
//   faction   who sails her by default, for the art (render/models.js may give each faction its own look)
// Sized against the West Indies classes in ships.js: if those are rescaled, scale these with them.
//
// What makes each play differently:
//   galley      rowed (keeps way in a calm), no broadside to speak of but a battery of bow guns, a ram and a
//               deck packed with fighting men who grapple and board any English ship they can catch hurt
//   galleass    a great rowed hulk: broadsides and a bow battery both, slow to turn, very hard to sink
//   polacre     the corsairs' fast square-and-lateen raider; boards eagerly
//   tartane     a small lateen coaster: quick, nimble, light guns
//   felucca     the fastest thing afloat, oars and a lateen; a scout and a runner (also the captives' boat)
//   kalyon      the Ottoman two-decker: a stout broadside ship
//   sultana     an Ottoman ship of the line, the Kapudan Pasha's kind of flagship
//   firegalley  a fireship that rows: she comes at you in a flat calm
export const MED_TYPES = {
  galley: {
    label: 'War galley', plural: 'war galleys', faction: 'barbary', L: 72, B: 16, hp: 85, guns: 1, reload: 3.2, speed: 50, turn: 1.25,
    range: 210, masts: 2, marines: 42, rig: 'lateen', chasers: 3, shallow: true,
    abilities: { oars: { min: 0.96 }, ram: { dmg: 22, charge: 220 }, grapple: true },
  },
  galleass: {
    label: 'Galleass', plural: 'galleasses', faction: 'ottoman', L: 96, B: 30, hp: 200, guns: 5, reload: 3.4, speed: 38, turn: 0.55,
    range: 260, masts: 3, marines: 46, rig: 'lateen', chasers: 3, abilities: { oars: { min: 0.9 } },
  },
  polacre: {
    label: 'Polacre', plural: 'polacres', faction: 'barbary', L: 64, B: 20, hp: 80, guns: 3, reload: 2.4, speed: 64, turn: 1.3,
    range: 235, masts: 3, marines: 24, rig: 'lateen', abilities: { grapple: { below: 0.5 } },
  },
  tartane: {
    label: 'Tartane', plural: 'tartanes', faction: 'barbary', L: 50, B: 17, hp: 52, guns: 2, reload: 2.2, speed: 66, turn: 1.6,
    range: 215, masts: 2, marines: 14, rig: 'lateen',
  },
  felucca: {
    label: 'Felucca', plural: 'feluccas', faction: 'barbary', L: 44, B: 13, hp: 36, guns: 1, reload: 2.0, speed: 76, turn: 1.9,
    range: 190, masts: 2, marines: 10, rig: 'lateen', abilities: { oars: { min: 0.8 } },
  },
  kalyon: {
    label: 'Kalyon', plural: 'kalyons', faction: 'ottoman', L: 94, B: 34, hp: 165, guns: 6, reload: 3.3, speed: 44, turn: 0.66,
    range: 270, masts: 3, marines: 32,
  },
  sultana: {
    label: 'Sultana', plural: 'sultanas', faction: 'ottoman', L: 108, B: 38, hp: 235, guns: 7, reload: 3.4, speed: 41, turn: 0.58,
    range: 285, masts: 3, marines: 44, chasers: 2,
  },
  firegalley: {
    label: 'Fire galley', plural: 'fire galleys', faction: 'barbary', L: 58, B: 15, hp: 44, guns: 0, reload: 9, speed: 58, turn: 1.45,
    range: 0, masts: 2, marines: 0, rig: 'lateen', abilities: { fireship: { dmg: 50 }, oars: { min: 0.96 } },
  },
};
