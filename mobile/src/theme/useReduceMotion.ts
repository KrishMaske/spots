import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS asks us not to animate.
 *
 * ASSUME REDUCE MOTION IS ON until the platform says otherwise. Failing static
 * costs one frame of stillness and guarantees we never animate at someone who
 * asked us not to, including in the window before the async check resolves.
 *
 * IT IS ALSO WHAT KEEPS ANIMATED COMPONENTS SILENT UNDER JEST, which is the part
 * that costs hours if it is removed. RN's animated helper SILENTLY falls back to
 * a JS `requestAnimationFrame` driver when `NODE_ENV === 'test'` — the "native
 * animated module is missing" warning is suppressed there — and RN's jest setup
 * implements rAF as `setTimeout(0)`. So an unguarded animation does not warn; it
 * quietly busy-loops for its full wall-clock duration. `jest.setup.ts` pins this
 * ON for the whole suite, which is also what makes animated positions exact
 * rather than mid-spring in assertions.
 *
 * EXTRACTED FROM `SpottyBackground` (2026-08-17) so `SpotsTabBar` does not
 * duplicate it. This is ~20 lines of correctness-critical logic — the
 * assume-true-until-proven default, the guarded no-op setState, the live
 * subscription — which is a different proposition from duplicating eight lines of
 * styling. `components/__tests__/SpottyBackground.test.tsx` passes UNEDITED
 * across the extraction; that suite's stillness is the proof it was
 * behaviour-preserving.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const apply = (value: boolean) =>
      // A no-op when unchanged. An unconditional setState here would re-render
      // outside act() in every test that renders a consumer. This guard is a
      // specific fix, not defensive style.
      setReduceMotion((previous) => (previous === value || cancelled ? previous : value));

    AccessibilityInfo.isReduceMotionEnabled().then(apply).catch(() => {
      // No platform answer — stay static.
    });
    // Live subscription, so toggling the OS setting takes effect without a
    // restart.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
