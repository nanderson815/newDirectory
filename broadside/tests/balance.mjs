// Campaign balance check: plays the whole campaign with the scripted bot, sim-only, from a fresh save.
// Before each battle the fleet is whatever a greedy shipyard policy could afford with the gold from winning
// every earlier battle once. Each battle runs N times with seeded randomness, so tables are comparable
// between runs of this script.
//
//   npm run build:single && node tests/balance.mjs            # N = 16 runs per battle
//   RUNS=30 node tests/balance.mjs                            # more runs
//   ONLY=rojo,oro node tests/balance.mjs                      # measure some battles (fleet still follows the campaign)
//   WORLD=med WORKERS=2 node tests/balance.mjs                # measure one world's battles (src/config/worlds.js); the
//                                                             # fleet and gold still come through every earlier battle
//   JSON=out.json node tests/balance.mjs                      # also write the raw results
//   PAGE=/path/to/index.html node tests/balance.mjs           # measure another single-file build
//   FLEET='[{"name":"Resolute","cls":"frigate","up":{}}]' node tests/balance.mjs   # one fixed fleet for every battle
//
// Gold between battles is the first-win payout, assuming 40% of first wins are flawless (+50%); FLAWLESS=0.6 changes that.
import fs from 'fs';
import path from 'path';
import { launch, ROOT, PAGE } from './lib.mjs';
import { BATTLES } from '../src/config/battles.js';
import { TYPES } from '../src/config/ships.js';
import { save, resetSave, buyRefit, buyUpgrade, buyHire, nextHire, refitOffer, upgradeOffer, fleetStats } from '../src/save.js';

const RUNS = Math.max(6, +(process.env.RUNS || 16));
const MAX_T = +(process.env.MAX_T || 420);      // game seconds before a run counts as a stalemate (loss)
const WORKERS = Math.max(1, +(process.env.WORKERS || 4));
const FLAWLESS = +(process.env.FLAWLESS ?? 0.4);   // share of first wins assumed flawless (+50% gold)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const WORLD = process.env.WORLD || null;
const BOT_SRC = fs.readFileSync(path.join(ROOT, 'tests', 'bot.js'), 'utf8');

// ---------- Greedy shipyard policy ----------
// A strict wishlist: after each win, buy items in this order while the gold lasts, and save up for the next
// one when it can't be afforded yet (no skipping ahead to cheap trinkets). Flagship firepower and armour come
// first, then turning the sloops into brigs, marines for the escorts (so Spanish boarders can't take them as
// easily, and capture battles never run short), a fourth ship, the flagship's man-o'-war refit, then the escorts.
const WISHLIST = [
  ['Resolute', 'guns'], ['Swift', 'refit'], ['Resolute', 'hull'], ['Kestrel', 'refit'],
  ['Swift', 'marines'], ['Kestrel', 'marines'], ['hire'], ['Merlin', 'marines'], ['Resolute', 'hull'], ['Resolute', 'guns'], ['Resolute', 'refit'],
  ['Swift', 'guns'], ['Kestrel', 'guns'], ['Swift', 'hull'], ['Kestrel', 'hull'],
  ['hire'], ['Merlin', 'refit'], ['Resolute', 'hull'], ['Swift', 'refit'], ['Kestrel', 'refit'],
  ['Osprey', 'refit'], ['Merlin', 'guns'], ['Osprey', 'guns'], ['Merlin', 'hull'], ['Osprey', 'hull'],
  ['Swift', 'guns'], ['Kestrel', 'guns'], ['Swift', 'hull'], ['Kestrel', 'hull'],
  ['Resolute', 'sails'], ['Resolute', 'chasers'],
];

function wishCost([name, what]) {
  if (name === 'hire') return nextHire() ? nextHire().cost : null;
  const f = save.fleet.find((s) => s.name === name);
  if (!f) return null;
  if (what === 'refit') { const o = refitOffer(f); return o ? o.cost : null; }
  return upgradeOffer(f, what).cost;
}

// Returns the purchases made, as short labels.
function shop(state) {
  const bought = [];
  while (state.next < WISHLIST.length) {
    const w = WISHLIST[state.next];
    const cost = wishCost(w);
    if (cost == null) { state.next++; continue; }         // maxed out or ship missing: skip it
    if (save.gold < cost) break;                          // save up for it
    const [name, what] = w;
    const i = save.fleet.findIndex((s) => s.name === name);
    const ok = name === 'hire' ? buyHire() : what === 'refit' ? buyRefit(i) : buyUpgrade(i, what);
    if (!ok) throw new Error('purchase failed: ' + w.join(' '));
    bought.push(name === 'hire' ? `hire ${save.fleet[save.fleet.length - 1].name}` : `${name} ${what === 'refit' ? '→' + save.fleet[i].cls : what}`);
    state.next++;
  }
  return bought;
}

const fleetLabel = () => save.fleet.map((f) => {
  const up = Object.entries(f.up || {}).map(([k, v]) => k[0] + v).join('');
  return `${f.name[0]}:${f.cls.slice(0, 3)}${up ? '+' + up : ''}`;
}).join(' ');

// ---------- One battle, inside the page ----------
async function runBattle(page, id, fleet, seed) {
  return page.evaluate(({ id, fleet, seed, maxT, botSrc }) => {
    // Seeded Math.random (mulberry32) so every run is reproducible.
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    (0, eval)(botSrc); // a fresh bot each battle (its landing-party choice is closure state)
    const B = window.__broadside;
    B.save.fleet = JSON.parse(JSON.stringify(fleet));
    // Sound draws on Math.random too, and synthesises each sample the first time it plays, so it would make
    // a run depend on what the page played before. Keep it quiet.
    B.S.muted = true; B.S.musicMuted = true;
    B.startBattle(id);
    // Building the scene draws a varying amount of randomness (more on a page's first battle), so seed again
    // here: the same seed then plays the same battle whichever worker page runs it.
    a = seed >>> 0;
    const G = B.G;
    const ours = G.ships.filter((s) => s.team === 'player');
    while (G.endAt == null && G.t < maxT) { window.__bot.tick(); B.sim(60); }
    const result = G.endAt != null ? G.result : 'timeout';
    const t = G.t;
    // Let ships that are going down finish sinking, as the results screen counts them.
    if (G.endAt != null) B.sim(Math.ceil((G.endAt - G.t) * 60) - 2);
    const foes = G.ships.filter((s) => s.team === 'enemy');
    const boss = foes.find((s) => s.boss);
    return {
      result, t,
      // Lost = sunk or taken by Spanish boarders.
      lost: ours.filter((s) => s.state !== 'afloat' || s.team !== 'player').length,
      taken: ours.filter((s) => s.team !== 'player').length,
      prizes: G.ships.filter((s) => s.prize && s.team === 'player').length,
      fleet: ours.length,
      foesLeft: foes.filter((s) => s.state === 'afloat').length,
      fortsTaken: G.forts.filter((f) => f.team === 'player').length,
      fortsSilenced: G.forts.filter((f) => f.team === 'enemy' && f.state !== 'active').length,
      forts: G.forts.length,
      bossHp: boss ? Math.max(0, boss.hp) / boss.maxHp : null,
      hits: G.stats.hits, shots: G.stats.shots,
      // Where everyone is when a run stalls, to see why.
      stall: result === 'timeout' ? G.ships.filter((s) => s.state === 'afloat').map((s) => `${s.team}:${s.name} ${Math.round(s.x)},${Math.round(s.y)} v${Math.round(s.v)} hp${Math.round(s.hp)} m${s.marines}`).concat(G.forts.map((f) => `fort ${f.team} ${f.state} hp${Math.round(f.hp)}`)) : undefined,
    };
  }, { id, fleet, seed, maxT: MAX_T, botSrc: BOT_SRC });
}

// Like lib.mjs open(), minus the touch/screenshot extras, and it can load another build (PAGE=...).
async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror: ' + e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://cdn.jsdelivr.net/npm/three@*/build/three.module.js', (r) => r.fulfill({ path: path.join(ROOT, 'node_modules/three/build/three.module.js'), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.goto(process.env.PAGE ? 'file://' + path.resolve(process.env.PAGE) : PAGE);
  await page.waitForFunction(() => window.__broadside && window.__broadside.G, null, { timeout: 180000 });
  return page;
}

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// ---------- Campaign ----------
const browser = await launch();
const pages = [];
for (let w = 0; w < WORKERS; w++) pages.push(await openPage(browser));

resetSave();
const shopState = { next: 0 };
const rows = [];
const t0 = Date.now();
for (let bi = 0; bi < BATTLES.length; bi++) {
  const B = BATTLES[bi];
  const fleet = process.env.FLEET ? JSON.parse(process.env.FLEET) : JSON.parse(JSON.stringify(save.fleet));
  const label = B.tutorial ? 'Swift (sloop)' : fleetLabel();
  const goldBefore = save.gold;
  let runs = [];
  const measure = WORLD ? B.world === WORLD && (!ONLY || ONLY.includes(B.id)) : !ONLY || ONLY.includes(B.id) || B.tutorial;
  if (measure) {
    const jobs = Array.from({ length: RUNS }, (_, r) => hash(`${B.id}#${r}`));
    let k = 0;
    await Promise.all(pages.map(async (p) => {
      while (k < jobs.length) { const seed = jobs[k++]; runs.push({ seed, ...(await runBattle(p, B.id, fleet, seed)) }); }
    }));
  }
  const wins = runs.filter((r) => r.result === 'win');
  const n = runs.length || 1;
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
  const flawless = wins.filter((r) => r.lost === 0).length / (wins.length || 1);
  // The bot's expected first-win payout, and the shipyard budget: a fixed flawless rate (not the bot's) so the
  // fleet for later battles doesn't shift when an earlier battle is retuned. The hulk never fires back.
  const botGold = Math.round(B.reward * (1 + 0.5 * flawless));
  const gold = Math.round(B.reward * (1 + 0.5 * (B.tutorial ? 1 : FLAWLESS)));
  const row = {
    id: B.id, roman: B.roman, goal: B.goal || (B.goals ? B.goals[0].kind : 'sink'), fleet: label, fleetDef: fleet, measured: measure,
    win: wins.length / n, runs: runs.length,
    tWin: avg(wins.map((r) => r.t)), tAll: avg(runs.map((r) => r.t)),
    lost: avg(runs.map((r) => r.lost)), lostWin: avg(wins.map((r) => r.lost)), ships: runs[0] ? runs[0].fleet : fleet.length,
    timeouts: runs.filter((r) => r.result === 'timeout').length,
    taken: avg(runs.map((r) => r.taken)),
    bossHp: B.goal === 'boss' ? avg(runs.filter((r) => r.result !== 'win').map((r) => r.bossHp)) : null,
    forts: B.forts ? avg(runs.map((r) => r.fortsTaken)) : null,
    acc: avg(runs.map((r) => (r.shots ? r.hits / r.shots : 0))),
    flawless, gold, botGold, goldBefore, detail: runs,
  };
  save.gold += gold;
  save.stars[B.id] = 1;
  row.bought = shop(shopState);
  row.goldAfter = save.gold;
  rows.push(row);
  if (measure) process.stdout.write(`  ${B.roman.padStart(4)} ${B.id.padEnd(10)} win ${(row.win * 100).toFixed(0).padStart(3)}%  (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
}
await browser.close();

// ---------- Report ----------
const pct = (x) => (Number.isNaN(x) ? '  -' : (x * 100).toFixed(0).padStart(3) + '%');
const sec = (x) => (Number.isNaN(x) ? '   -' : (x.toFixed(0) + 's').padStart(4));
const f1 = (x) => (Number.isNaN(x) || x == null ? '  -' : x.toFixed(1).padStart(3));
console.log(`\nBroadside balance: ${RUNS} runs per battle, bot captain, ${MAX_T}s cap, budget assumes ${FLAWLESS * 100}% flawless\n`);
console.log('  #    battle      goal     win  t(win) t(all) lost/fleet 3*   to  extra        bot$ budget  fleet');
for (const r of rows) {
  if (WORLD && !r.measured) continue;
  let extra = r.goal === 'boss' ? `bossHp ${r.bossHp == null || Number.isNaN(r.bossHp) ? ' -' : (r.bossHp * 100).toFixed(0) + '%'}`
    : r.forts != null ? `forts ${r.forts.toFixed(1)}` : '';
  if (r.taken > 0.05) extra += ` tk${r.taken.toFixed(1)}`;
  console.log(`  ${r.roman.padStart(4)} ${r.id.padEnd(11)} ${r.goal.padEnd(7)} ${r.measured ? pct(r.win) : '   -'} ${sec(r.tWin)}  ${sec(r.tAll)}   ${f1(r.lost)}/${r.ships}    ${pct(r.flawless)} ${String(r.timeouts).padStart(2)}  ${extra.padEnd(12)} ${String(r.botGold).padStart(4)} ${String(r.gold).padStart(5)}   ${r.fleet}`);
}
console.log('\nShipyard purchases after each win (greedy wishlist):');
for (const r of rows) console.log(`  ${r.roman.padStart(4)} +${String(r.gold).padStart(3)}g → ${r.bought.length ? r.bought.join(', ') : '(saving)'}   [${r.goldAfter}g left]`);
const spent = rows.reduce((s, r) => s + r.gold, 0) - save.gold;
console.log(`\nCampaign gold earned ${rows.reduce((s, r) => s + r.gold, 0)}, spent ${spent}; wishlist ${rows.length ? shopState.next : 0}/${WISHLIST.length} items bought.`);
console.log('Final fleet: ' + save.fleet.map((f) => { const s = fleetStats(f); return `${f.name} ${TYPES[f.cls].label} hp${s.hp} g${s.guns}`; }).join(', '));
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(rows, null, 2));
