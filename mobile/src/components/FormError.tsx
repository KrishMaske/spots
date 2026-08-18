import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';

export type FormErrorVariant = 'error' | 'info';

interface FormErrorProps {
  message?: string | null;
  testID?: string;
  /** Visual treatment. Defaults to 'error' — preserves all existing call sites. */
  variant?: FormErrorVariant;
}

/**
 * Banner for form-level messages. `'error'` (default) is the danger/red
 * treatment (e.g. 401 on login, 502 provider-unavailable). `'info'` is a
 * neutral, non-alarming treatment built from existing surface/border/text
 * tokens (no new brand color) for expected routing hints, e.g. the
 * Confirm-screen redirect after a 403 login.
 */
export function FormError({ message, testID, variant = 'error' }: FormErrorProps) {
  const { theme } = useTheme();

  if (!message) return null;

  const isError = variant === 'error';
  const backgroundColor = isError ? theme.colors.danger + '1A' : theme.colors.surface;
  const borderColor = isError ? theme.colors.danger : theme.colors.border;
  const textColor = isError ? theme.colors.danger : theme.colors.text;

  return (
    <View
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor,
          borderColor,
          // NO ONBOARDING PRECEDENT. The frame offers 25 (control) and 32 (page
          // frame); a multi-line banner is neither — a capsule-shaped block of
          // wrapping text looks wrong. `radius.lg` (20) is an existing token,
          // one step below the control radius: visibly rounder than the old 8
          // without becoming a pill. This banner is the app's only card-like
          // surface, so "cards adopt the brand radii" resolves entirely here.
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
        },
      ]}
    >
      <Text style={{ color: textColor, fontSize: theme.typography.body.fontSize }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 2,
  },
});
