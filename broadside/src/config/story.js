// The captain's log: one entry before each battle and one after a win, plus what each boss shouts on the
// intro card. Keyed by battle id (see battles.js); the year comes from the battle, the day and month from here.
// `her: true` marks a boss the text should call "her"; `who` is how a sentence names the boss, if not by name.
// The through-line: a junior English captain at newly taken Port Royal (1655) works up from a borrowed sloop
// to breaking La Gran Armada (1665), collecting a captain's hat from every enemy flagship along the way.

export const STORY = {
  tutorial: {
    date: '14 May',
    before: 'Port Royal is ours, or at least the parts of it that are not swamp. The Admiral has lent me the sloop Swift and a crew who mostly know which end of a cannon goes bang. Bosun Hobbs swears he can teach me to sail her by suppertime.',
    after: 'Swift answers the helm like a well-bribed customs man, and the old hulk is firewood. Hobbs presented me with his own cap “for the collection”. I did not know I had a collection. I do now.',
  },
  tortuga: {
    date: '2 August',
    before: 'Two Spanish brigs are stopping every English hull that tries the Tortuga Narrows. The Admiral wants them gone, and the squadron is finally mine: Resolute, Swift and Kestrel.',
    after: 'The Narrows are open and both brigs are on the bottom. The buccaneers of Tortuga cheered us from the cliffs. I suspect they cheer anyone who sinks anyone.',
  },
  cayman: {
    date: '19 February',
    before: 'Three brigs have gone to ground among the Cayman shoals, where the turtles outnumber the soundings on my chart. Hobbs says the reefs bite harder than the Spanish. Hobbs says a great many things.',
    after: 'Three brigs sunk, no reefs struck, and one deeply offended turtle. The prisoners say their master is a Capitán Rojo, who “will not be pleased”.',
  },
  rojo: {
    date: '7 June',
    before: 'Capitán Rojo has boasted in every tavern from Havana to Santiago that no English ship can catch La Bruja. Today we find out. They say his red tricorne can be seen from three leagues off.',
    taunt: '¡Ingleses! I shall use your sails for handkerchiefs!',
    after: 'La Bruja is sunk and Rojo was fished out of the sea, sulking. His red tricorne now hangs in my cabin. It is even redder up close, and smells of garlic.',
  },
  sanlucas: {
    date: '11 March',
    before: 'With Rojo gone, Spain is hiding behind stone walls. Fort San Lucas guards the best anchorage on the Main, and the marines have been sharpening things all week.',
    after: 'Fort San Lucas flies the cross of St George, and its garrison has discovered a sudden love of English cooking. A captured letter speaks of a silver fleet sailing north.',
  },
  silver: {
    date: '28 August',
    before: 'The letter was right: a treasure convoy is running north with the trade wind behind it. Parliament would very much like that silver. So, frankly, would the crew.',
    after: 'The silver fleet is scattered and the purser cannot stop smiling. El Comodoro, who was meant to be guarding it, has sworn a terrible oath. I am told he swears one most mornings.',
  },
  comodoro: {
    date: '4 April',
    before: 'El Comodoro has tucked San Cristóbal between two forts and dares us to come in. He is a careful man, and careful men hate surprises.',
    taunt: 'Come closer, little English. My forts have been so very bored.',
    after: 'San Cristóbal is sunk, her forts are silent, and El Comodoro’s bicorne fits me rather well. Hobbs says it makes me look taller. Hobbs wants a raise.',
  },
  cartagena: {
    date: '16 October',
    before: 'Cartagena, jewel of the Spanish Main. Its harbour fort is the key to the Golden Isles, and taking it will need every marine we have. The cook has volunteered his cleaver.',
    after: 'Fort San Felipe is ours and the cook has retired his cleaver with honours. From the walls we could see the twin towers of Santa Marta glowering up the coast.',
  },
  santamarta: {
    date: '1 May',
    before: 'The twin towers of Santa Marta cover each other like quarrelling brothers. Take one and the other shoots you in the back, so we must take both.',
    after: 'Both towers have fallen and the brothers are finally quiet. Word is that Spain has sent its proudest admiral, the Almirante de Oro, to put us in our place.',
  },
  oro: {
    date: '22 September',
    before: 'The Almirante de Oro sails the Santísima Trinidad, a man-o’-war with more gilding than a cathedral. He leaves mines in his wake the way a dog leaves surprises on a lawn.',
    taunt: 'Kneel, Englishman. Spain does not lose to shopkeepers.',
    after: 'The Santísima Trinidad is gone, and Spain’s Caribbean squadron with her. The Admiral sent over a whole cask of claret. I have a plumed hat now, and something of a reputation.',
  },
  cove: {
    date: '9 June',
    before: 'News from home: the King is back on his throne, and the Lord Protector’s portraits are coming down all over Port Royal. Our orders have not changed, but our enemies have. With Spain humbled, the Brethren of the Coast have come out to play.',
    after: 'Four schooners sunk among the reefs of Smugglers’ Cove. A captured pirate swore we would answer to Calico Kate, then asked whether we were hiring.',
  },
  wreck: {
    date: '3 November',
    before: 'A treasure galleon has broken her back on the shoals, and her chests are bobbing about like apples in a barrel. Every pirate in the Caribbean has smelt it. We mean to fish first.',
    after: 'The chests are aboard and the pirates are swimming home. One chest held nothing but Spanish love letters, which the crew are now reading aloud. Loudly.',
  },
  kate: {
    date: '18 April', her: true,
    before: 'Calico Kate, queen of the Brethren, has sworn to burn my squadron to the waterline. She sends fireships ahead of her Black Wyvern, which is cheating, and she knows it.',
    taunt: 'Nice hats, Captain. Mine’s better. Come and take it.',
    after: 'The Black Wyvern is sunk and Kate rowed away laughing, minus her hat. She has a spare, I am told. Her crew say Spain has been paying the raiders, and that an old enemy is stirring in the west.',
  },
  convoy: {
    date: '12 January',
    before: 'Two fat merchantmen are carrying the colony’s silver home to Jamaica, and Spanish raiders want it back. The merchant captains have promised to sail straight and not argue. They are already arguing.',
    after: 'The convoy made Port Royal with its silver, and its captains, intact. They wrote to the Governor praising my seamanship, then sent me the bill for a scratched figurehead.',
  },
  siege: {
    date: '30 July',
    before: 'Spain has come for Port Royal itself. Bomb ketches are lobbing shells at Fort Charles, and the taverns along the harbour are, alarmingly, still open. Hold the fort.',
    after: 'Fort Charles stands and the siege fleet has fled. The taverns never closed once. Captured orders name the man behind it all: the Marqués de Hierro, waiting in the Bay of Campeche.',
  },
  hierro: {
    date: '5 March',
    before: 'The Marqués de Hierro wears an iron helmet in the tropics and has bolted mortars to his galleon. Watch for his red rings, and close in before he finds the range.',
    taunt: 'Hold still, Englishman. It makes the arithmetic so much easier.',
    after: 'San Jerónimo is sunk and the Marqués has handed over his helmet, which is surprisingly heavy and very hot. Spain is down to its last card: La Gran Armada has put to sea.',
  },
  fog: {
    date: '20 February',
    before: 'A fog off the Mosquito Coast so thick the lookouts cannot see their own feet. Somewhere in it, a squadron of oared xebecs is scouting for the Armada. Keep close and keep quiet.',
    after: 'The xebecs are sunk and the fog has lifted. Now we know where the Armada waits: strung right across the strait.',
  },
  blockade: {
    date: '9 August',
    before: 'The Armada has drawn a line of galleons across the strait. Resolute must slip through and bring the Admiral a count of their ships, while the rest of us make a great deal of noise.',
    after: 'Resolute broke the line and the Admiral has his count. It is a large number. He read it twice, then called for more powder, and more claret.',
  },
  armada: {
    date: '23 April', who: 'the Capitán General',
    before: 'This is it. The Capitán General flies his flag in the Real Felipe under the guns of the Castillo del Morro, with the whole Armada around him. Every hat in my cabin has been dusted for luck.',
    taunt: 'I have sunk finer fleets than yours before breakfast. Today, I skip breakfast.',
    after: 'The Real Felipe is sunk and La Gran Armada is scattered to the four winds. The Capitán General’s crown hat sits at the head of my collection, and the Caribbean is England’s. Hobbs says we should retire. Hobbs, I suspect, wants my cabin.',
  },
};

// "14 May 1655" style date for a log entry.
export const logDate = (id, year) => (STORY[id] ? `${STORY[id].date} ${year}` : String(year));
