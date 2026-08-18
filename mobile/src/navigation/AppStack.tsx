import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppFrame } from '../components/AppFrame';
import { SpotsTabBar, type TabKey } from '../components/SpotsTabBar';
import { ChatScreen } from '../screens/ChatScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { computeHomeLayout } from '../theme/home';
import { AppStackParamList } from './types';

const Tab = createBottomTabNavigator<AppStackParamList>();

/** The three-line adapter between React Navigation's route names and the bar's
 *  own narrow prop vocabulary. The bar deliberately knows nothing about
 *  navigation — see `SpotsTabBar`. */
const ROUTE_BY_TAB: Record<TabKey, keyof AppStackParamList> = {
  home: 'Home',
  map: 'Map',
  chat: 'Chat',
  groups: 'Groups',
  profile: 'Profile',
};

/**
 * The signed-in shell: a five-destination bottom-tab navigator with a custom,
 * floating bar.
 *
 * TABS, NOT A NATIVE STACK. A stack PUSHES — Home → Map → Groups would grow a
 * back stack and animate horizontally — so faking tabs on one means intercepting
 * back behaviour by hand. Tabs also mount the bar exactly once (it does not
 * remount or re-shadow on every navigation) and keep the screens unaware of it,
 * which is why `HomeScreen.test.tsx` can still render the screen with no
 * navigator at all.
 *
 * THE NAVIGATOR DOES NOT SUBTRACT THE BAR'S HEIGHT FROM THE SCENES. An earlier
 * version of this docblock claimed it does. It does not: the custom `tabBar` is
 * absolutely positioned (see `tabBarStyle` below and `SpotsTabBar`'s root), so it
 * takes no layout space and each scene runs the full window height with the bar
 * floating over it. That is deliberate — a glass bar wants content passing
 * underneath — and it is why `homeSpec.feed.bottomPadding` has to clear the bar's
 * whole footprint itself.
 *
 * `AppFrame` WRAPS THE NAVIGATOR, and this is the only place it is mounted. It
 * owns the signed-in shell's brand canvas, its 32pt radius, Figma's 1px hairline
 * and its `StatusBar`. It is mounted HERE rather than in `RootNavigator` because
 * (a) `RootNavigator`'s `loading` branch must stay unframed — a 32pt-rounded box
 * around a spinner would be wrong — and (b) this file already owns the signed-in
 * shell's geometry and its no-clip rule, so the frame and that rule get reviewed
 * together. It must be OUTSIDE the navigator either way, never per-screen: the
 * bar is rendered BY the navigator and has to sit inside the frame, and the
 * `StatusBar` has to mount once for the whole shell.
 *
 * `AppFrame` was written but NEVER MOUNTED until 2026-08-17, so the signed-in app
 * had no canvas, no frame chrome and no `StatusBar` at all — imperceptible in
 * light (a 7-unit delta against the platform's white root) and broken in dark.
 * `navigation/__tests__/signedInShell.test.tsx` exists so that cannot recur.
 *
 * The file name and the exported `AppStack` symbol are unchanged, so
 * `RootNavigator` is untouched. Registration order keeps `Chat` third so the
 * navigator's own ordering matches the visual one.
 */
export function AppStack() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = computeHomeLayout({ width, height, insets });

  return (
    <AppFrame>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          // TRANSPARENT ON PURPOSE, and it really does take effect.
          //
          // 1. `sceneStyle` is the correct option name for
          //    @react-navigation/bottom-tabs v7 (`src/types.tsx`, consumed in
          //    `views/BottomTabView.tsx`). The v6 name was `sceneContainerStyle`;
          //    had the old name survived here the option would be SILENTLY
          //    IGNORED. Do not "modernise" it back.
          // 2. It genuinely overrides the navigation theme's `background`,
          //    because `@react-navigation/elements`' `Background` applies the
          //    theme colour FIRST and this style second.
          // 3. The reason we want that: `AppFrame` owns the canvas and the 32pt
          //    clip. An opaque scene fill would paint a square over the frame's
          //    rounded corners.
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: {
            position: 'absolute',
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
        tabBar={({ state, navigation }) => (
          <SpotsTabBar
            layout={layout.nav}
            activeKey={state.routeNames[state.index].toLowerCase() as TabKey}
            onSelect={(key) => navigation.navigate(ROUTE_BY_TAB[key])}
          />
        )}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Map" component={MapScreen} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen name="Groups" component={GroupsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </AppFrame>
  );
}
