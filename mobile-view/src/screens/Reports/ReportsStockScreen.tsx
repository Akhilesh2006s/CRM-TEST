import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadStockReport } from '../../utils/downloadStockReport';

interface StockItem {
  _id: string;
  productName: string;
  productCode?: string;
  category?: string;
  level?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  unitPrice?: number;
  unit?: string;
  location?: string;
  status?: string;
}

function normalizeItem(item: StockItem): StockItem {
  return {
    ...item,
    currentStock: Number(item.currentStock) || 0,
    minStock: Number(item.minStock) || 0,
    maxStock: item.maxStock != null ? Number(item.maxStock) : undefined,
    unitPrice: Number(item.unitPrice) || 0,
    unit: item.unit || 'pcs',
    status: item.status || 'In Stock',
  };
}

export default function ReportsStockScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadStocks();
  }, []);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  };

  const loadStocks = async () => {
    try {
      setLoading(true);
      const qs = buildQueryParams();
      const data = await apiService.get<any>(`/warehouse${qs ? `?${qs}` : ''}`);
      const entries = Array.isArray(data) ? data : data?.data || [];
      setItems(entries.map(normalizeItem));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stock');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStocks();
  };

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort() as string[];
  }, [items]);

  const summary = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((item) => item.status === 'In Stock').length;
    const lowStock = items.filter((item) => item.status === 'Low Stock').length;
    const outStock = items.filter((item) => item.status === 'Out of Stock').length;
    const totalQuantity = items.reduce((sum, item) => sum + (item.currentStock || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock || 0) * (item.unitPrice || 0), 0);
    return { total, inStock, lowStock, outStock, totalQuantity, totalValue };
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch =
        !term ||
        item.productName?.toLowerCase().includes(term) ||
        item.productCode?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.location?.toLowerCase().includes(term);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [items, statusFilter, categoryFilter, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadStockReport(buildQueryParams());
    } catch (error: any) {
      Alert.alert('Export failed', error.message || 'Could not export stock report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Stock Report"
      subtitle="View and manage warehouse inventory"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          style={styles.exportBtn}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.exportText}>Export to Excel</Text>
            </>
          )}
        </TouchableOpacity>
      }
    >
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryBlue]}>
          <Text style={styles.summaryLabel}>Total Items</Text>
          <Text style={styles.summaryValue}>{summary.total}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryGreen]}>
          <Text style={styles.summaryLabel}>In Stock</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{summary.inStock}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryYellow]}>
          <Text style={styles.summaryLabel}>Low Stock</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.lowStock}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryRed]}>
          <Text style={styles.summaryLabel}>Out of Stock</Text>
          <Text style={[styles.summaryValue, { color: colors.error || '#ef4444' }]}>{summary.outStock}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryPurple]}>
          <Text style={styles.summaryLabel}>Total Quantity</Text>
          <Text style={[styles.summaryValue, { color: '#6D28D9' }]}>
            {summary.totalQuantity.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryIndigo]}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={[styles.summaryValue, { color: '#4338CA' }]}>
            ₹{summary.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>
      </View>

      <PageSection title="Filters">
        <WebInput placeholder="Search products..." value={search} onChangeText={setSearch} />
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <WebLabel>Status</WebLabel>
            <WebSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              items={[
                { label: 'All Status', value: 'all' },
                { label: 'In Stock', value: 'In Stock' },
                { label: 'Low Stock', value: 'Low Stock' },
                { label: 'Out of Stock', value: 'Out of Stock' },
                { label: 'Discontinued', value: 'Discontinued' },
              ]}
            />
          </View>
          <View style={styles.filterField}>
            <WebLabel>Category</WebLabel>
            <WebSelect
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              items={[
                { label: 'All Categories', value: 'all' },
                ...categories.map((cat) => ({ label: cat, value: cat })),
              ]}
            />
          </View>
        </View>
        <WebButton
          title={loading ? 'Searching…' : 'Search'}
          onPress={loadStocks}
          disabled={loading}
          loading={loading}
        />
      </PageSection>

      <PageSection title={`Stock Items (${filtered.length})`}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No stock items found</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableHeader}>
                {['Product', 'Code', 'Category', 'Stock', 'Min', 'Max', 'Price', 'Value', 'Location', 'Status'].map(
                  (col) => (
                    <Text key={col} style={styles.tableHeaderCell}>
                      {col}
                    </Text>
                  )
                )}
              </View>
              {filtered.map((item) => (
                <View key={item._id} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.productName || '-'}</Text>
                  <Text style={styles.tableCell}>{item.productCode || '-'}</Text>
                  <Text style={styles.tableCell}>{item.category || '-'}</Text>
                  <Text style={styles.tableCell}>
                    {(item.currentStock || 0).toLocaleString('en-IN')} {item.unit}
                  </Text>
                  <Text style={styles.tableCell}>{(item.minStock || 0).toLocaleString('en-IN')}</Text>
                  <Text style={styles.tableCell}>
                    {item.maxStock != null ? item.maxStock.toLocaleString('en-IN') : '-'}
                  </Text>
                  <Text style={styles.tableCell}>₹{(item.unitPrice || 0).toLocaleString('en-IN')}</Text>
                  <Text style={styles.tableCell}>
                    ₹{((item.currentStock || 0) * (item.unitPrice || 0)).toLocaleString('en-IN', {
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                  <Text style={styles.tableCell}>{item.location || '-'}</Text>
                  <Text style={styles.tableCell}>{item.status || '-'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  summaryGreen: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  summaryYellow: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  summaryRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  summaryPurple: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  summaryIndigo: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  summaryLabel: { ...typography.label.medium, color: colors.textSecondary },
  summaryValue: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, marginBottom: 12 },
  filterField: { flex: 1, minWidth: 160 },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  tableHeaderCell: {
    width: 110,
    ...typography.label.small,
    color: colors.textSecondary,
    fontWeight: '700',
    paddingRight: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  tableCell: { width: 110, ...typography.body.small, color: colors.textPrimary, paddingRight: 8 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLight,
  },
  exportText: { ...typography.label.small, color: colors.primary, fontWeight: '600' },
});
