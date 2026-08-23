import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function ReturnsWarehouseScreen({ navigation }: any) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    returnDate: '',
    remarks: '',
    lrNumber: '',
    finYear: '',
  });

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/stock-returns/warehouse');
      setReturns(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const submitReturn = async () => {
    if (!form.returnDate) {
      Alert.alert('Validation', 'Please select Return Date');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiService.post('/stock-returns/warehouse', form);
      Alert.alert('Success', `Return #${created.returnNumber} created`);
      setForm({ returnDate: '', remarks: '', lrNumber: '', finYear: '' });
      loadReturns();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit return');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-IN');
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="Warehouse Returns List"
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Submit New Return</Text>
          <View style={styles.formRow}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Return Date *</Text>
              <WebInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={form.returnDate}
                onChangeText={(text) => setForm({ ...form, returnDate: text })}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>LR No (optional)</Text>
              <WebInput
                style={styles.input}
                placeholder="e.g. C062455"
                value={form.lrNumber}
                onChangeText={(text) => setForm({ ...form, lrNumber: text })}
              />
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Fin Year (optional)</Text>
            <WebInput
              style={styles.input}
              placeholder="e.g. 2025-26"
              value={form.finYear}
              onChangeText={(text) => setForm({ ...form, finYear: text })}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Remarks</Text>
            <WebInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason/notes or items summary"
              value={form.remarks}
              onChangeText={(text) => setForm({ ...form, remarks: text })}
              multiline
              numberOfLines={4}
            />
          </View>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={submitReturn}
            disabled={submitting || !form.returnDate}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Warehouse Return</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>All Warehouse Returns</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : returns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No returns</Text>
            </View>
          ) : (
            returns.map((ret) => (
              <View key={ret._id} style={styles.returnCard}>
                <View style={styles.returnHeader}>
                  <Text style={styles.returnNumber}>Return #{ret.returnNumber}</Text>
                  <Text style={styles.returnDate}>{formatDate(ret.returnDate)}</Text>
                </View>
                <View style={styles.returnInfo}>
                  <Text style={styles.returnInfoText}>LR No: {ret.lrNumber || '-'}</Text>
                  <Text style={styles.returnInfoText}>Fin Year: {ret.finYear || '-'}</Text>
                  <Text style={styles.returnInfoText}>Submitted By: {ret.createdBy?.name || '-'}</Text>
                  {ret.remarks && <Text style={styles.returnRemarks}>{ret.remarks}</Text>}
                  <Text style={styles.returnCreated}>Created: {formatDateTime(ret.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  formCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  formTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  formGroup: { flex: 1, marginBottom: 16 },
  label: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  listCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  listTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  loader: { padding: 20 },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  returnCard: { backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  returnHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  returnNumber: { ...typography.heading.h4, color: colors.textPrimary },
  returnDate: { ...typography.body.small, color: colors.textSecondary },
  returnInfo: { marginTop: 8 },
  returnInfoText: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  returnRemarks: { ...typography.body.medium, color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
  returnCreated: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
});


