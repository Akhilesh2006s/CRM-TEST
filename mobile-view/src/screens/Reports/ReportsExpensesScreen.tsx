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
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadExpensesReport } from '../../utils/downloadExpensesReport';

type Expense = {
  _id: string;
  expItemId?: string;
  amount: number;
  employeeAmount?: number;
  approvedAmount?: number;
  category?: string;
  date?: string;
  createdAt?: string;
  status?: string;
  managerRemarks?: string;
  employeeId?: { _id: string; name?: string; zone?: string };
  trainerId?: { _id: string; name?: string; zone?: string };
  managerApprovedBy?: { _id: string; name?: string };
  approvedBy?: { _id: string; name?: string };
};

type Employee = {
  _id: string;
  name: string;
  zone?: string;
};

type Filters = {
  zone: string;
  employeeId: string;
  status: string;
  fromDate: string;
  toDate: string;
};

const emptyFilters: Filters = {
  zone: '',
  employeeId: '',
  status: '',
  fromDate: '',
  toDate: '',
};

function formatCreatedOn(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  return `${day}-${month}-${year} ${displayHours}:${minutes}:${seconds} ${ampm}`;
}

function formatExpDate(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusDisplay(status?: string) {
  if (status === 'Pending') return 'Pending at Manager';
  if (status === 'Manager Approved') return 'Pending at Finance';
  return status || '-';
}

function statusStyle(status?: string) {
  switch (status) {
    case 'Pending':
      return { bg: '#FEF3C7', fg: '#B45309' };
    case 'Manager Approved':
      return { bg: '#DBEAFE', fg: '#1D4ED8' };
    case 'Executive Manager Approved':
      return { bg: '#FCE7F3', fg: '#BE185D' };
    case 'Approved':
      return { bg: '#DCFCE7', fg: '#15803D' };
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

export default function ReportsExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const loadMeta = useCallback(async () => {
    try {
      const [empData, allExpenses] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/expenses').catch(() => []),
      ]);
      const empList: Employee[] = Array.isArray(empData) ? empData : (empData as any)?.data || [];
      const expList: Expense[] = Array.isArray(allExpenses)
        ? allExpenses
        : (allExpenses as any)?.data || [];
      setEmployees(empList);

      const uniqueZones = new Set<string>();
      empList.forEach((emp) => {
        if (emp.zone) uniqueZones.add(emp.zone);
      });
      expList.forEach((exp) => {
        const zone = exp.employeeId?.zone || exp.trainerId?.zone;
        if (zone) uniqueZones.add(zone);
      });
      setZones(Array.from(uniqueZones).sort());
    } catch {
      // optional meta
    }
  }, []);

  const loadExpenses = useCallback(async (nextFilters: Filters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextFilters.zone) params.append('zone', nextFilters.zone);
      if (nextFilters.employeeId) params.append('employeeId', nextFilters.employeeId);
      if (nextFilters.status) params.append('status', nextFilters.status);
      if (nextFilters.fromDate) params.append('fromDate', nextFilters.fromDate);
      if (nextFilters.toDate) params.append('toDate', nextFilters.toDate);
      const qs = params.toString();
      const data = await apiService.get(`/expenses/report${qs ? `?${qs}` : ''}`);
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
    loadMeta();
    loadExpenses(emptyFilters);
  }, [loadMeta]);

  const onSearch = () => loadExpenses(filters);

  const onRefresh = () => {
    setRefreshing(true);
    loadMeta();
    loadExpenses(filters);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.zone) params.append('zone', filters.zone);
      if (filters.employeeId) params.append('employeeId', filters.employeeId);
      if (filters.status) params.append('status', filters.status);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      await downloadExpensesReport(params.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export expenses');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Expenses"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
      headerRight={
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.headerExport}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.headerExportText}>{exporting ? '…' : 'Export'}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={styles.filterCard}>
          <WebLabel>Zone</WebLabel>
          <WebSelect
            placeholder="All Zones"
            value={filters.zone}
            onValueChange={(v) => setFilters((f) => ({ ...f, zone: v }))}
            items={zones.map((z) => ({ label: z, value: z }))}
          />
          <WebLabel>Employee</WebLabel>
          <WebSelect
            placeholder="All Employees"
            value={filters.employeeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <WebLabel>Status</WebLabel>
          <WebSelect
            placeholder="All Status"
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            items={[
              { label: 'Pending', value: 'Pending' },
              { label: 'Manager Approved', value: 'Manager Approved' },
              { label: 'Executive Manager Approved', value: 'Executive Manager Approved' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Rejected', value: 'Rejected' },
            ]}
          />
          <WebLabel>From Date</WebLabel>
          <WebInput
            value={filters.fromDate}
            onChangeText={(v) => setFilters((f) => ({ ...f, fromDate: v }))}
            placeholder="YYYY-MM-DD"
          />
          <WebLabel>To Date</WebLabel>
          <WebInput
            value={filters.toDate}
            onChangeText={(v) => setFilters((f) => ({ ...f, toDate: v }))}
            placeholder="YYYY-MM-DD"
          />
          <WebButton title="Search" onPress={onSearch} />
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        ) : (
          expenses.map((expense, index) => {
            const badge = statusStyle(expense.status);
            const expNo = expense.expItemId || String(expense._id).slice(-5);
            const employeeName =
              expense.employeeId?.name || expense.trainerId?.name || '-';
            const expenseAmount = Number(expense.employeeAmount ?? expense.amount ?? 0);
            const approvedAmount = Number(expense.approvedAmount ?? 0);
            return (
              <View key={expense._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.expNo}>#{expNo}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                      {getStatusDisplay(expense.status)}
                    </Text>
                  </View>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="Created On" value={formatCreatedOn(expense.createdAt)} />
                <InfoRow label="Exp Date" value={formatExpDate(expense.date)} />
                <InfoRow label="Employee Name" value={employeeName} />
                <InfoRow label="Approved Manager" value={expense.managerApprovedBy?.name || '-'} />
                <InfoRow label="Approved Fin" value={expense.approvedBy?.name || '-'} />
                <InfoRow label="Expense Amount" value={expenseAmount.toFixed(2)} />
                <InfoRow label="Approved Amount" value={approvedAmount.toFixed(2)} />
                <InfoRow label="Approved Remarks" value={expense.managerRemarks || '-'} />
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
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
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
    marginBottom: 10,
    gap: 8,
  },
  expNo: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 130,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
});
