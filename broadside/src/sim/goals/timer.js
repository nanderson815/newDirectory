// Meet the battle's other goals within `secs` seconds.
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export default {
  id: 'timer',
  done: () => true,
  failed: (o, G) => (G.t > o.secs ? 'time' : null),
  hud: (o, G) => [`Time left: ${clock(Math.max(0, o.secs - G.t))}`],
  brief: (o) => `You have ${clock(o.secs)}.`,
  lost: { time: 'Out of time. Refit at the shipyard and try again.' },
};
