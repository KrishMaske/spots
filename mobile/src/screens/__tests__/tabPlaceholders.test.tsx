// The four placeholder tab destinations. DELIBERATELY THIN: these screens are
// routes with a heading, not designs, and over-testing them would just have to
// be deleted when they become real. What is worth pinning is that each renders,
// carries its own copy, and does not accidentally opt into the spotty backdrop.

import React from 'react';

import { ChatScreen } from '../ChatScreen';
import { GroupsScreen } from '../GroupsScreen';
import { MapScreen } from '../MapScreen';
import { ProfileScreen } from '../ProfileScreen';
import { renderScreen } from '../../testing/screenTestUtils';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// `ProfileScreen` is the one placeholder that is not purely a placeholder: it
// calls `useAuth()` (for the app's only `signOut()`) and `request()` (the
// proof-of-session call). `renderScreen` provides theme + safe area only — auth
// is mocked per-suite by design — and `useAuth` THROWS when the context is null,
// so without these two mocks Profile does not render at all here.
//
// `session: null` short-circuits the effect, so `request` is never called; it is
// mocked anyway so a future change cannot fire a real client call from a suite
// that is only about routes.
jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: null, signOut: jest.fn() }),
}));

jest.mock('../../api/client', () => ({
  request: jest.fn().mockResolvedValue({}),
}));

const SCREENS = [
  ['Map', <MapScreen key="map" />, 'map-heading', 'Map'],
  ['Spots AI', <ChatScreen key="chat" />, 'chat-heading', 'Spots AI'],
  ['Groups', <GroupsScreen key="groups" />, 'groups-heading', 'Groups'],
  ['Profile', <ProfileScreen key="profile" />, 'profile-heading', 'Profile'],
] as const;

describe('tab placeholder screens', () => {
  it.each(SCREENS)('%s renders its heading', (_name, element, testID, heading) => {
    const { getByTestId } = renderScreen(element);

    expect(getByTestId(testID).props.children).toBe(heading);
  });

  it.each(SCREENS)('%s says it is not built yet', (_name, element) => {
    const { getByText } = renderScreen(element);

    expect(getByText(/Coming soon\./)).toBeTruthy();
  });

  it.each(SCREENS)('%s renders no backdrop', (_name, element) => {
    // `Screen`'s backdrop is opt-in and none of these opts in.
    const { queryByTestId } = renderScreen(element);

    expect(queryByTestId('spots-backdrop')).toBeNull();
  });

  it('does not design the AI chatbot', () => {
    // The centre nav button needed a destination. This is that destination and
    // nothing more — no input, no message list, no assistant.
    const { queryByPlaceholderText, getByTestId } = renderScreen(<ChatScreen />);

    expect(getByTestId('chat-heading')).toBeTruthy();
    expect(queryByPlaceholderText(/.*/)).toBeNull();
  });
});
