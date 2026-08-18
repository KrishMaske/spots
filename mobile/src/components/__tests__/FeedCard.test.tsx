// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, frame `home-screen`,
// node 4:164. Every number and hex here is an independent literal, never
// imported from the theme.

import React from 'react';
import { Image } from 'react-native';

import { FeedCard } from '../FeedCard';
import { renderScreen } from '../../testing/screenTestUtils';

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

/** The clipped inner view is the card's only child. */
function innerStyle(card: { props: { children: unknown } }): Record<string, unknown> {
  const inner = (card.props.children as { props: { style: unknown } });
  return flattenStyle(inner.props.style);
}

describe('FeedCard geometry and fill', () => {
  it('renders at the size it is given and does no arithmetic of its own', () => {
    const { getByTestId } = renderScreen(<FeedCard testID="card" width={326} height={236} />);

    const style = flattenStyle(getByTestId('card').props.style);
    expect(style.width).toBe(326);
    expect(style.height).toBe(236);
  });

  it('clips the inner view at radius 50 over the warm raised surface', () => {
    const { getByTestId } = renderScreen(<FeedCard testID="card" width={326} height={236} />);

    const inner = innerStyle(getByTestId('card'));
    expect(inner.borderRadius).toBe(50);
    expect(inner.overflow).toBe('hidden');
    expect(inner.backgroundColor).toBe('#FAF8F6');
  });

  it('sits on the LIFTED dark surface in dark mode', () => {
    // No dark 4:164 frame exists, so this is a pick, not a transcription. It was
    // #1A1D23 — the same value as `colors.surface`, 1.12:1 from the canvas, with
    // a black shadow that does nothing on #0F1115. #373E4A is 1.76:1 from the
    // canvas, which is what makes a card read as a card in dark mode.
    const { getByTestId } = renderScreen(
      <FeedCard testID="card" width={326} height={236} />,
      'dark'
    );

    expect(innerStyle(getByTestId('card')).backgroundColor).toBe('#373E4A');
  });
});

describe('FeedCard shadow', () => {
  it('carries the Figma drop shadow on the OUTER view', () => {
    const { getByTestId } = renderScreen(<FeedCard testID="card" width={326} height={236} />);

    const style = flattenStyle(getByTestId('card').props.style);
    expect(style.shadowColor).toBe('#000000');
    expect(style.shadowOffset).toEqual({ width: 0, height: 4 });
    expect(style.shadowOpacity).toBe(0.35);
    // 5, not 10: a CSS blur-radius b is a Gaussian of ~b/2, which is what iOS
    // `shadowRadius` takes.
    expect(style.shadowRadius).toBe(5);
    expect(style.elevation).toBe(6);
  });

  it('never sets overflow on the shadow owner — the iOS clipping trap', () => {
    // On iOS, `overflow: 'hidden'` and a shadow on the same view clip the
    // shadow away entirely. The card would then be 1.01:1 against the canvas,
    // i.e. invisible. This is the whole reason FeedCard is two views.
    const { getByTestId } = renderScreen(<FeedCard testID="card" width={326} height={236} />);

    expect(flattenStyle(getByTestId('card').props.style).overflow).toBeUndefined();
  });
});

describe('FeedCard states', () => {
  it('renders the empty state with no image and nothing to announce', () => {
    // The empty card IS the Figma frame — there is no feed API and no trip
    // model, so an image slot with no image is the designed state.
    const { getByTestId, UNSAFE_queryAllByType } = renderScreen(
      <FeedCard testID="card" width={326} height={236} />
    );

    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(getByTestId('card').props.accessible).toBe(false);
  });

  it('renders one cover-cropped image when given a source', () => {
    const { getByTestId, UNSAFE_getAllByType } = renderScreen(
      <FeedCard testID="card" width={326} height={236} source={{ uri: 'https://example.test/a.jpg' }} />
    );

    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.resizeMode).toBe('cover');
    expect(getByTestId('card').props.accessible).not.toBe(false);
  });

  it('takes an accessible name when one is supplied', () => {
    const { getByTestId } = renderScreen(
      <FeedCard testID="card" width={326} height={236} accessibilityLabel="Trip to Lisbon" />
    );

    expect(getByTestId('card').props.accessibilityLabel).toBe('Trip to Lisbon');
    expect(getByTestId('card').props.accessible).not.toBe(false);
  });
});
