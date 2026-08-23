import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import {
  getCatalogProductNames,
  getProductLevelsOptions,
  getProductSpecsOptions,
  getProductSubjectsOptions,
  getProductCategoryOptions,
  matchCatalogOption,
} from '../../utils/productCatalog';

type FormState = {
  productName: string;
  category: string;
  level: string;
  specs: string;
  subject: string;
  vendor: string;
  unitPrice: string;
  quantity: string;
};

const DEFAULT_VENDORS = ['Vendor 1', 'Vendor 2', 'Vendor 3'];

function toSelectItems(options: string[]) {
  return options.map((o) => ({ label: o, value: o }));
}

export default function WarehouseInventoryItemEditScreen({ navigation, route }: any) {
  const { id } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<string[]>(DEFAULT_VENDORS);
  const [form, setForm] = useState<FormState>({
    productName: '',
    category: '',
    level: '',
    specs: '',
    subject: '',
    vendor: '',
    unitPrice: '0',
    quantity: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const levelOptions = useMemo(
    () => (form.productName ? getProductLevelsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const specsOptions = useMemo(
    () => (form.productName ? getProductSpecsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const subjectOptions = useMemo(
    () => (form.productName ? getProductSubjectsOptions(products, form.productName) : []),
    [products, form.productName],
  );
  const categoryOptions = useMemo(
    () => (form.productName ? getProductCategoryOptions(products, form.productName) : []),
    [products, form.productName],
  );

  const showLevels = levelOptions.length > 0;
  const showSpecs = specsOptions.length > 0;
  const showSubjects = subjectOptions.length > 0;
  const showCategories = categoryOptions.length > 0;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [item, productList, opts] = await Promise.all([
        apiService.get(`/warehouse/${id}`),
        apiService.get('/products/active').catch(() => apiService.get('/products')),
        apiService.get('/metadata/inventory-options').catch(() => ({ vendors: DEFAULT_VENDORS })),
      ]);

      const catalog = Array.isArray(productList) ? productList : [];
      setProducts(catalog);

      const vendorList = opts?.vendors?.length ? opts.vendors : DEFAULT_VENDORS;
      setVendors(vendorList);

      const productName = item.productName || '';
      const levels = getProductLevelsOptions(catalog, productName);
      const specs = getProductSpecsOptions(catalog, productName);
      const subjects = getProductSubjectsOptions(catalog, productName);
      const categories = getProductCategoryOptions(catalog, productName);

      const savedVendor = item.itemType || '';
      setForm({
        productName,
        category: matchCatalogOption(item.category, categories) || item.category || '',
        level: matchCatalogOption(item.level, levels) || item.level || '',
        specs: matchCatalogOption(item.specs, specs) || item.specs || '',
        subject: matchCatalogOption(item.subject, subjects) || item.subject || '',
        vendor: vendorList.includes(savedVendor) ? savedVendor : savedVendor || vendorList[0] || '',
        unitPrice: String(item.unitPrice ?? 0),
        quantity: String(item.currentStock ?? 0),
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load item');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  function syncFieldsForProduct(name: string, prev: Partial<FormState>) {
    const levels = getProductLevelsOptions(products, name);
    const specsList = getProductSpecsOptions(products, name);
    const categories = getProductCategoryOptions(products, name);
    const subjects = getProductSubjectsOptions(products, name);

    setForm((f) => ({
      ...f,
      productName: name,
      level:
        levels.length > 0
          ? matchCatalogOption(prev.level, levels) || levels[0]
          : '',
      specs:
        specsList.length > 0
          ? matchCatalogOption(prev.specs, specsList) || specsList[0]
          : '',
      category:
        categories.length > 0
          ? matchCatalogOption(prev.category, categories) || categories[0]
          : prev.category || '',
      subject:
        subjects.length > 0
          ? matchCatalogOption(prev.subject, subjects) || subjects[0]
          : '',
    }));
  }

  const handleSubmit = async () => {
    if (!form.productName?.trim()) {
      Alert.alert('Error', 'Product is required');
      return;
    }
    if (showLevels && !form.level) {
      Alert.alert('Error', 'Level is required for this product');
      return;
    }
    if (showSpecs && !form.specs) {
      Alert.alert('Error', 'Specs is required for this product');
      return;
    }
    if (showCategories && !form.category) {
      Alert.alert('Error', 'Product category is required for this product');
      return;
    }
    if (showSubjects && !form.subject) {
      Alert.alert('Error', 'Subject is required for this product');
      return;
    }

    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Error', 'Please enter a valid quantity (0 or greater)');
      return;
    }

    const price = parseFloat(form.unitPrice);

    setSubmitting(true);
    try {
      await apiService.put(`/warehouse/${id}`, {
        productName: form.productName,
        category: form.category || undefined,
        level: form.level || undefined,
        specs: form.specs || undefined,
        subject: form.subject || undefined,
        itemType: form.vendor || undefined,
        unitPrice: isNaN(price) ? 0 : price,
        currentStock: qty,
      });
      Alert.alert('Success', 'Item updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update item');
    } finally {
      setSubmitting(false);
    }
  };

  const productNames = getCatalogProductNames(products);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  return (
    <ScreenShell title="Edit Item" loading={loading}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <WebSelect
          label="Product *"
          value={form.productName}
          onValueChange={(name) => syncFieldsForProduct(name, form)}
          placeholder="Select Product"
          items={toSelectItems(productNames)}
        />

        {showLevels ? (
          <WebSelect
            label="Level *"
            value={form.level}
            onValueChange={(level) => setForm((f) => ({ ...f, level }))}
            placeholder="Select Level"
            disabled={!form.productName}
            items={toSelectItems(levelOptions)}
          />
        ) : showCategories ? (
          <WebSelect
            label="Product Category *"
            value={form.category}
            onValueChange={(category) => setForm((f) => ({ ...f, category }))}
            placeholder="Select Product Category"
            disabled={!form.productName}
            items={toSelectItems(categoryOptions)}
          />
        ) : null}

        {showSpecs ? (
          <WebSelect
            label="Specs *"
            value={form.specs}
            onValueChange={(specs) => setForm((f) => ({ ...f, specs }))}
            placeholder="Select Specs"
            disabled={!form.productName}
            items={toSelectItems(specsOptions)}
          />
        ) : showSubjects ? (
          <WebSelect
            label="Subject *"
            value={form.subject}
            onValueChange={(subject) => setForm((f) => ({ ...f, subject }))}
            placeholder="Select Subject"
            disabled={!form.productName}
            items={toSelectItems(subjectOptions)}
          />
        ) : null}

        <WebSelect
          label="Vendor"
          value={form.vendor}
          onValueChange={(vendor) => setForm((f) => ({ ...f, vendor }))}
          placeholder="Select Vendor"
          items={toSelectItems(vendors)}
        />

        {showCategories && showLevels && (
          <WebSelect
            label="Product Category *"
            value={form.category}
            onValueChange={(category) => setForm((f) => ({ ...f, category }))}
            placeholder="Select Product Category"
            disabled={!form.productName}
            items={toSelectItems(categoryOptions)}
          />
        )}

        {showSubjects && showSpecs && (
          <WebSelect
            label="Subject *"
            value={form.subject}
            onValueChange={(subject) => setForm((f) => ({ ...f, subject }))}
            placeholder="Select Subject"
            disabled={!form.productName}
            items={toSelectItems(subjectOptions)}
          />
        )}

        <FormField
          label="Price"
          value={form.unitPrice}
          onChangeText={(unitPrice) => setForm((f) => ({ ...f, unitPrice }))}
          placeholder="0"
          keyboardType="decimal-pad"
        />

        <FormField
          label="Quantity *"
          value={form.quantity}
          onChangeText={(quantity) => setForm((f) => ({ ...f, quantity }))}
          placeholder="Quantity"
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <View style={styles.submitButtonGradient}>
            <Text style={styles.submitButtonText}>{submitting ? 'Saving…' : 'Save Changes'}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});
