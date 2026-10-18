// The tune: an original 6/8 jig in D dorian, AABA, 8 bars a section. Notes are [scale degree, eighths]
// with degree 0 = D4, so the boss can re-render the same tune in D minor by swapping the scale.
export const FORM = ['A', 'A', 'B', 'A'];
export const STEPS = 6; // eighths per bar

const TUNE = {
  A: [
    [[4, 2], [2, 1], [0, 2], [2, 1]],
    [[4, 2], [5, 1], [4, 2], [2, 1]],
    [[3, 2], [1, 1], [-1, 2], [1, 1]],
    [[3, 2], [4, 1], [3, 2], [1, 1]],
    [[4, 2], [2, 1], [0, 2], [2, 1]],
    [[4, 2], [5, 1], [6, 2], [7, 1]],
    [[8, 2], [7, 1], [6, 2], [4, 1]],
    [[3, 1], [2, 1], [1, 1], [0, 3]],
  ],
  B: [
    [[6, 2], [4, 1], [2, 2], [4, 1]],
    [[6, 2], [7, 1], [6, 2], [4, 1]],
    [[6, 2], [4, 1], [3, 2], [1, 1]],
    [[3, 2], [4, 1], [3, 1], [1, 1], [-1, 1]],
    [[0, 2], [2, 1], [4, 2], [7, 1]],
    [[7, 2], [5, 1], [3, 2], [5, 1]],
    [[4, 2], [6, 1], [8, 2], [6, 1]],
    [[4, 1], [2, 1], [1, 1], [0, 3]],
  ],
};
export const CHORDS = {
  A: ['Dm', 'Dm', 'C', 'C', 'Dm', 'Dm', 'Am', 'Dm'],
  B: ['F', 'F', 'C', 'C', 'Dm', 'G', 'Am', 'Dm'],
};
// Triads as scale degrees. In the minor scale 'G' comes out as G minor, and 'Am' is played as
// A major (raised seventh, C#) for a proper harmonic-minor pull home.
export const TRIADS = { Dm: [0, 2, 4], C: [-1, 1, 3], Am: [4, 6, 8], F: [2, 4, 6], G: [3, 5, 7] };

export const SCALES = { dorian: [0, 2, 3, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10] };

export function midi(deg, scale, raise7) {
  const o = Math.floor(deg / 7), i = deg - o * 7;
  return 62 + 12 * o + scale[i] + (raise7 && i === 6 ? 1 : 0);
}

// Each bar as a STEPS-long array: [degree, eighths] where a note starts, otherwise null.
export const MELODY = {};
for (const sec of Object.keys(TUNE)) {
  MELODY[sec] = TUNE[sec].map((bar) => {
    const steps = new Array(STEPS).fill(null);
    let at = 0;
    for (const n of bar) { steps[at] = n; at += n[1]; }
    if (at !== STEPS) throw new Error(`bar of ${at} eighths`);
    return steps;
  });
}
