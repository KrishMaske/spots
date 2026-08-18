// Geometry for the onboarding screen (Figma file DMnEYcuVTiVNXZB7XHDwuN, frame
// `spots-onboarding`, node 4:75), plus the pure layout function the screen
// renders from.
//
// These are one-off Figma measurements, not scale steps — they deliberately do
// NOT live in `tokens.spacing`. Colors and radii do live in the tokens; this
// file is numbers only.
//
// Reference size is 390×848. Off-reference sizes degrade gracefully (see
// `computeOnboardingLayout`), not identically.

export const onboardingSpec = {
  /** The size the Figma frame was designed at; `wordmark.scale` is measured
   * against this width. */
  reference: { width: 390, height: 848 },

  frame: {
    // The matching corner radius (32) is a token — `radius.xxl` — because radii
    // belong in the theme. Only the stroke width lives here.
    borderWidth: 1, // Figma root 1px #E2E8F0 stroke
  },

  wordmark: {
    top: 65, // Figma: wordmark box y = 65
    /** Extra top offset applied over the safe-area inset on notched devices. */
    safeAreaGap: 12,
    boxWidth: 388, // Figma: wordmark box 388 wide at x = 2
    boxHeight: 178, // Figma: wordmark box 178 tall
    fontSize: 96, // Figma: Jost Black 96
    // Figma v2 (2026-08-17): the "o" is no longer the 69×68 dot CLUSTER — it is
    // the `brandmark-logo` dot RING, an image 92×123 at (163, 35) in the 388×178
    // box. See docs/plans/home-screen-and-onboarding-v2.md §3.
    dotWidth: 92, // Figma v2: ring 92 wide at x = 163 within the box
    dotHeight: 123, // Figma v2: ring 123 tall at y = 35 within the box
    /**
     * Width of the slot standing in for the two literal spaces in Figma's
     * `sp  ts` text run.
     *
     * DERIVED, NOT DEVICE-CALIBRATED. Read straight out of the shipped font
     * binary (`@expo-google-fonts/jost@0.4.2`, Jost v20 / 2025-09-10,
     * `900Black/Jost_900Black.ttf`) on 2026-08-16: the `space` glyph advance is
     * 300 units against `unitsPerEm` 1000, so two spaces at 96px =
     * 2 × 300/1000 × 96 = 57.6.
     *
     * Cross-check against Figma: with the row centred in the 388 box, the gap
     * centre lands at 194 + (W("sp") − W("ts"))/2. The same font tables give
     * W("sp") = 108.768 and W("ts") = 81.888, i.e. a centre at 207.44 against
     * Figma's dot centre of 206.5 — under 1px out, which corroborates the model.
     *
     * PENDING: confirm on a real device (render `sp  ts` / `sp` / `ts` at 96px
     * and diff the measured widths). Re-derive if the Jost version changes.
     */
    gapWidth: 57.6,
    /**
     * Vertical offset of the brandmark inside its slot.
     *
     * DERIVED, NOT DEVICE-CALIBRATED. The slot is `dotHeight` (123) tall,
     * centred in the row, and the row is centred in the 178-tall box, so the
     * slot top sits at (178 − 123)/2 = 27.5 regardless of the font's line
     * metrics. Figma v2 puts the ring at y 35 in that box, so the nudge is
     * 35 − 27.5 = 7.5 (it was 12 for the 68pt cluster).
     *
     * The derivation holds only while the slot is not what drives the row's
     * height. Jost Black's ascent+descent at 96px is ≈ 139pt, and 123 < 139, so
     * the text still drives the row — closer than it was (68 → 123), but still
     * true. If a future mark is taller than ≈ 139, the row height becomes the
     * mark and this nudge must be re-derived.
     *
     * PENDING: overlay a device screenshot on the Figma frame and confirm.
     */
    dotVerticalNudge: 7.5,
    /** Minimum gap kept between the wordmark box and the map's first content
     * pixel when the map is clamped on short screens. */
    clearance: 8,
  },

  map: {
    /** True aspect of `assets/images/map.png` (1512×2016). Figma's rounded
     * 428:571 is 0.06% away; the source ratio is used so the illustration can
     * never distort. */
    aspectRatio: 3 / 4,
    /** Figma: the 428-wide image in a 390-wide frame = 38pt of horizontal
     * bleed. */
    widthBleed: 38,
    /** Figma places the image 1px right of dead-centre (x = −18, not −19). */
    leftNudge: 1,
    /** Figma: map bottom (114 + 571 = 685) minus hero bottom (622). The map is
     * bottom-anchored to this overhang so it stays glued to the button line
     * when the hero flexes. */
    bottomOverhang: 63,
    /** First content row of map.png (alpha > 8) at y 573 of 2016, measured from
     * the file's alpha channel. */
    contentTopRatio: 573 / 2016,
  },

  footer: {
    /**
     * Figma v2: the Sign In frame sits at footer y 0 but its rect starts at
     * top 20. Modelled as the footer's lead-in padding rather than as a taller
     * first button, because that is what keeps `footerHeight` at 226 — and
     * therefore `heroHeight` at 622, which is what keeps the (unchanged) map at
     * y 114. See docs/plans/home-screen-and-onboarding-v2.md §2.
     */
    topPadding: 20,
    buttonHeight: 60, // was 78 — Figma v2: rects at 642..702 and 716..776
    buttonGap: 14, // was 16 — Figma v2: 716 − 702
    // `buttonRadius` is REMOVED on purpose: the v2 CTA is a full pill, and a
    // pill is a token (`radius.pill`), not a measurement. Figma says 100 on a
    // 60pt control, which clamps to height/2 on both platforms — the same
    // instruction the nav bar's 170 and the indicator's 100 spell differently.
    // Minting a `radius: 100` token would be a second pill value. See §4.
    sideMargin: 30, // Figma: buttons at x = 30 in a 390 frame
    bottomPadding: 72, // was 54 — Figma v2: 848 − 776
    secondaryBorderWidth: 3, // Figma: Register 3px inside stroke
  },
} as const;

export interface OnboardingLayoutInput {
  width: number;
  height: number;
  insets: { top: number; bottom: number };
}

export interface OnboardingWordmarkLayout {
  top: number;
  left: number;
  boxWidth: number;
  boxHeight: number;
  fontSize: number;
  scale: number;
  dot: { width: number; height: number };
}

export interface OnboardingMapLayout {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface OnboardingLayout {
  /** The Sign In frame's 20pt internal offset, modelled as the footer's lead-in. */
  footerTopPadding: number;
  bottomPadding: number;
  footerHeight: number;
  heroHeight: number;
  sideMargin: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonGap: number;
  wordmark: OnboardingWordmarkLayout;
  map: OnboardingMapLayout;
}

/**
 * Turns a window size + safe-area insets into every number the onboarding
 * screen renders. Pure — no React, no Dimensions — so the whole design is
 * assertable in a plain unit test at any device size.
 *
 * At 390×848 with zero insets this reproduces the Figma frame exactly; the
 * footer decomposes to 20 + 60 + 14 + 60 + 72 = 226 (v2 — it was
 * 78 + 16 + 78 + 54, the same total), leaving the hero on 622 with no
 * arithmetic. That identity is why the map and wordmark coordinates did not
 * move when the frame's CTAs did.
 */
export function computeOnboardingLayout({ width, height, insets }: OnboardingLayoutInput): OnboardingLayout {
  const { wordmark, map, footer } = onboardingSpec;

  const bottomPadding = Math.max(footer.bottomPadding, insets.bottom);
  const footerHeight =
    footer.topPadding + footer.buttonHeight + footer.buttonGap + footer.buttonHeight + bottomPadding;
  const heroHeight = height - footerHeight;

  // The wordmark scales down on narrow phones but never up: fixed 96px type and
  // a 69pt image stay crisp, and scaling up would only buy fractional sizes.
  const scale = Math.min(1, width / onboardingSpec.reference.width);
  const boxHeight = wordmark.boxHeight * scale;
  const boxWidth = wordmark.boxWidth * scale;
  const wordmarkTop = Math.max(wordmark.top, insets.top + wordmark.safeAreaGap);

  // The map is bottom-anchored to the hero, so on taller screens the gap under
  // the wordmark grows instead of the map floating away from the buttons.
  const mapAnchorBottom = heroHeight + map.bottomOverhang;
  const mapHeightByWidth = (width + map.widthBleed) / map.aspectRatio;
  // Short-screen guard: shrink the map rather than let its content ride up into
  // the wordmark. Solving `mapTop + contentTopRatio*h <= wordmarkBottom - clearance`
  // for h, with mapTop = mapAnchorBottom - h.
  const maxMapHeight =
    (mapAnchorBottom - (wordmarkTop + boxHeight) - wordmark.clearance) / (1 - map.contentTopRatio);
  const mapHeight = Math.min(mapHeightByWidth, maxMapHeight);
  const mapWidth = mapHeight * map.aspectRatio;

  return {
    footerTopPadding: footer.topPadding,
    bottomPadding,
    footerHeight,
    heroHeight,
    sideMargin: footer.sideMargin,
    buttonWidth: width - footer.sideMargin * 2,
    buttonHeight: footer.buttonHeight,
    buttonGap: footer.buttonGap,
    wordmark: {
      top: wordmarkTop,
      left: (width - boxWidth) / 2,
      boxWidth,
      boxHeight,
      fontSize: wordmark.fontSize * scale,
      scale,
      dot: { width: wordmark.dotWidth * scale, height: wordmark.dotHeight * scale },
    },
    map: {
      width: mapWidth,
      height: mapHeight,
      left: (width - mapWidth) / 2 + map.leftNudge,
      top: mapAnchorBottom - mapHeight,
    },
  };
}
