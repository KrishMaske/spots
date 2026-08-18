// Geometry for the floating spotty backdrop (`components/SpottyBackground`).
//
// Same shape as `theme/onboarding.ts`: a pure function of a size, no React and
// no `Dimensions`, so the whole scatter is assertable in a plain unit test with
// no renderer. Numbers only — the fill color and the opacity ceiling are theme
// tokens (`theme.backdrop.*`) and arrive as arguments.
//
// Design intent: the wordmark's dot cluster (`assets/images/spots-logo.png`,
// 24 yellow circles of mixed size on transparent alpha) DISPERSED — same
// yellow, same mixed-size circles, spread across the canvas at low opacity.
// No new visual concept is invented; the brand already contains this shape
// language.

/** One spot. `Animated.View`-ready: geometry plus its drift parameters. */
export interface SpotSpec {
  key: string;
  /** Top-left of the spot's bounding box, in pt. */
  x: number;
  y: number;
  /** Diameter; the View is `size`² with `borderRadius: size / 2`. */
  size: number;
  /** 0..1, already multiplied down from the theme's ceiling. */
  opacity: number;
  /** Drift amplitudes in pt, and which of the two shared clocks drives each axis. */
  driftX: number;
  driftY: number;
  /** Rotation applied to the interpolation output, so spots on one clock are
   *  not in lockstep. Costs nothing at runtime. */
  phase: number;
  clock: 0 | 1;
}

export interface SpotFieldInput {
  width: number;
  height: number;
  /** Opacity CEILING, from `theme.backdrop.spotOpacity`. */
  maxOpacity: number;
  /** Defaults to `SPOT_SEED`. Same seed + same size ⇒ byte-identical output. */
  seed?: number;
}

/**
 * One app-wide default seed, so all five auth screens get the SAME scatter.
 * Navigating Login → Register does not reshuffle the background; it reads as one
 * continuous backdrop behind the whole flow. `seed` stays a parameter for tests
 * and for a future per-screen variation.
 *
 * The value is arbitrary — it is a seed, not a measurement.
 */
export const SPOT_SEED = 0x5907;

/** Density: one spot per this many pt². 14 spots at 390×848 — the sparse end of
 *  what still reads as a scatter rather than a pattern. */
const AREA_PER_SPOT = 24000;
const MIN_COUNT = 10;
const MAX_COUNT = 20;

/** Diameter bounds. 56 is one 8pt-grid step below the 64 at which a spot starts
 *  reading as a shape rather than as texture. */
const MIN_SIZE = 8;
const MAX_SIZE = 56;
/** Biases the size distribution small, mirroring the logo cluster's mix of a
 *  few large dots among many small ones. */
const SIZE_BIAS = 2.2;

/** Drift bounds in pt: ≤ ¼ of the largest spot, so the motion is noticeable at
 *  rest and invisible while reading. */
const MIN_DRIFT = 4;
const MAX_DRIFT = 14;

/**
 * `mulberry32` — a 32-bit PRNG in six lines, no dependency.
 *
 * Deterministic across platforms and Node versions: it is pure `Math.imul` and
 * uint32 arithmetic, so there is no float-precision drift between a device and
 * a jest run. `Math.random()` is BANNED in this module — these are form screens,
 * every keystroke re-renders, and an unseeded scatter would visibly reshuffle
 * the entire backdrop on every character typed.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Spot count for a canvas. Density-based, so a tablet is not sparse and a small
 *  phone is not crowded. Exported for the component's `useMemo` and for tests. */
export function spotCount(width: number, height: number): number {
  return clamp(Math.round((width * height) / AREA_PER_SPOT), MIN_COUNT, MAX_COUNT);
}

/**
 * Generates the scatter for a canvas of `width`×`height`.
 *
 * Every spot is placed so that its bounding box INFLATED BY ITS DRIFT stays
 * inside the canvas. Without that inflation a spot near an edge would drift
 * partly off-canvas and, because the container clips, render as a chord-shaped
 * sliver rather than a circle.
 *
 * Opacity is `ceiling × (0.55 + 0.45·r)`, which gives depth without ever
 * exceeding the ceiling — so the ceiling stays a true worst case and the
 * contrast budget in docs/plans/spots-background-and-dark-mode.md §5.6 is the
 * real bound, not an average.
 */
export function generateSpots({
  width,
  height,
  maxOpacity,
  seed = SPOT_SEED,
}: SpotFieldInput): SpotSpec[] {
  const random = mulberry32(seed);
  const count = spotCount(width, height);
  const spots: SpotSpec[] = [];

  for (let i = 0; i < count; i += 1) {
    // Draw order is part of the contract: changing it changes every spot.
    // See R8 — the exact-literal tripwire in the test suite exists to make that
    // loud rather than silent.
    const size = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.pow(random(), SIZE_BIAS);
    const driftX = MIN_DRIFT + (MAX_DRIFT - MIN_DRIFT) * random();
    const driftY = MIN_DRIFT + (MAX_DRIFT - MIN_DRIFT) * random();

    // The travel available once the spot's own box and its drift are reserved.
    // `Math.max(0, …)` guards a canvas narrower than one spot plus its drift,
    // which is not a real device but is a real unit test.
    const spanX = Math.max(0, width - size - driftX * 2);
    const spanY = Math.max(0, height - size - driftY * 2);

    spots.push({
      key: `spot-${i}`,
      x: driftX + spanX * random(),
      y: driftY + spanY * random(),
      size,
      opacity: maxOpacity * (0.55 + 0.45 * random()),
      driftX,
      driftY,
      phase: random(),
      // Alternating rather than random: it guarantees both clocks are used even
      // at the minimum count, so the field's long repeat period always holds.
      clock: (i % 2) as 0 | 1,
    });
  }

  return spots;
}
