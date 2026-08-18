import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/useTheme';

interface TextLinkProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  testID?: string;
}

/**
 * The inline navigation link — "Forgot password?", "Create an account", "Back to
 * login". Formerly `Button variant="text"`, extracted when `Button` retired:
 * a transparent, borderless, system-face link shares nothing with a filled
 * 25-radius Jost Black capsule except the word "button", so folding it into
 * `BrandButton` would mean a branch that skips every brand property that
 * component exists to apply.
 *
 * Rule 2 — brand yellow is a fill, never a foreground. The brand yellow on the
 * canvas is 1.55:1, so links stay `colors.text`. There are no yellow links.
 *
 * `accessibilityRole` stays `"button"`, not `"link"`: these navigate within the
 * app, and preserving the role keeps every existing a11y query valid.
 */
export function TextLink({ label, onPress, testID }: TextLinkProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      // The old 24pt horizontal padding pushed "Create an account" a visible
      // 24pt away from the "New here?" it follows; `hitSlop` restores the tap
      // target without the visual gap.
      hitSlop={12}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontSize: theme.typography.label.fontSize,
            fontWeight: theme.typography.label.fontWeight,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  label: {
    textAlign: 'center',
  },
});
