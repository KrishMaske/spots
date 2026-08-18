// Source of truth: Figma file DMnEYcuVTiVNXZB7XHDwuN, frame `home-screen`,
// node 4:164 — EXCEPT for the feed's own geometry, which Krish deliberately
// overrode on 2026-08-17 (gutters 26, cards 338×600, gap 30). The frame's own
// numbers (32, 326×236, 28) are kept in comments as provenance, so the departure
// stays visible instead of reading as drift.
//
// Double-entry bookkeeping: every number below is written out as a literal.
// These tests deliberately do NOT import `homeSpec` — asserting
// `cardHeight === homeSpec.feed.cardHeight` would prove nothing; asserting
// `cardHeight === 600` proves the layout matches what ships.

import { computeHomeLayout, navMotion } from '../home';

const NO_INSETS = { top: 0, bottom: 0 };

describe('computeHomeLayout at the 390x844 reference', () => {
  const { feed, nav } = computeHomeLayout({ width: 390, height: 844, insets: NO_INSETS });

  it('splits the frame into a 718pt feed, an 87pt nav and a 39pt tail', () => {
    expect(feed.height).toBe(718);
    expect(nav.height).toBe(87);
    expect(nav.bottomGap).toBe(39);
    expect(nav.totalHeight).toBe(126);
    expect(feed.height + nav.height + nav.bottomGap).toBe(844);
  });

  it('sizes the feed cards to the shipped tall-image column', () => {
    // Krish's override. The frame drew 32 / 326×236 / 28.
    expect(feed.sideMargin).toBe(26);
    expect(feed.cardWidth).toBe(338);
    expect(feed.cardHeight).toBe(600);
    expect(feed.cardGap).toBe(30);
    expect(feed.topPadding).toBe(58);
    // 30 gap + the bar's whole 126pt footprint. See the next test.
    expect(feed.bottomPadding).toBe(156);
    // 26 + 338 + 26 = 390 — the cards are still centred with equal gutters.
    expect(feed.sideMargin * 2 + feed.cardWidth).toBe(390);
  });

  it('pads the feed enough to scroll the LAST card clear of the floating bar', () => {
    // The bar is absolutely positioned, so it overlays the scene instead of
    // reserving space: it sits over the bottom 126pt (87 nav + 39 tail). At the
    // old 30pt padding the last card could never be scrolled out from under it.
    expect(feed.bottomPadding).toBe(30 + 126);
    expect(feed.bottomPadding).toBeGreaterThan(nav.totalHeight);
    expect(feed.bottomPadding - nav.totalHeight).toBe(feed.cardGap);
  });

  it("reproduces Krish's 630pt card pitch (Figma's was 264)", () => {
    expect(feed.cardHeight + feed.cardGap).toBe(630);
    // Provenance: the frame's pitch was 264 — cards at y 58, 322, 586, i.e. a
    // 236 card plus a 28 gap. 236 + 28 === 264 is the arithmetic that proves the
    // frame's card was 236 and not the 250 a retired comment claimed.
    expect(236 + 28).toBe(264);
  });

  it('clips the SECOND card at rest, which is why the feed scrolls', () => {
    // With 600pt cards the overflow arrives one card earlier than the frame's.
    // If this ever stops being true, the ScrollView has lost its reason to exist.
    expect(58 + feed.cardHeight).toBe(658); // card 1 fits inside the feed band
    expect(58 + feed.cardHeight).toBeLessThan(feed.height); // 658 < 718
    const secondCardTop = 58 + feed.cardHeight + feed.cardGap;
    expect(secondCardTop).toBe(688); // card 2 starts on-screen
    expect(secondCardTop).toBeLessThan(feed.height); // 688 < 718
    expect(secondCardTop + feed.cardHeight).toBe(1288); // and is cut
    expect(secondCardTop + feed.cardHeight).toBeGreaterThan(feed.height);
  });

  it('centres a 343x51 bar inside the 87pt nav', () => {
    expect(nav.bar.width).toBe(343);
    // (390 − 343)/2 = 23.5. Figma writes 23; we keep the half-point rather than
    // rounding, because rounding here would break `left*2 + width === width`.
    expect(nav.bar.left).toBe(23.5);
    expect(nav.bar.top).toBe(18);
    expect(nav.bar.height).toBe(51);
    // 18 + 51 + 18 = 87 — the bar is vertically centred in the nav.
    expect(nav.bar.top * 2 + nav.bar.height).toBe(87);
  });

  it('places the four icons at the Figma centres, sizes and tops', () => {
    expect(nav.icons.map((i) => i.key)).toEqual(['home', 'map', 'groups', 'profile']);
    expect(nav.icons.map((i) => i.centreX)).toEqual([43, 99, 246, 301]);
    expect(nav.icons.map((i) => i.iconSize)).toEqual([34, 34, 34, 32]);
    expect(nav.icons.map((i) => i.iconTop)).toEqual([8, 8, 9, 10]);
    // 246 = 343 − 97 and 301 = 343 − 42: the right pair anchors to the right.
    expect(nav.bar.width - nav.icons[2].centreX).toBe(97);
    expect(nav.bar.width - nav.icons[3].centreX).toBe(42);
  });

  it('keeps every tap target 52 wide and non-overlapping', () => {
    // Figma has no tap targets; 52 is the width the indicator used to lend them.
    // They stay at 52 now that the indicator is 56, because the binding pitch
    // between `groups` and `profile` is only 55 — at 56 wide the boxes would
    // overlap and the later sibling would eat 1pt of `groups`.
    for (const icon of nav.icons) {
      expect(icon.width).toBe(52);
      expect(icon.left + icon.width / 2).toBe(icon.centreX);
    }
    expect(nav.icons[0].left).toBe(17); // 43 − 26

    const pitch = nav.icons[3].centreX - nav.icons[2].centreX;
    expect(pitch).toBe(55);
    expect(nav.icons[2].left + nav.icons[2].width).toBeLessThanOrEqual(nav.icons[3].left);
  });

  it('draws a 75x42 active indicator at top 5, decoupled from the tap box', () => {
    // Figma drew 52x40 @ (17, 6). 75 is the REFERENCE-SIZE COLLISION LIMIT, not
    // the icon pitch: half of it (37.5) is exactly the gap between the map icon's
    // centre (99) and the centre circle's left edge (136.5). 42 at top 5 gives a
    // uniform 4pt of bar above and below (5 / 51−5−42).
    expect(nav.indicator.width).toBe(75);
    expect(nav.indicator.height).toBe(42);
    expect(nav.indicator.top).toBe(5);
    expect(51 - nav.indicator.top - nav.indicator.height).toBe(4);
    // The indicator's centre stays exactly 1pt below the 34pt glyph's centre —
    // the same 1pt offset the frame drew, not a re-centring.
    expect(nav.indicator.top + nav.indicator.height / 2).toBe(26);
    expect(8 + 34 / 2).toBe(25);

    expect(nav.icons[0].indicatorLeft).toBe(5.5); // 43 − 37.5
    expect(nav.icons[3].indicatorLeft).toBe(263.5); // 301 − 37.5
    for (const icon of nav.icons) {
      expect(icon.indicatorLeft + nav.indicator.width / 2).toBe(icon.centreX);
      // Wider than the tap box, and centred on the same point.
      expect(icon.indicatorLeft).toBeLessThan(icon.left);
    }
    // Adjacent indicator boxes overlap by 20pt against the 55pt binding pitch
    // (it was 1pt when the indicator was 56). Harmless: only one indicator is
    // ever mounted, which is why the growth was allowed to break the old
    // "never wider than the icon pitch" rule.
    expect(nav.icons[2].indicatorLeft + nav.indicator.width - nav.icons[3].indicatorLeft).toBe(20);

    // At the REFERENCE size the map indicator's right edge lands exactly on the
    // centre circle's left edge. This is the derivation of 75, asserted.
    expect(nav.icons[1].indicatorLeft + nav.indicator.width).toBeCloseTo(136.5, 5);
    expect(nav.centre.circle.left).toBeCloseTo(136.5, 5);
  });

  it('overflows the centre button above the bar, by design', () => {
    expect(nav.centre.circle.size).toBe(70);
    expect(nav.centre.circle.top).toBe(-9);
    expect(nav.centre.circle.left).toBeCloseTo(136.5, 5); // (343 − 70)/2
    expect(nav.centre.logo.width).toBe(67);
    expect(nav.centre.logo.height).toBe(90);
    expect(nav.centre.logo.top).toBe(-19);
    expect(nav.centre.logo.left).toBeCloseTo(138, 5); // (343 − 67)/2
    // In nav-root coordinates the logo's top is 18 − 19 = −1: only 1pt escapes
    // the nav root, which is what makes the Android clipping risk survivable.
    expect(nav.bar.top + nav.centre.logo.top).toBe(-1);
  });
});

describe('computeHomeLayout on a shorter phone (375x667)', () => {
  const { feed, nav } = computeHomeLayout({ width: 375, height: 667, insets: NO_INSETS });

  it('keeps the nav intrinsic and narrows only the cards and the bar', () => {
    expect(nav.height).toBe(87);
    expect(nav.bottomGap).toBe(39);
    expect(feed.height).toBe(541); // 667 − 87 − 39
    expect(feed.cardWidth).toBe(323); // 375 − 52
    expect(feed.cardHeight).toBe(600);
    expect(nav.bar.width).toBe(328); // 375 − 47
  });

  it('anchors the icons to the nearest edge instead of scaling them', () => {
    expect(nav.icons.map((i) => i.centreX)).toEqual([43, 99, 231, 286]);
    expect(nav.bar.width - nav.icons[2].centreX).toBe(97);
    expect(nav.bar.width - nav.icons[3].centreX).toBe(42);
  });

  it('does not let the map icon collide with the centre button at the narrow size', () => {
    const mapIconRight = nav.icons[1].centreX + nav.icons[1].iconSize / 2; // 116
    expect(mapIconRight).toBeLessThan(nav.centre.circle.left); // 129
  });

  it('keeps the active indicator TUCKED UNDER the centre button at 375, not past it', () => {
    // RE-AIMED (2026-08-17). This used to assert 2pt of CLEARANCE at width 56.
    // At the shipped 75 there is none: 375 is the tight case, because the bar
    // narrows to 328 and the circle's left edge walks in to 129 while the map
    // icon stays anchored at 99 from the left. The map indicator's right edge is
    // 136.5, so it runs 7.5pt UNDERNEATH the circle.
    //
    // That is not a clip and not a defect: the circle is opaque `surfaceRaised`
    // at elevation 10 against the pill's 6 and is painted after it, so it covers
    // the indicator's right end on both platforms. What this test guards is that
    // the overlap stays BOUNDED — the covered end must not reach the circle's
    // centre, let alone poke out the far side.
    const mapIndicatorRight = nav.icons[1].indicatorLeft + 75;
    expect(mapIndicatorRight).toBe(136.5);
    expect(nav.centre.circle.left).toBe(129); // (328 − 70)/2
    expect(mapIndicatorRight - nav.centre.circle.left).toBe(7.5);
    // 7.5 against the circle's 35pt radius: comfortably inside its opaque body.
    expect(mapIndicatorRight).toBeLessThan(nav.centre.circle.left + 70 / 2);

    // Both ends still sit inside the bar itself, which is the constraint that
    // would actually look broken. Home's left edge is 5.5 of 328, and profile's
    // right edge is 4.5pt inside the bar at 375 (323.5 of 328) — it was 14pt at
    // width 56, so this is the number that is genuinely running out of room.
    expect(nav.icons[0].indicatorLeft).toBe(5.5);
    expect(nav.bar.width - (nav.icons[3].indicatorLeft + 75)).toBe(4.5);
  });
});

describe('computeHomeLayout on a taller phone (430x932)', () => {
  const { feed, nav } = computeHomeLayout({ width: 430, height: 932, insets: NO_INSETS });

  it('gives the extra height to the feed only', () => {
    expect(feed.height).toBe(806); // 932 − 87 − 39
    expect(feed.cardWidth).toBe(378); // 430 − 52
    expect(feed.cardHeight).toBe(600);
    expect(nav.height).toBe(87);
  });

  it('gives the extra width to the middle of the bar, where nothing lives', () => {
    expect(nav.bar.width).toBe(383); // 430 − 47
    expect(nav.icons.map((i) => i.centreX)).toEqual([43, 99, 286, 341]);
    expect(nav.bar.width - nav.icons[2].centreX).toBe(97);
    expect(nav.bar.width - nav.icons[3].centreX).toBe(42);
  });
});

describe('safe-area behaviour', () => {
  it('pushes the first card under a notch but leaves the nav tail alone', () => {
    const { feed, nav } = computeHomeLayout({
      width: 390,
      height: 844,
      insets: { top: 59, bottom: 34 },
    });

    expect(feed.topPadding).toBe(71); // 59 + 12
    expect(nav.bottomGap).toBe(39); // 39 already clears a 34pt home indicator
  });

  it('grows the nav tail when the bottom inset exceeds 39', () => {
    const { feed, nav } = computeHomeLayout({
      width: 390,
      height: 844,
      insets: { top: 0, bottom: 48 },
    });

    expect(nav.bottomGap).toBe(48);
    expect(nav.totalHeight).toBe(135);
    expect(feed.height).toBe(844 - 135);
    expect(feed.topPadding).toBe(58); // an absent top inset keeps the Figma 58
    // The bottom padding grows with the bar it has to clear: 30 + 135.
    expect(feed.bottomPadding).toBe(165);
  });
});

describe('navMotion', () => {
  // `navMotion` is the SUBJECT here, the way `computeHomeLayout` is above; every
  // EXPECTED value is still a literal. Asserting `minDuration ===
  // navMotion.minDuration` would prove nothing — asserting 165 proves the feel
  // that was signed off.
  it('pins the picks that decide how the bar feels', () => {
    expect(navMotion.minDuration).toBe(165);
    expect(navMotion.durationSpan).toBe(70);
    expect(navMotion.minDuration + navMotion.durationSpan).toBe(235);
    expect(navMotion.grabScale).toBe(1.08);
    expect(navMotion.grabInDuration).toBe(90);
    expect(navMotion.grabOutDuration).toBe(140);
    expect(navMotion.pulseScale).toBe(0.94);
    expect(navMotion.pulseHalfDuration).toBe(50);
    expect(navMotion.pulseHalfDuration * 2).toBe(100);
    expect(navMotion.dragThreshold).toBe(3);
    expect(navMotion.magnetRadius).toBe(18);
    expect(navMotion.magnetStrength).toBe(0.35);
  });

  it('produces the 165-235ms ladder over the reference bar', () => {
    const { nav } = computeHomeLayout({ width: 390, height: 844, insets: NO_INSETS });
    const lefts = nav.icons.map((i) => i.indicatorLeft);
    const fullTravel = Math.max(...lefts) - Math.min(...lefts);
    expect(fullTravel).toBe(258); // 263.5 − 5.5

    // The rule the component applies, restated here rather than imported — this
    // is the tripwire on the TABLE in `homeSpec.nav.motion`'s comment.
    const durationFor = (travel: number) =>
      Math.round(
        navMotion.minDuration + navMotion.durationSpan * Math.min(travel / fullTravel, 1)
      );

    expect(durationFor(lefts[1] - lefts[0])).toBe(180); // home ↔ map, 56
    expect(durationFor(lefts[3] - lefts[2])).toBe(180); // groups ↔ profile, 55
    expect(durationFor(lefts[2] - lefts[1])).toBe(205); // map ↔ groups, 147
    expect(durationFor(lefts[2] - lefts[0])).toBe(220); // home ↔ groups, 203
    expect(durationFor(fullTravel)).toBe(235); // home ↔ profile, 258
    expect(durationFor(0)).toBe(165); // the floor
    expect(durationFor(10_000)).toBe(235); // clamped, never slower than the ceiling
  });

  it('keeps the magnet incapable of feeling like a snap', () => {
    // |out − raw| = S·|d|·(1 − |d|/R), maximised at |d| = R/2 at S·R/4.
    expect((navMotion.magnetStrength * navMotion.magnetRadius) / 4).toBeCloseTo(1.575, 5);
    expect((navMotion.magnetStrength * navMotion.magnetRadius) / 4).toBeLessThan(1.6);
    // And it never stalls: the slowest the pill tracks the finger is 1 − S.
    expect(1 - navMotion.magnetStrength).toBeCloseTo(0.65, 5);
    expect(1 - navMotion.magnetStrength).toBeGreaterThan(0.5);
  });
});

describe('invariants at every size', () => {
  const sizes = [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
  ];

  it.each(sizes)('holds at $width x $height', ({ width, height }) => {
    const { feed, nav } = computeHomeLayout({ width, height, insets: NO_INSETS });

    expect(feed.height + nav.height + nav.bottomGap).toBe(height);
    expect(feed.cardWidth + 2 * feed.sideMargin).toBe(width);
    expect(nav.bar.left * 2 + nav.bar.width).toBe(width);
    expect(nav.bar.top * 2 + nav.bar.height).toBe(nav.height);
  });
});
