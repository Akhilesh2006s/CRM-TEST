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
import { exportSalesVisitReport } from '../../utils/exportSalesVisitReport';

type Visit = {
  _id: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  dcDate?: string;
  createdAt?: string;
  dcCategory?: string;
  dcRemarks?: string;
  dcNotes?: string;
  status?: string;
  dcOrderId?: {
    _id?: string;
    school_name?: string;
    school_type?: string;
    dc_code?: string;
    zone?: string;
    location?: string;
    contact_mobile?: string;
  };
  saleId?: { zone?: string };
  employeeId?: { _id?: string; name?: string };
  createdBy?: { _id?: string; name?: string };
};

type Employee = { _id: string; name?: string };

function getVisitDateStr(visit: Visit) {
  return visit.dcDate || visit.createdAt;
}

function getSchoolName(visit: Visit) {
  return visit.dcOrderId?.school_name || visit.customerName || '-';
}

function getSchoolCode(visit: Visit) {
  return visit.dcOrderId?.dc_code || '-';
}

function isNewSchool(visit: Visit) {
  const schoolType = (visit.dcOrderId?.school_type || '').toLowerCase();
  return schoolType === 'new' || !visit.dcOrderId;
}

function getZone(visit: Visit) {
  return visit.dcOrderId?.zone || visit.saleId?.zone || '-';
}

function getExecutive(visit: Visit) {
  return visit.employeeId?.name || visit.createdBy?.name || 'Not Assigned';
}

function getTown(visit: Visit) {
  return visit.dcOrderId?.location || visit.customerAddress || '-';
}

function isConvertedToClient(visit: Visit) {
  return visit.status === 'completed';
}

function getVisitCategoryLabel(visit: Visit) {
  if (isNewSchool(visit)) return 'New School';
  return visit.dcCategory || 'Follow-up';
}

function formatVisitDate(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getSchoolKey(visit: Visit) {
  return visit.dcOrderId?._id || visit.dcOrderId?.dc_code || getSchoolName(visit);
}

export default function ReportsSalesVisitScreen() {
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [zone, setZone] = useState('');
  const [employee, setEmployee] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allVisits, zone, employee, visitDate, schoolSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dcData, employeeData] = await Promise.all([
        apiService.get<any>('/dc'),
        apiService.get<any>('/employees?isActive=true').catch(() => []),
      ]);
      const entries = Array.isArray(dcData) ? dcData : dcData?.data || [];
      setAllVisits(entries);
      setEmployees(Array.isArray(employeeData) ? employeeData : employeeData?.data || []);
      const uniqueZones = Array.from(
        new Set(entries.map((v: Visit) => v.dcOrderId?.zone || v.saleId?.zone).filter(Boolean))
      ).sort() as string[];
      setZones(uniqueZones);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load sales visits');
      setAllVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const applyFilters = () => {
    let filtered = [...allVisits];

    if (zone) {
      filtered = filtered.filter((visit) => getZone(visit).toLowerCase().includes(zone.toLowerCase()));
    }
    if (employee) {
      filtered = filtered.filter(
        (visit) => visit.employeeId?._id === employee || visit.createdBy?._id === employee
      );
    }
    if (visitDate) {
      const target = new Date(visitDate);
      filtered = filtered.filter((visit) => {
        const raw = getVisitDateStr(visit);
        if (!raw) return false;
        const date = new Date(raw);
        return (
          date.getFullYear() === target.getFullYear() &&
          date.getMonth() === target.getMonth() &&
          date.getDate() === target.getDate()
        );
      });
    }
    if (schoolSearch.trim()) {
      const query = schoolSearch.trim().toLowerCase();
      filtered = filtered.filter((visit) => {
        const name = getSchoolName(visit).toLowerCase();
        const code = getSchoolCode(visit).toLowerCase();
        return name.includes(query) || code.includes(query);
      });
    }

    setVisits(filtered);
  };

  const summary = useMemo(() => {
    const totalVisits = visits.length;
    const uniqueSchools = new Set(visits.map(getSchoolKey)).size;
    const newCount = visits.filter(isNewSchool).length;
    const followUpCount = totalVisits - newCount;
    const newPct = totalVisits ? Math.round((newCount / totalVisits) * 100) : 0;
    const followUpPct = totalVisits ? Math.round((followUpCount / totalVisits) * 100) : 0;
    return {
      totalVisits,
      uniqueSchools,
      newVsFollowUp: `${newPct}% / ${followUpPct}%`,
      leadsConverted: visits.filter(isConvertedToClient).length,
      activeZones: new Set(visits.map(getZone).filter((z) => z && z !== '-')).size,
    };
  }, [visits]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSalesVisitReport(
        {
          zone: zone || undefined,
          employeeId: employee || undefined,
          fromDate: visitDate || undefined,
          toDate: visitDate || undefined,
          schoolName: schoolSearch.trim() || undefined,
          schoolCode: schoolSearch.trim() || undefined,
        },
        `Sales_Visit_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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
      title="Sales Visit Report"
      subtitle="School visits from DC records"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kpiScroll}
        contentContainerStyle={styles.kpiRow}
      >
        <View style={[styles.kpiCard, styles.kpiBlue]}>
          <Text style={styles.kpiLabel}>Total Visits</Text>
          <Text style={styles.kpiValue}>{summary.totalVisits}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiGreen]}>
          <Text style={styles.kpiLabel}>Unique Schools</Text>
          <Text style={styles.kpiValue}>{summary.uniqueSchools}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiAmber]}>
          <Text style={styles.kpiLabel}>New vs Follow-up</Text>
          <Text style={styles.kpiValue}>{summary.newVsFollowUp}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiRose]}>
          <Text style={styles.kpiLabel}>Leads Converted</Text>
          <Text style={styles.kpiValue}>{summary.leadsConverted}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiPurple]}>
          <Text style={styles.kpiLabel}>Active Zones</Text>
          <Text style={styles.kpiValue}>{summary.activeZones}</Text>
        </View>
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={styles.filters}>
          <WebSelect
            label="Select Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebSelect
            label="Select Employee"
            value={employee}
            onValueChange={setEmployee}
            placeholder="All Employees"
            items={[
              { label: 'All Employees', value: '' },
              ...employees.map((emp) => ({ label: emp.name || 'Unknown', value: emp._id })),
            ]}
          />
          <WebLabel>Visit Date</WebLabel>
          <WebInput
            placeholder="YYYY-MM-DD"
            value={visitDate}
            onChangeText={setVisitDate}
            {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
          />
          <WebLabel>By School Name / Code</WebLabel>
          <WebInput
            placeholder="Search by School Name / Code"
            value={schoolSearch}
            onChangeText={setSchoolSearch}
          />
          <WebButton title="Search" onPress={applyFilters} />
        </View>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Visit log</Text>
        <Text style={styles.logCount}>{visits.length} records</Text>
      </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : visits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyText}>No visits found</Text>
          </View>
        ) : (
          visits.map((visit, index) => (
            <View key={visit._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.indexText}>#{index + 1}</Text>
                <Text style={styles.dateText}>{formatVisitDate(getVisitDateStr(visit))}</Text>
              </View>
              <View style={styles.executiveRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getExecutive(visit).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.executiveName}>{getExecutive(visit)}</Text>
                  <Text style={styles.zoneText}>{getZone(visit)}</Text>
                </View>
              </View>
              <View style={styles.schoolRow}>
                <Text style={styles.schoolName}>{getSchoolName(visit)}</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.schoolCode}>{getSchoolCode(visit)}</Text>
                  {isNewSchool(visit) ? <Text style={styles.newBadge}>New</Text> : null}
                </View>
              </View>
              <Text style={styles.infoLine}>Town: {getTown(visit)}</Text>
              <View style={styles.badgeRow}>
                <Text style={styles.categoryBadge}>{getVisitCategoryLabel(visit)}</Text>
                {isConvertedToClient(visit) ? (
                  <Text style={styles.convertedBadge}>Converted to Client</Text>
                ) : null}
              </View>
              <Text style={styles.infoLine}>Remarks: {visit.dcRemarks || visit.dcNotes || '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
  kpiScroll: { marginTop: 8 },
  kpiRow: { paddingHorizontal: 16, gap: 10 },
  kpiCard: {
    width: 150,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  kpiGreen: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  kpiAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  kpiRose: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  kpiPurple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  indexText: { ...typography.label.medium, color: colors.textSecondary },
  dateText: { ...typography.label.medium, color: colors.textSecondary },
  executiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#334155' },
  executiveName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  zoneText: { ...typography.label.small, color: colors.textSecondary },
  schoolRow: { marginBottom: 6 },
  schoolName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  schoolCode: { ...typography.label.small, color: colors.textSecondary },
  newBadge: {
    ...typography.label.small,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  infoLine: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  categoryBadge: {
    ...typography.label.small,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  convertedBadge: {
    ...typography.label.small,
    color: '#047857',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
