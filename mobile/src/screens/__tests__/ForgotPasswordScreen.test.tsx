import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { ApiError } from '../../api/client';
import { copy } from '../../theme/copy';
import { navProps, renderScreen } from '../../testing/screenTestUtils';

jest.mock('../../api/auth', () => ({
  forgotPassword: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { forgotPassword } = require('../../api/auth') as { forgotPassword: jest.Mock };

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders the wordmark header and heading', () => {
    const { getByLabelText, getByText } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    expect(getByLabelText('Spots')).toBeTruthy();
    expect(getByText(copy.forgotPassword.heading)).toBeTruthy();
  });

  it('prefills the email carried over from the Login screen', () => {
    const { getByTestId } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', { email: 'krish@example.com' }) as any)} />
    );

    expect(getByTestId('forgot-password-email').props.value).toBe('krish@example.com');
  });

  it('does not call the API for an empty email', () => {
    const { getByTestId } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    fireEvent.press(getByTestId('forgot-password-submit'));

    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('does not call the API for a malformed email', () => {
    const { getByTestId } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    fireEvent.changeText(getByTestId('forgot-password-email'), 'not-an-email');
    fireEvent.press(getByTestId('forgot-password-submit'));

    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('sends the ForgotPasswordRequest DTO and navigates to ResetPassword with the email on 204', async () => {
    forgotPassword.mockResolvedValue(undefined);
    const props = navProps('ForgotPassword', undefined);
    const { getByTestId } = renderScreen(<ForgotPasswordScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('forgot-password-email'), '  krish@example.com  ');
    fireEvent.press(getByTestId('forgot-password-submit'));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith({ email: 'krish@example.com' });
    });
    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('ResetPassword', {
        email: 'krish@example.com',
        info: copy.forgotPassword.sentInfo,
      });
    });
  });

  // The whole point of the endpoint's always-204 contract: the UI must not be
  // able to tell the user whether the account exists. The banner it forwards is
  // conditional ("if there's a Spots account..."), never a confirmation.
  it('forwards a conditional banner that does not confirm the account exists', async () => {
    forgotPassword.mockResolvedValue(undefined);
    const props = navProps('ForgotPassword', undefined);
    const { getByTestId } = renderScreen(<ForgotPasswordScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('forgot-password-email'), 'nobody@example.com');
    fireEvent.press(getByTestId('forgot-password-submit'));

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalled();
    });
    const info = props.navigation.navigate.mock.calls[0][1].info as string;
    expect(info.toLowerCase()).toContain("if there's a spots account");
    expect(info).toContain('an hour');
  });

  it('shows the throttle banner on 429', async () => {
    forgotPassword.mockRejectedValue(new ApiError(429, 'too many requests, try again later'));
    const { getByTestId, findByText } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    fireEvent.changeText(getByTestId('forgot-password-email'), 'krish@example.com');
    fireEvent.press(getByTestId('forgot-password-submit'));

    expect(await findByText(copy.forgotPassword.tooManyRequests)).toBeTruthy();
  });

  it('shows the service-unavailable banner on 502', async () => {
    forgotPassword.mockRejectedValue(new ApiError(502, 'auth provider unavailable'));
    const { getByTestId, findByText } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    fireEvent.changeText(getByTestId('forgot-password-email'), 'krish@example.com');
    fireEvent.press(getByTestId('forgot-password-submit'));

    expect(await findByText(copy.login.serviceUnavailable)).toBeTruthy();
  });

  it('disables the submit button during the cooldown after a successful send', async () => {
    forgotPassword.mockResolvedValue(undefined);
    const { getByTestId } = renderScreen(
      <ForgotPasswordScreen {...(navProps('ForgotPassword', undefined) as any)} />
    );

    const submit = getByTestId('forgot-password-submit');
    fireEvent.changeText(getByTestId('forgot-password-email'), 'krish@example.com');
    fireEvent.press(submit);

    await waitFor(() => {
      expect(submit.props.accessibilityState.disabled).toBe(true);
    });

    // A second tap during the cooldown must not burn another reset request.
    fireEvent.press(submit);
    expect(forgotPassword).toHaveBeenCalledTimes(1);
  });
});
