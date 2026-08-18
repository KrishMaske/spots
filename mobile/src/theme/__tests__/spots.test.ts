// Pure geometry test for the backdrop scatter — no renderer, the same shape as
// `onboarding.test.ts`.
//
// Double-entry rule: bounds and counts are hardcoded literals, never imported
// from the module under test. Asserting `opacity <= maxOpacity` would prove
// nothing; asserting `opacity <= 0.08` proves the contrast budget in
// docs/plans/spots-background-and-dark-mode.md §5.6.

import { generateSpots, SPOT_SEED } from '../spots';

const REFERENCE = { width: 390, height: 848, maxOpacity: 0.08 };

describe('generateSpots is deterministic', () => {
  it('returns byte-identical output for the same seed and size', () => {
    // The whole reason this module exists. These are form screens: every
    // keystroke re-renders, and `Math.random()` in render would reshuffle the
    // entire backdrop on every character typed.
    expect(generateSpots(REFERENCE)).toEqual(generateSpots(REFERENCE));
  });

  it('returns a different scatter for a different seed', () => {
    const a = generateSpots(REFERENCE);
    const b = generateSpots({ ...REFERENCE, seed: 12345 });

    expect(b).not.toEqual(a);
    expect(b).toHaveLength(a.length);
  });

  it('uses one app-wide default seed, so all five auth screens share a scatter', () => {
    // Navigating Login → Register must not reshuffle the background.
    expect(generateSpots(REFERENCE)).toEqual(generateSpots({ ...REFERENCE, seed: SPOT_SEED }));
  });
});

describe('generateSpots count is density-based', () => {
  it.each([
    [390, 848, 14],
    [375, 667, 10],
    [428, 926, 17],
  ])('places the right number of spots at %ix%i', (width, height, expected) => {
    expect(generateSpots({ ...REFERENCE, width, height })).toHaveLength(expected);
  });

  it('clamps at both ends so a watch face is not empty and a tablet is not a swarm', () => {
    expect(generateSpots({ ...REFERENCE, width: 100, height: 100 })).toHaveLength(10);
    expect(generateSpots({ ...REFERENCE, width: 2000, height: 2000 })).toHaveLength(20);
  });
});

describe('generateSpots stays inside the canvas', () => {
  it('keeps every spot on-canvas even at the extreme of its drift', () => {
    // The container clips. A spot that drifts past an edge would render as a
    // chord-shaped sliver instead of a circle, which is the one way this
    // backdrop could look broken rather than subtle.
    for (const spot of generateSpots(REFERENCE)) {
      expect(spot.x - spot.driftX).toBeGreaterThanOrEqual(0);
      expect(spot.x + spot.size + spot.driftX).toBeLessThanOrEqual(390);
      expect(spot.y - spot.driftY).toBeGreaterThanOrEqual(0);
      expect(spot.y + spot.size + spot.driftY).toBeLessThanOrEqual(848);
    }
  });

  it('holds the same guarantee on a small screen', () => {
    for (const spot of generateSpots({ ...REFERENCE, width: 375, height: 667 })) {
      expect(spot.x - spot.driftX).toBeGreaterThanOrEqual(0);
      expect(spot.x + spot.size + spot.driftX).toBeLessThanOrEqual(375);
      expect(spot.y - spot.driftY).toBeGreaterThanOrEqual(0);
      expect(spot.y + spot.size + spot.driftY).toBeLessThanOrEqual(667);
    }
  });
});

describe('generateSpots respects its bounds', () => {
  it('never exceeds the opacity ceiling, in either mode', () => {
    for (const spot of generateSpots(REFERENCE)) {
      expect(spot.opacity).toBeGreaterThan(0);
      expect(spot.opacity).toBeLessThanOrEqual(0.08);
    }

    for (const spot of generateSpots({ ...REFERENCE, maxOpacity: 0.1 })) {
      expect(spot.opacity).toBeGreaterThan(0);
      expect(spot.opacity).toBeLessThanOrEqual(0.1);
    }
  });

  it('keeps diameters between 8 and 56, biased small', () => {
    const sizes = generateSpots(REFERENCE).map((spot) => spot.size);

    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(8);
      expect(size).toBeLessThanOrEqual(56);
    }

    // The bias is the point: a scatter of uniformly-large dots is a pattern,
    // not texture. The median must sit below the midpoint of the range (32).
    const median = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)];
    expect(median).toBeLessThan(32);
  });

  it('keeps drift amplitudes between 4 and 14pt', () => {
    for (const spot of generateSpots(REFERENCE)) {
      expect(spot.driftX).toBeGreaterThanOrEqual(4);
      expect(spot.driftX).toBeLessThanOrEqual(14);
      expect(spot.driftY).toBeGreaterThanOrEqual(4);
      expect(spot.driftY).toBeLessThanOrEqual(14);
    }
  });

  it('spreads the field across both shared clocks', () => {
    const clocks = new Set(generateSpots(REFERENCE).map((spot) => spot.clock));
    expect(clocks).toEqual(new Set([0, 1]));
  });

  it('gives every spot a unique key', () => {
    const spots = generateSpots(REFERENCE);
    expect(new Set(spots.map((spot) => spot.key)).size).toBe(spots.length);
  });
});

describe('the scatter itself is pinned', () => {
  // EXACT-LITERAL TRIPWIRE, brittle BY DESIGN (R8). Obtained by running the
  // generator once at seed SPOT_SEED / 390×848 / ceiling 0.08 and pasting the
  // result. Any change to the PRNG, the draw order inside the loop, or the size
  // curve moves these numbers — which is exactly what should happen loudly,
  // with a readable diff, rather than silently.
  //
  // If this goes red: do not re-paste the new values reflexively. Decide whether
  // the scatter was MEANT to change and say so in the commit.
  it('pins the first spot at the reference size', () => {
    const [first] = generateSpots(REFERENCE);

    expect(first.key).toBe('spot-0');
    expect(first.x).toBeCloseTo(117.69216265501439, 10);
    expect(first.y).toBeCloseTo(118.32065730911502, 10);
    expect(first.size).toBeCloseTo(35.50538923350322, 10);
    expect(first.opacity).toBeCloseTo(0.054457851694896815, 10);
    expect(first.driftX).toBeCloseTo(8.965072008781135, 10);
    expect(first.driftY).toBeCloseTo(5.96317917201668, 10);
    expect(first.clock).toBe(0);
  });

  it('pins the whole field by shape', () => {
    const spots = generateSpots(REFERENCE);

    expect(spots.map((spot) => Math.round(spot.size))).toEqual([
      36, 39, 16, 8, 8, 21, 10, 20, 8, 8, 43, 35, 13, 53,
    ]);
  });
});
