import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { useTheme } from '../theme/useTheme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
  editable?: boolean;
  testID?: string;
  placeholder?: string;
}

/**
 * Labeled input with inline error text and an optional show/hide toggle for
 * secure fields.
 *
 * Rule 4 — controls share one silhouette. The field is the same capsule as the
 * compact CTA below it: `size.control` (56) tall, `radius.xl` (25). A form
 * screen should read as a stack of capsules, the way the onboarding footer
 * reads as two identical capsules stacked.
 *
 * The border is a constant 2 in all three states (resting / focus / error).
 * Varying it would jitter the layout on focus, because Yoga is border-box.
 *
 * The focus state is extrapolated from the onboarding secondary button's 3px
 * brand stroke, scaled for a form control.
 *
 * ACCESSIBILITY GAP, measured and accepted — not mitigated. WCAG 1.4.11 wants
 * 3:1 for UI component boundaries. This field's boundary clears that in NO
 * state: the resting hairline is 1.18:1 against the canvas (1.23:1 against the
 * field's own white fill), and the brand-yellow focus ring is 1.62:1 against
 * that fill (1.55:1 against the canvas). Focus makes the boundary more
 * NOTICEABLE, which is why it is worth having, but it does not make it
 * COMPLIANT — do not read it as a partial fix.
 *
 * This is also a mild regression: the pre-rollout ramp put a gray border on
 * white at 1.56:1, so the resting state lost ~0.4. The onboarding frame has no
 * inputs, so the brand supplies no answer. The fallback, if compliance is
 * wanted, is one token: a darker light-mode `colors.border`, keeping
 * `brand.hairline` for decorative rules only. See mobile/README.md, "Known
 * gaps" — flagged and accepted, not silently shipped.
 *
 * Rule 1 — the label, helper text, error text and Show/Hide toggle stay system
 * type. Jost Black is display type only.
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  helperText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  textContentType,
  editable = true,
  testID,
  placeholder,
}: TextFieldProps) {
  const { theme } = useTheme();
  const [hidden, setHidden] = useState(secureTextEntry);
  // View state, not app behavior — nothing outside this component observes it.
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.brand.primary
      : theme.colors.border;

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.text,
            fontSize: theme.typography.label.fontSize,
            fontWeight: theme.typography.label.fontWeight,
            marginBottom: theme.spacing.xs,
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: theme.radius.xl,
            minHeight: theme.size.control,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
              paddingVertical: theme.spacing.sm,
              // A 25pt corner needs the inset, or the text crowds the curve.
              paddingHorizontal: theme.spacing.md,
            },
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            style={{ paddingHorizontal: theme.spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <MaterialCommunityIcons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          style={{
            color: theme.colors.danger,
            fontSize: theme.typography.caption.fontSize,
            marginTop: theme.spacing.xs,
          }}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.typography.caption.fontSize,
            marginTop: theme.spacing.xs,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Constant in all three states — see the focus note above.
    borderWidth: 2,
  },
  input: {
    flex: 1,
  },
});
