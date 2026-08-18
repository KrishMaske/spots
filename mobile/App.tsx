import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme as NavTheme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/app/RootNavigator';
import { AuthProvider } from './src/auth/AuthContext';
import { useBrandFonts } from './src/theme/fonts';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { useTheme } from './src/theme/useTheme';

// Module scope, before the first render: keeps the native splash up while the
// brand face loads, so the wordmark is never painted in a fallback face — not
// for one frame — and no blank screen flashes in its place.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Builds React Navigation's theme from our design tokens so nav chrome
 * (headers, tab bars, screen background) matches the app theme. */
function useNavigationTheme(): NavTheme {
  const { theme } = useTheme();
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}

function Navigation() {
  const navTheme = useNavigationTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const fontsLoaded = useBrandFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // the native splash is still up; nothing flashes
  }

  return (
    // GESTURE-HANDLER'S ROOT VIEW LIVES HERE, AND THE PLACEMENT IS DELIBERATE.
    // `GestureDetector` (the bottom nav) throws in dev without an ancestor root
    // view; jest is exempt (`isTestEnv()`), which is why no test helper wraps it.
    //
    // Not `RootNavigator`: it returns a DIFFERENT subtree while the session is
    // loading, so the gesture root would unmount and remount when auth resolves.
    // Not `AppStack`/`AppFrame`: those are the signed-in shell only, and a root
    // view that exists for four of eleven screens is a trap for the next gesture
    // anyone adds. `App.tsx` already owns exactly this kind of once-per-app
    // provider stack, and its `return null` font gate happens BEFORE the tree
    // exists at all — so this mounts once, on first paint, and never again.
    //
    // Outermost rather than inside `SafeAreaProvider` because gesture-handler
    // documents it as wrapping the whole app, and because `react-native-screens`'
    // native stack (already a dependency) uses gesture-handler for its own screen
    // transitions.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <Navigation />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
