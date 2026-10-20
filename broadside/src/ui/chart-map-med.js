// Geometry of the Mediterranean sea chart: a PLACEHOLDER plate until the chart pass draws it properly. Same shape
// as chart-map.js (1000 x 700 map units): where each battle sits (NODES, the data table the chart pass should keep
// or move), the sea names of the regions, rough coastlines and the route helpers. Coasts are written in degrees
// (longitude, latitude) and projected with lonLat(), so they can be redrawn at any finer detail.
import { routePoints as caribRoute, curveSegments, legPaths as caribLegs } from './chart-map.js';

export const W = 1000, H = 700;
// A plain equirectangular projection: 8.5°W .. 28.5°E across, 42°N .. 29.3°N down.
export const lonLat = (lon, lat) => [Math.round((lon + 8.5) * 27), Math.round((42 - lat) * 55)];

// Where each Mediterranean battle sits on the chart. Positions are in the sea near the place, nudged apart where
// the real places are closer than two roundels (Tangier and Gibraltar, Candia and Dia, the Narrows and Tenedos).
export const NODES = {
  tangier:   { x: 124, y: 352, label: 'Tangier Mole' },
  gibraltar: { x: 62, y: 334, label: 'Under the Rock', name: 'above' },
  sale:      { x: 34, y: 430, boss: true, label: 'Salé', name: 'right' },
  bougie:    { x: 344, y: 262, label: 'Bougie Calm' },
  bagnio:    { x: 278, y: 262, label: 'The Bagnio', name: 'above' },
  goletta:   { x: 470, y: 252, label: 'La Goletta', name: 'above' },
  algiers:   { x: 392, y: 205, boss: true, label: 'Admiral of Algiers', name: 'above' },
  knights:   { x: 598, y: 352, label: 'Knights’ Galleys', name: 'left' },
  passero:   { x: 660, y: 318, label: 'Cape Passero', name: 'right' },
  tripoli:   { x: 575, y: 468, boss: true, label: 'Tripoli', name: 'right' },
  zante:     { x: 762, y: 252, label: 'Currant Ships', name: 'left' },
  navarino:  { x: 792, y: 298, label: 'Navarino', name: 'left' },
  candia:    { x: 905, y: 342, label: 'Candia', name: 'above' },
  dia:       { x: 852, y: 318, label: 'Night off Dia', name: 'above' },
  narrows:   { x: 930, y: 106, label: 'The Narrows', name: 'right' },
  kapudan:   { x: 874, y: 146, boss: true, label: 'Kapudan Pasha' },
};

// Sea names for the Mediterranean regions: centre, rotation and an optional shorter text.
export const REGION_LABELS = {
  straits: { x: 120, y: 290, r: -6, t: 'The Straits' },
  barbary: { x: 300, y: 215, r: -3, t: 'Barbary Coast' },
  malta: { x: 560, y: 400, r: -4, t: 'Malta Channel' },
  morea: { x: 700, y: 330, r: -8, t: 'Ionian Sea' },
  candia: { x: 860, y: 420, r: -3, t: 'Sea of Candia' },
  dardanelles: { x: 800, y: 80, r: -4, t: 'The Dardanelles' },
};

// ---------- Land (rough) ----------
const path = (pts) => 'M' + pts.map((p) => lonLat(...p).join(' ')).join(' L') + ' Z';
const LL = {
  iberia: [[-8.5, 42], [-8.8, 41], [-9.4, 39.5], [-9, 38.7], [-8.9, 37.1], [-7.5, 37.1], [-6.4, 36.8], [-5.7, 36.05], [-5.35, 36.2],
    [-4.4, 36.7], [-2.1, 36.75], [-0.6, 37.6], [-0.4, 38.3], [0.2, 38.75], [-0.3, 39.5], [0.9, 41.0], [2.2, 41.4], [3.2, 42]],
  italy: [[11.9, 42], [12.3, 41.7], [13.6, 41.2], [14.2, 40.8], [14.9, 40.4], [15.6, 40.0], [16.1, 39.0], [15.65, 38.0], [16.1, 37.95], [16.6, 38.5],
    [17.1, 39.0], [16.6, 39.8], [17.2, 40.45], [18.4, 39.8], [18.5, 40.2], [18.0, 40.65], [16.9, 41.1], [15.9, 41.6], [16.1, 42]],
  balkans: [[19.4, 42], [19.4, 41.3], [19.4, 40.4], [20.1, 39.6], [20.7, 39.0], [21.1, 38.3], [21.3, 37.6], [21.6, 37.0], [21.9, 36.75],
    [22.45, 36.4], [22.8, 36.8], [23.2, 36.45], [22.9, 37.2], [22.8, 37.6], [23.7, 37.9], [24.0, 37.65], [24.0, 38.2], [23.0, 38.9],
    [22.9, 39.5], [22.9, 40.6], [23.8, 40.0], [24.0, 40.8], [25.5, 40.9], [26.2, 40.6], [26.15, 40.05], [26.7, 40.4], [27.2, 40.7], [27.5, 42]],
  anatolia: [[28.6, 42], [28.6, 41.0], [27.5, 40.45], [26.5, 40.05], [26.15, 39.9], [26.1, 39.5], [26.8, 39.2], [26.8, 38.7], [27.1, 38.4],
    [26.3, 38.3], [27.2, 37.9], [27.3, 37.0], [28.0, 36.6], [28.6, 36.4]],
  africa: [[-8.5, 32.2], [-6.85, 34.0], [-6.0, 35.5], [-5.9, 35.8], [-5.3, 35.85], [-4.0, 35.2], [-2.9, 35.4], [-0.6, 35.75], [1.0, 36.5],
    [3.05, 36.8], [4.0, 36.9], [5.1, 36.75], [6.5, 37.1], [7.8, 36.95], [9.8, 37.35], [10.2, 36.95], [10.25, 36.8], [11.05, 37.1],
    [10.6, 36.4], [10.65, 35.8], [10.8, 34.7], [10.1, 33.9], [11.2, 33.2], [13.2, 32.9], [15.2, 32.3], [15.6, 31.5], [16.6, 31.2],
    [18.0, 30.4], [19.8, 30.9], [20.05, 32.1], [21.5, 32.9], [22.6, 32.8], [24.0, 32.1], [25.2, 31.6], [27.0, 31.3], [28.6, 31.0],
    [28.6, 29.3], [-8.5, 29.3]],
  sicily: [[12.4, 37.8], [13.3, 38.2], [14.5, 38.05], [15.6, 38.25], [15.1, 37.5], [15.1, 36.7], [14.2, 37.05], [12.6, 37.6]],
  sardinia: [[8.4, 41.2], [9.6, 41.0], [9.7, 39.9], [9.6, 39.2], [9.0, 38.9], [8.4, 39.0], [8.4, 40.0], [8.2, 40.9]],
  corsica: [[8.6, 42], [9.5, 42], [9.4, 41.4], [9.1, 41.4], [8.6, 41.7]],
  crete: [[23.5, 35.55], [24.1, 35.6], [25.1, 35.35], [26.3, 35.25], [26.3, 35.0], [25.5, 34.95], [24.7, 34.95], [23.6, 35.25]],
};
export const LAND = Object.values(LL).map(path);
// Small islands: [x, y, rx, ry, rotation], from [lon, lat, rx, ry, rot].
export const ISLES = [
  [14.4, 35.9, 4, 2.5, -30], [14.25, 36.05, 2.5, 1.6, -30], // Malta, Gozo
  [2.9, 39.6, 9, 5, 0], [4.1, 39.95, 5, 3, 0], [1.4, 38.95, 4, 3, 0], // Majorca, Minorca, Ibiza
  [20.55, 38.2, 4, 8, 20], [20.85, 37.75, 3.5, 4.5, 0], [19.9, 39.6, 3, 6, -20], // Cephalonia, Zante, Corfu
  [23.0, 36.25, 3, 3, 0], [25.4, 37.05, 4, 4, 0], [26.0, 38.4, 4, 6, 0], [26.3, 39.2, 7, 5, 0], [25.2, 39.9, 5, 4, 0], // Cerigo, Naxos, Chios, Lesbos, Lemnos
  [26.03, 39.83, 2.5, 2, 0], [25.85, 40.18, 4, 2.5, 0], [25.22, 35.45, 3, 1.6, 0], // Tenedos, Imbros, Dia
  [28.0, 36.2, 4, 7, 30], [11.95, 36.8, 2.5, 1.6, 0], [10.9, 33.8, 4, 3, 0], // Rhodes, Pantelleria, Djerba
].map(([lon, lat, rx, ry, r]) => [...lonLat(lon, lat), rx, ry, r]);
export const HILLS = [[-4, 37.6], [-2, 37.9], [2, 35.8], [4.5, 36.2], [9, 35.6], [15, 40.6], [22, 37.4], [21.6, 39.6], [24.4, 35.2], [30, 38], [27.5, 38.6]]
  .map(([lon, lat]) => lonLat(lon, lat)).filter(([x]) => x < 990);
export const LANDNAMES = [
  ['SPAIN', ...lonLat(-4.5, 38.6), -4, 13], ['BARBARY', ...lonLat(3, 34.4), -2, 13], ['ITALY', ...lonLat(15.6, 41.2), -40, 10],
  ['SICILY', ...lonLat(14, 37.6), -6, 9], ['MOREA', ...lonLat(22.3, 37.4), -20, 9], ['ANATOLIA', ...lonLat(27.8, 38.2), -80, 10],
  ['TRIPOLI', ...lonLat(14.5, 31.0), -4, 11], ['CANDIA', ...lonLat(24.8, 35.18), -4, 8],
];
export const SEANAMES = [['Mare Mediterraneum', ...lonLat(5.2, 40.5), -4], ['Mare Aegaeum', ...lonLat(25, 37.4), -70]];

// ---------- The route ----------
export const routePoints = (ids) => caribRoute(ids, NODES);
export { curveSegments };
export const legPaths = (ids) => caribLegs(ids, NODES);
