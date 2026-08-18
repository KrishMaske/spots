import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { ResetPasswordScreen } from '../ResetPasswordScreen';
import { ApiError } from '../../api/client';
import { copy } from '../../theme/copy';
import { navProps, renderScreen } from '../../testing/screenTestUtils';

jest.mock('../../api/auth', () => ({
  resetPassword: jest.fn(),
}));

jest.mock('../../auth/session', () => ({
  clearSession: jest.fn(),
}));

// The reset flow must never sign anyone in. If a future refactor "helpfully"
// wires AuthContext into this screen, this mock records it and the assertion
// below fails.
const mockSignIn = jest.fn();
jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const { resetPassword } = require('../../api/auth') as { resetPassword: jest.Mock };
const { clearSession } = require('../../auth/session') as { clearSession: jest.Mock };
/* eslint-enable @typescript-eslint/no-var-requires */

const EMAIL = 'krish@example.com';
const STRONG_PASSWORD = 'N3wSup3rSecret!!';

function fillValidForm(getByTestId: (id: string) => any) {
  fireEvent.changeText(getByTestId('reset-password-code'), '123456');
  fireEvent.changeText(getByTestId('reset-password-password'), STRONG_PASSWORD);
  fireEvent.changeText(getByTestId('reset-password-confirm-password'), STRONG_PASSWORD);
}

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    clearSession.mockResolvedValue(undefined);
  });

  it('renders the heading and the one-hour expiry copy for the emailed code', () => {
    const { getByText } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    expect(getByText(copy.resetPassword.heading)).toBeTruthy();
    expect(getByText(copy.resetPassword.body(EMAIL))).toBeTruthy();
  });

  // The reset code lasts one hour; the sign-up confirmation code lasts 24.
  // Copy-pasting ConfirmScreen's wording here is the easiest bug in this change.
  it('does not describe the reset code with the sign-up code lifetime', () => {
    expect(copy.resetPassword.body(EMAIL)).toContain('an hour');
    expect(copy.resetPassword.body(EMAIL)).not.toContain('24');
  });

  it('shows the info banner passed from the ForgotPassword step', () => {
    const { getByTestId, queryByTestId } = renderScreen(
      <ResetPasswordScreen
        {...(navProps('ResetPassword', { email: EMAIL, info: copy.forgotPassword.sentInfo }) as any)}
      />
    );

    expect(getByTestId('reset-password-info')).toBeTruthy();
    expect(queryByTestId('reset-password-form-error')).toBeNull();
  });

  it('blocks submit without an API call when the new password fails the client-side policy', () => {
    const { getByTestId } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fireEvent.changeText(getByTestId('reset-password-code'), '123456');
    fireEvent.changeText(getByTestId('reset-password-password'), 'weak');
    fireEvent.changeText(getByTestId('reset-password-confirm-password'), 'weak');
    fireEvent.press(getByTestId('reset-password-submit'));

    // This client-side check is what lets a surviving 400 be attributed to the
    // code field rather than the password.
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('blocks submit when the confirm password does not match', () => {
    const { getByTestId } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fireEvent.changeText(getByTestId('reset-password-code'), '123456');
    fireEvent.changeText(getByTestId('reset-password-password'), STRONG_PASSWORD);
    fireEvent.changeText(getByTestId('reset-password-confirm-password'), 'Different1Pass!!');
    fireEvent.press(getByTestId('reset-password-submit'));

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('blocks submit for an empty code', () => {
    const { getByTestId } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fireEvent.changeText(getByTestId('reset-password-password'), STRONG_PASSWORD);
    fireEvent.changeText(getByTestId('reset-password-confirm-password'), STRONG_PASSWORD);
    fireEvent.press(getByTestId('reset-password-submit'));

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sends the ResetPasswordRequest DTO with the fields in the right order', async () => {
    resetPassword.mockResolvedValue(undefined);
    const { getByTestId } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        email: EMAIL,
        code: '123456',
        password: STRONG_PASSWORD,
      });
    });
  });

  it('clears any stale session and returns to Login with a success banner on 204', async () => {
    resetPassword.mockResolvedValue(undefined);
    const props = navProps('ResetPassword', { email: EMAIL });
    const { getByTestId } = renderScreen(<ResetPasswordScreen {...(props as any)} />);

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(clearSession).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('Login', {
        email: EMAIL,
        info: copy.resetPassword.successInfo,
      });
    });
  });

  // A successful reset issues no tokens. The user must log in with the new
  // password; the screen must not auto-sign-in.
  it('never signs the user in after a successful reset', async () => {
    resetPassword.mockResolvedValue(undefined);
    const { getByTestId } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalled();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows an inline code error on 400', async () => {
    resetPassword.mockRejectedValue(new ApiError(400, 'confirmation code is invalid'));
    const { getByTestId, findByText } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    expect(await findByText(copy.resetPassword.invalidCode)).toBeTruthy();
  });

  it('routes an unconfirmed user to Confirm on 403', async () => {
    resetPassword.mockRejectedValue(new ApiError(403, 'user not confirmed'));
    const props = navProps('ResetPassword', { email: EMAIL });
    const { getByTestId } = renderScreen(<ResetPasswordScreen {...(props as any)} />);

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('Confirm', {
        email: EMAIL,
        info: copy.login.notConfirmedInfo,
      });
    });
  });

  it('shows the throttle banner on 429', async () => {
    resetPassword.mockRejectedValue(new ApiError(429, 'too many requests, try again later'));
    const { getByTestId, findByText } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    expect(await findByText(copy.resetPassword.tooManyRequests)).toBeTruthy();
  });

  it('shows the service-unavailable banner on 502', async () => {
    resetPassword.mockRejectedValue(new ApiError(502, 'auth provider unavailable'));
    const { getByTestId, findByText } = renderScreen(
      <ResetPasswordScreen {...(navProps('ResetPassword', { email: EMAIL }) as any)} />
    );

    fillValidForm(getByTestId);
    fireEvent.press(getByTestId('reset-password-submit'));

    expect(await findByText(copy.login.serviceUnavailable)).toBeTruthy();
  });
});
