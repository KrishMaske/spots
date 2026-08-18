import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { Theme, ThemeMode, themes } from './themes';

export type ThemePreference = 'system' | ThemeMode;

const PREFERENCE_KEY = 'spots.theme-preference';

export interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(preference: ThemePreference, systemScheme: ThemeMode | null | undefined): Theme {
  const mode: ThemeMode = preference === 'system' ? systemScheme ?? 'light' : preference;
  return themes[mode];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(PREFERENCE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // No persisted preference, or SecureStore unavailable — default stands.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(PREFERENCE_KEY, next).catch(() => {
      // Best-effort persistence; the in-memory preference still applies this session.
    });
  }, []);

  const theme = useMemo(
    () => resolveTheme(preference, systemScheme as ThemeMode | null | undefined),
    [preference, systemScheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
