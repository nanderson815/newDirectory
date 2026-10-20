import { S, afloat, showToast } from '../../state.js';

// At anchor: she lies moored where the battle puts her, firing whatever bears, until an enemy ship comes within
// `wake` or she is hit; then she cuts her cable and gets under way. A harbour full of moored ships makes a raid:
// fireships, a cutting-out, a night attack.
export default {
  id: 'moored',
  about: 'Lies at anchor, firing what bears, until an enemy comes close or she is hit; then she weighs.',
  params: { wake: 'she weighs when an enemy ship comes this close (map units)', say: 'what she calls as she cuts her cable, or null' },
  defaults: { wake: 200, say: 'She cuts her cable!' },
  init(s, a) { a.hp = s.hp; a.held = true; s.pivot = s.h; s.v = 0; },
  update(s, a) {
    if (!a.held) return;
    const near = S.G.ships.some((o) => o.team !== s.team && afloat(o) && !o.fireship && Math.hypot(o.x - s.x, o.y - s.y) < a.wake);
    if (!near && s.hp >= a.hp) { s.pivot = s.h; return; }
    a.held = false; s.pivot = null;
    if (a.say && !s.hidden) showToast(a.say, s, 1.6);
  },
};
