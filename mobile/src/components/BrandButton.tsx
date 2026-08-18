import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text } from 'react-native';

import { onboardingSpec } from '../theme/onboarding';
import { useTheme } from '../theme/useTheme';

export type BrandButtonVariant = 'primary' | 'secondary';
export type BrandButtonSize = 'hero' | 'compact';

interface BrandButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  /** Defaults to `primary` (the filled brand-yellow CTA). */
  variant?: BrandButtonVariant;
  /** Defaults to `compact` — the form CTA, which outnumbers the hero 9:2. */
  size?: BrandButtonSize;
  /** `hero` only, both from `computeOnboardingLayout` — this component does no
   * arithmetic. Ignored when `compact`, which stretches to its parent. */
  width?: number;
  height?: number;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

/**
 * The one brand button. Two sizes, one silhouette.
 *
 * `hero` is the onboarding CTA transcribed from Figma (fixed 330×60, a full
 * pill, 32px Jost Black label, 3px inside stroke on secondary). `compact` is
 * the form-scale capsule: `theme.size.control` (56) tall, `radius.xl` (25),
 * with a 20px label.
 *
 * RULE 3 IS AMENDED BY FIGMA v2 (2026-08-17). The brand rollout's Rule 3 said
 * "the corner arc is constant, not proportional" — both sizes at 25. The edited
 * `4:75` frame overrules that for the hero: its CTA is radius 100 on a 60pt
 * control, i.e. a full pill, while the compact control has no Figma precedent
 * and keeps 25. So the two now differ in kind, not just in size, and they are
 * only 4pt apart in height (60 vs 56) — a user going Landing → Login sees two
 * nearly-identical-height buttons with different corner geometry. That is a
 * real design-system question, deliberately deferred rather than silently
 * resolved: pilling `compact` would drag every `TextField` along by Rule 4.
 * See docs/plans/home-screen-and-onboarding-v2.md §4 / O-4.
 *
 * The hero reads `radius.pill` rather than a `radius: 100` token because any
 * radius >= height/2 renders the same capsule; a second pill value differing by
 * an invisible-but-real amount is exactly the drift the brand rollout deleted
 * the second yellow to prevent.
 *
 * The one place the sizes differ in kind is `allowFontScaling`. `hero` pins it
 * off: it is a transcription of a fixed design, and a scaled 32px label would
 * overflow the 60pt box and slide out from under the wordmark. A form button
 * has no such contract, so `compact` honours Dynamic Type and grows — which is
 * why it uses `minHeight` rather than `height`.
 *
 * Colors come from `theme.brand.*` and are mode-invariant by design.
 */
export function BrandButton({
  label,
  onPress,
  variant = 'primary',
  size = 'compact',
  width,
  height,
  loading = false,
  disabled = false,
  testID,
}: BrandButtonProps) {
  const { theme } = useTheme();
  const isSecondary = variant === 'secondary';
  const isHero = size === 'hero';
  const isDisabled = disabled || loading;

  const labelType = isHero ? theme.typography.brandCta : theme.typography.brandCtaCompact;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      // Explicit, not inherited from the label child: while `loading` the label
      // is replaced by a spinner, so without this the control would announce
      // "button, busy" with no name at all.
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isHero ? { width, height } : styles.compact,
        !isHero && { minHeight: theme.size.control, paddingVertical: theme.spacing.sm },
        {
          backgroundColor: isSecondary ? theme.brand.secondarySurface : theme.brand.primary,
          // The stroke draws inside the height (RN is border-box), which is what
          // Figma's inside stroke does.
          borderWidth: isSecondary ? onboardingSpec.footer.secondaryBorderWidth : 0,
          borderColor: theme.brand.primary,
          borderRadius: isHero ? theme.radius.pill : theme.radius.xl,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        // Both variants have light fills, so the brand's on-primary black is
        // right for both.
        <ActivityIndicator color={theme.brand.onPrimary} />
      ) : (
        <Text
          allowFontScaling={isHero ? false : undefined}
          style={[
            styles.label,
            {
              color: theme.brand.onPrimary,
              fontFamily: labelType.fontFamily,
              fontSize: labelType.fontSize,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    alignSelf: 'stretch',
  },
  label: {
    // `fontWeight` omitted on purpose — see `SpotsWordmark`.
    textAlign: 'center',
  },
});
