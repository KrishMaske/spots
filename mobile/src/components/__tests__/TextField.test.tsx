// Geometry literals come from docs/plans/brand-rollout.md §5 (Rule 4 — controls
// share one silhouette: 56pt tall, radius 25, the same capsule as the compact
// CTA). Per the double-entry rule they are hardcoded, never imported from the
// theme; the exception is the danger color, which is a semantic token the
// repoint deliberately did not touch.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TextField } from '../TextField';
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

/** Mode is pinned explicitly rather than inherited from jest's ambient color
 * scheme — the literals below are light-mode values and should say so. */
function renderField(ui: React.ReactElement, mode: 'light' | 'dark' = 'light') {
  return render(<ThemeHarness mode={mode}>{ui}</ThemeHarness>);
}

/** The capsule geometry lives on the row View wrapping the input; walk up to
 * the first ancestor that carries a border, so the test doesn't depend on how
 * many host/composite nodes RNTL puts in between. */
function rowStyle(input: { parent: unknown }): Record<string, unknown> {
  let node = input.parent as { parent: unknown; props?: { style?: unknown } } | null;
  while (node) {
    const style = flattenStyle(node.props?.style);
    if (style.borderWidth !== undefined) return style;
    node = node.parent as typeof node;
  }
  throw new Error('no bordered ancestor found for the input');
}

describe('TextField capsule geometry', () => {
  it('matches the compact CTA: 56 tall, radius 25, white on the tinted canvas', () => {
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />
    );

    const style = rowStyle(getByTestId('field'));
    expect(style.minHeight).toBe(56);
    expect(style.borderRadius).toBe(25);
    expect(style.backgroundColor).toBe('#FFFFFF');
  });

  it('draws the resting boundary as the brand hairline at a constant 2', () => {
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />
    );

    const style = rowStyle(getByTestId('field'));
    expect(style.borderColor).toBe('#E2E8F0');
    // Constant in every state — a varying width would jitter the layout on
    // focus, because Yoga is border-box.
    expect(style.borderWidth).toBe(2);
  });

  it('switches the border to brand yellow on focus without moving the layout', () => {
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />
    );

    fireEvent(getByTestId('field'), 'focus');
    const focusedStyle = rowStyle(getByTestId('field'));
    expect(focusedStyle.borderColor).toBe('#FFC203');
    expect(focusedStyle.borderWidth).toBe(2);

    fireEvent(getByTestId('field'), 'blur');
    expect(rowStyle(getByTestId('field')).borderColor).toBe('#E2E8F0');
  });

  it('uses the danger border when there is an error, focus notwithstanding', () => {
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} error="Email is required." />
    );

    fireEvent(getByTestId('field'), 'focus');
    const style = rowStyle(getByTestId('field'));
    expect(style.borderColor).toBe(lightTheme.colors.danger);
    expect(style.borderWidth).toBe(2);
  });
});

describe('TextField capsule geometry in dark mode', () => {
  it('drops the field fill to the dark surface on the dark canvas', () => {
    // 1.12:1 against the canvas — deliberately subtle separation, mirroring
    // light's 1.05:1 white-on-slate.
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />,
      'dark'
    );

    const style = rowStyle(getByTestId('field'));
    expect(style.backgroundColor).toBe('#1A1D23');
    expect(style.borderColor).toBe('#2E333B');
    // The silhouette is chrome-independent: same capsule, both modes.
    expect(style.minHeight).toBe(56);
    expect(style.borderRadius).toBe(25);
    expect(style.borderWidth).toBe(2);
  });

  it('keeps the focus ring the one brand yellow — which finally clears 1.4.11', () => {
    // #FFC203 on #1A1D23 is 10.43:1, versus 1.62:1 on light's white fill. Dark
    // mode is the first time the focused boundary is compliant.
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />,
      'dark'
    );

    fireEvent(getByTestId('field'), 'focus');
    expect(rowStyle(getByTestId('field')).borderColor).toBe('#FFC203');
  });
});

describe('TextField content', () => {
  it('renders the error string instead of the helper text', () => {
    const { getByText, queryByText } = renderField(
      <TextField
        testID="field"
        label="Password"
        value=""
        onChangeText={() => {}}
        error="Too short."
        helperText="At least 8 characters."
      />
    );

    expect(getByText('Too short.')).toBeTruthy();
    expect(queryByText('At least 8 characters.')).toBeNull();
  });

  it('renders the helper text when there is no error', () => {
    const { getByText } = renderField(
      <TextField
        testID="field"
        label="Password"
        value=""
        onChangeText={() => {}}
        helperText="At least 8 characters."
      />
    );

    expect(getByText('At least 8 characters.')).toBeTruthy();
  });

  it('reports typing to onChangeText', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={onChangeText} />
    );

    fireEvent.changeText(getByTestId('field'), 'krish@example.com');
    expect(onChangeText).toHaveBeenCalledWith('krish@example.com');
  });

  it('honours editable={false}', () => {
    const { getByTestId } = renderField(
      <TextField testID="field" label="Email" value="krish@example.com" onChangeText={() => {}} editable={false} />
    );

    expect(getByTestId('field').props.editable).toBe(false);
  });
});

describe('TextField show/hide toggle', () => {
  it('is absent for a non-secure field', () => {
    const { queryByLabelText } = renderField(
      <TextField testID="field" label="Email" value="" onChangeText={() => {}} />
    );

    expect(queryByLabelText('Show password')).toBeNull();
  });

  it('flips secureTextEntry — the only real behavior in the component', () => {
    const { getByTestId, getByLabelText } = renderField(
      <TextField testID="field" label="Password" value="hunter2" onChangeText={() => {}} secureTextEntry />
    );

    expect(getByTestId('field').props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText('Show password'));
    expect(getByTestId('field').props.secureTextEntry).toBe(false);

    fireEvent.press(getByLabelText('Hide password'));
    expect(getByTestId('field').props.secureTextEntry).toBe(true);
  });
});
