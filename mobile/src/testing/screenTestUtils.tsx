import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { ThemeContext } from '../theme/ThemeProvider';
import { themes, type ThemeMode } from '../theme/themes';

/**
 * Pins a theme mode explicitly, bypassing `ThemeProvider`'s `useColorScheme()`
 * resolution and its SecureStore persistence.
 *
 * This exists because a dark-mode change must not depend on an accident: every
 * screen test used to render under a bare `<ThemeProvider>`, which resolves to
 * light in jest only because RN's `useColorScheme` mock returns `'light'`.
 * Selecting the mode by hand makes the light suite provably a LIGHT-mode
 * document.
 *
 * It takes a mode STRING, not a `Theme`, so that test files can pin a mode
 * without importing `themes`/`tokens` — the double-entry rule stays intact.
 */
export function ThemeHarness({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  return (
    <ThemeContext.Provider
      value={{ theme: themes[mode], preference: mode, setPreference: () => {} }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/** Renders a screen wrapped in the providers every screen needs (theme +
 * safe area). Auth is mocked per-test via `jest.mock('../../auth/useAuth')`
 * rather than a real `AuthProvider`, so screen tests don't depend on
 * SecureStore/network behavior.
 *
 * Defaults to `'light'` — which is what every existing screen test got before
 * the dark-mode change anyway, via RN's `useColorScheme` jest mock. Making it
 * explicit is the point. */
export function renderScreen(ui: React.ReactElement, mode: ThemeMode = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeHarness mode={mode}>{ui}</ThemeHarness>
    </SafeAreaProvider>
  );
}

export function navProps<Params>(name: string, params: Params) {
  return {
    navigation: { navigate: jest.fn() },
    route: { key: name, name, params },
  };
}
