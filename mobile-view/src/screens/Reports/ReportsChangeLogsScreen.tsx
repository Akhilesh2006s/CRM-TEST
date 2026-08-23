import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadApiFile } from '../../utils/downloadChangeLogsReport';

type ChangeLogEntry = {
  _id: string;
  timestamp: string;
  entity: string;
  action: string;
  summaryTitle: string;
  summarySubtitle?: string;
  modifiedFields?: string[];
  performedBy?: { name?: string };
};

type ChangeLogSummary = {
  totalActivities: number;
  creates: number;
  updates: number;
  topModifiedEntity: string;
};

function formatWhen(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function normalizeResponse(data: unknown): { summary: ChangeLogSummary; data: ChangeLogEntry[] } {
  if (data && typeof data === 'object' && Array.isArray((data as { data?: ChangeLogEntry[] }).data)) {
    const payload = data as { summary?: ChangeLogSummary; data: ChangeLogEntry[] };
    return {
      summary: payload.summary || {
        totalActivities: payload.data.length,
        creates: payload.data.filter((e) => e.action === 'Create').length,
        updates: payload.data.filter((e) => e.action === 'Update').length,
        topModifiedEntity: '-',
      },
      data: payload.data,
    };
  }
  return {
    summary: { totalActivities: 0, creates: 0, updates: 0, topModifiedEntity: '-' },
    data: [],
  };
}

export default function ReportsChangeLogsScreen() {
  const [allLogs, setAllLogs] = useState<ChangeLogEntry[]>([]);
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [summary, setSummary] = useState<ChangeLogSummary>({
    totalActivities: 0,
    creates: 0,
    updates: 0,
    topModifiedEntity: '-',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allLogs, entity, action, fromDate, toDate, search]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await apiService.get<unknown>('/change-logs');
      const normalized = normalizeResponse(data);
      setAllLogs(normalized.data ?? []);
      setSummary(
        normalized.summary ?? {
          totalActivities: 0,
          creates: 0,
          updates: 0,
          topModifiedEntity: '-',
        }
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load change logs');
      setAllLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allLogs];

    if (entity) filtered = filtered.filter((log) => (log.entity || '').toLowerCase() === entity.toLowerCase());
    if (action) filtered = filtered.filter((log) => (log.action || '').toLowerCase() === action.toLowerCase());
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((log) => log.timestamp && new Date(log.timestamp) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      filtered = filtered.filter((log) => log.timestamp && new Date(log.timestamp) <= to);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((log) =>
        [log.summaryTitle, log.summarySubtitle, log.entity, log.action, log.performedBy?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      );
    }

    setLogs(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.append('entity', entity);
      if (action) params.append('action', action);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (search.trim()) params.append('search', search.trim());
      await downloadApiFile(params.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const createsVsUpdates = useMemo(
    () => `${summary.creates} Created • ${summary.updates} Updated`,
    [summary.creates, summary.updates]
  );

  return (
    <ScreenShell
      title="Change Logs"
      subtitle="Creates, updates, and deletes across CRM records"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiBlue]}>
            <Text style={styles.kpiLabel}>TOTAL ACTIVITIES</Text>
            <Text style={styles.kpiValue}>{summary.totalActivities}</Text>
            <Text style={styles.kpiSub}>Recorded</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiGreen]}>
            <Text style={styles.kpiLabel}>CREATES VS UPDATES</Text>
            <Text style={styles.kpiValueSmall}>{createsVsUpdates}</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiOrange]}>
            <Text style={styles.kpiLabel}>TOP MODIFIED ENTITY</Text>
            <Text style={styles.kpiValue}>{summary.topModifiedEntity}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <WebLabel>Entity</WebLabel>
          <WebSelect
            value={entity || 'all'}
            onValueChange={(val) => setEntity(val === 'all' ? '' : val)}
            items={[
              { label: 'All Entities', value: 'all' },
              { label: 'Lead', value: 'Lead' },
              { label: 'DC', value: 'DC' },
              { label: 'DcOrder', value: 'DcOrder' },
              { label: 'Expense', value: 'Expense' },
              { label: 'Product', value: 'Product' },
              { label: 'Training', value: 'Training' },
              { label: 'Service', value: 'Service' },
              { label: 'ContactQuery', value: 'ContactQuery' },
            ]}
          />
          <WebLabel>Action</WebLabel>
          <WebSelect
            value={action || 'all'}
            onValueChange={(val) => setAction(val === 'all' ? '' : val)}
            items={[
              { label: 'All Actions', value: 'all' },
              { label: 'Create', value: 'Create' },
              { label: 'Update', value: 'Update' },
              { label: 'Delete', value: 'Delete' },
            ]}
          />
          <WebLabel>From</WebLabel>
          <WebInput value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
          <WebLabel>To</WebLabel>
          <WebInput value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
          <WebLabel>Search</WebLabel>
          <WebInput value={search} onChangeText={setSearch} placeholder="Search summary or user..." />
          <WebButton title="Search" onPress={loadLogs} />
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Activity log</Text>
          <Text style={styles.tableCount}>{logs.length} records</Text>
        </View>

        {logs.length === 0 && !loading ? (
          <Text style={styles.empty}>No activity records found.</Text>
        ) : (
          logs.map((log) => (
            <View key={log._id} style={styles.row}>
              <Text style={styles.when}>{formatWhen(log.timestamp)}</Text>
              <View style={styles.badges}>
                <Text style={[styles.badge, styles.entityBadge]}>{log.entity}</Text>
                <Text style={[styles.badge, styles.actionBadge]}>{log.action}</Text>
              </View>
              <Text style={styles.summaryTitle}>{log.summaryTitle}</Text>
              {log.summarySubtitle ? <Text style={styles.summarySub}>{log.summarySubtitle}</Text> : null}
              <Text style={styles.fields}>{(log.modifiedFields || []).join(' • ') || '-'}</Text>
              <Text style={styles.performer}>{log.performedBy?.name || 'Amenity (System)'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  kpiRow: { gap: spacing.sm },
  kpiCard: { borderRadius: radii.lg, padding: spacing.md, borderWidth: 1 },
  kpiBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  kpiGreen: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  kpiOrange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  kpiValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  kpiValueSmall: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  kpiSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  filters: { gap: spacing.xs, backgroundColor: colors.backgroundLight, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  tableCount: { fontSize: 13, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.lg },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: 4, backgroundColor: '#fff' },
  when: { fontSize: 12, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  entityBadge: { backgroundColor: '#EDE9FE', color: '#6D28D9' },
  actionBadge: { backgroundColor: '#ECFDF5', color: '#047857', borderWidth: 1, borderColor: '#BBF7D0' },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  summarySub: { fontSize: 12, color: colors.textSecondary },
  fields: { fontSize: 12, color: colors.textSecondary },
  performer: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
});
