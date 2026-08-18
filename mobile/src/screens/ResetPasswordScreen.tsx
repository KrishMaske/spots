import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { resetPassword } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthHeader } from '../components/AuthHeader';
import { BrandButton } from '../components/BrandButton';
import { FormError } from '../components/FormError';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { clearSession } from '../auth/session';
import { checkPasswordPolicy, passwordsMatch } from '../auth/validators';
import { AuthStackParamList } from '../navigation/types';
import { copy } from '../theme/copy';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

/**
 * Step 2 of the password reset: exchange the emailed code for a new password.
 *
 * The reset code is valid for ONE HOUR — not the 24 hours of the sign-up
 * confirmation code (see `copy.resetPassword.body`).
 *
 * Disambiguating the 400: the edge returns 400 for BOTH a bad code and a
 * policy-violating password, with different `error` strings. Matching on those
 * strings would be brittle, so the password policy is checked client-side first
 * (same pattern as RegisterScreen). A 400 that survives client validation is
 * therefore attributed to the code field.
 *
 * This flow issues no tokens and creates no session, so AuthContext is
 * deliberately untouched — a successful reset must NOT sign the user in.
 */
export function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, info } = route.params;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>(info);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    let ok = true;

    if (!code.trim()) {
      setCodeError('Enter the code we emailed you.');
      ok = false;
    } else {
      setCodeError(undefined);
    }

    if (!checkPasswordPolicy(password).valid) {
      setPasswordError(copy.resetPassword.weakPassword);
      ok = false;
    } else {
      setPasswordError(undefined);
    }

    if (!passwordsMatch(password, confirmPassword)) {
      setConfirmError('Passwords do not match.');
      ok = false;
    } else {
      setConfirmError(undefined);
    }

    return ok;
  };

  const onSubmit = async () => {
    setFormError(undefined);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword({ email, code: code.trim(), password });

      // Belt and braces: in the normal flow the user is already signed out, but
      // resetting from a device holding a stale session would otherwise leave a
      // zombie session that outlives the password it was minted from. Cognito
      // does not reliably revoke existing tokens on a reset, so clear ours.
      await clearSession();

      navigation.navigate('Login', { email, info: copy.resetPassword.successInfo });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          // The password already passed the client-side policy check above, so
          // a surviving 400 is attributed to the code.
          setCodeError(copy.resetPassword.invalidCode);
        } else if (err.status === 403) {
          navigation.navigate('Confirm', { email, info: copy.login.notConfirmedInfo });
        } else if (err.status === 429) {
          setFormError(copy.resetPassword.tooManyRequests);
        } else {
          setFormError(copy.login.serviceUnavailable);
        }
      } else {
        setFormError(copy.login.serviceUnavailable);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backdrop="spots">
      <AuthHeader heading={copy.resetPassword.heading} subheading={copy.resetPassword.body(email)} />

      <FormError testID="reset-password-info" variant="info" message={banner} />
      <FormError testID="reset-password-form-error" message={formError} />

      <TextField
        testID="reset-password-code"
        label="Reset code"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setBanner(undefined);
        }}
        error={codeError}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        editable={!submitting}
      />
      <TextField
        testID="reset-password-password"
        label="New password"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        helperText={!passwordError ? copy.register.passwordHelper : undefined}
        secureTextEntry
        textContentType="newPassword"
        autoCapitalize="none"
        editable={!submitting}
      />
      <TextField
        testID="reset-password-confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={confirmError}
        secureTextEntry
        textContentType="newPassword"
        autoCapitalize="none"
        editable={!submitting}
      />

      <BrandButton
        testID="reset-password-submit"
        label={copy.resetPassword.submitCta}
        loading={submitting}
        onPress={onSubmit}
      />
    </Screen>
  );
}
