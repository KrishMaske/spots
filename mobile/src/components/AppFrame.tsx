import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { onboardingSpec } from '../theme/onboarding';
import { useTheme } from '../theme/useTheme';

interface AppFrameProps {
  children: React.ReactNode;
}

/**
 * The signed-in shell: the brand canvas, the 32pt frame radius and Figma's 1px
 * hairline, wrapped around the tab navigator.
 *
 * THE HAIRLINE IS AN ABSOLUTELY-POSITIONED OVERLAY, NEVER A `borderWidth` — the
 * same rule `LandingScreen` documents. Yoga is border-box, so a real border
 * would shrink the content box by 2pt in each axis while the layout is computed
 * from the full window, pushing every Figma coordinate 1px down and right.
 * Figma's stroke is an INSIDE stroke: it paints over content and takes no space.
 *
 * MOUNTED IN EXACTLY ONE PLACE: `navigation/AppStack.tsx`, wrapping the tab
 * navigator. It was written but never mounted until 2026-08-17 — a component with
 * no consumer and no test is invisible in a green suite — which is why
 * `navigation/__tests__/signedInShell.test.tsx` now asserts the mount itself
 * rather than asserting this component in isolation.
 *
 * It guarantees the signed-in shell has AT LEAST ONE `StatusBar`, which matters
 * because `HomeScreen` does not render `Screen` and would otherwise inherit
 * whatever the auth stack last set (`expo-status-bar` sets the style
 * imperatively on mount and does NOT revert on unmount — in dark mode that means
 * light glyphs on Home). It is NOT the app stack's *single* `StatusBar`, which an
 * earlier version of this comment claimed: `Screen.tsx` renders one too, so
 * whenever a placeholder tab is focused there are two mounted. They compute the
 * same per-mode value, so the result is correct; the "exactly one" mental model
 * was simply wrong, and the shell test asserts the property that actually
 * matters — that EVERY `StatusBar` in the tree carries the per-mode style.
 *
 * The 8-line frame pattern now exists twice (here and inline in
 * `LandingScreen`). That duplication is deliberate for now: extracting a shared
 * `BrandFrame` would restructure `LandingScreen`'s tree in the same change that
 * edits the project's tripwire test. See the plan's O-8.
 */
export function AppFrame({ children }: AppFrameProps) {
  const { theme } = useTheme();

  return (
    <View testID="app-frame-root" style={[styles.root, { backgroundColor: theme.brand.canvas }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <View
        testID="app-frame"
        style={[
          styles.frame,
          { backgroundColor: theme.brand.canvas, borderRadius: theme.radius.xxl },
        ]}
      >
        {children}
        <View
          testID="app-frame-stroke"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: theme.radius.xxl,
              borderWidth: onboardingSpec.frame.borderWidth,
              borderColor: theme.brand.hairline,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The outer fill means the frame's rounded corners never reveal black.
  root: { flex: 1 },
  // `overflow: 'hidden'` so the 32pt radius actually clips, exactly as on
  // Landing. This is NOT the clip the tab bar's centre button has to survive:
  // that button overflows its own nav root by 1pt at y ≈ 717, deep inside the
  // frame. The rule "nothing in the NAV chain may clip" still stands, and this
  // view is not in it.
  frame: { flex: 1, overflow: 'hidden' },
});
