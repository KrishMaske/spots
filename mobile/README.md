# Mobile

Spots' mobile app: Expo (managed) + React Native + TypeScript. This is the
first runnable slice — the unauthenticated entry flow (Landing, Login,
Register, Confirm, ForgotPassword, ResetPassword) plus the theme system,
navigation, secure session storage, and a typed client wired to the Go edge's
`/v1/auth/*` endpoints.

## Resolved versions

Targets **Expo SDK 54** — the newest SDK the App Store / Play Store build of
**Expo Go** currently supports. (The app was first scaffolded on a pre-release
SDK 57 / React Native 0.86 line; Expo Go rejected that bundle with "requires a
newer version of Expo Go," so it was brought down to the stable SDK 54 line on
2026-07-04.)

| Package | Version |
|---|---|
| `expo` | ~54.0.0 (SDK 54) |
| `react-native` | 0.81.5 |
| `react` | 19.1.0 |
| `typescript` | ~5.9.2 |
| `expo-font` | ~14.0.12 |
| `expo-splash-screen` | ~31.0.13 |
| `expo-asset` | ~12.0.13 |
| `@expo-google-fonts/jost` | ^0.4.2 |
| `@react-navigation/bottom-tabs` | ^7.18.16 |
| `expo-blur` | ~15.0.8 |
| `react-native-reanimated` | ~4.1.1 (4.1.7 resolved) |
| `react-native-gesture-handler` | ~2.28.0 |
| `react-native-worklets` | **0.5.1, pinned exactly** |

`expo-blur` is the bottom nav's single `BlurView` (the bar is glass; see "The
bottom nav's feel"). It was owed a row here from two changes ago.

`react-native-reanimated` + `react-native-gesture-handler` arrived with the
`tabbar-instant-feel` change and exist for **one component**: they are what let
`SpotsTabBar` do native gesture recognition and UI-thread animation. Both are
bundled in Expo Go for SDK 54, so no dev client is needed.

**`react-native-worklets` is pinned to an exact `0.5.1`, and that is not
tidiness.** It is reanimated's *peer* dependency (range `0.5 - 0.8`), so without
a direct entry npm hoists whatever satisfies the range — which was **0.8.3**, and
on 0.8.3 `WorkletsModule/NativeWorklets.native.ts` throws
`[Worklets] Native part of Worklets doesn't seem to be initialized` **at import
time**, taking down the entire jest suite before a single test runs. The library
ships a jest resolver for that (`react-native-worklets/jest/resolver.js`, which
strips `.native` from the extension list), but wiring it here would have to
*compose* with the resolver `jest-expo`'s preset already installs rather than
replace it. `npx expo install react-native-worklets` picks 0.5.1 — the version
Expo Go's native side actually ships for SDK 54 — which has no such stub and
needs no resolver. **Do not "upgrade" this line.**

`app.json` sets `"newArchEnabled": true`. SDK 54 already defaults to it, but
reanimated 4 has **no Paper implementation**, so the dependency is now stated
rather than inherited.

**There is deliberately no `babel.config.js`, and someone will try to add one.**
`@expo/metro-config`'s `loadBabelConfig.js` falls back to
`expo/internal/babel-preset` when no config file exists, and `jest-expo`'s
`resolveBabelConfig.js` does the same for the jest transform;
`babel-preset-expo/build/index.js` then adds `require('react-native-worklets/plugin')`
automatically whenever `react-native-worklets` is installed. The plugin is
already applied on **both** paths. Hand-writing a config that lists it risks
applying it twice. If one is ever added for another reason it must contain
`presets: ['babel-preset-expo']` and **no worklets/reanimated plugin entry**.

`tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`.

`expo-font` + `expo-splash-screen` + `@expo-google-fonts/jost` exist for the
onboarding wordmark (see "Onboarding screen" below). The two Expo packages were
added with `npx expo install`, which also appended `"expo-font"` to `app.json`'s
`plugins` — a no-op for Expo Go (config plugins only run at prebuild/EAS build),
kept because it is what the tooling generates.

**`expo-asset` is a direct dependency on purpose, and this costs an hour the
second time.** It was always present — but nested at
`node_modules/expo/node_modules/expo-asset`, because npm hoisted it under its
parent rather than to the root. `TextField`'s show/hide eye icon pulls
`@expo/vector-icons` → `expo-font` → `expo-asset`, and Node resolves that last
hop from `node_modules/expo-font/`, which walks `expo-font/node_modules` →
`node_modules` → miss. It never looks inside `expo/node_modules`. Six test
suites failed to even *run* with `Cannot find module 'expo-asset'`. The fix is
`npx expo install expo-asset`, which promotes it to a direct dependency and
hoists it to the root — **not** a jest `moduleNameMapper` entry or a mock of
`@expo/vector-icons`, since the dependency is real at runtime too. Like
`expo-font`, this appended `expo-asset` to `app.json`'s `plugins` (a no-op for
Expo Go; kept because it is what the tooling generates).

`@react-navigation/bottom-tabs` is the signed-in tab shell (see "Home screen &
bottom nav"); it was added with `npx expo install` and its peers
(`react-native-screens`, `react-native-safe-area-context`) were already present.

Dependencies are pinned to the versions `expo install` selects for SDK 54, so
`npm install` resolves cleanly (no `--legacy-peer-deps`). `npx expo-doctor`
passes 17/18 as of 2026-08-17; the single failure is upstream patch drift
(`expo` 54.0.35 installed vs. ~54.0.36 expected — 54.0.36 was published
2026-07-15, after this lockfile), not a project defect. `npx expo install --check`
clears it. When bumping the SDK later, drive it with
`npx expo install expo && npx expo install --fix` rather than hand-editing
versions, and confirm the target SDK is supported by the installed Expo Go
before shipping.

## Prerequisites

- Node.js (v20 verified) and npm.
- **Expo Go** on a physical iPhone/Android device (the primary dev target for
  this project — the dev machine is Windows, so there is no iOS simulator).
- The Go edge running locally (see "Connecting to the backend" below).

## Run it

```powershell
cd mobile
npm install
npx expo start
```

Scan the QR code with the iPhone Camera app (opens in Expo Go) or press `a`
for an Android emulator.

## Connecting to the backend

The app talks to the Go edge (`spotsd`) over plain HTTP in dev. The base URL
is a **bare origin** (no `/v1` suffix — the API client owns `/v1` and
`/healthz`), read from `EXPO_PUBLIC_API_BASE_URL` (inlined at build time by
Expo; see `src/config/env.ts`).

| Runtime target | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Physical device via Expo Go (**default target for this project**) | `http://<dev-machine-LAN-IP>:8080` |
| Android emulator (AVD) | `http://10.0.2.2:8080` (10.0.2.2 = host loopback) |
| iOS simulator (Mac only — not available on this Windows box) | `http://localhost:8080` |

The fallback baked into `src/config/env.ts` is `http://192.168.1.175:8080` —
Krish's dev machine's LAN IP as of 2026-07-03. **This will change** across
networks/reboots; don't rely on the fallback. Instead, copy `.env.example` to
`.env` in `mobile/` and set `EXPO_PUBLIC_API_BASE_URL` there:

```powershell
copy .env.example .env
notepad .env   # set EXPO_PUBLIC_API_BASE_URL to your current LAN IP
```

**How to find your LAN IP (Windows):**

```powershell
ipconfig
```

Look for the `IPv4 Address` under your active adapter (e.g. `Wireless LAN
adapter Wi-Fi`). Use that with port `8080`, e.g.
`http://192.168.1.175:8080`.

### Steps to test against the local backend

1. Start local infra if needed: `docker compose -f backend/deploy/local/docker-compose.yml up -d`.
2. Start the edge from `backend/`: `go run ./golang`. `backend/.env` must have
   the Cognito vars set (`SPOTS_COGNITO_ISSUER_URL`, `_JWKS_URL`,
   `_APP_CLIENT_ID`, `_REGION`) for `/v1/auth/*` to be registered — otherwise
   the server still starts and serves `/healthz`, but auth calls 404.
3. Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` for your target (see table
   above).
4. `npx expo start` in `mobile/`; open in Expo Go on your phone (same Wi-Fi
   network as the dev machine) or an Android emulator.
5. Sanity-check connectivity before touching auth: `GET /healthz` from the
   device should return `{"status":"ok","service":"spotsd",...}`. (`src/api/health.ts`
   exposes `checkHealth()` for this; there's no permanent in-app UI for it —
   it was used as a one-time build-verification step per the mobile-auth-screens
   plan, step 6.) You can also verify from a browser/PowerShell on the dev
   machine itself: `Invoke-RestMethod http://localhost:8080/healthz`.

### Firewall

Testing on a physical device requires the dev machine's firewall to allow
inbound `:8080` on the LAN, and the phone + dev machine must be on the same
Wi-Fi network. On Windows, if the first connection attempt hangs/times out,
check Windows Defender Firewall → allow `go.exe` / port 8080 on Private
networks.

### Cleartext HTTP (iOS ATS / Android)

The dev edge is plain `http://`, which both platforms restrict by default in
release builds:

- **Expo Go already allows it — no extra config needed for the primary dev
  path.** Expo Go itself ships with iOS ATS arbitrary-loads and Android
  cleartext permissions baked into its own shell app (it has to, to load the
  JS bundle from Metro over HTTP). Testing via Expo Go on your phone works
  against `http://<LAN-IP>:8080` out of the box.
- **`app.json` still declares an explicit ATS exception**
  (`ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking: true`) for
  when this app eventually moves to a **custom dev client or standalone
  build** (`expo prebuild` / EAS build). Those builds use this app's own
  Info.plist, not Expo Go's, so without this entry cleartext LAN requests
  would be blocked. `NSAllowsLocalNetworking` covers RFC 1918 private ranges
  generically, so it doesn't need updating every time your LAN IP changes.
- Android has an equivalent gap for standalone builds (cleartext blocked by
  default on API 28+); Expo Go's own cleartext allowance covers this project
  today. If a standalone Android build is ever needed, add an explicit
  network security config at that point.
- The deployed edge should be HTTPS so none of this applies to a release
  build.

### CORS

Not applicable — React Native's `fetch` is a native networking call, not a
browser `XMLHttpRequest`, so it isn't subject to browser CORS. The Go edge has
no CORS middleware and doesn't need one for this client.

## Project layout

```text
mobile/
├── app.json                 # Expo config: name "Spots", slug/scheme "spots"
├── App.tsx                  # root: font gate + providers + navigation container
├── .env.example              # EXPO_PUBLIC_API_BASE_URL targets
├── assets/                  # launcher art (icon/splash/favicon), referenced by app.json
│   └── images/              # content art bundled via require(): brandmark-logo.png
│                            #   (the wordmark's ring "o"), spots-logo.png (the dot
│                            #   cluster, now only the nav's centre button), map.png
└── src/
    ├── api/
    │   ├── client.ts         # fetch wrapper: base URL, JSON, auth header, ApiError
    │   ├── auth.ts           # register/confirm/login/refresh/logout +
    │   │                     #   forgotPassword/resetPassword callers
    │   ├── health.ts         # GET /healthz caller
    │   ├── types.ts          # hand-written DTOs mirroring the Go structs
    │   └── generated/        # reserved for future OpenAPI codegen (empty)
    ├── app/
    │   └── RootNavigator.tsx # Auth stack vs App stack, keyed off AuthContext
    ├── auth/
    │   ├── AuthContext.tsx   # session state + register/confirm/signIn/signOut
    │   ├── session.ts        # token model + SecureStore read/write/clear
    │   ├── useAuth.ts
    │   └── validators.ts     # email format, Cognito password policy, confirm-match
    ├── components/           # Screen, TextField, FormError, BrandButton,
    │                          #   TextLink, AuthHeader, SpotsWordmark,
    │                          #   SpottyBackground, FeedCard, SpotsTabBar,
    │                          #   AppFrame
    ├── config/
    │   └── env.ts             # EXPO_PUBLIC_API_BASE_URL with a safe dev default
    ├── navigation/
    │   ├── AuthStack.tsx      # Landing → Login → Register → Confirm, plus
    │   │                      #   Login → ForgotPassword → ResetPassword → Login
    │   ├── AppStack.tsx       # signed-in bottom-tab navigator (Home, Map, Chat,
    │   │                      #   Groups, Profile) with a custom SpotsTabBar
    │   └── types.ts
    ├── screens/               # LandingScreen, LoginScreen, RegisterScreen,
    │                          # ConfirmScreen, ForgotPasswordScreen,
    │                          # ResetPasswordScreen, HomeScreen, MapScreen,
    │                          # ChatScreen, GroupsScreen, ProfileScreen
    ├── theme/
    │   ├── tokens.ts          # raw palette/spacing/typography (brand placeholders)
    │   ├── themes.ts          # light/dark semantic Theme objects + theme.brand.*
    │   ├── copy.ts            # ALL auth-flow brand copy (placeholder, see below)
    │   ├── onboarding.ts      # Figma geometry + pure computeOnboardingLayout()
    │   ├── home.ts            # Figma geometry + pure computeHomeLayout()
    │   ├── spots.ts           # seeded scatter geometry + pure generateSpots()
    │   ├── fonts.ts           # useBrandFonts() — the only expo-font consumer
    │   ├── ThemeProvider.tsx
    │   └── useTheme.ts
    └── testing/
        └── screenTestUtils.tsx # shared RNTL render helper for screen tests
```

## Testing

```powershell
cd mobile
npm test          # jest (jest-expo preset + React Native Testing Library)
npm run typecheck # tsc --noEmit
```

Covers: the API client's status-code → `ApiError` mapping, session store
save/load/clear round-trips against a mocked SecureStore, password/email
validators, `BrandButton` at both sizes (hero geometry/typography against the
Figma literals; compact capsule, 20px Jost Black label, Dynamic Type, loading
and disabled press behavior), `TextLink` (transparent, neutral-text, never brand
yellow, still `accessibilityRole="button"`), `TextField` (56pt capsule, radius
25, resting/focus/error borders, helper-vs-error text, the Show/Hide toggle
flipping `secureTextEntry`), the theme repoint and the dark ramp as executable
invariants (`theme/__tests__/themes.test.ts` — one yellow,
`onAccent === brand.onPrimary`, the light brand ramp, the dark chrome ramp, the
control-ramp/chrome split, the backdrop opacity ceilings),
`FormError`'s error/info variants (danger styling vs. the neutral
surface/border/text treatment), each of the six auth screens (wordmark
header/heading render, DTO sent to the mocked `auth.*` call, error text on the
mapped status code, navigation intent on success), `AuthContext` bootstrap
and one-shot session refresh, and `HomeScreen` (logout + the `/v1/users/me`
proof-of-session call), the onboarding layout math at three device sizes
(`theme/__tests__/onboarding.test.ts`, pure — no renderer), the `SpotsWordmark`
geometry/typography at hero and header scale, and a guard test
(`screens/__tests__/noRawHex.test.ts`) that **discovers** every `.tsx` in
`src/screens/` and `src/components/` and asserts none contains a raw hex or a
resurrected pre-brand yellow — a new screen is covered the moment it lands,
with no list to remember. The dark-mode/backdrop change added three suites: the
scatter geometry (`theme/__tests__/spots.test.ts`, pure — determinism, bounds,
count at three device sizes, and an exact-literal tripwire), the backdrop
component (`components/__tests__/SpottyBackground.test.tsx`), and `Screen`
itself (`components/__tests__/Screen.test.tsx` — the `backdrop` prop's opt-in
default, z-order, `pointerEvents`, the placement outside `KeyboardAvoidingView`,
and the per-mode `StatusBar` style).

The Home/bottom-nav change added four suites: the Home layout math at three
device sizes plus insets (`theme/__tests__/home.test.ts`, pure — no renderer,
including the "the third card overflows, which is why the feed scrolls" check),
`components/__tests__/FeedCard.test.tsx` (geometry, radius, fill, the shadow on
the OUTER view and **no `overflow` on it** — the iOS clipping trap — and the
empty-vs-image states), `components/__tests__/SpotsTabBar.test.tsx` (geometry,
five press targets, the moving active indicator, ≥44pt tap targets, a11y, the
overflowing centre button and the walk-up assertion that **no ancestor clips
it**), and `screens/__tests__/tabPlaceholders.test.tsx` (deliberately thin — these
are routes, not designs). `HomeScreen.test.tsx` and `themes.test.ts` grew
**additively**; their existing assertions are untouched. **436 tests across 28
suites** as of 2026-08-17 (see `docs/current-scaffold.md` for the live count).

### Testing the bottom nav's gestures

`SpotsTabBar.test.tsx` is the only suite that touches reanimated or
gesture-handler, and it states three rules at the top of the file:

1. **Positions are read with `getAnimatedStyle`, and only after `settle()`.**
   reanimated starts the mapper that feeds `useAnimatedStyle` through `runOnUI`,
   which under jest is a `setTimeout(0)` — until that macrotask runs, the animated
   style holds its initial value and nothing propagates. `settle()` is
   `await act(async () => { await new Promise(r => setTimeout(r, 0)); })` followed
   by an empty `act`, which drains the `runOnJS` microtasks in the same call. The
   old `__getValue()` helper (a React Native private) is gone.
   **The one case `getAnimatedStyle` cannot see** is an indicator that *mounts* at
   a value the shared value already held — the pill reappearing after the centre
   button was active. Nothing changed, so the mapper never ran, so
   `props.jestAnimatedStyle` still holds the first render's number while the
   rendered `props.style` is correct. A second helper, `mountedPosition()`, exists
   for exactly that one assertion, and the divergence is documented at both.
2. **`onSelect` is asynchronous from a gesture** (`runOnJS` → `queueMicrotask`),
   so every assertion on it follows a `settle()`. The accessibility path is
   synchronous — it never leaves the JS thread.
3. **The 3pt drag threshold is asserted as configuration, not behaviour** —
   `getByGestureTestId('tab-bar-gesture').config.activeOffsetXStart` / `…End`. It
   is a native activation criterion now; no JS harness evaluates it.

`.withTestId('tab-bar-gesture')` / `.withTestId('tab-bar-tap')` are **gesture**
test ids, registered in gesture-handler's own handler registry. They add nothing
to the rendered tree, so every view `testID` survives verbatim.

**`fireGestureHandler` is deliberately not used, and the reason is worth knowing
before reaching for it.** It drives the whole gesture in one call and **always
appends an END** — its `shouldDuplicateLastEvent` predicate is
`!END || !FAILED || !CANCELLED`, which no single state can falsify. So it cannot
express a CANCELLED gesture, a gesture paused mid-flight while a prop changes
under it, or a Tap that follows the Pan's BEGAN on the same touch (which is what
a composed `Gesture.Race` actually sees) — and this suite needs all three. The
local `driver()` helper emits on the same `DeviceEventEmitter` channel in the
same event shape, taking the handler tag from `getByGestureTestId`.

**The four icon tabs are activated with `fireEvent(el, 'accessibilityTap')`, not
`fireEvent.press`.** RNTL gates `press` on `pointerEvents`
(`helpers/pointer-events.js`), so a press on a `pointerEvents="none"` element is
skipped and no handler runs — which is exactly right, because that is what a
finger does. The assistive path needs its own event, and it is a truer simulation
of what VoiceOver delivers than a synthetic press ever was. `tab-chat` keeps
`fireEvent.press`, because the centre button keeps its pointer events.

**`SpottyBackground.test.tsx` is once again the only suite in the repo that
starts an animation.** No test in the tab-bar suite does: Reduce Motion is pinned
ON, so every position change is an assignment and every asserted number is exact
rather than mid-flight.

**Known harness noise:** the tab-bar suite prints four
`An update to Icon inside a test was not wrapped in act(...)` lines per run.
`MaterialIcons` loads its TTF in `componentDidMount` and `setState`s when that
promise resolves; this is the only suite that lets a macrotask through, so it is
the only place that ever lands, and the `setState` is enqueued from a promise
chain outside the act scope (draining it at 0ms, at 20ms, or in an `afterEach`
does not silence it). Mocking `@expo/vector-icons` would, and is the wrong answer
for the same reason the `expo-asset` note above gives. Four console lines against
43 green tests.

`jest.setup.ts` carries four deliberate test-environment pins, each with a
stated reason in the file:

1. the `react-native-safe-area-context` mock;
2. the asset registry re-mocked with **plain functions** rather than `jest.fn()`
   — `jest-expo`'s preset mocks it with mocks, and the suites that call
   `jest.resetAllMocks()` in a `beforeEach` strip the implementations, after
   which `expo-asset` throws `Module "1" is missing from the asset registry` in
   any test that renders a secure `TextField`;
3. **Reduce Motion pinned ON**, for the same plain-function reason, so the
   backdrop renders its static scatter in every screen test. This one matters
   more than it looks — see "Floating spotty background" below;
4. `require('react-native-gesture-handler/jestSetup')` —
   `RNGestureHandlerModule` is a TurboModule with no jest implementation, and
   `jest-expo` mocks Expo's modules but not this one. It is a `require` **in
   `setupFilesAfterEnv`, not a `setupFiles` entry** (which is what the library's
   docs suggest): `jest-expo`'s preset *pushes* its own setup onto `setupFiles`,
   and a project-level `setupFiles` array **replaces** the preset's rather than
   merging with it, which would silently drop every Expo module mock.
   **Nothing is needed for reanimated** — `getAnimatedStyle` reads
   `props.jestAnimatedStyle`, which reanimated populates whenever `IS_JEST`,
   independently of `setUpTests()`; and `transformIgnorePatterns` already covers
   all three packages via its `react-native` prefix.

The suite runs green at default parallelism on the dev box (~18s). If a worker
ever dies with a V8 heap error, run `npx jest -w 2` and record it here rather
than accepting a partially-run suite as green.

Onboarding tests follow a **double-entry rule**: they hardcode the Figma
literals (78, 330, 25, `#FFC203`, …) instead of importing `onboardingSpec` or
the theme. Asserting `height === onboardingSpec.footer.buttonHeight` would prove
nothing; asserting `height === 78` proves the screen matches the design.

Password-reset flow: Login → "Forgot password?" → enter email → receive a code
by email → enter code + new password → back to Login → log in with the new
password. Two things about this flow are load-bearing and easy to break:

- **`ForgotPasswordScreen` must never say whether an account exists.** The edge
  answers 204 either way on purpose (the pool sets
  `PreventUserExistenceErrors=ENABLED`), so the banner is conditional — "if
  there's a Spots account for that address…". Do not add a "no account found"
  state; there is no way to learn that, and building one would mean deliberately
  creating an account-enumeration oracle.
- **The reset code expires in ONE HOUR**, not the 24 hours of the sign-up
  confirmation code. Do not copy `ConfirmScreen`'s wording into
  `copy.resetPassword`.

A successful reset issues **no tokens** and does not sign the user in;
`AuthContext` is untouched. `ResetPasswordScreen` calls `clearSession()` on
success purely to avoid leaving a stale local session that outlives the password
it was minted from.

Auth flow: register → receive email code → confirm → **auto sign-in** → Home →
logout. After a successful confirmation the app signs the user in automatically
using the credentials from registration (held in-memory only, never persisted),
so there is no manual login step. If that auto sign-in fails (e.g. provider
throttling) the user is sent to Login with a "you're verified — log in" banner;
the account is already confirmed at that point.

Not covered by automated tests (manual only, needs a live/confirmed Cognito
pool): the end-to-end register → confirm → auto-signed-in → Home → logout path
against real Cognito.

**RNTL gotcha:** for functions invoked from `useEffect` (e.g. the mocked API
call in `AuthContext`/`HomeScreen` tests), use a persistent
`mockResolvedValue`/`mockRejectedValue`, not the `*Once` variants — `*Once`
mocks drain after the first call and return `undefined` on the effect's
second invocation (e.g. React 19 Strict Mode double-invoking effects in
development), which can silently break assertions. Reset mocks with
`jest.resetAllMocks()` in `beforeEach` rather than reusing state across
tests.

## Onboarding screen (`LandingScreen`)

The app's entry screen is a transcription of the Figma frame
`spots-onboarding` — file `DMnEYcuVTiVNXZB7XHDwuN`, node `4:75`
(`https://www.figma.com/design/DMnEYcuVTiVNXZB7XHDwuN/Untitled?node-id=4-75`).
That frame is the source of truth; see `docs/plans/onboarding-redesign.md` for
the full decomposition.

- **390×848 is the reference size.** Match Figma there; degrade *gracefully*,
  not identically, elsewhere. A meaningful mismatch at 390×848 is a bug; a
  proportional difference on another device is not.
- **The frame was revised on 2026-08-17 (v2).** The wordmark's "o" became a
  bigger asset (a dot **ring**, 92×123, replacing the 69×68 dot cluster) and both
  CTAs changed shape — 60pt full pills instead of 78pt rounded rects, with a
  different gap and bottom padding. **The hero composition is unchanged**, and
  that is arithmetic rather than luck; see the footer bullet below.
  `docs/plans/home-screen-and-onboarding-v2.md` §§1–5 has the full decomposition.
- **All geometry comes from `computeOnboardingLayout()`** in
  `src/theme/onboarding.ts` — a pure function of window size + safe-area insets.
  The screen does no arithmetic of its own, which is what makes the whole design
  assertable in a plain unit test. The footer is intrinsic and, in v2,
  decomposes as **20 + 60 + 14 + 60 + 72 = 226** — a 20pt lead-in (the Sign In
  frame's internal offset), two 60pt buttons, a 14pt gap and 72pt of bottom
  padding. That is **the same 226** as v1's 78 + 16 + 78 + 54, so the hero still
  lands on **622** at the reference, which is exactly why the map
  (428×571 @ −18, **114**) and the wordmark box did not move when the CTAs did.
  The alternative reading — hero 642, footer 206 — would push the map to y 134
  and contradict the frame's own unchanged coordinates. On short screens the map
  is clamped so its content can never collide with the wordmark (visibly smaller
  by design).
- **The wordmark is `sp` + a rigid gap + `ts`**, with the brandmark centred on
  the gap and deliberately overhanging it. Figma's source is the literal string
  `sp  ts` (two spaces); shipping that would make the gap an invisible,
  font-version-dependent artifact. Two constants encode it:
  - `gapWidth = 57.6` — **unchanged by v2**, because it is a font metric (two
    space advances at 96px), not a property of the mark. Derived from the
    shipped TTF (`@expo-google-fonts/jost@0.4.2`, Jost v20): space advance 300 /
    unitsPerEm 1000 × 96px × 2.
  - `dotVerticalNudge = 7.5` — derived from the v2 Figma geometry: the 123pt slot
    is centred in the 178pt box (top 27.5), and Figma puts the ring at y 35.
    (It was 12 for the 68pt cluster.) The derivation holds only while the text,
    not the mark, drives the row height — Jost Black's ascent+descent at 96px is
    ≈ 139 and 123 < 139, so it still does, but with less margin than before.
  The mark now overhangs the slot by **17.2pt a side** (it was 5.7), and the
  derived gap centre of 207.44 sits **1.56pt left** of Figma's mark centre of 209
  — inside the ±2px acceptance. Both constants are **derived, not
  device-calibrated**. Confirming them against a device screenshot overlaid on
  the Figma frame is a pending manual step, and both should be re-derived if the
  Jost version changes.
- **`spots-logo.png` (the dot cluster) is no longer the wordmark's "o".**
  `SpotsWordmark` renders `brandmark-logo.png` (the ring) for **every** consumer
  — Landing, `AuthHeader` on five auth screens, and Home's session scaffold —
  because the frame that defines the wordmark changed its "o", and a wordmark
  whose "o" differs by screen is two wordmarks. The cluster's only remaining
  consumer is the Home nav's centre button. **Whether a hollow ring still reads
  as an "o" at the 23×30.75 header scale is a device-only check** and has not
  been made; the fallback is a `mark?: 'ring' | 'cluster'` prop.
- **Assets are `require()`d from `assets/images/`**, copied byte-for-byte from
  `figma-image-assets/` and deliberately not downscaled (`map.png` is only 1.18×
  its @3x budget, and the repo has no alpha-safe image toolchain). Never use the
  temporary Figma CDN URLs. `map.png` is genuinely alpha-transparent with a soft
  black drop shadow — do not re-export it into a flattened white plate.
- **The 1px frame hairline is painted as an absolutely-positioned overlay**, not
  as a `borderWidth` on the frame View. Yoga is border-box, so a real border
  would shrink the frame's content box to 388×846 while the layout is computed
  from the full 390×848 window — pushing every Figma coordinate 1px down/right
  (buttons at x 31 instead of 30). Figma's stroke is an *inside* stroke: it
  paints over content and takes no space. Do not "fix" this by subtracting the
  border from the layout input; that makes `buttonWidth` 328 and breaks the 330
  spec.
- **The wordmark and CTA labels set `allowFontScaling={false}`.** They are
  display type transcribed from a fixed design — `gapWidth`, the 92×123 ring,
  the 388×178 box and the 60pt button height do not scale with the OS text
  setting, so scaled glyphs would overflow. This is scoped to these two
  components; the rest of the app still honours the setting.
- **`BrandButton` is one component with a `hero | compact` size axis.** (This
  reverses an earlier note that the onboarding button was separate from the
  auth-form `Button` on purpose — the brand rollout retired `Button` and took
  the brand vocabulary to every screen, at which point two components that must
  stay pixel-identical forever was the bigger risk.) `hero` is fixed geometry
  (330×**60** from `computeOnboardingLayout` since Figma v2) with
  `allowFontScaling={false}`; `compact` uses `minHeight: size.control` (56),
  stretches to its parent, and honours Dynamic Type. They share the 3px
  secondary stroke but **no longer share a radius** — see Rule 3 below. Figma
  v2 changed `LandingScreen.test.tsx` for the second time in its life, in
  exactly two `it` blocks (CTA geometry and footer padding); every hex, map
  number and wordmark number in that file is unedited, which is the proof the
  hero did not move.
- The route is still named `Landing` (`AuthStackParamList`, `AuthStack.tsx`)
  even though the frame and components say "onboarding" — renaming is a
  deliberate out-of-scope tidy-up.

## Home screen & bottom nav

The signed-in surface is a transcription of the Figma frame `home-screen` — file
`DMnEYcuVTiVNXZB7XHDwuN`, node `4:164` (plus the exported centre ellipse `10:6`).
See `docs/plans/home-screen-and-onboarding-v2.md` §§6–12 for the full
decomposition. (Historical note: `docs/plans/brand-rollout.md` records `4:164` as
a hidden e-commerce cart mockup to be ignored. The node id has been reused; that
instruction is dead.)

**Reference size 390×844**, decomposing as `718 feed + 87 nav + 39 tail = 844`:

```
root 390×844                 canvas · radius 32 · 1px hairline   ← AppFrame
├── feed   y   0..718        scrolls · 326×236 cards at y 58 / 322 / 586
└── nav    y 718..805        rendered by the NAVIGATOR, not by a screen
    └── bar 343×51 @ (23,18) pill · linen · shadow
        └── centre button 70×70 @ top −9, logo 67×90 @ top −19 (overflows)
```

- **There is no feed API and no trip model, and this change invented neither.**
  `FeedCard` takes an optional `source` and otherwise renders the empty state —
  which is exactly what the Figma frame shows. `FEED_PLACEHOLDER_COUNT = 3` is
  the frame's card count, **not a page size**; do not treat it as a fetch limit.
- **All geometry comes from `computeHomeLayout()`** in `src/theme/home.ts`, the
  same pure-function pattern as onboarding. `feedHeight` is *computed but not
  applied*. **An earlier version of this line said the tab navigator gives the
  scene `H − navTotal`. IT DOES NOT.** `SpotsTabBar`'s root is
  `position: 'absolute'`, and an absolutely-positioned child of `BottomTabView`'s
  flex column takes no layout space — so the scene gets the full window height
  and the bar *overlays* it. That is why `feed.bottomPadding` is
  `cardGap + nav.totalHeight` rather than just `cardGap`: the last card has to be
  scrollable clear of a bar that reserves nothing. `feedHeight` is returned only
  so the pure test can assert `feed + nav + tail === H` — it is a decomposition
  of the FRAME, not a description of the `ScrollView`.
- **The third card is clipped at rest** (586 + 236 = 822 > 718). That is why the
  feed scrolls, and `theme/__tests__/home.test.ts` asserts it rather than leaving
  the `ScrollView` unexplained. **This does not fix `RegisterScreen`'s 375×667
  clipping** — that lives in `Screen.tsx`, which is untouched.
- **The bar stretches; the icons anchor to the nearest edge** (home/map from the
  left at 43/99, groups/person from the right at 97/42). Scaling fixed-size
  icons' positions proportionally would distort the row. The 43/99-vs-42/97
  asymmetry is 1pt of Figma rounding, transcribed rather than symmetrised.
- **Nothing in the nav chain may ever set `overflow: 'hidden'`.** The centre
  circle overflows the 51pt bar by 9pt and the logo by 19pt. The button is a
  **sibling of the pill, not a child**, which cuts the required overflow to 1pt
  at the nav root; if Android's `clipChildren` eats that, the loss is the topmost
  row of the cluster. It is painted after the pill (iOS z-order) *and* given a
  higher `elevation` (Android z-order). Do not "fix" this by clipping or by
  moving the button inside the pill.
- **`SpotsTabBar` takes its own narrow props, not `BottomTabBarProps`.** The
  adapter is three lines in `AppStack.tsx`. That keeps the bar renderable in a
  test with no fake `state`/`descriptors`/`navigation` objects, and keeps a
  presentational component out of navigation context.
- **The active indicator is generalised from one example.** The frame only ever
  shows Home active; a tab bar with an active state for one tab is not a tab bar.
  It renders behind whichever of the four icon tabs is focused, and the centre
  button gets none. **The geometry is 75×42 @ top 5, not the frame's 52×40 @ 6**
  — Krish's "a lot bigger" (+44% wide, +5% tall). Half of 75 is exactly the gap
  from the map icon's centre to the centre circle's left edge at the reference
  width, which is where the number comes from; the consequence is that at 375 the
  map indicator's right edge runs **7.5pt underneath the centre circle**, which
  the opaque circle paints over. `theme/home.ts` owns that derivation and
  `home.test.ts` asserts the overlap stays bounded. **The tint is per-mode since
  `tabbar-instant-feel`** — see "The bottom nav's feel" — light keeps
  `brand.primary` at alpha `4D` (0.30; Figma drew 0.40 and an earlier version of
  this line said `'66'`), dark is a neutral `glass.highlight` at `26` (0.15) with
  the accent moved onto the active glyph.
- **Icons are `MaterialIcons` from `@expo/vector-icons`** — zero new npm
  dependencies (`TextField` already pulls `MaterialCommunityIcons`), and the
  frame's icons come from the Material 3 Design Kit, so it is the same library
  rather than an approximation. It does add a second icon **font** to the bundle.
- **Tabs, not a native stack.** A stack pushes; Home → Map would grow a back
  stack. `@react-navigation/bottom-tabs` mounts the bar once, keeps screens
  unaware of it, and subtracts its height from every scene. `AppStack.tsx` keeps
  its name and its exported symbol, so `RootNavigator` is untouched — the same
  precedent as the route still being called `Landing`.
- **Four of the five destinations are placeholders** (Map, Spots AI, Groups,
  Profile): ~20 lines each, a heading and one muted line from `copy.ts`.
  **`ChatScreen` is the AI assistant's ROUTE, not its design** — the chatbot has
  not been designed and this change did not attempt one.
- **`HomeScreen` carries a temporary session scaffold**, below the third card
  (i.e. off-screen at the reference size): the greeting, the `/v1/users/me`
  email, the header wordmark and the `home-logout` button. It is **not in the
  Figma frame**, and it stays because `signOut()` has **exactly one call site in
  the entire app** and this is it — deleting it strands every signed-in user, and
  no test in the repo would catch that, because a design with no logout has
  nothing to assert. Delete the block in one edit when `ProfileScreen` gets a
  real account section. All four of `HomeScreen.test.tsx`'s original behavioural
  tests pass **unedited** through the rewrite, which is the proof the surface
  did not move.
- **`HomeScreen` no longer renders `<Screen>`** (it needs a full-bleed feed, a
  32pt gutter rather than 30, no `KeyboardAvoidingView` and its own scroll), so
  Home joins Landing as a screen *structurally* incapable of picking up the
  spotty backdrop. `AppFrame` owns the app stack's single `StatusBar`.

## The bottom nav's feel

`docs/plans/tabbar-instant-feel.md` (2026-08-17). The bar has been rewritten
three times and never had a section here; this is the catch-up plus the new work.
The brief was "make it feel like the OS's own tab bar" — immediate, continuous,
no snapping, rapid presses stay responsive, no bouncy springs, the bar itself
never moves.

### The two bugs it exists to kill

Both were **patterns, not typos**, and both are worth recognising elsewhere.

1. **A shadow position that records destinations.** The old code kept a
   `positionRef` and set it to the TARGET at the top of every move, then called
   `Animated.Value.stopAnimation()` with **no callback** — which reads nothing
   back (`AnimatedValue.js` only queries the native value if you pass one), and a
   native-driven animation never writes the JS-side `_value` anyway. So mid-glide
   the "current position" was the *last destination*, up to a bar-width from the
   pill, and every gesture decision computed against it made the pill jump to
   meet the arithmetic.
2. **A navigation event treated as an instruction instead of a confirmation.**
   The `activeKey` effect compared the incoming route to a POSITION. Tap map, tap
   profile 80ms later, and the navigator answers `map` first — which is neither
   the current intent nor an external change. The effect obeyed it, dragged the
   pill backwards, then forwards again. That reversal is the visible snap on
   rapid taps.

Worth stating because a previous write-up got it wrong: the **drag-release path
was not the culprit**.

### Why not `NativeTabs`

The motion reference (`KrishMaske/ProteinOS`) contains **zero animation code** —
it uses `NativeTabs` from `expo-router/unstable-native-tabs`, i.e. the real OS
bar, and its immediacy comes entirely from **no JavaScript being in the touch
path**. Adopting it here is ruled out and settled: the system bar is full-width
and edge-pinned (there is no floating 343×51 inset bar), it clips (so no chat
button overflowing 19pt above it), it takes SF Symbols / Material icon *names*
rather than the Spots icon assets, and it owns its own indicator. The achievable
analogue for a custom-drawn bar is **native gesture recognition plus UI-thread
animation**, which is what reanimated + gesture-handler buy.

### The single most reusable fact learned here

**A reanimated shared value can be read synchronously and exactly inside a
worklet, mid-animation.** That one property is why the previous architecture
needed a `Date.now()`-based *model* of the in-flight animation (with the easing
function as a shared constant so the model could not drift) and this one needs
nothing at all. `position.value` **is** the pill's number. Cause 1 above is
therefore structurally impossible now rather than merely fixed.

Three more that cost time:

- **`runOnJS` is asynchronous even when you are already on the JS thread.** It
  goes through worklets' `scheduleOnRN`, which does `queueMicrotask` on the RN
  runtime. Under jest *everything* is the RN runtime, so `onSelect` is never
  called synchronously from a gesture. It is deprecated in favour of
  `scheduleOnRN`; app code imports it from `react-native-reanimated` so there is
  no direct `react-native-worklets` import to migrate.
- **`GestureDetector` inserts no view.** `Wrap.render()` is
  `React.cloneElement(child, { collapsable: false }, child.props.children)`. The
  two structural tests that walk the tree for `overflow: 'hidden'` and for paint
  order are unaffected by it.
- **`GestureHandlerRootView` lives in `App.tsx`**, as the outermost element.
  `GestureDetector` throws in dev without an ancestor root view — but the throw is
  guarded by `!isTestEnv()`, so **jest is exempt** and `screenTestUtils.tsx` must
  not grow a wrapper. Not `RootNavigator` (it returns a different subtree while
  the session loads, so the root would unmount/remount), not `AppStack`/`AppFrame`
  (signed-in only).

### The interaction contract

**One `GestureDetector` on the pill, one `Gesture.Race(Pan, Tap)`.** `Race`
rather than `Exclusive` because the activation conditions are disjoint — the Tap
activates on lift within `maxDistance`, the Pan at `activeOffsetX` — so they are
equivalent here. **Every gesture callback carries `'worklet'`**, which is what
makes `GestureDetector` route them through reanimated and run them on the UI
thread; a plain function would run on the JS thread and lose the whole point. The
bar therefore does **zero re-renders and zero JS-thread work per gesture frame**.

Two modes, branched once at touch-down:

| | grab | scrub |
|---|---|---|
| what it is | the touch landed inside the indicator's *current* box (X only) **and** the nearest tab centre is the tab the pill already belongs to | anything else |
| touch-down | scale to 1.08; the pill does not move | resolve the nearest tab, glide there **immediately**, pulse that glyph |
| move | tracks the finger **1:1**, with the magnet | re-glides tab to tab as the finger crosses boundaries — never 1:1, which would jump the pill up to half a pitch on the first move |
| release | nearest to the pill's actual position wins | nearest to the finger wins |

- **`activeOffsetX([-3, 3])` is "a tap must never become a drag", as a native
  activation criterion** rather than arithmetic in a move handler. Consequence
  for tests: the threshold is no longer behaviourally assertable, only as
  configuration.
- **`onSelect` fires on RELEASE, never on touch-down.** The *indicator* is
  immediate; navigation is not. Firing on touch-down would make an accidental
  brush navigate and would kill slide-to-choose.
- **The four icon `Pressable`s are `pointerEvents="none"`.** gesture-handler is a
  *native* recogniser and does not join RN's JS responder negotiation, so without
  this a still tap could fire both the Tap gesture and `onPress` and select
  twice. `pointerEvents` is a hit-testing instruction only: the elements stay in
  the accessibility tree, stay focusable, and are activated by an accessibility
  action. They keep `onPress` **and** carry an explicit `onAccessibilityTap`, and
  the handler does the full job (intent, glide, select), not just navigation.
  **This is the one claim here that a device must confirm, not a reader** — if
  VoiceOver or TalkBack cannot activate a tab, drop `pointerEvents="none"` and
  de-duplicate in `commit()` instead.
- The centre chat button is a **sibling** of the pill and **outside** the
  `GestureDetector`, so it keeps its own pointer events and gets no press
  feedback (its two absolutely-positioned children are load-bearing, and scaling
  a view that owns an Android `elevation` changes how its shadow renders).

### The motion numbers — all picks, all in `homeSpec.nav.motion`

Figma has no motion spec, so unlike every other number in `theme/home.ts` there
is no frame to check these against. One curve everywhere:
**`Easing.out(Easing.cubic)`, imported from `react-native-reanimated`** — RN's
`Easing` is not worklet-safe, and getting that import wrong is a runtime error on
the UI thread, not a silent fallback.

Duration is **distance-linear**, `round(165 + 70 × clamp(travel / fullTravel))`:

| move | travel | duration |
|---|---|---|
| home ↔ map | 56 | 180ms |
| groups ↔ profile | 55 | 180ms |
| map ↔ groups | 147 | 205ms |
| home ↔ groups | 203 | 220ms |
| home ↔ profile | 258 | 235ms |
| a drag settle | ≤ ~37 | 165–175ms |

**Why distance and not a tab-index ladder:** the icon row is not evenly spaced.
The centre button puts 147pt between map and groups against 56pt between home and
map, and a user reads both as "the next tab" — an index ladder would move the
pill at 0.33 pt/ms for one adjacent hop and 0.86 pt/ms for the other. Distance
keeps the *speed* constant, and it is the only rule that also answers "how long
is a mid-flight redirect?" and "how long is a drag settle?".

The rest: drag scale **1.08** in 90ms / out 140ms (it replaced a shipped 1.4,
which read as the pill jumping out of the bar); icon press pulse **1 → 0.94 → 1**
in 2×50ms, which is the only feedback there is for tapping the tab you are
already on; drag threshold **3pt**; magnet **radius 18, strength 0.35**, which is
arithmetically bounded at **1.575pt** of deviation and never below **65%** of
finger speed, so it is incapable of feeling sticky.

**The bar itself gets no motion — ever.** No scale, bounce, shift or resize.

### Where the yellow lives, and why it is per-mode

Krish asked for the active *icon* to go yellow instead of the pill. That is
achievable in **dark only**, and the reason is a measurement rather than a taste
call: the one brand yellow has a **WCAG relative luminance of 0.598**, which caps
it at **1.62:1 against white** and reaches 3:1 only against surfaces darker than
≈0.166. On today's light-mode yellow tint a yellow glyph is **1.33:1**.
`colors.accentPressed` was checked too — 2.00:1 on white, and it would be a
second yellow.

| mode | indicator fill | active glyph | inactive glyphs |
|---|---|---|---|
| dark | `glass.highlight` @ `26` — a neutral frost slab | `colors.accent` (6.65:1 on the bar, 4.35:1 on the slab) | `colors.text` |
| light | `brand.primary` @ `4D` — **unchanged** | `colors.text` — **unchanged** | `colors.text` |

**Be honest about what light mode gets from this: nothing.** The pill stays the
selection signal there, at its measured 16.30:1 ink-on-tint. So the indicator's
treatment is per-mode while `theme.glass` is deliberately mode-invariant — the
precedent is `theme.brand`, whose chrome is per-mode while its control ramp is
not. The travelling indicator itself **stays** in both modes: Krish requires the
selection to travel smoothly to its destination, and the reference supports it
too (ProteinOS's Android bar draws Material's travelling pill; only iOS's
`UITabBar` is indicator-free).

### Glass and drag debt, owed from `theme-fix-and-glass-pill.md` §16

- **The bar is glass, and that departs from `4:164`, which draws an opaque linen
  bar.** The reasoning is a measurement: a `BlurView` blurs what is behind it, and
  behind the *indicator* is the bar's own uniform fill — a Gaussian blur of a
  uniform colour returns that colour, so blurring the indicator would be
  pixel-identical to a translucent tint. Behind the *bar* is the scrolling feed.
  Hence **exactly one `BlurView`**, hosted by the bar, at `intensity` 40.
- **Two views for the pill, and the split is load-bearing.** The bar needs a
  radius AND `overflow: 'hidden'` (Android's `BlurView` ignores `borderRadius`;
  clipping is the documented workaround), but on iOS a shadow and
  `overflow: 'hidden'` on the *same* view clip the shadow away. So
  `tab-bar-pill` owns geometry, radius and shadow with **no** `overflow`, and
  `tab-bar-pill-fill` owns the clip and the frost.
- **Android blur is experimental.** `experimentalBlurMethod="dimezisBlurView"` is
  required or there is no blur at all, and Expo documents the path as possibly
  causing "performance and graphical issues". The fallback is **one line**:
  `Platform.OS === 'android' ? undefined : 'dimezisBlurView'`, which degrades the
  bar to opaque linen on Android and keeps the glass on iOS.
- **`useReduceMotion` is extracted to `theme/useReduceMotion.ts`** and shared with
  `SpottyBackground`. Do **not** swap it for reanimated's own `useReducedMotion()`
  or `withTiming`'s `ReduceMotion` option: those read reanimated's platform
  detection, which `jest.setup.ts` does not pin, so under jest they report
  "motion allowed" and the suite's exactness guarantee evaporates silently.

## Brand rollout — extending onboarding to the rest of the app

`docs/plans/brand-rollout.md` (2026-08-16) took the onboarding vocabulary to the
six remaining screens. **There is no Figma design for those screens**, so every
value is either lifted from the onboarding frame or derived from it by a stated
rule. Four rules govern the whole system — restate them rather than
re-litigating them:

1. **Jost Black is display type only.** In the onboarding frame the brand face
   appears in exactly two places: the wordmark and the CTA labels. It never sets
   body copy, headings, field labels, helper text or banners. Screen headings
   stay system `typography.title` (24/700).
2. **Brand yellow is a fill, never a foreground.** `#FFC203` on `#F8FAFC` is
   1.55:1; `#000000` on `#FFC203` is 12.97:1. No yellow text, no yellow links,
   no yellow icons on canvas.
3. ~~**The corner arc is constant, not proportional.**~~ **AMENDED BY FIGMA v2
   (2026-08-17).** The rule used to read: the hero is `radius.xl` (25) at 78pt
   and the compact control is *also* 25 at 56pt, because scaling the radius with
   the height would give two curvatures. The edited `4:75` frame overrules it for
   the hero: its CTA is radius **100 on a 60pt control**, i.e. a full pill, so
   `hero` now renders `radius.pill` and `compact` keeps 25. It is `radius.pill`
   rather than a new `radius: 100` because any radius ≥ height/2 renders the same
   capsule — the frame's 100 (CTA), 170 (nav bar) and 100 (active indicator) are
   three spellings of one instruction, and minting a second pill value is the
   drift the second yellow was deleted to prevent. **Consequence worth stating:**
   the hero is 60pt and the compact control 56pt — 4pt apart — with visibly
   different corner geometry, so Landing → Login shows two nearly-identical-height
   buttons of different shape. That is **O-4**, deferred.
4. **Controls share one silhouette.** Text fields and the submit CTA get the
   same height (56) and the same radius (25), so a form reads as a stack of
   capsules the way the onboarding footer reads as two capsules stacked. **This
   is what makes O-4 expensive:** pilling the compact control would drag every
   `TextField` along with it, restyling six screens with no design to transcribe.
   `radius.xxxl` (50) was added by the Home change and is *not* a third pill —
   50 on a 326×236 feed card is not clamped by height/2 (118), so it is a real
   measurement.

Three values have **no onboarding precedent** and were chosen, not derived:

- **`size.control = 56`** — the frame has one control (78pt) and no inputs. 56
  sits on the 8pt grid (48 + 8), clears the 44pt iOS / 48dp Android tap minimum
  with room, and is ~72% of the hero so the hero stays the loudest control.
- **`typography.brandCtaCompact` = 20** — not the 23 a literal 78:32 scaling
  would give, because Jost Black at 20 already outweighs the 24px system-semibold
  heading above it. A form CTA must not out-shout the screen's heading; on
  onboarding the CTA *is* the content.
- **`FormError` at `radius.lg` (20)** — the frame offers 25 (control) and 32
  (page frame), and a multi-line banner is neither: a capsule-shaped block of
  wrapping text looks wrong. This banner is the app's only card-like surface.

`WORDMARK_HEADER_SCALE = typography.title.fontSize / 96 = 0.25` (exported from
`SpotsWordmark.tsx`) is **derived, not eyeballed**: at 0.25 the wordmark renders
at the same size as the `title` type it sits above, which is exactly the size
the retired `BrandMark variant="small"` rendered "Spots" at. 0.25 is an exact
binary fraction, so every derived value stays clean (box 97×44.5, cluster
17.25×17).

**`AuthHeader` deliberately overrides it.** It renders
`scale={WORDMARK_HEADER_SCALE * 1.7}` with `marginLeft: -18` — an effective
scale of **0.425** (≈40.8px type), not 0.25/24px. So the auth-header wordmark
does *not* match the `title` type below it; it is deliberately louder, and the
negative margin pulls the wordmark's own optical box back to the gutter. This
is a hand-tuned override on top of a derived constant, recorded here so it is
not "corrected" back to 0.25 by someone reading only the derivation above. The
constant itself is unchanged, and the geometry tests still assert the derived
values at `scale={0.25}`.

Because the wordmark is `sp` + `ts` in **two separate `Text` nodes**,
`getByText('Spots')` cannot find it. Query it with `getByLabelText('Spots')` —
`SpotsWordmark` exposes `accessibilityRole="header"` + `accessibilityLabel`.

Naming debt, deliberately deferred: `SpotsWordmark`'s testIDs
(`onboarding-wordmark`, `onboarding-logo`, `onboarding-wordmark-gap`) and the
module `src/theme/onboarding.ts` are now consumed app-wide. Renaming them would
force edits to `LandingScreen.test.tsx`, which is kept as a clean tripwire.

`radius.sm` (8) and `radius.md` (12) have no consumers since this change. They
are kept on purpose — a generic scale, not brand values. Their absence from the
app is not an oversight.

## Brand copy & theme — placeholders, not final

- **All auth-flow copy lives in one file: `src/theme/copy.ts`.** Every string
  in it is a TODO placeholder pending Krish's sign-off (CTAs, headings, error
  copy) — swap wording there only. The one exception is `copy.landing`
  ("Sign In" / "Register"), which comes from the approved Figma onboarding
  frame.
- **`#FFC203` is the canonical Spots yellow.** It lives in
  `palette.spotsYellow` and reaches components as `theme.brand.primary`, along
  with `brand.secondarySurface` (`#FFF6EC`), `brand.canvas`, `brand.hairline`,
  `brand.onPrimary` (`#000000`) and `brand.onCanvas`. **`theme.brand` splits
  into a mode-invariant CONTROL ramp and a per-mode CHROME ramp**: the yellow
  fill, the cream fill and the black label on both are identical in light and
  dark — that pairing is the product'''s signature and reads correctly on either
  canvas — while `canvas`, `hairline` and `onCanvas` move with the mode. See
  "Dark mode" below. `brand.onCanvas` is **not** `brand.onPrimary`: `onPrimary`
  is the label *on the yellow*, `onCanvas` is a brand mark *on the page*. They
  are the same black in light mode, which was a coincidence; dark mode breaks
  it.
- **`colors.surfaceRaised` and the `elevation` group** came from the Home frame.
  `surfaceRaised` is `#FAF8F6` in light (a warm raised surface: the feed cards,
  the floating nav bar and the nav's centre circle) and collapses onto
  `colors.surface` (`#1A1D23`) in dark, because the warm tint is a light-mode
  idea and there is no dark `4:164` to transcribe a second dark elevation from.
  `elevation.card` is `0/4/blur 10 @ 35% black` (iOS `shadowRadius` 5, since a
  CSS blur-radius *b* is a Gaussian of ≈ *b*/2) with Android `elevation: 6`;
  `elevation.floating` is the centre button's own shadow — **offset y 2, not 4**,
  read from the exported ellipse `10:6`'s `feOffset dy="2"` /
  `feGaussianBlur stdDeviation="5"` — with `elevation: 10` so it z-orders above
  the bar on Android. The two are deliberately **not** collapsed into one token.
  Both are mode-invariant, and honestly so: 35% black does nothing on `#0F1115`.
- **Three of Home's Figma colours were NORMALISED onto existing tokens, not
  added.** Do not "fix" Home's canvas back to white later — this was a decision:

  | Figma (`4:164`) | normalised onto | delta | contrast note |
  |---|---|---|---|
  | root `#FFFFFF` | `brand.canvas` `#F8FAFC` | (+7, +5, +3) | below the perceptual threshold on a phone |
  | hairline `#E5E7EB` | `brand.hairline` `#E2E8F0` | (+3, +3, −5) | ditto |
  | icons `#1D1B20` (M3 `on-surface`) | `colors.text` `#0A0A0A` | (+19, +17, +22) | 15.9:1 vs 18.5:1 on `#FAF8F6` — both far past AA |

  A second canvas means a second *dark* canvas to invent, maintain and measure —
  the same shape of drift the repo removed when it deleted the second yellow.
  Normalising made dark mode free and already measured. Only `#FAF8F6` survived
  as a new token, because it is the only one of the five with a distinct role
  (and normalising it to `colors.surface` would invert the card/canvas
  relationship: Figma's card is slightly *darker* than its page, white is
  lighter). The active indicator's fill is derived, not stored, and it is now
  per-mode: `brand.primary + '4D'` in light, `glass.highlight + '26'` in dark
  (the `'66'` this used to name was Figma's 0.40, lowered when the glass edge and
  inner highlight took over the definition). No new token either way.
- **There is exactly one yellow.** The pre-brand placeholders `palette.yellow`
  (`#FFD400`) and `palette.yellowPressed` (`#E6BF00`) were **deleted** by the
  brand rollout (O1 in `docs/plans/onboarding-redesign.md`, resolved by
  `docs/plans/brand-rollout.md`). `theme.colors.accent` is now `#FFC203` — the
  same value as `theme.brand.primary` — `colors.accentPressed` is `#E6AF03`
  (derived by the same 90% per-channel multiply that produced the old pressed
  pair), and `colors.onAccent` is `#000000`, byte-identical to
  `brand.onPrimary`. Light mode also adopted the brand ramp: `bg` `#F8FAFC`,
  `surface` `#FFFFFF` (white, so inputs sit *above* the tinted canvas rather
  than sinking below it), `border` `#E2E8F0`.
- No other file should hardcode brand copy or raw colors — screens/components
  consume `theme.colors.*` and `copy.*` only.

## Dark mode

Driven by the device setting. `ThemeProvider` already read `useColorScheme()`
and persisted a `'system' | 'light' | 'dark'` preference; what was missing was a
dark ramp worth switching to. `docs/plans/spots-background-and-dark-mode.md`
supplied one on 2026-08-17, reversing the brand rollout's O-C.

**There is no Figma dark frame**, so unlike the `spots*` brand values these are
*picks*, justified by the measured contrast table below — not transcriptions.

| token | light | dark |
|---|---|---|
| `brand.canvas` / `colors.bg` | `#F8FAFC` | `#0F1115` |
| `colors.surface` | `#FFFFFF` | `#1A1D23` |
| `brand.hairline` / `colors.border` | `#E2E8F0` | `#2E333B` |
| `colors.text` | `#0A0A0A` | `#F5F5F5` |
| `colors.textMuted` | `#6B6B6B` | `#94A3B8` |
| `brand.onCanvas` | `#000000` | `#F5F5F5` |
| `brand.primary` | `#FFC203` | `#FFC203` (unchanged) |
| `brand.onPrimary` | `#000000` | `#000000` (unchanged) |
| `brand.secondarySurface` | `#FFF6EC` | `#FFF6EC` (unchanged) |
| `colors.danger` / `.success` | unchanged | unchanged |

**The control ramp is mode-invariant; only the chrome moves.** The yellow CTA
with its black label is the product's signature and reads correctly on either
canvas, so it does not get a dark variant. That is what keeps Spots recognisable
in both modes, and `BrandButton.test.tsx` proves it: all four of its
light-vs-dark cases pass unedited even though the theme underneath them really
did change.

Measured with the WCAG 2.x relative-luminance formula, not estimated:

| foreground | background | ratio | verdict |
|---|---|---|---|
| `#F5F5F5` text | `#0F1115` canvas | 17.34:1 | AAA |
| `#F5F5F5` text | `#1A1D23` surface | 15.48:1 | AAA |
| `#94A3B8` muted | `#0F1115` canvas | 7.37:1 | AAA |
| `#94A3B8` muted | `#1A1D23` surface | 6.58:1 | AAA |
| `#FFC203` focus ring | `#1A1D23` field fill | 10.43:1 | 1.4.11 ✅ |
| `#000000` label | `#FFC203` primary | 12.97:1 | unchanged |
| `#FFF6EC` cream fill | `#0F1115` canvas | 17.68:1 | the bright patch, accepted |
| `#1A1D23` surface | `#0F1115` canvas | 1.12:1 | separation only (light is 1.05:1) |
| `#2E333B` hairline | `#0F1115` canvas | 1.49:1 | 1.4.11 ❌ (light: 1.18:1) |
| `#D64545` danger | `#0F1115` canvas | 4.32:1 | AA ❌ (light: 4.18:1) |

Three findings worth stating out loud:

1. **Dark mode *fixes* the focus-ring gap.** The brand-yellow focus ring is
   1.62:1 on light's white field — non-compliant in every state. On `#1A1D23`
   the same ring is **10.43:1**. The focused field boundary genuinely clears 3:1
   for the first time.
2. **The resting boundary improves but still does not comply** (1.18 → 1.49
   against the canvas). Non-compliant in both modes.
3. **`danger` gets no better** — 4.18:1 light, 4.32:1 dark. See "Known gaps".

Two components had to be fixed by hand; everything else went dark for free via
the tokens, which is the two-layer architecture doing its job:

- `SpotsWordmark` coloured its glyphs `brand.onPrimary`. That was correct *by
  coincidence* — "black on the yellow" and "black on the light canvas" happened
  to be the same value. It now reads `brand.onCanvas`.
- `LandingScreen` hardcoded `<StatusBar style="dark" />`, which paints dark
  glyphs on a near-black bar. It now uses the same `theme.mode` expression
  `Screen` always had.

There is still no theme-toggle UI; the preference plumbing exists and the toggle
is UI-only whenever a Settings screen lands.

## Floating spotty background

A decorative layer of drifting yellow spots behind the content on the **five
auth form screens only** (Login, Register, Confirm, ForgotPassword,
ResetPassword). Not Landing — the map hero is the focal point, and Landing does
not render `Screen` at all, so the exclusion is structural rather than a
convention to remember. Not Home.

The design is *derived, not invented*: the wordmark's dot cluster
(`spots-logo.png`, 24 yellow circles of mixed size) **dispersed** — same yellow,
same mixed-size circles, spread across the canvas at low opacity.

- **Opt-in through `<Screen backdrop="spots">`.** One prop per screen, so
  z-order, `pointerEvents` and full-bleed are implemented once. Default is
  `'none'`, so a screen that must not have it gets that by default.
- **Placement is load-bearing.** The layer is a sibling **outside**
  `SafeAreaView` (so spots bleed under the status bar rather than stopping at an
  invisible line ~47pt down) and **outside** `KeyboardAvoidingView` (so it does
  not slide several hundred points when the keyboard opens). `Screen.test.tsx`
  asserts both. Do not tidy it into the content tree.
- **Seeded, never `Math.random`.** `theme/spots.ts` exports a pure
  `generateSpots()` over a `mulberry32` PRNG. These are form screens: every
  keystroke re-renders, and an unseeded scatter would visibly reshuffle the
  whole backdrop on every character typed. One app-wide seed means all five
  screens share a scatter, so navigating Login → Register reads as one
  continuous backdrop. Count is density-based (`w·h / 24000`, clamped 10–20 →
  14 at 390×848); diameters are 8–56pt biased small; drift is 4–14pt.
- **Two shared clocks, not one per spot.** RN's built-in `Animated` with
  `useNativeDriver: true` on `translateX`/`translateY` — zero JS per frame, and
  no new dependency (`react-native-reanimated` is not installed, and a Babel
  plugin + worklet runtime for two interpolated transforms is not justified).
  18s and 11s are coprime-ish, so the field's repeat period is ~198s and the
  motion never visibly loops. Motion is **position only**; opacity is never
  animated, so the contrast bound below holds at every instant.
- **Reduce Motion is respected, and assumed ON until the platform says
  otherwise.** Failing static costs one frame of stillness and guarantees we
  never animate at someone who asked us not to, including before the async check
  resolves. A `reduceMotionChanged` subscription makes the OS toggle take effect
  live, without a restart.

**The opacity ceiling is bounded by a contrast budget** — 0.08 light, 0.10 dark,
in `theme.backdrop.spotOpacity`. Everything with a fill (text fields, the info
banner) sits on an opaque surface, so spots are *structurally* incapable of
getting under that text. For the text that does sit on the canvas, here is what
a worst-case spot underneath actually costs:

| foreground on canvas | plain | over a worst-case spot |
|---|---|---|
| light `#0A0A0A` text | 18.92:1 | 18.27:1 |
| light `#6B6B6B` muted | 5.09:1 | 4.92:1 (still AA) |
| light `#D64545` danger | 4.18:1 | 4.04:1 (already below AA) |
| dark `#F5F5F5` text | 17.34:1 | 14.42:1 |
| dark `#94A3B8` muted | 7.37:1 | 6.13:1 (still AA) |
| dark `#D64545` danger | 4.32:1 | 3.59:1 |

**The shipped ceilings are conservative picks, not the budget's edge.** Solving
for the binding foreground (`#6B6B6B` on the light canvas, `#94A3B8` on the
dark) puts the AA-limiting alpha at **≈ 0.26 light and ≈ 0.22 dark** — roughly
3.2× and 2.2× what ships. They were chosen for subtlety. So if someone wants a
louder backdrop, this table is still the thing to argue against, but the
argument is aesthetic and there is real headroom: AA is not what stops it at
0.08/0.10. Do not cite these numbers as a hard accessibility bound — they are
not.

**Why the jest Reduce-Motion pin matters.** RN's `shouldUseNativeDriver`
silently falls back to the JS driver when `NODE_ENV === 'test'` — the "native
animated module is missing" warning is *suppressed* there — and RN's jest setup
implements `requestAnimationFrame` as `setTimeout(0)`. So an unguarded animation
does not warn; it quietly busy-loops for its full wall-clock duration, in five
screen suites. The `jest.setup.ts` pin and the component's
assume-reduce-motion-until-proven default are specific fixes for that, not
defensive style. Removing either makes the suite slower and flakier **with no
warning at all**.

## Heads up: `src/app/` is not Expo Router

The plan's tree names one folder `src/app/` (for `RootNavigator.tsx`), which
coincidentally matches Expo Router's conventional `app/`-directory-routing
folder name. This project does **not** use `expo-router` — navigation is
React Navigation, driven from `App.tsx`/`index.ts` as the real entry point.
`npx expo export` prints an informational "Using src/app as the root
directory for Expo Router" line during bundling; this is a harmless static
probe (expo-router isn't installed, so it has no effect), confirmed by the
export actually bundling from `index.ts`. Flagging this so a future engineer
adding `expo-router` doesn't get a silent folder collision.

## Known gaps / deferred (see `docs/plans/mobile-auth-screens.md` for detail)

- No resend-confirmation-code endpoint exists on the Go edge; `ConfirmScreen`
  shows a static "check spam" hint instead of a resend button by design.
- Token refresh is a one-shot check on app start only (if the stored access
  token is expired, refresh once; a 401 clears the session). A full
  auto-refresh-on-401 interceptor across all API calls is deferred.
- No visible theme toggle yet (the system follows the OS scheme
  automatically); a manual override belongs in a future Settings screen.
- **Text-field boundary contrast fails WCAG 1.4.11 at rest in both modes.**
  Measured, not estimated. WCAG 1.4.11 wants **3:1** for UI component
  boundaries:

  | state | light | dark |
  |---|---|---|
  | resting border vs. canvas | 1.18:1 ❌ | 1.49:1 ❌ |
  | resting border vs. field fill | 1.23:1 ❌ | 1.33:1 ❌ |
  | brand-yellow focus ring vs. field fill | 1.62:1 ❌ | **10.43:1 ✅** |

  **In light mode focus is not a partial fix** — it makes the boundary more
  *noticeable*, which is why it is worth having, but it does not make it
  compliant. **Dark mode is the first time the focused state genuinely clears
  3:1.** The resting boundary still does not, in either mode. Light is also a
  mild **regression** from the pre-rollout ramp (`#CFCFCF` on `#FFFFFF` at
  1.56:1, so the resting boundary lost ~0.4). The always-visible field label
  carries the affordance, and the treatment matches common iOS practice, but the
  boundary itself is non-compliant. The onboarding frame has no inputs, so the
  brand supplies no answer. The fallback is one token per mode: a darker
  light-mode `colors.border` (a slate-300-class value) and a lighter
  `night600`, keeping `brand.hairline` for decorative rules only. Accepted
  knowingly, not silently.
- **`palette.danger` `#D64545` misses AA in both modes** — 4.18:1 on the light
  canvas, **4.32:1** on the dark canvas, **3.99:1** on the dark error wash
  (`danger + '1A'` over `#0F1115`), and **3.59:1** over a worst-case backdrop
  spot — against the 4.5:1 AA minimum. Error/helper text renders at 12px so the
  large-text exemption (3:1) does not apply. This is **pre-existing**, not
  caused by the rollout or by dark mode: on the old white background it was
  4.38:1, also failing. What has changed is that it is now measured in two modes
  and on more surfaces. Roughly `#C93B3B` would clear 4.5:1 on `#F8FAFC`;
  `#FF6B6B` would give 6.81:1 on `#0F1115`. **The token is deliberately
  unchanged — that is Krish's call**, since it shifts the error color app-wide,
  and taking a dark variant would make `danger` mode-dependent, which
  `themes.test.ts` asserts against.
- **The backdrop keeps animating on screens below the top of the stack.** In a
  native stack, Login stays mounted under Register. With the native driver this
  is UI-thread compositing on an offscreen view rather than JS work, so it is
  cheap — but it is not free. The fix is one hook (`useIsFocused()` from
  `@react-navigation/native`, already a dependency) gating `start()`/`stop()`.
  Deferred: it couples a presentational component to navigation context and
  needs a fallback for rendering outside a navigator. Revisit if a device
  battery review flags it.
- **The backdrop uses a full scatter, with no keep-out band.** Contrast is
  bounded by the opacity ceiling (a budget) rather than by geometry (a hard
  guarantee). If device review disagrees, `generateSpots` can reject any spot
  whose drift-inflated box intersects the middle 40% of the height, where the
  fields, banners and CTA live on all five screens — at the cost of the even
  scatter. Not taken by default.
- The onboarding wordmark constants (`gapWidth`, `dotVerticalNudge`) are derived
  from font metrics and Figma geometry rather than measured on a device; an
  overlay check against the Figma frame on a 390×848-class device is still
  outstanding, as is a look at the short-screen (375×667) map clamp.
- **Whether the ring reads as an "o" at header scale is unverified**, and it now
  affects six screens (five auth headers at 0.425 plus Home's scaffold at 0.25).
  At 0.25 the mark is 23×30.75 and a hollow ring may read as a smudge. The
  fallback is a `mark?: 'ring' | 'cluster'` prop and a second geometry block —
  cheap, but it means the brand has two "o"s.
- **The Home design leans almost entirely on one shadow.** The linen card is
  1.01:1 against the light canvas and the centre circle is 1.04:1 against the
  bar, so without the shadow the screen is a flat rectangle. `shadowRadius: 5` is
  a CSS→iOS derivation and Android's `elevation: 6` / `10` are **picks** — Android
  takes no colour, offset or alpha — and neither has been compared on a device.
- **Dark mode on Home is derived, not designed.** There is no dark `4:164`. The
  card separates from the canvas at only **1.12:1**, with a black shadow that
  does nothing on `#0F1115`. A 1px `brand.hairline` outline in dark only would
  fix it — one conditional style — but it is a design invention for a mode with
  no frame, so it is deferred pending a device screenshot.
- **The active-tab affordance is a background tint only in LIGHT mode** — no
  label, no icon fill change, no weight change. That is what the frame shows.
  Dark mode additionally tints the active glyph with the accent; light cannot,
  and that asymmetry is permanent unless a second yellow or a near-black capsule
  is introduced (both rejected, with measurements, in "The bottom nav's feel").
- **The bottom nav's `pointerEvents="none"` on the icon tabs is unverified on a
  device.** The argument that it removes them from *touch* delivery but not from
  the accessibility tree is a source-reading plus a platform expectation, not an
  observation. **VoiceOver and TalkBack must be able to activate all five tabs**;
  a bar screen-reader users cannot operate is worse than a bar that feels slow.
  The fallback is to drop the prop and de-duplicate in `commit()` instead.
- **gesture-handler now competes with the feed's `ScrollView` for real.**
  `PanResponder` negotiated in JS; a native recogniser negotiates natively, and
  the bar is a *sibling* of the scene rather than an ancestor/descendant, so
  RNGH's `simultaneousWithExternalGesture` / `blocksExternalGesture` cannot be
  wired between them without threading a gesture ref across the navigator. Watch
  for a scroll that starts on the bar and dies. Smallest fix if it happens:
  `pan.shouldCancelWhenOutside(false)` plus a `failOffsetY` so a vertical drag
  never claims the pan.
- **The 3pt drag threshold is inherited, not measured**, and it is now less
  visible — an `.activeOffsetX()` argument rather than a comparison in a move
  handler. Still one number in `navMotion`, and still asserted, but only as
  configuration.
- **The indicator's 75pt width collides with the centre circle below 390.** At
  375 the map indicator's right edge runs 7.5pt *under* the circle, which paints
  over it. Pre-existing, bounded, and quieter now that the dark slab is neutral.
  Retreat to 60 (0pt clearance at 375) or 56 (2pt) only if a device says it reads
  as broken.
- **The whole motion spec is picks, not transcriptions.** Figma has no motion
  frame, so 165–235ms, `Easing.out(Easing.cubic)`, scale 1.08, the 0.94 pulse and
  the magnet's 18/0.35 have never been compared against a design or measured on
  hardware. They all live in `homeSpec.nav.motion`.
- **`react-native-worklets` is pinned to an exact `0.5.1` and must stay there.**
  See "Resolved versions": the range npm would otherwise pick breaks every jest
  suite that imports reanimated, at import time.
- **Decoded-bitmap cost got worse.** `spots-logo.png` is 1512×2016 (≈ 12.2 MB
  decoded) and is now mounted for the **entire signed-in session** at a 67×90
  display size — roughly a 7.5× linear oversample of its @3x budget — plus two
  more full-size assets on Landing. The fix is a real alpha-aware toolchain
  (`sharp`/Squoosh), never a hand-rolled `System.Drawing` resize, which is
  exactly the operation that puts dark halos around transparent yellow dots.
  Deferred, and now the strongest case yet for doing it.
- **The Android centre button has not been checked for clipping.** `clipChildren`
  can eat children drawn outside a parent's bounds and clips `elevation` shadows.
  The design cuts the exposure to 1pt, but only a device can confirm it.
- **The map-pin glyph is the one icon approximation.** Three of the four map 1:1
  onto Material Symbols; the "Simple Design System" pin may not be a byte match
  for `place`.
