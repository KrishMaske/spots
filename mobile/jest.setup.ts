// Shared Jest setup for React Native Testing Library component tests.
import { AccessibilityInfo } from 'react-native';

// gesture-handler's `RNGestureHandlerModule` is a TurboModule with no jest
// implementation; `jest-expo` mocks Expo's modules but not this one. The
// library's shipped `jestSetup` swaps it (plus GestureButtons and its own
// Pressable) for its mocks — six `jest.mock` calls against `./src`,
// `./lib/commonjs` and `./lib/module`, with no globals, no timers and no side
// effects beyond the module registry.
//
// WHY `require` HERE AND NOT A `setupFiles` ENTRY IN package.json, which is what
// the library's own docs suggest: `jest-expo`'s preset PUSHES
// `jest-expo/src/preset/setup.js` onto `setupFiles`, and a project-level
// `setupFiles` array REPLACES the preset's rather than merging with it — adding
// one there would silently drop every Expo module mock. `setupFilesAfterEach`
// still runs before the test file is required, so registry mocks registered
// here apply.
//
// NOTHING IS NEEDED FOR REANIMATED. `setUpTests()` only registers the
// `toHaveAnimatedStyle` matchers (unused here); `getAnimatedStyle` is exported
// from the package root and reads `props.jestAnimatedStyle`, which reanimated
// populates whenever `IS_JEST`, independently of any setup call.
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

// The asset registry, re-mocked with PLAIN FUNCTIONS rather than `jest.fn()`.
//
// `jest-expo`'s preset already mocks this module, but with `jest.fn()`
// implementations. Any suite that calls `jest.resetAllMocks()` in a `beforeEach`
// (ResetPasswordScreen, ForgotPasswordScreen, HomeScreen do) strips those
// implementations, after which `getAssetByID()` returns `undefined` and
// `expo-asset`'s `Asset.fromModule()` throws `Module "1" is missing from the
// asset registry`. That reaches the app through `TextField` →
// `@expo/vector-icons` → `expo-font` → `expo-asset`, which loads its icon TTF
// from `componentDidMount`, so it takes down every test that renders a secure
// field.
//
// Plain functions are not mock functions, so `resetAllMocks` cannot touch them.
// The alternative — editing the offending `beforeEach` in three behavioural
// suites — would put a test-environment concern into files that exist to prove
// behaviour. Keep this local instead.
//
// HEADS UP: this is a GLOBAL override of `jest-expo`'s own preset mock, applied
// to every suite, and `getAssetByID` returns the SAME placeholder metadata for
// every asset ID (1×1, `uri: 'uri'`, scale 1). Nothing in the app reads those
// values today. A future test that asserts on real asset dimensions, a real
// URI, or tells two assets apart will need a per-suite `jest.spyOn` over this —
// it will not be getting the preset's behaviour, and the failure will look like
// a bug in the code under test rather than in the harness.
jest.mock('@react-native/assets-registry/registry', () => ({
  registerAsset: () => 1,
  getAssetByID: () => ({
    fileSystemLocation: '/full/path/to/directory',
    httpServerLocation: '/assets/full/path/to/directory',
    scales: [1],
    fileHashes: ['md5'],
    name: 'name',
    exists: true,
    type: 'type',
    hash: 'md5',
    uri: 'uri',
    width: 1,
    height: 1,
  }),
}));

// The five auth screens now carry a permanently-looping background animation.
// Pin Reduce Motion ON for the suite so every screen test renders the STATIC
// scatter: no rAF loop, no timers left running, no act() warnings. The animated
// branch is opted into explicitly (and cleaned up) in SpottyBackground.test.tsx.
//
// RN's own mock already resolves `false`; this makes the choice deliberate and
// local instead of inherited.
//
// Why it matters more than it looks: `shouldUseNativeDriver` in RN's animated
// helper SILENTLY falls back to the JS driver when NODE_ENV === 'test' — the
// "native animated module is missing" warning is suppressed there — and RN's
// jest setup implements requestAnimationFrame as setTimeout(0). So an unguarded
// animation does not warn. It quietly busy-loops for the animation's full
// wall-clock duration, in five screen suites. If this pin or the component's
// assume-reduce-motion-until-proven default is ever removed, the suite gets
// slower and flakier WITH NO WARNING AT ALL.
//
// Deliberately NOT done: mocking the RN-internal NativeAnimatedHelper by path.
// In RN 0.81 it lives at `react-native/src/private/animated/`, and pinning a
// private path here is a time bomb for the next SDK bump.
//
// PLAIN FUNCTIONS, not `jest.spyOn(...).mockResolvedValue(...)`, for the same
// reason as the asset registry above: RN's own mocks are `jest.fn()`s, and the
// suites that call `jest.resetAllMocks()` would strip the implementation. An
// `isReduceMotionEnabled` that resolves `undefined` is harmless; one that IS
// undefined throws inside the effect. `jest.spyOn` still works over these —
// SpottyBackground.test.tsx opts into the animated branch that way and restores
// it afterwards.
AccessibilityInfo.isReduceMotionEnabled = () => Promise.resolve(true);
AccessibilityInfo.addEventListener = (() => ({ remove: () => {} })) as never;
