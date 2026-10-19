// Keep the fleet afloat until the clock runs out; the enemy needn't be beaten. Lose every ship and the battle is
// lost as usual. Pairs with spawn events: wave after wave until the relief arrives.
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export default {
  id: 'survive',
  about: 'Keep the fleet afloat until the clock runs out; the enemy needn\'t be beaten.',
  params: { secs: 'seconds to hold out' },
  done: (o, G) => G.t >= o.secs,
  hud: (o, G) => [`Hold out: ${clock(Math.max(0, Math.ceil(o.secs - G.t)))}`],
  brief: (o) => `Keep the fleet afloat for ${clock(o.secs)}. You needn’t sink them all.`,
  won: () => 'The enemy gives up the chase.',
};
