import { briefText, winText, loseText, mainGoal } from '../sim/goals/index.js';
import { S, afloat } from '../state.js';
import { $, store } from '../util.js';
import { BATTLES } from '../config/battles.js';
import { TYPES } from '../config/ships.js';
import { UPGRADES, MAX_FLEET } from '../config/upgrades.js';
import { HATS, HAT_ORDER, hatSVG } from '../config/hats.js';
import { AMMO, AMMO_COSTS, BOARDING } from '../config/ammo.js';
import { battleDef, ENDLESS_ID, WAVE_GOLD } from '../config/endless.js';
import {
  save, resetSave, recordSkirmish, fleetStats, refitOffer, upgradeOffer, buyUpgrade, buyRefit, buyAmmo, nextHire, buyHire, recordWin, lvl,
} from '../save.js';
import { loadBattle } from '../game.js';
import { R } from '../render/gl.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { TUTORIAL_STEPS } from '../sim/update.js';
import { STORY, logDate } from '../config/story.js';
import { renderChart, enablePan } from './chart.js';

// DOM screens around the battle: menu, sea chart, shipyard, hats, briefing, pause, results, tutorial coach.
const SCREENS = ['menuScreen', 'chartScreen', 'yardScreen', 'hatsScreen', 'briefScreen', 'pauseScreen', 'endScreen'];
export const ui = { screen: 'menuScreen', yardSel: 0 };

const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#f2b632" stroke="#3a2414" stroke-width="2.5"/><circle cx="10" cy="10" r="4" fill="none" stroke="#c98a17" stroke-width="2"/></svg>';
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const starsHTML = (n, big) => `<span class="stars${big ? ' big' : ''}" role="img" aria-label="${n} of 3 stars">` +
  [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('') + '</span>';

export function showScreen(id) {
  if (id !== null) hideIntro();
  ui.screen = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  renderCoach();
}

// Menus keep the battle behind them idle, so nothing sails or fires while you browse.
function idle() { if (S.G) S.G.phase = 'title'; }

// ---------- Battle descriptions ----------
const PLURAL = {
  sloop: 'sloops', brig: 'brigs', frigate: 'frigates', galleon: 'galleons', manowar: "men-o'-war",
  schooner: 'schooners', xebec: 'xebecs', bomb: 'bomb ketches', fireship: 'fireships', merchant: 'merchantmen',
};
const enemyForts = (B) => (B.forts || []).filter((f) => f.team !== 'player');
const ownForts = (B) => (B.forts || []).filter((f) => f.team === 'player');
const isPirate = (B) => B.faction === 'pirate';
const bossOf = (B) => { const e = B.enemy.find((x) => x.boss); return e ? e.boss : null; };
// Calico Kate is the one boss who isn’t a "he".
const his = (B) => (STORY[B.id] && STORY[B.id].her ? 'her' : 'his');
function rosterText(B) {
  const counts = {};
  for (const e of B.enemy) counts[e.type] = (counts[e.type] || 0) + 1;
  const parts = Object.entries(counts).map(([t, n]) => `${n} ${n === 1 ? TYPES[t].label.toLowerCase() : PLURAL[t] || TYPES[t].label.toLowerCase() + 's'}`);
  const forts = enemyForts(B).length;
  if (forts) parts.push(`${forts} fort${forts > 1 ? 's' : ''}`);
  if (B.waves && B.waves.length) parts.push(`then ${B.waves.length} wave${B.waves.length > 1 ? 's' : ''} of reinforcements`);
  return parts.join(', ');
}
// Each goal writes its own orders (src/sim/goals/).
function goalText(B) {
  if (B.tutorial) return 'Follow your bosun’s orders, then sink the old hulk.';
  return briefText(B);
}
function ordersHTML(B) {
  const li = [`<li><b>Orders:</b> ${esc(goalText(B))}</li>`];
  if (mainGoal(B) === 'waves') li.push(`<li>Between waves your ships patch ${Math.round(0.25 * 100)}% of their hull and restock mines. Each wave beaten pays ${WAVE_GOLD} gold.${save.best ? ` Your best: wave ${save.best}.` : ''}</li>`);
  else if (!B.tutorial) li.push(`<li><b>${isPirate(B) ? 'Pirates' : 'Enemy'}:</b> ${esc(rosterText(B))}.</li>`);
  if (B.fog) li.push('<li><b>Fog:</b> your lookouts only see ships close to your own. Keep the fleet together and watch the edges of the murk.</li>');
  if (ownForts(B).length) li.push('<li>Your fort’s guns fire on anything in range, but it can’t dodge. Hunt down the bomb ketches before they wear it down.</li>');
  if (enemyForts(B).length) li.push('<li>Forts fire in every direction. Once one is silenced, stop a ship beside it and tap <b>Land troops</b>.</li>');
  if (S.G && S.G.ships.some((s) => s.team === 'player' && s.mines > 0)) li.push('<li>Select a ship with mines and tap <b>Drop mine</b> to leave one astern.</li>');
  if (!B.tutorial && mainGoal(B) !== 'boss' && mainGoal(B) !== 'breakthrough') li.push(`<li>Batter an enemy below ${Math.round(BOARDING.hpFrac * 100)}% hull, sail alongside and tap <b>Board!</b> to take her as a prize (+${BOARDING.prizeGold} gold).</li>`);
  if (!B.tutorial) li.push('<li class="note">Drag from a ship to steer. Hold it to anchor and turn. Tap it to clear its course.</li>');
  return li.join('');
}

// ---------- Main menu ----------
let resetArmed = null;
export function openMenu() {
  idle();
  $('menuHats').innerHTML = HAT_ORDER.map((id) => hatSVG(id, !save.hats.includes(id))).join('');
  $('startBtn').textContent = Object.keys(save.stars).length ? 'Continue' : 'Set sail';
  disarmReset();
  music.mood('menu');
  showScreen('menuScreen');
}
function disarmReset() {
  clearTimeout(resetArmed); resetArmed = null;
  $('resetBtn').textContent = 'New campaign';
  $('resetBtn').classList.remove('danger');
}

// ---------- Sea chart ----------
export function openChart() {
  idle();
  $('chartGold').innerHTML = `${COIN}<span>${save.gold}</span>`;
  music.mood('calm');
  showScreen('chartScreen');
  renderChart($('chartList'));
}

// ---------- Shipyard ----------
export function openYard() {
  idle();
  renderYard();
  music.mood('calm');
  showScreen('yardScreen');
}
function buyRow(cls, name, desc, pips, cost, id) {
  const can = cost != null && save.gold >= cost;
  const pipHTML = pips
    ? `<span class="pips" role="img" aria-label="Level ${pips[0]} of ${pips[1]}">${Array.from({ length: pips[1] }, (_, k) => `<i class="${k < pips[0] ? 'on' : ''}"></i>`).join('')}</span>`
    : '';
  const label = cost == null ? 'Maxed' : `${COIN}${cost}`;
  const aria = cost == null ? `${name}: fully upgraded` : `Buy ${name} for ${cost} gold`;
  return `<div class="up-row ${cls}"><div><div class="up-name">${esc(name)}</div><div class="up-desc">${esc(desc)}</div>${pipHTML}</div>` +
    `<button type="button" class="buy" data-buy="${id}"${can ? '' : ' disabled'} aria-label="${esc(aria)}">${label}</button></div>`;
}
function renderYard() {
  $('yardGold').innerHTML = `${COIN}<span>${save.gold}</span>`;
  const i = (ui.yardSel = Math.min(ui.yardSel, save.fleet.length - 1));
  $('yardTabs').innerHTML = save.fleet.map((f, k) =>
    `<button type="button" class="tab" role="tab" aria-selected="${k === i}" data-ship="${k}">${esc(f.name)}</button>`).join('');
  const f = save.fleet[i], st = fleetStats(f);
  let html = `<div class="ship-head"><h3>${esc(f.name)}</h3><span>${esc(st.label)}</span></div>` +
    '<dl class="ship-stats">' +
    `<div><dt>Hull</dt><dd>${st.hp}</dd></div><div><dt>Guns a side</dt><dd>${st.guns}</dd></div><div><dt>Speed</dt><dd>${st.speed}</dd></div>` +
    `<div><dt>Bow guns</dt><dd>${st.chasers}</dd></div><div><dt>Mines</dt><dd>${st.mines}</dd></div><div><dt>Marines</dt><dd>${st.marines}</dd></div>` +
    `<div class="wide"><dt>Shot</dt><dd>${st.ammo.map((k) => AMMO[k].short).join(' · ')}</dd></div>` +
    '</dl><div class="up-list">';
  const rf = refitOffer(f);
  if (rf) {
    const T = TYPES[rf.next];
    html += buyRow('refit', `Refit as a ${rf.label}`, `Bigger ship: ${T.hp} base hull, ${T.guns} base guns a side, ${T.marines} marines. Upgrades carry over.`, null, rf.cost, 'refit');
  }
  for (const U of UPGRADES) {
    const o = upgradeOffer(f, U.id);
    html += buyRow('', U.name, U.desc, [o.level, U.max], o.cost, U.id);
  }
  for (const kind of ['chain', 'grape']) {
    const have = lvl(f, kind);
    html += buyRow('', AMMO[kind].name, AMMO[kind].desc, [have, 1], have ? null : AMMO_COSTS[kind], 'ammo:' + kind);
  }
  $('yardShip').innerHTML = html + '</div>';
  const h = nextHire();
  $('yardHire').innerHTML = h
    ? buyRow('', `Hire the ${TYPES[h.cls].label.toLowerCase()} ${h.name}`, `Joins your squadron. Up to ${MAX_FLEET} ships.`, null, h.cost, 'hire')
    : '';
}
function onYardClick(e) {
  const tab = e.target.closest('[data-ship]');
  if (tab) { ui.yardSel = +tab.dataset.ship; renderYard(); return; }
  const b = e.target.closest('[data-buy]');
  if (!b || b.disabled) return;
  const id = b.dataset.buy, i = ui.yardSel;
  const ok = id === 'refit' ? buyRefit(i) : id === 'hire' ? buyHire() : id.startsWith('ammo:') ? buyAmmo(i, id.slice(5)) : buyUpgrade(i, id);
  if (ok) {
    sfx.init(); sfx.coin();
    if (id === 'hire') ui.yardSel = save.fleet.length - 1;
    renderYard();
  }
}

// ---------- Hats ----------
export function openHats() {
  idle();
  $('hatGrid').innerHTML = HAT_ORDER.map((id) => {
    const won = save.hats.includes(id);
    return `<div class="hat-card${won ? '' : ' locked'}">${hatSVG(id, !won)}<h3>${esc(HATS[id].name)}</h3>` +
      `<p>${esc(HATS[id].from)}</p><p><b>${won ? 'In your cabin' : 'Not won yet'}</b></p></div>`;
  }).join('');
  showScreen('hatsScreen');
}

// ---------- Briefing ----------
export function openBrief(i) {
  loadBattle(i);
  const B = battleDef(i);
  $('briefEyebrow').textContent = mainGoal(B) === 'waves' ? `Skirmish · ${B.year}` : B.tutorial ? `Tutorial · ${B.year}` : `Battle ${B.roman} · ${B.year}`;
  $('briefTitle').textContent = B.name;
  $('briefText').textContent = B.brief;
  const log = STORY[B.id];
  $('briefLog').hidden = !log;
  if (log) {
    $('briefLogDate').textContent = `Captain’s log · ${logDate(B.id, B.year)}`;
    $('briefLogText').textContent = log.before;
  }
  const boss = mainGoal(B) === 'boss' ? bossOf(B) : null;
  $('briefBoss').hidden = !boss;
  if (boss) {
    const have = save.hats.includes(boss.hat), hatName = HATS[boss.hat].name.replace(/^Calico Kate's /, '').toLowerCase();
    $('briefBoss').innerHTML = hatSVG(boss.hat, false) +
      `<p><b>${esc(boss.captain)}</b>${have ? `You already have this hat. Beat ${his(B) === 'her' ? 'her' : 'him'} again for gold.` : `Sink ${esc(boss.title)} to win ${his(B)} ${esc(hatName)}.`}</p>`;
  }
  $('briefOrders').innerHTML = ordersHTML(B);
  music.mood('calm');
  showScreen('briefScreen');
}

export function startPlay() {
  if (!R.renderer || !S.G) return;
  sfx.init();
  S.G.phase = 'play';
  music.mood(S.G.goal === 'boss' ? 'boss' : 'battle');
  showScreen(null);
  if (S.G.goal === 'boss' && S.G.t === 0) showIntro();
}

// ---------- Boss intro card ----------
// When a boss battle begins, the boss's card swings in for a few seconds (tap to skip) while the battle waits.
// Automated browsers skip it so scripted tests run straight on, unless they set window.__broadsideIntro = true.
const INTRO_SECS = 2.8;
let introTimer = null;
function showIntro() {
  if (navigator.webdriver && !window.__broadsideIntro) return;
  const G = S.G, B = battleDef(G.battle), ship = B.enemy.find((e) => e.boss);
  if (!ship) return;
  const boss = ship.boss, story = STORY[B.id] || {};
  const el = $('bossIntro');
  el.innerHTML = '<div class="bi-burst" aria-hidden="true"></div><div class="bi-card">' +
    `<p class="bi-eyebrow">${isPirate(B) ? 'Pirate queen' : 'Enemy flagship'} sighted</p>` +
    `<div class="bi-hat">${hatSVG(boss.hat, false)}</div>` +
    `<h2 class="bi-name">${esc(boss.captain)}</h2>` +
    `<p class="bi-ship">${esc(TYPES[ship.type].label)} <i>${esc(boss.title)}</i></p>` +
    (story.taunt ? `<p class="bi-taunt">“${esc(story.taunt)}”</p>` : '') +
    '<p class="bi-tap">Tap to fight</p></div>';
  el.hidden = false;
  el.classList.remove('out');
  G.phase = 'paused';
  clearTimeout(introTimer);
  introTimer = setTimeout(dismissIntro, INTRO_SECS * 1000);
}
function hideIntro() {
  clearTimeout(introTimer);
  $('bossIntro').hidden = true;
}
// Ends the intro card and lets the battle run.
export function dismissIntro() {
  const el = $('bossIntro');
  if (el.hidden || el.classList.contains('out')) return;
  clearTimeout(introTimer);
  if (S.G && S.G.phase === 'paused' && ui.screen === null) S.G.phase = 'play';
  el.classList.add('out');
  introTimer = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 300);
  renderCoach();
}

// ---------- Pause ----------
export function pauseGame() {
  if (!S.G || S.G.phase !== 'play') return;
  if (S.G.endAt != null) { endBattle(); return; } // the battle is already decided: show the result
  S.G.phase = 'paused';
  S.drag = null;
  $('pauseOrders').innerHTML = ordersHTML(battleDef(S.G.battle));
  showScreen('pauseScreen');
}

// ---------- Results ----------
export function endBattle() {
  const G = S.G;
  if (!G || G.phase === 'over') return;
  G.phase = 'over';
  if (G.goal === 'waves' && !G.award) G.award = recordSkirmish(G.wavesCleared, G.wavesCleared * WAVE_GOLD);
  else if (G.result === 'win' && !G.award) G.award = recordWin(G.battle, shipsLost(G), prizesTaken(G));
  renderEnd();
  showScreen('endScreen');
  music.stinger(G.result === 'win' || !!(G.goal === 'waves' && G.award && G.award.record && G.award.waves));
}
// Your own ships sunk or captured; prizes taken in the battle don't count against you if they sink.
const shipsLost = (G) => G.ships.filter((s) => s.origTeam === 'player' && !s.escort && s.state !== 'escaped' && (s.team !== 'player' || !afloat(s))).length;
const prizesTaken = (G) => G.ships.filter((s) => s.prize && afloat(s)).length;

function renderSkirmishEnd() {
  const G = S.G, a = G.award;
  $('endEyebrow').textContent = 'Endless Skirmish';
  $('endTitle').textContent = a.record && a.waves ? 'New record!' : 'Fleet sunk';
  $('endStars').hidden = true;
  $('endText').textContent = a.waves
    ? `You held out until wave ${G.wave} and beat ${a.waves} wave${a.waves > 1 ? 's' : ''}. Your best is wave ${a.best}.`
    : 'The first wave was too much. Refit at the shipyard and come back.';
  $('endReward').hidden = !a.gold;
  $('endReward').innerHTML = `${COIN}<span>+${a.gold} gold</span>`;
  if (a.gold) coinShower(Math.min(28, 8 + Math.round(a.gold / 25)));
  $('endHat').hidden = true;
  $('endLog').hidden = true;
  const sec = Math.floor(G.t);
  $('statTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('statHits').textContent = G.stats.shots ? `${Math.round((100 * G.stats.hits) / G.stats.shots)}%` : '–';
  $('statLost').textContent = String(shipsLost(G));
  const primary = $('endPrimary');
  primary.hidden = false; primary.textContent = 'Try again'; primary.dataset.go = ENDLESS_ID;
}

// The goal modules (src/sim/goals/) say how a battle was won or lost; the fleet's fate is added here.
function victoryText(B, lost) {
  if (B.tutorial) return 'Swift handles like a dream. You’re ready for the Spanish.';
  return `${winText(B)} ${lost ? 'The fleet limps home to refit.' : 'Not a single ship lost. The Admiral will hear of this.'}`;
}
function defeatText(G, B) {
  if (G.reason && G.reason !== 'fleet') return loseText(B, G.reason);
  const boss = mainGoal(B) === 'boss' ? bossOf(B) : null;
  const foe = boss ? (STORY[B.id] && STORY[B.id].who) || boss.captain : isPirate(B) ? 'the pirates' : `the ${B.foe}`;
  return `Your fleet is sunk and the sea belongs to ${foe}. Refit at the shipyard and try again.`;
}

function renderEnd() {
  const G = S.G;
  if (G.goal === 'waves') return renderSkirmishEnd();
  const B = BATTLES[G.battle], win = G.result === 'win', a = G.award;
  const lost = shipsLost(G);
  $('endEyebrow').textContent = B.tutorial ? 'Shakedown Cruise' : `Battle ${B.roman} · ${B.name}`;
  $('endTitle').textContent = win ? (G.battle === BATTLES.length - 1 ? 'The sea is England’s!' : 'Victory!') : 'Defeat';
  $('endStars').hidden = !win;
  $('endStars').innerHTML = win ? starsHTML(a.stars, true) : '';
  $('endText').textContent = win ? victoryText(B, lost) : defeatText(G, B);
  const log = win && STORY[B.id];
  $('endLog').hidden = !log;
  if (log) {
    $('endLogDate').textContent = `Captain’s log · ${logDate(B.id, B.year)}`;
    $('endLogText').textContent = log.after;
  }
  $('endReward').hidden = !win;
  if (win) {
    const notes = [a.stars === 3 ? 'flawless bonus' : '', a.prizes ? `${a.prizes} prize${a.prizes > 1 ? 's' : ''} +${a.prizeGold}` : '', a.first ? '' : 'replay'].filter(Boolean).join(' · ');
    $('endReward').innerHTML = `${COIN}<span>+${a.gold} gold</span>${notes ? `<span class="up-desc">${notes}</span>` : ''}`;
  }
  if (win) coinShower(Math.min(28, 8 + Math.round(a.gold / 25)));
  $('endHat').hidden = !(win && a.hat);
  if (win && a.hat) $('endHat').innerHTML = `${hatSVG(a.hat, false)}<p>You won the <b>${esc(HATS[a.hat].name.toLowerCase())}</b>! It’s in your hat collection.</p>`;
  const sec = Math.floor(G.t);
  $('statTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('statHits').textContent = G.stats.shots ? `${Math.round((100 * G.stats.hits) / G.stats.shots)}%` : '–';
  $('statLost').textContent = String(lost);
  const next = G.battle + 1 < BATTLES.length ? G.battle + 1 : null;
  const primary = $('endPrimary');
  primary.hidden = win && next == null;
  primary.textContent = win ? 'Next battle' : 'Try again';
  primary.dataset.go = win ? String(next) : String(G.battle);
}

// Gold coins tumble down the results screen after a win.
function coinShower(n) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = $('coinLayer');
  layer.innerHTML = Array.from({ length: n }, () => {
    const x = Math.random() * 100, d = 0.9 + Math.random() * 1.1, delay = Math.random() * 0.9, spin = Math.round(Math.random() * 720 - 360);
    return `<span class="falling-coin" style="left:${x.toFixed(1)}%;animation-duration:${d.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s;--spin:${spin}deg">${COIN}</span>`;
  }).join('');
  clearTimeout(coinShower.t);
  coinShower.t = setTimeout(() => { layer.innerHTML = ''; }, 2600);
}

// ---------- Tutorial coach ----------
const COACH = [
  'Drag from Swift to the gold buoy. She sails along the line you draw.',
  'Press and hold Swift, then drag your finger around her. She drops anchor and turns on the spot.',
  'Tap Swift to raise the anchor.',
];
export function renderCoach() {
  const G = S.G;
  const show = !!(G && G.tut && ui.screen === null && G.phase === 'play');
  $('coach').hidden = !show;
  if (!show) return;
  const step = G.tut.step;
  $('coachStep').textContent = `Step ${step + 1} of ${TUTORIAL_STEPS}`;
  $('coachText').textContent = step < COACH.length ? COACH[step]
    : S.fireMode === 'manual'
      ? 'Put the old hulk off your side, then press Fire port or Fire starboard. Sink her!'
      : 'Put the old hulk off your side. Your gun crews fire on their own once she’s in the arc. Sink her!';
  $('coach').classList.toggle('manual', S.fireMode === 'manual');
}

// ---------- Settings ----------
const FIRE_NOTES = {
  auto: 'Gun crews fire whenever an enemy is in a broadside arc.',
  manual: 'You fire each side yourself with the buttons at the bottom.',
};
export function syncSettings() {
  for (const k of ['A', 'B']) {
    $('fireAuto' + k).setAttribute('aria-pressed', String(S.fireMode === 'auto'));
    $('fireManual' + k).setAttribute('aria-pressed', String(S.fireMode === 'manual'));
    $('fireNote' + k).textContent = FIRE_NOTES[S.fireMode];
  }
  document.querySelectorAll('[data-sound]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.sound === 'off') === S.muted)));
  document.querySelectorAll('[data-music]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.music === 'off') === S.musicMuted)));
}

export function initUI() {
  S.hooks.onEnd = endBattle;
  S.hooks.onTutorialStep = renderCoach;
  document.querySelectorAll('[data-fire]').forEach((b) => b.addEventListener('click', () => {
    S.fireMode = b.dataset.fire; store.set('fire', S.fireMode); syncSettings(); renderCoach();
  }));
  document.querySelectorAll('[data-sound]').forEach((b) => b.addEventListener('click', () => {
    S.muted = b.dataset.sound === 'off'; store.set('sound', S.muted ? 'off' : 'on'); syncSettings();
    if (!S.muted) sfx.init();
  }));
  document.querySelectorAll('[data-music]').forEach((b) => b.addEventListener('click', () => {
    S.musicMuted = b.dataset.music === 'off'; store.set('music', S.musicMuted ? 'off' : 'on'); syncSettings();
    if (!S.musicMuted) sfx.init();
  }));
  // First voyage goes straight to the tutorial briefing; after that, the chart.
  $('startBtn').addEventListener('click', () => { sfx.init(); if (Object.keys(save.stars).length) openChart(); else openBrief(0); });
  $('resetBtn').addEventListener('click', () => {
    if (!resetArmed) {
      $('resetBtn').textContent = 'Tap again to erase your campaign';
      $('resetBtn').classList.add('danger');
      resetArmed = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    resetSave();
    openMenu();
  });
  enablePan($('chartList'));
  $('bossIntro').addEventListener('click', dismissIntro);
  $('chartList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-battle]');
    if (b && !b.disabled) openBrief(b.dataset.battle === ENDLESS_ID ? ENDLESS_ID : +b.dataset.battle);
  });
  $('yardBtn').addEventListener('click', openYard);
  $('hatsBtn').addEventListener('click', openHats);
  $('chartBack').addEventListener('click', openMenu);
  $('yardScreen').addEventListener('click', onYardClick);
  $('yardBack').addEventListener('click', openChart);
  $('hatsBack').addEventListener('click', openChart);
  $('sailBtn').addEventListener('click', startPlay);
  $('briefBack').addEventListener('click', openChart);
  $('resumeBtn').addEventListener('click', startPlay);
  $('restartBtn').addEventListener('click', () => { loadBattle(S.G.battle); startPlay(); });
  $('retreatBtn').addEventListener('click', openChart);
  $('endPrimary').addEventListener('click', (e) => { const go = e.currentTarget.dataset.go; openBrief(go === ENDLESS_ID ? go : +go); });
  $('endChart').addEventListener('click', openChart);
  syncSettings();
}

// Restores the screen a snapshot was taken on (used by hot reloads).
export function restoreScreen(id) {
  const G = S.G;
  if (id === null && G && (G.phase === 'play' || G.phase === 'paused')) { G.phase = 'play'; pauseGame(); return; }
  if (id === 'endScreen' && G && G.phase === 'over') { renderEnd(); showScreen('endScreen'); return; }
  if (id === 'pauseScreen' && G) { G.phase = 'play'; pauseGame(); return; }
  if (id === 'briefScreen' && G) { openBrief(G.battle); return; }
  if (id === 'chartScreen') return openChart();
  if (id === 'yardScreen') return openYard();
  if (id === 'hatsScreen') return openHats();
  openMenu();
}
