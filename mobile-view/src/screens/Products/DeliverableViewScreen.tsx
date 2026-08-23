import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { navigateRoot } from '../../navigation/navigationRef';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';

export default function DeliverableViewScreen({ route }: any) {
  const { productId, productName: nameParam } = route.params || {};
  const [productName, setProductName] = useState(nameParam || '');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [product, data] = await Promise.all([
        apiService.get(`/products/${productId}`).catch(() => null),
        apiService.get(`/deliverables/by-product/${productId}`),
      ]);
      if (product?.productName) setProductName(product.productName);
      setItems(Array.isArray(data) ? data : data?.deliverables || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenShell title="Deliverables" subtitle={productName} loading={loading}>
      <PageSection title={productName || 'Product'}>
        <WebButton
          title="Add deliverable"
          onPress={() => navigateRoot('DeliverableAdd', { productId, productName })}
        />
        <FlatList
          data={items}
          keyExtractor={(i, idx) => i._id || String(idx)}
          ListEmptyComponent={<Text style={styles.empty}>No deliverables mapped</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.deliverableName || item.name || '—'}</Text>
            </View>
          )}
        />
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, backgroundColor: colors.backgroundLight, borderRadius: 10, marginBottom: 8, marginTop: 8 },
  name: { fontWeight: '600', color: colors.textPrimary },
  empty: { textAlign: 'center', marginTop: 24, color: colors.textSecondary },
});
