import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import { ApiError } from '../api/client';
import { AuthHeader } from '../components/AuthHeader';
import { BrandButton } from '../components/BrandButton';
import { FormError } from '../components/FormError';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { useAuth } from '../auth/useAuth';
import { AuthStackParamList } from '../navigation/types';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Confirm'>;

/**
 * The confirm-code step — mandatory in this flow because the user pool sets
 * AutoVerifiedAttributes: email, so login otherwise returns 403 until
 * /confirm succeeds.
 *
 * There is no resend-code endpoint on the Go edge (only
 * register/confirm/login/refresh/logout exist) — do not call one; see the
 * static hint below instead (plan open question O5).
 */
export function ConfirmScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { confirmAndSignIn } = useAuth();
  const { email, info } = route.params;

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setFormError(undefined);
    if (!code.trim()) {
      setCodeError('Enter the code we emailed you.');
      return;
    }
    setCodeError(undefined);

    setSubmitting(true);
    try {
      const { signedIn } = await confirmAndSignIn({ email, code: code.trim() });
      if (!signedIn) {
        // Verified, but auto-login didn't happen — finish on the Login screen.
        navigation.navigate('Login', { email, info: copy.login.verifiedInfo });
      }
      // When signedIn, RootNavigator swaps to the app stack automatically.
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setCodeError(copy.confirm.invalidCode);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(copy.login.serviceUnavailable);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backdrop="spots">
      <AuthHeader heading={copy.confirm.heading} subheading={copy.confirm.body(email)} />

      <FormError testID="confirm-info" variant="info" message={info} />
      <FormError testID="confirm-form-error" variant="error" message={formError} />

      <TextField
        testID="confirm-email"
        label="Email"
        value={email}
        onChangeText={() => {}}
        editable={false}
      />
      <TextField
        testID="confirm-code"
        label="Confirmation code"
        value={code}
        onChangeText={setCode}
        error={codeError}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        editable={!submitting}
      />

      <BrandButton testID="confirm-submit" label={copy.confirm.submitCta} loading={submitting} onPress={onSubmit} />

      <View style={{ marginTop: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.caption.fontSize }}>
          {copy.confirm.resendHint}
        </Text>
      </View>
    </Screen>
  );
}
