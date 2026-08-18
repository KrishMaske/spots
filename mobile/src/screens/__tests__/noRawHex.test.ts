// Executable version of the review note "no raw hex in the implementation".
// Colors belong in `theme/tokens.ts` and reach components through
// `theme.colors.*` / `theme.brand.*`; `theme/tokens.ts` is the ONLY exemption.
//
// Was `onboardingTokens.test.ts`, covering three named files. The brand rollout
// took the same vocabulary to every remaining screen, so the guard is no longer
// onboarding-specific — and it no longer hardcodes a list. It DISCOVERS every
// `.tsx` in `src/screens/` and `src/components/`, so a screen added next month
// is covered the moment it lands, without anyone remembering to enlist it. A
// file that genuinely needs a hex must be added to `EXEMPT` with a reason,
// which makes the exception reviewable instead of invisible.
//
// The regex is deliberately blunt and does not parse: a hex in a COMMENT trips
// it too. That is why the retired yellows are written without a leading `#`
// wherever they are discussed in code. `FormError`'s
// `theme.colors.danger + '1A'` does not match, because the pattern is anchored
// on `#`.

import fs from 'fs';
import path from 'path';

const HEX = /#[0-9A-Fa-f]{3,8}\b/;

const SRC = path.join(__dirname, '../..');

/** Directories whose every `.tsx` must be hex-free. */
const GUARDED_DIRS = ['screens', 'components'];

/**
 * Files inside `GUARDED_DIRS` allowed to contain a raw hex. Empty on purpose:
 * `theme/tokens.ts` is the app's only hex-bearing file and it lives outside
 * these directories. Adding an entry here needs a stated reason.
 */
const EXEMPT: string[] = [];

function guardedFiles(): string[] {
  const found = GUARDED_DIRS.flatMap((dir) =>
    fs
      .readdirSync(path.join(SRC, dir), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
      .map((entry) => `${dir}/${entry.name}`)
  ).filter((relative) => !EXEMPT.includes(relative));

  // A silent empty list would make this whole suite vacuously green.
  if (found.length === 0) throw new Error('no guarded files discovered — check GUARDED_DIRS');
  return found.sort();
}

const files = guardedFiles();

/** The retired pre-brand yellows (O-F). Written without `#` so this file does
 *  not trip its own guard, and reassembled at runtime. */
const RETIRED_YELLOWS = ['FFD400', 'E6BF00'].map((hex) => `#${hex}`);

describe('implementation files hardcode no colors', () => {
  it('discovers the whole screen/component surface, not a stale list', () => {
    // Tripwire for the discovery itself: if a refactor moves these directories,
    // the guard must go red rather than quietly guarding nothing.
    expect(files).toContain('screens/LandingScreen.tsx');
    expect(files).toContain('components/BrandButton.tsx');
    // 21 since the Home feed and bottom nav landed: 4 placeholder tab screens
    // (Map, Chat, Groups, Profile) and 3 components (FeedCard, SpotsTabBar,
    // AppFrame) on top of the previous 15.
    expect(files.length).toBeGreaterThanOrEqual(21);
  });

  it.each(files)('%s contains no raw hex literal', (relative) => {
    const source = fs.readFileSync(path.join(SRC, relative), 'utf8');
    const match = source.match(HEX);

    expect(match).toBeNull();
  });

  it('keeps the brand hex where it belongs', () => {
    const tokens = fs.readFileSync(path.join(SRC, 'theme/tokens.ts'), 'utf8');

    expect(tokens).toContain('#FFC203');
    expect(tokens).toContain('#FFF6EC');
    expect(tokens).toContain('#F8FAFC');
    expect(tokens).toContain('#E2E8F0');
    expect(tokens).toContain('#000000');
    expect(tokens).toContain('#E6AF03');
    // The lifted dark raised surface (O-3). Listed so the new token is
    // discoverable from the guard rather than only from `themes.ts`.
    expect(tokens).toContain('#373E4A');
  });

  // The brand rollout retired the pre-brand accent placeholders outright (O-F):
  // two yellows in the codebase is precisely how the wrong one gets picked six
  // months from now. Checking `tokens.ts` alone would miss a reintroduction in
  // `themes.ts` or in a screen, so check every file that could carry one.
  describe.each([...files, 'theme/tokens.ts', 'theme/themes.ts'])(
    '%s does not resurrect a retired yellow',
    (relative) => {
      it.each(RETIRED_YELLOWS)('is free of %s', (hex) => {
        const source = fs.readFileSync(path.join(SRC, relative), 'utf8');

        expect(source).not.toContain(hex);
      });
    }
  );
});
