# Broadside: feel and taste

The bar: it should feel like a small, expensive game. Calm when you look at it, crisp when you touch it,
dramatic when ships trade broadsides. Every element earns its place on a phone screen.

## What's wrong today
- **Cramped.** The camera shows the whole sea at once, so ships are ~60px, the fight clumps in one corner,
  half the screen is empty water and ships grind into islands.
- **Repetitive.** Every map is round islands sprinkled on open water; every fight is ships circling and
  auto-firing. Few decisions, little geography.
- **Jank controls.** You must start a drag exactly on a small ship; the drawn line isn't the path the ship
  will actually sail; anchoring is a hidden hold gesture; you can't simply say "attack that ship".
- **No taste.** Heavy dark pills, cartoon outlined text, big grey firing wedges, many competing styles, no
  hierarchy, no motion design.

## Direction
**A diorama at sea.** Toy-like ships on a living ocean, seen by a camera with intent. Restraint over clutter.

### Camera and space
- The sea is bigger than the screen. A *director camera* frames what matters (the selected ship and whatever
  threatens it), easing smoothly (critically damped, no jitter), leading in the direction of travel.
- Pinch to zoom, two fingers to pan; double-tap empty sea to hand control back to the director.
- Off-screen enemies show as small chevrons on the screen edge. No minimap clutter.
- A short establishing move at battle start (sweep over the enemy, settle on your fleet).

### Controls (one thumb)
- A battle opens with your flagship selected. Tap a ship of yours to select it; tap her again (or her row in the dock)
  to let go of her. With nothing selected one finger pans the view (it coasts on when let go), taps on the sea order
  nothing, a tap on an enemy names her, the action bar goes and the director eases to a calm overview of the fleet
  and the nearest enemy, holding wherever you panned until you take command again or double-tap the sea.
- Drag *anywhere* on the sea to plot the selected ship's course; starting on another of your ships selects
  it first. Tap the sea to sail straight there.
- Tap an enemy to **engage**: the ship manoeuvres on its own to keep that target on the beam.
- **Whole fleet** (a row under the dock): a course is sailed by the chosen ship with the rest in **line ahead**, each in
  the wake of the ship ahead of her, 1.8 mean lengths apart (or **abreast** on her beams: the two words under the row
  choose); the head of the line shortens sail to the slowest ship's pace. A whole-fleet engage spreads the ships
  round the target, each on her own arc of sea at her own range, instead of all chasing round one ring.
- Ships never grind into each other: every captain (yours and theirs) gives other ships room before they touch,
  altering to starboard when two meet head on, and easing sail to let a crossing ship by. Friends keep a
  comfortable distance; enemies may close to board or ram.
- The course preview is the track the ship will *really* sail (turning circle and island avoidance included),
  drawn as a soft ribbon on the water with a small end marker.
- A compact contextual action bar for the selected ship: Anchor (then drag to turn on the spot), Fire
  port/starboard (manual mode), shot type, Mine, Board, Land troops. No hidden gestures.
- Haptic ticks (where supported) on select, fire and hits taken.

### Combat with decisions
- **Raking fire:** shots that land along the bow or stern do much more damage. Crossing the enemy's bow
  or stern is the move to learn.
- **Critical hits** with visible results: a falling mast (slow), a shot-away rudder (sluggish helm),
  fire aboard (damage over time until it's out).
- **Geography:** shoals that ground big ships but let sloops through, reefs, coastlines along a map edge,
  narrow channels. Varied start setups (ambush from the flank, an enemy astern).

### Guns and slots
The reward for beating the Armada is a ship to tinker with: the **great ship**, a first rate, the one class whose
guns are fitted slot by slot (the rest of the fleet keeps the simple ledger upgrades, so the early game stays
quick). Each gun is a real trade, never a straight upgrade (numbers in `src/config/guns.js`):
- **Long guns** (culverins) reach furthest; the dependable line. **Demi-cannon** for the lower tier hit half again
  as hard but load slowly and weigh half again as much.
- **Carronades** for the upper tier: half the reach, nearly twice the ball, quick to load, light. They hold fire
  until the enemy is close, so a carronade ship has to be sailed in. Fitting one side with carronades and the other
  with long guns makes which side you show a decision.
- **Swivel guns** on rails and decks fire grape on their own at pistol shot, cut down crews and stiffen her against
  boarders: a deterrent, not a weapon.
- **Chase guns** fore and aft fire on their own in narrow arcs: bow chasers for the ship you are running down,
  stern chasers for whoever tries to cross your stern (the move the game teaches; now it has a price).
- On deck, a **sea mortar** (the bomb ketch's, with its least range) or a **fire-pot engine**, short-ranged, whose
  pots set ships burning. Both are heavy enough that you can't have everything.
- **Weight** is the budget: the great ship carries 92 tons of guns, and every ton slows her and widens her turn.
  A carronade brawler is the fastest great ship; demi-cannon and a mortar make the slowest.
- Enemies use the same pieces: Calico Kate's carronades to larboard, Spain's own great ship at the Armada.

The battle HUD shows this without new chrome: the Fire tile's reload rule splits into one segment per battery on
that side, each lit gilt as it loads (a tap fires what is loaded), and the chosen ship's arcs show a rim for each
reach. The shipyard shows her in 3D in her berth and lists the gun decks in the ledger (see Composition), on the same
data (`loadout` and `look` in the save, `render` hints on each gun).

### Look
- Ships dress (`src/config/looks.js`): paint schemes, canvas, a device on the courses, figureheads, a pennant or an
  admiral's flag with a great ensign aft, stern lanterns and gilding. Whatever she wears, her side shows: an English
  ship keeps a blue rail, blue colours and canvas edged in blue (or the squadron's blue band); the enemy keeps red
  (gilt for a boss, black for pirates). Enemies dress from their faction's palette so no two of a class match; bosses
  dress as themselves, and you win their style with their hat.
- One palette: the sea, cream sails and warm wood in the world; ink, rag paper and one printer's red for everything
  read or pressed; enemy red, English blue.
- Type: the Fell types for titles and labels, EB Garamond for reading (see Style). No outlined cartoon text in
  the HUD; use soft shadows and good contrast instead.
- HUD: minimal and contextual. A slim fleet dock, a quiet objective line, a small elegant wind compass.
  Firing arcs only when useful, drawn as thin lines, not grey wedges.
- Motion: everything eases. Banners glide; buttons press; menus transition; numbers tick.
- Juice where it matters: a heavy broadside lands with a beat of hit-stop, splinters, a camera nudge.
- Land is a place, not a blob: each region has its own look (English hills and timber towns at Port Royal, cliffs
  and pines on the Windward Passage, whitewash and terracotta on the Main, jungle and ruins in the Golden Isles,
  shanties and Skull Rock on the Pirate Coast, mangroves and fishing villages in Campeche, El Morro and a pastel
  city for the Armada). Detail rewards zooming in: smoke, flags, gulls, people. Zoomed out the land stays quiet.
- **The Mediterranean is its own world**, drier and brighter than the Indies, never a reskin of them. Its sea is
  clearer and deeper blue with wide turquoise shallows and more sun dancing on it (`sparkle`, `clear` in
  `src/config/weather.js`), each region with its own light: a Med noon in the Straits and Malta, a hot white haze on
  the Barbary coast, the meltemi's white horses in the Morea and the Dardanelles, a low gold sun through the smoke at
  Candia, a gale off Cape Passero and a moonlit night off Dia (lanterns, windows and fires glow; every broadside lights
  the sea). Its land: Gibraltar's pale limestone and umbrella pines; ochre Barbary hills, date palms and whitewashed
  kasbah towns of flat-roofed cubes under minarets; Malta's honey limestone, small fields and domed church behind
  bastioned walls; olive orchards in rows, cypresses and white chapels in the Morea; Candia's Venetian stucco and
  campanile behind its great walls, the Turkish trenches and tents beyond; Turkish timber towns, pencil minarets and
  green hills on the Dardanelles. Its ruins are classical columns, its windmills white with cloth sails, its lights
  stone lanterns. Its ships are lateen and oar: long low galleys with their rowing frames, benches, spur and striped
  poop tents, high-charged Ottoman ships with a pavilion on the poop. The sides dress respectfully in period colours:
  the corsairs bright-painted with striped lateens and the flags of the coast (Algiers' red, gold and green, the
  crescent of Tunis and Tripoli, Zulfiqar), the Sultan's ships red with three crescents, the Kapudan Pasha black and
  gilt under his dragon; your allies fly St Mark's lion (Venice) and the Order's cross (the Knights), with a
  friend's blue rail.
- Land that matters reads at a glance: calm water in the lee of high land, buoys round a harbour's anchorage,
  a town that burns when shot lands on it. Anything ships can't cross is inside the outline they collide with.

## Style
The rulebook for everything drawn on screen. Values live in `src/ui/tokens.js` (set on `:root` as CSS custom
properties at boot, exported as JS for the canvas); icons in `src/ui/icons.js`; the canvas HUD kit in
`src/hud/style.js` (demo: `tests/kit/`, screenshots: `node tests/kit-shot.mjs`). Screenshots of every menu at three
sizes: `node tests/taste-shots.mjs <dir>` after `npx vite build --mode single`.

**Idea: printed matter from Port Royal, 1655.** Everything you read is a sheet of rag paper printed in ink from the
Fell types, with one red. The sea stays in the picture underneath. Hierarchy comes from type, rules and space, never
from boxes, gradients or badges. If a choice would not have been possible in a 1650s printing house (a gradient, a
pill, a glow, a drop shadow on type), it needs a very good reason.

### Rejected on the way here
Three directions were mocked up (`shots/taste2/directions/`). *Night watch* set cream type straight on a darkened
sea: cinematic on the title, but the brief and shipyard became a generic dark luxury app. *Delft* (cobalt on
tin-glaze white, painted tile corners) was distinctive but cold against the warm toy ships, fought the coloured hats
and read like stationery. *Broadsheet* won: it is the only one with a point of view that runs from the title page to
the ledger, and it gives the game a voice (the imprint line, "Hove to", "A Cabinet of Hats").

### Surfaces
- **Sheet.** Flat rag paper (`paper` `#efe5cf`) with a faint tooth, cut square (2 px radius), and a printed
  thick-and-thin rule 8 px inside the edge. It is the only thing with a shadow, because it lies on the sea. Briefing,
  results, shipyard, hats, pause, settings and the boss notice are sheets; the title page is a sheet docked under the
  sea (down the left in landscape).
- **Ink.** Solid ink (`ink` `#211a14`) is what you press: the main button on a sheet, and every HUD control on the
  sea (as an ink slip at 90%). On ink, type is paper-coloured.
- **The sea** under a menu is dimmed and darkened at the edges like an old print (`.overlay`); the HUD canvas is
  hidden while any menu is up (`html.menus`), so no labels or bars show through. The chart has no live sea behind
  it: the map lies on a dark ground (`night`), with its chrome set in paper-coloured type.
- No cards inside sheets. A group is separated by a hairline rule (`paperLine`, 16% ink) or by space.

### Colour
| Role | Token | Value |
|---|---|---|
| Paper, a shade, a fold | `paper`, `paper2`, `paper3` | `#efe5cf` `#e6d9bb` `#d6c39b` |
| Ink and its tints (text, secondary, tertiary) | `ink`, `ink2`, `ink3` | `#211a14` `#5b4e42` `#86786a` |
| The one red, on paper / on ink or sea / deep | `red`, `redHi`, `redDeep` | `#a3271c` `#e0573c` `#7a1c13` |
| Rules on paper | `paperRule`, `paperLine` | ink at 40% / 16% |
| On ink (text, secondary, tertiary, hairline) | `onGlass`..`onGlass3`, `glassLine` | paper at 100 / 74 / 50 / 16% |
| Night (chart ground) | `night`, `night2` | `#121a1d` `#1b2529` |
| Sides | `blue` (English) / `redHi` (enemy) | `#2f5d9a` / `#e0573c` |
| Hull | `hpHigh` / `hpMid` / `hpLow` | `#86b06a` / `#d9a441` / `#e0573c` |
| Gold | `gold` | coins only (on the sea, `MARK.chosen` is a pale gilt `#f2d48c`) |

**The red is spent once a screen**: the wordmark on the title page, the initial letter of the captain's log on the
brief, "Victory!" on the results, the boss's name on the boss notice, the next battle (its roundel, name and the
leg ahead) on the chart. In battle red means the enemy (see Battle HUD). Everything else is ink. Gold is no longer an accent; the
`gold*`, `teal*`, `terracotta*` and `crimson*` palette keys survive only so older code keeps working.

### Type
- **IM Fell English** (the Fell types, cut for Oxford in the 1670s): the wordmark, sheet titles, ship and hat names,
  prices and big figures. Roman and italic, one weight; never bolded, never tracked wide.
- **IM Fell English SC**: button labels (its lowercase are small capitals). Offline, `html.no-fell-sc` asks the
  browser for small caps instead.
- **EB Garamond**: everything you read, 17 px body (Garamond is small on its body), with real small capitals
  (`font-variant-caps: all-small-caps`, +0.06em) for kickers, run-in heads, links, labels and tabs, and oldstyle
  figures throughout (tabular where figures line up: prices, stats).
- One Google Fonts stylesheet (`FONT_URL`), and nothing else; offline fallbacks keep an old-style book face: Hoefler
  Text, Iowan Old Style, Palatino, Book Antiqua, Georgia.
- Scale (px / line-height): hero 76/0.9 (wordmark, fluid 56–86), display 44/1 (sheet titles, fluid from 34), h1 36,
  h2 26, h3 20, body-lg 19/1.42 (the log), body 17/1.42, small 15/1.35, caption 14. Buttons 20 (17 small).
- Rules of craft: headings `text-wrap: balance`, paragraphs `pretty`; hanging punctuation where supported; the log
  opens with a three-line drop initial in Fell red; numbers in words up to twelve in prose ("two schooners"); no
  uppercase-tracked eyebrow labels: at most one small-caps kicker a sheet ("The twelfth engagement").
- No outlined text anywhere. On the sea, paper-coloured type gets a two-pass soft ink halo (`text()` in the kit,
  halo `soft`/`strong`).

### Composition
- **Title page**: the live sea is the picture. Under it: the wordmark in red, one italic line ("The sea-fights of an
  English captain in the West Indies and the Middle Sea, and the hats he took."), one fleuron, one ink button (Continue / Set sail), two
  small-caps links (New campaign, Settings) and the imprint ("Port Royal: printed for the Admiralty, 1655."). Settings
  live on their own small sheet.
- **Brief**: kicker, title, an italic dateline ("off the Pirate Coast, 18 April 1661"), then the captain's log as the
  hook. A rule, then the boss in one line (hat, name in Fell small caps, one italic sentence). Then orders as a printed
  order reads: paragraphs with run-in small-capital heads (*Orders.* *Against you.*), no bullets. The battle's own
  description joins *Against you* minus any sentence that repeats the log (a shared three-word run drops it), so
  nothing is said twice. The controls are one italic note in `ink3`. Set sail (ink) and Chart (rule).
- **Shipyard**: the ship in 3D above a chandler's ledger (beside it in landscape). She lies in a fitting-out berth at
  Port Royal (`src/render/yard.js`): a timber wharf with barrels, a gun waiting to be swayed aboard, scaffolding and
  sheer-legs; a new hull in frame on the slipway astern; the town, the Point's fort and the Blue Mountains across
  the water in a warm haze. It is built when the shipyard opens and disposed when it closes (the idle battle behind
  isn't drawn meanwhile). Drag turns her, with inertia; pinch or the wheel zooms; a double-tap sets the view back;
  she bobs at her moorings. The wharf dissolves away (the ships' screen-door) while you look across it. Her parts carry
  an engraver's key, paper roundels lettered A to F (hull, sails, figurehead, stern, colours, guns); the same letters
  head the ledger's sections. Tap a key or the part itself (a gun slot, too) and the part is lit on the model (its paint
  warms, its outline turns pale gilt), the camera turns to it and the ledger opens and scrolls to that section; open a
  section in the ledger and the model answers the same way. Tapping a gun's or a look's line tries it on the model
  ("· on the model"); *fit*, *buy* or *wear* keeps it. The fleet tabs swap the model (one sinks away, the next rises).
  The only control on the scene is *Chart*, an ink slip top left. The ledger itself: Text tabs on a rule for the fleet; the ship as "Resolute, *a frigate*"; its
  particulars in two columns with dot leaders; then one line per fitting: name (with "1 of 3"), an italic note, the
  price as a Fell figure, and one small ruled *buy*. Too dear: price and buy fade to 36%. Fitted: an italic "fitted".
  A great ship adds *The gun decks* (Fell, with "65 of 92 tons" set right) after the refit line: small-capital heads
  for the larboard and starboard broadsides, chase guns and the deck, one line a slot ("Lower tier *five guns*", the
  fitted gun in italic) with a ruled *change*. An open slot (its *close* inked solid) lists the guns it takes one
  step in under a hairline: name, the italic note, a line of figures in `ink3` (reach, reload, ball, tons), the price
  and a ruled *fit*. A fit that would overload her says "too heavy" in italic ink and fades like a dear one.
  *Her looks* follow, "for show" set right: a line a field (paint, canvas, device, carving, lanterns, colours) with
  what she wears in italic, hand-coloured chips for paint and canvas, and a ruled *change*. Open, a field lists the
  yard's stock: the price and *buy*, *wear* once the squadron owns it (bought once, worn by any ship), *worn*, or an
  italic *locked* with the hat that brings it ("Comes with Calico Kate's skull hat."). The line the model points at
  gets a pencil wash (`paper2`) across the column.
- **Results**: kicker (battle name), "Victory!" in red or "Defeat" in ink, three ink stars, "+840 gold", one sentence,
  the hat won (if any) between rules, the log entry signed "From the log, 18 April 1661", the stats as one ruled row.
- **Pause** is "Hove to": orders, settings as ruled rows of words, Resume / Restart, a small-caps retreat link.
- **Hats**: "A Cabinet of Hats", four of seven: the hats laid out like plates in a catalogue, name in Fell, provenance
  in italic ("Taken from Capitán Rojo of La Bruja" / "Still worn by …"). Hats not yet taken are pale silhouettes.
- **Boss notice**: a small sheet over a darkened sea: a small-caps line, the hat, the name in red Fell, the ship in
  italic, the taunt in large italic, "tap to fight", and a fine ink rule that shortens as the seconds run.
- **Coach** and canvas tips are paper slips with a hairline inside the edge; toasts are small ink slips in italic.
- Landscape uses the width: sheets split into two columns divided by a printed column rule; the shipyard keeps the
  3D ship on the left and scrolls the ledger on the right (fading at its foot); the title page runs down the left.

### Controls
- Three looks. **Ink** (the main action, at most one a screen): solid ink, Fell small caps in paper, 50 px (56 hero).
  **Rule** (`.quiet`, secondary): the same label inside a 1 px ink rule. **Text** (tertiary): a small-caps word in
  `ink2`, at least 44 px tall. Danger is the text look in red ("Tap again to erase your campaign").
- Press: sink 1 px, ink deepens. Disabled: 38% opacity. Focus: 2 px red outline, 3 px offset.
- Toggles are words: the chosen one in ink with a 1.5 px underline, the other in `ink3` (Auto / Manual, On / Off).
- Touch targets at least 44 px everywhere, HUD included.

### Space, radii, elevation
- 4 px grid: 4, 8, 12, 16, 20, 24, 32, 40, 56. Screens keep a 12–16 px gutter plus safe-area insets; sheets pad
  38/30/28 px (the printed rule sits 8 px in).
- Radii: 1–3 px (paper is cut square); `pill` only for round icon buttons and badges.
- Elevation: only paper on the sea has a shadow (`--shadow-3` for sheets, `--shadow-2` for slips). Nothing on a
  sheet has one.

### HUD kit (`src/hud/style.js`)
The canvas half of the language; the Battle HUD below is built only from it. Tones keep their historical names:
`glass` is an ink slip (90% ink, paper hairline), `solid` opaque ink, `paper` a paper slip, `gold` the *ready/chosen*
state inverted to paper (a loaded gun, a toggled control, the one main action), `crimson` a boss slip in deep red,
`danger` red. `MARK` gives the colour roles on the sea (paper for line, pale gilt for chosen, vermilion for enemy,
blue friend, green exit). Faces: `display` (Fell, always weight 400: no synthetic bold), `caps` (Fell small caps, button labels),
`ui` (Garamond). Button labels in Fell small caps, subs in italic Garamond; `caption()` is Garamond 600 in real small
capitals with a strong ink halo; bars flat with square-cut ends; reloads a fine paper rule; `hairline()` and active
rings in gilt; banners a Fell title between fine rules; toasts ink slips in italic; tips paper slips; the wind
compass an ink disc with a paper needle tipped red. Text on the sea keeps the two-pass soft ink halo (`text()`),
never an outline. Demo: `tests/kit/`, `node tests/kit-shot.mjs`.

### Motion
- Curves: `out` (0.22, 1, 0.36, 1) for arrivals, `inOut` for moves, `in` for exits, `spring` only for small pops (the
  stars, a hat landing). Durations: press 90, fast 160, base 240, slow 420, stagger 45, count-up 900 ms. The same
  curves exist in JS (`EASE`, `tween()`).
- Sheets rise 10 px and fade in (420 ms); from the battle the scrim fades in too; menus never animate out. Orders,
  ledger rows and hats stagger 45 ms (capped at 8). Results: stars pop one by one, the gold counts up, the hat drops in.
  No confetti.
- Transform and opacity only. `prefers-reduced-motion` turns every animation into an instant change.

### Icons
- 24×24 grid, ~2 px clear space, 2 px round strokes, solid fills only for small masses (shot, hulls, flags), one
  colour (`currentColor` in the DOM, any fill on canvas), no text inside. One set of path data for the DOM
  (`iconSVG`) and the canvas (`drawIcon`, or `iconImage` to blit).
- Set: anchor, mine, board, land, firePort, fireStarboard, round, chain, grape, fleet, pause, play, wind, gold,
  star, lock, hat, back, next, close, check, restart, helm (settings), recentre, map, ship, music, sound, mute, skull.
- In the menus icons are nearly gone: words do the work; only the chart's back arrow and toasts keep one. In the HUD
  an icon goes with a short label on the action tiles; an icon alone only for universal actions (pause, back, close,
  recentre).

### Battle HUD
Drawn every frame on the HUD canvas, only through the kit (`src/hud/hud.js`; screenshots: `node tests/hud-shots.mjs`).
It is the menus' printed matter carried onto the sea: slips of ink for what you press, paper for what is lit, Fell
for names and numbers, small capitals for labels, one red, which on the sea means the enemy. Every
colour, stroke and shadow comes from the kit: `MARK` names what a colour means (line, chosen, enemy, friend, exit,
warn, hurt, track) and `tint()` fades it; nothing in the HUD or the goal markers spells out a colour. Boxes only where
a touch target or a paragraph needs one (buttons, tips, toasts).
- **On the sea, paper draws and gilt chooses.** `MARK.line` is paper: your courses, arcs, dials. `MARK.chosen` is a
  pale gilt, as on a book's edges: the chosen ship's ring and dock name, the tutorial buoy, the rings to sail for
  (reach, chests; the game's copy calls them gold rings). `MARK.enemy` is the vermilion: enemy hull bars, engage
  rings, targets, their shells. Blue is a friend (forts and ships in your care, allies, prizes), green the way out.
  Type on the water is paper-coloured with an ink halo, never bare ink on blue.
- **Layout** (12 px edge plus safe-area insets): fleet dock top left; pause, wind rose and the objective (a quiet
  right-aligned block, first line brighter) top right; the boss's name in Fell over a long red bar between them; the
  action bar bottom centre; the recentre button above its right end. Tips sit above the action bar (top centre in
  landscape). Off-screen enemies are red edge chevrons that slide clear of all of these.
- **Fleet dock:** no box: a 44 px row per ship you command (her name in Garamond, haloed, over a 3 px flat hull bar);
  the chosen one's name is gilt with a short gilt rule beside it (with Whole fleet on, every name turns gilt and the
  rule marks that row; under it two words, *In line* and *Abreast*, the chosen one gilt and underlined). Words appear
  only when they say something (Sunk, Captured, Through, Prize), in small capitals. Merchantmen or allies share one
  compact row of short bars.
- **Action bar:** 52 px stacked tiles, ink slips with the icon over a Fell small-capital label. A reload is a fine
  paper rule filling along the bottom (split into a segment per battery on a great ship, each gilt once loaded); a
  side wholly loaded inverts its tile to paper with ink type and a faint glow, so what
  you can fire now is the brightest thing on the bar. Toggled (anchored) also inverts. The one main action (Board or
  Land when it will work) is a paper slip. Shot shows every shot she carries with the loaded one ringed.
- **On the water:** thin lines with a soft ink underlay (`seaStroke`), never wedges or fills: the gun-range rim with
  end ticks and a reload sweep, the course ribbon, a fine gilt ring for the chosen ship, red rings for engage
  targets, goal rings (gilt reach and chests, blue protect, red target, green exit). Labels on the sea are Garamond
  600 in its own small capitals with the strong halo (`caption()`, and `api.label`, `api.ring`, `api.stroke` for
  goals and abilities). Hull bars over ships are 3 px, flat and square-cut: yours by how sound they are, the enemy's
  in red; lost hull flashes pale and drains away. Nothing is drawn for a ship hidden in fog or gone.
- **Moments:** damage figures in Fell with a small spring pop (paper when you hit, pale red when you're hit), a word
  such as "Raked!" in Fell italic; toasts are small ink slips in italic; banners are a Fell title between two fine
  paper rules (red rules for bad news) with an italic line under it, over a soft ink wash; tips are paper slips with
  a hairline inside the edge, like the DOM coach. One at a time where they'd compete.

### Sea chart
- A printed plate: flat paper, ink linework, a grey-green wash for the shallows, Fell italic for regions and seas,
  spaced Garamond capitals for land, the cartouche in Fell with a small-caps imprint. One compass rose, two sea
  creatures, the cartouche; nothing else decorative.
- Battles are paper roundels with a Fell numeral; bosses are ink roundels carrying their hat (paper with a double
  ring once the hat is won); locked ones are dashed. The next battle is the red one, with the dotted red leg ahead
  and the little ship beside it. Legs already sailed are inked dashes.
- Legs stay off land and clear of other battles and names: `node tests/chart-check.mjs` checks it (battle names are
  13 px Garamond 600, which fits the boxes it measures), for every plate, along with region, sea, land and town names,
  the hills, rivers, the rose, cartouche, vignettes and the little ship, which must not overlap each other.
- Two plates of one atlas, in one hand. *The West Indies* (1000 x 700, "Drawn for the Admiral, 1655": a sea serpent
  and a whale). *The Middle Sea* (a long plate, 1300 x 700, "Printed for the Admiralty, 1666"): the whole sea from
  Biscay and the Atlantic to Constantinople, coasts in degrees smoothed into engraved curves, longitude stretched east
  of 22°E so the Archipelago has room and the Straits and the Dardanelles drawn wider than they are, as the portolans
  drew them; English names of the day (Barbary, Barca, Romelia, Natolia, the Morea), a few rivers and port towns the
  battles don't already name, a galley under her lateen in the Gulf of Lion and a dolphin in the Libyan Sea. Small
  screens pan; the plate is never shrunk below 1:1.
- **The plates as tabs.** Above the plate (beside the nav in landscape) the plates' names are small-capital tabs on a
  hairline: the plate shown in paper with a 1.5 px underline, another open plate paler; a plate not yet open shows a
  lock and, under it in italic, what opens it ("Beat La Gran Armada"), and a tap says so in a toast. The plate shown is
  remembered in the save. The first time the chart is opened after a new world opens (nothing won there yet), it turns
  to that plate and lays a paper slip on it: "A new chart" and a line from the captain's log (`opening` in
  `src/config/worlds.js`), put away with *Very good* or a touch on the chart.
