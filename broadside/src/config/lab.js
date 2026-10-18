// The battle lab: one ad-hoc battle definition, not in the campaign, that tests (and one day a battle editor)
// can build and play through window.__broadside.playDef(def). It is played like any battle, briefing and results
// screens included, but it is never recorded: no stars, gold, hats or skirmish records go to the save.
export const LAB_ID = 'lab';

// What a definition may leave out. Positions are portrait fractions, as in src/config/battles.js.
const BASE = {
  region: 'lab', roman: '', year: 1660, name: 'Battle lab', foe: 'enemy', reward: 0, wind: 0,
  brief: 'An ad-hoc battle from the lab.', enemy: [], islands: [],
  ai: { spread: 0.12, reloadMul: 1, dmgMul: 0.6, hpMul: 1 },
};

let lab = null;
export function setLab(def) {
  lab = { ...BASE, ...def, id: LAB_ID, ai: { ...BASE.ai, ...(def.ai || {}) } };
  return lab;
}
export const labDef = () => lab;
