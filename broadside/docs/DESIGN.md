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
- One palette: deep teal sea, cream sails, warm wood, terracotta and gold accents; enemy red, English blue.
- Type: one refined display face for titles, one clean humanist sans for UI. No outlined cartoon text in
  the HUD; use soft shadows and good contrast instead.
- HUD: minimal and contextual. A slim fleet dock, a quiet objective line, a small elegant wind compass.
  Firing arcs only when useful, drawn as thin lines, not grey wedges.
- Motion: everything eases. Banners glide; buttons press; menus transition; numbers tick.
- Juice where it matters: a heavy broadside lands with a beat of hit-stop, splinters, a camera nudge.
- Land is a place, not a blob: each region has its own look (English hills and timber towns at Port Royal, cliffs
  and pines on the Windward Passage, whitewash and terracotta on the Main, jungle and ruins in the Golden Isles,
  shanties and Skull Rock on the Pirate Coast, mangroves and fishing villages in Campeche, El Morro and a pastel
  city for the Armada). Detail rewards zooming in: smoke, flags, gulls, people. Zoomed out the land stays quiet.
- Land that matters reads at a glance: calm water in the lee of high land, buoys round a harbour's anchorage,
  a town that burns when shot lands on it. Anything ships can't cross is inside the outline they collide with.

## Style
The rulebook for everything drawn on screen. Values live in `src/ui/tokens.js` (set on `:root` as CSS custom
properties at boot, exported as JS for the canvas); icons in `src/ui/icons.js`; the canvas HUD kit in
`src/hud/style.js` (demo: `tests/kit/`, screenshots: `node tests/kit-shot.mjs`).

**Idea: a brass-and-teal ship's instrument over a toy sea.** Chrome is quiet, dark and exact; documents are warm
paper; gold means "this one" (the main action, the loaded gun, the chosen ship). Never two loud things at once.

### Surfaces
- **Glass** (chrome: main menu, pause, shipyard, hats, coach, every HUD control): dark teal gradient
  (`teal700 → teal950`), a 1px hairline edge (`--c-glass-line`), a faint top highlight, a soft drop shadow. No
  borders thicker than 1px, no hard offset shadows.
- **Paper** (documents: sea chart, briefing, captain's log, results): parchment with a faint tooth and a printed
  double rule 7px inside the edge. Ink is warm brown-black, never pure black.
- **Crimson** (bosses only): the boss card, the boss intro, boss nodes on the chart.

### Colour
| Role | Token | Value |
|---|---|---|
| Chrome | `teal900` / `teal800` / `teal700` | `#0b252c` / `#10323a` / `#17434d` |
| Text on glass | `onGlass`, `onGlass2`, `onGlass3` | cream `#fbf4e3` at 100 / 72 / 50% |
| Paper | `paper`, `paper2`, `paper3` | `#f3e6c8` `#eadab2` `#dcc490` |
| Ink on paper | `ink`, `ink2`, `ink3` | `#2a1d13` `#5a4431` `#86694c` |
| Accent (go, ready, chosen) | `gold`, `goldHi`, `goldDeep` | `#e4ab45` `#f6d27a` `#a5711f` |
| Warm accent (next battle, log rule, danger) | `terracotta` | `#c05a3c` |
| Sides | `red` (enemy) / `blue` (English) | `#c93d31` / `#2f609f` |
| Hull | `hpHigh` / `hpMid` / `hpLow` | `#7cc46e` / gold / `#e5533f` |

Gold is spent sparingly: one gold button per screen. Captions are gold-hi on glass, terracotta-deep on paper.

### Type
- **Fraunces** (soft optical-size serif, SOFT 60) for titles, names, big numbers and the captain's log (italic).
  **Source Sans 3** (humanist sans) for everything you read or tap. Both from Google Fonts. Lilita One is still
  loaded only for the current HUD until it moves to the kit; drop it then.
- Offline fallbacks keep the character: display `Iowan Old Style, Palatino, Charter, Georgia, Noto Serif, serif`;
  UI `Seravek, Segoe UI, Roboto, Noto Sans, Helvetica Neue, system-ui`.
- Scale (px / line-height / weight): hero 56/1/700 (wordmark), display 40/1.05/650, h1 30/1.1/650, h2 23/1.15/600,
  h3 18/1.2/600, body 15/1.45/400 (17 large), small 13/1.4, caption 11/1.3/700 uppercase tracked 0.14em,
  button 16 (14 small) at 600–650. Numbers use lining tabular figures.
- No outlined text anywhere. On the sea, text gets a two-pass soft shadow (`text()` in the kit, halo `soft`/`strong`).

### Space, radii, elevation
- 4px grid: 4, 8, 12, 16, 20, 24, 32, 40, 56. Screens keep a 16px gutter plus safe-area insets; panels pad 20–24.
- Radii: 6 (chips), 10 (small buttons, toggles), 14 (buttons, cards, HUD controls), 20 (panels), pill.
- Elevation: 1 (chips, pressed), 2 (buttons, cards, HUD), 3 (floating panels). CSS `--shadow-n`, canvas `CANVAS_SHADOW[n]`.

### Controls
- One button, four looks: **gold** (the main action), **quiet** (secondary: glass tint on glass, cream wash on
  paper), **text** (tertiary, underlined) and **danger** (terracotta). Min height 48 (56 for the hero action, 38
  small); HUD targets at least 44.
- Press: sink 1px, scale 0.985, darken, in 90ms. Disabled: 42% opacity, no shadow. Focus: 2px gold-hi ring.
- Toggles are segmented controls: a recessed track with a cream thumb.
- Settings read as rows (label left, control right) split by hairlines, not boxes in boxes.

### Motion
- Curves: `out` (0.22, 1, 0.36, 1) for arrivals, `inOut` for moves, `in` for exits, `spring` (0.34, 1.56, 0.64, 1)
  only for small pops (stars, badges, hats). Durations: press 90, fast 160, base 240, slow 420, stagger 45,
  count-up 900 ms. The same curves exist in JS (`EASE`, `tween()`) for the canvas.
- Screens rise 14px and fade in (420ms); from the battle the scrim fades in too; menus never animate out. Lists
  stagger 45ms per row (capped at 8). Results: stars pop one by one, gold counts up, coins fall.
- Transform and opacity only. `prefers-reduced-motion` turns every animation into an instant change.

### Icons
- 24×24 grid, ~2px clear space, 2px round strokes, solid fills only for small masses (shot, hulls, flags), one
  colour (`currentColor` in the DOM, any fill on canvas), no text inside. One set of path data for the DOM
  (`iconSVG`) and the canvas (`drawIcon`, or `iconImage` to blit).
- Set: anchor, mine, board, land, firePort, fireStarboard, round, chain, grape, fleet, pause, play, wind, gold,
  star, lock, hat, back, next, close, check, restart, helm (settings), map, ship, music, sound, mute, skull.
- Icon plus a short label on buttons; an icon alone only for universal actions (pause, back, close).

### Sea chart
- The route shows the voyage so far (terracotta dashes) and the leg ahead (dotted); legs not yet sailed aren't
  drawn. Legs stay off land and clear of other battles and names: `node tests/chart-check.mjs` checks it.
- Label hierarchy: battle names (sans 600; the next battle in terracotta) > region names (Fraunces italic,
  terracotta, quiet) > land names (spaced caps, 60%) > sea names. One compass rose, two sea creatures, the
  cartouche; nothing else decorative. The map edge has a soft vignette so names running off it fade, not cut.
