import { S, afloat } from '../state.js';
import { $, store } from '../util.js';
import { BATTLES, REGIONS } from '../config/battles.js';
import { TYPES } from '../config/ships.js';
import { UPGRADES, MAX_FLEET } from '../config/upgrades.js';
import { HATS, HAT_ORDER, hatSVG } from '../config/hats.js';
import {
  save, resetSave, fleetStats, refitOffer, upgradeOffer, buyUpgrade, buyRefit, nextHire, buyHire, isUnlocked, recordWin,
} from '../save.js';
import { loadBattle } from '../game.js';
import { R } from '../render/gl.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { TUTORIAL_STEPS } from '../sim/update.js';

// DOM screens around the battle: menu, sea chart, shipyard, hats, briefing, pause, results, tutorial coach.
const SCREENS = ['menuScreen', 'chartScreen', 'yardScreen', 'hatsScreen', 'briefScreen', 'pauseScreen', 'endScreen'];
export const ui = { screen: 'menuScreen', yardSel: 0 };

const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="#f2b632" stroke="#3a2414" stroke-width="2.5"/><circle cx="10" cy="10" r="4" fill="none" stroke="#c98a17" stroke-width="2"/></svg>';
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const starsHTML = (n, big) => `<span class="stars${big ? ' big' : ''}" role="img" aria-label="${n} of 3 stars">` +
  [0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('') + '</span>';

export function showScreen(id) {
  ui.screen = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  renderCoach();
}

// Menus keep the battle behind them idle, so nothing sails or fires while you browse.
function idle() { if (S.G) S.G.phase = 'title'; }

// ---------- Battle descriptions ----------
const PLURAL = { sloop: 'sloops', brig: 'brigs', frigate: 'frigates', galleon: 'galleons', manowar: "men-o'-war" };
function rosterText(B) {
  const counts = {};
  for (const e of B.enemy) counts[e.type] = (counts[e.type] || 0) + 1;
  const parts = Object.entries(counts).map(([t, n]) => `${n} ${n === 1 ? TYPES[t].label.toLowerCase() : PLURAL[t]}`);
  if (B.forts) parts.push(`${B.forts.length} fort${B.forts.length > 1 ? 's' : ''}`);
  return parts.join(', ');
}
function goalText(B) {
  if (B.tutorial) return 'Follow your bosun’s orders, then sink the old hulk.';
  if (B.goal === 'boss') { const b = B.enemy.find((e) => e.boss).boss; return `Sink ${b.captain}’s ${b.title}.`; }
  if (B.goal === 'capture') {
    return B.forts.length === 1
      ? `Take ${B.forts[0].name}: shoot it silent, then land troops.`
      : `Take all ${B.forts.length} forts: shoot each one silent, then land troops.`;
  }
  return `Sink all ${B.enemy.length} enemy ships.`;
}
function ordersHTML(B) {
  const li = [`<li><b>Orders:</b> ${esc(goalText(B))}</li>`];
  if (!B.tutorial) li.push(`<li><b>Enemy:</b> ${esc(rosterText(B))}.</li>`);
  if (B.forts) li.push('<li>Forts fire in every direction. Once one is silenced, stop a ship beside it and tap <b>Land troops</b>.</li>');
  if (S.G && S.G.ships.some((s) => s.team === 'player' && s.mines > 0)) li.push('<li>Select a ship with mines and tap <b>Drop mine</b> to leave one astern.</li>');
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
  const next = BATTLES.findIndex((b, i) => isUnlocked(i) && !save.stars[b.id]);
  let html = '';
  for (const reg of REGIONS) {
    html += `<section class="region"><h3>${esc(reg.name)}</h3><ol class="route">`;
    BATTLES.forEach((b, i) => {
      if (b.region !== reg.id) return;
      const open = isUnlocked(i), stars = save.stars[b.id] || 0;
      const boss = b.goal === 'boss';
      const cls = ['node', boss ? 'boss' : '', i === next ? 'next' : ''].filter(Boolean).join(' ');
      const num = boss ? hatSVG(b.hat, !save.hats.includes(b.hat)) : esc(b.roman);
      const tags = (b.tutorial ? '<span class="tag">Tutorial</span>' : '') + (boss ? '<span class="tag boss">Boss</span>' : '') + (b.forts ? '<span class="tag fort">Fort</span>' : '');
      const meta = `${tags}${b.year} · ${esc(rosterText(b))}`;
      const right = open ? starsHTML(stars) : '<span class="lock">Locked</span>';
      html += `<li><button type="button" class="${cls}" data-battle="${i}"${open ? '' : ' disabled'}>` +
        `<span class="node-num">${num}</span><span class="node-body"><span class="node-name">${esc(b.name)}</span>` +
        `<span class="node-meta">${meta}</span></span>${right}</button></li>`;
    });
    html += '</ol></section>';
  }
  $('chartList').innerHTML = html;
  music.mood('calm');
  showScreen('chartScreen');
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
  const ok = id === 'refit' ? buyRefit(i) : id === 'hire' ? buyHire() : buyUpgrade(i, id);
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
  const B = BATTLES[i];
  $('briefEyebrow').textContent = B.tutorial ? `Tutorial · ${B.year}` : `Battle ${B.roman} · ${B.year}`;
  $('briefTitle').textContent = B.name;
  $('briefText').textContent = B.brief;
  const boss = B.goal === 'boss' ? B.enemy.find((e) => e.boss).boss : null;
  $('briefBoss').hidden = !boss;
  if (boss) {
    const have = save.hats.includes(boss.hat);
    $('briefBoss').innerHTML = hatSVG(boss.hat, false) +
      `<p><b>${esc(boss.captain)}</b>${have ? 'You already have this hat. Beat him again for gold.' : `Sink ${esc(boss.title)} to win his ${esc(HATS[boss.hat].name.toLowerCase())}.`}</p>`;
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
}

// ---------- Pause ----------
export function pauseGame() {
  if (!S.G || S.G.phase !== 'play') return;
  S.G.phase = 'paused';
  S.drag = null;
  $('pauseOrders').innerHTML = ordersHTML(BATTLES[S.G.battle]);
  showScreen('pauseScreen');
}

// ---------- Results ----------
export function endBattle() {
  const G = S.G;
  if (!G || G.phase === 'over') return;
  G.phase = 'over';
  const lost = G.ships.filter((s) => s.team === 'player' && !afloat(s)).length;
  if (G.result === 'win' && !G.award) G.award = recordWin(G.battle, lost);
  renderEnd();
  showScreen('endScreen');
  music.stinger(G.result === 'win');
}
function renderEnd() {
  const G = S.G, B = BATTLES[G.battle], win = G.result === 'win', a = G.award;
  const lost = G.ships.filter((s) => s.team === 'player' && !afloat(s)).length;
  $('endEyebrow').textContent = B.tutorial ? 'Shakedown Cruise' : `Battle ${B.roman} · ${B.name}`;
  $('endTitle').textContent = win ? 'Victory!' : 'Defeat';
  $('endStars').hidden = !win;
  $('endStars').innerHTML = win ? starsHTML(a.stars, true) : '';
  let text;
  if (!win) text = `Your fleet is sunk and the ${B.foe} holds the sea. Refit at the shipyard and try again.`;
  else if (B.tutorial) text = 'Swift handles like a dream. You’re ready for the Spanish.';
  else if (B.goal === 'boss') text = `${B.enemy.find((e) => e.boss).boss.captain} strikes his colours. ${lost ? 'The fleet limps home to refit.' : 'Not a single ship lost.'}`;
  else if (B.goal === 'capture') text = `The English flag flies over ${B.forts.length > 1 ? 'both forts' : B.forts[0].name}. ${lost ? 'The fleet limps home to refit.' : 'Not a single ship lost.'}`;
  else text = `The ${B.foe} is on the bottom. ${lost ? 'The fleet limps home to refit.' : 'Not a single ship lost. The admiral will hear of this.'}`;
  $('endText').textContent = text;
  $('endReward').hidden = !win;
  if (win) {
    const notes = [a.stars === 3 ? 'flawless bonus' : '', a.first ? '' : 'replay'].filter(Boolean).join(' · ');
    $('endReward').innerHTML = `${COIN}<span>+${a.gold} gold</span>${notes ? `<span class="up-desc">${notes}</span>` : ''}`;
  }
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
  $('chartList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-battle]');
    if (b && !b.disabled) openBrief(+b.dataset.battle);
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
  $('endPrimary').addEventListener('click', (e) => openBrief(+e.currentTarget.dataset.go));
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
