import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BrandButton } from '../components/BrandButton';
import { Screen } from '../components/Screen';
import { request } from '../api/client';
import { MeResponse } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { copy } from '../theme/copy';
import { useTheme } from '../theme/useTheme';

/**
 * Placeholder destination for the `Profile` tab — with one exception that is not
 * a placeholder at all: THIS SCREEN OWNS THE APP'S ONLY `signOut()` CALL SITE.
 * Deleting `profile-logout` strands every signed-in user, so
 * `screens/__tests__/ProfileScreen.test.tsx` guards it, and that suite's first
 * test exists specifically to go red if the `onPress` ever stops firing.
 *
 * It also carries the `/v1/users/me` proof-of-session call, which used to sit on
 * `HomeScreen`. It moved here rather than being deleted: account data belongs on
 * the account screen, this screen already had `useAuth`, and on Home the result
 * was being fetched and then read nowhere at all. Best-effort — a failure shows
 * no email and blocks nothing.
 */
export function ProfileScreen() {
  const { theme } = useTheme();
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    request<MeResponse>('/v1/users/me', { token: session.accessToken })
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {
        // Best-effort proof-of-session call; failures here don't block Profile.
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <Text
          testID="profile-heading"
          style={{
            color: theme.colors.text,
            fontSize: theme.typography.title.fontSize,
            fontWeight: theme.typography.title.fontWeight,
          }}
        >
          {copy.profile.heading}
        </Text>
        {me?.email ? (
          <Text
            testID="profile-email"
            style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize }}
          >
            {me.email}
          </Text>
        ) : null}
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typography.body.fontSize }}>
          {copy.profile.body}
        </Text>

        <View style={{ marginTop: theme.spacing.md }}>
          <BrandButton
            testID="profile-logout"
            label={copy.profile.logoutCta}
            variant="secondary"
            loading={signingOut}
            onPress={onLogout}
          />
        </View>
      </View>
    </Screen>
  );
}
