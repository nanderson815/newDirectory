// Who a battle's enemy is (`faction` on a battle; without it, the world's default). The sim and the screens take
// their words from here; the renderer takes a ship's look from it (src/render/models.js shipLook: a faction it
// has no look for yet sails under the plain enemy colours).
//
//   adj       an adjective for ships and boarders ("Spanish boarders!", "Every corsair ship is on the bottom")
//   the       the enemy as a whole in a sentence ("The garrison now fires on the corsairs")
//   side      what a captured ship now fights for ("She fights for Spain now")
//   flagship  the boss card's kicker ("The enemy flagship is sighted")
export const FACTIONS = {
  spain: { adj: 'Spanish', the: 'the Spanish', side: 'Spain', flagship: 'The enemy flagship' },
  pirate: { adj: 'pirate', the: 'the pirates', side: 'the Brethren', flagship: 'The pirate queen' },
  barbary: { adj: 'corsair', the: 'the corsairs', side: 'the corsairs', flagship: 'The corsair flagship' },
  ottoman: { adj: 'Ottoman', the: 'the Ottomans', side: 'the Sultan', flagship: 'The Sultan’s flagship' },
};
export const factionOf = (id) => FACTIONS[id] || FACTIONS.spain;
