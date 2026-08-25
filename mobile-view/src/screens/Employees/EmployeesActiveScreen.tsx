import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  role: string;
  department?: string;
  zone?: string;
  cluster?: string;
}

export default function EmployeesActiveScreen({ navigation }: any) {
  const { user } = useAuth();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get<Employee[]>('/employees?isActive=true');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetPassword = async (id: string, name: string) => {
    Alert.alert('Reset Password', `Reset password for ${name} to "Password123"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          try {
            await apiService.put(`/employees/${id}/reset-password`, {});
            Alert.alert('Success', `Password reset to Password123 for ${name}`);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to reset password');
          }
        },
      },
    ]);
  };

  const deactivate = async (id: string, name: string) => {
    Alert.alert('Deactivate employee', `Deactivate ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.put(`/employees/${id}`, { isActive: false, inactiveReason: 'manual' });
            Alert.alert('Success', `${name} has been deactivated`);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to deactivate employee');
          }
        },
      },
    ]);
  };

  const isCoordinator = user?.role === 'Coordinator' || user?.role === 'Senior Coordinator';
  const filtered = items.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.phone || '').includes(searchQuery) ||
    (e.mobile || '').includes(searchQuery) ||
    (e.zone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScreenShell
      title="Employees List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.searchContainer}>
        <WebInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name/email/phone" />
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No active employees found</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.headerCell, styles.nameColumn]}>Name</Text>
                <Text style={[styles.headerCell, styles.emailColumn]}>Email</Text>
                <Text style={[styles.headerCell, styles.mobileColumn]}>Mobile</Text>
                <Text style={[styles.headerCell, styles.roleColumn]}>Role</Text>
                <Text style={[styles.headerCell, styles.departmentColumn]}>Department</Text>
                <Text style={[styles.headerCell, styles.clusterColumn]}>Cluster</Text>
                {!isCoordinator && <Text style={[styles.headerCell, styles.actionColumn]}>Action</Text>}
              </View>
              {filtered.map((e) => (
                <View key={e._id} style={styles.tableRow}>
                  <Text style={[styles.cell, styles.nameColumn]} numberOfLines={1}>{e.name}</Text>
                  <Text style={[styles.cell, styles.emailColumn]} numberOfLines={1}>{e.email}</Text>
                  <Text style={[styles.cell, styles.mobileColumn]}>{e.mobile || e.phone || '-'}</Text>
                  <Text style={[styles.cell, styles.roleColumn]} numberOfLines={1}>{e.role}</Text>
                  <Text style={[styles.cell, styles.departmentColumn]} numberOfLines={1}>{e.department || '-'}</Text>
                  <Text style={[styles.cell, styles.clusterColumn]} numberOfLines={1}>{e.cluster || '-'}</Text>
                  {!isCoordinator && (
                    <View style={[styles.actionCell, styles.actionColumn]}>
                      <TouchableOpacity style={styles.tableEditButton} onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}>
                        <Text style={styles.tableEditText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.tableResetButton} onPress={() => resetPassword(e._id, e.name)}>
                        <Text style={styles.tableResetText}>Reset Password</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.tableDeactivateButton} onPress={() => deactivate(e._id, e.name)}>
                        <Text style={styles.tableDeactivateText}>Deactivate</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  addIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { flex: 1, ...typography.body.medium, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary },
  refreshButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center' },
  refreshButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  tableScrollContent: { paddingBottom: 4 },
  table: { minWidth: 1100, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', minHeight: 42, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: 'center' },
  tableHeader: { minHeight: 40, backgroundColor: colors.tableHeader },
  headerCell: { paddingHorizontal: 10, fontSize: 12, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  cell: { paddingHorizontal: 10, fontSize: 13, color: colors.textPrimary, textAlign: 'center' },
  nameColumn: { width: 150, textAlign: 'left' },
  emailColumn: { width: 260, textAlign: 'left' },
  mobileColumn: { width: 125 },
  roleColumn: { width: 145 },
  departmentColumn: { width: 135 },
  clusterColumn: { width: 120 },
  actionColumn: { width: 280 },
  actionCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  tableEditButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.backgroundLight },
  tableEditText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  tableResetButton: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.backgroundMuted },
  tableResetText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  tableDeactivateButton: { borderWidth: 1, borderColor: '#F2C46D', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.backgroundLight },
  tableDeactivateText: { fontSize: 11, fontWeight: '600', color: '#B45309' },
});

