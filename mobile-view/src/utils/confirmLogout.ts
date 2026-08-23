import { Alert, Platform } from 'react-native';

/** `Alert.alert` does not show on Expo web, so Sign out appeared to do nothing. */
export function confirmLogout(onConfirm: () => void | Promise<void>) {
  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm('Sign out of the CRM?');
    if (ok) void onConfirm();
    return;
  }

  Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Logout',
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
