// Brand copy for the auth stack, collected in one place so it's easy to swap
// once final wording is approved.
//
// TODO(O10 / brand): every string below is a PLACEHOLDER from the
// mobile-auth-screens plan, in the warm, group-first Spots voice. None of
// this is final — Krish must sign off on the tagline, sub-tagline, CTA
// labels, and headings before release. Do not treat this wording as
// approved copy; update it here (only) once finalized.

export const copy = {
  landing: {
    // Approved by design (Figma spots-onboarding 4:75) — unlike the rest of
    // this file, these two are not placeholders. The onboarding frame carries
    // no tagline, sub-headline, or legal line, so none is added here.
    signInCta: 'Sign In',
    registerCta: 'Register',
  },
  login: {
    heading: 'Welcome back',
    submitCta: 'Log in',
    footerPrompt: 'New here?',
    footerCta: 'Register',
    invalidCredentials: 'Invalid email or password.',
    notConfirmedInfo: 'Confirm your email to continue.',
    verifiedInfo: "You're verified — log in to finish.",
    serviceUnavailable: 'Service unavailable, try again.',
  },
  register: {
    heading: 'Create your account',
    reassurance: 'Set up your account to start planning with your people.',
    passwordHelper: 'At least 12 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.',
    weakPassword: 'Password does not meet the requirements.',
    emailTaken: 'That email is already registered.',
    loginLink: 'Log in',
    submitCta: 'Create account',
  },
  confirm: {
    heading: 'Confirm your email',
    body: (email: string) => `We just emailed a code to ${email}.`,
    invalidCode: 'Code is invalid or has expired.',
    resendHint: "Didn't get a code? Check spam.",
    submitCta: 'Confirm',
  },
  forgotPassword: {
    heading: 'Reset your password',
    body: "Enter your email and we'll send you a reset code.",
    submitCta: 'Send code',
    // Deliberately conditional ("if there's an account"). The edge returns 204
    // whether or not the address is registered, so promising an email would be
    // a lie for a typo'd address — and confirming one would leak that the
    // account exists. Do not reword this into a definite statement.
    sentInfo: "If there's a Spots account for that address, we've sent a code. It expires in an hour.",
    tooManyRequests: 'Too many attempts. Wait a bit and try again.',
    backToLoginCta: 'Back to log in',
    linkCta: 'Forgot password?',
  },
  resetPassword: {
    heading: 'Choose a new password',
    // The RESET code lasts one hour — NOT the 24 hours of the sign-up
    // confirmation code. Do not copy this wording from `confirm`.
    body: (email: string) => `Enter the code we emailed to ${email}. It expires an hour after it was sent.`,
    invalidCode: 'Code is invalid or has expired. Request a new one.',
    weakPassword: 'Password does not meet the requirements.',
    tooManyRequests: 'Too many attempts. Wait a bit and try again.',
    successInfo: 'Password updated — log in with your new password.',
    submitCta: 'Update password',
  },
  // RETIRED: `copy.home`. Its `greeting` lost its only consumer when Krish
  // removed HomeScreen's temporary session scaffold, and `logoutCta` moved to
  // `copy.profile.logoutCta` along with the logout control itself. A dead string
  // left behind is a string the next reader has to rule out.
  /** Accessible names for the signed-in bottom nav (Figma home-screen 4:164).
   *  The frame carries icons only, so these are labels we supply. */
  tabs: {
    home: 'Home',
    map: 'Map',
    chat: 'Spots AI',
    groups: 'Groups',
    profile: 'Profile',
  },
  // The four placeholder destinations. Routes exist so the nav is real; the
  // screens are not designed. `chat` in particular is the AI assistant's ROUTE,
  // not its design.
  map: { heading: 'Map', body: 'Your trips on a map. Coming soon.' },
  chat: { heading: 'Spots AI', body: 'Your travel assistant. Coming soon.' },
  groups: { heading: 'Groups', body: 'The people you travel with. Coming soon.' },
  // `Profile` is a placeholder destination that nevertheless owns one REAL
  // control: `logoutCta` labels the app's only `signOut()` call site.
  profile: {
    heading: 'Profile',
    body: 'Your account and settings. Coming soon.',
    logoutCta: 'Log out',
  },
} as const;
