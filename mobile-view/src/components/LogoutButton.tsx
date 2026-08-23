import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { confirmLogout } from '../utils/confirmLogout';

export default function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = () => {
    confirmLogout(logout);
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={styles.button}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>🚪</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
});
