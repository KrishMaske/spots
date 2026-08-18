export type AuthStackParamList = {
  Landing: undefined;
  Login: { email?: string; info?: string } | undefined;
  Register: undefined;
  Confirm: { email: string; info?: string };
  /** `email` is optional so Login can pre-fill whatever the user already typed. */
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string; info?: string };
};

/** The signed-in bottom-tab destinations (Figma home-screen 4:164). Four of the
 *  five are placeholder screens; `Chat` is the AI assistant's ROUTE, not its
 *  design. `AppStack.tsx` keeps its name while being a tab navigator, matching
 *  the `Landing`-vs-`onboarding` precedent — see the plan's O-9. */
export type AppStackParamList = {
  Home: undefined;
  Map: undefined;
  Chat: undefined;
  Groups: undefined;
  Profile: undefined;
};
