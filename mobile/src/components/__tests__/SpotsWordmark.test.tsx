// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, node 4:75. Every number
// here is an independent Figma literal, never imported from `onboardingSpec`.

import React from 'react';
import { Text } from 'react-native';

import { SpotsWordmark } from '../SpotsWordmark';
import { renderScreen } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

describe('SpotsWordmark', () => {
  it('renders "sp" and "ts" as separate nodes, with no whitespace hack', () => {
    const { UNSAFE_getAllByType, queryByText, getByTestId } = renderScreen(<SpotsWordmark />);

    const texts = UNSAFE_getAllByType(Text);
    expect(texts).toHaveLength(2);
    expect(texts[0].props.children).toBe('sp');
    expect(texts[1].props.children).toBe('ts');
    expect(getByTestId('onboarding-wordmark-sp')).toBeTruthy();
    expect(getByTestId('onboarding-wordmark-ts')).toBeTruthy();
    expect(queryByText('sp  ts')).toBeNull();
  });

  it('sets both glyph runs in Jost Black 96 black', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark />);

    for (const testID of ['onboarding-wordmark-sp', 'onboarding-wordmark-ts']) {
      const style = flattenStyle(getByTestId(testID).props.style);
      expect(style.fontFamily).toBe('Jost_900Black');
      expect(style.fontSize).toBe(96);
      expect(style.color).toBe('#000000');
    }
  });

  it('renders the brandmark ring at 92x123 from the bundled asset', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark />);

    const dot = getByTestId('onboarding-logo');
    const style = flattenStyle(dot.props.style);
    expect(style.width).toBe(92);
    expect(style.height).toBe(123);
    expect(style.position).toBe('absolute');
    expect(dot.props.source).toBeDefined();
    // Figma v2 transcribes `object-cover`. The source is 1512x2016 (0.7500) in
    // a 92x123 box (0.7480), so cover crops ~0.12pt a side; `stretch` was only
    // ever justified by the old SQUARE cluster source in a 69x68 box.
    expect(dot.props.resizeMode).toBe('cover');
    // Figma's borderRadius 52.5 is a fill-mask artifact on an alpha PNG and is
    // deliberately not shipped — rounding a transparent ring can only clip it.
    expect(style.borderRadius).toBeUndefined();
  });

  it('pins the display type against OS font scaling', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark />);

    // The gap width, the cluster and the 388x178 box are fixed, so scaled
    // glyphs would overflow the box and push the dot out of the letter gap.
    expect(getByTestId('onboarding-wordmark-sp').props.allowFontScaling).toBe(false);
    expect(getByTestId('onboarding-wordmark-ts').props.allowFontScaling).toBe(false);
  });

  it('lets the mark overhang the gap instead of widening the slot', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark />);

    const slot = getByTestId('onboarding-wordmark-gap');
    const slotStyle = flattenStyle(slot.props.style);
    expect(slotStyle.width as number).toBeLessThan(92);
    expect(slotStyle.overflow).toBe('visible');

    // The dot is a child of the slot, centred on it, so it hangs out both sides.
    expect(slot.findByProps({ testID: 'onboarding-logo' })).toBeTruthy();
    const dotStyle = flattenStyle(getByTestId('onboarding-logo').props.style);
    expect(dotStyle.left as number).toBeLessThan(0);
  });

  it('exposes one composed accessible name', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark />);

    const box = getByTestId('onboarding-wordmark');
    expect(box.props.accessibilityRole).toBe('header');
    expect(box.props.accessibilityLabel).toBe('Spots');
    expect(getByTestId('onboarding-logo').props.accessible).toBe(false);
    expect(getByTestId('onboarding-wordmark-sp').props.accessible).toBe(false);
  });

  it('scales the type, the box and the mark together', () => {
    const { getByTestId } = renderScreen(<SpotsWordmark scale={0.5} />);

    expect(flattenStyle(getByTestId('onboarding-wordmark-sp').props.style).fontSize).toBe(48);

    const box = flattenStyle(getByTestId('onboarding-wordmark').props.style);
    expect(box.width).toBe(194);
    expect(box.height).toBe(89);

    const dot = flattenStyle(getByTestId('onboarding-logo').props.style);
    expect(dot.width).toBe(46);
    expect(dot.height).toBe(61.5);
  });

  it('renders at header scale as the same optical size as the title type', () => {
    // WORDMARK_HEADER_SCALE = typography.title.fontSize / 96 = 0.25, the size
    // the retired BrandMark variant="small" rendered "Spots" at. Asserted as
    // literals, per the double-entry rule.
    const { getByTestId } = renderScreen(<SpotsWordmark scale={0.25} />);

    expect(flattenStyle(getByTestId('onboarding-wordmark-sp').props.style).fontSize).toBe(24);

    const box = flattenStyle(getByTestId('onboarding-wordmark').props.style);
    expect(box.width).toBe(97);
    expect(box.height).toBe(44.5);

    const dot = flattenStyle(getByTestId('onboarding-logo').props.style);
    expect(dot.width).toBe(23);
    expect(dot.height).toBe(30.75);
  });

  it('sets the glyphs in the dark ink on the dark canvas', () => {
    // The glyphs read `brand.onCanvas` — marks ON THE PAGE — not
    // `brand.onPrimary`, which is the label on the yellow. The two are the same
    // black in light mode, so the light case above cannot tell them apart; this
    // is the case that can.
    const { getByTestId } = renderScreen(<SpotsWordmark />, 'dark');

    for (const testID of ['onboarding-wordmark-sp', 'onboarding-wordmark-ts']) {
      expect(flattenStyle(getByTestId(testID).props.style).color).toBe('#F5F5F5');
    }
  });

  it('leaves the brandmark to composite on its own in both modes', () => {
    // The asset is yellow circles on transparent alpha, so it needs no dark
    // variant: 1.55:1 on the light canvas (decorative) and 11.67:1 on the dark.
    const light = renderScreen(<SpotsWordmark />).getByTestId('onboarding-logo');
    const dark = renderScreen(<SpotsWordmark />, 'dark').getByTestId('onboarding-logo');

    expect(dark.props.source).toEqual(light.props.source);
    expect(flattenStyle(dark.props.style).tintColor).toBeUndefined();
  });
});
