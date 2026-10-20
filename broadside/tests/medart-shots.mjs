// Screenshots of the Mediterranean's art: one battle per region (portrait at the comfort zoom and close in on
// its town, landscape mid), line-ups of the Med classes and of each faction's dress, the night battle, the gale,
// and the hats cabinet. Not part of npm test. One browser, closed at the end.
//   npm run build:single && OUT=shots/medart/after node tests/medart-shots.mjs
//   ONLY=regions,ships,night,hats node tests/medart-shots.mjs     # some of the sets
import fs from 'fs';
import path from 'path';
import { launch, open, save, ROOT, botPlay } from './lib.mjs';
import { BATTLES } from '../src/config/battles.js';

const OUT = path.resolve(ROOT, process.env.OUT || 'shots/medart/after');
fs.mkdirSync(OUT, { recursive: true });
const sets = (process.env.ONLY || 'regions,ships,night,hats').split(',');
const ids = BATTLES.map((b) => b.id);
const stars = Object.fromEntries(ids.map((id) => [id, 3]));
const veteran = save({
  gold: 2400, stars, hats: ['cabin', 'rojo', 'comodoro', 'oro', 'kate', 'morion', 'armada', 'rover', 'kalpak', 'osman', 'corno', 'kavuk'], hired: 2,
  fleet: [
    { name: 'Resolute', cls: 'manowar', up: { guns: 2, hull: 3 } }, { name: 'Swift', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } },
    { name: 'Kestrel', cls: 'frigate', up: { guns: 1, hull: 2, marines: 2 } }, { name: 'Merlin', cls: 'brig', up: {} },
  ],
});

const browser = await launch();
const snap = async (page, name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 240000 });
  console.log(name, page.errors.slice(-1).join(''));
};

// The land, as tests/land-shots.mjs frames it: the director's comfort zoom on the focal landmark, and close in.
const REGIONS = [['tangier', 'town'], ['sale', 'town'], ['bagnio', 'town'], ['knights', 'town'], ['passero', 'town'], ['zante', 'town'], ['navarino', 'castle'],
  ['candia', 'town'], ['dia', 'lighthouse'], ['narrows', 'castle'], ['kapudan', 'town']];
const frame = (page, id, zoom, focus) => page.evaluate(([id, zoom, focus]) => {
  const B = window.__broadside;
  B.S.muted = true;
  B.startBattle(id); B.step(90); B.settle();
  const G = B.G, cam = B.cam;
  cam.mode = 'manual'; cam.idle = 0;
  const L = G.landmarks || [];
  const o = L.find((q) => q.kind === focus) || L.find((q) => q.kind === 'town') || L[0] || G.islands[0];
  cam.tx = o.x; cam.ty = o.y; cam.d = zoom === 'in' ? cam.dMin * 0.85 : cam.dComfort;
  B.step(40);
  return B.drawCalls;
}, [id, zoom, focus]);

if (sets.includes('regions')) {
  for (const [label, width, height, zooms] of [['portrait', 390, 844, ['mid', 'in']], ['landscape', 844, 390, ['mid']]]) {
    const page = await open(browser, { width, height, save: veteran });
    for (const [id, focus] of REGIONS) {
      for (const zoom of zooms) {
        const calls = await frame(page, id, zoom, focus);
        await snap(page, `${id}-${label}-${zoom}`);
        console.log('   calls', calls);
      }
    }
    // A battle in play, the director's own framing.
    if (label === 'portrait') {
      for (const [id, secs] of [['tangier', 14], ['bagnio', 20], ['knights', 10], ['navarino', 16], ['candia', 18], ['kapudan', 24]]) {
        await page.evaluate((i) => { const b = window.__broadside; b.S.muted = true; b.startBattle(i); }, id);
        await botPlay(page, secs);
        await page.evaluate(() => window.__broadside.step(30));
        await snap(page, `play-${id}`);
      }
    }
    await page.context().close();
  }
}

// Line-ups: each class broadside on, packed in a column (or two) at the map's centre, the HUD hidden. zoom: the
// director's comfort zoom, 'close' (as close as the game goes) or 'detail' (closer than that, for the carving).
const lineup = (page, ships, opts = {}) => page.evaluate(([ships, opts]) => {
  const b = window.__broadside;
  b.S.muted = true;
  const enemy = [], player = [];
  ships.forEach((s, i) => (s.team === 'player' ? player : enemy).push({ name: s.name || s.type + i, x: 0.5, y: 0.3 + i * 0.02, h: 0, passive: true, ...s }));
  if (!player.length) player.push({ type: 'sloop', name: 'Me', x: 0.5, y: 0.97, h: -90 });
  b.playDef({ name: 'Line-up', wind: opts.wind == null ? -90 : opts.wind, islands: [], weather: opts.weather || 'med', faction: opts.faction, player, enemy, ai: { dmgMul: 0 } });
  const G = b.G, cols = opts.cols || 1;
  const xs = G.ships.filter((s) => s.name !== 'Me'), rows = Math.ceil(xs.length / cols);
  const gapY = opts.gap || 46, gapX = 120;
  xs.forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    s.x = G.W / 2 + (c - (cols - 1) / 2) * gapX; s.y = G.H / 2 + (r - (rows - 1) / 2) * gapY; s.h = 0; s.v = 0;
  });
  document.getElementById('hud').style.visibility = 'hidden';
  b.step(60); b.settle();
  const cam = b.cam;
  cam.mode = 'manual'; cam.idle = 0;
  cam.tx = G.W / 2; cam.ty = G.H / 2;
  if (opts.focus != null) { cam.tx = xs[opts.focus].x; cam.ty = xs[opts.focus].y; }
  cam.d = opts.zoom === 'detail' ? cam.dMin * 0.6 : opts.zoom === 'close' ? cam.dMin * 0.85 : cam.dComfort * (opts.far || 1);
  if (opts.zoom === 'detail') cam.dMin *= 0.6;
  b.step(30);
  return { calls: b.drawCalls, keys: [...window.__broadsideR.debug.shipMeshes.values()].map((m) => m.tpl.info.key.split('|')[0]) };
}, [ships, opts]);

if (sets.includes('ships')) {
  const page = await open(browser, { width: 390, height: 844, save: veteran });
  const oared = ['galley', 'galleass', 'firegalley', 'felucca', 'tartane', 'polacre'].map((type) => ({ type, faction: 'barbary' }));
  const tall = [{ type: 'kalyon', faction: 'ottoman' }, { type: 'sultana', faction: 'ottoman' }, { type: 'frigate', team: 'player', name: 'Resolute' }];
  const barbary = ['polacre', 'galley', 'tartane', 'polacre', 'galley', 'tartane'].map((type, i) => ({ type, name: ['Sa’ada', 'Saqr', 'Rih', 'Qamar', 'Asad', 'Zahra'][i] }));
  const ottoman = ['kalyon', 'galley', 'galleass', 'kalyon', 'galley', 'sultana'].map((type, i) => ({ type, name: ['Yıldız', 'Doğan', 'Ejder', 'Arslan', 'Şahin', 'Fatih'][i] }));
  const allies = [{ type: 'galley', team: 'player', ally: true, faction: 'knights', name: 'San Giovanni' }, { type: 'galleass', team: 'player', ally: true, faction: 'venice', name: 'San Marco' }, { type: 'frigate', team: 'player', name: 'Resolute' }];
  const bosses = [
    { type: 'polacre', name: 'Burak', boss: { captain: 'Reis Ibrahim', title: 'Burak', hat: 'rover' } },
    { type: 'kalyon', name: 'Mubarak', boss: { captain: 'Kara Hasan Reis', title: 'Mubarak', hat: 'kalpak' } },
    { type: 'galleass', name: 'Hilal', boss: { captain: 'Osman Reis', title: 'Hilal', hat: 'osman' } },
    { type: 'sultana', name: 'Kara Ejder', boss: { captain: 'Bahri Ömer Pasha', title: 'Kara Ejder', hat: 'kavuk' } }];
  for (const [name, ships, opts] of [
    ['classes-oared', oared, { faction: 'barbary', gap: 52 }],
    ['classes-oared-close', oared.slice(0, 3), { faction: 'barbary', zoom: 'close', gap: 56 }],
    ['classes-galley-detail', oared.slice(0, 1), { faction: 'barbary', zoom: 'detail' }],
    ['classes-galleass-detail', oared.slice(1, 2), { faction: 'barbary', zoom: 'detail' }],
    ['classes-small-close', oared.slice(3), { faction: 'barbary', zoom: 'close', gap: 44 }],
    ['classes-tall', tall, { faction: 'ottoman', gap: 70 }],
    ['classes-tall-close', tall.slice(0, 2), { faction: 'ottoman', zoom: 'close', gap: 64 }],
    ['faction-barbary', barbary, { faction: 'barbary', cols: 2, gap: 50 }],
    ['faction-barbary-close', barbary.slice(0, 3), { faction: 'barbary', zoom: 'close', gap: 46 }],
    ['faction-ottoman', ottoman, { faction: 'ottoman', cols: 2, gap: 60 }],
    ['faction-ottoman-close', ottoman.slice(0, 3), { faction: 'ottoman', zoom: 'close', gap: 56 }],
    ['allies', allies, { faction: 'barbary', gap: 62 }],
    ['allies-close', allies.slice(0, 2), { faction: 'barbary', zoom: 'close', gap: 60 }],
    ['bosses', bosses, { faction: 'ottoman', gap: 70 }],
    ['boss-kapudan-detail', bosses.slice(3), { faction: 'ottoman', zoom: 'detail' }],
    ['bosses-close', bosses.slice(0, 2), { faction: 'barbary', zoom: 'close', gap: 64 }],
    ['boss-osman-close', bosses.slice(2, 3), { faction: 'barbary', zoom: 'close' }],
    ['player-med-looks-close', [
      { type: 'frigate', team: 'player', name: 'Resolute', look: { paint: 'serenissima', emblem: 'markLion', figurehead: 'markLion', gilding: 'kapudan', lanterns: 3, flag: 'pennant', cloth: 'algerine' } },
      { type: 'frigate', team: 'player', name: 'Swift', look: { paint: 'sale', cloth: 'tripoli', figurehead: 'markLion', gilding: 'gilt', flag: 'ensign' } }], { faction: 'barbary', zoom: 'close', gap: 64 }],
  ]) {
    const info = await lineup(page, ships, opts);
    await snap(page, name);
    console.log('   ', JSON.stringify(info));
  }
  await page.context().close();
}

if (sets.includes('night')) {
  const page = await open(browser, { width: 390, height: 844, save: veteran });
  await page.evaluate(() => { const b = window.__broadside; b.S.muted = true; b.startBattle('dia'); });
  await botPlay(page, 26);
  await page.evaluate(() => window.__broadside.step(20));
  await snap(page, 'night-dia-play');
  // A ship on fire across the water, and a broadside at close quarters.
  await page.evaluate(() => {
    const b = window.__broadside, G = b.G, me = G.ships.find((s) => s.team === 'player' && s.state === 'afloat');
    const foe = G.ships.filter((s) => s.team === 'enemy' && s.state === 'afloat').sort((a, c) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(c.x - me.x, c.y - me.y))[0];
    if (foe) { foe.burning = true; foe.fireT = 30; }
    b.step(30);
    const cam = b.cam; cam.mode = 'manual'; cam.idle = 0; cam.tx = (me.x + foe.x) / 2; cam.ty = (me.y + foe.y) / 2; cam.d = cam.dComfort;
    b.step(20);
  });
  await snap(page, 'night-dia-fire');
  await page.evaluate(() => {
    const b = window.__broadside, G = b.G, me = G.ships.find((s) => s.team === 'player' && s.state === 'afloat');
    me.reload = [0, 0]; b.guns.fireBroadside(me, 0); b.guns.fireBroadside(me, 1);
    const cam = b.cam; cam.tx = me.x; cam.ty = me.y; cam.d = cam.dMin * 0.9;
    b.step(4);
  });
  await snap(page, 'night-dia-broadside');
  // The town at night.
  await frame(page, 'dia', 'mid', 'town');
  await snap(page, 'night-dia-town');
  await page.context().close();
}

if (sets.includes('hats')) {
  const page = await open(browser, { width: 390, height: 844, save: veteran, fonts: !!process.env.FONTS });
  await page.evaluate(() => { window.__broadside.save.world = 'med'; });
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  await page.click('#hatsBtn');
  await page.waitForTimeout(500);
  await snap(page, 'hats');
  await page.evaluate(() => { const g = document.querySelector('#hatGrid'); const shelf = [...g.querySelectorAll('.hat-shelf')].pop(); if (shelf) shelf.scrollIntoView(); });
  await snap(page, 'hats-med');
  await page.context().close();
}
await browser.close();
