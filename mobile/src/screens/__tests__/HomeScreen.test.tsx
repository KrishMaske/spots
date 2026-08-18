// Home is the signed-in feed and NOTHING ELSE: no greeting, no session call, no
// logout. Krish removed the temporary session scaffold, so the four behavioural
// tests that used to live at the top of this file (the greeting, the
// `/v1/users/me` DTO + token, the failure path and the logout press) have MOVED
// to `ProfileScreen.test.tsx`, which is where that behaviour now lives. They were
// not deleted — `signOut()` has exactly one call site in the app and dropping its
// only assertion would have left the app's only exit unguarded, silently.
//
// What stays on this side is the mirror: Home renders no logout. Two suites, one
// guarantee.
//
// Double-entry: every number is a literal. Krish's feed overrides the Figma
// frame's 32 / 326×236 / 28 with 26 / 338×600 / 30 — see `theme/home.ts`.

import React from 'react';
import { Dimensions } from 'react-native';
import * as safeAreaContext from 'react-native-safe-area-context';

import { HomeScreen } from '../HomeScreen';
import { renderScreen } from '../../testing/screenTestUtils';

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // Re-installs the safe-area insets that the `resetAllMocks()` above strips.
  // Jest runs hooks in declaration order within a block, so this lands after the
  // reset for EVERY test here.
  //
  // It is necessary because HomeScreen renders from `computeHomeLayout`, a pure
  // function of the window and the insets:
  // `react-native-safe-area-context`'s jest mock implements `useSafeAreaInsets`
  // with a `jest.fn()`, so resetting it makes the hook return `undefined` and
  // the layout throw. Same class of problem `jest.setup.ts` documents for the
  // asset registry — fixed locally rather than by widening that global override.
  beforeEach(() => {
    jest
      .spyOn(safeAreaContext, 'useSafeAreaInsets')
      .mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 } as never);
  });

  describe('the feed', () => {
    it('renders the cards at 338x600', () => {
      const { getByTestId } = renderScreen(<HomeScreen />);

      for (const index of [0, 1, 2]) {
        const style = flattenStyle(getByTestId(`home-feed-card-${index}`).props.style);
        expect(style.width).toBe(338);
        expect(style.height).toBe(600);
      }
    });

    it("renders Krish's ten placeholder cards — a scroll length, not a page size", () => {
      const { queryByTestId } = renderScreen(<HomeScreen />);

      expect(queryByTestId('home-feed-card-9')).toBeTruthy();
      expect(queryByTestId('home-feed-card-10')).toBeNull();
    });

    it('lays the scroll content out on Home’s own 26pt gutters', () => {
      const { getByTestId } = renderScreen(<HomeScreen />);

      const content = flattenStyle(getByTestId('home-feed').props.contentContainerStyle);
      expect(content.paddingTop).toBe(58); // the frame's own value, unchanged
      expect(content.paddingHorizontal).toBe(26);
      expect(content.gap).toBe(30);
      // 30 gap + the floating bar's 126pt footprint: the bar overlays the scene,
      // so without this the last card could never be scrolled clear of it.
      expect(content.paddingBottom).toBe(156);
    });

    it('renders the cards in order inside the scroll view', () => {
      const { getByTestId } = renderScreen(<HomeScreen />);

      const order = getByTestId('home-root')
        .findAll(
          (node: { type: unknown; props: { testID?: string } }) =>
            typeof node.type === 'string' && /^home-feed-card-\d+$/.test(node.props.testID ?? '')
        )
        .map((node: { props: { testID?: string } }) => node.props.testID);

      expect(order.slice(0, 3)).toEqual([
        'home-feed-card-0',
        'home-feed-card-1',
        'home-feed-card-2',
      ]);
      expect(order).toHaveLength(10);
    });

    it('renders no logout and no session scaffold — Profile owns both', () => {
      // The mirror of `ProfileScreen.test.tsx`'s first test. Home must never
      // grow a second exit, and the retired scaffold must not come back.
      const { queryByTestId } = renderScreen(<HomeScreen />);

      expect(queryByTestId('home-logout')).toBeNull();
      expect(queryByTestId('home-session-scaffold')).toBeNull();
      expect(queryByTestId('profile-logout')).toBeNull();
    });

    it('renders no tab bar — the nav belongs to the navigator, not the screen', () => {
      // This is what lets the whole suite render HomeScreen with no navigator.
      const { queryByTestId } = renderScreen(<HomeScreen />);

      expect(queryByTestId('tab-bar')).toBeNull();
    });

    it('sets no background of its own — AppFrame owns the canvas', () => {
      // If someone "fixes" a missing background here, the app gets two sources
      // for one colour and the frame stops being the single one.
      const { getByTestId } = renderScreen(<HomeScreen />);

      expect(flattenStyle(getByTestId('home-root').props.style).backgroundColor).toBeUndefined();
    });

    it('cannot opt into the spotty backdrop, structurally', () => {
      // Home stopped rendering `Screen` altogether, so — like Landing — the
      // omission is structural rather than a convention to remember.
      const { queryByTestId } = renderScreen(<HomeScreen />);

      expect(queryByTestId('spots-backdrop')).toBeNull();
    });
  });
});
