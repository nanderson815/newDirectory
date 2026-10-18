import { S, afloat, showBanner } from '../state.js';
import { waveAI, waveEnemies, WAVE_REPAIR } from '../config/endless.js';
import { PI } from '../util.js';
import { makeShip, nextId, placer } from './battle.js';
import { sfx } from '../audio/sfx.js';

// Endless Skirmish waves: when a wave is beaten, repair a little, restock mines and send in the next one.
const BREAK = 3.5; // seconds between waves

export function updateWaves() {
  const G = S.G;
  if (G.goal !== 'waves' || G.endAt != null) return;
  const enemies = G.ships.some((s) => s.team === 'enemy' && afloat(s));
  if (!enemies && G.nextWaveAt == null) {
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
}

export function spawnWave(n) {
  const G = S.G;
  G.wave = n;
  G.nextWaveAt = null;
  G.ai = waveAI(n);
  const place = placer(G), rot = G.land ? PI / 2 : 0;
  let id = nextId(G);
  for (const d of waveEnemies(n)) {
    const s = makeShip(d, 'enemy', place, rot, id++, G.ai);
    G.ships.push(s);
    if (S.hooks.onSpawn) S.hooks.onSpawn(s);
  }
  if (n > 1) {
    const boss = n % 5 === 0;
    showBanner(boss ? `Wave ${n}: a flagship!` : `Wave ${n}`, boss ? 'Sink her and the escorts' : 'Here they come');
  }
}
