import React from 'react';
import { Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

/** Placeholder destination for the `Map` tab. The route is real so the bottom
 *  nav is real; the screen is not designed. */
export function MapScreen() {
  const { theme } = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <Text
          testID="map-heading"
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.title.fontSize,
            fontWeight: theme.typography.title.fontWeight,
          }}
        >
          {copy.map.heading}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
          {copy.map.body}
        </Text>
      </View>
    </Screen>
  );
}
