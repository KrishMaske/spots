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
import { checkPasswordPolicy, isValidEmail, passwordsMatch } from '../auth/validators';
import { AuthStackParamList } from '../navigation/types';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { register, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
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

    const policy = checkPasswordPolicy(password);
    if (!policy.valid) {
      setPasswordError(copy.register.weakPassword);
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
      const result = await register({ email: email.trim(), password });
      if (result.confirmation_required) {
        navigation.navigate('Confirm', { email: email.trim() });
      } else {
        // Pool didn't require confirmation — sign in directly rather than
        // bouncing through the Login screen. Fall back to Login if it fails.
        try {
          await signIn({ email: email.trim(), password });
        } catch {
          navigation.navigate('Login', { email: email.trim(), info: copy.login.verifiedInfo });
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setPasswordError(copy.register.weakPassword);
        } else if (err.status === 409) {
          setEmailError(copy.register.emailTaken);
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
      <AuthHeader heading={copy.register.heading} subheading={copy.register.reassurance} />

      <FormError testID="register-form-error" message={formError} />

      <TextField
        testID="register-email"
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
        testID="register-password"
        label="Password"
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
        testID="register-confirm-password"
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={confirmError}
        secureTextEntry
        textContentType="newPassword"
        autoCapitalize="none"
        editable={!submitting}
      />

      <BrandButton testID="register-submit" label={copy.register.submitCta} loading={submitting} onPress={onSubmit} />

      <View style={[styles.metaRow, { marginTop: theme.spacing.lg }]}> 
        <View style={styles.inlinePrompt}>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
            Already have an account?{' '}
          </Text>
          <TextLink
            testID="register-go-login"
            label={'Log in'}
            onPress={() => navigation.navigate('Login', undefined)}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  inlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});