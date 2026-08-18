// The single module that knows about `expo-font`. Everything else refers to the
// brand face by the name declared in `tokens.fontFamily`, so the family name can
// never drift from what was actually registered — and no component test needs a
// font mock.

import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Jost_900Black } from '@expo-google-fonts/jost';

import { fontFamily } from './tokens';

/** Registers the brand face under the exact family name the tokens declare.
 * Returns `true` once it is safe to render — including the failure case: a
 * corrupt/unreachable font asset degrades the wordmark to the system face
 * rather than hanging the app on the splash screen forever. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({ [fontFamily.jostBlack]: Jost_900Black });

  // Logged from an effect, not the render body: `useFonts` keeps reporting the
  // same error, so warning inline would fire on every render for the lifetime
  // of the app.
  useEffect(() => {
    if (error) {
      console.warn('[fonts] failed to load the brand face; falling back to the system font', error);
    }
  }, [error]);

  // Explicit trade: a bricked launch is worse than a wrong typeface.
  return loaded || error != null;
}
