// `Screen` had no test before the backdrop landed. The `backdrop` prop needs
// one, and so does the `StatusBar` expression: it has existed since the brand
// rollout but was never exercised, because the canvas under it never went dark.
//
// Double-entry rule: the canvas hexes are literals, not theme reads.

import React from 'react';
import { render } from '@testing-library/react-native';
import { KeyboardAvoidingView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Screen } from '../Screen';
import { ThemeHarness } from '../../testing/screenTestUtils';

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

function renderScreenComponent(ui: React.ReactElement, mode: 'light' | 'dark' = 'light') {
  return render(<ThemeHarness mode={mode}>{ui}</ThemeHarness>);
}

/** Walks up from a node to the first ancestor whose style defines `key`, so the
 * assertion doesn't depend on how many composite nodes RNTL puts in between —
 * the same technique `TextField.test.tsx` uses for the field row. */
function ancestorStyleWith(node: unknown, key: string): Record<string, unknown> {
  let current = (node as { parent: unknown }).parent as {
    parent: unknown;
    props?: { style?: unknown };
  } | null;

  while (current) {
    const style = flattenStyle(current.props?.style);
    if (style[key] !== undefined) return style;
    current = current.parent as typeof current;
  }
  throw new Error(`no ancestor style defines "${key}"`);
}

describe('Screen backdrop is opt-in', () => {
  it('renders no backdrop by default', () => {
    // The Home/default guarantee, as an executable rule rather than a
    // convention someone has to remember. A missing prop is invisible; this is
    // what makes the omission checkable.
    const { queryByTestId } = renderScreenComponent(
      <Screen>
        <Text>content</Text>
      </Screen>
    );

    expect(queryByTestId('spots-backdrop')).toBeNull();
  });

  it('renders no backdrop when explicitly asked for none', () => {
    const { queryByTestId } = renderScreenComponent(
      <Screen backdrop="none">
        <Text>content</Text>
      </Screen>
    );

    expect(queryByTestId('spots-backdrop')).toBeNull();
  });

  it('renders the backdrop when opted in, and never lets it take a touch', () => {
    const { getByTestId } = renderScreenComponent(
      <Screen backdrop="spots">
        <Text>content</Text>
      </Screen>
    );

    expect(getByTestId('spots-backdrop').props.pointerEvents).toBe('none');
  });
});

describe('Screen backdrop placement is load-bearing', () => {
  it('paints the backdrop BEFORE the content, so it sits behind it', () => {
    const { getByTestId, UNSAFE_root } = renderScreenComponent(
      <Screen backdrop="spots">
        <Text testID="screen-content">content</Text>
      </Screen>
    );

    const order = UNSAFE_root
      .findAll(
        (node: { type: unknown; props: { testID?: string } }) =>
          typeof node.type === 'string' &&
          ['spots-backdrop', 'screen-content'].includes(node.props.testID ?? '')
      )
      .map((node: { props: { testID?: string } }) => node.props.testID);

    expect(order).toEqual(['spots-backdrop', 'screen-content']);
    expect(getByTestId('spots-backdrop')).toBeTruthy();
  });

  it('keeps the backdrop OUTSIDE KeyboardAvoidingView, so it cannot slide', () => {
    // R7. Inside it, the whole backdrop would jump several hundred points when
    // the keyboard opens — far more distracting than the drift it provides.
    const { getByTestId, UNSAFE_getByType } = renderScreenComponent(
      <Screen backdrop="spots">
        <Text>content</Text>
      </Screen>
    );

    // Sanity: the KeyboardAvoidingView the form content lives in really exists,
    // so "no ancestor" below is a real fact and not a vacuous one.
    expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();

    let node = getByTestId('spots-backdrop').parent as { parent: unknown; type: unknown } | null;
    while (node) {
      expect(node.type).not.toBe(KeyboardAvoidingView);
      node = node.parent as typeof node;
    }
  });

  it('paints the canvas on the root, outside the safe area', () => {
    // The backdrop's parent is what carries the canvas fill; if the fill moved
    // back down onto the SafeAreaView, the layer would have nothing full-bleed
    // to sit on.
    const { getByTestId } = renderScreenComponent(
      <Screen backdrop="spots">
        <Text>content</Text>
      </Screen>
    );

    expect(ancestorStyleWith(getByTestId('spots-backdrop'), 'backgroundColor').backgroundColor).toBe(
      '#F8FAFC'
    );
  });

  it('paints the dark canvas in dark mode', () => {
    const { getByTestId } = renderScreenComponent(
      <Screen backdrop="spots">
        <Text>content</Text>
      </Screen>,
      'dark'
    );

    expect(ancestorStyleWith(getByTestId('spots-backdrop'), 'backgroundColor').backgroundColor).toBe(
      '#0F1115'
    );
  });
});

describe('Screen status bar follows the mode', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)('renders %s mode with %s status-bar content', (mode, expected) => {
    const { UNSAFE_getByType } = renderScreenComponent(
      <Screen>
        <Text>content</Text>
      </Screen>,
      mode
    );

    expect(UNSAFE_getByType(StatusBar).props.style).toBe(expected);
  });
});

describe('Screen keeps the brand gutter', () => {
  it('insets the content column by the onboarding side margin', () => {
    // 30, not 24: a user taps a CTA inset 30pt on Landing and lands here.
    const { getByTestId } = renderScreenComponent(
      <Screen>
        <Text testID="screen-content">content</Text>
      </Screen>
    );

    expect(
      ancestorStyleWith(getByTestId('screen-content'), 'paddingHorizontal').paddingHorizontal
    ).toBe(30);
  });
});
