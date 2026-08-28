import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type DcOrderRef = {
  _id?: string;
  dc_code?: string;
  school_name?: string;
  school_code?: string;
};

type StockReturn = {
  _id: string;
  returnId?: string;
  returnNumber?: number;
  lrNumber?: string;
  finYear?: string;
  schoolCode?: string;
  remarks?: string;
  dcOrderId?: string | DcOrderRef;
  status?: string;
  returnStatus?: string;
  createdAt?: string;
  executiveId?: string | { name?: string };
  executiveName?: string;
  customerName?: string;
  returnDate?: string;
  executiveRemarks?: string;
};

type SortKey =
  | 'returnNo'
  | 'lrNo'
  | 'finYear'
  | 'schoolName'
  | 'schoolCode'
  | 'executive'
  | 'returnDate'
  | 'remarks'
  | 'status';

function formatReturnDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

function resolveSchoolName(row: StockReturn): string {
  const dc = row.dcOrderId;
  if (dc && typeof dc === 'object' && dc.school_name) return dc.school_name;
  return row.customerName || '-';
}

function resolveSchoolCode(row: StockReturn): string {
  if (row.schoolCode?.trim()) return row.schoolCode.trim();
  const dc = row.dcOrderId;
  if (dc && typeof dc === 'object' && dc.school_code) return dc.school_code;
  return '-';
}

function resolveRemarks(row: StockReturn): string {
  return (row.remarks || row.executiveRemarks || '').trim() || '-';
}

function resolveExecutive(row: StockReturn): string {
  if (row.executiveName?.trim()) return row.executiveName.trim();
  if (row.executiveId && typeof row.executiveId === 'object') {
    return row.executiveId.name || '-';
  }
  return '-';
}

function resolveStatus(row: StockReturn): string {
  return (row.status || row.returnStatus || '-').trim() || '-';
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'closed' || s === 'stock updated' || s === 'received') {
    return { bg: '#DCFCE7', fg: '#15803D' };
  }
  if (s === 'submitted' || s === 'sent back') {
    return { bg: '#DBEAFE', fg: '#1D4ED8' };
  }
  if (s === 'rejected') {
    return { bg: '#FEE2E2', fg: '#B91C1C' };
  }
  return { bg: '#F1F5F9', fg: '#64748B' };
}

function canWarehouseEdit(row: StockReturn) {
  const s = resolveStatus(row);
  return s === 'Submitted' || s === 'Sent Back';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReturnsWarehouseExecutiveScreen({ navigation }: any) {
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('returnDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/stock-returns/warehouse-executive/list');
      const returnsList = Array.isArray(response) ? response : (response as any)?.data || [];
      setReturns(
        returnsList.map((r: any) => ({
          ...r,
          status: r.status || r.returnStatus || 'Submitted',
        })),
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
      setReturns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReturns();
    }, [loadReturns]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReturns();
  };

  const sortedReturns = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const list = [...returns];
    list.sort((a, b) => {
      let av = '';
      let bv = '';
      switch (sortKey) {
        case 'returnNo':
          av = String(a.returnNumber ?? a.returnId ?? '');
          bv = String(b.returnNumber ?? b.returnId ?? '');
          break;
        case 'lrNo':
          av = a.lrNumber || '';
          bv = b.lrNumber || '';
          break;
        case 'finYear':
          av = a.finYear || '';
          bv = b.finYear || '';
          break;
        case 'schoolName':
          av = resolveSchoolName(a);
          bv = resolveSchoolName(b);
          break;
        case 'schoolCode':
          av = resolveSchoolCode(a);
          bv = resolveSchoolCode(b);
          break;
        case 'executive':
          av = resolveExecutive(a);
          bv = resolveExecutive(b);
          break;
        case 'returnDate':
          av = a.returnDate || a.createdAt || '';
          bv = b.returnDate || b.createdAt || '';
          break;
        case 'remarks':
          av = resolveRemarks(a);
          bv = resolveRemarks(b);
          break;
        case 'status':
          av = resolveStatus(a);
          bv = resolveStatus(b);
          break;
        default:
          break;
      }
      if (sortKey === 'returnNo') {
        const an = Number(av);
        const bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir;
      }
      return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * dir;
    });
    return list;
  }, [returns, sortKey, sortDir]);

  const openReturn = (row: StockReturn) => {
    navigation.navigate('StockReturnWarehouseVerify', { returnId: row._id });
  };

  return (
    <ScreenShell
      title="Return Stock List"
      subtitle="Warehouse executive return dashboard — open a row to verify and submit to manager"
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
        <View style={styles.sortCard}>
          <WebLabel>Sort by</WebLabel>
          <WebSelect
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
            items={[
              { label: 'Return No', value: 'returnNo' },
              { label: 'LR No', value: 'lrNo' },
              { label: 'Fin Year', value: 'finYear' },
              { label: 'School Name', value: 'schoolName' },
              { label: 'School Code', value: 'schoolCode' },
              { label: 'Executive', value: 'executive' },
              { label: 'Return Date', value: 'returnDate' },
              { label: 'Remarks', value: 'remarks' },
              { label: 'Status', value: 'status' },
            ]}
          />
          <TouchableOpacity
            style={styles.sortDirBtn}
            onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            <Ionicons
              name={sortDir === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}
              size={16}
              color="#0F172A"
            />
            <Text style={styles.sortDirText}>
              {sortDir === 'asc' ? 'Ascending' : 'Descending'}
            </Text>
          </TouchableOpacity>
        </View>

        {sortedReturns.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No returns found</Text>
          </View>
        ) : (
          sortedReturns.map((row, index) => {
            const status = resolveStatus(row);
            const badge = statusStyle(status);
            const editable = canWarehouseEdit(row);
            return (
              <View key={row._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.returnNo}>
                    #{row.returnNumber ?? row.returnId ?? index + 1}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>{status}</Text>
                  </View>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="LR No" value={row.lrNumber || '-'} />
                <InfoRow label="Fin Year" value={row.finYear || '-'} />
                <InfoRow label="School Name" value={resolveSchoolName(row)} />
                <InfoRow label="School Code" value={resolveSchoolCode(row)} />
                <InfoRow label="Executive" value={resolveExecutive(row)} />
                <InfoRow label="Return Date" value={formatReturnDate(row.returnDate)} />
                <InfoRow label="Remarks" value={resolveRemarks(row)} />

                <TouchableOpacity
                  style={[styles.actionBtn, !editable && styles.actionBtnMuted]}
                  onPress={() => openReturn(row)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={editable ? '#B45309' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: editable ? '#B45309' : '#64748B' },
                    ]}
                  >
                    {editable ? 'Verify / Update' : 'View'}
                  </Text>
                </TouchableOpacity>
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
  sortCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  sortDirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  sortDirText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
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
  returnNo: {
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
    width: 110,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  actionBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionBtnMuted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
