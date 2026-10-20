import { briefText, winText, loseText, mainGoal } from '../sim/goals/index.js';
import { S, afloat, selfSailing } from '../state.js';
import { $, store } from '../util.js';
import { BATTLES } from '../config/battles.js';
import { TYPES } from '../config/ships.js';
import { UPGRADES, MAX_FLEET } from '../config/upgrades.js';
import { HATS, HAT_ORDER, hatSVG } from '../config/hats.js';
import { AMMO, AMMO_COSTS, BOARDING } from '../config/ammo.js';
import { GUNS } from '../config/guns.js';
import { slotGroups, fullLoadout, loadoutWeight, accepts, slotCount } from '../config/slots.js';
import { battleDef, ENDLESS_ID, ENDLESS, WAVE_GOLD } from '../config/endless.js';
import { LAB_ID } from '../config/lab.js';
import {
  save, resetSave, recordSkirmish, starsFor, fleetStats, refitOffer, upgradeOffer, buyUpgrade, buyRefit, buyAmmo, nextHire, buyHire, isUnlocked, recordWin, lvl,
  upgradesFor, greatOffer, buyGreatShip, fitOffer, fitGun,
} from '../save.js';
import { loadBattle } from '../game.js';
import { R } from '../render/gl.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { TUTORIAL_STEPS } from '../sim/update.js';
import { STORY, logDate } from '../config/story.js';
import { renderChart, enablePan } from './chart.js';
import { DURATION, EASE } from './tokens.js';
import { iconSVG } from './icons.js';

// DOM screens around the battle: menu, sea chart, shipyard, hats, briefing, pause, results, tutorial coach.
const SCREENS = ['menuScreen', 'settingsScreen', 'chartScreen', 'yardScreen', 'hatsScreen', 'briefScreen', 'pauseScreen', 'endScreen'];
export const ui = { screen: 'menuScreen', yardSel: 0, slotOpen: null };

// Gold as type: a figure in oldstyle numerals and the word in small capitals.
const fmt = (n) => Number(n).toLocaleString('en-GB');
const goldHTML = (n) => `${fmt(n)} <small>gold</small>`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh',
  'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
function romanValue(r) {
  const V = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < r.length; i++) { const v = V[r[i]] || 0, w = V[r[i + 1]] || 0; n += v < w ? -v : v; }
  return n;
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Where a battle is fought, for the line under its name.
const WHERE = {
  port: 'off Port Royal', windward: 'in the Windward Passage', main: 'off the Spanish Main', golden: 'among the Golden Isles',
  pirate: 'off the Pirate Coast', campeche: 'in the Bay of Campeche', armada: 'against the last Armada',
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const starsHTML = (n, big) => `<span class="stars${big ? ' big' : ''}" role="img" aria-label="${n} of 3 stars">` +
  [0, 1, 2].map((i) => iconSVG('star', { cls: 'star' + (i < n ? ' on' : '') })).join('') + '</span>';

// Shows one screen (or none, for the battle). A screen opened from the battle, or at boot, fades its scrim in;
// moving between menus only the content rises in, so the backdrop never flashes.
let booted = false;
export function showScreen(id) {
  if (id !== null) hideIntro();
  document.documentElement.classList.toggle('menus', id !== null);
  const prev = ui.screen;
  ui.screen = id;
  for (const s of SCREENS) {
    const el = $(s), show = s === id;
    if (show && (el.hidden || !booted)) el.classList.toggle('enter-fade', prev === null || !booted);
    el.hidden = !show;
  }
  booted = true;
  renderCoach();
}

// Counts a number up from zero (gold won, for one): eased, and instant when motion is reduced.
function countUp(el, to, { prefix = '', suffix = '', delay = 0, ms = DURATION.count } = {}) {
  const set = (v) => { el.textContent = prefix + Math.round(v) + suffix; };
  cancelAnimationFrame(el._count);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !to) { set(to); return; }
  set(0);
  const t0 = performance.now() + delay;
  const tick = (now) => {
    const k = Math.min(1, Math.max(0, (now - t0) / ms));
    set(to * EASE.out(k));
    if (k < 1) el._count = requestAnimationFrame(tick);
  };
  el._count = requestAnimationFrame(tick);
}

// Menus keep the battle behind them idle, so nothing sails or fires while you browse.
function idle() { if (S.G) S.G.phase = 'title'; }

// ---------- Battle descriptions ----------
const PLURAL = {
  sloop: 'sloops', brig: 'brigs', frigate: 'frigates', galleon: 'galleons', manowar: "men-o'-war",
  schooner: 'schooners', xebec: 'xebecs', bomb: 'bomb ketches', fireship: 'fireships', merchant: 'merchantmen', greatship: 'great ships',
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
  const parts = Object.entries(counts).map(([t, n]) => `${word(n)} ${n === 1 ? TYPES[t].label.toLowerCase() : PLURAL[t] || TYPES[t].label.toLowerCase() + 's'}`);
  const forts = enemyForts(B).length;
  if (forts) parts.push(`${word(forts)} fort${forts > 1 ? 's' : ''}`);
  const waves = (B.events || []).filter((e) => e.spawn).length;
  if (waves) parts.push(`then ${word(waves)} wave${waves > 1 ? 's' : ''} of reinforcements`);
  return cap(parts.join(', '));
}
// Each goal writes its own orders (src/sim/goals/).
function goalText(B) {
  if (B.tutorial) return 'Follow your bosun’s orders, then sink the old hulk.';
  return briefText(B);
}
// The battle's own advice, less anything the sheet already says. A sentence is dropped when half or more of its
// content words (stemmed to five letters) already appear in the log, the orders or the notes, so the briefing
// never tells the same thing twice.
const STOP = new Set(['they', 'them', 'then', 'their', 'there', 'will', 'from', 'with', 'that', 'this', 'your', 'into',
  'before', 'after', 'while', 'when', 'where', 'what', 'which', 'more', 'most', 'some', 'only', 'each', 'every', 'have', 'here']);
const stems = (t) => String(t).toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-záéíóúñ ]+/g, ' ').split(/\s+/)
  .filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 5));
function counsel(B, said) {
  const sentences = String(B.brief || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const known = new Set(stems(said));
  return sentences.filter((t) => { const w = stems(t); return !w.length || w.filter((x) => known.has(x)).length / w.length < 0.5; }).join(' ');
}
// Orders as a printed order reads: paragraphs with run-in small-capital heads. `withCounsel` adds the battle's
// advice (the briefing shows it as its lede instead when there is no log entry).
function ordersHTML(B, { withCounsel = true } = {}) {
  const h = (t) => `<span class="h">${t}.</span> `;
  const p = [`<p>${h('Orders')}${esc(goalText(B))}</p>`];
  let roster = -1;
  if (mainGoal(B) === 'waves') p.push(`<p>Between waves your ships patch a quarter of their hull and restock mines. Each wave beaten pays ${WAVE_GOLD} gold.${save.best ? ` Your best is wave ${save.best}.` : ''}</p>`);
  else if (!B.tutorial) roster = p.push(`${h('Against you')}${esc(rosterText(B))}.`) - 1;
  if (B.fog) p.push(`<p>${h('Fog')}Your lookouts see only ships close to your own. Keep the fleet together and watch the edges of the murk.</p>`);
  if (ownForts(B).length) p.push('<p>Your fort’s guns fire on anything in range, but it cannot dodge. Hunt down the bomb ketches before they wear it down.</p>');
  if (enemyForts(B).length) p.push('<p>Forts fire in every direction. Once one is silenced, stop a ship beside it and tap <i>Land</i>.</p>');
  if (S.G && S.G.ships.some((s) => s.team === 'player' && s.mines > 0)) p.push('<p>A ship with mines can tap <i>Mine</i> to leave one astern.</p>');
  if (!B.tutorial && mainGoal(B) !== 'boss' && mainGoal(B) !== 'breakthrough') p.push(`<p>Batter an enemy below ${Math.round(BOARDING.hpFrac * 100)}% hull, come alongside and tap <i>Board</i> to take her as a prize, worth ${BOARDING.prizeGold} gold.</p>`);
  // The battle's own advice joins the roster, less whatever the log and the paragraphs above already say.
  if (roster >= 0) {
    const advice = withCounsel ? counsel(B, [(STORY[B.id] || {}).before || '', ...p].join(' ')) : '';
    p[roster] = `<p>${p[roster]}${advice ? ' ' + esc(advice) : ''}</p>`;
  }
  if (!B.tutorial) p.push('<p class="note">Drag on the sea to plot a course, or tap it to sail straight there; tap an enemy to engage. Pinch to zoom, double-tap to recentre.</p>');
  return p.join('');
}

// ---------- Title page ----------
let resetArmed = null;
export function openMenu() {
  idle();
  $('startBtn').textContent = Object.keys(save.stars).length ? 'Continue' : 'Set sail';
  disarmReset();
  music.mood('menu');
  showScreen('menuScreen');
}
function openSettings() {
  disarmReset();
  showScreen('settingsScreen');
}
function disarmReset() {
  clearTimeout(resetArmed); resetArmed = null;
  $('resetBtn').textContent = 'New campaign';
  $('resetBtn').classList.remove('danger');
}

// ---------- Sea chart ----------
export function openChart() {
  idle();
  $('chartGold').innerHTML = goldHTML(save.gold);
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
// One line of the ledger: what it is, what it does, its price as a figure, and one way to buy it.
function buyRow(cls, name, desc, pips, cost, id) {
  const can = cost != null && save.gold >= cost;
  const lv = pips && pips[1] > 1 ? ` <span class="lv">${pips[0]} of ${pips[1]}</span>` : '';
  const aria = cost == null ? `${name}: fully fitted` : `Buy ${name} for ${cost} gold`;
  const btn = cost == null
    ? `<button type="button" class="buy maxed" data-buy="${id}" disabled aria-label="${esc(aria)}">${pips && pips[1] === 1 ? 'aboard' : 'fitted'}</button>`
    : `<button type="button" class="buy" data-buy="${id}"${can ? '' : ' disabled'} aria-label="${esc(aria)}">buy</button>`;
  return `<div class="up-row ${cls}${cost != null && !can ? ' dear' : ''}"><div><div class="up-name">${esc(name)}${lv}</div><div class="up-desc">${esc(desc)}</div></div>` +
    `<span class="up-price">${cost == null ? '' : fmt(cost)}</span>${btn}</div>`;
}
const dash = (n) => (n ? n : '–');
// Tons as type: a whole number when it is one.
const tons = (w) => (Math.round(w * 10) / 10).toLocaleString('en-GB');
const plural = (n, one, many) => `${word(n)} ${n === 1 ? one : many}`;

// The gun decks of a ship with slots (the great ship): one ledger line per slot, grouped by where it sits, saying
// what is fitted there and how many guns. "Change" opens the slot: a line per gun it takes, with what the gun
// does, its reach and weight, the price of fitting the whole slot, and one small ruled "fit".
function gunDecks(f, T) {
  const full = fullLoadout(T, f.loadout), weight = loadoutWeight(T, f.loadout);
  let html = `<div class="lo-head"><h4>The gun decks</h4><span class="lo-tons">${tons(weight)} of ${tons(T.tons)} tons</span></div>`;
  for (const g of slotGroups(T)) {
    html += `<h5 class="lo-group">${esc(g.label)}</h5>`;
    for (const id of g.slots) {
      const slot = T.slots[id], gun = GUNS[full[id]], n = slotCount(slot, full[id]), open = ui.slotOpen === id;
      html += `<div class="up-row lo-slot${open ? ' open' : ''}" data-slot-row="${id}"><div><div class="up-name">${esc(slot.label)}` +
        ` <span class="lv">${n === 1 ? 'one piece' : plural(n, 'gun', 'guns')}</span></div><div class="up-desc">${esc(gun.label)}</div></div>` +
        `<span class="up-price"></span><button type="button" class="buy change" data-slot="${id}" aria-expanded="${open}"` +
        ` aria-label="${esc(`Change the guns in the ${slot.label.toLowerCase()}`)}">${open ? 'close' : 'change'}</button></div>`;
      if (open) html += slotOptions(f, id);
    }
  }
  return html;
}
function slotOptions(f, id) {
  let html = '<div class="lo-options">';
  for (const g of accepts(TYPES[f.cls].slots[id])) {
    const o = fitOffer(f, id, g), G = o.gun;
    const stats = [G.fires === 'shell' ? `reach ${G.minRange}–${G.range}` : `reach ${G.range}`, `loads in ${G.reload} s`,
      G.fires === 'pot' ? `burns ${G.burn} s` : G.fires === 'shell' ? `${G.dmg} a shell` : G.pellets ? `${G.pellets} balls of ${G.dmg}` : `${G.dmg} a ball`,
      `${tons(G.weight * o.count)} tons`].join(' · ');
    const can = o.cost != null && !o.over && save.gold >= o.cost;
    const label = `${G.label}${o.count > 1 ? ` <span class="lv">${word(o.count)}</span>` : ''}`;
    const btn = o.fitted
      ? `<button type="button" class="buy maxed" disabled aria-label="${esc(`${G.label}: fitted`)}">fitted</button>`
      : `<button type="button" class="buy" data-buy="fit:${id}:${g}"${can ? '' : ' disabled'} aria-label="${esc(`Fit ${G.label.toLowerCase()} for ${o.cost} gold`)}">fit</button>`;
    html += `<div class="up-row lo-gun${o.fitted ? ' fitted' : ''}${!o.fitted && !can ? ' dear' : ''}"><div><div class="up-name">${label}</div>` +
      `<div class="up-desc">${esc(G.about)}</div><div class="lo-stats">${esc(stats)}${o.over ? ` · <em>too heavy: ${tons(o.weight)} of ${tons(TYPES[f.cls].tons)} tons</em>` : ''}</div></div>` +
      `<span class="up-price">${o.fitted ? '' : fmt(o.cost)}</span>${btn}</div>`;
  }
  return html + '</div>';
}

function renderYard() {
  $('yardGold').innerHTML = goldHTML(save.gold);
  const i = (ui.yardSel = Math.min(ui.yardSel, save.fleet.length - 1));
  $('yardTabs').innerHTML = save.fleet.map((f, k) =>
    `<button type="button" class="tab" role="tab" aria-selected="${k === i}" data-ship="${k}">${esc(f.name)}</button>`).join('');
  const f = save.fleet[i], st = fleetStats(f), T = TYPES[f.cls];
  let html = `<div class="ship-head"><h3>${esc(f.name)}, <i>a ${esc(st.label.toLowerCase())}</i></h3></div>` +
    '<dl class="ship-stats">' +
    `<div><dt>Hull</dt><dd>${st.hp}</dd></div><div><dt>Guns a side</dt><dd>${st.guns}</dd></div>` +
    `<div><dt>Speed</dt><dd>${st.speed}</dd></div><div><dt>Marines</dt><dd>${dash(st.marines)}</dd></div>` +
    // A great ship counts her chase guns fore and aft in one line (her tons are at the head of the gun decks).
    (T.slots ? `<div><dt>Chase guns</dt><dd>${st.chasers} + ${st.sternGuns}</dd></div>` : `<div><dt>Bow guns</dt><dd>${dash(st.chasers)}</dd></div>`) +
    `<div><dt>Mines</dt><dd>${dash(st.mines)}</dd></div>` +
    `<div class="wide"><dt>Shot</dt><dd>${st.ammo.map((k) => AMMO[k].short.toLowerCase()).join(', ')}</dd></div>` +
    '</dl><div class="up-list">';
  const rf = refitOffer(f);
  if (rf) {
    const R = TYPES[rf.next];
    html += buyRow('refit', `Refit as a ${rf.label.toLowerCase().replace(/-/g, '‑')}`, `${R.hp} hull, ${word(R.guns)} guns a side, ${R.marines} marines; fittings carry over`, null, rf.cost, 'refit');
  }
  // After La Gran Armada: rebuild her as a great ship, the one class whose guns are fitted slot by slot.
  const go = greatOffer(f);
  if (go) {
    const R = TYPES[go.next];
    html += buyRow('refit great', `Rebuild as a ${go.label.toLowerCase()}`, `A first rate: ${R.hp} hull, two tiers of guns a side, chase guns fore and aft, every gun to be fitted as you please`, null, go.cost, 'great');
  }
  if (T.slots) html += gunDecks(f, T);
  for (const U of upgradesFor(f)) {
    const o = upgradeOffer(f, U.id);
    html += buyRow('', U.name, U.desc, [o.level, U.max], o.cost, U.id);
  }
  for (const kind of ['chain', 'grape']) {
    const have = lvl(f, kind);
    html += buyRow('', AMMO[kind].name, AMMO[kind].desc, [have, 1], have ? null : AMMO_COSTS[kind], 'ammo:' + kind);
  }
  $('yardShip').innerHTML = html + '</div>';
  if (!renderYard.quiet) $('yardShip').querySelector('.up-list').classList.add('stagger');
  const h = nextHire();
  $('yardHire').innerHTML = h
    ? buyRow('', `Hire the ${TYPES[h.cls].label.toLowerCase()} ${h.name}`, `Joins the squadron, which tops out at ${word(MAX_FLEET)} ships`, null, h.cost, 'hire')
    : '';
}
// Redraws the ledger in place (after a purchase, or opening a slot), keeping the scroll.
function quietYard() {
  const list = $('yardShip').querySelector('.up-list'), top = list ? list.scrollTop : 0;
  renderYard.quiet = true; renderYard(); renderYard.quiet = false;
  const now = $('yardShip').querySelector('.up-list');
  if (now) now.scrollTop = top;
}
function onYardClick(e) {
  const tab = e.target.closest('[data-ship]');
  if (tab) { ui.yardSel = +tab.dataset.ship; ui.slotOpen = null; renderYard(); return; }
  const sl = e.target.closest('[data-slot]');
  if (sl) { ui.slotOpen = ui.slotOpen === sl.dataset.slot ? null : sl.dataset.slot; sfx.init(); quietYard(); return; }
  const b = e.target.closest('[data-buy]');
  if (!b || b.disabled) return;
  const id = b.dataset.buy, i = ui.yardSel;
  const what = b.closest('.up-row').querySelector('.up-name').firstChild.textContent.trim();
  const [, slotId, gun] = id.startsWith('fit:') ? id.split(':') : [];
  const ok = id === 'refit' ? buyRefit(i) : id === 'great' ? buyGreatShip(i) : id === 'hire' ? buyHire() : id.startsWith('ammo:') ? buyAmmo(i, id.slice(5))
    : slotId ? fitGun(i, slotId, gun) : buyUpgrade(i, id);
  if (ok) {
    sfx.init(); sfx.coin();
    if (id === 'hire') ui.yardSel = save.fleet.length - 1;
    if (slotId) ui.slotOpen = null;
    quietYard(); // a purchase updates in place
    toast(id === 'hire' ? `${save.fleet[save.fleet.length - 1].name} joins the squadron` : id === 'refit' ? 'Refit complete'
      : id === 'great' ? `${save.fleet[i].name} is rebuilt as a great ship`
        : slotId ? `${what} fitted in the ${TYPES[save.fleet[i].cls].slots[slotId].label.toLowerCase()}`
          : id.startsWith('ammo:') ? `${what} stowed aboard` : `${what} fitted`, id === 'hire' ? 'ship' : 'check');
  }
}
// A short confirmation that drops in at the top of the screen and fades away by itself.
let toastTimer = null;
export function toast(text, icon = 'check') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = iconSVG(icon) + `<span>${esc(text)}</span>`;
  el.hidden = false;
  el.classList.remove('out');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('out'); toastTimer = setTimeout(() => { el.hidden = true; }, 260); }, 1800);
}

// ---------- Hats ----------
// "Taken from Capitán Rojo of La Bruja" once won; "Still on the head of ..." until then.
function hatFrom(from, won) {
  if (/^Finish /.test(from)) return won ? 'For ' + from.replace(/^Finish/, 'finishing') : from;
  const who = from.replace(/^The /, 'the ');
  return won ? `Taken from ${who}` : `Still worn by ${who}`;
}
export function openHats() {
  idle();
  $('hatGrid').innerHTML = HAT_ORDER.map((id) => {
    const won = save.hats.includes(id);
    return `<div class="hat-card${won ? '' : ' locked'}">${hatSVG(id, !won)}<h3>${esc(HATS[id].name)}</h3>` +
      `<p>${esc(hatFrom(HATS[id].from, won))}</p></div>`;
  }).join('');
  $('hatGrid').classList.add('stagger');
  $('hatsTally').textContent = `${word(HAT_ORDER.filter((id) => save.hats.includes(id)).length)} of ${word(HAT_ORDER.length)}`;
  showScreen('hatsScreen');
}

// ---------- Briefing ----------
export function openBrief(i) {
  loadBattle(i);
  const B = battleDef(i);
  const n = romanValue(B.roman || '');
  $('briefEyebrow').textContent = i === LAB_ID ? `Battle lab · ${B.year}` : mainGoal(B) === 'waves' ? 'Exercising the great guns'
    : B.tutorial ? 'Before the first engagement' : ORDINALS[n] ? `The ${ORDINALS[n]} engagement` : `Battle ${B.roman}`;
  $('briefTitle').textContent = B.name;
  const log = STORY[B.id];
  // The chart region names the waters, unless the battle is plainly somewhere else (the siege is at Port Royal).
  const elsewhere = B.region !== 'port' && /Port Royal/.test(`${B.name} ${log ? log.before : ''}`);
  $('briefWhere').textContent = [elsewhere ? '' : WHERE[B.region], log ? logDate(B.id, B.year) : B.year].filter(Boolean).join(', ');
  // The log is the hook; without one, the battle's own description takes its place.
  $('briefLog').hidden = !log;
  $('briefText').hidden = !!log;
  $('briefText').textContent = log ? '' : B.brief;
  if (log) $('briefLogText').textContent = log.before;
  const boss = mainGoal(B) === 'boss' ? bossOf(B) : null;
  $('briefBoss').hidden = !boss;
  if (boss) {
    const have = save.hats.includes(boss.hat), hatName = HATS[boss.hat].name.replace(/^Calico Kate's /, '').toLowerCase();
    const them = his(B) === 'her' ? 'her' : 'him';
    $('briefBoss').innerHTML = hatSVG(boss.hat, false) +
      `<p><b>${esc(boss.captain)}</b><span>${have ? `Already in your cabin. Beat ${them} again for the gold.` : `Sink ${them} and the ${esc(hatName)} is yours.`}</span></p>`;
  }
  $('briefOrders').innerHTML = ordersHTML(B, { withCounsel: !!log });
  $('briefOrders').classList.add('stagger');
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
  el.innerHTML = '<div class="bi-card sheet">' +
    `<p class="bi-eyebrow">${isPirate(B) ? 'The pirate queen' : 'The enemy flagship'} is sighted</p>` +
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
  $('pauseOrders').innerHTML = ordersHTML(battleDef(S.G.battle), { withCounsel: true });
  $('pauseOrders').classList.add('stagger');
  showScreen('pauseScreen');
}

// ---------- Results ----------
export function endBattle() {
  const G = S.G;
  if (!G || G.phase === 'over') return;
  G.phase = 'over';
  // A battle from the lab is played for its own sake: nothing is written to the save.
  if (G.battle === LAB_ID && !G.award) G.award = { lab: true, gold: 0, stars: starsFor(shipsLost(G)), hat: null, first: false, prizes: 0, prizeGold: 0, waves: G.wavesCleared, best: save.best || 0, record: false };
  else if (G.goal === 'waves' && !G.award) G.award = recordSkirmish(G.wavesCleared, G.wavesCleared * WAVE_GOLD);
  else if (G.result === 'win' && !G.award) G.award = recordWin(G.battle, shipsLost(G), prizesTaken(G));
  renderEnd();
  showScreen('endScreen');
  music.stinger(G.result === 'win' || !!(G.goal === 'waves' && G.award && G.award.record && G.award.waves));
}
// Your own ships sunk or captured; prizes taken in the battle don't count against you if they sink.
const shipsLost = (G) => G.ships.filter((s) => s.origTeam === 'player' && !selfSailing(s) && s.state !== 'escaped' && (s.team !== 'player' || !afloat(s))).length;
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
  $('endReward').innerHTML = `<span class="gold-num"><span class="gold-count">+${a.gold}</span><small>gold</small></span>`;
  if (a.gold) countUp($('endReward').querySelector('.gold-count'), a.gold, { prefix: '+', delay: 450 });
  $('endTitle').classList.toggle('won', !!(a.record && a.waves));
  $('endHat').hidden = true;
  $('endLog').hidden = true;
  const sec = Math.floor(G.t);
  $('statTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('statHits').textContent = G.stats.shots ? `${Math.round((100 * G.stats.hits) / G.stats.shots)}%` : '–';
  $('statLost').textContent = String(shipsLost(G));
  const primary = $('endPrimary');
  primary.hidden = false; primary.textContent = 'Try again'; primary.dataset.go = G.battle;
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
  const B = battleDef(G.battle), win = G.result === 'win', a = G.award;
  const lost = shipsLost(G);
  $('endEyebrow').textContent = a && a.lab ? `Battle lab · ${B.name}` : B.name;
  $('endTitle').textContent = win ? (G.battle === BATTLES.length - 1 && !a.lab ? 'The sea is England’s!' : 'Victory!') : 'Defeat';
  $('endTitle').classList.toggle('won', win);
  $('endStars').hidden = !win;
  $('endStars').innerHTML = win ? starsHTML(a.stars, true) : '';
  $('endText').textContent = win ? victoryText(B, lost) : defeatText(G, B);
  const log = win && STORY[B.id];
  $('endLog').hidden = !log;
  if (log) {
    $('endLogDate').textContent = `From the log, ${logDate(B.id, B.year)}`;
    $('endLogText').textContent = log.after;
  }
  $('endReward').hidden = !win || a.lab;
  if (win && !a.lab) {
    const notes = [a.stars === 3 ? 'flawless bonus' : '', a.prizes ? `${a.prizes} prize${a.prizes > 1 ? 's' : ''} +${a.prizeGold}` : '', a.first ? '' : 'replay'].filter(Boolean).join(' · ');
    $('endReward').innerHTML = `<span class="gold-num"><span class="gold-count">+${a.gold}</span><small>gold</small></span>${notes ? `<span class="note">${notes}</span>` : ''}`;
    countUp($('endReward').querySelector('.gold-count'), a.gold, { prefix: '+', delay: 700 });
  }
  $('endHat').hidden = !(win && a.hat);
  if (win && a.hat) {
    // "the red tricorne", but "Calico Kate's skull hat": a hat named after its owner keeps the name.
    const n = HATS[a.hat].name, named = /^[A-Z][a-z]+ [A-Z]/.test(n);
    $('endHat').innerHTML = `${hatSVG(a.hat, false)}<p><b>${esc(named ? n : 'The ' + n.toLowerCase())}</b> is yours, and goes to the cabinet.</p>`;
  }
  const sec = Math.floor(G.t);
  $('statTime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('statHits').textContent = G.stats.shots ? `${Math.round((100 * G.stats.hits) / G.stats.shots)}%` : '–';
  $('statLost').textContent = String(lost);
  const next = typeof G.battle === 'number' && G.battle + 1 < BATTLES.length ? G.battle + 1 : null;
  const primary = $('endPrimary'), again = !win || a.lab; // a lab battle has no next battle, only another go
  primary.hidden = !again && next == null;
  primary.textContent = again ? (win ? 'Play again' : 'Try again') : 'Next battle';
  primary.dataset.go = again ? String(G.battle) : String(next);
}

// ---------- Tutorial coach ----------
const COACH = [
  'Drag a line across the sea to the gold buoy. The pale ribbon shows the track Swift will really sail.',
  'Now just tap the open sea. Swift sails straight there.',
  'Tap Anchor at the bottom, then drag around Swift to turn her on the spot.',
  'Tap the old hulk to engage. Swift weighs anchor and keeps her on the beam. (Tap Swift again to let go of her and look around.)',
];
export function renderCoach() {
  const G = S.G;
  const show = !!(G && G.tut && ui.screen === null && G.phase === 'play');
  $('coach').hidden = !show;
  if (!show) return;
  const step = G.tut.step;
  // Each new step pops the bubble in again.
  if (renderCoach.step !== step) {
    renderCoach.step = step;
    const el = $('coach');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  $('coachStep').textContent = `Step ${step + 1} of ${TUTORIAL_STEPS}`;
  $('coachText').textContent = step < COACH.length ? COACH[step]
    : S.fireMode === 'manual'
      ? 'Swift keeps the hulk on her beam. Press Port or Starboard when she’s in the arc. Sink her!'
      : 'Swift keeps the hulk on her beam and her gun crews fire on their own. Sink her!';
  $('coach').classList.add('manual'); // always sits above the action bar
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

// Buttons marked data-icon="name" in index.html get that icon in front of their label.
function decorateButtons() {
  document.querySelectorAll('[data-icon]').forEach((b) => {
    if (!b.querySelector('.icon')) b.insertAdjacentHTML('afterbegin', iconSVG(b.dataset.icon));
  });
}

export function initUI() {
  decorateButtons();
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
  $('settingsBtn').addEventListener('click', openSettings);
  $('settingsDone').addEventListener('click', openMenu);
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
  $('endPrimary').addEventListener('click', (e) => { const go = e.currentTarget.dataset.go; openBrief(go === ENDLESS_ID || go === LAB_ID ? go : +go); });
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
  if (id === 'settingsScreen') return openSettings();
  openMenu();
}
