import React, { useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { forgotPassword } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthHeader } from '../components/AuthHeader';
import { BrandButton } from '../components/BrandButton';
import { FormError } from '../components/FormError';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { isValidEmail } from '../auth/validators';
import { AuthStackParamList } from '../navigation/types';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/** Courtesy cooldown after a successful send, so a double-tap doesn't burn the
 * per-user reset budget or the account-wide daily email quota. Not a security
 * control — the real limits live in Cognito. */
const RESEND_COOLDOWN_MS = 60_000;

/**
 * Step 1 of the password reset: ask Cognito to email a one-time code.
 *
 * This screen never tells the user whether an account exists. The edge answers
 * 204 either way by design (the pool sets PreventUserExistenceErrors=ENABLED),
 * so the banner is deliberately conditional: "if there's a Spots account for
 * that address...". Do not add a "no account found" state — there is no way to
 * learn that, and adding one would mean deliberately building an enumeration
 * oracle.
 *
 * No session is created here, so AuthContext is untouched.
 */
export function ForgotPasswordScreen({ navigation, route }: Props) {
  const { theme } = useTheme();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [cooling, setCooling] = useState(false);

  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    },
    []
  );

  const onSubmit = async () => {
    setFormError(undefined);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(undefined);

    setSubmitting(true);
    try {
      await forgotPassword({ email: trimmed });

      // Start the cooldown before navigating, so coming back to this screen
      // doesn't hand the user an immediately-tappable button.
      setCooling(true);
      cooldownTimer.current = setTimeout(() => setCooling(false), RESEND_COOLDOWN_MS);

      navigation.navigate('ResetPassword', { email: trimmed, info: copy.forgotPassword.sentInfo });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setFormError(copy.forgotPassword.tooManyRequests);
      } else if (err instanceof ApiError && err.status === 400) {
        setEmailError('Enter a valid email address.');
      } else {
        // Includes 502 and network failures. The edge swallows provider errors
        // into 204, so anything reaching here is a transport/edge problem.
        setFormError(copy.login.serviceUnavailable);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backdrop="spots">
      <AuthHeader heading={copy.forgotPassword.heading} subheading={copy.forgotPassword.body} />

      <FormError testID="forgot-password-form-error" message={formError} />

      <TextField
        testID="forgot-password-email"
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="username"
        editable={!submitting}
      />

      <BrandButton
        testID="forgot-password-submit"
        label={copy.forgotPassword.submitCta}
        loading={submitting}
        disabled={cooling}
        onPress={onSubmit}
      />

      <View style={{ marginTop: theme.spacing.lg }}>
        <TextLink
          testID="forgot-password-back-to-login"
          label={copy.forgotPassword.backToLoginCta}
          onPress={() => navigation.navigate('Login', { email: email.trim() || undefined })}
        />
      </View>
    </Screen>
  );
}
