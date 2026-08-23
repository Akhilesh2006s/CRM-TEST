/**
 * Clients & DC → Create Sale. Matches web `/dashboard/dc/create`.
 * Separate from DCCreate (Raise DC) so leftover dealId params cannot hide this form.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { navigateRoot } from '../../navigation/navigationRef';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const SCHOOL_TYPES = ['Private', 'Public', 'Trust', 'New', 'Existing', 'Other'].map((t) => ({
  label: t,
  value: t,
}));
const DEAL_STATUS_OPTIONS = [
  { label: 'Saved', value: 'saved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
];

type SaleProduct = {
  name: string;
  checked: boolean;
  price: number;
  quantity: number;
  strength: number;
};

export default function DCCreateSaleScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    school_type: '',
    school_name: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    contact_person2: '',
    contact_mobile2: '',
    location: '',
    address: '',
    lead_status: 'pending',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  });
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

  const setField = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }));

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products/active').catch(() => apiService.get('/products'));
        const list = Array.isArray(data) ? data : data?.data || data?.products || [];
        const names = list
          .map((p: any) => p.productName || p.name || p.product)
          .filter(Boolean);
        setProducts(names.map((name: string) => ({ name, checked: false, price: 0, quantity: 1, strength: 0 })));
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      try {
        const data = await apiService.get('/employees?isActive=true');
        const list = Array.isArray(data) ? data : data?.data || [];
        setEmployees(
          list
            .map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' }))
            .filter((e: { name: string }) => e.name !== 'Unknown'),
        );
      } catch {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  const updateProduct = (index: number, patch: Partial<SaleProduct>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!form.school_name.trim() || !form.contact_person.trim() || !form.contact_mobile.trim()) {
      setError('School name, contact person, and mobile are required');
      return;
    }
    if (!form.assigned_to) {
      setError('Please assign the deal to an executive. DC will not be created without assignment.');
      return;
    }
    const selectedProducts = products
      .filter((p) => p.checked)
      .map((p) => ({
        product_name: p.name,
        quantity: p.quantity || 1,
        unit_price: p.price || 0,
        strength: p.strength || 0,
      }));
    if (selectedProducts.length === 0) {
      setError('Please select at least one product.');
      return;
    }

    setSubmitting(true);
    try {
      const followUp = form.follow_up_date
        ? new Date(form.follow_up_date + 'T00:00:00Z').toISOString()
        : undefined;
      await apiService.post('/dc-orders/create', {
        school_name: form.school_name.trim(),
        school_type: form.school_type || undefined,
        contact_person: form.contact_person.trim(),
        contact_mobile: form.contact_mobile.trim(),
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        location: form.location,
        address: form.address || undefined,
        zone: form.zone,
        status: form.lead_status || 'pending',
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks,
        email: form.email,
        products: selectedProducts,
        estimated_delivery_date: followUp,
        assigned_to: form.assigned_to,
      });
      setSuccess('Deal created successfully. DC entry has been created — submit PO from EMP DC / Admin DCs.');
      const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
      setTimeout(() => {
        navigateRoot(isAdmin ? 'DCAdminMy' : 'DCEmp');
      }, 900);
    } catch (e: any) {
      setError(e?.message || 'Failed to create deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Create Deal (Sale)"
      subtitle="Creating a deal automatically generates a DC. Submit PO from My DCs."
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <MessageBanner type="success" message={success} onDismiss={() => setSuccess(null)} /> : null}

      <Text style={styles.label}>School name *</Text>
      <WebInput
        placeholder="School name"
        value={form.school_name}
        onChangeText={(v) => setField('school_name', v)}
      />
      <WebSelect
        label="School Type"
        value={form.school_type}
        onValueChange={(v) => setField('school_type', v)}
        items={SCHOOL_TYPES}
        placeholder="Select Type"
      />
      <Text style={styles.label}>Contact person *</Text>
      <WebInput
        placeholder="Contact person"
        value={form.contact_person}
        onChangeText={(v) => setField('contact_person', v)}
      />
      <Text style={styles.label}>Contact mobile *</Text>
      <WebInput
        placeholder="Contact mobile"
        value={form.contact_mobile}
        onChangeText={(v) => setField('contact_mobile', v)}
        keyboardType="phone-pad"
      />
      <Text style={styles.label}>Email</Text>
      <WebInput
        placeholder="Email"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
      />
      <Text style={styles.label}>Contact Person 2</Text>
      <WebInput
        placeholder="Contact Person 2"
        value={form.contact_person2}
        onChangeText={(v) => setField('contact_person2', v)}
      />
      <Text style={styles.label}>Contact Mobile 2</Text>
      <WebInput
        placeholder="Contact Mobile 2"
        value={form.contact_mobile2}
        onChangeText={(v) => setField('contact_mobile2', v)}
        keyboardType="phone-pad"
      />
      <Text style={styles.label}>Location/Town</Text>
      <WebInput
        placeholder="Location/Town"
        value={form.location}
        onChangeText={(v) => setField('location', v)}
      />
      <Text style={styles.label}>Address</Text>
      <WebInput
        placeholder="Address"
        value={form.address}
        onChangeText={(v) => setField('address', v)}
        multiline
        style={{ minHeight: 72 }}
      />

      <Text style={styles.sectionTitle}>Products *</Text>
      <Text style={styles.hint}>Check products to enter Price, Quantity, and Strength.</Text>
      {products.length === 0 ? (
        <Text style={styles.hint}>No products found. Add products in Settings first.</Text>
      ) : (
        products.map((product, index) => (
          <View key={product.name} style={styles.saleProductRow}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => updateProduct(index, { checked: !product.checked })}
            >
              <View style={[styles.checkbox, product.checked && styles.checkboxOn]}>
                {product.checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.productName}>{product.name}</Text>
            </TouchableOpacity>
            {product.checked ? (
              <View style={styles.productFields}>
                <View style={styles.productField}>
                  <Text style={styles.label}>Price (₹)</Text>
                  <WebInput
                    placeholder="0"
                    value={product.price ? String(product.price) : ''}
                    onChangeText={(v) => updateProduct(index, { price: Number(v) || 0 })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <Text style={styles.label}>Quantity</Text>
                  <WebInput
                    placeholder="1"
                    value={String(product.quantity || '')}
                    onChangeText={(v) => updateProduct(index, { quantity: Math.max(1, Number(v) || 1) })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <Text style={styles.label}>Strength</Text>
                  <WebInput
                    placeholder="0"
                    value={product.strength ? String(product.strength) : ''}
                    onChangeText={(v) => updateProduct(index, { strength: Number(v) || 0 })}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}

      <WebSelect
        label="Lead Status"
        value={form.lead_status}
        onValueChange={(v) => setField('lead_status', v)}
        items={DEAL_STATUS_OPTIONS}
      />
      <Text style={styles.label}>Zone</Text>
      <WebInput placeholder="Zone" value={form.zone} onChangeText={(v) => setField('zone', v)} />
      <Text style={styles.label}>No. of Branches</Text>
      <WebInput
        placeholder="No. of Branches"
        value={form.branches}
        onChangeText={(v) => setField('branches', v)}
        keyboardType="number-pad"
      />
      <WebSelect
        label="Assign to (Executive) *"
        value={form.assigned_to}
        onValueChange={(v) => setField('assigned_to', v)}
        items={employees.map((e) => ({ label: e.name, value: e._id }))}
        placeholder={
          loadingEmployees
            ? 'Loading employees...'
            : employees.length === 0
              ? 'No employees found'
              : 'Select executive *'
        }
      />
      {employees.length === 0 && !loadingEmployees ? (
        <Text style={styles.errorText}>Create employees first in Users / Employees → New Employee</Text>
      ) : null}
      <Text style={styles.label}>School strength (students)</Text>
      <WebInput
        placeholder="School strength (students)"
        value={form.strength}
        onChangeText={(v) => setField('strength', v)}
        keyboardType="number-pad"
      />
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Follow-up date</Text>
        <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowFollowUpPicker(true)}>
          <Text style={[styles.dateText, !form.follow_up_date && styles.placeholderText]}>
            {form.follow_up_date || 'Tap to pick date'}
          </Text>
          <Text>📅</Text>
        </TouchableOpacity>
      </View>
      {showFollowUpPicker ? (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowFollowUpPicker(false)}
          />
          <View style={styles.datePickerBox}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Follow-up date</Text>
              <TouchableOpacity onPress={() => setShowFollowUpPicker(false)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={form.follow_up_date ? new Date(form.follow_up_date + 'T00:00:00') : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              onChange={(_, d) => {
                if (d) setField('follow_up_date', d.toISOString().split('T')[0]);
                if (Platform.OS === 'android') setShowFollowUpPicker(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
      <Text style={styles.label}>Remarks</Text>
      <WebInput
        placeholder="Remarks"
        value={form.remarks}
        onChangeText={(v) => setField('remarks', v)}
        multiline
        style={{ minHeight: 72 }}
      />
      <WebButton
        title={submitting ? 'Creating Deal...' : 'Create Deal'}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
      <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={submitting} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 8, marginBottom: 8 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  errorText: { ...typography.body.small, color: colors.error, marginBottom: 12 },
  saleProductRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.backgroundLight,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  productName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  productFields: { marginTop: 10, gap: 4 },
  productField: { flex: 1 },
  fieldContainer: { marginBottom: 14 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  placeholderText: { color: colors.textSecondary },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  doneText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
});
