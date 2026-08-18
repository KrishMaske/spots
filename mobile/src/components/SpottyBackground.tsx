import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { generateSpots, type SpotSpec } from '../theme/spots';
import { useReduceMotion } from '../theme/useReduceMotion';
import { useTheme } from '../theme/useTheme';

/**
 * Two shared clocks for the WHOLE layer, not one per spot: one `start()`, one
 * `stop()`, one thing to reason about. 18s and 11s are coprime-ish, so the
 * field's true repeat period is ~198s — the motion never visibly loops even
 * though every spot is on a fixed cycle.
 */
const CLOCK_DURATIONS = [18000, 11000] as const;

/** Interpolation resolution for one drift cycle. 8 segments + the wrap-around
 *  point; enough for a smooth ease with a trivially small node. */
const CYCLE_STEPS = 8;

const INPUT_RANGE = Array.from({ length: CYCLE_STEPS + 1 }, (_, i) => i / CYCLE_STEPS);

/**
 * A closed loop of offsets in −1..1, rotated by the spot's phase so spots
 * sharing a clock are not in lockstep. The first and last entries are equal, so
 * the animation wraps without a visible jump.
 */
function driftRange(amplitude: number, phase: number): number[] {
  const offset = Math.round(phase * CYCLE_STEPS);
  const cycle = Array.from({ length: CYCLE_STEPS }, (_, i) =>
    Math.sin(((i + offset) / CYCLE_STEPS) * Math.PI * 2) * amplitude
  );
  return [...cycle, cycle[0]];
}

function SpotView({
  spot,
  color,
  clocks,
}: {
  spot: SpotSpec;
  color: string;
  clocks: Animated.Value[] | null;
}) {
  const geometry = {
    position: 'absolute' as const,
    left: spot.x,
    top: spot.y,
    width: spot.size,
    height: spot.size,
    // A circle, not a rounded square.
    borderRadius: spot.size / 2,
    backgroundColor: color,
    opacity: spot.opacity,
  };

  if (!clocks) {
    // Reduce Motion, and every jest run: plain Views at their generated
    // positions. Identical geometry, no clocks, no timers.
    return <View testID={spot.key} style={geometry} />;
  }

  // Each spot interpolates one clock for X and the OTHER for Y, so the two
  // axes never move in a straight diagonal.
  const clockX = clocks[spot.clock];
  const clockY = clocks[spot.clock === 0 ? 1 : 0];

  return (
    <Animated.View
      testID={spot.key}
      style={[
        geometry,
        {
          transform: [
            {
              translateX: clockX.interpolate({
                inputRange: INPUT_RANGE,
                outputRange: driftRange(spot.driftX, spot.phase),
              }),
            },
            {
              translateY: clockY.interpolate({
                inputRange: INPUT_RANGE,
                outputRange: driftRange(spot.driftY, 1 - spot.phase),
              }),
            },
          ],
        },
      ]}
    />
  );
}

/**
 * The floating spotty backdrop: the wordmark's dot cluster, dispersed.
 *
 * Decorative only. `pointerEvents="none"` sits on the CONTAINER, which covers
 * every child, so a spot can never eat a tap meant for a field, a link or the
 * CTA.
 *
 * Mount it through `<Screen backdrop="spots">` rather than by hand — `Screen`
 * owns the one correct placement (full-bleed, behind the content, and OUTSIDE
 * `KeyboardAvoidingView` so it does not slide when the keyboard opens).
 *
 * Motion is POSITION ONLY. Opacity is deliberately never animated, so the
 * contrast budget in docs/plans/spots-background-and-dark-mode.md §5.6 holds at
 * every instant rather than on average.
 */
export function SpottyBackground() {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();

  // Assume-on-until-proven, plus the live OS subscription. Extracted to
  // `theme/useReduceMotion.ts` (the tab bar's pill needs the same guarantee, and
  // this is correctness-critical logic rather than styling) — see that file for
  // why it is what keeps five screen suites free of a busy rAF loop.
  const reduceMotion = useReduceMotion();

  const spots = useMemo(
    // Regenerates on rotation only — never on a keystroke. See `theme/spots.ts`
    // for why `Math.random` is banned here.
    () => generateSpots({ width, height, maxOpacity: theme.backdrop.spotOpacity }),
    [width, height, theme.backdrop.spotOpacity]
  );

  const clocksRef = useRef<Animated.Value[] | null>(null);
  if (!clocksRef.current) {
    clocksRef.current = CLOCK_DURATIONS.map(() => new Animated.Value(0));
  }
  const clocks = clocksRef.current;

  useEffect(() => {
    if (reduceMotion) return;

    const loops = clocks.map((clock, index) =>
      Animated.loop(
        Animated.timing(clock, {
          toValue: 1,
          duration: CLOCK_DURATIONS[index],
          easing: Easing.linear,
          // Native-driven transforms run on the UI thread with ZERO JS per
          // frame — the property a permanently-looping background needs.
          useNativeDriver: true,
        })
      )
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduceMotion, clocks]);

  return (
    <View
      testID="spots-backdrop"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip]}
    >
      {spots.map((spot) => (
        <SpotView
          key={spot.key}
          spot={spot}
          color={theme.backdrop.spot}
          clocks={reduceMotion ? null : clocks}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // A spot is placed so it never drifts off-canvas, but clipping is the
  // belt-and-braces guarantee that a rotation mid-animation cannot leave a
  // chord-shaped sliver at an edge.
  clip: { overflow: 'hidden' },
});
