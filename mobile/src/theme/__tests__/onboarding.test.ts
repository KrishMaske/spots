// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, frame `spots-onboarding`,
// node 4:75.
//
// Double-entry bookkeeping: every number below is written out as a Figma
// literal. These tests deliberately do NOT import `onboardingSpec` — asserting
// `height === onboardingSpec.footer.buttonHeight` would prove nothing;
// asserting `height === 78` proves the layout matches the design.

import { computeOnboardingLayout } from '../onboarding';

const NO_INSETS = { top: 0, bottom: 0 };

/** First content row of map.png (alpha > 8) at y 573 of 2016. */
const MAP_CONTENT_TOP_RATIO = 573 / 2016;

describe('computeOnboardingLayout at the 390x848 reference', () => {
  const layout = computeOnboardingLayout({ width: 390, height: 848, insets: NO_INSETS });

  // Figma v2: the footer decomposes differently but sums to the SAME 226, which
  // is why the hero is still 622 and the map is still at y 114.
  it('decomposes the footer exactly as Figma does (20 + 60 + 14 + 60 + 72)', () => {
    expect(layout.footerTopPadding).toBe(20);
    expect(layout.bottomPadding).toBe(72);
    expect(layout.footerHeight).toBe(226);
    expect(layout.heroHeight).toBe(622);
  });

  it('sizes the buttons to the Figma frame', () => {
    expect(layout.buttonWidth).toBe(330);
    expect(layout.buttonHeight).toBe(60);
    expect(layout.buttonGap).toBe(14);
    expect(layout.sideMargin).toBe(30);
    // No `buttonRadius`: the v2 CTA is a full pill, which is a token
    // (`radius.pill`), not a layout measurement. See the plan §4.
  });

  it('places the wordmark box at the Figma coordinates and full scale', () => {
    expect(layout.wordmark.top).toBe(65);
    expect(layout.wordmark.boxWidth).toBe(388);
    expect(layout.wordmark.boxHeight).toBe(178);
    expect(layout.wordmark.fontSize).toBe(96);
    expect(layout.wordmark.scale).toBe(1);
    // Figma v2: the "o" is the 92×123 dot RING, not the 69×68 cluster.
    expect(layout.wordmark.dot.width).toBe(92);
    expect(layout.wordmark.dot.height).toBe(123);
  });

  it('places the map at 428x571 @ (-18, 114)', () => {
    expect(layout.map.width).toBeCloseTo(428, 0);
    // 3:4 of the source gives 570.67; Figma rounds it to 571.
    expect(layout.map.height).toBeCloseTo(571, 0);
    expect(layout.map.left).toBeCloseTo(-18, 0);
    expect(layout.map.top).toBeCloseTo(114, 0);
  });

  it('centres the wordmark box and keeps the map 1px right of dead-centre', () => {
    // Figma: the 388-wide wordmark box sits flush against the right edge of the
    // 390 frame; the 428-wide map is at x = -18, where dead-centre would be -19.
    expect(layout.wordmark.left).toBe(1);
    expect(layout.wordmark.left + layout.wordmark.boxWidth).toBe(389);
    expect(layout.map.left + layout.map.width / 2).toBeCloseTo(196, 5);
  });

  it('bleeds horizontally and clips at the bottom of the hero', () => {
    expect(layout.map.left).toBeLessThan(0);
    expect(layout.map.left + layout.map.width).toBeGreaterThan(390);
    expect(layout.map.top + layout.map.height).toBeGreaterThan(layout.heroHeight);
  });
});

describe('computeOnboardingLayout on a shorter phone (375x667)', () => {
  const layout = computeOnboardingLayout({ width: 375, height: 667, insets: NO_INSETS });

  it('keeps the footer intrinsic and the margins/heights unchanged', () => {
    expect(layout.heroHeight).toBe(441);
    expect(layout.buttonWidth).toBe(315);
    expect(layout.buttonHeight).toBe(60);
    expect(layout.sideMargin).toBe(30);
  });

  it('scales the wordmark down proportionally', () => {
    expect(layout.wordmark.scale).toBeCloseTo(0.9615, 3);
  });

  it('clamps the map so its content never collides with the wordmark', () => {
    expect(layout.map.height).toBeLessThan(((375 + 38) * 4) / 3);
    const mapContentTop = layout.map.top + MAP_CONTENT_TOP_RATIO * layout.map.height;
    expect(mapContentTop).toBeGreaterThanOrEqual(layout.wordmark.top + layout.wordmark.boxHeight);
  });
});

describe('computeOnboardingLayout on a taller phone (430x932)', () => {
  const layout = computeOnboardingLayout({ width: 430, height: 932, insets: NO_INSETS });

  it('gives the extra height to the hero only', () => {
    expect(layout.heroHeight).toBe(706);
    expect(layout.buttonWidth).toBe(370);
  });

  it('preserves the bleed and the bottom clip without clamping', () => {
    expect(layout.map.left).toBeCloseTo(-18, 0);
    expect(layout.map.left + layout.map.width).toBeGreaterThan(430);
    expect(layout.wordmark.left).toBe(21); // (430 - 388) / 2 — still centred
    expect(layout.map.height).toBeCloseTo(((430 + 38) * 4) / 3, 5);
    expect(layout.map.top + layout.map.height).toBeGreaterThan(layout.heroHeight);
  });

  it('does not scale the wordmark up', () => {
    expect(layout.wordmark.scale).toBe(1);
  });
});

describe('safe-area behaviour', () => {
  it('pushes the wordmark down under a notch but leaves the bottom padding alone', () => {
    const layout = computeOnboardingLayout({
      width: 390,
      height: 848,
      insets: { top: 59, bottom: 34 },
    });

    expect(layout.wordmark.top).toBe(71); // 59 + 12
    expect(layout.bottomPadding).toBe(72); // 72 already clears a 34pt home indicator
  });

  it('grows the footer when the bottom inset exceeds 72', () => {
    const layout = computeOnboardingLayout({
      width: 390,
      height: 848,
      insets: { top: 0, bottom: 80 },
    });

    expect(layout.bottomPadding).toBe(80);
    expect(layout.footerHeight).toBe(234); // 20 + 60 + 14 + 60 + 80
    expect(layout.heroHeight).toBe(848 - 234);
  });
});

describe('invariants at every size', () => {
  const sizes = [
    { width: 390, height: 848 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
  ];

  it.each(sizes)('holds at $width x $height', ({ width, height }) => {
    const layout = computeOnboardingLayout({ width, height, insets: NO_INSETS });

    expect(layout.heroHeight + layout.footerHeight).toBe(height);
    expect(layout.buttonWidth + 2 * layout.sideMargin).toBe(width);
    expect(layout.map.width / layout.map.height).toBeCloseTo(0.75, 3);
  });
});
