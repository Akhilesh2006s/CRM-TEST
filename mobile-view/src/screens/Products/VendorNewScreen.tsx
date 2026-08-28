import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebLabel } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Product = { _id: string; productName?: string; name?: string };

export default function VendorNewScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products');
        const entries = Array.isArray(data) ? data : data?.data || [];
        setProducts(entries);
      } catch (error: any) {
        Alert.alert('Unable to load products', error.message || 'Please refresh and try again.');
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((current) => current.includes(id) ? current.filter((productId) => productId !== id) : [...current, id]);
  };

  const selectAll = () => setSelectedProductIds((current) => current.length === products.length ? [] : products.map((product) => product._id));

  const save = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Required', 'Partner name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }
    if (selectedProductIds.length === 0) {
      Alert.alert('Required', 'Select at least one product for this partner.');
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/partners', { name: name.trim(), email: email.trim(), password, assignedProducts: selectedProductIds });
      Alert.alert('Partner saved', 'Partner saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  return <ScreenShell title="Add Partner" loading={loadingProducts}>
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>Create a new partner account and assign products</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Partner Basic Details</Text>
        <WebLabel>Partner Name *</WebLabel>
        <WebInput value={name} onChangeText={setName} placeholder="Enter partner name" />
        <WebLabel>Partner Email *</WebLabel>
        <WebInput value={email} onChangeText={setEmail} placeholder="Enter partner email (used for login)" autoCapitalize="none" keyboardType="email-address" />
        <WebLabel>Partner Password *</WebLabel>
        <WebInput value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry />
        <Text style={styles.helper}>Minimum 6 characters required</Text>

        <View style={styles.divider} />
        <View style={styles.productsHeader}>
          <View><Text style={styles.sectionTitle}>Assign Products</Text><Text style={styles.helper}>Select products to assign to this partner. At least one product is required.</Text></View>
          <TouchableOpacity style={styles.selectAll} onPress={selectAll} disabled={products.length === 0}>
            <Text style={styles.selectAllText}>{selectedProductIds.length === products.length && products.length ? 'Clear All' : 'Select All'}</Text>
          </TouchableOpacity>
        </View>
        {loadingProducts ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : products.length === 0 ? <Text style={styles.empty}>No active products available.</Text> : <View style={styles.productList}>
          {products.map((product) => {
            const selected = selectedProductIds.includes(product._id);
            return <TouchableOpacity key={product._id} style={styles.productOption} onPress={() => toggleProduct(product._id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected && <Text style={styles.checkmark}>✓</Text>}</View>
              <Text style={styles.productText}>{product.productName || product.name || 'Unnamed product'}</Text>
            </TouchableOpacity>;
          })}
        </View>}
        <Text style={styles.selectedCount}>Selected: {selectedProductIds.length} product{selectedProductIds.length === 1 ? '' : 's'}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={saving}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Partner</Text>}</TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { flex: 1 }, contentContainer: { padding: 16, paddingBottom: 32 }, subtitle: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 16 },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 }, sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 10 }, helper: { ...typography.label.small, color: colors.textSecondary, marginTop: -4, marginBottom: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 }, productsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }, selectAll: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }, selectAllText: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  productList: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, marginTop: 4 }, productOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }, checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.border, marginRight: 10, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary }, checkmark: { color: '#fff', fontWeight: '800', fontSize: 14 }, productText: { ...typography.body.medium, color: colors.textPrimary },
  selectedCount: { ...typography.label.small, color: colors.textSecondary, marginTop: 10 }, loader: { marginVertical: 20 }, empty: { ...typography.body.medium, color: colors.textSecondary, marginVertical: 16 }, actions: { flexDirection: 'row', gap: 12, marginTop: 20 }, cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border }, cancelText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' }, saveButton: { flex: 1.5, alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 10, backgroundColor: colors.primary }, disabled: { opacity: 0.6 }, saveText: { ...typography.body.medium, color: '#fff', fontWeight: '700' },
});
