import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/useAuth';
import { AppStack } from '../navigation/AppStack';
import { AuthStack } from '../navigation/AuthStack';
import { useTheme } from '../theme/useTheme';

/**
 * Chooses the Auth stack vs the App stack from session state. Because the
 * gate keys off `AuthContext`, a successful `signIn` swaps stacks with no
 * manual navigation call.
 */
export function RootNavigator() {
  const { status } = useAuth();
  const { theme } = useTheme();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return status === 'signedIn' ? <AppStack /> : <AuthStack />;
}
