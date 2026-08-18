import React from 'react';
import { Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

/**
 * Placeholder destination for the bottom nav's centre button.
 *
 * THIS IS THE AI ASSISTANT'S ROUTE, NOT ITS DESIGN. The chatbot has not been
 * designed and this change deliberately does not attempt one — the deliverable
 * is a wired route with a heading, so the nav is real and the design can land
 * later without touching navigation.
 */
export function ChatScreen() {
  const { theme } = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <Text
          testID="chat-heading"
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.title.fontSize,
            fontWeight: theme.typography.title.fontWeight,
          }}
        >
          {copy.chat.heading}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
          {copy.chat.body}
        </Text>
      </View>
    </Screen>
  );
}
