import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { SpottyBackground } from './SpottyBackground';
import { useTheme } from '../theme/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Decorative brand backdrop. Defaults to `'none'`. Opt-IN, deliberately: the
   *  screens that must not have it should get that by default, rather than by
   *  everyone remembering to leave it off. */
  backdrop?: 'none' | 'spots';
}

/**
 * Themed safe-area container shared by every screen.
 *
 * The gutter is `spacing.gutter` (30), straight from the onboarding frame's
 * side margin: a user taps a button inset 30pt from the edge on Landing and
 * lands on Login, and at 24 the column would visibly jump 6pt.
 *
 * `paddingTop` 16 is derived, not picked: the onboarding wordmark sits 65pt
 * from the PHYSICAL top edge, and this content sits inside a `SafeAreaView`, so
 * on a notched phone (`insets.top` ≈ 47–59) the remaining offset is 6–18pt. On
 * a non-notched device it under-shoots (36 vs 65) — degrade gracefully, not
 * identically, per the house rule.
 *
 * `backgroundColor` is `theme.brand.canvas`, which is per-mode as of the
 * dark-mode change. It is painted on the OUTER View rather than the
 * `SafeAreaView` so the backdrop layer has something full-bleed to sit on; the
 * rendered result for `backdrop="none"` is identical either way.
 *
 * BACKDROP PLACEMENT IS LOAD-BEARING — see `Screen.test.tsx`, which asserts it:
 *
 * - OUTSIDE `SafeAreaView`, so spots bleed under the status bar and home
 *   indicator instead of stopping at an invisible line ~47pt down. Inside it,
 *   the safe-area padding would inset the layer, because Yoga positions
 *   absolute children against the PADDING box.
 * - OUTSIDE `KeyboardAvoidingView`, so it does NOT slide up when the keyboard
 *   opens. These are form screens; a backdrop that jumps several hundred points
 *   on focus is far worse than no backdrop. Do not "tidy" it into the content
 *   tree.
 */
export function Screen({ children, style, backdrop = 'none' }: ScreenProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.flex, { backgroundColor: theme.brand.canvas }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {backdrop === 'spots' ? <SpottyBackground /> : null}
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.content,
              {
                paddingHorizontal: theme.spacing.gutter,
                paddingTop: theme.spacing.md,
                // Stops forms ending flush against the bottom edge, which reads
                // as unfinished on the new canvas.
                paddingBottom: theme.spacing.lg,
              },
              style,
            ]}
          >
            {children}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1 },
});
