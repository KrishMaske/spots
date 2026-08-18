// The brand repoint as an executable contract rather than a diff you have to
// trust (docs/plans/brand-rollout.md §2).
//
// This suite is the ONE exemption from the double-entry rule: comparing token
// values to literals and to each other is its entire job.

import { darkTheme, lightTheme } from '../themes';

describe('the app has exactly one yellow', () => {
  it('points colors.accent at the brand primary', () => {
    expect(lightTheme.colors.accent).toBe('#FFC203');
    expect(lightTheme.colors.accent).toBe(lightTheme.brand.primary);
  });

  it('derives accentPressed by the same 90% multiply as the retired pair', () => {
    // #FFD400 → #E6BF00 was a 90% per-channel multiply; the same rule on
    // #FFC203 gives #E6AF03.
    expect(lightTheme.colors.accentPressed).toBe('#E6AF03');
  });

  it('makes onAccent byte-identical to brand.onPrimary in both modes', () => {
    // Was #0A0A0A — an invisible-but-real 10 units away from the brand black.
    expect(lightTheme.colors.onAccent).toBe('#000000');
    expect(darkTheme.colors.onAccent).toBe('#000000');
    expect(lightTheme.colors.onAccent).toBe(lightTheme.brand.onPrimary);
    expect(lightTheme.colors.accent).toBe(darkTheme.colors.accent);
  });
});

describe('light mode adopts the brand ramp', () => {
  it('uses the onboarding canvas as the page background', () => {
    expect(lightTheme.colors.bg).toBe('#F8FAFC');
    expect(lightTheme.colors.bg).toBe(lightTheme.brand.canvas);
  });

  it('lifts surfaces to white so inputs sit ABOVE the tinted canvas', () => {
    expect(lightTheme.colors.surface).toBe('#FFFFFF');
  });

  it('uses the brand hairline as the border', () => {
    expect(lightTheme.colors.border).toBe('#E2E8F0');
    expect(lightTheme.colors.border).toBe(lightTheme.brand.hairline);
  });
});

// DELIBERATE REVERSAL (docs/plans/spots-background-and-dark-mode.md §4). Two
// assertions that used to live under "what the repoint deliberately did NOT
// reach" — `darkTheme.colors.bg === '#0A0A0A'` and
// `lightTheme.brand toEqual darkTheme.brand` — stopped being true when dark mode
// landed. They were not deleted; they were replaced by the sharper claims they
// became, below. The rest of that describe still holds and stays where it was.
describe('dark mode adopts its own chrome ramp', () => {
  it('paints the dark canvas and keeps bg pointing at it', () => {
    expect(darkTheme.colors.bg).toBe('#0F1115');
    expect(darkTheme.colors.bg).toBe(darkTheme.brand.canvas);
  });

  it('drops surfaces to the dark field fill instead of white', () => {
    expect(darkTheme.colors.surface).toBe('#1A1D23');
  });

  it('flips the text ramp so nothing is black on near-black', () => {
    // Was trueBlack on palette.black — 1.06:1.
    expect(darkTheme.colors.text).toBe('#F5F5F5');
    // Was gray500 — 3.55:1 on the dark canvas, below the 4.5:1 AA minimum at
    // the 12px used for helper/caption text. #94A3B8 measures 7.37:1.
    expect(darkTheme.colors.textMuted).toBe('#94A3B8');
  });

  it('uses the dark brand hairline as the border', () => {
    expect(darkTheme.colors.border).toBe('#2E333B');
    expect(darkTheme.colors.border).toBe(darkTheme.brand.hairline);
  });
});

describe('the brand control ramp is mode-invariant; the chrome is not', () => {
  it('keeps the yellow, the cream and the black label identical in both modes', () => {
    expect(lightTheme.brand.primary).toBe(darkTheme.brand.primary);
    expect(lightTheme.brand.onPrimary).toBe(darkTheme.brand.onPrimary);
    expect(lightTheme.brand.secondarySurface).toBe(darkTheme.brand.secondarySurface);
  });

  it('moves the canvas, the hairline and marks-on-canvas per mode', () => {
    expect(lightTheme.brand.canvas).toBe('#F8FAFC');
    expect(darkTheme.brand.canvas).toBe('#0F1115');
    expect(lightTheme.brand.hairline).toBe('#E2E8F0');
    expect(darkTheme.brand.hairline).toBe('#2E333B');
    expect(lightTheme.brand.onCanvas).toBe('#000000');
    expect(darkTheme.brand.onCanvas).toBe('#F5F5F5');
  });

  it('keeps bg and border pointing at the brand chrome in BOTH modes', () => {
    expect(lightTheme.colors.bg).toBe(lightTheme.brand.canvas);
    expect(lightTheme.colors.border).toBe(lightTheme.brand.hairline);
    expect(darkTheme.colors.bg).toBe(darkTheme.brand.canvas);
    expect(darkTheme.colors.border).toBe(darkTheme.brand.hairline);
  });

  it('keeps onCanvas distinct from onPrimary as an IDEA, not just a value', () => {
    // They are byte-identical in light. That coincidence is exactly what made
    // SpotsWordmark's `onPrimary` read look correct for the whole brand
    // rollout, and dark mode is where it breaks.
    expect(lightTheme.brand.onCanvas).toBe(lightTheme.brand.onPrimary);
    expect(darkTheme.brand.onCanvas).not.toBe(darkTheme.brand.onPrimary);
  });
});

describe('the backdrop opacity ceiling sits inside the contrast budget', () => {
  // CONSERVATIVE, well inside the AA budget — not the budget's edge. Solving
  // for the binding foreground (#6B6B6B light, #94A3B8 dark) over a spot puts
  // the AA-limiting alpha at ≈ 0.26 light and ≈ 0.22 dark, so the shipped
  // ceilings carry roughly 3.2x and 2.2x of headroom. They are picked for
  // subtlety; the budget is what bounds them, not what sets them.
  // (docs/plans/spots-background-and-dark-mode.md §5.6.)
  it('caps a single spot at 8% in light and 10% in dark', () => {
    expect(lightTheme.backdrop.spotOpacity).toBe(0.08);
    expect(darkTheme.backdrop.spotOpacity).toBe(0.1);
  });

  it('draws spots in the one brand yellow, in both modes', () => {
    expect(lightTheme.backdrop.spot).toBe('#FFC203');
    expect(darkTheme.backdrop.spot).toBe('#FFC203');
  });
});

// Additive, from the Home frame (Figma home-screen 4:164). Nothing above is
// repointed — `surfaceRaised` and `elevation` are new members.
describe('the Home raised surface and its shadow', () => {
  it('keeps the raised surface genuinely raised in BOTH modes', () => {
    expect(lightTheme.colors.surfaceRaised).toBe('#FAF8F6');
    expect(lightTheme.colors.surfaceRaised).not.toBe(lightTheme.colors.surface);
    // THIS ASSERTION IS INVERTED ON PURPOSE (was `.toBe`). Dark `surfaceRaised`
    // used to be #1A1D23 — byte-identical to `surface`, 1.00:1 — which the
    // dark-mode change recorded as a stated limitation (O-3) rather than a
    // feature. #373E4A is the fix: 1.57:1 from `surface`, 1.76:1 from the canvas.
    expect(darkTheme.colors.surfaceRaised).toBe('#373E4A');
    expect(darkTheme.colors.surfaceRaised).not.toBe(darkTheme.colors.surface);
  });

  it('leaves every previously-shipped colour exactly where it was', () => {
    // `surfaceRaised` is an addition, not a repoint.
    expect(lightTheme.colors.bg).toBe('#F8FAFC');
    expect(lightTheme.colors.surface).toBe('#FFFFFF');
    expect(lightTheme.colors.text).toBe('#0A0A0A');
    expect(lightTheme.colors.border).toBe('#E2E8F0');
  });

  it('spells the card shadow for both platforms (Figma 0px 4px 10px rgba(0,0,0,0.35))', () => {
    // shadowRadius is 5, not 10: a CSS blur-radius b is a Gaussian of ~b/2,
    // which is what iOS takes. `elevation` is Android's only knob and is a pick.
    expect(lightTheme.elevation.card.shadowColor).toBe('#000000');
    expect(lightTheme.elevation.card.shadowOffset).toEqual({ width: 0, height: 4 });
    expect(lightTheme.elevation.card.shadowOpacity).toBe(0.35);
    expect(lightTheme.elevation.card.shadowRadius).toBe(5);
    expect(lightTheme.elevation.card.elevation).toBe(6);
  });

  it('gives the nav centre button its OWN offset and a higher elevation', () => {
    // The exported centre ellipse (10:6) offsets by dy 2 with stdDeviation 5 —
    // NOT the card's dy 4. Deliberately not collapsed into one shared shadow.
    expect(lightTheme.elevation.floating.shadowOffset).toEqual({ width: 0, height: 2 });
    expect(lightTheme.elevation.floating.shadowRadius).toBe(5);
    expect(lightTheme.elevation.floating.shadowOpacity).toBe(0.35);
    // Android z-order follows elevation, and the circle overflows the bar.
    expect(lightTheme.elevation.floating.elevation).toBeGreaterThan(
      lightTheme.elevation.card.elevation
    );
    expect(lightTheme.elevation.floating.elevation).toBe(10);
  });

  it('keeps the shadow mode-invariant, which is a limitation not a feature', () => {
    // 35% black still does nothing on #0F1115, so in dark mode the FILL carries
    // all of the separation. That is exactly why `surfaceRaised` had to be
    // lifted to #373E4A (1.76:1) — O-3, now resolved.
    expect(darkTheme.elevation).toEqual(lightTheme.elevation);
  });

  it('adds the feed card radius as a real measurement, not another pill', () => {
    // 50 on a 326x236 card is NOT clamped by height/2 (118), unlike the hero
    // CTA's 100 on 60pt or the nav bar's 170 on 51pt.
    expect(lightTheme.radius.xxxl).toBe(50);
    expect(lightTheme.radius.pill).toBe(999);
  });
});

// Additive, from the glass tab pill.
describe('the glass tokens', () => {
  it('keeps the specular white mode-invariant, like elevation', () => {
    // A specular highlight is white regardless of the substrate, which is exactly
    // the kind of reason `elevation` is mode-invariant too. No existing token
    // would do: `colors.surface` is white in light but night800 in dark, and
    // `brand.onCanvas` is black in light.
    expect(lightTheme.glass.edge).toBe('#FFFFFF');
    expect(lightTheme.glass.highlight).toBe('#FFFFFF');
    expect(darkTheme.glass).toEqual(lightTheme.glass);
  });

  it('keeps them OUT of the brand and the colour ramps', () => {
    // Glass is chrome, not brand, and not a semantic colour.
    expect(Object.values(lightTheme.brand)).not.toContain(lightTheme.glass.edge);
    expect(Object.values(darkTheme.colors)).not.toContain(darkTheme.glass.edge);
  });
});

describe('what the repoint deliberately did NOT reach', () => {
  it('keeps the danger ramp off the brand', () => {
    expect(lightTheme.colors.danger).toBe(darkTheme.colors.danger);
    expect(lightTheme.colors.danger).not.toBe(lightTheme.colors.accent);
  });
});

describe('the compact control tokens', () => {
  it('sets the compact control height to 56', () => {
    expect(lightTheme.size.control).toBe(56);
  });

  it('sets the compact brand CTA label to 20', () => {
    expect(lightTheme.typography.brandCtaCompact.fontSize).toBe(20);
    expect(lightTheme.typography.brandCtaCompact.fontFamily).toBe('Jost_900Black');
  });

  it('sets the brand page gutter to the onboarding side margin', () => {
    expect(lightTheme.spacing.gutter).toBe(30);
  });
});
