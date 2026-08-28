import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';

function lineQty(p: any): number {
  for (const raw of [p?.quantity, p?.strength, p?.qty]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function productsSummary(dc: any): string {
  const details = Array.isArray(dc?.productDetails) ? dc.productDetails : [];
  if (details.length > 0) {
    return details
      .map((p: any) => {
        const name = p.product || p.productName || p.product_name || 'Product';
        return `${name} - ${lineQty(p)}`;
      })
      .join(', ');
  }
  if (dc?.product && dc?.requestedQuantity) {
    return `${dc.product} - ${dc.requestedQuantity}`;
  }
  return '-';
}

function totalQty(dc: any): number | string {
  if (Number(dc?.requestedQuantity) > 0) return Number(dc.requestedQuantity);
  const details = Array.isArray(dc?.productDetails) ? dc.productDetails : [];
  if (details.length > 0) {
    const sum = details.reduce((s: number, p: any) => s + lineQty(p), 0);
    return sum > 0 ? sum : '-';
  }
  return '-';
}

function getDCNumber(dc: any): string {
  if (dc?.createdAt) {
    const year = new Date(dc.createdAt).getFullYear();
    const shortYear = year.toString().slice(-2);
    const nextYear = (year + 1).toString().slice(-2);
    const dcId = String(dc._id || '').slice(-4);
    return `${shortYear}-${nextYear}/${dcId}`;
  }
  return `DC-${String(dc?._id || '').slice(-6)}`;
}

function getSchoolCode(dc: any): string {
  const order = dc?.dcOrderId;
  if (order && typeof order === 'object') {
    const code = String(order.school_code || order.dc_code || '').trim();
    return code || '-';
  }
  return '-';
}

function getCustomerName(dc: any): string {
  return (
    dc?.customerName ||
    dc?.saleId?.customerName ||
    (typeof dc?.dcOrderId === 'object' ? dc.dcOrderId?.school_name : '') ||
    '-'
  );
}

function getCustomerPhone(dc: any): string {
  return (
    dc?.customerPhone ||
    (typeof dc?.dcOrderId === 'object' ? dc.dcOrderId?.contact_mobile : '') ||
    '-'
  );
}

export default function DCPendingScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/dc?status=pending_dc');
      const data = Array.isArray(response) ? response : response?.data || [];
      const pendingOnly = (data as any[]).filter((d: any) => d.status === 'pending_dc');
      setItems(pendingOnly);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load pending DCs');
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

  const openDC = (dcId: string) => {
    navigation.navigate('DCPendingOpen', { dcId });
  };

  return (
    <ScreenShell
      title="Pending DC List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {items.length === 0 && !loading ? (
        <Text style={styles.empty}>No pending DCs.</Text>
      ) : (
        <View>
          {items.map((item, idx) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardNumber}>Pending DC #{idx + 1}</Text>
                  <Text style={styles.dcNumber}>{getDCNumber(item)}</Text>
                </View>
                <Text style={styles.quantityBadge}>Qty: {String(totalQty(item))}</Text>
              </View>
              <TouchableOpacity onPress={() => openDC(item._id)} activeOpacity={0.7}>
                <Text style={styles.customerName}>{getCustomerName(item)}</Text>
                <Text style={styles.schoolCode}>School Code: {getSchoolCode(item)}</Text>
              </TouchableOpacity>
              <View style={styles.detailGrid}>
                <View style={styles.detail}><Text style={styles.detailLabel}>Customer Phone</Text><Text style={styles.detailValue}>{getCustomerPhone(item)}</Text></View>
                <View style={styles.detail}><Text style={styles.detailLabel}>Total Quantity</Text><Text style={styles.detailValue}>{String(totalQty(item))}</Text></View>
              </View>
              <View style={styles.productsBlock}>
                <Text style={styles.detailLabel}>Products</Text>
                <Text style={styles.productsText}>{productsSummary(item)}</Text>
              </View>
              <TouchableOpacity style={styles.openBtn} onPress={() => openDC(item._id)} activeOpacity={0.85}>
                <Text style={styles.openBtnText}>Open DC</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...typography.body.medium,
    color: colors.textSecondary,
    paddingVertical: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardNumber: { ...typography.label.small, color: colors.textSecondary },
  dcNumber: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  quantityBadge: { ...typography.label.small, color: colors.primary, backgroundColor: colors.primary + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontWeight: '700' },
  customerName: { ...typography.heading.h4, color: colors.textPrimary },
  schoolCode: { ...typography.label.small, color: colors.primary, fontWeight: '600', marginTop: 3 },
  detailGrid: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  detail: { flex: 1 },
  detailLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 3 },
  detailValue: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  productsBlock: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 12 },
  productsText: { ...typography.label.small, color: colors.textPrimary, lineHeight: 19 },
  openBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  openBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
