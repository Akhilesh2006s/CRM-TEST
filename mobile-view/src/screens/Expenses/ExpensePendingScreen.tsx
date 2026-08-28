import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Expense = {
  _id: string;
  title?: string;
  amount: number;
  category?: string;
  status?: string;
  createdAt?: string;
  employeeId?: { _id: string; name?: string; email?: string };
  trainerId?: { _id: string; name?: string; email?: string };
  pendingMonth?: string;
};

type OptionItem = { _id: string; name: string };

function formatRaisedDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date
      .toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1')
      .replace(', ', ' ');
  } catch {
    return '-';
  }
}

function getExpenseType(category?: string) {
  if (!category) return '-';
  if (category === 'Other') return 'Others';
  return category;
}

function getPendingMonth(expense: Expense) {
  if (expense.pendingMonth) return expense.pendingMonth;
  if (!expense.createdAt) return '-';
  return new Date(expense.createdAt).toLocaleString('en-US', { month: 'long' });
}

function getStatusDisplay(status?: string) {
  if (status === 'Pending') return 'Pending at Executive Manager';
  if (status === 'Executive Manager Approved') {
    return 'Approved by Executive Manager, Pending at Manager';
  }
  if (status === 'Approved') return 'Approved';
  return status || '-';
}

function statusStyle(status?: string) {
  switch (status) {
    case 'Approved':
      return { bg: '#DCFCE7', fg: '#15803D' };
    case 'Manager Approved':
      return { bg: '#DBEAFE', fg: '#1D4ED8' };
    case 'Executive Manager Approved':
      return { bg: '#F3E8FF', fg: '#7E22CE' };
    case 'Pending':
      return { bg: '#FEF3C7', fg: '#B45309' };
    case 'Rejected':
      return { bg: '#FEE2E2', fg: '#B91C1C' };
    default:
      return { bg: '#F1F5F9', fg: '#64748B' };
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ExpensePendingScreen({ navigation }: any) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<OptionItem[]>([]);
  const [trainers, setTrainers] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState({ employeeId: '', trainerId: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    try {
      const [employeeData, trainerData] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/trainers?status=active').catch(() => []),
      ]);
      setEmployees(Array.isArray(employeeData) ? employeeData : (employeeData as any)?.data || []);
      setTrainers(Array.isArray(trainerData) ? trainerData : (trainerData as any)?.data || []);
    } catch {
      setEmployees([]);
      setTrainers([]);
    }
  }, []);

  const loadData = useCallback(async (nextFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextFilters.employeeId) params.append('employeeId', nextFilters.employeeId);
      if (nextFilters.trainerId) params.append('trainerId', nextFilters.trainerId);
      const qs = params.toString();
      const data = await apiService.get(`/expenses/manager-pending${qs ? `?${qs}` : ''}`);
      setExpenses(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilters();
    loadData({ employeeId: '', trainerId: '' });
  }, [loadFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFilters();
    loadData(filters);
  };

  const handleSearch = () => loadData(filters);

  const handleEdit = (expense: Expense) => {
    const employeeId = expense.employeeId?._id || expense.trainerId?._id;
    if (employeeId) {
      navigation.navigate('ExpenseManagerUpdate', {
        employeeId,
        employeeName: expense.employeeId?.name || expense.trainerId?.name || 'Employee',
      });
    } else {
      navigation.navigate('ExpenseEdit', { id: expense._id });
    }
  };

  const handleApprove = async (expense: Expense) => {
    setApproving(expense._id);
    try {
      const oversightRoles = new Set(['Admin', 'Super Admin', 'Coordinator', 'Finance Manager']);
      const nextStatus =
        expense.status === 'Pending' && oversightRoles.has(user?.role || '')
          ? 'Executive Manager Approved'
          : 'Approved';

      await apiService.put(`/expenses/${expense._id}/approve`, { status: nextStatus });
      Alert.alert(
        'Success',
        nextStatus === 'Executive Manager Approved'
          ? 'Expense forwarded for manager approval'
          : 'Expense approved successfully',
      );
      loadData(filters);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve expense');
    } finally {
      setApproving(null);
    }
  };

  return (
    <ScreenShell
      title="Pending Expenses List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.filterCard}>
          <WebSelect
            placeholder="All Employees"
            value={filters.employeeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <WebSelect
            placeholder="All Trainers"
            value={filters.trainerId}
            onValueChange={(v) => setFilters((f) => ({ ...f, trainerId: v }))}
            items={trainers.map((t) => ({ label: t.name, value: t._id }))}
          />
          <WebButton title="Search" onPress={handleSearch} />
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No pending expenses found.</Text>
            <Text style={styles.emptyHint}>
              New submissions appear here while awaiting Executive Manager or Manager approval.
            </Text>
          </View>
        ) : (
          expenses.map((expense, index) => {
            const badge = statusStyle(expense.status);
            return (
              <View key={expense._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.employeeName}>
                    {expense.employeeId?.name || expense.trainerId?.name || '-'}
                  </Text>
                  <Text style={styles.amount}>{Number(expense.amount || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                    {getStatusDisplay(expense.status)}
                  </Text>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="Raised Date" value={formatRaisedDate(expense.createdAt)} />
                <InfoRow label="Exp Type" value={getExpenseType(expense.category)} />
                <InfoRow label="Pending Months" value={getPendingMonth(expense)} />

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(expense)}>
                    <Ionicons name="pencil" size={16} color="#EA580C" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.approveBtn,
                      approving === expense._id && styles.approveBtnDisabled,
                    ]}
                    onPress={() => handleApprove(expense)}
                    disabled={approving === expense._id}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>
                      {approving === expense._id ? 'Approving…' : 'Approve'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  emptyBox: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center' },
  emptyHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  employeeName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 120,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  editBtnText: { color: '#EA580C', fontWeight: '700', fontSize: 13 },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  approveBtnDisabled: { opacity: 0.6 },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
