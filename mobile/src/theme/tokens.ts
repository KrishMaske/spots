// Layer 1 — raw design primitives. Nothing here is theme-aware; `theme/themes.ts`
// maps these onto semantic tokens for light/dark mode.
//
// The brand values (`spotsYellow` and friends) are final, transcribed from
// Figma. The neutral ramp and type scale are still placeholders pending final
// Spots brand sign-off. Swap values here only — nothing else in the app should
// reference raw hex/scale values directly.

// REMOVED: yellow (FFD400) / yellowPressed (E6BF00) — the pre-brand
// placeholders. `spotsYellow` is now the app's only yellow (see O1 in
// docs/plans/onboarding-redesign.md, resolved by docs/plans/brand-rollout.md).
// The retired hexes are written without a leading `#` on purpose: the guard in
// `screens/__tests__/noRawHex.test.ts` asserts they are gone from this file.
export const palette = {
  white: '#FFFFFF',
  black: '#0A0A0A',
  gray900: '#111111',
  gray700: '#333333',
  gray500: '#6B6B6B',
  gray300: '#CFCFCF',
  gray100: '#F2F2F2',
  danger: '#D64545',
  success: '#2F9E44',
  // Spots brand, transcribed from Figma spots-onboarding (node 4:75). These are
  // the canonical brand values, and since the brand rollout they are the ONLY
  // ones: `spotsYellow` feeds both `theme.brand.primary` and
  // `theme.colors.accent`, so the app has exactly one yellow.
  spotsYellow: '#FFC203',
  /** Pressed pair for `spotsYellow`. DERIVED, not picked: the retired
   *  FFD400 → E6BF00 pair was exactly a 90% per-channel multiply
   *  (255→229.5→E6, 212→190.8→BF, 0→00). The identical rule applied to
   *  FFC203 gives 255→229.5→E6, 194→174.6→AF, 3→2.7→03. */
  spotsYellowPressed: '#E6AF03',
  spotsCream: '#FFF6EC', // secondary button fill
  slate50: '#F8FAFC', // onboarding canvas
  slate200: '#E2E8F0', // 1px frame hairline
  /** Warm raised surface — the Home feed card, the floating nav bar and the
   *  nav's centre circle (Figma home-screen 4:164: #FAF8F6, confirmed against
   *  the exported centre ellipse 10:6). NOT `spotsCream` (#FFF6EC), which is a
   *  far warmer brand fill, and not `white`, which is `colors.surface`. */
  linen50: '#FAF8F6',
  trueBlack: '#000000', // Figma text color — NOT palette.black (#0A0A0A)
  // Dark ramp. CHOSEN, NOT TRANSCRIBED: there is no Figma dark frame, so unlike
  // the spots* brand values these are picks, justified by the measured contrast
  // table in docs/plans/spots-background-and-dark-mode.md §3. The brand controls
  // (yellow, cream, black label) do NOT get a dark variant — the ramp is chrome
  // only, which is what keeps the product recognisable in either mode.
  night900: '#0F1115', // dark canvas  — brand.canvas / colors.bg
  night800: '#1A1D23', // dark surface — fields, info banner
  /** DARK RAISED SURFACE — the Home feed cards, the floating nav bar and the
   *  nav's centre circle in dark mode. A PICK, like the rest of this ramp.
   *
   *  It exists because `surfaceRaised` used to point at `night800`, which made a
   *  "raised" surface byte-identical to `surface` (1.00:1) and only 1.12:1 from
   *  the canvas — while `elevation.card`'s 35% black shadow, the design's only
   *  other separation mechanism, does nothing at all on #0F1115. So in dark mode
   *  the Home surfaces had no separation from the page by ANY channel. Measured
   *  with the WCAG 2.x relative-luminance formula:
   *
   *    raised vs canvas #0F1115   1.12:1 → 1.76:1   (+57%)
   *    raised vs surface #1A1D23  1.00:1 → 1.57:1   (the collision is gone)
   *    #F5F5F5 text/icons on it   15.48:1 → 9.87:1  (AAA)
   *    #FFC203 @0.30 over it, vs #F5F5F5 ink        5.23:1 (AA)
   *
   *  ONE RULE THIS CREATES: #94A3B8 (`textMuted`) on this surface is 4.20:1,
   *  BELOW the 4.5:1 AA minimum. Nothing renders muted text on a raised surface
   *  today — the cards are empty image slots and the bar carries icons only — but
   *  the first caption added to a feed card is where this bites. USE
   *  `colors.text` (9.87:1) ON A DARK RAISED SURFACE, NEVER `colors.textMuted`.
   *
   *  Deliberately NOT paired with a `brand.hairline` outline on dark cards: at
   *  #2E333B that outline is 1.49:1 on the canvas (below the 3:1 it would exist
   *  to provide) and, being DARKER than this value, it would draw a dark line
   *  around a lighter card at 1.18:1 — fighting the lift rather than adding to
   *  it. Lifting the surface and outlining it are alternatives, not a pair. */
  night700: '#373E4A',
  night600: '#2E333B', // dark hairline— brand.hairline / colors.border
  night050: '#F5F5F5', // dark text and the wordmark on the dark canvas
  slate400: '#94A3B8', // dark muted text: gray500 is only 3.55:1 on night900
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** Brand page gutter. NOT a step in the 4/8 scale — it is the onboarding
   *  frame's side margin (Figma sideMargin 30), promoted so a form column
   *  lines up with the CTA a user just tapped on Landing. */
  gutter: 30,
} as const;

export const radius = {
  // `sm`/`md` have no consumers since the brand rollout moved TextField to `xl`
  // and FormError to `lg` and retired `Button`. Kept deliberately (O-G): they
  // are a generic scale, not brand values, and the next component may want
  // them. Their absence from the app is not an oversight.
  sm: 8,
  md: 12,
  lg: 20,
  xl: 25, // brand CTA button, compact size (Figma spots-onboarding: 25)
  xxl: 32, // onboarding outer frame (Figma spots-onboarding: 32)
  /** Home feed card (Figma home-screen 4:164: 50 on a 326×236 card). Unlike the
   *  frame's 100/170 radii this one is NOT clamped by height/2 (118), so it is a
   *  real measurement rather than another spelling of `pill`. */
  xxxl: 50,
  /** Any radius >= height/2 renders the same capsule. The hero CTA's Figma 100,
   *  the nav bar's 170 and the active indicator's 100 are three spellings of
   *  this one instruction. */
  pill: 999,
} as const;

export const size = {
  /** Compact brand control height — form CTAs and text fields.
   *  NO FIGMA PRECEDENT: the onboarding frame has one control (78pt) and no
   *  inputs at all. 56 is chosen because it (a) sits on the 8pt grid the
   *  spacing scale already uses (48 + 8), (b) clears the 44pt iOS / 48dp
   *  Android minimum tap target with room, and (c) is ~72% of the 78pt hero,
   *  so the hero stays unambiguously the loudest control in the app. */
  control: 56,
} as const;

export const fontFamily = {
  /** Must equal the key passed to `useFonts` in `theme/fonts.ts`. */
  jostBlack: 'Jost_900Black',
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  // Brand type (Figma spots-onboarding, node 4:75). `fontWeight` here documents
  // intent only — the components apply `fontFamily`/`fontSize` and deliberately
  // omit `fontWeight`, because pairing it with an explicitly-registered static
  // font can make iOS synthesize or substitute a weight.
  wordmark: { fontFamily: fontFamily.jostBlack, fontSize: 96, fontWeight: '900' },
  brandCta: { fontFamily: fontFamily.jostBlack, fontSize: 32, fontWeight: '900' },
  /** Compact brand CTA label. NO FIGMA PRECEDENT. 20 rather than the 23 a
   * literal 78:32 scaling would give, because Jost Black at 20 already carries
   * more visual weight than the 24px system-semibold `title` above it — a form
   * CTA must not out-shout the screen's heading, whereas on onboarding the CTA
   * *is* the content. 20/56 = 0.357 vs. the hero's 32/78 = 0.410: the compact
   * button is deliberately a little airier, which reads better small. */
  brandCtaCompact: { fontFamily: fontFamily.jostBlack, fontSize: 20, fontWeight: '900' },
} as const;
