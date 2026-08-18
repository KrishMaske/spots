// Profile owns the app's ONLY `signOut()` call site and, since the Home feed
// dropped its temporary session scaffold, the `/v1/users/me` proof-of-session
// call too.
//
// FOUR OF THESE TESTS WERE RELOCATED FROM `HomeScreen.test.tsx`, NOT WRITTEN
// FRESH: the logout press, the `/v1/users/me` DTO + token, the failure path, and
// the screen-still-renders case. They moved because the behaviour moved. Deleting
// them instead would have left the app's only exit completely unguarded, and
// nothing would ever have gone red — a screen with no logout has nothing to
// assert. That is the same failure shape that let `AppFrame` ship orphaned.

import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ProfileScreen } from '../ProfileScreen';
import { request } from '../../api/client';
import { copy } from '../../theme/copy';
import { renderScreen } from '../../testing/screenTestUtils';

const mockSignOut = jest.fn();

jest.mock('../../api/client', () => ({
  request: jest.fn(),
}));

jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    session: {
      accessToken: 'access-token',
      idToken: 'id',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 0,
      tokenType: 'Bearer',
    },
    signOut: mockSignOut,
  }),
}));

const mockedRequest = request as jest.Mock;

const ME = {
  user_id: '1',
  email: 'krish@example.com',
  status: 'active',
  display_name: '',
  avatar_url: '',
  home_base: '',
  member_since: '2026-01-01T00:00:00Z',
};

// Persistent (not "Once") mock implementations: React may invoke the effect more
// than once across renders, so a `*Once` queue can run dry and return
// `undefined` on a later call, crashing the `.then()` chain with an
// unrelated-looking TypeError.
describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // FIRST, deliberately: this is the assertion that stops a signed-in user being
  // stranded in the app forever. Inverting it (commenting out the `onPress`) must
  // turn this suite red.
  it('calls signOut when the logout button is pressed', async () => {
    mockedRequest.mockResolvedValue(ME);
    mockSignOut.mockResolvedValue(undefined);

    const { getByTestId } = renderScreen(<ProfileScreen />);

    fireEvent.press(getByTestId('profile-logout'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    // Lets the proof-of-session effect settle inside act() — otherwise its
    // `setMe` lands after the test body and React logs an act() warning that
    // looks like a bug in the screen.
    await act(async () => {});
  });

  it('labels the logout control and leaves the heading and body in place', async () => {
    mockedRequest.mockResolvedValue(ME);

    const { getByTestId, getByText } = renderScreen(<ProfileScreen />);

    expect(getByTestId('profile-logout').props.accessibilityLabel).toBe(copy.profile.logoutCta);
    expect(getByTestId('profile-heading').props.children).toBe('Profile');
    expect(getByText(/Coming soon\./)).toBeTruthy();
    await waitFor(() => expect(mockedRequest).toHaveBeenCalled());
    await act(async () => {}); // settle the effect's `setMe` inside act()
  });

  it('shows the spinner while signOut is in flight', async () => {
    mockedRequest.mockResolvedValue(ME);
    let release: () => void = () => {};
    mockSignOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        })
    );

    const { getByTestId } = renderScreen(<ProfileScreen />);
    await act(async () => {}); // settle the proof-of-session effect first

    fireEvent.press(getByTestId('profile-logout'));
    expect(getByTestId('profile-logout').props.accessibilityState.busy).toBe(true);

    await act(async () => {
      release();
    });
    expect(getByTestId('profile-logout').props.accessibilityState.busy).toBe(false);
  });

  it('fetches GET /v1/users/me with the Bearer access token and shows the email on success', async () => {
    mockedRequest.mockResolvedValue(ME);

    const { findByText } = renderScreen(<ProfileScreen />);

    expect(await findByText('krish@example.com')).toBeTruthy();
    expect(mockedRequest).toHaveBeenCalledWith('/v1/users/me', { token: 'access-token' });
  });

  it('does not crash when GET /v1/users/me fails (best-effort proof-of-session call)', async () => {
    mockedRequest.mockRejectedValue(new Error('network error'));

    const { getByTestId, queryByTestId, queryByText } = renderScreen(<ProfileScreen />);

    await waitFor(() => expect(mockedRequest).toHaveBeenCalled());
    expect(getByTestId('profile-heading')).toBeTruthy();
    expect(getByTestId('profile-logout')).toBeTruthy();
    expect(queryByTestId('profile-email')).toBeNull();
    expect(queryByText('krish@example.com')).toBeNull();
  });
});
