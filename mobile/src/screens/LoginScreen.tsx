import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../api/client';
import { AuthHeader } from '../components/AuthHeader';
import { BrandButton } from '../components/BrandButton';
import { FormError } from '../components/FormError';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { useAuth } from '../auth/useAuth';
import { isValidEmail } from '../auth/validators';
import { AuthStackParamList } from '../navigation/types';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  // Neutral banner from an upstream redirect (e.g. "verified — log in"), shown
  // as info, not an error. Dismissed once the user submits.
  const [info, setInfo] = useState<string | undefined>(route.params?.info);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    let ok = true;
    if (!email.trim()) {
      setEmailError('Email is required.');
      ok = false;
    } else if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      ok = false;
    } else {
      setEmailError(undefined);
    }

    if (!password) {
      setPasswordError('Password is required.');
      ok = false;
    } else {
      setPasswordError(undefined);
    }

    return ok;
  };

  const onSubmit = async () => {
    setFormError(undefined);
    setInfo(undefined);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      // RootNavigator swaps to the App stack automatically on signedIn.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setFormError(copy.login.invalidCredentials);
        } else if (err.status === 403) {
          navigation.navigate('Confirm', { email: email.trim(), info: copy.login.notConfirmedInfo });
        } else if (err.status === 502) {
          setFormError(copy.login.serviceUnavailable);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(copy.login.serviceUnavailable);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen backdrop="spots" style={{ justifyContent: 'center' }}>
      <AuthHeader heading={copy.login.heading} />

      <FormError testID="login-info" variant="info" message={info} />
      <FormError testID="login-form-error" message={formError} />

      <TextField
        testID="login-email"
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="username"
        editable={!submitting}
      />
      <TextField
        testID="login-password"
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        secureTextEntry
        textContentType="password"
        autoCapitalize="none"
        editable={!submitting}
      />

      <BrandButton testID="login-submit" label={copy.login.submitCta} loading={submitting} onPress={onSubmit} />

      <View style={[styles.metaRow, { marginTop: theme.spacing.md }]}> 
        <View style={styles.inlinePrompt}>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
            {copy.login.footerPrompt}{' '}
          </Text>
          <TextLink
            testID="login-go-register"
            label={copy.login.footerCta}
            onPress={() => navigation.navigate('Register')}
          />
        </View>

        <TextLink
          testID="login-forgot-password"
          label={copy.forgotPassword.linkCta}
          // Carry whatever the user already typed so they don't retype it.
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() || undefined })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
