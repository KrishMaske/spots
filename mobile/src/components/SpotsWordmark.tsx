import React from 'react';
import { Image, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { onboardingSpec } from '../theme/onboarding';
// The only Layer-1 (`theme/tokens`) import in a component, and deliberately so:
// it derives a module-scope CONSTANT below, it is not a style read. Styles here
// still come from `useTheme()`. Don't "fix" this into a theme lookup — the
// constant has to be usable outside a component (it is a default prop value).
import { typography } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// Figma v2 (2026-08-17): the wordmark's "o" is the dot RING (`brandmark-logo`,
// 92×123), not the 69×68 dot cluster in `spots-logo.png`. The swap is made once,
// for every consumer — Landing at scale 1, `AuthHeader` at 0.425 on five auth
// screens, and `HomeScreen` at 0.25 — because the frame that DEFINES the
// wordmark changed its "o", and a wordmark whose "o" differs by screen is two
// wordmarks. See docs/plans/home-screen-and-onboarding-v2.md §3 / O-1.
//
// Side effect worth knowing: `spots-logo.png` is no longer reachable from here,
// so replacing that file cannot regress the wordmark. Its only consumer is now
// the Home nav's centre button.
const SPOTS_BRANDMARK = require('../../assets/images/brandmark-logo.png');

/**
 * Header scale for the auth stack. DERIVED, not eyeballed: the wordmark renders
 * at the same size as the `title` type it sits above (24 / 96 = 0.25), which is
 * also exactly the size the retired `BrandMark variant="small"` rendered
 * "Spots" at — so the header's optical weight does not move, only its fidelity
 * improves.
 *
 * 0.25 is an exact binary fraction, so every derived value stays clean:
 * box 97×44.5, brandmark 23×30.75, gap 14.4, nudge 1.875.
 */
export const WORDMARK_HEADER_SCALE = typography.title.fontSize / onboardingSpec.wordmark.fontSize;

interface SpotsWordmarkProps {
  /** 1 = the 390-wide Figma reference. See `computeOnboardingLayout`. */
  scale?: number;
  /** Positioning supplied by the screen; the box size is owned here. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The Spots wordmark: `sp` + a rigid gap + `ts`, with the dot ring set into the
 * gap as the "o".
 *
 * Figma's source is the literal string `sp  ts` (two spaces) with the mark
 * positioned over the whitespace. Shipping that would make the gap an
 * invisible, font-version-dependent artifact, so the gap is an explicit slot
 * whose width equals the advance of those two spaces
 * (`onboardingSpec.wordmark.gapWidth`) — mathematically the same layout, minus
 * the whitespace dependency.
 *
 * The mark (92pt in v2, was 69) is deliberately WIDER than the slot (57.6pt)
 * and overhangs the `p` and the `t`, exactly as in Figma — by 17.2pt a side now
 * rather than 5.7. Do not widen the slot to "contain" it; that would push the
 * letters apart. `gapWidth` is UNCHANGED at 57.6 because it is a font metric
 * (two space advances at 96px), not a property of the mark.
 *
 * Centring the mark on the slot rather than at Figma's absolute x = 163 keeps
 * the composition self-correcting if rendered font metrics drift a hair from
 * Figma's. The derived gap centre is 207.44 against Figma's mark centre of 209,
 * i.e. 1.56pt left — inside the ±2px acceptance. If a device overlay disagrees,
 * add a `dotHorizontalNudge` constant; do NOT switch to absolute positioning.
 */
export function SpotsWordmark({ scale = 1, style }: SpotsWordmarkProps) {
  const { theme } = useTheme();
  const { wordmark } = onboardingSpec;

  const gapWidth = wordmark.gapWidth * scale;
  const dotWidth = wordmark.dotWidth * scale;
  const dotHeight = wordmark.dotHeight * scale;

  const textStyle = [
    styles.glyphs,
    {
      // `onCanvas`, NOT `onPrimary`. The glyphs sit on the page, not on the
      // yellow. Both resolve to the same black in light mode, which made
      // `onPrimary` look right here for the whole brand rollout — it was
      // correct by coincidence. On the dark canvas a black wordmark is 1.11:1,
      // i.e. invisible.
      color: theme.brand.onCanvas,
      fontFamily: theme.typography.wordmark.fontFamily,
      fontSize: wordmark.fontSize * scale,
    },
  ];

  return (
    <View
      testID="onboarding-wordmark"
      accessibilityRole="header"
      accessibilityLabel="Spots"
      style={[
        styles.box,
        { width: wordmark.boxWidth * scale, height: wordmark.boxHeight * scale },
        style,
      ]}
    >
      <View style={styles.row}>
        <Text
          testID="onboarding-wordmark-sp"
          accessible={false}
          // Display type transcribed from a fixed design: `gapWidth`, the
          // brandmark and the 388×178 box do not scale with the OS text
          // setting, so letting the glyphs scale would overflow the box and
          // slide the mark out of the letter gap. Scoped to the wordmark — the rest of the
          // app still honours the setting.
          allowFontScaling={false}
          style={textStyle}
        >
          sp
        </Text>
        <View
          testID="onboarding-wordmark-gap"
          style={{ width: gapWidth, height: dotHeight, overflow: 'visible' }}
        >
          <Image
            testID="onboarding-logo"
            source={SPOTS_BRANDMARK}
            accessible={false}
            // `cover`, transcribing Figma v2's `object-cover`. The old
            // `stretch` was justified by a SQUARE source in a 69×68 box; the
            // ring's source is 1512×2016 (aspect 0.7500) in a 92×123 box
            // (0.7480), a 0.27% mismatch, so `cover` crops ≈ 0.12pt a side and
            // keeps the circle circular.
            //
            // Figma also puts `borderRadius: 52.5` on this image. It is a
            // fill-mask artifact on an alpha-transparent PNG: RN clamps the
            // radius to half the smaller dimension (46 of 92), and rounding a
            // transparent ring's corners can only clip the ring's outermost
            // dots. Deliberately NOT shipped — do not "fix" it back in.
            resizeMode="cover"
            style={{
              position: 'absolute',
              left: (gapWidth - dotWidth) / 2, // negative: the mark overhangs both sides
              top: wordmark.dotVerticalNudge * scale,
              width: dotWidth,
              height: dotHeight,
            }}
          />
        </View>
        <Text testID="onboarding-wordmark-ts" accessible={false} allowFontScaling={false} style={textStyle}>
          ts
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The slot's top lands at (boxHeight - dotHeight)/2 because the row is
  // centred in the box and the slot is centred in the row — which is what makes
  // `dotVerticalNudge` independent of the font's line metrics.
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  glyphs: {
    // `fontWeight` is intentionally not set: the 900 weight comes from the
    // registered face, and pairing the two can trigger synthetic weighting on
    // iOS. Android's default font padding would also break the centring.
    ...Platform.select({ android: { includeFontPadding: false }, default: {} }),
  },
});
