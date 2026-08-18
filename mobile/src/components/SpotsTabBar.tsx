import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { copy } from "../theme/copy";
import {
  navMotion,
  type HomeNavLayout,
  type HomeTabIconKey,
  type HomeTabIconLayout,
} from "../theme/home";
import { useReduceMotion } from "../theme/useReduceMotion";
import { useTheme } from "../theme/useTheme";

// The dot cluster, at the one place in the app that still uses it: the wordmark
// moved to `brandmark-logo.png` (the ring) in Figma v2.
const SPOTS_DOTS = require("../../assets/images/spots-logo.png");

/**
 * ONE CURVE FOR EVERY POSITION CHANGE — the touch-down glide, the mid-flight
 * redirect, the drag settle, the grab scale and the icon pulse. One easing means
 * the bar never has two personalities.
 *
 * IT MUST BE REANIMATED'S `Easing`, NOT REACT NATIVE'S. RN's is not worklet-safe,
 * and every animation here is started from a worklet on the UI thread. Getting
 * this import wrong produces a runtime error on that thread, not a silent
 * fallback to the JS driver.
 */
const EASING = Easing.out(Easing.cubic);

export type TabKey = HomeTabIconKey | "chat";

/** Material Symbols glyph per icon tab. The frame's icons come from the
 *  "Material 3 Design Kit", so `MaterialIcons` is the SAME library rather than
 *  an approximation, and a wrong name here is a compile error (the prop type is
 *  a string-literal union). `TextField` already pulls `MaterialCommunityIcons`,
 *  so this adds zero npm dependencies — but it does add a second icon FONT to
 *  the bundle, which is the price of that. */
const GLYPH: Record<
  HomeTabIconKey,
  React.ComponentProps<typeof MaterialIcons>["name"]
> = {
  home: "home",
  map: "place",
  groups: "groups",
  profile: "person",
};

const LABEL: Record<TabKey, string> = {
  home: copy.tabs.home,
  map: copy.tabs.map,
  chat: copy.tabs.chat,
  groups: copy.tabs.groups,
  profile: copy.tabs.profile,
};

interface SpotsTabBarProps {
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
  /** From `computeHomeLayout().nav` — no arithmetic here either. */
  layout: HomeNavLayout;
}

/**
 * The floating bottom nav (Figma home-screen 4:164): a 343×51 linen pill with
 * four icon tabs and an overflowing centre button.
 *
 * IT TAKES ITS OWN NARROW PROPS, NOT React Navigation's `BottomTabBarProps`.
 * The adapter is three lines in `AppStack.tsx`. That keeps the bar trivially
 * renderable in a test — no fake `state`/`descriptors`/`navigation` objects —
 * and keeps a presentational component out of navigation context.
 *
 * NOTHING IN THIS CHAIN MAY EVER SET `overflow: 'hidden'`. The centre circle
 * overflows the 51pt bar by 9pt above and the logo by 19pt. That is why the
 * centre button is a SIBLING of the pill rather than a child: in nav-root
 * coordinates the logo's top is 18 − 19 = −1, so only 1pt escapes the nav root,
 * and if Android's `clipChildren` eats that 1pt the loss is the topmost row of
 * the cluster, which is invisible. Do not "fix" this by clipping, and do not
 * "fix" it by moving the button inside the pill. `GestureDetector` does not
 * disturb this: it inserts NO view, it only clones its child with
 * `collapsable: false`.
 *
 * On Android, z-order follows `elevation`, so the circle takes
 * `theme.elevation.floating` (10) to paint above the pill's 6.
 *
 * THE BAR IS GLASS, AND THAT IS A DELIBERATE DEPARTURE FROM `4:164`, WHICH DRAWS
 * AN OPAQUE LINEN BAR. The reasoning is a measurement, not a taste call: a
 * `BlurView` blurs what is rendered behind it, and behind the active indicator is
 * the bar's own perfectly uniform fill — a Gaussian blur of a uniform colour
 * returns that colour, so blurring the indicator would be pixel-identical to a
 * translucent tint while costing a native dependency and an experimental Android
 * code path. Behind the BAR, by contrast, is the scrolling feed (the bar is
 * absolutely positioned and takes no layout space), so that is the one surface
 * where a blur has something to sample. Hence: ONE `BlurView`, hosted by the bar,
 * with the pill reading as glass because the surface it floats on is glass.
 *
 * TO REVERT TO THE FRAME'S OPAQUE BAR, delete `tab-bar-pill-fill` and put
 * `backgroundColor: theme.colors.surfaceRaised` back on `tab-bar-pill`. Nothing
 * else in this file depends on the frost.
 *
 * TWO VIEWS FOR THE PILL, AND THE SPLIT IS LOAD-BEARING — the same trap
 * `FeedCard` documents. The bar needs a radius AND `overflow: 'hidden'` (on
 * Android `BlurView` ignores `borderRadius`; clipping is the documented
 * workaround), but on iOS `overflow: 'hidden'` and a shadow on the SAME view clip
 * the shadow away. So `tab-bar-pill` owns the geometry, the radius and the shadow
 * and sets NO `overflow`, while `tab-bar-pill-fill` owns the clip and the frost.
 * The indicator and the four `Pressable`s stay children of `tab-bar-pill`, OUTSIDE
 * the clip — they are inside the bar's bounds anyway, and keeping them out means
 * nothing new can be clipped by accident.
 *
 * WHERE THE YELLOW LIVES IS PER-MODE, AND THAT IS FORCED BY PHYSICS. In DARK the
 * indicator is a neutral frost slab and the ACTIVE GLYPH carries the accent; in
 * LIGHT the indicator keeps its brand tint and every glyph stays ink. The one
 * brand yellow has a WCAG relative luminance of 0.598, which caps it at 1.62:1
 * against white and 1.33:1 against its own light-mode tint — there is no
 * light-mode surface in this design on which a yellow glyph is legible, and a
 * second yellow is not permitted. In dark the same glyph is 6.65:1 against the
 * bar and 4.35:1 against the frost slab. The precedent is `theme.brand`, whose
 * chrome is per-mode while its control ramp is not.
 *
 * ── HOW THE MOTION WORKS, AND THE TWO BUGS IT REPLACED ────────────────────────
 *
 * THERE IS EXACTLY ONE AUTHORITATIVE POSITION, AND NEITHER A RENDER NOR A
 * NAVIGATION EVENT MAY WRITE A DESTINATION INTO IT. `position` is a reanimated
 * shared value, so inside any worklet `position.value` is the pill's ACTUAL
 * current number, read synchronously, on the UI thread, mid-animation. The code
 * this replaced kept a `positionRef` set to the TARGET at the start of every
 * move and called `Animated.Value.stopAnimation()` with no callback — which
 * reads nothing back, because a native-driven value's JS-side number is never
 * written by the animation. Every gesture decision was therefore computed
 * against a point up to a bar-width from the pill, and the pill jumped to meet
 * the arithmetic. That whole class of bug is DELETED rather than fixed: there is
 * no model of the animation left to go stale, so there is nothing to keep in
 * sync with an easing curve.
 *
 * THE `activeKey` EFFECT CONFIRMS; IT NEVER TELEPORTS. The old effect compared
 * the incoming route to a POSITION, so a stale `activeKey` landing after the user
 * had already tapped again would drag the pill backwards to the superseded tab
 * and then forward again — the visible jitter on rapid taps. Intent is now held
 * in TWO copies, deliberately: `targetX` (a shared value, for gesture worklets)
 * and `targetRef` (a ref, for the effect). A shared value written on the UI
 * thread propagates back to JS asynchronously, so an effect comparing against
 * `targetX.value` could read a stale number and misclassify a confirming route
 * as an external one — the same bug through a new door. Each thread compares
 * against the copy it owns, and `setIntent`/`commit` are the only writers of
 * either.
 *
 * POINTER INPUT HAS EXACTLY ONE OWNER: one `GestureDetector` on the pill, with
 * `Gesture.Race(Pan, Tap)`. `Race` rather than `Exclusive` because the two
 * activation conditions are disjoint anyway (the Tap activates on lift within
 * `maxDistance`, the Pan at `activeOffsetX`), so they are equivalent here and
 * `Race` says "first one to activate wins" out loud. The four icon `Pressable`s
 * set `pointerEvents="none"`: gesture-handler is a NATIVE recogniser and does not
 * join RN's JS responder negotiation, so without it a still tap could fire both
 * the Tap gesture and the `Pressable`'s `onPress` and select twice.
 * `pointerEvents` is a HIT-TESTING instruction only — it removes the view from
 * touch delivery, not from the accessibility tree — so VoiceOver and TalkBack
 * still focus each tab and still activate it, through `onPress`
 * (`Pressability` routes non-pointer clicks straight there) and through the
 * explicit `onAccessibilityTap`.
 *
 * EVERY GESTURE CALLBACK IS A WORKLET, AND THAT IS THE POINT. `GestureDetector`
 * inspects its gestures: worklet callbacks run on the UI thread, plain functions
 * run on the JS thread through the RN event system. So the bar performs zero
 * re-renders during a gesture AND zero JavaScript-thread work per gesture frame.
 * That is as close as a custom-drawn bar gets to a system tab bar's "no JS in the
 * touch path". The one thing that must leave the UI thread is `onSelect`:
 * navigation is inherently a JS concern, so it goes through `runOnJS` — which is
 * ASYNCHRONOUS even when you are already on the JS thread (it defers through
 * `queueMicrotask`). `runOnJS` is imported from `react-native-reanimated`, so app
 * code has no direct `react-native-worklets` import; worklets 0.8 renames it to
 * `scheduleOnRN`, which is the migration when this project's SDK reaches it.
 *
 * REDUCE MOTION IS THE ONLY MOTION SWITCH, AND IT IS `theme/useReduceMotion`.
 * Reanimated exports its own `useReducedMotion()` and a `ReduceMotion` enum that
 * `withTiming` accepts — do not use either. They read reanimated's own platform
 * detection, which `jest.setup.ts` does not pin, so under jest they would report
 * "motion allowed", every animation would start, and the suite's exactness
 * guarantee would evaporate silently.
 */
export function SpotsTabBar({ activeKey, onSelect, layout }: SpotsTabBarProps) {
  const { theme } = useTheme();
  const { bar, icons, indicator, centre } = layout;
  const isDark = theme.mode === "dark";

  // REDUCE MOTION IS NOT OPTIONAL HERE. Beyond the accessibility contract, it is
  // what keeps this component inert under jest: `jest.setup.ts` pins it ON, and
  // an unguarded animation in that environment does not warn — it quietly
  // busy-loops for its full wall-clock duration. It also makes every asserted
  // position EXACT rather than mid-flight: with no flight there is nothing to
  // interpolate. See `theme/useReduceMotion.ts`.
  const reduceMotion = useReduceMotion();

  const defaultIndicatorLeft = icons[0]?.indicatorLeft ?? 0;

  const activeIndicatorLeft = React.useMemo(() => {
    if (activeKey === "chat") {
      return null;
    }

    const active = icons.find((icon) => icon.key === activeKey);
    return active?.indicatorLeft ?? defaultIndicatorLeft;
  }, [activeKey, defaultIndicatorLeft, icons]);

  const hasIndicator = activeIndicatorLeft != null;

  // ── The UI thread's state. Anything a worklet reads must live somewhere the UI
  //    thread can see, and a ref is not such a place.
  /** The pill's visual position, in bar coordinates. THE authoritative number. */
  const position = useSharedValue(activeIndicatorLeft ?? defaultIndicatorLeft);
  /** The indicator's "I grabbed this" scale. Never the bar, never a `Pressable`,
   *  never the centre button. */
  const scale = useSharedValue(1);
  /** The pill's INTENT, as the gesture worklets see it. */
  const targetX = useSharedValue(activeIndicatorLeft ?? defaultIndicatorLeft);
  /** This touch landed on the indicator, over the tab it already belongs to.
   *  Written once per gesture in `onBegin` and never cleared, so the Tap's `onEnd`
   *  can read it regardless of whether the Pan's `onFinalize` ran first. */
  const grab = useSharedValue(false);
  /** The Pan passed `activeOffsetX` and is (or was) tracking 1:1. Same lifetime
   *  rule as `grab`, for the same ordering reason. */
  const didActivate = useSharedValue(false);
  const dragOrigin = useSharedValue(0);
  const dragOriginTx = useSharedValue(0);

  // Four press pulses, one per glyph. Explicit rather than mapped, because hooks
  // cannot be called in a loop. They must never share a value with the
  // indicator's scale: the lifetimes are different.
  const homeScale = useSharedValue(1);
  const mapScale = useSharedValue(1);
  const groupsScale = useSharedValue(1);
  const profileScale = useSharedValue(1);
  const iconScales: Record<HomeTabIconKey, SharedValue<number>> = React.useMemo(
    () => ({
      home: homeScale,
      map: mapScale,
      groups: groupsScale,
      profile: profileScale,
    }),
    [groupsScale, homeScale, mapScale, profileScale],
  );

  // ── The JS thread's state.
  /** The pill's INTENT, as the effect sees it. Navigation CONFIRMS this; it never
   *  sets it. See the docblock on why there are two copies. */
  const targetRef = React.useRef(activeIndicatorLeft ?? defaultIndicatorLeft);
  /**
   * Route changes this component ASKED FOR and has not yet seen land, oldest
   * first.
   *
   * `targetRef` alone is not enough, and the case that proves it is the one this
   * whole change exists to kill: tap map, tap profile 80ms later, and the
   * navigator answers `map` first. `map` is not the current intent, so comparing
   * against `targetRef` would classify it as an EXTERNAL change and drag the pill
   * backwards — the exact reversal being fixed. It is not external; it is a late
   * confirmation of an intent that has since been superseded, and the only thing
   * that can tell the two apart is whether we asked for it.
   *
   * An entry is added only when `onSelect` is called with a tab the route is not
   * already on (selecting the current route changes nothing, so nothing would
   * ever confirm it), and the queue is capped at one entry per tab so a
   * navigation that is blocked and never lands cannot leak.
   */
  const pendingRef = React.useRef<number[]>([]);
  /** Whether an indicator was mounted on the previous run of the effect. */
  const hadIndicatorRef = React.useRef(hasIndicator);
  /** The bar width the pill was last positioned against, so a rotation can snap
   *  instead of gliding to coordinates that moved underneath it. */
  const barWidthRef = React.useRef(bar.width);
  /** A gesture owns the pill right now. Set from `onBegin`/`onFinalize` through
   *  `runOnJS`, and read only by the effect. */
  const gesturingRef = React.useRef(false);

  const setGesturing = React.useCallback((value: boolean) => {
    gesturingRef.current = value;
  }, []);

  const minIndicatorLeft = icons.reduce(
    (min, icon) => Math.min(min, icon.indicatorLeft),
    Number.POSITIVE_INFINITY,
  );
  const maxIndicatorLeft = icons.reduce(
    (max, icon) => Math.max(max, icon.indicatorLeft),
    Number.NEGATIVE_INFINITY,
  );
  const fullTravel = maxIndicatorLeft - minIndicatorLeft;

  const clampIndicatorLeft = React.useCallback(
    (left: number) => {
      "worklet";
      return Math.min(Math.max(left, minIndicatorLeft), maxIndicatorLeft);
    },
    [maxIndicatorLeft, minIndicatorLeft],
  );

  /** Distance-linear, 165–235ms. The rule and the reasoning live in
   *  `homeSpec.nav.motion`; the only arithmetic here is applying it. */
  const durationFor = React.useCallback(
    (travel: number) => {
      "worklet";
      return Math.round(
        navMotion.minDuration +
          navMotion.durationSpan *
            (fullTravel > 0 ? Math.min(travel / fullTravel, 1) : 0),
      );
    },
    [fullTravel],
  );

  /** Nearest tab to a POSITION (an indicator left). Used on release from a drag. */
  const nearestToPosition = React.useCallback(
    (left: number): HomeTabIconLayout => {
      "worklet";
      let nearest = icons[0];
      for (const icon of icons) {
        if (
          Math.abs(icon.indicatorLeft - left) <
          Math.abs(nearest.indicatorLeft - left)
        ) {
          nearest = icon;
        }
      }
      return nearest;
    },
    [icons],
  );

  /** Nearest tab to a bar-relative TOUCH x, measured against the icon centres —
   *  which is what "the tab you touched" means, and needs no half-width.
   *
   *  The x comes straight off the gesture event: gesture-handler reports
   *  coordinates RELATIVE TO THE VIEW THE DETECTOR IS ATTACHED TO, which is
   *  `tab-bar-pill`, which is the coordinate space every number in `layout.nav`
   *  is already in. There is no page-space rebase and no per-target
   *  `locationX`/`locationY` space to get wrong, because there is only one
   *  target. */
  const nearestToTouch = React.useCallback(
    (touchX: number): HomeTabIconLayout => {
      "worklet";
      let nearest = icons[0];
      for (const icon of icons) {
        if (
          Math.abs(icon.centreX - touchX) < Math.abs(nearest.centreX - touchX)
        ) {
          nearest = icon;
        }
      }
      return nearest;
    },
    [icons],
  );

  /**
   * A gentle pull toward the nearest resting position, applied ONLY during a 1:1
   * drag (a scrub lands on exact centres anyway). Bounded at 1.575pt of deviation
   * and never below 65% of finger speed — see `homeSpec.nav.motion`.
   */
  const magnet = React.useCallback(
    (raw: number) => {
      "worklet";
      const rest = nearestToPosition(raw).indicatorLeft;
      const offset = raw - rest;
      const distance = Math.abs(offset);

      if (distance >= navMotion.magnetRadius) {
        return raw;
      }

      return (
        raw -
        navMotion.magnetStrength *
          (1 - distance / navMotion.magnetRadius) *
          offset
      );
    },
    [nearestToPosition],
  );

  /**
   * WRITER 1: glide to a resting position.
   *
   * Assigning a new `withTiming` REPLACES whatever was running, and the new
   * animation starts from the shared value's current number — a real read, not a
   * driver-side re-base you have to trust. So a mid-flight redirect continues
   * from the pill's actual pixels for free, and the same read gives the redirect
   * its duration, in the same worklet, on the same frame.
   */
  const glideTo = React.useCallback(
    (target: number) => {
      "worklet";
      const from = position.value;

      // An unmounted indicator cannot travel — it appears at its destination.
      if (reduceMotion || !hasIndicator || from === target) {
        cancelAnimation(position);
        position.value = target;
        return;
      }

      position.value = withTiming(target, {
        duration: durationFor(Math.abs(target - from)),
        easing: EASING,
      });
    },
    [durationFor, hasIndicator, position, reduceMotion],
  );

  /** WRITER 2: the 1:1 drag, and any move that must not be seen to travel. A bare
   *  assignment replaces a running animation, so this needs no explicit stop —
   *  `cancelAnimation` is called ONCE per drag, at activation, to state the
   *  intent rather than to do work. Do not scatter it per frame. */
  const jumpTo = React.useCallback(
    (value: number) => {
      "worklet";
      position.value = value;
    },
    [position],
  );

  const scaleTo = React.useCallback(
    (to: number, duration: number) => {
      "worklet";
      if (reduceMotion) {
        scale.value = 1;
        return;
      }

      scale.value = withTiming(to, { duration, easing: EASING });
    },
    [reduceMotion, scale],
  );

  /** 1 → 0.94 → 1 on the touched glyph. It is the only feedback there is for
   *  "tap the tab you are already on", which otherwise does nothing at all. */
  const pulse = React.useCallback(
    (key: HomeTabIconKey) => {
      "worklet";
      const value = iconScales[key];

      if (reduceMotion) {
        value.value = 1;
        return;
      }

      value.value = withSequence(
        withTiming(navMotion.pulseScale, {
          duration: navMotion.pulseHalfDuration,
          easing: EASING,
        }),
        withTiming(1, {
          duration: navMotion.pulseHalfDuration,
          easing: EASING,
        }),
      );
    },
    [iconScales, reduceMotion],
  );

  /** THE ONLY WRITER OF EITHER COPY OF THE INTENT, on the JS thread. Writing a
   *  shared value from JS is synchronous on this side and propagates to the UI
   *  thread on the next flush, which is soon enough: a gesture cannot be
   *  mid-decision at the moment a React effect runs. */
  const setIntent = React.useCallback(
    (value: number) => {
      targetRef.current = value;
      targetX.value = value;
    },
    [targetX],
  );

  /**
   * Report the choice. Reached from a gesture worklet through `runOnJS`, and
   * directly from the icons' accessibility activation.
   *
   * Intent is written BEFORE `onSelect`, and the guarantee is that they are the
   * same function — there is no ordering for anyone to get wrong later.
   */
  const commit = React.useCallback(
    (key: HomeTabIconKey, indicatorLeft: number) => {
      setIntent(indicatorLeft);

      if (indicatorLeft !== activeIndicatorLeft) {
        // A route change we expect to see confirmed later — see `pendingRef`.
        // Selecting the tab the app is already on changes no route, so it must
        // not be queued: nothing would ever arrive to clear it.
        pendingRef.current = [
          ...pendingRef.current.filter((left) => left !== indicatorLeft),
          indicatorLeft,
        ];
      }

      onSelect(key);
    },
    [activeIndicatorLeft, onSelect, setIntent],
  );

  /** THE ACCESSIBILITY ACTIVATION PATH, not the pointer path — the icons are
   *  `pointerEvents="none"`, so a finger never reaches this. It therefore has to
   *  do the whole job: point at the tab, glide, and report. (Worklets are
   *  ordinary functions when called from the JS thread.) */
  const activate = React.useCallback(
    (icon: HomeTabIconLayout) => {
      pulse(icon.key);
      setIntent(icon.indicatorLeft);
      glideTo(icon.indicatorLeft);
      commit(icon.key, icon.indicatorLeft);
    },
    [commit, glideTo, pulse, setIntent],
  );

  /**
   * NAVIGATION CONFIRMS THE PILL'S INTENT; IT DOES NOT DIRECT IT.
   *
   * No position is read here, ever. A stale `activeKey` arriving after the user
   * has already chosen again matches `pendingRef` and is consumed, because
   * `targetRef` already holds the newer choice — which is the fix for the
   * backwards jerk on rapid taps.
   */
  React.useEffect(() => {
    if (activeIndicatorLeft == null) {
      // The centre button is active: there is no indicator mounted. Remember
      // that, so the next one to mount APPEARS at its tab rather than sliding in
      // from wherever the pill happened to be.
      hadIndicatorRef.current = false;
      return;
    }

    if (!hadIndicatorRef.current) {
      hadIndicatorRef.current = true;
      barWidthRef.current = bar.width;
      setIntent(activeIndicatorLeft);
      jumpTo(activeIndicatorLeft);
      return;
    }

    if (barWidthRef.current !== bar.width) {
      // A rotation is not a navigation. The geometry moved under the pill, so
      // gliding would be motion the user never asked for.
      barWidthRef.current = bar.width;
      setIntent(activeIndicatorLeft);
      jumpTo(activeIndicatorLeft);
      return;
    }

    if (targetRef.current === activeIndicatorLeft) {
      // THE COMMON CASE: this is the route catching up with a choice the pill
      // already acted on. Nothing to do.
      pendingRef.current = [];
      return;
    }

    const confirmed = pendingRef.current.indexOf(activeIndicatorLeft);

    if (confirmed >= 0) {
      // A SUPERSEDED choice landing late. It confirms something the user has
      // already moved on from, so it is consumed, not obeyed.
      pendingRef.current.splice(0, confirmed + 1);
      return;
    }

    // A genuinely external change — a deep link, or a programmatic `navigate`.
    // It glides, exactly like a tap.
    pendingRef.current = [];
    setIntent(activeIndicatorLeft);

    if (gesturingRef.current) {
      // The finger owns the pill. Record the intent and leave the motion alone;
      // the release reconciles. Gliding here would pull the pill out from under
      // the finger.
      return;
    }

    glideTo(activeIndicatorLeft);
  }, [activeIndicatorLeft, bar.width, glideTo, jumpTo, setIntent]);

  /**
   * TWO INTERACTION MODES, AND THE BRANCH IS ONE PREDICATE EVALUATED ONCE, AT
   * TOUCH-DOWN.
   *
   * GRAB — the touch landed inside the indicator's CURRENT box (X only) and the
   * nearest tab centre is the tab the pill already belongs to. It tracks the
   * finger 1:1 once `activeOffsetX` lets the Pan activate.
   *
   * SCRUB — anything else. It re-glides tab to tab as the finger crosses
   * boundaries, with the same easing and duration rule as a tap. It deliberately
   * does NOT track 1:1: that would jump the pill up to half a pitch on the first
   * move.
   *
   * `activeOffsetX` is "a tap on the indicator must never accidentally become a
   * drag", expressed as a native activation criterion rather than as hand-written
   * arithmetic in a move handler. The threshold is unchanged at
   * `navMotion.dragThreshold`.
   *
   * `e.x` is the touch's current position in the pill's own coordinates;
   * `e.translationX` is the accumulated delta since the gesture began. `x`
   * answers "which tab is under the finger", `translationX` drives the 1:1 drag.
   * Do not mix them.
   *
   * `onSelect` fires on RELEASE, never on touch-down. The INDICATOR is immediate;
   * navigation is not. Firing on touch-down would make an accidental brush
   * navigate and would destroy slide-to-choose.
   */
  const gesture = React.useMemo(() => {
    const pan = Gesture.Pan()
      // A GESTURE test id, not a view `testID`: it registers in
      // gesture-handler's handler registry for `getByGestureTestId`, and adds
      // nothing to the rendered tree.
      .withTestId("tab-bar-gesture")
      .activeOffsetX([-navMotion.dragThreshold, navMotion.dragThreshold])
      .onBegin((event) => {
        "worklet";
        didActivate.value = false;
        runOnJS(setGesturing)(true);

        const nearest = nearestToTouch(event.x);
        const isGrab =
          hasIndicator &&
          event.x >= position.value &&
          event.x <= position.value + indicator.width &&
          nearest.indicatorLeft === targetX.value;

        grab.value = isGrab;

        if (isGrab) {
          // The pill does not move: the finger is already on it. The scale is
          // the whole feedback, and it is also the only response to tapping the
          // tab you are already on from inside the indicator.
          scaleTo(navMotion.grabScale, navMotion.grabInDuration);
          return;
        }

        // A SCRUB moves the indicator immediately, ON THE TOUCH — long before
        // `onSelect` fires on release and long before navigation answers.
        pulse(nearest.key);

        if (nearest.indicatorLeft !== targetX.value) {
          targetX.value = nearest.indicatorLeft;
          glideTo(nearest.indicatorLeft);
        }
      })
      .onStart((event) => {
        "worklet";
        didActivate.value = true;

        if (!grab.value) {
          return;
        }

        cancelAnimation(position);
        dragOrigin.value = position.value;
        // Re-based at activation, so the pill does not lurch by the threshold on
        // the first tracked frame.
        dragOriginTx.value = event.translationX;
      })
      .onUpdate((event) => {
        "worklet";
        if (grab.value) {
          const raw =
            dragOrigin.value + (event.translationX - dragOriginTx.value);
          jumpTo(clampIndicatorLeft(magnet(raw)));
          return;
        }

        const nearest = nearestToTouch(event.x);

        if (nearest.indicatorLeft === targetX.value) {
          return;
        }

        targetX.value = nearest.indicatorLeft;
        glideTo(nearest.indicatorLeft);
        pulse(nearest.key);
      })
      .onEnd((event, success) => {
        "worklet";
        if (!success) {
          return;
        }

        scaleTo(1, navMotion.grabOutDuration);

        // NEAREST ALWAYS WINS — from where the pill actually is after a drag,
        // from where the finger is after a scrub. A release outside the bar has
        // already been pinned to an end tab by the clamp.
        const nearest = grab.value
          ? nearestToPosition(position.value)
          : nearestToTouch(event.x);

        targetX.value = nearest.indicatorLeft;
        glideTo(nearest.indicatorLeft);
        runOnJS(commit)(nearest.key, nearest.indicatorLeft);
      })
      .onFinalize((_event, success) => {
        "worklet";
        runOnJS(setGesturing)(false);

        // A Pan that never activated finalises with `success === false` too —
        // that is every plain tap, where the Tap won the race. Without the
        // `didActivate` check, every tap would also run the spring-back branch
        // and fight the Tap's commit.
        if (success || !didActivate.value) {
          return;
        }

        // A system gesture won an ACTIVE pan. Go back to the live route and
        // select NOTHING: the user never completed a choice.
        if (grab.value) {
          scaleTo(1, navMotion.grabOutDuration);
        }

        if (activeIndicatorLeft != null) {
          targetX.value = activeIndicatorLeft;
          glideTo(activeIndicatorLeft);
        }
      });

    const tap = Gesture.Tap()
      .withTestId("tab-bar-tap")
      .maxDistance(navMotion.dragThreshold)
      .onEnd((event, success) => {
        "worklet";
        // THE TAP EXISTS TO TELL A COMPLETED TAP FROM A CANCELLED GESTURE. A Pan
        // that never activates reaches only `onFinalize`, with `success ===
        // false` — indistinguishable from the system stealing the touch. This is
        // the positive signal.
        if (!success) {
          return;
        }

        scaleTo(1, navMotion.grabOutDuration);

        // A tap that started on the indicator re-selects the pill's own tab,
        // whatever the 75pt slab's far edge happens to be nearest to.
        const nearest = grab.value
          ? nearestToPosition(position.value)
          : nearestToTouch(event.x);

        targetX.value = nearest.indicatorLeft;
        glideTo(nearest.indicatorLeft);
        runOnJS(commit)(nearest.key, nearest.indicatorLeft);
      });

    return Gesture.Race(pan, tap);
  }, [
    activeIndicatorLeft,
    clampIndicatorLeft,
    commit,
    didActivate,
    dragOrigin,
    dragOriginTx,
    glideTo,
    grab,
    hasIndicator,
    indicator.width,
    jumpTo,
    magnet,
    nearestToPosition,
    nearestToTouch,
    position,
    pulse,
    scaleTo,
    setGesturing,
    targetX,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    // `left: 0` with the WHOLE bar-relative offset in the transform. That is what
    // lets a tap glide: `left` would jump when `activeKey` changes, whereas a
    // timing on `translateX` slides.
    transform: [{ translateX: position.value }, { scale: scale.value }],
  }));

  const homeGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: homeScale.value }],
  }));
  const mapGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mapScale.value }],
  }));
  const groupsGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: groupsScale.value }],
  }));
  const profileGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: profileScale.value }],
  }));
  const glyphStyles: Record<HomeTabIconKey, typeof homeGlyphStyle> = {
    home: homeGlyphStyle,
    map: mapGlyphStyle,
    groups: groupsGlyphStyle,
    profile: profileGlyphStyle,
  };

  return (
    <View
      testID="tab-bar"
      pointerEvents="box-none"
      style={[styles.overlay, { height: layout.totalHeight }]}
    >
      <GestureDetector gesture={gesture}>
        <View
          testID="tab-bar-pill"
          style={[
            styles.absolute,
            {
              left: bar.left,
              top: bar.top,
              width: bar.width,
              height: bar.height,
              borderRadius: theme.radius.pill,
            },
            // The shadow lives HERE, with no `overflow` — see the docblock.
            theme.elevation.card,
          ]}
        >
          <View
            testID="tab-bar-pill-fill"
            pointerEvents="none"
            style={[
              styles.absoluteFillCentred,
              styles.clip,
              { borderRadius: theme.radius.pill },
            ]}
          >
            <BlurView
              // `intensity` 40 is a PICK: enough to read as frost without smearing
              // the cards underneath into mud. Tuned on a device, not here.
              intensity={40}
              tint={isDark ? "dark" : "light"}
              // Android blur is OFF unless this is set, and Expo documents the
              // whole path as experimental ("may cause performance and graphical
              // issues"). THE FALLBACK IS ONE LINE, not a rewrite: make this
              // `Platform.OS === 'android' ? undefined : 'dimezisBlurView'`, which
              // degrades the bar to its opaque linen on Android and keeps the glass
              // on iOS.
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View
              testID="tab-bar-tint"
              // The linen (light) / lifted night (dark) identity, kept over the
              // frost. Alpha B8 is 0.72 — a pick, and the one number in the glass
              // treatment that genuinely needs a device to settle.
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `${theme.colors.surfaceRaised}B8` },
              ]}
            />
          </View>

          {activeIndicatorLeft != null ? (
            <Animated.View
              testID="tab-indicator"
              accessible={false}
              pointerEvents="none"
              style={[
                styles.absolute,
                styles.clip, // the same Android borderRadius caveat as the bar
                {
                  left: 0,
                  top: indicator.top,
                  width: indicator.width,
                  height: indicator.height,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  // B3 is 0.70 — NOT a new number: it is the alpha the border
                  // already used. Only the colour token changed, from
                  // `colors.surface` (white in light, invisible in dark) to a
                  // mode-invariant specular white.
                  borderColor: `${theme.glass.edge}B3`,
                  // A CONSTANT, not a state-driven value: the drag's old 0.9 → 0.95
                  // nudge is gone with the state that drove it. The "I grabbed
                  // this" signal is the scale.
                  opacity: 0.9,
                },
                indicatorStyle,
              ]}
            >
              <View
                testID="tab-indicator-tint"
                // PER-MODE, AND THE REASON IS MEASURED, NOT AESTHETIC — see the
                // docblock. In LIGHT this is the shipped brand tint at alpha 4D
                // (0.30 × 255): Figma drew 0.40, and the glass edge plus the inner
                // highlight now carry the definition that extra yellow used to.
                // In DARK it is a NEUTRAL FROST — specular white at alpha 26
                // (0.15 × 255) — because dark is the only mode where the accent
                // can move to the glyph, and a yellow slab under a yellow glyph
                // would be 1.33:1. The frost measures 4.35:1 under the accent
                // glyph and has room to about 0.20 before that drops under 3:1.
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: isDark
                      ? `${theme.glass.highlight}26`
                      : `${theme.brand.primary}4D`,
                  },
                ]}
              />
              <View
                testID="tab-indicator-highlight"
                // The lit top edge of a glass slab. A PERCENTAGE height on purpose:
                // this component does no arithmetic, and 45% of the pill is a
                // proportion rather than a Figma measurement.
                style={[
                  styles.highlight,
                  {
                    backgroundColor: `${theme.glass.highlight}40`,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              />
            </Animated.View>
          ) : null}

          {icons.map((icon) => {
            const selected = activeKey === icon.key;
            return (
              <Pressable
                key={icon.key}
                testID={`tab-${icon.key}`}
                // POINTER EVENTS OFF, ACCESSIBILITY ON. gesture-handler is a
                // native recogniser and does not join RN's responder
                // negotiation, so without this a still tap could fire both the
                // Tap gesture and this `onPress` and select twice. It is a
                // hit-testing instruction only: the element stays in the
                // accessibility tree, stays focusable, and is activated by an
                // accessibility ACTION rather than a synthetic touch.
                pointerEvents="none"
                onPress={() => activate(icon)}
                // Belt and braces for iOS VoiceOver, which delivers a dedicated
                // accessibility tap; Android's TalkBack comes through `onPress`
                // via `Pressability`'s click path.
                onAccessibilityTap={() => activate(icon)}
                accessibilityRole="tab"
                accessibilityLabel={LABEL[icon.key]}
                accessibilityState={{ selected }}
                // 52 wide × the bar's 51 tall, centred on the icon centre: the
                // glyphs are only 32–34, which would miss the 44pt iOS / 48dp
                // Android minimum on its own.
                style={[
                  styles.absolute,
                  styles.centred,
                  {
                    left: icon.left,
                    top: 0,
                    width: icon.width,
                    height: bar.height,
                  },
                ]}
              >
                {/* An intrinsically-sized wrapper with no accessibility props,
                    inside an already-`accessible` Pressable: the a11y tree and
                    the layout are both unchanged, and the glyph gets its own
                    animated scale that never shares a lifetime with the
                    indicator's. */}
                <Animated.View style={glyphStyles[icon.key]}>
                  <MaterialIcons
                    name={GLYPH[icon.key]}
                    size={icon.iconSize}
                    // THE ACTIVE GLYPH CARRIES THE ACCENT IN DARK MODE ONLY.
                    // 6.65:1 on the bar, 4.35:1 on its own frost slab. In light
                    // the same accent would be 1.62:1 at best, so light keeps
                    // the pill as the selection signal and every glyph stays
                    // ink. There is no second yellow to reach for.
                    color={
                      isDark && selected
                        ? theme.colors.accent
                        : theme.colors.text
                    }
                  />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>

      {/* Painted AFTER the pill so it wins on iOS too, where z-order is tree
          order rather than elevation. A SIBLING of the pill and OUTSIDE the
          `GestureDetector`, so it keeps its own pointer events and the bar's
          gesture never swallows it. IT GETS NO PRESS FEEDBACK, deliberately:
          it is a Pressable with two absolutely-positioned children whose
          arrangement is load-bearing, and scaling a view that owns an Android
          `elevation` changes how its shadow renders. */}
      <Pressable
        testID="tab-chat"
        onPress={() => onSelect("chat")}
        accessibilityRole="tab"
        accessibilityLabel={LABEL.chat}
        accessibilityState={{ selected: activeKey === "chat" }}
        style={[
          styles.absolute,
          styles.centred,
          {
            left: bar.left + centre.circle.left,
            top: bar.top + centre.circle.top,
            width: centre.circle.size,
            height: centre.circle.size,
          },
        ]}
      >
        <View
          testID="tab-chat-circle"
          style={[
            styles.absoluteFillCentred,
            {
              borderRadius: theme.radius.pill,
              // The SAME linen as the bar and the cards. The exported ellipse
              // (10:6) is `<circle fill=linen50>`, NOT white — measured from
              // the SVG, not assumed. It separates from the bar by its shadow
              // (1.04:1 on fill alone), not by its colour.
              backgroundColor: theme.colors.surfaceRaised,
            },
            theme.elevation.floating,
          ]}
        />
        <Image
          testID="tab-chat-logo"
          source={SPOTS_DOTS}
          accessible={false}
          resizeMode="contain"
          style={{
            position: "absolute",
            // Bar-relative in the layout; re-based onto the button, which is
            // itself positioned at the circle's origin.
            left: centre.logo.left - centre.circle.left,
            top: centre.logo.top - centre.circle.top,
            width: centre.logo.width,
            height: centre.logo.height,
          }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  absolute: { position: "absolute" },import React from "react";
import { Platform, useColorScheme } from "react-native";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";

// ============================================================================
// CHANGE ONLY THESE IMPORT PATHS IF YOUR SCREENS LIVE SOMEWHERE ELSE
// ============================================================================

import HomeScreen from "../screens/HomeScreen";
import MapScreen from "../screens/MapScreen";
import ChatScreen from "../screens/ChatScreen";
import GroupsScreen from "../screens/GroupsScreen";
import ProfileScreen from "../screens/ProfileScreen";

// Existing Spots logo asset.
// This is used as the middle Chat tab icon.
const SPOTS_LOGO = require("../../assets/images/spots-logo.png");

// ============================================================================
// COLORS
// ============================================================================

const SPOTS_YELLOW = "#FFC203";

const LIGHT_BACKGROUND = "#F8FAFC";
const DARK_BACKGROUND = "#111111";

const LIGHT_INACTIVE = "#7A7A7A";
const DARK_INACTIVE = "#9A9A9A";

const LIGHT_INDICATOR = "rgba(255, 194, 3, 0.16)";
const DARK_INDICATOR = "rgba(255, 194, 3, 0.20)";

const RIPPLE = "rgba(255, 194, 3, 0.14)";

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

export type SpotsTabParamList = {
  Home: undefined;
  Map: undefined;
  Chat: undefined;
  Groups: undefined;
  Profile: undefined;
};

const Tab = createNativeBottomTabNavigator<SpotsTabParamList>();

// ============================================================================
// TAB NAVIGATOR
// ============================================================================

export default function SpotsTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={{
        // -------------------------------------------------------------------
        // HEADER
        // -------------------------------------------------------------------

        headerShown: false,

        // -------------------------------------------------------------------
        // ACTIVE / INACTIVE COLORS
        // -------------------------------------------------------------------

        // Active tab:
        // Spots yellow everywhere.
        tabBarActiveTintColor: SPOTS_YELLOW,

        // Android supports explicit inactive tinting.
        tabBarInactiveTintColor: isDark
          ? DARK_INACTIVE
          : LIGHT_INACTIVE,

        // -------------------------------------------------------------------
        // ANDROID ACTIVE INDICATOR
        // -------------------------------------------------------------------

        // This is the native Material active-tab pill.
        // Android animates this itself.
        tabBarActiveIndicatorEnabled: true,

        tabBarActiveIndicatorColor: isDark
          ? DARK_INDICATOR
          : LIGHT_INDICATOR,

        tabBarRippleColor: RIPPLE,

        // -------------------------------------------------------------------
        // LABEL
        // -------------------------------------------------------------------

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },

        // Android: always show labels.
        tabBarLabelVisibilityMode: "labeled",

        // -------------------------------------------------------------------
        // NATIVE GLASS / BACKGROUND
        // -------------------------------------------------------------------

        // iOS <= 18 gets the native system material.
        // iOS 26+ automatically uses Liquid Glass.
        tabBarBlurEffect: isDark
          ? "systemChromeMaterialDark"
          : "systemChromeMaterialLight",

        tabBarStyle: {
          backgroundColor: isDark
            ? DARK_BACKGROUND
            : LIGHT_BACKGROUND,
        },
      }}
    >
      {/* ================================================================== */}
      {/* HOME                                                               */}
      {/* ================================================================== */}

      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Home",

          tabBarIcon: Platform.select({
            ios: {
              type: "sfSymbol",
              name: "house.fill",
            },

            android: {
              type: "materialSymbol",
              name: "home",
            },
          }),
        }}
      />

      {/* ================================================================== */}
      {/* MAP                                                                */}
      {/* ================================================================== */}

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: "Map",

          tabBarIcon: Platform.select({
            ios: {
              type: "sfSymbol",
              name: "mappin.and.ellipse",
            },

            android: {
              type: "materialSymbol",
              name: "place",
            },
          }),
        }}
      />

      {/* ================================================================== */}
      {/* CHAT / SPOTS                                                       */}
      {/* ================================================================== */}

      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Chat",

          // Use your actual Spots asset instead of a generic chat icon.
          //
          // tinted:true means the native tab system controls the icon color:
          // inactive -> muted
          // active   -> Spots yellow
          //
          // This makes it behave like the other native tab icons.
          tabBarIcon: {
            type: "image",
            source: SPOTS_LOGO,
            tinted: true,
          },
        }}
      />

      {/* ================================================================== */}
      {/* GROUPS                                                             */}
      {/* ================================================================== */}

      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: "Groups",

          tabBarIcon: Platform.select({
            ios: {
              type: "sfSymbol",
              name: "person.3.fill",
            },

            android: {
              type: "materialSymbol",
              name: "groups",
            },
          }),
        }}
      />

      {/* ================================================================== */}
      {/* PROFILE                                                            */}
      {/* ================================================================== */}

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",

          tabBarIcon: Platform.select({
            ios: {
              type: "sfSymbol",
              name: "person.fill",
            },

            android: {
              type: "materialSymbol",
              name: "person",
            },
          }),
        }}
      />
    </Tab.Navigator>
  );
}
  centred: { alignItems: "center", justifyContent: "center" },
  // On the FILL and the INDICATOR only, never on a shadow owner.
  clip: { overflow: "hidden" },
  highlight: { position: "absolute", left: 1, right: 1, top: 1, height: "45%" },
  absoluteFillCentred: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
});
