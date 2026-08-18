import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TextLink } from '../TextLink';
import { ThemeHarness } from '../../testing/screenTestUtils';
import { lightTheme } from '../../theme/themes';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

/** Pressable styles are a function of press state; resolve them the way RN does. */
function resolveStyle(element: { props: { style: unknown } }): Record<string, unknown> {
  const style = element.props.style;
  return flattenStyle(typeof style === 'function' ? style({ pressed: false }) : style);
}

/** Mode is pinned explicitly rather than inherited from jest's ambient color
 * scheme, so the light-mode assertions below say which mode they describe. */
function renderLink(ui: React.ReactElement, mode: 'light' | 'dark' = 'light') {
  return render(<ThemeHarness mode={mode}>{ui}</ThemeHarness>);
}

describe('TextLink', () => {
  it('is a transparent, borderless inline link', () => {
    const { getByTestId } = renderLink(<TextLink testID="link" label="Forgot password?" onPress={() => {}} />);

    const style = resolveStyle(getByTestId('link'));
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderWidth).toBeUndefined();
    // The 24pt inset that pushed footer links away from the text they follow.
    expect(style.paddingHorizontal).toBe(0);
  });

  it('sets the label in the neutral text color', () => {
    const { getByTestId } = renderLink(<TextLink testID="link" label="Forgot password?" onPress={() => {}} />);

    const labelStyle = flattenStyle(getByTestId('link').findByType(Text).props.style);
    expect(labelStyle.color).toBe(lightTheme.colors.text);
    expect(labelStyle.fontSize).toBe(14);
  });

  it('is never brand yellow — Rule 2: yellow is a fill, never a foreground', () => {
    const { getByTestId } = renderLink(<TextLink testID="link" label="Create an account" onPress={() => {}} />);

    const labelStyle = flattenStyle(getByTestId('link').findByType(Text).props.style);
    // 1.55:1 on the canvas. Links stay readable text, not brand color.
    expect(labelStyle.color).not.toBe('#FFC203');
  });

  it('keeps the button role so existing a11y queries stay valid', () => {
    const { getByTestId } = renderLink(<TextLink testID="link" label="Back to login" onPress={() => {}} />);

    // "link" would be semantically purer, but these navigate in-app and
    // behavior preservation beats semantic purity here.
    expect(getByTestId('link').props.accessibilityRole).toBe('button');
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderLink(<TextLink testID="link" label="Back to login" onPress={onPress} />);

    fireEvent.press(getByTestId('link'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('follows the text ramp into dark mode, still without turning yellow', () => {
    const { getByTestId } = renderLink(
      <TextLink testID="link" label="Forgot password?" onPress={() => {}} />,
      'dark'
    );

    const labelStyle = flattenStyle(getByTestId('link').findByType(Text).props.style);
    expect(labelStyle.color).toBe('#F5F5F5');
    expect(labelStyle.color).not.toBe('#FFC203');
    expect(resolveStyle(getByTestId('link')).backgroundColor).toBe('transparent');
  });
});
