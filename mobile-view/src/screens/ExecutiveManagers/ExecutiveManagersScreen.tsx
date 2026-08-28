import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type ExecutiveManager = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  department?: string;
  employeeCount?: number;
};

type Employee = {
  _id: string;
  name: string;
  email: string;
  role: string;
  executiveManagerId?: string;
};

export default function ExecutiveManagersScreen({ navigation }: any) {
  const [managers, setManagers] = useState<ExecutiveManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ExecutiveManager | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/executive-managers');
      setManagers(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load Executive Managers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredManagers = managers.filter(
    (manager) =>
      manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const openAssignDialog = async (manager: ExecutiveManager) => {
    setSelectedManager(manager);
    setSelectedEmployeeIds([]);
    setAssignOpen(true);
    setLoadingEmployees(true);
    try {
      const allEmployees = await apiService.get('/employees?isActive=true');
      const list = Array.isArray(allEmployees) ? allEmployees : allEmployees?.data || [];
      const unassigned = list.filter((emp: Employee) => {
        const isExecutive = emp.role === 'Executive' || emp.role === 'Employee';
        const notAssigned = !emp.executiveManagerId;
        const notManager =
          emp.role !== 'Executive Manager' &&
          emp.role !== 'Admin' &&
          emp.role !== 'Super Admin';
        return isExecutive && notAssigned && notManager;
      });
      setEmployees(unassigned);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAssignEmployees = async () => {
    if (!selectedManager || selectedEmployeeIds.length === 0) {
      Alert.alert('Assign Employees', 'Please select at least one employee');
      return;
    }
    setAssigning(true);
    try {
      await apiService.put(`/executive-managers/${selectedManager._id}/assign-employees`, {
        employeeIds: selectedEmployeeIds,
      });
      Alert.alert(
        'Success',
        `Successfully assigned ${selectedEmployeeIds.length} employee(s) to ${selectedManager.name}`,
      );
      setAssignOpen(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign employees');
    } finally {
      setAssigning(false);
    }
  };

  const createManagerButton = (
    <TouchableOpacity
      style={styles.createBtn}
      onPress={() => navigation.navigate('ExecutiveManagerNew')}
      activeOpacity={0.85}
    >
      <Ionicons name="add-circle-outline" size={18} color="#fff" />
      <Text style={styles.createBtnText}>Create Manager</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenShell
      title="Executive Managers"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={createManagerButton}
    >
      <View style={styles.panel}>
        <WebInput
          style={styles.searchInput}
          placeholder="Search Executive Managers..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />

        {filteredManagers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No Executive Managers found.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ExecutiveManagerNew')}>
              <Text style={styles.emptyLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredManagers.map((manager) => (
              <View key={manager._id} style={styles.card}>
                <View style={styles.cardBody}>
                  <Text style={styles.managerName}>{manager.name}</Text>
                  <Text style={styles.managerMeta}>{manager.email}</Text>
                  {(manager.phone || manager.mobile) ? (
                    <Text style={styles.managerMeta}>{manager.phone || manager.mobile}</Text>
                  ) : null}
                  {manager.department ? (
                    <Text style={styles.managerDept}>{manager.department}</Text>
                  ) : null}
                </View>

                <View style={styles.countRow}>
                  <Ionicons name="people-outline" size={16} color="#64748B" />
                  <Text style={styles.countText}>{manager.employeeCount || 0} Employees</Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() =>
                      navigation.navigate('ExecutiveManagerDashboard', { managerId: manager._id })
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye-outline" size={16} color="#334155" />
                    <Text style={styles.outlineBtnText}>View Dashboard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => openAssignDialog(manager)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#334155" />
                    <Text style={styles.outlineBtnText}>Assign Employees</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Employees to {selectedManager?.name}</Text>
            <Text style={styles.modalSubtitle}>Select executives to assign to this Executive Manager</Text>

            {loadingEmployees ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : employees.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No unassigned executives available</Text>
                <View style={styles.modalEmptyActions}>
                  <WebButton title="View All Employees" variant="outline" onPress={() => {
                    setAssignOpen(false);
                    navigation.navigate('EmployeesActive');
                  }} />
                  <WebButton title="Create New Employee" variant="outline" onPress={() => {
                    setAssignOpen(false);
                    navigation.navigate('EmployeeNew');
                  }} />
                </View>
              </View>
            ) : (
              <ScrollView style={styles.employeeList} nestedScrollEnabled>
                {employees.map((employee) => {
                  const checked = selectedEmployeeIds.includes(employee._id);
                  return (
                    <TouchableOpacity
                      key={employee._id}
                      style={[styles.employeeRow, checked && styles.employeeRowChecked]}
                      onPress={() => toggleEmployee(employee._id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{employee.name}</Text>
                        <Text style={styles.employeeEmail}>
                          {employee.email} • {employee.role === 'Employee' ? 'Executive' : employee.role}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <WebButton title="Cancel" variant="outline" onPress={() => setAssignOpen(false)} />
              <WebButton
                title={assigning ? 'Assigning…' : `Assign ${selectedEmployeeIds.length} Employee(s)`}
                onPress={handleAssignEmployees}
                disabled={assigning || selectedEmployeeIds.length === 0}
                loading={assigning}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  panel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  searchInput: {
    backgroundColor: '#fff',
    marginBottom: 14,
  },
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  cardBody: {
    marginBottom: 12,
  },
  managerName: {
    ...typography.heading.h3,
    color: '#0F172A',
    marginBottom: 4,
  },
  managerMeta: {
    ...typography.body.small,
    color: '#475569',
    marginBottom: 2,
  },
  managerDept: {
    ...typography.body.small,
    color: '#64748B',
    marginTop: 2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  countText: {
    ...typography.body.small,
    color: '#475569',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  outlineBtnText: {
    ...typography.label.small,
    color: '#334155',
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    ...typography.body.medium,
    color: '#64748B',
    marginBottom: 8,
  },
  emptyLink: {
    ...typography.body.medium,
    color: '#2563EB',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    ...typography.heading.h3,
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSubtitle: {
    ...typography.body.small,
    color: '#64748B',
    marginBottom: 12,
  },
  employeeList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  employeeRowChecked: {
    backgroundColor: '#F8FAFC',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    ...typography.label.medium,
    color: '#0F172A',
    fontWeight: '600',
  },
  employeeEmail: {
    ...typography.body.small,
    color: '#64748B',
    marginTop: 2,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalEmptyText: {
    ...typography.body.small,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalEmptyActions: {
    gap: 8,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
});
