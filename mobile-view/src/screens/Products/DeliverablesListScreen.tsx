import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { navigateRoot } from '../../navigation/navigationRef';

export default function DeliverablesListScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products');
        const list = Array.isArray(data) ? data : data?.data || [];
        setProducts(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScreenShell title="Deliverables List" loading={loading}>
      <PageSection title="Deliverables List">
        <Text style={styles.title}>Product deliverables</Text>
        <FlatList
          data={products}
          keyExtractor={(p) => String(p._id)}
          ListEmptyComponent={<Text style={styles.empty}>No products found</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() =>
                  navigateRoot('DeliverableView', {
                    productId: item._id,
                    productName: item.productName,
                  })
                }
              >
                <Text style={styles.name}>{item.productName}</Text>
                <Text style={styles.link}>View deliverables ›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={(e: any) => {
                  // Prevent parent/card navigation stealing the click on web
                  if (Platform.OS === 'web' && e?.stopPropagation) e.stopPropagation();
                  navigateRoot('DeliverableAdd', {
                    productId: item._id,
                    productName: item.productName,
                  });
                }}
              >
                <Text style={styles.addLink}>+ Add deliverable</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 16 },
  card: { backgroundColor: colors.backgroundLight, padding: 14, borderRadius: 12, marginBottom: 8 },
  name: { fontWeight: '600', fontSize: 16, color: colors.textPrimary },
  link: { color: colors.primary, marginTop: 6 },
  addBtn: { marginTop: 8, alignSelf: 'flex-start' },
  addLink: { color: colors.primary, fontWeight: '600' },
});
