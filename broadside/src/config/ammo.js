// Shot types. Every ship carries round shot; chain and grape are bought per ship at the shipyard.
//   hull:  damage multiplier against hulls and forts
//   range: multiplier on the ship's gun range
// Chain shot tears rigging (the target sails slowly for `slow` seconds). Grapeshot fires a spray of pellets
// that kill crew: each pellet costs the target a marine and slows its reloading a little.
export const AMMO = {
  round: { name: 'Round shot', short: 'Round', desc: 'Solid iron balls that smash hulls.', hull: 1, range: 1 },
  chain: { name: 'Chain shot', short: 'Chain', desc: 'Tears rigging. The target crawls for a few seconds.', hull: 0.45, range: 0.85, slow: 6 },
  grape: { name: 'Grapeshot', short: 'Grape', desc: 'Short-range spray that cuts down crews before boarding.', hull: 0.3, range: 0.6, pellets: 3 },
};
export const AMMO_ORDER = ['round', 'chain', 'grape'];
export const AMMO_COSTS = { chain: 140, grape: 140 };

// Boarding: lash alongside a crippled enemy and send the marines over.
export const BOARDING = {
  hpFrac: 0.4,       // the enemy must be at or below this share of its hull
  reach: 0.45,       // centres within (L1 + L2) * reach
  time: 4,           // seconds of fighting on deck
  prizeGold: 40,     // prize money per captured ship, paid with the battle reward
};
