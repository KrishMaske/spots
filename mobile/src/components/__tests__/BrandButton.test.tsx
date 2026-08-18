// Source of truth for the `hero` cases: Figma file DMnEYcuVTiVNXZB7XHDwuN, node
// 4:75, as edited 2026-08-17 (v2: a 60pt full-pill CTA, was 330×78 radius 25).
// The `compact` cases have no Figma precedent and come from
// docs/plans/brand-rollout.md §3 (56pt control, 20px label, radius 25 and the
// same 3px stroke as the hero).
//
// Double-entry rule: every number and hex here is an independent literal, never
// imported from the theme. `minHeight === theme.size.control` would prove
// nothing; `minHeight === 56` proves the control matches the spec.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ActivityIndicator, Text } from 'react-native';

import { BrandButton } from '../BrandButton';
import { ThemeContext } from '../../theme/ThemeProvider';
import { darkTheme, lightTheme, Theme } from '../../theme/themes';
import { renderScreen } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

/** Pressable styles are a function of press state; resolve them the way RN does. */
function resolveStyle(element: { props: { style: unknown } }): Record<string, unknown> {
  const style = element.props.style;
  return flattenStyle(typeof style === 'function' ? style({ pressed: false }) : style);
}

function renderInTheme(theme: Theme, ui: React.ReactElement) {
  return render(
    <ThemeContext.Provider value={{ theme, preference: theme.mode, setPreference: () => {} }}>
      {ui}
    </ThemeContext.Provider>
  );
}

describe('BrandButton geometry and colors', () => {
  it('renders the primary variant as a filled brand-yellow CTA', () => {
    const { getByTestId } = renderScreen(
      <BrandButton testID="cta" label="Sign In" size="hero" onPress={() => {}} width={330} height={60} />
    );

    const style = resolveStyle(getByTestId('cta'));
    expect(style.backgroundColor).toBe('#FFC203');
    expect(style.borderWidth).toBe(0);
    // Figma v2: 100 on a 60pt control. Any radius >= height/2 renders the same
    // capsule, so the assertion is the SHAPE, not the spelling of the number.
    expect(style.borderRadius as number).toBeGreaterThanOrEqual(30);
    expect(style.borderRadius).not.toBe(25);
    expect(style.height).toBe(60);
    expect(style.width).toBe(330);
  });

  it('renders the secondary variant as cream with a 3px brand border', () => {
    const { getByTestId } = renderScreen(
      <BrandButton
        testID="cta"
        size="hero"
        label="Register"
        variant="secondary"
        onPress={() => {}}
        width={330}
        height={60}
      />
    );

    const style = resolveStyle(getByTestId('cta'));
    expect(style.backgroundColor).toBe('#FFF6EC');
    expect(style.borderWidth).toBe(3);
    expect(style.borderColor).toBe('#FFC203');
    expect(style.borderRadius as number).toBeGreaterThanOrEqual(30);
    expect(style.borderRadius).not.toBe(25);
    expect(style.height).toBe(60);
  });

  it('sets both labels in Jost Black 32 black', () => {
    for (const variant of ['primary', 'secondary'] as const) {
      const { getByTestId, UNSAFE_getByType, unmount } = renderScreen(
        <BrandButton
          testID="cta"
          label="Sign In"
          size="hero"
          variant={variant}
          onPress={() => {}}
          width={330}
          height={60}
        />
      );

      expect(getByTestId('cta')).toBeTruthy();
      const labelStyle = flattenStyle(UNSAFE_getByType(Text).props.style);
      expect(labelStyle.color).toBe('#000000');
      expect(labelStyle.fontSize).toBe(32);
      expect(labelStyle.fontFamily).toBe('Jost_900Black');
      unmount();
    }
  });
});

describe('BrandButton behaviour', () => {
  it('pins the label against OS font scaling', () => {
    const { UNSAFE_getByType } = renderScreen(
      <BrandButton testID="cta" label="Sign In" size="hero" onPress={() => {}} width={330} height={60} />
    );

    // The button is a fixed 60pt tall; a scaled 32px label would overflow it.
    expect(UNSAFE_getByType(Text).props.allowFontScaling).toBe(false);
  });

  it('calls onPress and exposes the button role', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderScreen(
      <BrandButton testID="cta" label="Sign In" size="hero" onPress={onPress} width={330} height={60} />
    );

    expect(getByTestId('cta').props.accessibilityRole).toBe('button');
    fireEvent.press(getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('BrandButton is mode-invariant', () => {
  it.each(['primary', 'secondary'] as const)('renders %s identically in light and dark', (variant) => {
    const button = (
      <BrandButton
        testID="cta"
        size="hero"
        label="Sign In"
        variant={variant}
        onPress={() => {}}
        width={330}
        height={60}
      />
    );

    const light = renderInTheme(lightTheme, button);
    const lightStyle = resolveStyle(light.getByTestId('cta'));
    const lightLabel = flattenStyle(light.UNSAFE_getByType(Text).props.style);
    light.unmount();

    const dark = renderInTheme(darkTheme, button);
    const darkStyle = resolveStyle(dark.getByTestId('cta'));
    const darkLabel = flattenStyle(dark.UNSAFE_getByType(Text).props.style);
    dark.unmount();

    expect(darkStyle).toEqual(lightStyle);
    expect(darkLabel).toEqual(lightLabel);
  });

  it.each(['primary', 'secondary'] as const)('renders compact %s identically in light and dark', (variant) => {
    const button = <BrandButton testID="cta" label="Log in" variant={variant} onPress={() => {}} />;

    const light = renderInTheme(lightTheme, button);
    const lightStyle = resolveStyle(light.getByTestId('cta'));
    const lightLabel = flattenStyle(light.UNSAFE_getByType(Text).props.style);
    light.unmount();

    const dark = renderInTheme(darkTheme, button);
    const darkStyle = resolveStyle(dark.getByTestId('cta'));
    const darkLabel = flattenStyle(dark.UNSAFE_getByType(Text).props.style);
    dark.unmount();

    expect(darkStyle).toEqual(lightStyle);
    expect(darkLabel).toEqual(lightLabel);
  });

  it('is invariant because the CONTROL ramp is, not because the theme is', () => {
    // Before dark mode existed, `theme.brand` was one shared object, so the four
    // cases above were true trivially. They are not any more: the theme really
    // does move between the two renders, and the button still comes out
    // identical. That is the executable proof the mode split was surgical —
    // chrome moved, controls did not.
    expect(lightTheme.brand.canvas).not.toBe(darkTheme.brand.canvas);
    expect(lightTheme.colors.surface).not.toBe(darkTheme.colors.surface);
    expect(lightTheme.brand.primary).toBe(darkTheme.brand.primary);
    expect(lightTheme.brand.onPrimary).toBe(darkTheme.brand.onPrimary);
    expect(lightTheme.brand.secondarySurface).toBe(darkTheme.brand.secondarySurface);
  });
});

describe('BrandButton compact geometry and colors', () => {
  it('defaults to compact — the form CTA outnumbers the hero', () => {
    const { getByTestId } = renderScreen(<BrandButton testID="cta" label="Log in" onPress={() => {}} />);

    const style = resolveStyle(getByTestId('cta'));
    expect(style.minHeight).toBe(56);
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
  });

  it('renders the compact primary as a filled brand-yellow capsule', () => {
    const { getByTestId } = renderScreen(
      <BrandButton testID="cta" label="Log in" size="compact" onPress={() => {}} />
    );

    const style = resolveStyle(getByTestId('cta'));
    expect(style.backgroundColor).toBe('#FFC203');
    expect(style.borderWidth).toBe(0);
    // RULE 3 WAS AMENDED BY FIGMA v2 (docs/plans/home-screen-and-onboarding-v2.md
    // §4): the hero is now a full pill and the compact control is not, so the
    // two sizes no longer share one curvature. The compact 25 is unchanged and
    // has no Figma precedent — it is the brand rollout's own value. Whether the
    // compact control (and, by Rule 4, every TextField) should be pilled to
    // match is O-4, deliberately deferred.
    expect(style.borderRadius).toBe(25);
    expect(style.minHeight).toBe(56);
    expect(style.alignSelf).toBe('stretch');
  });

  it('renders the compact secondary as cream with the same 3px brand border', () => {
    const { getByTestId } = renderScreen(
      <BrandButton testID="cta" label="Log out" size="compact" variant="secondary" onPress={() => {}} />
    );

    const style = resolveStyle(getByTestId('cta'));
    expect(style.backgroundColor).toBe('#FFF6EC');
    expect(style.borderWidth).toBe(3);
    expect(style.borderColor).toBe('#FFC203');
    expect(style.borderRadius).toBe(25);
    expect(style.minHeight).toBe(56);
  });

  it('sets the compact label in Jost Black 20 black', () => {
    const { UNSAFE_getByType } = renderScreen(
      <BrandButton testID="cta" label="Log in" size="compact" onPress={() => {}} />
    );

    const labelStyle = flattenStyle(UNSAFE_getByType(Text).props.style);
    expect(labelStyle.color).toBe('#000000');
    expect(labelStyle.fontSize).toBe(20);
    expect(labelStyle.fontFamily).toBe('Jost_900Black');
  });

  it('lets the compact label honour Dynamic Type', () => {
    const { UNSAFE_getByType } = renderScreen(
      <BrandButton testID="cta" label="Log in" size="compact" onPress={() => {}} />
    );

    // The deliberate hero/compact split: the hero is a fixed-geometry
    // transcription, a form button is not, so it grows with the OS setting.
    expect(UNSAFE_getByType(Text).props.allowFontScaling).not.toBe(false);
  });
});

describe('BrandButton press behaviour', () => {
  it('calls onPress when tapped and not disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderScreen(<BrandButton testID="cta" label="Log in" onPress={onPress} />);

    fireEvent.press(getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress while loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderScreen(<BrandButton testID="cta" label="Log in" onPress={onPress} loading />);

    fireEvent.press(getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('swaps the label for a spinner while loading', () => {
    const { UNSAFE_getByType, queryByText } = renderScreen(
      <BrandButton testID="cta" label="Log in" onPress={() => {}} loading />
    );

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(queryByText('Log in')).toBeNull();
  });

  it('keeps its accessible name while loading, when the label is gone', () => {
    const { getByTestId, getByLabelText } = renderScreen(
      <BrandButton testID="cta" label="Log in" onPress={() => {}} loading />
    );

    // Without an explicit accessibilityLabel this would announce "button, busy"
    // with no name, because the spinner has replaced the label text.
    expect(getByTestId('cta').props.accessibilityLabel).toBe('Log in');
    expect(getByLabelText('Log in')).toBeTruthy();
    expect(getByTestId('cta').props.accessibilityState.busy).toBe(true);
  });

  it('does not call onPress when disabled, and says so', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderScreen(<BrandButton testID="cta" label="Log in" onPress={onPress} disabled />);

    fireEvent.press(getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByTestId('cta').props.accessibilityState.disabled).toBe(true);
    expect(resolveStyle(getByTestId('cta')).opacity).toBe(0.6);
  });
});
