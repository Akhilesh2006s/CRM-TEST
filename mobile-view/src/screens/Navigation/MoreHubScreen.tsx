import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { navigateRoot } from '../../navigation/navigationRef';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { getRoleFlags } from '../../utils/roles';
import { confirmLogout } from '../../utils/confirmLogout';

export default function MoreHubScreen() {
  const { user, logout } = useAuth();
  const { isAdmin } = getRoleFlags(user);

  const settingsItems = [
    { label: 'Change Password', screen: 'SettingsPassword' },
    ...(isAdmin
      ? [
          { label: 'App Data Upload', screen: 'SettingsUpload' },
          { label: 'SMS Settings', screen: 'SettingsSMS' },
          { label: 'DB Backup', screen: 'SettingsBackup' },
          { label: 'Expense Policy', screen: 'SettingsExpenses' },
        ]
      : []),
  ];

  const handleLogout = () => {
    confirmLogout(logout);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>More</Text>
      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.name || 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <Text style={styles.profileRole}>{user?.role}</Text>
      </View>
      <Text style={styles.sectionTitle}>Settings</Text>
      {settingsItems.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.row}
          onPress={() => navigateRoot(item.screen)}
        >
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.row, styles.logoutRow]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { ...typography.heading.h1, color: colors.textPrimary, marginBottom: 16 },
  profileCard: {
    backgroundColor: colors.backgroundLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  profileName: { ...typography.heading.h3, color: colors.textPrimary },
  profileEmail: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
  profileRole: { ...typography.label.small, color: colors.primary, marginTop: 8 },
  sectionTitle: { ...typography.label.medium, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowLabel: { ...typography.body.medium, color: colors.textPrimary },
  chevron: { fontSize: 22, color: colors.textSecondary },
  logoutRow: { marginTop: 16, backgroundColor: '#FEE2E2' },
  logoutText: { color: '#B91C1C', fontWeight: '600', width: '100%', textAlign: 'center' },
});
