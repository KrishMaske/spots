import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/useTheme';

interface FeedCardProps {
  /** From `computeHomeLayout().feed` — this component does no arithmetic. */
  width: number;
  height: number;
  /**
   * A trip photo. Omitted → the EMPTY state, which is exactly what the Figma
   * frame shows.
   *
   * THERE IS NO FEED API AND NO TRIP MODEL. This prop is the seam for one,
   * nothing more. Do not add fetching, captions, authorship or actions here
   * without a design and a contract.
   */
  source?: ImageSourcePropType;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The Home feed's card (Figma home-screen 4:164): 326×236, radius 50, the warm
 * `surfaceRaised` fill, and the frame's 0/4/10 rgba(0,0,0,0.35) drop shadow.
 *
 * TWO VIEWS, AND THE SPLIT IS LOAD-BEARING. On iOS, `overflow: 'hidden'` and a
 * shadow on the SAME view clip the shadow away; on Android an `elevation`
 * shadow is drawn outside the view's bounds and survives. So the outer view owns
 * the shadow and sets no `overflow`, and the inner view owns the radius and the
 * clip. That is the only reason there are two.
 *
 * The card's separation from the canvas is the SHADOW, not the fill: the linen
 * raised surface on the light canvas measures 1.01:1. If the shadow is ever
 * dropped, the feed becomes a flat white rectangle. (Hexes deliberately omitted
 * — `screens/__tests__/noRawHex.test.ts` is blunt and reads comments too.)
 */
export function FeedCard({ width, height, source, accessibilityLabel, testID }: FeedCardProps) {
  const { theme } = useTheme();

  return (
    <View
      testID={testID}
      // An empty card is decorative: with no image and no label there is
      // nothing for a screen reader to say.
      accessible={source || accessibilityLabel ? undefined : false}
      accessibilityLabel={accessibilityLabel}
      style={[{ width, height }, theme.elevation.card]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: theme.radius.xxxl,
            backgroundColor: theme.colors.surfaceRaised,
          },
        ]}
      >
        {source ? (
          <Image
            testID={testID ? `${testID}-image` : undefined}
            source={source}
            accessible={false}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    // The clip lives HERE and never on the shadow owner — see the docblock.
    overflow: 'hidden',
  },
});
