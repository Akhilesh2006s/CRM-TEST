import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type WarehouseItem = {
  _id: string;
  productName?: string;
  category?: string;
  level?: string;
  location?: string;
  specs?: string;
  subject?: string;
  itemType?: string;
  supplier?: string;
  currentStock?: number;
};

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function WarehouseInventoryItemsScreen({ navigation }: any) {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [levelDraft, setLevelDraft] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/warehouse');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load inventory items');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const onSearch = () => {
    setCategoryFilter(categoryDraft.trim());
    setLevelFilter(levelDraft.trim());
  };

  const filtered = useMemo(() => {
    const lcCategory = categoryFilter.toLowerCase();
    const lcLevel = levelFilter.toLowerCase();
    return items.filter((it) => {
      const itemLevel = (it.level || it.location || '').toString().toLowerCase();
      const itemCategory = (it.category || '').toString().toLowerCase();
      const catOk = lcCategory ? itemCategory.includes(lcCategory) : true;
      const lvlOk = lcLevel ? itemLevel.includes(lcLevel) : true;
      return catOk && lvlOk;
    });
  }, [items, categoryFilter, levelFilter]);

  return (
    <ScreenShell
      title="Inventory List"
      subtitle="Warehouse • Products"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={() => navigation.navigate('WarehouseInventoryItemNew')}
          style={styles.addBtn}
          hitSlop={8}
          accessibilityLabel="Add new item"
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      <PageSection title="Search">
        <WebLabel>Product Category</WebLabel>
        <WebInput
          value={categoryDraft}
          onChangeText={setCategoryDraft}
          placeholder="Product Category"
          style={styles.filterInput}
        />
        <WebLabel>Level</WebLabel>
        <WebInput
          value={levelDraft}
          onChangeText={setLevelDraft}
          placeholder="Level"
          style={styles.filterInput}
        />
        <WebButton title="Search" onPress={onSearch} />
      </PageSection>

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No inventory items found</Text>
        </View>
      ) : (
        filtered.map((item, idx) => (
          <TouchableOpacity
            key={item._id}
            style={styles.card}
            onPress={() => navigation.navigate('WarehouseInventoryItemEdit', { id: item._id })}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.serial}>#{idx + 1}</Text>
                <Text style={styles.itemName}>{item.productName || 'N/A'}</Text>
              </View>
              <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
            </View>
            <InfoRow label="Product Category" value={cell(item.category)} />
            <InfoRow label="Level" value={cell(item.level || item.location)} />
            <InfoRow label="Specs" value={cell(item.specs)} />
            <InfoRow label="Subject" value={cell(item.subject)} />
            <InfoRow label="Vendor" value={cell(item.itemType || item.supplier)} />
            <InfoRow
              label="Quantity"
              value={item.currentStock !== undefined && item.currentStock !== null ? String(item.currentStock) : '0'}
            />
          </TouchableOpacity>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: { padding: 4 },
  filterInput: { marginBottom: 8 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  serial: { ...typography.body.small, color: colors.textSecondary, minWidth: 28 },
  itemName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 12,
  },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1, textAlign: 'right' },
});
