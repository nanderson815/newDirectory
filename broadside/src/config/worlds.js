// Worlds: the campaign is told in seas. Each world is its own run of battles with its own chart, regions and
// hats; battles carry `world` (src/config/battles.js merges every world's list into BATTLES, so a battle's index
// is stable across builds and saves keep working). Progression is per world: inside a world each battle opens
// once the one before it is won, and a world's first battle opens once its `unlock` battle is won.
//
//   id        what battles and regions carry in `world`
//   name      how the chart and the cabinet title it
//   short     a short name for links and buttons
//   years     the span of its campaign, for the chart's imprint
//   blurb     one italic line about it
//   unlock    { won: battle id } that opens it (none: open from the start)
//   finale    the title on the results sheet when its last battle is won
//   faction   the default enemy faction of its battles (see src/config/factions.js)
export const WORLDS = [
  {
    id: 'caribbean', name: 'The West Indies', short: 'West Indies', years: '1655–1665',
    blurb: 'The sea-fights of an English captain in the West Indies, and the hats he took.',
    unlock: null, finale: 'The sea is England’s!', faction: 'spain',
  },
  {
    id: 'med', name: 'The Mediterranean', short: 'Mediterranean', years: '1666–1670',
    blurb: 'Tangier, the Barbary corsairs, the Knights of Malta, the war of Candia and the Kapudan Pasha.',
    unlock: { won: 'armada' }, finale: 'Peace in the Middle Sea!', faction: 'barbary',
  },
];

export const worldById = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];
export const DEFAULT_WORLD = WORLDS[0].id;
