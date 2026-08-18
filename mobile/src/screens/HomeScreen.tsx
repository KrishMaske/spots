import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedCard } from '../components/FeedCard';
import { computeHomeLayout } from '../theme/home';

/**
 * Krish's pick for a feed long enough to scroll properly. The Figma frame draws
 * THREE; this is not that number and does not claim to be.
 *
 * STILL NOT A PAGE SIZE — there is no feed API and no trip model, and the cards
 * are empty image slots. Do not treat it as data or as a fetch limit.
 */
const FEED_PLACEHOLDER_COUNT = 10;

/**
 * The signed-in feed — the `home-screen` Figma frame (node 4:164): a scrolling
 * column of trip cards under a floating bottom nav.
 *
 * The nav is NOT rendered here; it belongs to the tab navigator in
 * `AppStack.tsx`. That is what lets this screen take plain `flex: 1` and lets
 * its test render it with no navigator at all. The bar is absolutely positioned
 * and therefore OVERLAYS this scene rather than shortening it, which is why
 * `feed.bottomPadding` has to clear the bar's whole footprint — see `theme/home.ts`.
 *
 * It sets NO `backgroundColor`: the canvas belongs to `AppFrame`, which wraps
 * the whole tab navigator, and the scene above this is deliberately transparent
 * so the frame's rounded corners show through. Do not "fix" a missing background
 * here — that would give the app two sources for one colour.
 *
 * There is no logout and no session call on this screen. Both live on
 * `ProfileScreen` now, which is the only place `signOut()` is called from.
 *
 * It deliberately does NOT render `<Screen>`: it needs a full-bleed feed, a 32pt
 * gutter rather than the 30 `Screen` owns, no `KeyboardAvoidingView`, and its
 * own scroll container. Like `LandingScreen`, it reads `useWindowDimensions()` +
 * `useSafeAreaInsets()` and renders entirely from a pure layout function, doing
 * no arithmetic of its own. A structural consequence worth stating: Home is now,
 * like Landing, incapable of picking up the spotty backdrop by accident.
 *
 * THE SCROLLVIEW DOES NOT FIX `RegisterScreen`. That 375×667 clipping risk lives
 * in `Screen.tsx`, which this change does not touch.
 */
export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { feed } = computeHomeLayout({ width, height, insets });

  return (
    <View testID="home-root" style={{ flex: 1 }}>
      <ScrollView
        testID="home-feed"
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: feed.topPadding,
          paddingHorizontal: feed.sideMargin,
          paddingBottom: feed.bottomPadding,
          gap: feed.cardGap,
        }}
      >
        {Array.from({ length: FEED_PLACEHOLDER_COUNT }, (_, index) => (
          <FeedCard
            key={index}
            testID={`home-feed-card-${index}`}
            width={feed.cardWidth}
            height={feed.cardHeight}
          />
        ))}
      </ScrollView>
    </View>
  );
}
