// THE TEST WHOSE ABSENCE CAUSED THE BUG.
//
// `AppFrame` shipped correct and completely orphaned: nothing rendered it, and no
// test rendered it either, so the signed-in app had no brand canvas, no frame
// chrome and no `StatusBar` — imperceptible in light mode (the platform's white
// root is 7 units from #F8FAFC) and broken in dark, where Home stayed white while
// the feed cards flipped.
//
// An `AppFrame`-in-isolation test would have proved the component works. It would
// NOT have proved anyone renders it. So this suite mounts the REAL signed-in tree
// — NavigationContainer → AppStack → AppFrame → Tab.Navigator — and asserts the
// mount, the per-mode paint, and the clip boundary.
//
// Double-entry: every colour is a literal. Nothing here imports the theme.

import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { AppStack } from '../AppStack';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { ThemeHarness, renderScreen } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// `Tab.Navigator`'s `lazy` default is `true`, so only `Home` mounts and nothing
// in this tree calls `useAuth` today. Mocked anyway: a future
// `initialRouteName` change must not turn this suite red for the wrong reason.
jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: null, signOut: jest.fn() }),
}));

jest.mock('../../api/client', () => ({
  request: jest.fn().mockResolvedValue({}),
}));

type Node = {
  parent: Node | null;
  props: { testID?: string; style?: unknown };
};

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

/** The chain of ancestors, innermost first. */
function ancestors(node: Node): Node[] {
  const chain: Node[] = [];
  let current = node.parent;
  while (current) {
    chain.push(current);
    current = current.parent;
  }
  return chain;
}

function isDescendantOf(node: Node, testID: string): boolean {
  return ancestors(node).some((ancestor) => ancestor.props?.testID === testID);
}

function renderShell(mode: 'light' | 'dark') {
  return render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeHarness mode={mode}>
        <NavigationContainer>
          <AppStack />
        </NavigationContainer>
      </ThemeHarness>
    </SafeAreaProvider>
  );
}

describe('the signed-in shell mounts AppFrame', () => {
  it('renders the frame around the navigator', () => {
    // THE TRIPWIRE. If someone unwires `<AppFrame>` from `AppStack`, this is the
    // assertion that goes red. Its inversion was verified by hand when it was
    // written: reverting the mount fails this test with
    // "Unable to find an element with testID: app-frame-root".
    const { getByTestId } = renderShell('light');

    expect(getByTestId('app-frame-root')).toBeTruthy();
    expect(getByTestId('app-frame')).toBeTruthy();
  });

  it('puts Home and the tab bar INSIDE the frame, not around it', () => {
    const { getByTestId } = renderShell('light');

    expect(isDescendantOf(getByTestId('home-root') as unknown as Node, 'app-frame')).toBe(true);
    expect(isDescendantOf(getByTestId('tab-bar') as unknown as Node, 'app-frame')).toBe(true);
  });

  it('paints the frame stroke over the content, as an inside stroke does', () => {
    const { getByTestId } = renderShell('light');

    const order = (getByTestId('app-frame') as unknown as { findAll: Function })
      .findAll(
        (node: { type: unknown; props: { testID?: string } }) =>
          typeof node.type === 'string' &&
          ['home-root', 'tab-bar', 'app-frame-stroke'].includes(node.props.testID ?? '')
      )
      .map((node: { props: { testID?: string } }) => node.props.testID);

    expect(order[order.length - 1]).toBe('app-frame-stroke');
    expect(order).toContain('home-root');
    expect(order).toContain('tab-bar');
  });

  it('lets Home inherit the canvas instead of painting its own', () => {
    // If someone "fixes" a missing background on Home with a hardcoded fill, the
    // frame stops being the single source of the canvas and the two can drift.
    const { getByTestId } = renderShell('dark');

    expect(flattenStyle(getByTestId('home-root').props.style).backgroundColor).toBeUndefined();
  });
});

describe.each([
  ['light', '#F8FAFC', '#E2E8F0', 'dark'],
  ['dark', '#0F1115', '#2E333B', 'light'],
] as const)('the signed-in shell in %s mode', (mode, canvas, hairline, statusBarStyle) => {
  it(`fills the frame with ${canvas}`, () => {
    const { getByTestId } = renderShell(mode);

    expect(flattenStyle(getByTestId('app-frame-root').props.style).backgroundColor).toBe(canvas);
    expect(flattenStyle(getByTestId('app-frame').props.style).backgroundColor).toBe(canvas);
  });

  it(`draws the 1px hairline in ${hairline}`, () => {
    const { getByTestId } = renderShell(mode);

    const stroke = flattenStyle(getByTestId('app-frame-stroke').props.style);
    expect(stroke.borderWidth).toBe(1);
    expect(stroke.borderColor).toBe(hairline);
  });

  it(`gives EVERY StatusBar in the tree style="${statusBarStyle}"`, () => {
    // Not "exactly one": `Screen.tsx` renders one too, so a focused placeholder
    // tab means two are mounted. The property that matters is that none of them
    // disagrees — which is what catches a stray hardcoded one, the exact bug the
    // dark-mode change had to fix in `LandingScreen`.
    const { UNSAFE_getAllByType } = renderShell(mode);

    const bars = UNSAFE_getAllByType(StatusBar);
    expect(bars.length).toBeGreaterThanOrEqual(1);
    for (const bar of bars) {
      expect(bar.props.style).toBe(statusBarStyle);
    }
  });

  it('agrees with a placeholder tab on the page colour', () => {
    // §5.1's "do Home and the placeholders agree?" made executable. Before the
    // frame was mounted, dark-mode Home was white and dark-mode Map was #0F1115,
    // so switching tabs changed the page colour. They now resolve to the same
    // literal by construction: the frame paints `brand.canvas` and `Screen`
    // paints the same token.
    const shell = renderShell(mode);
    expect(flattenStyle(shell.getByTestId('app-frame').props.style).backgroundColor).toBe(canvas);
    shell.unmount();

    const profile = renderScreen(<ProfileScreen />, mode);
    const fills = ancestors(profile.getByTestId('profile-heading') as unknown as Node)
      .map((node) => flattenStyle(node.props?.style).backgroundColor)
      .filter((fill): fill is string => typeof fill === 'string');

    expect(fills).toContain(canvas);
    expect(new Set(fills)).toEqual(new Set([canvas]));
  });
});

describe('the signed-in shell keeps the centre button unclipped', () => {
  it('names AppFrame as the FIRST clipping ancestor of the tab bar', () => {
    // The rule is "nothing in the NAV chain may set `overflow: 'hidden'`", and
    // `AppFrame` is its stated boundary: the frame HAS to clip or its 32pt radius
    // does nothing, and the 1pt the centre logo escapes by sits at y ≈ 717 —
    // 127pt above the frame's bottom edge and nowhere near the corner arcs.
    //
    // A blanket "no ancestor clips" walk-up would fail here. The isolated version
    // in `SpotsTabBar.test.tsx` passes only because it renders the bar with no
    // shell. Keep both; they guard different things.
    const { getByTestId } = renderShell('light');

    const clipping = ancestors(getByTestId('tab-chat') as unknown as Node).filter(
      (node) => flattenStyle(node.props?.style).overflow === 'hidden'
    );

    expect(clipping.length).toBeGreaterThan(0);
    expect(clipping[0].props?.testID).toBe('app-frame');
  });

  it('renders the bar as a SIBLING of the scene container, not inside a scene', () => {
    // `BottomTabView`'s scene container is `{ flex: 1, overflow: 'hidden' }`. The
    // custom `tabBar` is rendered as its sibling, which is what lets the centre
    // button escape. If anyone ever moved the bar inside a scene, React
    // Navigation's own container would eat the overflow.
    const { getByTestId } = renderShell('light');

    const home = getByTestId('home-root') as unknown as Node;
    const chat = getByTestId('tab-chat') as unknown as Node;

    expect(isDescendantOf(chat, 'home-root')).toBe(false);
    expect(ancestors(home).includes(chat)).toBe(false);
  });
});
