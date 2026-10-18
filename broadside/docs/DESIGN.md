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
