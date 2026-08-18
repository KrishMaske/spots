// Layer 2 — semantic themes. Screens/components consume these, never the raw
// palette in tokens.ts directly.

import { palette, radius, size, spacing, typography } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  surface: string;
  /** A raised surface: the Home feed cards, the floating tab bar and the nav's
   *  centre circle (Figma home-screen 4:164 — #FAF8F6, and the exported centre
   *  ellipse 10:6 confirms the circle is the SAME linen, not white).
   *
   *  In light it is a warm tint, distinct from `surface` (white
   *  inputs/banners). In dark it is `night700`, which is genuinely lifted rather
   *  than a second name for `surface` — it used to be `night800`, i.e.
   *  byte-identical to `surface`, and a raised surface that is not raised is a
   *  token with no job. See `palette.night700` for the measured ratios AND for
   *  the one rule the lift creates: NO `textMuted` ON A DARK RAISED SURFACE
   *  (4.20:1, below AA). Use `colors.text`. */
  surfaceRaised: string;
  text: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  /** Text/icon color rendered on top of `accent`. Intentionally black in both
   * modes so text stays readable on the yellow accent regardless of theme. */
  onAccent: string;
  border: string;
  danger: string;
  success: string;
}

/** Spots brand surface. Its CONTROL ramp (the yellow fill, the cream fill, the
 * black label on both) is mode-invariant — that pairing is the product's
 * signature and reads correctly on either canvas. Its CHROME (canvas, hairline,
 * marks-on-canvas) is per-mode as of the dark-mode change, which deliberately
 * reverses O-C in docs/plans/brand-rollout.md. Screens read these; nothing here
 * overrides `colors.*`. */
export interface BrandColors {
  /** #FFC203 both modes — the control fill and the secondary stroke. */
  primary: string;
  /** #000000 both modes — the label ON the yellow/cream fills. */
  onPrimary: string;
  /** #FFF6EC both modes — the secondary (Register/Log out) fill. */
  secondarySurface: string;
  /** Page canvas. PER-MODE since the dark-mode change. */
  canvas: string;
  /** Frame/divider hairline. PER-MODE. */
  hairline: string;
  /** Brand marks drawn ON the canvas (the wordmark glyphs). PER-MODE.
   *  NOT the same thing as `onPrimary`, even though both are #000000 in
   *  light — that identity was a coincidence, and dark mode breaks it.
   *  Reach for `onPrimary` only when the mark sits on the yellow or the
   *  cream; reach for this when it sits on the page. */
  onCanvas: string;
}

/** Decorative backdrop layer (`components/SpottyBackground`). Kept out of
 * `BrandColors` because it carries a number and `BrandColors` is a string map. */
export interface BackdropTokens {
  /** Spot fill. The brand yellow in both modes — one yellow, one source. */
  spot: string;
  /** Opacity CEILING for a single spot. Per-mode because yellow at 8% on
   *  #F8FAFC and on #0F1115 are not the same picture.
   *
   *  These are CONSERVATIVE values chosen for subtlety, sitting well inside
   *  the contrast budget in docs/plans/spots-background-and-dark-mode.md §5.6
   *  rather than at its edge. Solving for the binding foreground (#6B6B6B on
   *  the light canvas, #94A3B8 on the dark) puts the AA-limiting alpha at
   *  ≈ 0.26 light and ≈ 0.22 dark — roughly 3.2x and 2.2x these ceilings. So
   *  raising them is an aesthetic argument with real headroom behind it, NOT
   *  one blocked by AA. §5.6's table is still the thing to argue against; it
   *  just is not a hard bound at 0.08/0.10. */
  spotOpacity: number;
}

/**
 * Glass surfaces: the nav bar's frost and the active-tab pill that floats on it.
 *
 * MODE-INVARIANT, like `elevation` and for the same kind of reason — a specular
 * highlight is white regardless of the substrate. Kept out of `BrandColors`
 * because these are not brand values; the `BackdropTokens` split is the
 * precedent. Consumed with a hex-alpha suffix, the `FormError`
 * `theme.colors.danger + '1A'` precedent.
 *
 * No existing token would do: `colors.surface` is white in light but night800 in
 * dark (invisible), and `brand.onCanvas` is black in light (wrong). This is
 * genuinely a third idea.
 *
 * Measured, WCAG 2.x, for the pill's 1px edge at alpha 0.70 over the bar:
 * 1.14:1 in light and 3.73:1 in dark. So THE GLASS EDGE IS A REAL DELINEATION IN
 * DARK AND PURELY COSMETIC IN LIGHT — that is what white-on-near-white does, not
 * a defect in the value.
 */
export interface GlassTokens {
  /** Specular edge — the pill's 1px border. */
  edge: string;
  /** Inner top highlight, the "lit" side of a glass slab. */
  highlight: string;
}

/** One drop shadow, spelled for both platforms. */
export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * Drop shadows for the Home surfaces (Figma home-screen 4:164).
 *
 * `shadowRadius` is 5, not 10, in both entries: a CSS/Figma blur-radius b
 * corresponds to a Gaussian of about b/2, which is what iOS `shadowRadius`
 * takes. The nav's centre ellipse states it the other way round in its exported
 * SVG (`feGaussianBlur stdDeviation="5"`, i.e. the Gaussian directly) and lands
 * on the same 5. `elevation` is Android's ONLY knob — it takes no colour,
 * offset or alpha — so both values are PICKS, eyeballed against the iOS result.
 *
 * NOT taken: RN 0.81's CSS-shaped `boxShadow` prop, which would transcribe the
 * Figma string exactly but only on the New Architecture (and Android 9+).
 * `app.json` now sets `newArchEnabled: true` explicitly — reanimated 4 has no
 * Paper implementation, so the bottom nav's motion depends on it — which removes
 * the architecture half of the old objection. What is left is that `boxShadow`
 * collapses five assertable numeric literals into one string, and that Android 9
 * is still the floor. Reconsider on its own merits; see the plan's O-6.
 *
 * Mode-invariant, and honestly so: a 35%-black shadow does nothing on #0F1115,
 * which is why dark separation falls back to the 1.12:1 fill difference (O-3).
 */
export interface ElevationTokens {
  /** Feed card + the floating nav bar. Figma: 0px 4px 10px rgba(0,0,0,0.35). */
  card: ElevationStyle;
  /**
   * The nav's centre button. NOT the same shadow as `card`, and deliberately
   * not collapsed into it: the exported ellipse (`10:6`) offsets by **2**, not
   * 4 (`feOffset dy="2"`, `feGaussianBlur stdDeviation="5"`, alpha 0.35). Its
   * `elevation` is also higher, because on Android elevation ALSO decides
   * z-order and the circle must paint above the bar it overflows.
   */
  floating: ElevationStyle;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  brand: BrandColors;
  backdrop: BackdropTokens;
  glass: GlassTokens;
  elevation: ElevationTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  size: typeof size;
}

const brandControls = {
  primary: palette.spotsYellow,
  onPrimary: palette.trueBlack,
  secondarySurface: palette.spotsCream,
} as const;

// The brand is no longer mode-invariant (this reverses O-C in
// docs/plans/brand-rollout.md). The CONTROL ramp above still is: the yellow
// CTA with its black label is the product's signature and reads correctly on
// either canvas. Only the chrome — canvas, hairline, marks-on-canvas — moves.
const lightBrand: BrandColors = {
  ...brandControls,
  canvas: palette.slate50,
  hairline: palette.slate200,
  onCanvas: palette.trueBlack,
};

const darkBrand: BrandColors = {
  ...brandControls,
  canvas: palette.night900,
  hairline: palette.night600,
  onCanvas: palette.night050,
};

// The repoint (docs/plans/brand-rollout.md §2): one yellow, one source.
// `onAccent` is `trueBlack`, not `palette.black`, so that `colors.accent` /
// `colors.onAccent` is byte-identical to `brand.primary` / `brand.onPrimary` —
// two "black on yellow" pairs differing by an invisible-but-real 10 units is
// exactly the drift this change exists to remove.
// Mode-invariant on purpose — see `GlassTokens`.
const glass: GlassTokens = {
  edge: palette.white,
  highlight: palette.white,
};

// Mode-invariant on purpose — see `ElevationTokens`.
const elevation: ElevationTokens = {
  card: {
    shadowColor: palette.trueBlack,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  floating: {
    shadowColor: palette.trueBlack,
    shadowOffset: { width: 0, height: 2 }, // the ellipse's own dy, not the card's 4
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 10, // above the bar's 6: on Android elevation is also z-order
  },
};

const sharedColors = {
  accent: palette.spotsYellow,
  accentPressed: palette.spotsYellowPressed,
  onAccent: palette.trueBlack,
  danger: palette.danger,
  success: palette.success,
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    bg: palette.slate50, // the onboarding canvas
    // On a tinted canvas, surfaces go white: gray100 (#F2F2F2) is darker and
    // warmer than the new bg, so it would sink every input below the page.
    surface: palette.white,
    // Warmer AND very slightly darker than the canvas, which is the Figma
    // relationship: the card sits on the page rather than glowing off it.
    // `colors.surface` (white) would invert it.
    surfaceRaised: palette.linen50,
    text: palette.black,
    textMuted: palette.gray500,
    border: palette.slate200, // the brand hairline
    ...sharedColors,
  },
  brand: lightBrand,
  backdrop: { spot: palette.spotsYellow, spotOpacity: 0.08 },
  glass,
  elevation,
  spacing,
  radius,
  typography,
  size,
};

// The dark ramp (docs/plans/spots-background-and-dark-mode.md §2). Chrome only:
// the canvas, surface, text, muted text and hairline move; the brand controls
// and the danger/success ramp do not. As in light, `bg === brand.canvas` and
// `border === brand.hairline`, so the two stay one decision.
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    bg: palette.night900, // was palette.black (#0A0A0A)
    surface: palette.night800, // was palette.white — a WHITE surface on a dark canvas
    // was palette.night800, which made "raised" byte-identical to `surface`
    // (1.00:1) and 1.12:1 from the canvas, with a black shadow that does nothing
    // on #0F1115 — no separation by any channel. night700 is 1.76:1 from the
    // canvas and 1.57:1 from `surface`. This resolves O-3 by LIFTING the surface
    // rather than outlining it; see `palette.night700` for why not both.
    surfaceRaised: palette.night700,
    text: palette.night050, // was palette.trueBlack — #000000 on #0A0A0A was 1.06:1
    textMuted: palette.slate400, // was gray500 — 3.55:1 on night900, below AA
    border: palette.night600, // was palette.slate200 — a light hairline on dark
    ...sharedColors,
  },
  brand: darkBrand,
  backdrop: { spot: palette.spotsYellow, spotOpacity: 0.1 },
  glass,
  elevation,
  spacing,
  radius,
  typography,
  size,
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
