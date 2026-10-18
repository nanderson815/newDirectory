import { startFlee } from '../exit.js';

// Once her hull drops to `below` of full she breaks off and crowds on sail (`speed` times her usual pace) for the
// nearest edge of the chart; reach it and she's gone. Gone isn't sunk: a hunt goal that wanted her is lost, while
// sink goals count her as beaten. Only AI-sailed ships run (the enemy and allies); your own ships ignore it.
export default {
  id: 'flee',
  about: 'Breaks off and runs for the nearest edge of the chart once badly hurt; reaching it, she escapes.',
  params: { below: 'hull share (0-1) at which she runs', speed: 'her speed while running, times normal', say: 'what she calls as she runs, or null' },
  defaults: { below: 0.5, speed: 1.15, say: 'She’s making a run for it!' },
  update(s, a) {
    if (!s.fleeing && s.hp <= s.maxHp * a.below) startFlee(s, a.say);
  },
  wind: (s, a, f) => (s.fleeing ? f * a.speed : f),
};
