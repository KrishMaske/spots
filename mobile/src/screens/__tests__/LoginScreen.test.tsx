import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { LoginScreen } from '../LoginScreen';
import { ApiError } from '../../api/client';
import { copy } from '../../theme/copy';
import { navProps, renderScreen } from '../../testing/screenTestUtils';

const mockSignIn = jest.fn();

jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the wordmark header and heading', () => {
    const { getByLabelText, getByText } = renderScreen(<LoginScreen {...(navProps('Login', undefined) as any)} />);

    expect(getByLabelText('Spots')).toBeTruthy();
    expect(getByText(copy.login.heading)).toBeTruthy();
  });

  it('prefills the email from route params', () => {
    const { getByTestId } = renderScreen(
      <LoginScreen {...(navProps('Login', { email: 'krish@example.com' }) as any)} />
    );

    expect(getByTestId('login-email').props.value).toBe('krish@example.com');
  });

  it('renders the route info param as a neutral info banner, not the error banner', () => {
    const { getByTestId, getByText, queryByTestId } = renderScreen(
      <LoginScreen {...(navProps('Login', { info: copy.login.verifiedInfo }) as any)} />
    );

    expect(getByTestId('login-info')).toBeTruthy();
    expect(getByText(copy.login.verifiedInfo)).toBeTruthy();
    // The error banner only renders when there's an actual error message.
    expect(queryByTestId('login-form-error')).toBeNull();
  });

  it('calls signIn with the LoginRequest DTO on submit', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen(<LoginScreen {...(navProps('Login', undefined) as any)} />);

    fireEvent.changeText(getByTestId('login-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'Correct1Horse!');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'krish@example.com', password: 'Correct1Horse!' });
    });
  });

  it('shows a banner for 401 invalid credentials', async () => {
    mockSignIn.mockRejectedValueOnce(new ApiError(401, 'invalid credentials'));
    const { getByTestId, findByText } = renderScreen(<LoginScreen {...(navProps('Login', undefined) as any)} />);

    fireEvent.changeText(getByTestId('login-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrong-password');
    fireEvent.press(getByTestId('login-submit'));

    expect(await findByText(copy.login.invalidCredentials)).toBeTruthy();
  });

  it('navigates to Confirm with the email prefilled on 403 not-confirmed', async () => {
    mockSignIn.mockRejectedValueOnce(new ApiError(403, 'user not confirmed'));
    const props = navProps('Login', undefined);
    const { getByTestId } = renderScreen(<LoginScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('login-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'Correct1Horse!');
    fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('Confirm', {
        email: 'krish@example.com',
        info: copy.login.notConfirmedInfo,
      });
    });
  });

  it('shows a non-fatal banner for 502 provider-unavailable', async () => {
    mockSignIn.mockRejectedValueOnce(new ApiError(502, 'auth provider unavailable'));
    const { getByTestId, findByText } = renderScreen(<LoginScreen {...(navProps('Login', undefined) as any)} />);

    fireEvent.changeText(getByTestId('login-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'Correct1Horse!');
    fireEvent.press(getByTestId('login-submit'));

    expect(await findByText(copy.login.serviceUnavailable)).toBeTruthy();
  });

  it('navigates to ForgotPassword carrying the typed email', () => {
    const props = navProps('Login', undefined);
    const { getByTestId } = renderScreen(<LoginScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('login-email'), '  krish@example.com  ');
    fireEvent.press(getByTestId('login-forgot-password'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
      email: 'krish@example.com',
    });
  });

  it('navigates to ForgotPassword with no email when the field is empty', () => {
    const props = navProps('Login', undefined);
    const { getByTestId } = renderScreen(<LoginScreen {...(props as any)} />);

    fireEvent.press(getByTestId('login-forgot-password'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('ForgotPassword', { email: undefined });
  });

  it('shows a client-side error and does not call signIn for an empty form', () => {
    const { getByTestId } = renderScreen(<LoginScreen {...(navProps('Login', undefined) as any)} />);

    fireEvent.press(getByTestId('login-submit'));

    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
