import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { Text } from 'react-native';

import { ConfirmScreen } from '../ConfirmScreen';
import { ApiError } from '../../api/client';
import { copy } from '../../theme/copy';
import { lightTheme } from '../../theme/themes';
import { navProps, renderScreen } from '../../testing/screenTestUtils';

const mockConfirmAndSignIn = jest.fn();

jest.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ confirmAndSignIn: mockConfirmAndSignIn }),
}));

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : ((style as Record<string, unknown>) ?? {});
}

describe('ConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the wordmark header, heading, and the emailed-code body copy', () => {
    const { getByLabelText, getByText } = renderScreen(
      <ConfirmScreen {...(navProps('Confirm', { email: 'krish@example.com' }) as any)} />
    );

    expect(getByLabelText('Spots')).toBeTruthy();
    expect(getByText(copy.confirm.heading)).toBeTruthy();
    expect(getByText(copy.confirm.body('krish@example.com'))).toBeTruthy();
  });

  it('shows the info banner passed in route params (e.g. redirected from a 403 login)', () => {
    const { getByTestId, queryByTestId } = renderScreen(
      <ConfirmScreen
        {...(navProps('Confirm', { email: 'krish@example.com', info: copy.login.notConfirmedInfo }) as any)}
      />
    );

    const infoBanner = getByTestId('confirm-info');
    expect(infoBanner).toBeTruthy();
    // Not the error variant: the routing hint is expected, not a failure.
    expect(queryByTestId('confirm-form-error')).toBeNull();

    const style = flattenStyle(infoBanner.props.style);
    expect(style.borderColor).not.toBe(lightTheme.colors.danger);
    expect(style.borderColor).toBe(lightTheme.colors.border);

    const label = infoBanner.findByType(Text);
    const labelStyle = flattenStyle(label.props.style);
    expect(labelStyle.color).not.toBe(lightTheme.colors.danger);
  });

  it('confirms with the ConfirmRequest DTO and, on auto-login, stays put (the gate swaps to the app)', async () => {
    mockConfirmAndSignIn.mockResolvedValueOnce({ signedIn: true });
    const props = navProps('Confirm', { email: 'krish@example.com' });
    const { getByTestId } = renderScreen(<ConfirmScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('confirm-code'), '123456');
    fireEvent.press(getByTestId('confirm-submit'));

    await waitFor(() => {
      expect(mockConfirmAndSignIn).toHaveBeenCalledWith({ email: 'krish@example.com', code: '123456' });
    });
    // Auto-login happened: RootNavigator handles the swap, so no manual nav.
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('falls back to Login with a verified info banner when auto-login did not happen', async () => {
    mockConfirmAndSignIn.mockResolvedValueOnce({ signedIn: false });
    const props = navProps('Confirm', { email: 'krish@example.com' });
    const { getByTestId } = renderScreen(<ConfirmScreen {...(props as any)} />);

    fireEvent.changeText(getByTestId('confirm-code'), '123456');
    fireEvent.press(getByTestId('confirm-submit'));

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith('Login', {
        email: 'krish@example.com',
        info: copy.login.verifiedInfo,
      });
    });
  });

  it('shows an inline code error on 400', async () => {
    mockConfirmAndSignIn.mockRejectedValueOnce(new ApiError(400, 'confirmation code is invalid'));
    const { getByTestId, findByText } = renderScreen(
      <ConfirmScreen {...(navProps('Confirm', { email: 'krish@example.com' }) as any)} />
    );

    fireEvent.changeText(getByTestId('confirm-code'), '000000');
    fireEvent.press(getByTestId('confirm-submit'));

    expect(await findByText(copy.confirm.invalidCode)).toBeTruthy();
  });

  it('does not call confirm for an empty code', () => {
    const { getByTestId } = renderScreen(
      <ConfirmScreen {...(navProps('Confirm', { email: 'krish@example.com' }) as any)} />
    );

    fireEvent.press(getByTestId('confirm-submit'));

    expect(mockConfirmAndSignIn).not.toHaveBeenCalled();
  });

  it('shows the no-resend-endpoint hint instead of a resend button', () => {
    const { getByText, queryByTestId } = renderScreen(
      <ConfirmScreen {...(navProps('Confirm', { email: 'krish@example.com' }) as any)} />
    );

    expect(getByText(copy.confirm.resendHint)).toBeTruthy();
    expect(queryByTestId('confirm-resend')).toBeNull();
  });
});
