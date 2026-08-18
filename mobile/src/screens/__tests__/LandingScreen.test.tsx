// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, frame `spots-onboarding`,
// node 4:75. Every number and hex below is an independent Figma literal — never
// imported from `onboardingSpec` or the theme.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { LandingScreen } from '../LandingScreen';
import { ThemeHarness } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Pin the window to the Figma reference size; `useWindowDimensions` seeds its
// state from `Dimensions.get('window')`.
beforeEach(() => {
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 390, height: 848, scale: 3, fontScale: 1 } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

function resolveStyle(element: { props: { style: unknown } }): Record<string, unknown> {
  const style = element.props.style;
  return flattenStyle(typeof style === 'function' ? style({ pressed: false }) : style);
}

/**
 * The mode is pinned EXPLICITLY. This used to be a bare `<ThemeProvider>`, which
 * resolved to light in jest only by accident (RN's `useColorScheme` mock). Every
 * Figma literal below is a light-mode value, so once dark mode existed, leaving
 * the mode to an accident meant this file could go red for a reason that has
 * nothing to do with the design.
 *
 * The literals themselves are untouched by the dark-mode change: the
 * transcription is now proved against light SPECIFICALLY, which is more precise
 * than what it proved before, not less. The dark case is a separate describe at
 * the bottom — deliberately not an `it.each` over both modes, which would turn
 * 30 hardcoded design values into a lookup table and destroy the double-entry
 * property that makes this file worth having.
 */
function renderLanding(navigate: jest.Mock = jest.fn(), mode: 'light' | 'dark' = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeHarness mode={mode}>
        <LandingScreen
          navigation={{ navigate } as never}
          route={{ key: 'Landing', name: 'Landing', params: undefined } as never}
        />
      </ThemeHarness>
    </SafeAreaProvider>
  );
}

describe('LandingScreen frame', () => {
  it('paints the canvas with the 32pt radius and the 1px hairline', () => {
    const { getByTestId } = renderLanding();

    const style = flattenStyle(getByTestId('onboarding-root').props.style);
    expect(style.backgroundColor).toBe('#F8FAFC');
    expect(style.borderRadius).toBe(32);
  });

  it('paints the 1px hairline as an inside stroke that takes no layout space', () => {
    const { getByTestId } = renderLanding();

    // Figma's frame stroke is an inside stroke. If it lived on the frame View,
    // Yoga (border-box) would shrink the content box to 388x846 and push every
    // Figma coordinate 1px down/right — buttons at x 31 instead of 30.
    const stroke = flattenStyle(getByTestId('onboarding-frame-stroke').props.style);
    expect(stroke.borderWidth).toBe(1);
    expect(stroke.borderColor).toBe('#E2E8F0');
    expect(stroke.borderRadius).toBe(32);
    expect(stroke.position).toBe('absolute');
    expect(getByTestId('onboarding-frame-stroke').props.pointerEvents).toBe('none');

    const frame = flattenStyle(getByTestId('onboarding-root').props.style);
    expect(frame.borderWidth).toBeUndefined();
  });

  it('leaves the full window to the layout, so the buttons stay centred', () => {
    const { getByTestId } = renderLanding();

    const footer = flattenStyle(getByTestId('onboarding-footer').props.style);
    const button = resolveStyle(getByTestId('onboarding-sign-in'));
    // 30 + 330 + 30 = 390: equal margins, no 1px drift from the frame stroke.
    expect((footer.paddingHorizontal as number) * 2 + (button.width as number)).toBe(390);
  });

  it('clips the hero', () => {
    const { getByTestId } = renderLanding();

    const style = flattenStyle(getByTestId('onboarding-hero').props.style);
    expect(style.overflow).toBe('hidden');
    expect(style.flex).toBe(1);
  });
});

describe('LandingScreen hero', () => {
  it('places the map at 428x571 @ (-18, 114)', () => {
    const { getByTestId } = renderLanding();

    const map = getByTestId('onboarding-map');
    const style = flattenStyle(map.props.style);
    expect(style.position).toBe('absolute');
    expect(style.width as number).toBeCloseTo(428, 0);
    expect(style.height as number).toBeCloseTo(571, 0);
    expect(style.left as number).toBeCloseTo(-18, 0);
    expect(style.top as number).toBeCloseTo(114, 0);
    expect(map.props.resizeMode).toBe('contain');
    expect(map.props.source).toBeDefined();
  });

  it('bleeds past both edges and clips at the 622 hero bottom', () => {
    const { getByTestId } = renderLanding();

    const style = flattenStyle(getByTestId('onboarding-map').props.style);
    const left = style.left as number;
    const top = style.top as number;
    expect(left).toBeLessThan(0);
    expect(left + (style.width as number)).toBeGreaterThan(390);
    expect(top + (style.height as number)).toBeGreaterThan(622);
  });

  it('places the 388x178 wordmark box at y 65', () => {
    const { getByTestId } = renderLanding();

    const style = flattenStyle(getByTestId('onboarding-wordmark').props.style);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(65);
    expect(style.left).toBe(1); // (390 - 388) / 2 — the box is centred in the frame
    expect(style.width).toBe(388);
    expect(style.height).toBe(178);
  });

  it('paints the map before the wordmark', () => {
    const { getByTestId } = renderLanding();

    const hero = getByTestId('onboarding-hero');
    const order = hero
      .findAll(
        (node: typeof hero) =>
          typeof node.type === 'string' &&
          ['onboarding-map', 'onboarding-wordmark'].includes(node.props.testID)
      )
      .map((node: typeof hero) => node.props.testID);

    expect(order).toEqual(['onboarding-map', 'onboarding-wordmark']);
  });
});

describe('LandingScreen footer', () => {
  it('renders both CTAs at 330x60 as full pills', () => {
    const { getByTestId } = renderLanding();

    for (const testID of ['onboarding-sign-in', 'onboarding-register']) {
      const style = resolveStyle(getByTestId(testID));
      expect(style.width).toBe(330);
      expect(style.height).toBe(60);
      // Figma v2: 100 on a 60pt control. Any radius >= height/2 renders the same
      // capsule, so the assertion is the SHAPE, not the spelling of the number.
      expect(style.borderRadius as number).toBeGreaterThanOrEqual(30);
      expect(style.borderRadius).not.toBe(25); // the compact rounded-rect
    }
  });

  it('fills Sign In yellow and Register cream with a 3px yellow border', () => {
    const { getByTestId } = renderLanding();

    const primary = resolveStyle(getByTestId('onboarding-sign-in'));
    expect(primary.backgroundColor).toBe('#FFC203');
    expect(primary.borderWidth).toBe(0);

    const secondary = resolveStyle(getByTestId('onboarding-register'));
    expect(secondary.backgroundColor).toBe('#FFF6EC');
    expect(secondary.borderWidth).toBe(3);
    expect(secondary.borderColor).toBe('#FFC203');
  });

  it('uses 30pt side margins, a 20pt lead-in, a 14pt button gap and 72pt of bottom space', () => {
    const { getByTestId } = renderLanding();

    const style = flattenStyle(getByTestId('onboarding-footer').props.style);
    expect(style.paddingHorizontal).toBe(30);
    expect(style.paddingTop).toBe(20);
    expect(style.paddingBottom).toBe(72);
    expect(style.gap).toBe(14);
  });

  it('labels the CTAs in Jost Black 32 black and renders no other copy', () => {
    const { getByText, queryByText } = renderLanding();

    for (const label of ['Sign In', 'Register']) {
      const style = flattenStyle(getByText(label).props.style);
      expect(style.color).toBe('#000000');
      expect(style.fontSize).toBe(32);
      expect(style.fontFamily).toBe('Jost_900Black');
    }

    expect(queryByText(/Plan trips together/)).toBeNull();
    expect(queryByText('Get started')).toBeNull();
    expect(queryByText('Log in')).toBeNull();
  });
});

describe('LandingScreen navigation', () => {
  it('navigates to Login on Sign In', () => {
    const navigate = jest.fn();
    const { getByTestId } = renderLanding(navigate);

    fireEvent.press(getByTestId('onboarding-sign-in'));

    expect(navigate).toHaveBeenCalledWith('Login', undefined);
  });

  it('navigates to Register on Register', () => {
    const navigate = jest.fn();
    const { getByTestId } = renderLanding(navigate);

    fireEvent.press(getByTestId('onboarding-register'));

    expect(navigate).toHaveBeenCalledWith('Register');
  });
});

describe('LandingScreen accessibility', () => {
  it('exposes the wordmark as one "Spots" header and both CTAs as buttons', () => {
    const { getByTestId, getByLabelText } = renderLanding();

    expect(getByLabelText('Spots')).toBeTruthy();
    expect(getByTestId('onboarding-wordmark').props.accessibilityRole).toBe('header');
    expect(getByTestId('onboarding-sign-in').props.accessibilityRole).toBe('button');
    expect(getByTestId('onboarding-register').props.accessibilityRole).toBe('button');
  });
});

// Landing became theme-aware with the dark-mode change, reversing the brand
// rollout's "Landing is unchanged" property. Everything above still describes
// the Figma frame in light mode. This describes what the dark ramp is allowed to
// move — the chrome — and what it must not: the brand controls.
describe('LandingScreen in dark mode', () => {
  function renderDark() {
    return renderLanding(jest.fn(), 'dark');
  }

  it('paints the dark canvas and the dark hairline', () => {
    const { getByTestId } = renderDark();

    expect(flattenStyle(getByTestId('onboarding-root').props.style).backgroundColor).toBe('#0F1115');
    expect(flattenStyle(getByTestId('onboarding-frame-stroke').props.style).borderColor).toBe(
      '#2E333B'
    );
  });

  it('keeps the CTAs brand yellow and cream with black labels', () => {
    const { getByTestId, getByText } = renderDark();

    expect(resolveStyle(getByTestId('onboarding-sign-in')).backgroundColor).toBe('#FFC203');

    const secondary = resolveStyle(getByTestId('onboarding-register'));
    expect(secondary.backgroundColor).toBe('#FFF6EC');
    expect(secondary.borderColor).toBe('#FFC203');

    for (const label of ['Sign In', 'Register']) {
      expect(flattenStyle(getByText(label).props.style).color).toBe('#000000');
    }
  });

  it('flips the wordmark glyphs to the dark ink', () => {
    // The glyphs read `brand.onCanvas`, not `brand.onPrimary`. Black here would
    // be 1.11:1 on the dark canvas — invisible.
    const { getByTestId } = renderDark();

    for (const testID of ['onboarding-wordmark-sp', 'onboarding-wordmark-ts']) {
      expect(flattenStyle(getByTestId(testID).props.style).color).toBe('#F5F5F5');
    }
  });

  it('flips the status bar to light content', () => {
    const { UNSAFE_getByType } = renderDark();
    expect(UNSAFE_getByType(StatusBar).props.style).toBe('light');
  });

  it('still renders dark status-bar glyphs in light mode', () => {
    const { UNSAFE_getByType } = renderLanding();
    expect(UNSAFE_getByType(StatusBar).props.style).toBe('dark');
  });

  it('does not put the spotty backdrop on the map hero', () => {
    // Structural, not a convention: Landing does not render `Screen` at all, so
    // it cannot opt into the backdrop by accident.
    const { queryByTestId } = renderDark();
    expect(queryByTestId('spots-backdrop')).toBeNull();
  });
});
