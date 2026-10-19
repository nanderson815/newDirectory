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
- A ship is always selected (your flagship to begin with). Tap a ship of yours to select it.
- Drag *anywhere* on the sea to plot the selected ship's course; starting on another of your ships selects
  it first. Tap the sea to sail straight there.
- Tap an enemy to **engage**: the ship manoeuvres on its own to keep that target on the beam.
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

### Look
- One palette: the sea, cream sails and warm wood in the world; ink, rag paper and one printer's red for everything
  read or pressed; enemy red, English blue.
- Type: the Fell types for titles and labels, EB Garamond for reading (see Style). No outlined cartoon text in
  the HUD; use soft shadows and good contrast instead.
- HUD: minimal and contextual. A slim fleet dock, a quiet objective line, a small elegant wind compass.
  Firing arcs only when useful, drawn as thin lines, not grey wedges.
- Motion: everything eases. Banners glide; buttons press; menus transition; numbers tick.
- Juice where it matters: a heavy broadside lands with a beat of hit-stop, splinters, a camera nudge.

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
  English captain in the West Indies, and the hats he took."), one fleuron, one ink button (Continue / Set sail), two
  small-caps links (New campaign, Settings) and the imprint ("Port Royal: printed for the Admiralty, 1655."). Settings
  live on their own small sheet.
- **Brief**: kicker, title, an italic dateline ("off the Pirate Coast, 18 April 1661"), then the captain's log as the
  hook. A rule, then the boss in one line (hat, name in Fell small caps, one italic sentence). Then orders as a printed
  order reads: paragraphs with run-in small-capital heads (*Orders.* *Against you.*), no bullets. The battle's own
  description joins *Against you* minus any sentence that repeats the log (a shared three-word run drops it), so
  nothing is said twice. The controls are one italic note in `ink3`. Set sail (ink) and Chart (rule).
- **Shipyard**: a chandler's ledger. Text tabs on a rule for the fleet; the ship as "Resolute, *a frigate*"; its
  particulars in two columns with dot leaders; then one line per fitting: name (with "1 of 3"), an italic note, the
  price as a Fell figure, and one small ruled *buy*. Too dear: price and buy fade to 36%. Fitted: an italic "fitted".
- **Results**: kicker (battle name), "Victory!" in red or "Defeat" in ink, three ink stars, "+840 gold", one sentence,
  the hat won (if any) between rules, the log entry signed "From the log, 18 April 1661", the stats as one ruled row.
- **Pause** is "Hove to": orders, settings as ruled rows of words, Resume / Restart, a small-caps retreat link.
- **Hats**: "A Cabinet of Hats", four of seven: the hats laid out like plates in a catalogue, name in Fell, provenance
  in italic ("Taken from Capitán Rojo of La Bruja" / "Still worn by …"). Hats not yet taken are pale silhouettes.
- **Boss notice**: a small sheet over a darkened sea: a small-caps line, the hat, the name in red Fell, the ship in
  italic, the taunt in large italic, "tap to fight", and a fine ink rule that shortens as the seconds run.
- **Coach** and canvas tips are paper slips with a hairline inside the edge; toasts are small ink slips in italic.
- Landscape uses the width: sheets split into two columns divided by a printed column rule; the shipyard keeps the
  ship on the left and scrolls the ledger on the right (fading at its foot); the title page runs down the left.

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
  rule marks that row). Words appear only when they say something (Sunk, Captured, Through,
  Prize), in small capitals. Merchantmen or allies share one compact row of short bars.
- **Action bar:** 52 px stacked tiles, ink slips with the icon over a Fell small-capital label. A reload is a fine
  paper rule filling along the bottom; a loaded gun inverts its tile to paper with ink type and a faint glow, so what
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
  13 px Garamond 600, which fits the boxes it measures).
