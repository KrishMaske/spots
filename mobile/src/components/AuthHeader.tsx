import React from 'react';
import { Text, View } from 'react-native';

import { SpotsWordmark, WORDMARK_HEADER_SCALE } from './SpotsWordmark';
import { useTheme } from '../theme/useTheme';

interface AuthHeaderProps {
  heading: string;
  subheading?: string;
}

/**
 * The wordmark + heading + optional sub-copy block that opens every auth
 * screen. It was byte-identical in shape across all five, duplicated five
 * times; this reproduces that spacing exactly with no pixel moved.
 *
 * Rule 1 — Jost Black is display type only. The wordmark is the brand face;
 * the heading below it stays system `typography.title` (24/700). Anyone
 * Jost-ifying the heading has left the vocabulary.
 *
 * Deliberately NOT a whole-screen shell: `Screen` is already that, and the five
 * bodies differ enough (field counts, banner counts, footer rows, Confirm's
 * static hint) that a `FormScreen` abstraction would be parameter soup with
 * real behavioral risk for no visual gain.
 */
export function AuthHeader({ heading, subheading }: AuthHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={{ marginBottom: theme.spacing.lg, alignItems: 'flex-start' }}>
      <SpotsWordmark
        scale={WORDMARK_HEADER_SCALE * 1.7}
        style={{ marginLeft: -18 }}
      />
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.typography.title.fontSize,
          fontWeight: theme.typography.title.fontWeight,
          marginTop: theme.spacing.lg,
        }}
      >
        {heading}
      </Text>
      {subheading ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.body.fontSize,
            marginTop: theme.spacing.xs,
          }}
        >
          {subheading}
        </Text>
      ) : null}
    </View>
  );
}
