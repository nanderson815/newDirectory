import { S, afloat, showBanner } from '../../state.js';
import { waveAI, waveEnemies, WAVE_REPAIR } from '../../config/endless.js';
import { spawnShip } from '../spawn.js';
import { sfx } from '../../audio/sfx.js';

// Endless Skirmish: when a wave is beaten, repair a little, restock mines and send in the next one.
// Never won; the battle ends when the fleet is gone.
const BREAK = 3.5; // seconds between waves

export function spawnWave(n) {
  const G = S.G;
  G.wave = n; G.nextWaveAt = null; G.ai = waveAI(n);
  for (const d of waveEnemies(n)) spawnShip(d, 'enemy');
  if (n > 1) {
    const boss = n % 5 === 0;
    showBanner(boss ? `Wave ${n}: a flagship!` : `Wave ${n}`, boss ? 'Sink her and the escorts' : 'Here they come');
  }
}

export default {
  id: 'waves',
  about: 'Endless Skirmish: wave after wave; never won, ends when the fleet is gone.',
  params: {},
  endless: true,
  setup(o, G) { G.wave = 1; G.wavesCleared = 0; G.nextWaveAt = null; },
  update(o, G) {
    if (G.endAt != null) return;
    if (!G.ships.some((s) => s.team === 'enemy' && afloat(s)) && G.nextWaveAt == null) {
      G.wavesCleared = G.wave;
      G.nextWaveAt = G.t + BREAK;
      showBanner(`Wave ${G.wave} beaten!`, `Wave ${G.wave + 1} is coming`, BREAK - 0.5);
      sfx.fanfare(false);
      for (const s of G.ships) {
        if (s.team !== 'player' || !afloat(s)) continue;
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * WAVE_REPAIR);
        s.mines = Math.max(s.mines, s.minesMax || 0);
      }
    }
    if (G.nextWaveAt != null && G.t >= G.nextWaveAt) spawnWave(G.wave + 1);
  },
  done: () => false,
  hud: (o, G) => [`Wave ${G.wave}`],
  brief: () => 'Survive as many waves as you can. Every fifth wave brings a flagship.',
};
