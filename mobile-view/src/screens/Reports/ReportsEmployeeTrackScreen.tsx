import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { exportEmployeeTrackingReport } from '../../utils/exportEmployeeTrackingReport';

type TrackingData = {
  _id: string;
  employeeName: string;
  mobileNo: string;
  email?: string;
  zone: string;
  started: string;
  lastUsed: string;
  lastLocation: string;
  logCount: number;
};

function formatActivityTimestamp(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function matchesDateFilter(value?: string, filterDate?: string) {
  if (!filterDate) return true;
  if (!value) return false;
  const date = new Date(value);
  const target = new Date(filterDate);
  if (Number.isNaN(date.getTime()) || Number.isNaN(target.getTime())) return false;
  return isSameCalendarDay(date, target);
}

function getLiveStatus(lastUsed?: string) {
  if (!lastUsed) return 'Idle';
  const last = new Date(lastUsed);
  if (Number.isNaN(last.getTime())) return 'Idle';
  return isSameCalendarDay(last, new Date()) ? 'Active Today' : 'Idle';
}

export default function ReportsEmployeeTrackScreen() {
  const [allRecords, setAllRecords] = useState<TrackingData[]>([]);
  const [records, setRecords] = useState<TrackingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [startedDate, setStartedDate] = useState('');
  const [lastUsedDate, setLastUsedDate] = useState('');

  useEffect(() => {
    loadTracking();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allRecords, search, zone, startedDate, lastUsedDate]);

  const zones = useMemo(() => {
    return Array.from(new Set(allRecords.map((r) => r.zone).filter(Boolean))).sort();
  }, [allRecords]);

  const loadTracking = async () => {
    try {
      setLoading(true);
      const data = await apiService.get<TrackingData[]>('/employees/tracking');
      setAllRecords(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load tracking data');
      setAllRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTracking();
  };

  const applyFilters = () => {
    let filtered = [...allRecords];
    const query = search.trim().toLowerCase();

    if (query) {
      filtered = filtered.filter((rec) => {
        const name = rec.employeeName?.toLowerCase() || '';
        const mobile = rec.mobileNo || '';
        const email = rec.email?.toLowerCase() || '';
        return name.includes(query) || mobile.includes(query) || email.includes(query);
      });
    }

    if (zone) {
      filtered = filtered.filter((rec) => rec.zone?.toLowerCase() === zone.toLowerCase());
    }

    if (startedDate) {
      filtered = filtered.filter((rec) => matchesDateFilter(rec.started, startedDate));
    }

    if (lastUsedDate) {
      filtered = filtered.filter((rec) => matchesDateFilter(rec.lastUsed, lastUsedDate));
    }

    setRecords(filtered);
  };

  const summary = useMemo(() => {
    const totalLogs = records.reduce((sum, rec) => sum + (rec.logCount || 0), 0);
    return {
      fieldExecutives: records.length,
      totalGpsLogs: totalLogs,
      zoneCoverage: new Set(records.map((r) => r.zone).filter(Boolean)).size,
    };
  }, [records]);

  const maxLogCount = useMemo(() => Math.max(1, ...records.map((r) => r.logCount || 0)), [records]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeeTrackingReport(
        `Employee_Tracking_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      if (Platform.OS === 'web') {
        Alert.alert('Success', 'Excel file downloaded successfully');
      }
    } catch (error: any) {
      Alert.alert('Export failed', error.message || 'Failed to export to Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Employee Tracking Report"
      subtitle="Field executive activity, GPS logs, and last known location"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Field Executives</Text>
            <Text style={styles.kpiValue}>{summary.fieldExecutives}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total GPS Logs</Text>
            <Text style={styles.kpiValue}>{summary.totalGpsLogs}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Zone Coverage</Text>
            <Text style={styles.kpiValue}>{summary.zoneCoverage}</Text>
          </View>
        </ScrollView>

        <View style={styles.filters}>
          <WebInput
            placeholder="Search for Employee or Mobile"
            value={search}
            onChangeText={setSearch}
          />
          <WebSelect
            label="Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebLabel>Started</WebLabel>
          <WebInput
            placeholder="YYYY-MM-DD"
            value={startedDate}
            onChangeText={setStartedDate}
            {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
          />
          <WebLabel>Last Used</WebLabel>
          <WebInput
            placeholder="YYYY-MM-DD"
            value={lastUsedDate}
            onChangeText={setLastUsedDate}
            {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
          />
          <WebButton title="Search" onPress={applyFilters} />
        </View>

        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>Tracking log</Text>
          <Text style={styles.logCount}>{records.length} employees found</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛰️</Text>
            <Text style={styles.emptyText}>No tracking data found</Text>
          </View>
        ) : (
          records.map((rec, index) => {
            const liveStatus = getLiveStatus(rec.lastUsed);
            const logPct = Math.round(((rec.logCount || 0) / maxLogCount) * 100);
            return (
              <View key={rec._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.indexText}>#{index + 1}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      liveStatus === 'Active Today' ? styles.statusActive : styles.statusIdle,
                    ]}
                  >
                    {liveStatus}
                  </Text>
                </View>
                <Text style={styles.employeeName}>{rec.employeeName}</Text>
                <Text style={styles.contactText}>{rec.mobileNo || rec.email || '-'}</Text>
                <Text style={styles.zoneBadge}>{rec.zone || '-'}</Text>
                <Text style={styles.infoLine}>First Check-in: {formatActivityTimestamp(rec.started)}</Text>
                <Text style={styles.infoLine}>Last Active: {formatActivityTimestamp(rec.lastUsed)}</Text>
                <Text style={styles.infoLine}>Last Location: {rec.lastLocation || 'N/A'}</Text>
                <View style={styles.logRow}>
                  <Text style={styles.logCountBadge}>{rec.logCount || 0}</Text>
                  <View style={styles.logBarTrack}>
                    <View style={[styles.logBarFill, { width: `${logPct}%` }]} />
                  </View>
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
  scrollContent: { paddingBottom: 24 },
  kpiRow: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
  kpiCard: {
    width: 150,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  kpiLabel: { ...typography.label.small, color: colors.textSecondary, textTransform: 'uppercase' },
  kpiValue: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 4 },
  filters: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  logTitle: { ...typography.heading.h3, color: colors.textPrimary },
  logCount: { ...typography.body.medium, color: colors.textSecondary },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 64, marginBottom: 12 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  indexText: { ...typography.label.medium, color: colors.textSecondary },
  statusBadge: {
    ...typography.label.small,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  statusActive: { backgroundColor: '#d1fae5', color: '#047857' },
  statusIdle: { backgroundColor: '#f1f5f9', color: '#64748b' },
  employeeName: { ...typography.heading.h3, color: colors.textPrimary },
  contactText: { ...typography.body.medium, color: colors.textSecondary, marginTop: 2 },
  zoneBadge: {
    ...typography.label.small,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    color: '#475569',
  },
  infoLine: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  logCountBadge: {
    ...typography.label.small,
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: '700',
  },
  logBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  logBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
});
