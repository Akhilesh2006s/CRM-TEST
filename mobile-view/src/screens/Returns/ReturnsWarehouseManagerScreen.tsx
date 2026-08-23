import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';

function getWarehouseExecName(r: any) {
  const v = r.verifiedBy;
  return (v && (typeof v === 'object' ? v.name : null)) || '—';
}

function getSalesExecName(r: any) {
  const e = r.executiveId || r.executiveName;
  if (typeof e === 'object' && e && e.name) return e.name;
  if (typeof e === 'string') return e;
  return r.executiveName || '—';
}

function getConditionSummary(products: any[]) {
  if (!products || !products.length) return '—';
  const conditions = products.map((p: any) => p.condition).filter(Boolean);
  if (!conditions.length) return '—';
  const counts: Record<string, number> = {};
  conditions.forEach((c: string) => { counts[c] = (counts[c] || 0) + 1; });
  return Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ');
}

function getFlags(products: any[]) {
  if (!products || !products.length) return [];
  const flags: string[] = [];
  if (products.some((p: any) => p.quantityMismatch)) flags.push('Mismatch');
  if (products.some((p: any) => p.condition === 'Damaged')) flags.push('Damage');
  if (products.some((p: any) => p.condition === 'Expired')) flags.push('Expired');
  return flags;
}

export default function ReturnsWarehouseManagerScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      // Super Admin/Admin: full list. Warehouse Manager: approval queue only.
      const endpoint = isAdmin
        ? '/stock-returns/warehouse-manager/list'
        : '/stock-returns/warehouse-manager/queue';
      const data = await apiService.get(endpoint);
      setReturns(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
      setReturns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadReturns();
    }, [loadReturns])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReturns();
  };

  return (
    <ScreenShell
      title="Warehouse Manager Returns"
      subtitle="Approve or reject verified returns"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {returns.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? 'No executive stock returns found'
                : 'No returns awaiting approval (Received / Pending Approval)'}
            </Text>
          </View>
        ) : (
          returns.map((r) => {
            const expected = r.totalQuantity ?? 0;
            const received = r.totalReceivedQty ?? 0;
            const conditionSummary = getConditionSummary(r.products || []);
            const flags = getFlags(r.products || []);
            return (
              <TouchableOpacity
                key={r._id}
                style={styles.card}
                onPress={() => navigation.navigate('StockReturnWarehouseManagerReview', { returnId: r._id })}
                activeOpacity={0.8}
              >
                <Text style={styles.cardReturnId}>{r.returnId || `#${r.returnNumber}`}</Text>
                <Text style={styles.cardLabel}>Warehouse exec</Text>
                <Text style={styles.cardValue}>{getWarehouseExecName(r)}</Text>
                <Text style={styles.cardLabel}>Sales exec</Text>
                <Text style={styles.cardValue}>{getSalesExecName(r)}</Text>
                <Text style={styles.cardLabel}>Expected vs received qty</Text>
                <Text style={styles.cardValue}>{expected} vs {received}</Text>
                <Text style={styles.cardLabel}>Condition summary</Text>
                <Text style={styles.cardValue} numberOfLines={2}>{conditionSummary}</Text>
                {flags.length > 0 && (
                  <>
                    <Text style={styles.cardLabel}>Flags</Text>
                    <View style={styles.flagRow}>
                      {flags.map((f) => (
                        <View key={f} style={styles.flag}>
                          <Text style={styles.flagText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                <View style={styles.cardStatus}>
                  <Text style={styles.cardStatusText}>Status: {r.status}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center', fontSize: 18 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardReturnId: { ...typography.heading.h3, color: colors.primary, marginBottom: 12 },
  cardLabel: { ...typography.body.small, color: colors.textSecondary, marginTop: 6, marginBottom: 2 },
  cardValue: { ...typography.body.medium, color: colors.textPrimary },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 6 },
  flag: { backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  flagText: { ...typography.body.small, color: colors.warning, fontWeight: '600' },
  cardStatus: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  cardStatusText: { ...typography.body.small, color: colors.info, fontWeight: '600' },
});
