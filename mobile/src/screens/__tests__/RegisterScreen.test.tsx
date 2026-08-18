import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { RegisterScreen } from '../RegisterScreen';
import { ApiError } from '../../api/client';
import { copy } from '../../theme/copy';
import { navProps, renderScreen } from '../../testing/screenTestUtils';

const mockRegister = jest.fn();
const mockSignIn = jest.fn();

jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ register: mockRegister, signIn: mockSignIn }),
}));

const VALID_PASSWORD = 'Correct1Horse!';

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the wordmark header and heading', () => {
    const { getByLabelText, getByText } = renderScreen(<RegisterScreen {...(navProps('Register', undefined) as any)} />);

    expect(getByLabelText('Spots')).toBeTruthy();
    expect(getByText(copy.register.heading)).toBeTruthy();
  });

  it('calls register with the RegisterRequest DTO and navigates to Confirm when confirmation is required', async () => {
    mockRegister.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: true });
    const props = navProps('Register', undefined);
    const { getByTestId } = renderScreen(<RegisterScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), VALID_PASSWORD);
    fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({ email: 'krish@example.com', password: VALID_PASSWORD });
      expect(props.navigation.navigate).toHaveBeenCalledWith('Confirm', { email: 'krish@example.com' });
    });
  });

  it('auto-signs-in (no Login bounce) when confirmation is not required', async () => {
    mockRegister.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: false });
    mockSignIn.mockResolvedValueOnce(undefined);
    const props = navProps('Register', undefined);
    const { getByTestId } = renderScreen(<RegisterScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), VALID_PASSWORD);
    fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'krish@example.com', password: VALID_PASSWORD });
    });
    // Signed in directly: the gate swaps to the app, so no manual navigation.
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('falls back to Login with a verified banner if the no-confirmation auto-login fails', async () => {
    mockRegister.mockResolvedValueOnce({ user_sub: 'sub-1', confirmation_required: false });
    mockSignIn.mockRejectedValueOnce(new ApiError(502, 'auth provider unavailable'));
    const props = navProps('Register', undefined);
    const { getByTestId } = renderScreen(<RegisterScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), VALID_PASSWORD);
    fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('Login', {
        email: 'krish@example.com',
        info: copy.login.verifiedInfo,
      });
    });
  });

  it('rejects a password that fails the Cognito policy before calling the API', () => {
    const { getByTestId, getByText } = renderScreen(<RegisterScreen {...(navProps('Register', undefined) as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), 'weak');
    fireEvent.changeText(getByTestId('register-confirm-password'), 'weak');
    fireEvent.press(getByTestId('register-submit'));

    expect(getByText(copy.register.weakPassword)).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirm-password before calling the API', () => {
    const { getByTestId, getByText } = renderScreen(<RegisterScreen {...(navProps('Register', undefined) as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), 'Different1!');
    fireEvent.press(getByTestId('register-submit'));

    expect(getByText('Passwords do not match.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows an inline password error on 400', async () => {
    mockRegister.mockRejectedValueOnce(new ApiError(400, 'password does not meet the requirements'));
    const { getByTestId, findByText } = renderScreen(<RegisterScreen {...(navProps('Register', undefined) as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), VALID_PASSWORD);
    fireEvent.press(getByTestId('register-submit'));

    expect(await findByText(copy.register.weakPassword)).toBeTruthy();
  });

  it('shows an inline email error on 409', async () => {
    mockRegister.mockRejectedValueOnce(new ApiError(409, 'email address already registered'));
    const { getByTestId, findByText } = renderScreen(<RegisterScreen {...(navProps('Register', undefined) as any)} />);

    fireEvent.changeText(getByTestId('register-email'), 'krish@example.com');
    fireEvent.changeText(getByTestId('register-password'), VALID_PASSWORD);
    fireEvent.changeText(getByTestId('register-confirm-password'), VALID_PASSWORD);
    fireEvent.press(getByTestId('register-submit'));

    expect(await findByText(copy.register.emailTaken)).toBeTruthy();
  });
});
