// The captain's log in the Mediterranean (src/config/battles-med.js), merged into STORY (src/config/story.js).
// Same fields: date (day and month; the year is the battle's), before, after, and taunt for a boss; `who` is how
// a sentence names the boss.
// The through-line: retirement does not take. Tangier came to the Crown in the Queen's dowry, and the captain who
// broke La Gran Armada is sent to keep the Straits open: the Salé rovers, Algiers, Tunis and Tripoli, the Knights
// of Malta, the currant ships of Zante, the last summer of Candia, and at the end the Kapudan Pasha. The corsairs
// and the Ottoman admirals are worthy enemies, proud seamen with their own reasons; the jokes are on Hobbs.

export const MED_STORY = {
  tangier: {
    date: '2 March',
    before: 'Retirement lasted eleven weeks. The Queen brought Tangier to the Crown in her dowry, and now the Crown would like someone to keep it. The garrison is building a great stone mole into the bay, and every morning the galleys of Salé row across to see how it is coming along. Hobbs has packed my hats.',
    after: 'The galleys are sunk and the mole still stands, which the engineers took as a compliment to their masonry. A prisoner told us the rovers serve one Reis Ibrahim, a Morisco of Salé, and that he “does not hurry, and does not forget”.',
  },
  gibraltar: {
    date: '19 May',
    before: 'Two Salé polacres snapped up the merchantman Hopewell off Cape Spartel and are running for the Atlantic with a Levanter behind them. The Rock stands over the Straits like a sleeping lion. Hobbs says it looks more like a pudding. Hobbs is hungry.',
    after: 'Both polacres are on the bottom of the Straits. The rovers fought hard and ran harder; one of their captains saluted us before she went down, which I have not seen a Spaniard do. Reis Ibrahim, they say, is waiting for us behind the bar of Salé.',
  },
  sale: {
    date: '30 August', who: 'Reis Ibrahim',
    before: 'Salé sits behind a sandbar no deep-keeled ship can cross, and Reis Ibrahim has crossed it a thousand times. His grandfather was driven out of Spain; he has been collecting the price from Christian shipping ever since. I am told he keeps a very good library.',
    taunt: 'Welcome to Salé, Captain. Many English ships have come to see it. Few have left.',
    after: 'The Burak is sunk and Reis Ibrahim swam ashore, then sent a boat out with his white turban folded on a cushion and a note: “Until the next tide.” Hobbs wants to wear it. Hobbs may not.',
  },
  bougie: {
    date: '11 June',
    before: 'Not a breath of wind in the Bay of Bougie. The sea is a mirror, the sails hang like laundry, and on the horizon I can hear the drums the galley-masters beat to keep the oars in time. They are getting louder.',
    after: 'The breeze came back at last and so did our tempers. The galleys are sunk or scattered. Hobbs spent the whole calm explaining to the crew how he would have rowed the ship himself. Nobody asked him to.',
  },
  bagnio: {
    date: '2 October',
    before: 'Sixty English seamen are held in the bagnio of Algiers, waiting on ransoms that never come. The Admiralty says it cannot spare the money. It can, apparently, spare me. The marines have been told to bring back every man, and not to stop for oranges.',
    after: 'Sixty-one men came off: one of them was a Dutchman who walked out with the rest, and nobody had the heart to send him back. The Deliverance is through, the Mole is silent, and the Admiral of Algiers has sworn to have satisfaction.',
  },
  goletta: {
    date: '14 April',
    before: 'The Tunis corsairs lie snug in the lagoon behind La Goletta, the way Blake found them thirteen years ago. Blake burned them. We have two fireships, a fair wind and a bosun who swears he was at Porto Farina. He was nine years old at the time.',
    after: 'Four corsairs burned to the waterline in the lagoon, and both fireships went in like gentlemen. The smoke could be seen from Carthage, which has seen worse. Hobbs now claims to have been at La Goletta twice.',
  },
  algiers: {
    date: '7 July', who: 'Kara Hasan Reis',
    before: 'Kara Hasan Reis, Admiral of Algiers, has come out at the head of his whole line to settle the matter of the bagnio. He has the wind, the numbers and forty years at sea. I have a great many hats and a bosun.',
    taunt: 'You took my prisoners as a thief takes a purse. Now come and take them as a sailor would.',
    after: 'The Mubarak struck her colours at sunset. Hasan Reis came aboard to surrender his sword, looked round my quarterdeck, and asked which of my officers had taught me to fight. I said the Spanish. He laughed for a long time, and left me his kalpak.',
  },
  knights: {
    date: '25 September',
    before: 'Malta: the Grand Harbour, the honey-coloured walls, and two galleys of the Knights of St John who have offered to show us how war is done in these waters. A Tripoli squadron is off the mouth. The Knights are very keen. The Knights are always very keen.',
    after: 'The Tripoli squadron is beaten and both of the Order’s galleys came home with their prizes and their dignity. The Grand Master sent a cask of wine and a list of advice. The wine was excellent. Word is that Osman Reis of Tripoli has heard of us.',
  },
  passero: {
    date: '16 November',
    before: 'The Tripoli rovers are running down the coast of Sicily and the sky to the south has gone the colour of a bruise. The sailing master says a gale off Cape Passero will set us all on the rocks, friend and foe alike. Hobbs says he has never been seasick. Hobbs is green.',
    after: 'We came through, though the rain was so thick I gave half my orders to the wrong ship. The rovers did not. Hobbs has asked to be put ashore in Syracuse, permanently. Request denied.',
  },
  tripoli: {
    date: '9 March', who: 'Osman Reis',
    before: 'Osman Reis keeps his great galleass behind the reefs that guard the roads of Tripoli, and sends fire galleys out through the gaps like hornets from a nest. He has burned more Christian ships than any captain alive, and they say he prays for every crew he sends to the bottom.',
    taunt: 'Pass through my reefs if you can, Captain. I will pray for you either way.',
    after: 'The Hilal is sunk inside her own reefs. Osman Reis was the last man off her, and he handed me his green turban on the beach like a host seeing out a guest. The Bey of Tripoli has asked for terms. The reefs have asked for nothing; they are reefs.',
  },
  zante: {
    date: '28 May',
    before: 'Zante currants: half of England’s Christmas puddings come from this one island, and the Levant Company would like them to arrive in time. Three fat ships, a narrow channel and every corsair of Dulcigno lying in wait. If the puddings are lost, I am told, Parliament will hear of it.',
    after: 'The currants are through. The merchant captains sent across a crate of them with their compliments; the cook is already making something. Venice has sent word: an Ottoman squadron is closing on Navarino, and a Venetian galleass is caught inside the bay.',
  },
  navarino: {
    date: '17 June',
    before: 'Navarino Bay is a fine harbour with a long island across its mouth, and at present it is a fine trap. The Venetian galleass San Marco and my squadron are inside it, and the Sultan’s ships are coming in. The Venetian captain has offered me his last bottle of Soave. We should earn it.',
    after: 'The Venetian fleet came in at sunset and the Ottomans drew off in good order. The San Marco’s captain kissed me on both cheeks. Hobbs is still recovering. The Venetians ask one more thing: Candia is in its last summer, and its walls need every gun.',
  },
  candia: {
    date: '5 August',
    before: 'Candia has been under siege for twenty-two years. The city is rubble held together by stubbornness, the Sultan’s army has dug right up to the walls, and his bomb galleys shell the Sabbionara bastion from the sea. We are to hold it while the last relief comes in.',
    after: 'The Sabbionara held. The Provveditore, a grey old man in a red velvet cap, climbed down from the ruins to thank us, then took off the cap and put it on my head. “Venice will not need it much longer,” he said. I did not know what to say. For once neither did Hobbs.',
  },
  dia: {
    date: '22 August',
    before: 'An Ottoman battery on the island of Dia is sinking every relief boat bound for Candia. We go in tonight, with no lights and the marines’ boots wrapped in sacking. Hobbs has been told that if he sings, he swims.',
    after: 'The Dia battery is ours and the relief boats got through. Hobbs did not sing. He hummed, which I have decided to allow. It will not save the city, the Provveditore says, but it buys the people time to leave with their heads high.',
  },
  narrows: {
    date: '3 May',
    before: 'Candia has fallen with honour, and the Sultan, in the peace, has held the Levant Company’s ships at Gallipoli against the debts of the war. The Admiralty would like them back. Between us and Gallipoli are the Dardanelles, and the castles that have guarded them for two hundred years.',
    after: 'Resolute ran the Narrows and the castles are still arguing about how. The Levant ships are under our guns. But the Kapudan Pasha himself has come down from Constantinople, and he has sent a message: he will meet us off Tenedos, “so that the matter may be settled as between seamen.”',
  },
  kapudan: {
    date: '21 June', who: 'Bahri Ömer Pasha',
    before: 'Bahri Ömer Pasha, Kapudan Pasha of the Ottoman fleet, has come out of the Dardanelles with his whole line: the sultana Kara Ejder, galleasses on his wings and galleys behind Tenedos. He fought at Candia for twenty years and never once ran. Every hat in my cabin has been brushed. Hobbs has polished his buttons.',
    taunt: 'You fought well at Candia, Captain. Fight well today, and whatever happens, it will be remembered.',
    after: 'The Kara Ejder struck at dusk, and the Kapudan Pasha came across in his barge to give up his plumed kavuk with his own hands. We drank coffee on my quarterdeck while the Levant ships sailed past for home, and he told me that the sea does not belong to anyone, it only lets us visit. I have twelve hats and nothing more to prove. Hobbs says that is what I said last time.',
  },
};
