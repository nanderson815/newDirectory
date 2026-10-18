# Broadside!

A cartoony 1600s naval battle game for phones. Open `index.html` in a mobile browser — no build step.

- **Drag from a ship** to draw its course; it sails along the line.
- **Broadsides**: cannons are on the sides. Auto fire (crews fire when an enemy is in arc) or manual fire (buttons), set on the title or pause screen.
- **Wind** sets your speed: running or reaching is fast, sailing into it is slow. Islands block hulls and shot.

Rendering is three.js (loaded from jsDelivr) with toon shading; the simulation is plain 2D underneath.
Battles live in the `BATTLES` table in `index.html` — that's where the campaign's harder battles will go.
