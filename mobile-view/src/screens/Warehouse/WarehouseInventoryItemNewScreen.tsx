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
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import {
  getCatalogProductNames,
  getProductLevelsOptions,
  getProductSpecsOptions,
  getProductSubjectsOptions,
  getProductCategoryOptions,
} from '../../utils/productCatalog';

const FIXED_VENDOR = 'Vendor 1';

function toSelectItems(options: string[]) {
  return options.map((o) => ({ label: o, value: o }));
}

export default function WarehouseInventoryItemNewScreen({ navigation }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({
    productName: '',
    category: '',
    level: '',
    specs: '',
    subject: '',
    quantity: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const productList = await apiService
        .get('/products/active')
        .catch(() => apiService.get('/products'));
      setProducts(Array.isArray(productList) ? productList : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  function syncFieldsForProduct(name: string) {
    const levels = getProductLevelsOptions(products, name);
    const specsList = getProductSpecsOptions(products, name);
    const categories = getProductCategoryOptions(products, name);
    const subjects = getProductSubjectsOptions(products, name);

    setForm((f) => ({
      ...f,
      productName: name,
      level: levels.length > 0 ? levels[0] : '',
      specs: specsList.length > 0 ? specsList[0] : '',
      category: categories.length > 0 ? categories[0] : '',
      subject: subjects.length > 0 ? subjects[0] : '',
    }));
  }

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!form.productName?.trim()) {
      setErrorMessage('Product is required');
      return;
    }
    if (showLevels && !form.level) {
      setErrorMessage('Level is required for this product');
      return;
    }
    if (showSpecs && !form.specs) {
      setErrorMessage('Specs is required for this product');
      return;
    }
    if (showCategories && !form.category) {
      setErrorMessage('Product category is required for this product');
      return;
    }
    if (showSubjects && !form.subject) {
      setErrorMessage('Subject is required for this product');
      return;
    }
    if (!form.quantity) {
      setErrorMessage('Quantity is required');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/warehouse', {
        productName: form.productName,
        category: form.category || undefined,
        level: form.level || undefined,
        specs: form.specs || undefined,
        subject: form.subject || undefined,
        itemType: FIXED_VENDOR,
        currentStock: parseFloat(form.quantity) || 0,
      });
      setSuccessMessage('Item added successfully.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const productNames = getCatalogProductNames(products);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <ScreenShell title="Add Item Details" loading={loading}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Fields come from Product Master for the selected product.
        </Text>

        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Inventory"
            onAction={() => navigation.navigate('WarehouseInventoryItems')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <WebSelect
          label="Product *"
          value={form.productName}
          onValueChange={syncFieldsForProduct}
          placeholder="Select Product"
          items={toSelectItems(productNames)}
        />

        {showCategories && (
          <WebSelect
            label="Product Category *"
            value={form.category}
            onValueChange={(category) => setForm((f) => ({ ...f, category }))}
            placeholder="Select Product Category"
            disabled={!form.productName}
            items={toSelectItems(categoryOptions)}
          />
        )}

        {showLevels && (
          <WebSelect
            label="Level *"
            value={form.level}
            onValueChange={(level) => setForm((f) => ({ ...f, level }))}
            placeholder="Select Level"
            disabled={!form.productName}
            items={toSelectItems(levelOptions)}
          />
        )}

        {showSpecs && (
          <WebSelect
            label="Specs *"
            value={form.specs}
            onValueChange={(specs) => setForm((f) => ({ ...f, specs }))}
            placeholder="Select Specs"
            disabled={!form.productName}
            items={toSelectItems(specsOptions)}
          />
        )}

        {showSubjects && (
          <WebSelect
            label="Subject *"
            value={form.subject}
            onValueChange={(subject) => setForm((f) => ({ ...f, subject }))}
            placeholder="Select Subject"
            disabled={!form.productName}
            items={toSelectItems(subjectOptions)}
          />
        )}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Vendor</Text>
          <WebInput
            style={[styles.input, styles.readOnlyInput]}
            value={FIXED_VENDOR}
            editable={false}
          />
        </View>

        <FormField
          label="Quantity *"
          value={form.quantity}
          onChangeText={(quantity) => setForm((f) => ({ ...f, quantity }))}
          placeholder="Item Quantity"
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <View style={styles.submitButtonGradient}>
            <Text style={styles.submitButtonText}>{submitting ? 'Adding…' : 'Add Item'}</Text>
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
  subtitle: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 16,
  },
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
  readOnlyInput: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});
