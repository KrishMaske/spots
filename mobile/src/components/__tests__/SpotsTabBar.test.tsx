// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, frame `home-screen`,
// node 4:164, plus the exported centre ellipse `10:6`. Every number and hex here
// is an independent literal, never imported from `homeSpec`, `navMotion` or the
// theme. Asserting `duration <= navMotion.maxDuration` would prove nothing;
// asserting `<= 235` proves the spec.
//
// ── THREE HARNESS RULES THAT EVERYTHING BELOW DEPENDS ON ──────────────────────
//
// 1. POSITIONS ARE READ WITH `getAnimatedStyle`, AND ONLY AFTER `settle()`.
//    reanimated starts the mapper that feeds `useAnimatedStyle` through
//    `runOnUI`, which under jest is a `setTimeout(0)`. Until that macrotask has
//    run, the animated style holds its INITIAL value and nothing propagates.
//    `settle()` flushes it, and flushes pending microtasks at the same time.
//
// 2. `onSelect` IS ASYNCHRONOUS IN TESTS. Gesture callbacks are worklets, so
//    they reach JS through `runOnJS`, which defers through `queueMicrotask` even
//    when it is already on the JS runtime. Every assertion on `onSelect` from a
//    gesture must follow a `settle()`. (The accessibility path calls `onSelect`
//    synchronously — it never leaves the JS thread.)
//
// 3. THE 3pt DRAG THRESHOLD IS NO LONGER BEHAVIOURALLY TESTABLE. It is a native
//    activation criterion (`activeOffsetX`) evaluated by the platform, and the
//    test harness drives the gesture state machine from the event list it is
//    given rather than evaluating criteria. It is asserted as CONFIGURATION
//    instead — see `the pan will not activate inside 3pt`.

import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BlurView } from 'expo-blur';
import { DeviceEventEmitter } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { getAnimatedStyle } from 'react-native-reanimated';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { SpotsTabBar, type TabKey } from '../SpotsTabBar';
import { computeHomeLayout, type HomeNavLayout } from '../../theme/home';
import { ThemeHarness } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

function resolveStyle(element: { props: { style: unknown } }): Record<string, unknown> {
  const style = element.props.style;
  return flattenStyle(typeof style === 'function' ? style({ pressed: false }) : style);
}

function translateXOf(style: unknown): number {
  const transform = (style as { transform?: unknown }).transform as
    | { translateX?: unknown }[]
    | undefined;
  const entry = transform?.find((item) => item && 'translateX' in item);

  if (typeof entry?.translateX !== 'number') {
    throw new Error('tab-indicator has no animated translateX — did position move back to `left`?');
  }

  return entry.translateX;
}

/**
 * The indicator's LIVE bar-relative position, read out of its animated
 * `translateX`.
 *
 * Position lives in a reanimated shared value driven through `useAnimatedStyle`,
 * so `style.left` is always 0. This replaces the old `__getValue()` helper, which
 * reached into a React Native private; `getAnimatedStyle` is a public, documented,
 * test-facing export.
 *
 * IT IS DETERMINISTIC because `jest.setup.ts` pins Reduce Motion ON and the
 * component assumes it is on until the platform says otherwise, so every position
 * change is a plain assignment. NO ANIMATION EVER STARTS IN THIS SUITE: the value
 * read here is the exact target, never a mid-flight interpolation.
 */
function position(element: Parameters<typeof getAnimatedStyle>[0]): number {
  return translateXOf(getAnimatedStyle(element));
}

/**
 * The indicator's position AS RENDERED — the transform the host View was last
 * handed.
 *
 * The two readers diverge, and knowing which to use is the whole of R13. The
 * shared value drives the view WITHOUT a React render, so `props.style` only
 * refreshes when something else re-renders the component; `getAnimatedStyle`
 * merges in `props.jestAnimatedStyle`, which only refreshes when the mapper runs,
 * and the mapper runs only when a shared value CHANGES while a view is attached.
 *
 * So `position()` is right almost everywhere — and wrong in exactly one case: an
 * indicator that MOUNTS at a value the shared value already held (the pill
 * reappearing after the centre button was active). Nothing changed, so the mapper
 * never ran, so `jestAnimatedStyle` still holds the value from the component's
 * first render. What the user sees in that case is the rendered style, and that
 * is what this reads.
 */
function mountedPosition(element: { props: { style: unknown } }): number {
  return translateXOf(flattenStyle(element.props.style));
}

/**
 * Rule 1 + rule 2, in one call. The trailing empty `act` drains the microtasks
 * `runOnJS` queued while the macrotask above was running.
 *
 * KNOWN, HARMLESS NOISE THIS CAUSES: `MaterialIcons` loads its TTF in
 * `componentDidMount` and `setState`s when that promise resolves. This suite is
 * now the only one in the repo that lets a macrotask through, so it is the only
 * one where that promise ever lands — and React prints four "an update to Icon
 * was not wrapped in act(...)" lines, one per glyph, once per run. It is not
 * fixable from here: draining it inside `act` (0ms, 20ms, in an `afterEach`, or
 * all three) does not silence it, because the `setState` is enqueued from a
 * promise chain outside the act scope. Mocking `@expo/vector-icons` would
 * silence it and is explicitly the wrong answer — see `mobile/README.md` on why
 * that mock is banned. Four console lines, 43 green tests.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {});
}

/** The layout function has its own pure suite (`theme/__tests__/home.test.ts`)
 *  asserting it against the Figma literals; this suite is about what the bar
 *  does with it, so it consumes the real thing at the reference size. */
const LAYOUT = computeHomeLayout({ width: 390, height: 844, insets: { top: 0, bottom: 0 } }).nav;
/** A narrower device, for the rotation case. */
const LAYOUT_375 = computeHomeLayout({ width: 375, height: 812, insets: { top: 0, bottom: 0 } }).nav;

// Indicator lefts at the reference size, written as literals at every use site
// per the double-entry rule: home 5.5, map 61.5, groups 208.5, profile 263.5 —
// the icon centres (43, 99, 246, 301) minus half of the 75pt indicator.

function tree(
  activeKey: TabKey,
  onSelect: jest.Mock,
  mode: 'light' | 'dark',
  layout: HomeNavLayout
) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeHarness mode={mode}>
        <SpotsTabBar activeKey={activeKey} onSelect={onSelect} layout={layout} />
      </ThemeHarness>
    </SafeAreaProvider>
  );
}

/**
 * Renders the bar under the same providers `renderScreen` uses, but composed
 * locally so `setProps` can re-render with new props while keeping the theme and
 * safe-area context. `screenTestUtils.tsx` is deliberately NOT changed for this:
 * it is shared by every screen suite, and it must NOT gain a
 * `GestureHandlerRootView` either — `GestureDetector`'s dev-only "must be a
 * descendant of GestureHandlerRootView" throw is guarded by `!isTestEnv()`.
 */
function renderBar(
  activeKey: TabKey = 'home',
  onSelect: jest.Mock = jest.fn(),
  mode: 'light' | 'dark' = 'light',
  layout: HomeNavLayout = LAYOUT
) {
  const view = render(tree(activeKey, onSelect, mode, layout));

  return {
    ...view,
    onSelect,
    setProps: (nextKey: TabKey, nextLayout: HomeNavLayout = layout) =>
      view.rerender(tree(nextKey, onSelect, mode, nextLayout)),
  };
}

// ── DRIVING THE GESTURE ───────────────────────────────────────────────────────
//
// `fireGestureHandler` from `react-native-gesture-handler/jest-utils` drives the
// whole gesture in one call: it fills in BEGAN/ACTIVE and ALWAYS appends an END
// (its `shouldDuplicateLastEvent` predicate is `!END || !FAILED || !CANCELLED`,
// which no single state can falsify). That makes three things it cannot express,
// and this suite needs all three: a CANCELLED gesture, a gesture paused in the
// middle so a prop can change under it, and a Tap that follows the Pan's BEGAN
// on the same touch — which is what the composed `Gesture.Race` actually sees.
//
// So the events are emitted directly, on the same `DeviceEventEmitter` channel
// and in the same shape `fireGestureHandler` uses. `getByGestureTestId` still
// supplies the handler tag, so the gesture test ids remain the seam. No view
// `testID` is added anywhere.
//
// RNGH state codes: 0 UNDETERMINED, 1 FAILED, 2 BEGAN, 3 CANCELLED, 4 ACTIVE,
// 5 END.

const PAN_DEFAULTS = {
  x: 0,
  y: 26, // vertically inside the indicator (top 5, height 42)
  absoluteX: 0,
  absoluteY: 0,
  translationX: 0,
  translationY: 0,
  velocityX: 0,
  velocityY: 0,
  numberOfPointers: 1,
};

interface GestureStep {
  state?: number;
  x?: number;
  translationX?: number;
}

function driver(testId: string) {
  const handlerTag = (getByGestureTestId(testId) as unknown as { handlerTag: number }).handlerTag;
  let previousState = 0;

  return (steps: GestureStep[]) => {
    act(() => {
      for (const step of steps) {
        const state = step.state ?? previousState;
        const changed = state !== previousState;
        const nativeEvent = {
          ...PAN_DEFAULTS,
          ...step,
          state,
          handlerTag,
          ...(changed ? { oldState: previousState } : {}),
        };

        DeviceEventEmitter.emit(
          changed ? 'onGestureHandlerStateChange' : 'onGestureHandlerEvent',
          nativeEvent
        );
        previousState = state;
      }
    });
  };
}

describe('SpotsTabBar geometry', () => {
  it('floats a 343x51 pill with a 126pt total footprint', () => {
    const { getByTestId } = renderBar();

    // 87 nav band + 39 home-indicator tail.
    expect(flattenStyle(getByTestId('tab-bar').props.style).height).toBe(126);

    const pill = flattenStyle(getByTestId('tab-bar-pill').props.style);
    expect(pill.width).toBe(343);
    expect(pill.height).toBe(51);
    expect(pill.left).toBe(23.5);
    expect(pill.top).toBe(18);
    expect(pill.position).toBe('absolute');
  });

  it('keeps the frame shadow on the pill and the clip off it', () => {
    const { getByTestId } = renderBar();

    const pill = flattenStyle(getByTestId('tab-bar-pill').props.style);
    // Figma says 170 on a 51pt bar; any radius >= height/2 renders the same
    // capsule, so the assertion is the SHAPE, not the spelling.
    expect(pill.borderRadius as number).toBeGreaterThanOrEqual(25.5);
    expect(pill.borderRadius).not.toBe(25);
    expect(pill.shadowOffset).toEqual({ width: 0, height: 4 });
    expect(pill.shadowOpacity).toBe(0.35);
    expect(pill.elevation).toBe(6);
    // THE IOS SHADOW-CLIPPING TRAP, asserted the way FeedCard.test.tsx does: a
    // shadow and `overflow: 'hidden'` on the same view clip the shadow away. If
    // someone "simplifies" the pill back to one view, iOS silently loses the
    // bar's shadow and the whole floating look with it.
    expect(pill.overflow).toBeUndefined();
  });

  it('paints the linen as a translucent tint over a single BlurView', () => {
    // A DELIBERATE DEPARTURE FROM 4:164, which draws an opaque #FAF8F6 bar. The
    // blur is on the BAR rather than on the indicator because a Gaussian blur of
    // the bar's own uniform fill would return that fill — a no-op — whereas the
    // scrolling feed genuinely passes behind the bar.
    const { getByTestId, UNSAFE_getAllByType } = renderBar();

    const fill = flattenStyle(getByTestId('tab-bar-pill-fill').props.style);
    expect(fill.overflow).toBe('hidden'); // Android ignores borderRadius on BlurView
    expect(fill.borderRadius as number).toBeGreaterThanOrEqual(25.5);

    // ONE BlurView, not two: a second frost pass over an already-frosted surface
    // adds little and doubles the Android exposure.
    const blurs = UNSAFE_getAllByType(BlurView);
    expect(blurs).toHaveLength(1);
    expect(blurs[0].props.intensity).toBe(40);
    expect(blurs[0].props.tint).toBe('light');
    // Android blur is off without this, and Expo documents the path as
    // experimental. DELIBERATELY NOT ASSERTED: that anything is actually blurred.
    // `BlurView` is a native view with no pixels under jest, so the contract is
    // all there is to check — that gap is known, not an oversight.
    expect(blurs[0].props.experimentalBlurMethod).toBe('dimezisBlurView');

    // 0.72 x 255 = 184 = 0xB8.
    expect(flattenStyle(getByTestId('tab-bar-tint').props.style).backgroundColor).toBe('#FAF8F6B8');
  });

  it('gives every one of the five targets at least 44pt in both axes', () => {
    const { getByTestId } = renderBar();

    for (const testID of ['tab-home', 'tab-map', 'tab-groups', 'tab-profile']) {
      const style = resolveStyle(getByTestId(testID));
      // 52 x the bar's 51, even though the glyphs are only 32-34.
      expect(style.width as number).toBeGreaterThanOrEqual(44);
      expect(style.height as number).toBeGreaterThanOrEqual(44);
    }

    const chat = resolveStyle(getByTestId('tab-chat'));
    expect(chat.width).toBe(70);
    expect(chat.height).toBe(70);
  });

  it('sizes the four glyphs 34/34/34/32 in the ink colour', () => {
    // LIGHT MODE ONLY, and that is now load-bearing rather than incidental: dark
    // gives the ACTIVE glyph the accent (see the dark describe). In light every
    // glyph stays ink, because the one brand yellow tops out at 1.62:1 on white.
    const { UNSAFE_getAllByType } = renderBar();

    const icons = UNSAFE_getAllByType(MaterialIcons);
    expect(icons.map((i) => i.props.size)).toEqual([34, 34, 34, 32]);
    expect(icons.map((i) => i.props.name)).toEqual(['home', 'place', 'groups', 'person']);
    for (const icon of icons) {
      // #1D1B20 in the frame (M3 `on-surface`); normalised onto the app's own
      // ink, 19 units away and 18.51:1 on #FAF8F6 either way.
      expect(icon.props.color).toBe('#0A0A0A');
    }
  });
});

describe('SpotsTabBar active state', () => {
  it('draws a 75x42 glassy indicator behind the active icon', () => {
    const { getByTestId } = renderBar('home');

    const style = flattenStyle(getByTestId('tab-indicator').props.style);
    // Figma drew 52x40 @ top 6; 75x42 @ 5 is a deliberate size bump — half of 75
    // is exactly the gap from the map icon's centre to the centre circle's left
    // edge at the reference width, and top 5 gives a uniform 4pt of bar above and
    // below. See `theme/home.ts`.
    expect(style.width).toBe(75);
    expect(style.height).toBe(42);
    expect(style.top).toBe(5);
    expect(style.borderRadius as number).toBeGreaterThanOrEqual(21);
    expect(style.overflow).toBe('hidden'); // same Android borderRadius caveat
    // The specular glass edge. B3 is 0.70 — the alpha the border already used;
    // only the colour token changed, to a mode-invariant white.
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe('#FFFFFFB3');
  });

  it('stacks the pill as tint + inner highlight, with NO second blur', () => {
    // Glass-on-glass: the pill reads as glass because the bar it floats on is
    // glass. A `BlurView` here would be blurring the bar's uniform fill — a
    // measured no-op — so there is exactly one in the whole component.
    const { getByTestId, UNSAFE_getAllByType } = renderBar('home');

    // THE LIGHT-MODE TINT IS UNCHANGED: the brand yellow at 0.3 x 255 = 77 = 0x4D.
    // Its dark-mode twin is now a NEUTRAL FROST, and the two modes are SUPPOSED
    // to differ here — see `gives the dark indicator a neutral frost`. That
    // reverses the old instruction on this pair ("do not let the two modes drift
    // apart"), and the reason is measured: a yellow glyph on a yellow tint is
    // 1.33:1, and light mode has no surface on which a yellow glyph is legible,
    // so light keeps the pill as the selection signal.
    expect(flattenStyle(getByTestId('tab-indicator-tint').props.style).backgroundColor).toBe(
      '#FFC2034D'
    );
    const highlight = flattenStyle(getByTestId('tab-indicator-highlight').props.style);
    expect(highlight.backgroundColor).toBe('#FFFFFF40');
    expect(highlight.height).toBe('45%');
    expect(highlight.top).toBe(1);

    expect(UNSAFE_getAllByType(BlurView)).toHaveLength(1);
  });

  it('moves the indicator to whichever tab is active', async () => {
    // GENERALISED FROM ONE EXAMPLE: the frame only ever shows Home active.
    const home = renderBar('home');
    await settle();
    // Home's centre is 43, so the 75-wide indicator starts at 5.5. Position is a
    // `translateX` over `left: 0`, which is what lets a tap glide instead of
    // jumping — see `position()` above.
    expect(flattenStyle(home.getByTestId('tab-indicator').props.style).left).toBe(0);
    expect(position(home.getByTestId('tab-indicator'))).toBe(5.5);
    home.unmount();

    const profile = renderBar('profile');
    await settle();
    // Profile's centre is 301 (343 - 42), so it starts at 263.5.
    expect(position(profile.getByTestId('tab-indicator'))).toBe(263.5);
  });

  it('gives the centre button no indicator', () => {
    const { queryByTestId } = renderBar('chat');

    expect(queryByTestId('tab-indicator')).toBeNull();
  });

  it('reports the selected tab to assistive tech', () => {
    const { getByTestId } = renderBar('map');

    for (const testID of ['tab-home', 'tab-map', 'tab-chat', 'tab-groups', 'tab-profile']) {
      expect(getByTestId(testID).props.accessibilityRole).toBe('tab');
    }
    expect(getByTestId('tab-map').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('tab-home').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-chat').props.accessibilityState.selected).toBe(false);
  });

  it('names every tab', () => {
    const { getByTestId } = renderBar();

    expect(getByTestId('tab-home').props.accessibilityLabel).toBe('Home');
    expect(getByTestId('tab-map').props.accessibilityLabel).toBe('Map');
    expect(getByTestId('tab-chat').props.accessibilityLabel).toBe('Spots AI');
    expect(getByTestId('tab-groups').props.accessibilityLabel).toBe('Groups');
    expect(getByTestId('tab-profile').props.accessibilityLabel).toBe('Profile');
  });
});

describe('SpotsTabBar selection', () => {
  // THE FOUR ICON TABS ARE ACCESSIBILITY TARGETS, NOT POINTER TARGETS. They carry
  // `pointerEvents="none"` so a finger only ever reaches the pill's gesture
  // recogniser — gesture-handler is a NATIVE recogniser and does not join RN's
  // responder negotiation, so without that a still tap could fire both the Tap
  // gesture and the Pressable's onPress and select twice.
  //
  // WHICH IS WHY THESE FIVE CASES COULD NOT STAY ON `fireEvent.press`: RNTL gates
  // `press` on `pointerEvents` (`helpers/pointer-events.js`), so a press on a
  // `pointerEvents="none"` element is skipped and no handler runs. That is
  // exactly right — it models what a finger does — but it means the assistive
  // path needs its own event, and `accessibilityTap` is that event. It is the
  // same handler `onPress` is wired to, and it is closer to what VoiceOver
  // actually delivers than a synthetic press ever was.
  it.each(['home', 'map', 'groups', 'profile'] as const)(
    'fires onSelect("%s") from assistive activation',
    (key) => {
      const onSelect = jest.fn();
      const { getByTestId } = renderBar('home', onSelect);

      fireEvent(getByTestId(`tab-${key}`), 'accessibilityTap');

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(key);
    }
  );

  it('a finger cannot reach the icon Pressables at all', () => {
    // The other half of the contract above, asserted directly so nobody
    // "restores" pointer events to make a press test pass.
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);

    for (const key of ['home', 'map', 'groups', 'profile']) {
      expect(getByTestId(`tab-${key}`).props.pointerEvents).toBe('none');
    }

    fireEvent.press(getByTestId('tab-map'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fires onSelect("chat") from a real press', () => {
    // The centre button is a SIBLING of the pill and OUTSIDE the GestureDetector,
    // so it keeps its pointer events and never competes with the bar's gesture.
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);

    fireEvent.press(getByTestId('tab-chat'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('chat');
  });
});

describe('SpotsTabBar drag', () => {
  it('tracks the finger while dragging', async () => {
    // Realistic increments, not one giant jump: on a device moves arrive every
    // ~16ms and are a point or two each, and the drag re-bases at ACTIVATION so
    // the threshold is never baked into the offset.
    const { getByTestId } = renderBar('home');
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 }, // on the indicator (5.5..80.5), over home
      { state: 4, x: 20, translationX: 0 }, // activation: dragOrigin = 5.5
      { x: 27, translationX: 7 },
      { x: 40, translationX: 20 },
      { x: 55, translationX: 35 },
    ]);
    await settle();

    // 5.5 + 35, exactly: at 40.5 the pill is 35pt from home's rest and 21pt from
    // map's, so it is outside the magnet's 18pt radius of either and tracks 1:1.
    expect(position(getByTestId('tab-indicator'))).toBe(40.5);
  });

  it('snaps to the nearest tab on release AND navigates', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
      { x: 55, translationX: 35 },
      { x: 90, translationX: 70 }, // 75.5 raw, nearer map's 61.5 than home's 5.5
      { state: 5, x: 90, translationX: 70 },
    ]);
    await settle();

    expect(position(getByTestId('tab-indicator'))).toBe(61.5);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('map');
  });

  it('clamps to the first and last tab at both ends', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
      { x: -480, translationX: -500 },
    ]);
    await settle();
    expect(position(getByTestId('tab-indicator'))).toBe(5.5); // home, not -494.5

    pan([{ x: 2020, translationX: 2000 }]);
    await settle();
    expect(position(getByTestId('tab-indicator'))).toBe(263.5); // profile, not 2005.5

    pan([{ state: 5, x: 2020, translationX: 2000 }]);
    await settle();
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it('springs back and selects NOTHING when the gesture is terminated', async () => {
    // A system gesture won. The user never completed a choice, so navigating
    // would be putting them somewhere they did not ask to go.
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
      { x: 90, translationX: 70 },
      { state: 3, x: 90, translationX: 70 }, // CANCELLED
    ]);
    await settle();

    expect(position(getByTestId('tab-indicator'))).toBe(5.5);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('re-selects the current tab when tapped without moving', async () => {
    // Harmless: `navigate` to the current route is a no-op. This is the Tap side
    // of the Race — the Pan begins on the same touch (which is what arms the
    // grab) and then loses.
    const onSelect = jest.fn();
    const { getByTestId } = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');
    const tap = driver('tab-bar-tap');

    pan([{ state: 2, x: 20, translationX: 0 }]);
    tap([{ state: 2, x: 20 }, { state: 4, x: 20 }, { state: 5, x: 20 }]);
    await settle();

    expect(position(getByTestId('tab-indicator'))).toBe(5.5);
    expect(onSelect).toHaveBeenCalledWith('home');
  });

  it('a touch that did not start on the indicator never tracks 1:1', async () => {
    // REPLACES `only claims a gesture that STARTED on the indicator`. The old
    // contract — decline every touch that did not begin on the indicator — is
    // what forced a tap to take one of two code paths depending on finger jitter.
    // The property that replaces it is the grab/scrub branch: a scrub re-glides
    // tab to tab as the finger crosses boundaries, and never follows it 1:1,
    // because tracking a non-grab touch 1:1 would jump the pill up to half a
    // pitch on the very first move.
    //
    // (`declines a gesture that started above or below the indicator` is REMOVED
    // outright. Its Y hit-test was measured in the wrong coordinate space for a
    // touch landing on a glyph, the 4pt margins it guarded are not a distinction
    // a thumb can express, and with a single GestureDetector there is no
    // per-target coordinate space left to be wrong about.)
    const { getByTestId } = renderBar('home');
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([{ state: 2, x: 230, translationX: 0 }]); // over groups, not the pill
    await settle();
    // Touch-down alone moved it, all the way, immediately.
    expect(position(getByTestId('tab-indicator'))).toBe(208.5);

    pan([
      { state: 4, x: 230, translationX: 0 },
      { x: 260, translationX: 30 },
    ]);
    await settle();
    // Still exactly on groups: 208.5, not 208.5 + 30.
    expect(position(getByTestId('tab-indicator'))).toBe(208.5);
  });

  it('the pan will not activate inside 3pt', async () => {
    // REPLACES `needs more than 3pt of movement before it claims a move`. Same
    // threshold, same intent — "a tap on the indicator must never accidentally
    // become a drag" — but it is now a NATIVE activation criterion rather than
    // arithmetic in a move handler, so it is asserted as configuration. The
    // literals are -3 and 3, never `navMotion.dragThreshold`.
    renderBar('home');
    await settle();

    const config = (getByGestureTestId('tab-bar-gesture') as unknown as {
      config: Record<string, unknown>;
    }).config;

    expect(config.activeOffsetXStart).toBe(-3);
    expect(config.activeOffsetXEnd).toBe(3);
  });

  it('with chat active, a tap still resolves to the nearest icon tab', async () => {
    // INVERTS `declines every touch when the centre button is active`. There is
    // no indicator to drag, but the bar must still be usable: the touch records
    // intent and the value is assigned, so the pill APPEARS at its destination
    // when it mounts rather than sliding in from wherever it was left.
    const onSelect = jest.fn();
    const bar = renderBar('chat', onSelect);
    await settle();
    expect(bar.queryByTestId('tab-indicator')).toBeNull();

    const pan = driver('tab-bar-gesture');
    const tap = driver('tab-bar-tap');
    pan([{ state: 2, x: 99, translationX: 0 }]); // the map icon's centre
    tap([{ state: 2, x: 99 }, { state: 4, x: 99 }, { state: 5, x: 99 }]);
    await settle();

    expect(onSelect).toHaveBeenCalledWith('map');

    bar.setProps('map');
    await settle();
    // NO TRAVEL: it APPEARS at map rather than sliding in from wherever the pill
    // was left. Read as rendered, because a freshly mounted view at an unchanged
    // shared value is the one case `getAnimatedStyle` cannot see — see
    // `mountedPosition`.
    expect(mountedPosition(bar.getByTestId('tab-indicator'))).toBe(61.5);
  });

  it('the drag origin is the pill’s position, not the destination', async () => {
    // THE CAUSE A TRIPWIRE, in the only form that still makes sense. The old code
    // recorded the DESTINATION as "where we are", so a drag begun after a move
    // computed its origin from a stale point and the pill jumped to meet the
    // arithmetic. A shared value cannot be stale: `position.value` inside a
    // worklet IS the pill's number.
    const bar = renderBar('home');
    await settle();

    bar.setProps('groups');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(208.5);

    const pan = driver('tab-bar-gesture');
    pan([
      { state: 2, x: 220, translationX: 0 }, // inside groups' indicator box
      { state: 4, x: 220, translationX: 0 },
      { x: 245, translationX: 25 },
    ]);
    await settle();

    // 208.5 + 25. If the origin were the last destination the old code recorded,
    // this would be 30.5.
    expect(position(bar.getByTestId('tab-indicator'))).toBe(233.5);
  });

  it('the magnet never deviates more than 1.6pt and never stalls', async () => {
    // Arithmetic guarantees from `homeSpec.nav.motion`, asserted behaviourally:
    // deviation is bounded at strength x radius / 4 = 1.575pt, and the response
    // never drops below 1 - strength = 0.65 of finger speed, so the pill always
    // moves when the finger moves.
    const { getByTestId } = renderBar('home');
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
    ]);

    const seen: number[] = [];
    // Straddling map's rest position (61.5), i.e. translations either side of 56.
    for (const translationX of [46, 50, 53, 56, 59, 62, 66]) {
      pan([{ x: 20 + translationX, translationX }]);
      await settle();
      const raw = 5.5 + translationX;
      const actual = position(getByTestId('tab-indicator'));
      expect(Math.abs(actual - raw)).toBeLessThanOrEqual(1.6);
      seen.push(actual);
    }

    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    }
  });

  it('no animation starts under jest, which is what makes the positions exact', async () => {
    // REPLACES `starts NO spring under jest`. Reduce Motion is pinned ON in
    // `jest.setup.ts` and the component assumes it is on until the platform says
    // otherwise, so every position change is an assignment. That is not a nicety:
    // a `withTiming` in this environment does not warn — it quietly runs its
    // frame loop for the animation's full wall-clock duration.
    //
    // THE ASSERTION IS THAT THE POSITION IS EXACTLY THE TARGET after a full
    // touch-down -> drag -> release -> re-render cycle. Under a real `withTiming`
    // the value read here would still be the START value (verified: reanimated's
    // jest path does not resolve a timing synchronously), so this bites.
    const onSelect = jest.fn();
    const bar = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
      { x: 90, translationX: 70 },
      { state: 5, x: 90, translationX: 70 },
    ]);
    await settle();
    bar.setProps('map');
    await settle();

    expect(position(bar.getByTestId('tab-indicator'))).toBe(61.5);
  });
});

describe('SpotsTabBar navigation never teleports the pill', () => {
  // THE TWO CAUSE B TESTS. They are pure prop-driven tests — they do not touch
  // the gesture layer at all — and they are the guard on the rule that intent is
  // compared to intent and never to a position. If anyone adds a third writer of
  // either copy of the intent, these are what go red. Do not delete them.

  it('a confirming activeKey does not move the pill', async () => {
    const bar = renderBar('home');
    await settle();

    fireEvent(bar.getByTestId('tab-map'), 'accessibilityTap');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(61.5);

    bar.setProps('map'); // the navigation catching up
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(61.5);
  });

  it('a superseded activeKey never pulls the pill backwards', async () => {
    // Tap map, tap profile 80ms later, and the navigator answers `map` FIRST.
    // The old effect treated that as an instruction and glided the pill back to
    // map before gliding forward again — the visible snap on rapid taps.
    const bar = renderBar('home');
    await settle();

    fireEvent(bar.getByTestId('tab-map'), 'accessibilityTap');
    fireEvent(bar.getByTestId('tab-profile'), 'accessibilityTap');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(263.5);

    bar.setProps('map'); // the STALE navigation landing late
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(263.5); // NOT 61.5

    bar.setProps('profile');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(263.5);
  });

  it('an external activeKey change moves the pill', async () => {
    // A deep link or a programmatic navigate. Nothing asked for it locally, so
    // it is obeyed — and it glides, exactly like a tap.
    const bar = renderBar('home');
    await settle();

    bar.setProps('groups');
    await settle();

    expect(position(bar.getByTestId('tab-indicator'))).toBe(208.5);
  });

  it('a rotation snaps rather than glides', async () => {
    // The geometry moved under the pill, so gliding would be motion the user
    // never asked for. At 375 the bar is 328 wide and profile's centre is 286,
    // so its indicator starts at 248.5 rather than 263.5.
    const bar = renderBar('profile');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(263.5);

    bar.setProps('profile', LAYOUT_375);
    await settle();

    expect(position(bar.getByTestId('tab-indicator'))).toBe(248.5);
  });

  it('a deep link during a drag does not move the pill', async () => {
    // The finger owns the pill. The effect records the new intent and leaves the
    // motion alone; the release reconciles. Without the guard, a route change
    // arriving mid-drag would glide the pill out from under the finger.
    const onSelect = jest.fn();
    const bar = renderBar('home', onSelect);
    await settle();
    const pan = driver('tab-bar-gesture');

    pan([
      { state: 2, x: 20, translationX: 0 },
      { state: 4, x: 20, translationX: 0 },
      { x: 55, translationX: 35 },
    ]);
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(40.5);

    bar.setProps('profile');
    await settle();
    expect(position(bar.getByTestId('tab-indicator'))).toBe(40.5); // still under the finger

    pan([{ state: 5, x: 55, translationX: 35 }]);
    await settle();
    // Nearest to 40.5 is map's 61.5 (21) rather than home's 5.5 (35).
    expect(position(bar.getByTestId('tab-indicator'))).toBe(61.5);
    expect(onSelect).toHaveBeenCalledWith('map');
  });
});

describe('SpotsTabBar centre button overflows the pill', () => {
  it('places a 70pt linen circle straddling the bar edge', () => {
    const { getByTestId } = renderBar();

    const button = resolveStyle(getByTestId('tab-chat'));
    // Bar top 18 + the circle's bar-relative −9.
    expect(button.top).toBe(9);
    expect(button.left).toBeCloseTo(160, 5); // 23.5 + (343 − 70)/2

    const circle = flattenStyle(getByTestId('tab-chat-circle').props.style);
    // The exported ellipse 10:6 is `<circle fill="#FAF8F6">` — the SAME linen as
    // the bar, NOT white. It separates by its shadow, not its fill (1.04:1).
    expect(circle.backgroundColor).toBe('#FAF8F6');
    expect(circle.borderRadius as number).toBeGreaterThanOrEqual(35);
  });

  it('gives the circle its OWN shadow and a higher elevation than the bar', () => {
    const { getByTestId } = renderBar();

    const circle = flattenStyle(getByTestId('tab-chat-circle').props.style);
    // 10:6's filter is feOffset dy 2 + feGaussianBlur stdDeviation 5 — NOT the
    // bar's dy 4. Deliberately not collapsed into one shared shadow token.
    expect(circle.shadowOffset).toEqual({ width: 0, height: 2 });
    expect(circle.shadowRadius).toBe(5);
    expect(circle.shadowOpacity).toBe(0.35);
    // Android z-order follows elevation, and the circle must beat the pill's 6.
    expect(circle.elevation).toBe(10);
  });

  it('lets the logo poke above the circle', () => {
    const { getByTestId } = renderBar();

    const logo = flattenStyle(getByTestId('tab-chat-logo').props.style);
    expect(logo.width).toBe(67);
    expect(logo.height).toBe(90);
    // Button-relative: the logo's −19 against the circle's −9.
    expect(logo.top).toBe(-10);
    expect(logo.top as number).toBeLessThan(0);
    expect(getByTestId('tab-chat-logo').props.resizeMode).toBe('contain');
  });

  it('never lets an ancestor clip the centre button', () => {
    // R2. The circle overflows the 51pt bar by 9pt and the logo by 19pt. Any
    // `overflow: 'hidden'` in this chain silently eats the design. `GestureDetector`
    // does not add a view — it clones its child with `collapsable: false` — so it
    // cannot introduce one either.
    const { getByTestId } = renderBar();

    let node = getByTestId('tab-chat').parent as
      | { parent: unknown; props?: { style?: unknown } }
      | null;
    while (node) {
      expect(flattenStyle(node.props?.style).overflow).not.toBe('hidden');
      node = node.parent as typeof node;
    }
  });

  it('paints the centre button AFTER the pill, so it wins on iOS too', () => {
    const { getByTestId } = renderBar();

    const order = getByTestId('tab-bar')
      .findAll(
        (node: { type: unknown; props: { testID?: string } }) =>
          typeof node.type === 'string' &&
          ['tab-bar-pill', 'tab-chat'].includes(node.props.testID ?? '')
      )
      .map((node: { props: { testID?: string } }) => node.props.testID);

    expect(order).toEqual(['tab-bar-pill', 'tab-chat']);
  });
});

describe('SpotsTabBar in dark mode', () => {
  it('lifts the pill and the circle onto the raised night surface', () => {
    // #373E4A, not the #1A1D23 this used to assert: at #1A1D23 the bar was
    // 1.12:1 from the canvas and byte-identical to `colors.surface`, and its
    // black shadow does nothing on #0F1115 — so the floating bar did not float.
    const { getByTestId } = renderBar('home', jest.fn(), 'dark');

    // The bar's fill is now the translucent tint over the blur, not a colour on
    // the shadow-owning view. 0.72 x 255 = 184 = 0xB8.
    expect(flattenStyle(getByTestId('tab-bar-tint').props.style).backgroundColor).toBe('#373E4AB8');
    expect(flattenStyle(getByTestId('tab-chat-circle').props.style).backgroundColor).toBe('#373E4A');
  });

  it('gives the ACTIVE glyph the accent and leaves the other three ink', () => {
    // THE YELLOW MOVED FROM THE PILL TO THE GLYPH, in dark mode only. Measured:
    // the accent is 6.65:1 against the bar and 4.35:1 against its own frost slab.
    // All four are asserted BY POSITION so a regression that yellows every glyph
    // is caught rather than passing on the first one.
    const { UNSAFE_getAllByType } = renderBar('map', jest.fn(), 'dark');

    expect(UNSAFE_getAllByType(MaterialIcons).map((i) => i.props.color)).toEqual([
      '#F5F5F5',
      '#FFC203',
      '#F5F5F5',
      '#F5F5F5',
    ]);
  });

  it('frosts the bar with the dark tint', () => {
    const { UNSAFE_getAllByType } = renderBar('home', jest.fn(), 'dark');

    const blurs = UNSAFE_getAllByType(BlurView);
    expect(blurs).toHaveLength(1);
    expect(blurs[0].props.tint).toBe('dark');
    expect(blurs[0].props.intensity).toBe(40);
  });

  it('keeps the glass edge and highlight mode-invariant', () => {
    // A specular highlight is white regardless of the substrate. Measured, the
    // edge is a real 3.73:1 delineation in dark and a cosmetic 1.14:1 in light —
    // which is what white-on-near-white does, not a defect in the value.
    const { getByTestId } = renderBar('home', jest.fn(), 'dark');

    expect(flattenStyle(getByTestId('tab-indicator').props.style).borderColor).toBe('#FFFFFFB3');
    expect(flattenStyle(getByTestId('tab-indicator-highlight').props.style).backgroundColor).toBe(
      '#FFFFFF40'
    );
  });

  it('gives the dark indicator a neutral frost, not a yellow tint', () => {
    // REPLACES `keeps the indicator on the one brand yellow at the one alpha`.
    // There is still exactly ONE yellow — this does not add a second — the
    // question is only where it lands, and in dark it lands on the glyph. A
    // yellow slab UNDER a yellow glyph would be 1.33:1, so the slab goes neutral:
    // specular white at 0.15 x 255 = 38 = 0x26, which measures 4.35:1 under the
    // accent glyph with room to about 0.20 before that drops below 3:1.
    //
    // The light-mode twin (`stacks the pill as tint + inner highlight`) KEEPS the
    // yellow at 0x4D, and that divergence is deliberate: the one brand yellow has
    // a WCAG luminance of 0.598, capping it at 1.62:1 on white, so there is no
    // light-mode surface on which a yellow glyph is legible.
    const { getByTestId } = renderBar('home', jest.fn(), 'dark');

    expect(flattenStyle(getByTestId('tab-indicator-tint').props.style).backgroundColor).toBe(
      '#FFFFFF26'
    );
  });
});
