import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FormError } from '../FormError';
import { ThemeHarness } from '../../testing/screenTestUtils';
import { lightTheme } from '../../theme/themes';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

describe('FormError', () => {
  it('renders nothing when message is empty', () => {
    const { queryByTestId } = render(
      <ThemeHarness mode="light">
        <FormError testID="form-error" message={undefined} />
      </ThemeHarness>
    );

    expect(queryByTestId('form-error')).toBeNull();
  });

  it('renders nothing when message is null', () => {
    const { queryByTestId } = render(
      <ThemeHarness mode="light">
        <FormError testID="form-error" message={null} />
      </ThemeHarness>
    );

    expect(queryByTestId('form-error')).toBeNull();
  });

  it('applies the danger color for the default (error) variant', () => {
    const { getByTestId } = render(
      <ThemeHarness mode="light">
        <FormError testID="form-error" message="Something went wrong" />
      </ThemeHarness>
    );

    const banner = getByTestId('form-error');
    const style = flattenStyle(banner.props.style);
    expect(style.borderColor).toBe(lightTheme.colors.danger);

    const label = banner.findByType(Text);
    const labelStyle = flattenStyle(label.props.style);
    expect(labelStyle.color).toBe(lightTheme.colors.danger);
  });

  it('does not use danger styling for the info variant', () => {
    const { getByTestId } = render(
      <ThemeHarness mode="light">
        <FormError testID="form-error" variant="info" message="Confirm your email to continue." />
      </ThemeHarness>
    );

    const banner = getByTestId('form-error');
    const style = flattenStyle(banner.props.style);
    expect(style.borderColor).not.toBe(lightTheme.colors.danger);
    expect(style.borderColor).toBe(lightTheme.colors.border);

    const label = banner.findByType(Text);
    const labelStyle = flattenStyle(label.props.style);
    expect(labelStyle.color).not.toBe(lightTheme.colors.danger);
    expect(labelStyle.color).toBe(lightTheme.colors.text);
  });

  it('builds the info variant from the DARK surface/border/text in dark mode', () => {
    // Literals, per the double-entry rule: this proves the banner followed the
    // dark ramp rather than that it read some token.
    const { getByTestId } = render(
      <ThemeHarness mode="dark">
        <FormError testID="form-error" variant="info" message="Confirm your email to continue." />
      </ThemeHarness>
    );

    const banner = getByTestId('form-error');
    const style = flattenStyle(banner.props.style);
    expect(style.backgroundColor).toBe('#1A1D23');
    expect(style.borderColor).toBe('#2E333B');

    const labelStyle = flattenStyle(banner.findByType(Text).props.style);
    expect(labelStyle.color).toBe('#F5F5F5');
  });

  it('keeps the danger ramp mode-invariant, so the error banner does not move', () => {
    const { getByTestId } = render(
      <ThemeHarness mode="dark">
        <FormError testID="form-error" message="Something went wrong" />
      </ThemeHarness>
    );

    const banner = getByTestId('form-error');
    expect(flattenStyle(banner.props.style).borderColor).toBe(lightTheme.colors.danger);
    expect(flattenStyle(banner.findByType(Text).props.style).color).toBe(lightTheme.colors.danger);
  });
});
