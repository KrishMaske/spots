import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandButton } from '../components/BrandButton';
import { SpotsWordmark } from '../components/SpotsWordmark';
import { copy } from '../theme/copy';
import { computeOnboardingLayout, onboardingSpec } from '../theme/onboarding';
import { useTheme } from '../theme/useTheme';
import { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

const MAP = require('../../assets/images/map.png');

/**
 * Brand entry point — the `spots-onboarding` Figma frame (node 4:75). Static:
 * no network calls, navigation only.
 *
 * Every number comes from `computeOnboardingLayout`; this file does no
 * arithmetic of its own. No `SafeAreaView`, because the hero has to bleed to
 * the physical top edge — the insets feed the layout function instead.
 */
export function LandingScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = computeOnboardingLayout({ width, height, insets });

  return (
    <View style={[styles.root, { backgroundColor: theme.brand.canvas }]}>
      {/* Same expression `Screen` uses. Hardcoding "dark" painted dark glyphs
          on a near-black bar once the canvas went dark. */}
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <View
        testID="onboarding-root"
        style={[styles.frame, { backgroundColor: theme.brand.canvas, borderRadius: theme.radius.xxl }]}
      >
        <View testID="onboarding-hero" style={styles.hero}>
          {/* Painted before the wordmark, so the wordmark is on top. */}
          <Image
            testID="onboarding-map"
            source={MAP}
            accessible={false}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: layout.map.left,
              top: layout.map.top,
              width: layout.map.width,
              height: layout.map.height,
            }}
          />
          <SpotsWordmark
            scale={layout.wordmark.scale}
            style={{ position: 'absolute', top: layout.wordmark.top, left: layout.wordmark.left }}
          />
        </View>
        <View
          testID="onboarding-footer"
          style={{
            paddingHorizontal: layout.sideMargin,
            paddingTop: layout.footerTopPadding,
            paddingBottom: layout.bottomPadding,
            gap: layout.buttonGap,
          }}
        >
          <BrandButton
            testID="onboarding-sign-in"
            label={copy.landing.signInCta}
            size="hero"
            variant="primary"
            width={layout.buttonWidth}
            height={layout.buttonHeight}
            onPress={() => navigation.navigate('Login', undefined)}
          />
          <BrandButton
            testID="onboarding-register"
            label={copy.landing.registerCta}
            size="hero"
            variant="secondary"
            width={layout.buttonWidth}
            height={layout.buttonHeight}
            onPress={() => navigation.navigate('Register')}
          />
        </View>
        {/* Figma's 1px frame stroke is an INSIDE stroke: it paints over the
            content and takes no space. Putting `borderWidth` on the frame
            itself would make Yoga (border-box) shrink the content box to
            388×846 while the layout is computed from the full 390×848 window,
            pushing every Figma coordinate 1px down/right. Painting it as an
            overlay keeps the buttons at x 30..359 and the wordmark at y 65. */}
        <View
          testID="onboarding-frame-stroke"
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
  root: {
    flex: 1,
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
  },
  hero: {
    flex: 1,
    overflow: 'hidden',
  },
});
