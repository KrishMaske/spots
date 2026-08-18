// Double-entry rule: the fill and the opacity ceilings are hardcoded literals,
// never read from `theme.backdrop`. Asserting `opacity <= theme.backdrop
// .spotOpacity` would prove nothing; asserting `opacity <= 0.08` proves the
// contrast budget in docs/plans/spots-background-and-dark-mode.md §5.6.

import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';

import { SpottyBackground } from '../SpottyBackground';
import { ThemeHarness } from '../../testing/screenTestUtils';

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

// Spies are restored CENTRALLY, not at the end of each test body. A trailing
// `mockRestore()` is skipped when the test throws before reaching it, and this
// suite's spies are exactly the ones that must not leak: an escaped
// `isReduceMotionEnabled` -> false would silently start a real animation in the
// next test, on RN's JS driver fallback. `jest.setup.ts` installs its pins as
// plain assignments rather than spies, so `restoreAllMocks` restores those pins
// rather than clobbering them.
afterEach(() => {
  jest.restoreAllMocks();
});

function renderBackdrop(mode: 'light' | 'dark' = 'light') {
  return render(
    <ThemeHarness mode={mode}>
      <SpottyBackground />
    </ThemeHarness>
  );
}

/** Every spot View's resolved style, in tree order. */
function spotStyles(queries: {
  getAllByTestId: (id: RegExp) => { props: { style: unknown } }[];
}): Record<string, unknown>[] {
  return queries.getAllByTestId(/^spot-\d+$/).map((spot) => flattenStyle(spot.props.style));
}

describe('SpottyBackground is decorative', () => {
  it('never intercepts a touch', () => {
    // On the CONTAINER, which covers every child. A spot must not be able to
    // eat a tap meant for a field, a link or the CTA.
    const { getByTestId } = renderBackdrop();

    expect(getByTestId('spots-backdrop').props.pointerEvents).toBe('none');
  });

  it('lets a press through to a sibling underneath it', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeHarness mode="light">
        <View>
          <Pressable testID="target" onPress={onPress}>
            <Text>Log in</Text>
          </Pressable>
          <SpottyBackground />
        </View>
      </ThemeHarness>
    );

    fireEvent.press(getByTestId('target'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the generated field as circles, not rounded squares', () => {
    const view = renderBackdrop();

    const styles = spotStyles(view);
    expect(styles.length).toBeGreaterThan(0);

    for (const style of styles) {
      expect(style.position).toBe('absolute');
      expect(style.width).toBe(style.height);
      expect(style.borderRadius).toBe((style.width as number) / 2);
    }
  });
});

describe('SpottyBackground colors', () => {
  it('draws the one brand yellow in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const view = renderBackdrop(mode);

      for (const style of spotStyles(view)) {
        expect(style.backgroundColor).toBe('#FFC203');
      }
      view.unmount();
    }
  });

  it('holds each mode under its opacity ceiling', () => {
    // Conservative, well inside the AA budget rather than at its edge: the
    // AA-limiting alpha is ≈ 0.26 light and ≈ 0.22 dark. These are the values
    // actually shipped, and this asserts them as literals so a change to the
    // ceiling has to come through a failing test.
    const light = renderBackdrop('light');
    for (const style of spotStyles(light)) {
      expect(style.opacity as number).toBeGreaterThan(0);
      expect(style.opacity as number).toBeLessThanOrEqual(0.08);
    }
    light.unmount();

    const dark = renderBackdrop('dark');
    for (const style of spotStyles(dark)) {
      expect(style.opacity as number).toBeGreaterThan(0);
      expect(style.opacity as number).toBeLessThanOrEqual(0.1);
    }
    dark.unmount();
  });
});

describe('SpottyBackground is static by default', () => {
  it('starts no animation and applies no transform', () => {
    // The suite pins Reduce Motion ON (jest.setup.ts), and the component
    // assumes it is on until the platform says otherwise. Both together are
    // what keep five screen suites free of a busy rAF loop.
    const loop = jest.spyOn(Animated, 'loop');
    const view = renderBackdrop();

    for (const style of spotStyles(view)) {
      expect(style.transform).toBeUndefined();
    }
    expect(loop).not.toHaveBeenCalled();
  });

  it('does not re-scatter when a parent re-renders', () => {
    // THE bug this design exists to prevent: these are form screens, and a
    // backdrop that reshuffles on every keystroke is worse than none.
    function Host() {
      const [n, setN] = useState(0);
      return (
        <ThemeHarness mode="light">
          <View>
            <Pressable testID="bump" onPress={() => setN(n + 1)}>
              <Text>{`typed ${n}`}</Text>
            </Pressable>
            <SpottyBackground />
          </View>
        </ThemeHarness>
      );
    }

    const view = render(<Host />);
    const { getByTestId, getByText } = view;
    const before = spotStyles(view).map(
      ({ left, top, width }) => `${left}/${top}/${width}`
    );

    fireEvent.press(getByTestId('bump'));
    expect(getByText('typed 1')).toBeTruthy();

    const after = spotStyles(view).map(
      ({ left, top, width }) => `${left}/${top}/${width}`
    );
    expect(after).toEqual(before);
  });
});

describe('SpottyBackground animated branch', () => {
  // The ONLY test in the repo that opts into the animated branch. Cleanup is the
  // suite-level `afterEach` above.
  it('drives two shared clocks and stops both on unmount', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const start = jest.fn();
    const stop = jest.fn();
    const loop = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start, stop, reset: jest.fn() } as never);

    const view = renderBackdrop();
    await act(async () => {});

    // Two clocks for the WHOLE layer, not one per spot.
    expect(loop).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);

    for (const style of spotStyles(view)) {
      // Position only. Opacity is deliberately never animated, so the contrast
      // budget holds at every instant rather than on average.
      expect(style.transform).toHaveLength(2);
    }

    view.unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('goes back to static when the OS setting flips on, without a remount', async () => {
    const listeners: ((value: boolean) => void)[] = [];
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    // `Animated.loop` is stubbed here too: this test is about the STATE flip,
    // and letting a real loop start would hand the work to RN's silent JS
    // driver fallback (R9) — a `setTimeout(0)` busy loop for 18 wall-clock
    // seconds.
    jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as never);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(((_event: string, handler: (value: boolean) => void) => {
        listeners.push(handler);
        return { remove: jest.fn() };
      }) as never);

    const view = renderBackdrop();
    await act(async () => {});
    expect(spotStyles(view)[0].transform).toBeDefined();

    await act(async () => {
      listeners.forEach((handler) => handler(true));
    });
    expect(spotStyles(view)[0].transform).toBeUndefined();
  });
});
