// The 3D shipyard and ship looks: the yard opens and closes without page errors and leaves nothing behind (the
// battle's draw calls and geometry are as they were), the fleet tabs swap the model, a part's key or the part
// itself opens its ledger section, trying on and fitting a gun or a look changes the model (window.__broadside.yard),
// looks are bought once for the squadron, hats unlock theirs, they persist in the save and render in battle at no
// extra draw calls, and enemies dress from their faction's palette so two of a class differ.
import { launch, open, check, save as mkSave } from './lib.mjs';

const failures = [];
const browser = await launch();
const ids = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro',
  'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];
// Every hat but Calico Kate's, a great ship with the default loadout, gold to spend.
const SAVE = mkSave({
  gold: 3000, stars: Object.fromEntries(ids.map((id) => [id, 3])), hats: ['cabin', 'rojo', 'comodoro', 'oro', 'morion', 'armada'], hired: 2,
  fleet: [{ name: 'Resolute', cls: 'greatship', up: {} }, { name: 'Swift', cls: 'frigate', up: {} }, { name: 'Kestrel', cls: 'sloop', up: {} }],
});
let page = await open(browser, { save: SAVE });
const B = (fn, arg) => page.evaluate(fn, arg);
const Y = () => B(() => { const y = window.__broadside.yard; return { active: y.active, key: y.key, info: y.info, part: y.part, objects: y.objects, templates: y.templates }; });
const frames = (n = 4) => B((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// The battle's clock is held still across the visit, so its living details (smoke, gulls) are the same.
const mem = () => B(() => { const R = window.__broadsideR, b = window.__broadside; b.G.phase = 'play'; if (window.__clock == null) window.__clock = b.S.clock; b.S.clock = window.__clock; b.settle(); return { calls: b.drawCalls, geo: R.renderer.info.memory.geometries, tex: R.renderer.info.memory.textures, kids: R.scene.children.length }; });

// ---------- Opening and closing ----------
console.log('Opening and closing the yard');
await B(() => { window.__broadside.startBattle('tortuga'); window.__broadside.step(30); });
// The control: the same battle after a visit to another menu (the hats), so only the yard differs.
await B(() => document.getElementById('hatsBtn').click());
await frames();
await B(() => document.getElementById('hatsBack').click());
const before = await mem();
await B(() => document.getElementById('yardBtn').click());
await page.waitForSelector('#yardScreen:not([hidden])');
await frames();
let y = await Y();
check(y.active && y.objects > 10 && /^greatship:player/.test(y.key), `the yard opens on Resolute, a great ship, in her berth (${y.objects} objects)`, failures);
const yardCalls = await B(() => window.__broadside.yard.calls);
check(yardCalls > 0 && yardCalls < 30, `the berth draws in ${yardCalls} calls`, failures);
await B(() => document.getElementById('yardBack').click());
await frames();
y = await Y();
check(!y.active && y.objects === 0 && y.templates === 0, `closing it disposes its scene and its models (${y.objects} objects, ${y.templates} templates left)`, failures);
const after = await mem();
check(after.calls === before.calls && after.kids === before.kids, `the battle draws as before (${before.calls} calls, then ${after.calls})`, failures);
check(after.geo === before.geo && after.tex <= before.tex + 3, `and holds the same geometry (${before.geo} then ${after.geo}; textures ${before.tex} then ${after.tex})`, failures);

// Looks cost no draw calls: the same battle with a plain and a fully dressed squadron.
const dressedCalls = await B(() => {
  const b = window.__broadside;
  const run = (look) => {
    b.playDef({
      name: 'Look test', wind: 0, islands: [],
      player: ['greatship', 'frigate', 'sloop'].map((type, i) => ({ type, name: 'S' + i, x: 0.3 + i * 0.2, y: 0.7, h: -90, look })),
      enemy: [{ type: 'brig', name: 'Target', x: 0.5, y: 0.2, h: 90, passive: true }], ai: { dmgMul: 0 },
    });
    b.settle();
    return b.drawCalls;
  };
  return [run(undefined), run({ paint: 'royal', cloth: 'white', emblem: 'crown', figurehead: 'lion', flag: 'admiral', lanterns: 3, gilding: 'almirante' })];
});
check(dressedCalls[0] === dressedCalls[1], `a fully dressed squadron draws in the same calls as a plain one (${dressedCalls.join(' and ')})`, failures);

// ---------- The model and the ledger ----------
console.log('The model and the ledger');
await B(() => document.getElementById('yardBtn').click());
await page.waitForSelector('#yardScreen:not([hidden])');
await frames();
await B(() => document.querySelector('[data-ship="1"]').click());
await frames();
y = await Y();
check(/^frigate:player/.test(y.key), `the Swift tab puts the frigate in the berth (${y.key.split(':')[0]})`, failures);
await B(() => document.querySelector('[data-ship="0"]').click());
await frames();
check(/^greatship:/.test((await Y()).key), 'and Resolute\'s tab brings the great ship back', failures);

// A part's key opens its section and lights the part.
await page.click('.yard-key[data-part="figurehead"]');
await frames(); await page.waitForTimeout(700);
let ui = await B(() => {
  const row = document.querySelector('[data-look-row="figurehead"]'), sc = document.getElementById('yardLedger');
  const r = row && row.getBoundingClientRect(), s = sc.getBoundingClientRect();
  return { open: !!(row && row.classList.contains('open')), opts: document.querySelectorAll('[data-try^="look:figurehead:"]').length, inView: !!r && r.top >= s.top - 2 && r.top < s.bottom, part: window.__broadside.yard.part, u: window.__broadside.yard.uPart };
});
check(ui.part === 'figurehead' && ui.open && ui.opts >= 6 && ui.inView, `the figurehead's key opens the carving section, scrolled into view (${ui.opts} carvings)`, failures);
check(ui.u[0] > 0 && ui.u[0] === ui.u[1], `and lights the figurehead on the model (part code ${ui.u[0]})`, failures);
// Tapping the model itself: a gun slot, then the hull.
const tapPart = async (part) => {
  await B((p) => { window.__broadside.yard.aim(p); window.__broadside.yard.settle(); }, part);
  await frames();
  const at = await B((p) => window.__broadside.yard.partAt(p), part);
  if (at) await page.mouse.click(at[0], at[1]);
  await frames();
  return B(() => window.__broadside.yard.part);
};
let hit = await tapPart('slot:portUpper');
ui = await B(() => !!document.querySelector('[data-slot-row="portUpper"].open'));
check(hit === 'slot:portUpper' && ui, `tapping her larboard upper tier on the model opens that slot in the gun decks (${hit})`, failures);
hit = await tapPart('hull');
ui = await B(() => !!document.querySelector('[data-look-row="paint"].open'));
check(hit === 'hull' && ui, `tapping her side opens her paint (${hit})`, failures);

// Trying on and fitting a gun.
await B(() => document.querySelector('[data-slot="portUpper"]').click());
const tons0 = await B(() => document.querySelector('.lo-tons').textContent);
await B(() => document.querySelector('[data-try="gun:portUpper:carronade"] .up-name').click());
await frames();
let g = await B(() => ({ info: window.__broadside.yard.info.guns.find((x) => x.slot === 'portUpper'), saved: window.__broadside.save.fleet[0].loadout.portUpper }));
check(g.info.gun === 'carronade' && g.info.barrel === 0.55 && g.info.bore === 1.4 && g.saved === 'long', `tapping carronades tries them on the model, short and fat (barrel ${g.info.barrel}, bore ${g.info.bore}), the save untouched`, failures);
await B(() => document.querySelector('[data-buy="fit:portUpper:carronade"]').click());
await frames();
g = await B(() => ({ info: window.__broadside.yard.info.guns.find((x) => x.slot === 'portUpper'), saved: window.__broadside.save.fleet[0].loadout.portUpper, tons: document.querySelector('.lo-tons').textContent, gold: window.__broadside.save.gold }));
check(g.info.gun === 'carronade' && g.saved === 'carronade' && g.gold === 3000 - 180, `fitting them keeps them on the model and in the save (gold ${g.gold})`, failures);
check(g.tons !== tons0, `and the weight of her guns follows (${tons0} then ${g.tons})`, failures);
await B(() => { document.querySelector('[data-slot="forecastle"]').click(); });
await B(() => document.querySelector('[data-buy="fit:forecastle:mortar"]').click());
await frames();
g = await B(() => window.__broadside.yard.info.guns.find((x) => x.slot === 'forecastle'));
check(g.gun === 'mortar' && g.count === 1, 'a mortar on the forecastle replaces the swivels there', failures);

// Looks: try on, buy once for the squadron, wear free on another ship, a hat's look locked until it's won.
await B(() => document.querySelector('[data-look="emblem"]').click());
await B(() => document.querySelector('[data-try="look:emblem:rose"] .up-name').click());
await frames();
let L = await B(() => ({ info: window.__broadside.yard.info.look, saved: window.__broadside.save.fleet[0].look }));
check(L.info.emblem === 'rose' && !L.saved.emblem, 'tapping the Tudor rose tries it on her canvas, the save untouched', failures);
await B(() => document.querySelector('[data-buy="look:emblem:rose"]').click());
await frames();
L = await B(() => { const b = window.__broadside; return { info: b.yard.info.look, saved: b.save.fleet[0].look, gold: b.save.gold, ward: b.save.wardrobe }; });
check(L.saved.emblem === 'rose' && L.info.emblem === 'rose' && L.gold === 2820 - 340 - 140 && L.ward.includes('emblem:rose'), `buying it dresses her and keeps it in the wardrobe (gold ${L.gold})`, failures);
const locked = await B(() => {
  const row = document.querySelector('[data-try="look:emblem:skull"]');
  return { locked: row.classList.contains('locked'), buy: !!row.querySelector('[data-buy]'), note: row.textContent, api: window.__broadside.looks.wearLook(0, 'emblem', 'skull') };
});
check(locked.locked && !locked.buy && !locked.api && /Calico Kate/.test(locked.note), `Kate's skull is locked until her hat is won ("${locked.note.replace(/\s+/g, ' ').trim()}")`, failures);
const free = await B(() => { const b = window.__broadside; return { o: b.looks.lookOffer(b.save.fleet[0], 'gilding', 'almirante'), ok: b.looks.wearLook(0, 'gilding', 'almirante'), gold: b.save.gold }; });
check(free.o.owned && !free.o.cost && free.ok && free.gold === 2340, 'the Almirante\'s gilding comes free with his hat', failures);
await B(() => document.querySelector('[data-ship="1"]').click());
await B(() => document.querySelector('[data-look="emblem"]').click());
const wear = await B(() => { const b = document.querySelector('[data-buy="look:emblem:rose"]'); const t = b.textContent; b.click(); return { t, gold: window.__broadside.save.gold, look: window.__broadside.save.fleet[1].look }; });
await frames();
check(wear.t === 'wear' && wear.gold === 2340 && wear.look.emblem === 'rose' && (await Y()).info.look.emblem === 'rose', 'Swift may wear the rose too, for nothing', failures);
check(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`, failures);
const stored = await B(() => JSON.parse(localStorage.getItem('broadside.save.v2')));
await page.context().close();

// ---------- In the save and in battle ----------
console.log('In the save and in battle');
page = await open(browser, { save: stored });
const B2 = (fn, arg) => page.evaluate(fn, arg);
const kept = await B2(() => window.__broadside.save.fleet.map((f) => f.look));
check(kept[0].emblem === 'rose' && kept[0].gilding === 'almirante' && kept[1].emblem === 'rose', 'her looks are still hers after a reload', failures);
const junk = await B2(() => window.__broadside.guns.migrate({ v: 2, gold: 0, stars: {}, hats: [], hired: 0, wardrobe: ['emblem:rose', 'paint:tartan', 7], fleet: [{ name: 'X', cls: 'sloop', up: {}, look: { paint: 'tartan', emblem: 'rose', cape: 'velvet', lanterns: 9, figurehead: 'saint' } }] }));
check(JSON.stringify(junk.fleet[0].look) === '{"emblem":"rose"}' && junk.wardrobe.join() === 'emblem:rose', `the save keeps only looks it can draw (${JSON.stringify(junk.fleet[0].look)})`, failures);
const battle = await B2(() => {
  const b = window.__broadside;
  b.startBattle('tortuga'); b.step(2);
  const meshes = [...window.__broadsideR.debug.shipMeshes.entries()].map(([id, m]) => ({ s: b.G.ships.find((x) => x.id === id), info: m.tpl.info }));
  const res = meshes.find((m) => m.s.name === 'Resolute');
  return { look: res.info.look, base: res.info.base, guns: res.info.guns.find((x) => x.slot === 'portUpper').gun, mine: meshes.filter((m) => m.s.team === 'player').map((m) => m.info.base), foes: meshes.filter((m) => m.s.team === 'enemy').map((m) => m.info.base) };
});
check(battle.look.emblem === 'rose' && battle.look.gilding === 'almirante' && battle.guns === 'carronade', 'in battle Resolute wears her rose and gilding and mounts her carronades', failures);
check(battle.mine.every((x) => x === 'player') && battle.foes.every((x) => x === 'enemy' || x === 'boss'), 'every English ship still dresses as English (blue rail, colours and canvas edge), every enemy as the enemy', failures);

// ---------- The enemy ----------
console.log('The enemy');
const foes = await B2(() => {
  const b = window.__broadside, info = () => [...window.__broadsideR.debug.shipMeshes.entries()].map(([id, m]) => ({ name: b.G.ships.find((x) => x.id === id).name, ...m.tpl.info }));
  const def = (faction, enemy) => ({ name: 'Foes', wind: 0, islands: [], faction, player: [{ type: 'sloop', name: 'Me', x: 0.5, y: 0.9, h: -90 }], enemy, ai: { dmgMul: 0 } });
  const brigs = ['Santa Ana', 'San Pedro', 'Rosario'].map((name, i) => ({ type: 'brig', name, x: 0.3 + i * 0.2, y: 0.2, h: 90, passive: true }));
  b.playDef(def(undefined, [...brigs, { type: 'galleon', name: 'La Bruja', x: 0.5, y: 0.4, h: 90, passive: true, boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
    { type: 'frigate', name: 'Told', x: 0.8, y: 0.45, h: 90, passive: true, look: { paint: 'barbaryGreen', emblem: 'crescent' } }]));
  b.settle();
  const spain = info();
  b.playDef(def('pirate', brigs)); b.settle();
  const pirate = info();
  b.playDef(def('atlantis', brigs)); b.settle();
  const unknown = info();
  return { spain, pirate, unknown };
});
const brigKeys = foes.spain.filter((x) => /^brig:/.test(x.key)).map((x) => x.key);
check(brigKeys.length === 3 && new Set(brigKeys).size === 3, `three Spanish brigs in one battle wear three different looks (${foes.spain.filter((x) => /^brig:/.test(x.key)).map((x) => x.look.paint + '/' + x.look.cloth).join(', ')})`, failures);
const rojo = foes.spain.find((x) => x.name === 'La Bruja');
check(rojo.base === 'boss' && rojo.look.cloth === 'crimson' && rojo.look.gilding === 'gilt' && rojo.look.lanterns === 3, `Capitán Rojo's La Bruja wears her own crimson canvas and gilt (${JSON.stringify(rojo.look)})`, failures);
const told = foes.spain.find((x) => x.name === 'Told');
check(told.look.paint === 'barbaryGreen' && told.look.emblem === 'crescent', 'a battle can dress an enemy itself', failures);
check(foes.pirate.every((x) => x.name === 'Me' || (x.base === 'pirate' && ['pirate', 'pirateGrey', 'pirateRed'].includes(x.look.paint))), `pirates dress from the pirate palette (${foes.pirate.filter((x) => x.base === 'pirate').map((x) => x.look.paint + '/' + x.look.emblem).join(', ')})`, failures);
check(foes.unknown.filter((x) => x.base === 'enemy').every((x) => /^spain/.test(x.look.paint)), 'a faction the palettes don\'t know dresses as Spain', failures);
check(page.errors.length === 0, `no page errors (${page.errors.join('; ')})`, failures);
await page.context().close();

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
