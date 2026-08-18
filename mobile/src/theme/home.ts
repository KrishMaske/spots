// Geometry for the signed-in Home screen (Figma file DMnEYcuVTiVNXZB7XHDwuN,
// frame `home-screen`, node 4:164), plus the pure layout function the screen and
// the tab bar render from.
//
// Same shape as `theme/onboarding.ts`: one-off Figma measurements, deliberately
// NOT in `tokens.spacing`. Colors and radii live in the theme; this file is
// numbers only.
//
// Reference size is 390×844. (The onboarding frame is 848; the 4pt difference is
// irrelevant because both layouts are pure functions of the window.)
//
// THE FIGMA FRAME (`4:164`) — the record of what was drawn:
//
//   root 390×844                 canvas · radius 32 · 1px hairline   ← AppFrame
//   ├── feed   y   0..718   (718 tall) · scrolls · clips
//   │   ├── card 326×236 @ (32,  58)
//   │   ├── card 326×236 @ (32, 322)   ← pitch 264 ⇒ gap 28
//   │   └── card 326×236 @ (32, 586)   ← 586+236 = 822 > 718: clipped, so it scrolls
//   └── nav    y 718..805   (87 tall)  ← rendered by the navigator, not a screen
//       └── bar 343×51 @ (23, 18)
//           (bottom gap y 805..844 = 39)
//
//   horizontal:  32 + 326 + 32 = 390 ✓   (390 − 343)/2 = 23.5, which Figma
//                                          rounds to 23 — the bar is centred
//   nav:         18 + 51 + 18 = 87 ✓     — the bar is centred in the nav
//   root:        718 + 87 + 39 = 844 ✓   — the 39pt tail is the home-indicator
//                                          band, modelled as max(39, inset)
//
// WHAT ACTUALLY SHIPS (Krish's overrides, 2026-08-17) — the feed is a tall-image
// column, not the frame's landscape one. The nav is UNCHANGED from the frame
// apart from the active indicator (see `nav.indicator`).
//
//   ├── feed   gutters 26/26 · card 338×600 · gap 30 · ten cards
//   │   ├── card 338×600 @ (26,  58)   ← 58+600 = 658 < 718: fits
//   │   └── card 338×600 @ (26, 688)   ← pitch 630, and 688+600 = 1288 > 718:
//   │                                    the SECOND card is the one cut at rest
//   └── nav    unchanged, but the indicator is 75×42 @ top 5 (Figma: 52×40 @ 6)
//
// THE NAV BAR OVERLAYS THE SCENE; IT DOES NOT RESERVE SPACE. `SpotsTabBar`'s
// root is `position: 'absolute'`, and an absolutely-positioned child of
// `BottomTabView`'s flex column takes no layout space — so the scene gets the
// full window height and the bar floats over it. An earlier version of this
// comment (and of the README) claimed the navigator subtracts the bar's height
// from every scene. IT DOES NOT. `feed.height` below is therefore a
// decomposition of the FRAME, not a description of the ScrollView, and
// `feed.bottomPadding` has to clear the bar itself.

export const homeSpec = {
  /** The size the Figma frame was designed at. */
  reference: { width: 390, height: 844 },

  feed: {
    /** KRISH'S OVERRIDE (2026-08-17). Figma 4:164 draws the cards at x = 32
     *  (gutters 32/32 on a 390 frame); 26 widens the card to 338 and is a
     *  deliberate departure from the frame, not a transcription error.
     *  Consequence worth knowing: Home's gutter now matches neither the frame's
     *  32 nor `spacing.gutter` (30) that `Screen` uses on every other screen, so
     *  Landing → Login → Home steps 30 → 30 → 26. */
    sideMargin: 26,
    /** KRISH'S OVERRIDE. Figma 4:164 draws a 326×236 card. 600 makes the feed a
     *  tall-image column instead of a landscape one. (A retired comment here
     *  said "326×250" — that was WRONG and always has been; the frame, this
     *  module's own pitch arithmetic below, `theme/__tests__/home.test.ts` and
     *  the README all say 236. Do not "restore" 250.) */
    cardHeight: 600,
    /** KRISH'S OVERRIDE. Figma 4:164: pitch 264 (322 − 58) minus the 236 card
     *  = 28. With cardHeight 600 the pitch is now 630, and the SECOND card is
     *  the one cut by the feed band at rest rather than the third. */
    cardGap: 30,
    topPadding: 58, // Figma: first card at y 58
    /** Extra top offset applied over the safe-area inset on notched devices.
     *  Reuses `onboardingSpec.wordmark.safeAreaGap`'s 12 rather than inventing
     *  a second rule: Figma draws 58 from the frame's top edge, which on a
     *  notched phone is under the status bar. */
    safeAreaGap: 12,
  },

  nav: {
    height: 87, // Figma: nav band y 718..805
    /** Home-indicator band below the nav. Figma: 844 − 805. */
    bottomGap: 39,
    bar: {
      /** Figma: 390 − 343. The bar stretches with the window; it is not scaled. */
      widthInset: 47,
      top: 18, // Figma: bar at nav-relative y 18 (and 18 + 51 + 18 = 87)
      height: 51, // Figma: bar 51 tall. Its radius 170 is `radius.pill`.
    },
    /**
     * Icon centres. THE BAR STRETCHES BUT THE ICONS ANCHOR TO THE NEAREST EDGE:
     * scaling fixed-size icons' positions proportionally would distort the row.
     * Anchoring keeps the reference values exact at 390 and degrades sanely (at
     * 375 the map icon's right edge, 116, still clears the centre button's left
     * edge, 129; at 430 the extra width goes to the middle, where nothing is).
     *
     * The 43/99-from-the-left vs 42/97-from-the-right asymmetry is TRANSCRIBED,
     * not symmetrised — it is 1pt of Figma rounding, and evening it out would be
     * inventing.
     */
    icons: {
      home: { fromLeft: 43, size: 34, top: 8 }, // Figma: 34×34 @ (26, 8)
      map: { fromLeft: 99, size: 34, top: 8 }, // Figma: 34×34 @ (82, 8)
      groups: { fromRight: 97, size: 34, top: 9 }, // Figma: 34×34 @ (229, 9), centre 246 = 343 − 97
      profile: { fromRight: 42, size: 32, top: 10 }, // Figma: 32×32 @ (285, 10), centre 301 = 343 − 42
    },
    /** Tap-target width, one per icon tab. Figma has no tap targets — it draws a
     *  52-wide indicator, and the tap box borrowed that number. They are now
     *  SEPARATE values, because the indicator grew and the tap boxes must not:
     *  the binding pitch is `profile.centreX − groups.centreX` = 55 at EVERY
     *  window width (both anchor from the right), so at the indicator's 75 two
     *  adjacent tap boxes would overlap by 20pt and the later sibling would
     *  silently eat 20pt of `groups`. 52 × the bar's 51 still clears the 44pt iOS
     *  / 48dp Android minimums with 3pt of margin against that pitch. */
    tapWidth: 52,
    /** The active-tab pill behind an icon. Figma drew 52×40 @ (17, 6), i.e.
     *  centred on the Home icon's centre of 43; its radius 100 is `radius.pill`.
     *
     *  75×42 @ 5 is a deliberate "a lot bigger" (+44% wide, +5% tall), and both
     *  numbers are bounded by something in the row rather than by taste:
     *
     *  - WIDTH 75 IS THE REFERENCE-SIZE COLLISION LIMIT, not the icon pitch. At
     *    390 the bar is 343, so the centre circle's left edge is (343 − 70)/2 =
     *    136.5 and the map icon's centre is 99: a half-width of 136.5 − 99 = 37.5
     *    puts the map indicator's right edge EXACTLY on the circle's left edge,
     *    which is where 75 = 2 × 37.5 comes from. (An earlier comment here derived
     *    56 from the home→map icon-centre pitch of 99 − 43 and called it the
     *    ceiling. That rule was retired when the indicator grew: adjacent
     *    indicator boxes are now allowed to overlap each other — by 20pt against
     *    the 55pt groups→profile pitch — because only ONE is ever mounted.)
     *  - THE OVERLAP AT NARROWER WIDTHS IS REAL, BOUNDED, AND PAINTED OVER. The
     *    icons anchor to the nearest edge but the circle is centred, so as the bar
     *    narrows the circle walks left while map stays at 99. At 375 the bar is
     *    328, the circle's left edge is 129, and the map indicator's right edge is
     *    61.5 + 75 = 136.5 — it runs 7.5pt UNDERNEATH the circle. That is not a
     *    clip: the circle is opaque `surfaceRaised` at `elevation.floating` (10)
     *    against the pill's 6 and is painted after it, so on both platforms the
     *    circle covers the indicator's right end. `home.test.ts` asserts the
     *    overlap stays bounded by the circle's own radius rather than asserting
     *    clearance, which no longer exists. IF THIS EVER READS AS BROKEN ON A
     *    DEVICE, the retreat is 60 (0pt clearance at 375) or 56 (2pt) — one
     *    number, and every derived left moves with it.
     *  - HEIGHT 42 AT TOP 5 leaves a uniform 4pt of bar above and below
     *    (5 and 51 − 5 − 42 = 4; Figma's 6/5 was 1pt asymmetric), and the
     *    indicator's centre (26) stays exactly 1pt below the 34pt glyph's centre
     *    (25) — the SAME 1pt offset the frame drew. This is not a re-centring of
     *    a value Figma deliberately drew off-centre. */
    indicator: { width: 75, height: 42, top: 5 },
    /**
     * HOW THE NAV MOVES. These are PICKS, not transcriptions — Figma has no
     * motion spec, so unlike every other number in this file there is no frame to
     * check them against. They live here, next to the nav's other design values,
     * so the feel is reviewed with the geometry rather than buried in a component.
     *
     * They deliberately do NOT go through `computeHomeLayout()`: that function is
     * a pure function of the WINDOW, and every value below is window-independent.
     * Returning window-independent constants from a window-dependent function is
     * the kind of smell that gets "simplified" wrongly later. The component
     * imports `navMotion` directly.
     *
     * DURATION IS DISTANCE-LINEAR, NOT PER-TAB:
     *
     *   travel     = |target − current position|
     *   fullTravel = maxIndicatorLeft − minIndicatorLeft   (258 at the reference)
     *   duration   = round(minDuration + durationSpan × clamp(travel/fullTravel))
     *
     *   | move             | travel | duration |
     *   |------------------|--------|----------|
     *   | home ↔ map       |     56 |    180ms |
     *   | groups ↔ profile |     55 |    180ms |
     *   | map ↔ groups     |    147 |    205ms |
     *   | home ↔ groups    |    203 |    220ms |
     *   | home ↔ profile   |    258 |    235ms |
     *   | a drag settle    |  ≤ ~37 | 165–175ms|
     *
     * WHY DISTANCE AND NOT A TAB-INDEX LADDER: the icon row is not evenly spaced.
     * The centre button puts 147pt between map and groups against 56pt between
     * home and map, and a user reads both as "the next tab". An index ladder would
     * move the pill at 0.33 pt/ms for one adjacent hop and 0.86 pt/ms for the
     * other — a 2.6× speed difference between two gestures that look identical.
     * Distance keeps the SPEED roughly constant, and it is the only rule that also
     * answers "how long is a mid-flight redirect?" and "how long is a drag
     * settle?", neither of which has a tab index.
     */
    motion: {
      /** Floor, in ms: the shortest glide the bar will ever run. */
      minDuration: 165,
      /** Added linearly with distance, so the ceiling is 165 + 70 = 235ms. */
      durationSpan: 70,
      /** The indicator's scale while a 1:1 drag is being held. 1.08 replaces a
       *  shipped 1.4, which read as the pill jumping out of the bar. */
      grabScale: 1.08,
      grabInDuration: 90,
      grabOutDuration: 140,
      /** The icon press pulse: 1 → 0.94 → 1, 50ms each way. It is the ONLY
       *  feedback available for "tap the tab you are already on". */
      pulseScale: 0.94,
      pulseHalfDuration: 50,
      /** Points of movement before a touch that grabbed the indicator becomes a
       *  1:1 drag. Inherited from the retired `onMoveShouldSetPanResponder`
       *  threshold; not measured on a device. */
      dragThreshold: 3,
      /** The drag magnet, applied only during a 1:1 drag. Within `magnetRadius`
       *  of a tab's resting position the pill is pulled toward it by
       *  `magnetStrength × (1 − |d|/radius)`. Two properties make it "barely
       *  noticeable" rather than sticky, and both are arithmetic:
       *  - it never stalls — d(out)/d(raw) ≥ 1 − strength = 0.65, so the pill
       *    always moves when the finger moves;
       *  - its deviation is bounded at strength × radius / 4 = 1.575pt, so it is
       *    incapable of feeling like a snap. */
      magnetRadius: 18,
      magnetStrength: 0.35,
    },
    /** The overflowing centre button. Both children are bar-relative and both
     *  tops are NEGATIVE: the circle pokes 9pt above the bar and the logo 19pt,
     *  which in nav-root coordinates is 18 − 19 = −1, so only 1pt escapes the
     *  nav root. Nothing in that chain may set `overflow: 'hidden'`. */
    centre: {
      circleSize: 70, // Figma: 70×70 @ (137, −9)
      circleTop: -9,
      logoWidth: 67, // Figma: 67×90 @ (139, −19)
      logoHeight: 90,
      logoTop: -19,
    },
  },
} as const;

/**
 * The nav's motion values, frozen. `SpotsTabBar` imports this DIRECTLY rather
 * than receiving it through `computeHomeLayout()` — see the block's own comment
 * in `homeSpec.nav.motion` for why. Geometry still comes from the layout
 * function; the component does arithmetic on neither.
 */
export const navMotion = Object.freeze(homeSpec.nav.motion);

export interface HomeLayoutInput {
  width: number;
  height: number;
  insets: { top: number; bottom: number };
}

/** The four icon tabs. The centre button (`chat`) is not one of them — it has no
 *  active indicator and its own geometry. */
export type HomeTabIconKey = 'home' | 'map' | 'groups' | 'profile';

export interface HomeTabIconLayout {
  key: HomeTabIconKey;
  /** Bar-relative centre. */
  centreX: number;
  /** Bar-relative left of the TAP BOX (`nav.tapWidth` wide, centred on
   *  `centreX`). This used to be shared with the active indicator; they were
   *  decoupled when the indicator grew — see `homeSpec.nav.tapWidth`. */
  left: number;
  /** Tap-target width. 52 × the bar's 51 clears the 44pt iOS and 48dp Android
   *  minimums even though the glyphs are only 32–34. */
  width: number;
  /** Bar-relative left of the ACTIVE INDICATOR (`nav.indicator.width` wide,
   *  centred on `centreX`). Wider than the tap box, so adjacent indicator boxes
   *  overlap — harmless, because only one is ever mounted. */
  indicatorLeft: number;
  iconSize: number;
  iconTop: number;
}

export interface HomeNavLayout {
  /** The bar band. */
  height: number;
  /** Home-indicator tail below it. */
  bottomGap: number;
  /** What the tab bar component actually occupies: `height + bottomGap`. */
  totalHeight: number;
  bar: { left: number; top: number; width: number; height: number };
  icons: HomeTabIconLayout[];
  indicator: { width: number; height: number; top: number };
  centre: {
    circle: { left: number; top: number; size: number };
    logo: { left: number; top: number; width: number; height: number };
  };
}

export interface HomeFeedLayout {
  /** Computed but NOT applied as a height, and NOT the scene's height either:
   *  the bar is absolutely positioned, so the scene runs the full window height
   *  and the ScrollView takes `flex: 1` (see the module header). This is a
   *  decomposition of the FRAME — returned so the pure test can assert
   *  `height + nav.height + nav.bottomGap === H`, which is what documents why
   *  the screen needs no explicit height. */
  height: number;
  sideMargin: number;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  topPadding: number;
  /** `cardGap + nav.totalHeight`, NOT just `cardGap`.
   *
   *  The bar is absolutely positioned, so it overlays the scene rather than
   *  reserving space (see the module header): at the reference it occupies the
   *  bottom 126pt, and a 30pt bottom padding meant the LAST card could never be
   *  scrolled clear of it. Content passing UNDER the bar mid-scroll is the
   *  intended look — that is what the blur is for — so this is deliberately
   *  "enough to read the last card" and nothing more. It grows with
   *  `insets.bottom`, because `nav.totalHeight` does. */
  bottomPadding: number;
}

export interface HomeLayout {
  feed: HomeFeedLayout;
  nav: HomeNavLayout;
}

/**
 * Turns a window size + safe-area insets into every number Home and its tab bar
 * render. Pure — no React, no Dimensions — so the whole design is assertable in
 * a plain unit test at any device size.
 *
 * At 390×844 with zero insets this reproduces the Figma frame exactly.
 */
export function computeHomeLayout({ width, height, insets }: HomeLayoutInput): HomeLayout {
  const { feed, nav } = homeSpec;

  const bottomGap = Math.max(nav.bottomGap, insets.bottom);
  const navTotalHeight = nav.height + bottomGap;
  const barWidth = width - nav.bar.widthInset;
  const halfTap = nav.tapWidth / 2;
  const halfIndicator = nav.indicator.width / 2;

  const icon = (
    key: HomeTabIconKey,
    centreX: number,
    spec: { size: number; top: number }
  ): HomeTabIconLayout => ({
    key,
    centreX,
    left: centreX - halfTap,
    width: nav.tapWidth,
    indicatorLeft: centreX - halfIndicator,
    iconSize: spec.size,
    iconTop: spec.top,
  });

  return {
    feed: {
      height: height - navTotalHeight,
      sideMargin: feed.sideMargin,
      cardWidth: width - feed.sideMargin * 2,
      cardHeight: feed.cardHeight,
      cardGap: feed.cardGap,
      topPadding: Math.max(feed.topPadding, insets.top + feed.safeAreaGap),
      bottomPadding: feed.cardGap + navTotalHeight,
    },
    nav: {
      height: nav.height,
      bottomGap,
      totalHeight: navTotalHeight,
      bar: {
        left: (width - barWidth) / 2,
        top: nav.bar.top,
        width: barWidth,
        height: nav.bar.height,
      },
      icons: [
        icon('home', nav.icons.home.fromLeft, nav.icons.home),
        icon('map', nav.icons.map.fromLeft, nav.icons.map),
        icon('groups', barWidth - nav.icons.groups.fromRight, nav.icons.groups),
        icon('profile', barWidth - nav.icons.profile.fromRight, nav.icons.profile),
      ],
      indicator: { ...nav.indicator },
      centre: {
        circle: {
          left: (barWidth - nav.centre.circleSize) / 2,
          top: nav.centre.circleTop,
          size: nav.centre.circleSize,
        },
        logo: {
          left: (barWidth - nav.centre.logoWidth) / 2,
          top: nav.centre.logoTop,
          width: nav.centre.logoWidth,
          height: nav.centre.logoHeight,
        },
      },
    },
  };
}
