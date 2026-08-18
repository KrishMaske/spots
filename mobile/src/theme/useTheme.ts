import { useContext } from 'react';

import { ThemeContext, ThemeContextValue } from './ThemeProvider';

/** Returns the active theme + preference controls. Must be used within `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
