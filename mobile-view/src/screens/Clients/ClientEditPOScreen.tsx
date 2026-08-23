/**
 * Edit PO for a client (DcOrder).
 * - View / Download / Preview current PO PDF
 * - Request PO Change (new PDF + remarks) → requires Manager approval; DC Request locked until resolved
 * - Edit products & quantities (saved directly)
 */
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
  Modal,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { navigateRoot } from '../../navigation/navigationRef';
import {
  findDuplicateEditPORowIndex,
  pickUnusedEditPOVariant,
  canAddAnotherEditPOVariant,
  formatEditPOVariantHint,
  editPORowIdentityPatchIsDuplicate,
  EDIT_PO_DUPLICATE_MESSAGE,
  type EditPOProductCatalogMeta,
  type EditPOProductVariant,
} from '../../utils/editPOProductIdentity';

let WebView: any;
try {
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

function getUploadsBaseUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/?$/, '');
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = (match && match[1]) ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = '/' + path;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

type ProductRow = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  term?: string;
  level?: string;
  class?: string;
  specs?: string;
  subject?: string;
  productCategory?: string;
  isNew?: boolean;
  /** Original order product fields preserved on save */
  _source?: Record<string, unknown>;
};

function normalizeProductName(name: string): string {
  return String(name || '').trim().toLowerCase();
}

function normalizeLevelKey(level: unknown): string {
  return String(level ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function isLevelOne(level: unknown): boolean {
  const k = normalizeLevelKey(level);
  return k === 'level1' || k === 'l1' || k.startsWith('level1');
}

function isLevelTwo(level: unknown): boolean {
  const k = normalizeLevelKey(level);
  return k === 'level2' || k === 'l2' || k.startsWith('level2');
}

function resolveRowTerm(p: { term?: string; level?: string }, hasLevel1: boolean): 'Term 1' | 'Term 2' {
  const t = String(p?.term ?? '').trim();
  if (t === 'Term 2') return 'Term 2';
  const collapsed = t.toLowerCase().replace(/[\s_-]+/g, '');
  if (collapsed === 'term2' || collapsed === 't2') return 'Term 2';
  // Level 2 only counts as Term 2 when Level 1 is also on the PO
  if (isLevelTwo(p.level) && hasLevel1) return 'Term 2';
  return 'Term 1';
}

type CatalogProduct = {
  productName: string;
  productLevels?: string[];
  hasSubjects?: boolean;
  subjects?: string[];
  hasSpecs?: boolean;
  specs?: string | string[];
  hasCategory?: boolean;
  categories?: string[];
};

function normalizeCatalogProduct(raw: any): CatalogProduct | null {
  const productName = String(
    raw?.productName || raw?.name || raw?.product || raw?.product_name || '',
  ).trim();
  if (!productName) return null;
  const specsRaw = raw?.specs;
  const specs = Array.isArray(specsRaw)
    ? specsRaw
    : typeof specsRaw === 'string' && specsRaw.trim()
      ? [specsRaw.trim()]
      : [];
  return {
    productName,
    productLevels: Array.isArray(raw?.productLevels) ? raw.productLevels : [],
    hasSubjects: raw?.hasSubjects === true,
    subjects: Array.isArray(raw?.subjects) ? raw.subjects : [],
    hasSpecs: raw?.hasSpecs === true,
    specs,
    hasCategory: raw?.hasCategory === true,
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
  };
}

/** Fixed column widths — header and body must use the same values */
const EDIT_PO_TABLE_COLUMNS = [
  { id: 'product', label: 'Product', width: 88 },
  { id: 'category', label: 'Category', width: 84 },
  { id: 'class', label: 'Class', width: 56 },
  { id: 'subject', label: 'Subject', width: 76 },
  { id: 'level', label: 'Level', width: 76 },
  { id: 'specs', label: 'Specs', width: 76 },
  { id: 'qty', label: 'Qty', width: 56, align: 'center' as const },
  { id: 'price', label: 'Unit Price', width: 76, align: 'right' as const },
  { id: 'total', label: 'Total', width: 68, align: 'right' as const },
  { id: 'action', label: '', width: 32 },
];
const EDIT_PO_TABLE_WIDTH = EDIT_PO_TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0);

function EditPOTableCell({
  width,
  align = 'left',
  children,
}: {
  width: number;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.editPoTableCell,
        { width },
        align === 'center' && styles.editPoTableCellCenter,
        align === 'right' && styles.editPoTableCellRight,
      ]}
    >
      {children}
    </View>
  );
}

export default function ClientEditPOScreen({ navigation, route }: any) {
  const orderId = route?.params?.orderId as string | undefined;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  /** Term 2 lines are edited in Term-Wise DC — hidden here but kept on save */
  const [term2Products, setTerm2Products] = useState<any[]>([]);
  const [originalProductNames, setOriginalProductNames] = useState<string[]>([]);
  const [originalEditRowIds, setOriginalEditRowIds] = useState<Set<string>>(new Set());
  const [originalEditRowPrices, setOriginalEditRowPrices] = useState<Record<string, number>>({});
  const [catalogProducts, setCatalogProducts] = useState<string[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<CatalogProduct[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [transport, setTransport] = useState({
    transport_name: '',
    transport_location: '',
    transportation_landmark: '',
    pincode: '',
  });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newPdfUrl, setNewPdfUrl] = useState('');
  const [changeRemarks, setChangeRemarks] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      loadOrder();
      loadCatalogProducts();
    }
  }, [orderId]);

  const loadCatalogProducts = async () => {
    try {
      let data: any;
      try {
        data = await apiService.get('/products/active');
      } catch {
        data = await apiService.get('/products');
      }
      const list = Array.isArray(data) ? data : data?.data || data?.products || [];
      const meta = list
        .filter((p: any) => p.prodStatus !== 0 && p.prodStatus !== false)
        .map(normalizeCatalogProduct)
        .filter(Boolean) as CatalogProduct[];
      setCatalogMeta(meta);
      setCatalogProducts([...new Set(meta.map((p) => p.productName))]);
    } catch {
      setCatalogProducts([]);
      setCatalogMeta([]);
    }
  };

  const findCatalogProduct = (productName: string) => {
    const key = String(productName || '').trim().toLowerCase();
    if (!key) return undefined;
    return catalogMeta.find((p) => p.productName.trim().toLowerCase() === key);
  };

  const getCatalogMeta = (productName: string): EditPOProductCatalogMeta | null => {
    const p = findCatalogProduct(productName);
    if (!p) return null;
    return {
      hasCategory: p.hasCategory,
      categories: p.categories,
      hasSubjects: p.hasSubjects,
      subjects: p.subjects,
      productLevels: p.productLevels,
      hasSpecs: p.hasSpecs,
      specs: p.specs,
    };
  };

  const getEditPOCategoryOptions = (productName: string) => {
    const p = findCatalogProduct(productName);
    if (!p?.hasCategory || !p.categories?.length) return [];
    return p.categories;
  };

  const getEditPOSubjectOptions = (productName: string) => {
    const p = findCatalogProduct(productName);
    if (!p?.hasSubjects || !p.subjects?.length) return [];
    return p.subjects;
  };

  const getEditPOLevelOptions = (productName: string) => {
    const p = findCatalogProduct(productName);
    if (!p?.productLevels?.length) return [];
    return p.productLevels;
  };

  const getEditPOSpecOptions = (productName: string) => {
    const p = findCatalogProduct(productName);
    if (!p?.hasSpecs || !Array.isArray(p.specs) || p.specs.length === 0) return [];
    return p.specs.map(String);
  };

  const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const data = await apiService.get(`/dc-orders/${orderId}`);
      setOrder(data);
      setTransport({
        transport_name: data.transport_name || data.pendingEdit?.transport_name || '',
        transport_location: data.transport_location || data.pendingEdit?.transport_location || '',
        transportation_landmark:
          data.transportation_landmark || data.pendingEdit?.transportation_landmark || '',
        pincode: data.pincode || data.pendingEdit?.pincode || '',
      });
      const rawProducts: any[] =
        data.products && Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : [{ product_name: 'Abacus', quantity: 1, unit_price: 0, term: 'Term 1' }];
      const hasLevel1 = rawProducts.some((p) => isLevelOne(p.level));
      const term1Rows: ProductRow[] = [];
      const term2Raw: any[] = [];
      rawProducts.forEach((p: any, idx: number) => {
        const term = resolveRowTerm(
          { term: p.term, level: p.level },
          hasLevel1,
        );
        if (term === 'Term 2') {
          term2Raw.push({
            ...(typeof p === 'object' ? p : {}),
            product_name: p.product_name || p.product || 'Abacus',
            quantity: Number(p.quantity) || 1,
            unit_price: Number(p.unit_price) || 0,
            level: p.level,
            term: 'Term 2',
          });
          return;
        }
        term1Rows.push({
          id: `existing_${idx}_${p.product_name || p.product || idx}`,
          product_name: p.product_name || p.product || 'Abacus',
          quantity: Number(p.quantity) || 1,
          unit_price: Number(p.unit_price) || 0,
          term: 'Term 1',
          level: p.level,
          class: p.class != null ? String(p.class) : undefined,
          specs: p.specs,
          subject: p.subject,
          productCategory: p.productCategory || p.category,
          isNew: false,
          _source: typeof p === 'object' ? { ...p } : undefined,
        });
      });
      setProducts(term1Rows);
      setTerm2Products(term2Raw);
      setOriginalEditRowIds(new Set(term1Rows.map((r) => r.id)));
      setOriginalEditRowPrices(
        Object.fromEntries(term1Rows.map((r) => [r.id, r.unit_price])),
      );
      setOriginalProductNames(
        rawProducts.map((p) => normalizeProductName(p.product_name || p.product)).filter(Boolean),
      );
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load order');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Current PO: primary from order; fallback to old PDF when there's a pending/rejected change request
  const currentPdfUrl =
    (order?.pod_proof_url && String(order.pod_proof_url).trim()) ||
    (order?.poDocument && String(order.poDocument).trim()) ||
    (order?.poChangeRequest?.oldPdfUrl && String(order.poChangeRequest.oldPdfUrl).trim()) ||
    '';
  const resolvedPdfUrl = buildPdfUrl(currentPdfUrl || undefined);
  const poChange = order?.poChangeRequest;

  const openPdf = (url: string | null) => {
    if (!url) {
      Alert.alert('No document', 'Current PO PDF is not available.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open document'));
  };

  const pickNewPdfForChange = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 5MB');
          return;
        }
        const formData = new FormData();
        formData.append('poPhoto', { uri: file.uri, type: 'application/pdf', name: file.name || 'po.pdf' } as any);
        const res = await apiService.upload('/dc/upload-po', formData);
        setNewPdfUrl(res.poPhotoUrl || res.url || '');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload PDF');
    }
  };

  const submitPoChangeRequest = async () => {
    if (!orderId || !newPdfUrl.trim()) {
      Alert.alert('Required', 'Please upload the new PO PDF first.');
      return;
    }
    setSubmittingChange(true);
    try {
      await apiService.post(`/dc-orders/${orderId}/request-po-change`, {
        pod_proof_url: newPdfUrl.trim(),
        remarks: changeRemarks.trim() || undefined,
      });
      setShowRequestModal(false);
      setNewPdfUrl('');
      setChangeRemarks('');
      await loadOrder();
      Alert.alert('Submitted', 'PO change request sent. Request DC will be enabled after Manager approval.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request');
    } finally {
      setSubmittingChange(false);
    }
  };

  const updateProduct = (index: number, field: 'quantity' | 'unit_price', value: number) => {
    const row = products[index];
    if (
      field === 'unit_price' &&
      (!row?.isNew || originalEditRowIds.has(row.id))
    ) {
      return;
    }
    const next = [...products];
    if (field === 'quantity') {
      next[index] = { ...next[index], quantity: value, strength: value };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setProducts(next);
  };

  const updateProductField = (
    index: number,
    field: 'productCategory' | 'class' | 'subject' | 'level' | 'specs',
    value: string,
  ) => {
    const next = [...products];
    const candidate = { ...next[index], [field]: value };
    if (
      (field === 'productCategory' ||
        field === 'subject' ||
        field === 'level' ||
        field === 'specs') &&
      editPORowIdentityPatchIsDuplicate(next, candidate, getCatalogMeta, next[index]?.id)
    ) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    next[index] = candidate;
    setProducts(next);
  };

  const buildNewProductRow = (name: string, variant: EditPOProductVariant = {}): ProductRow => {
    const catOptions = getEditPOCategoryOptions(name);
    const specOptions = getEditPOSpecOptions(name);
    const subjectOptions = getEditPOSubjectOptions(name);
    const levelOptions = getEditPOLevelOptions(name);
    const level = variant.level ?? levelOptions[0];
    return {
      id: `new_${Date.now()}_${name}`,
      product_name: name,
      quantity: 1,
      unit_price: 0,
      term: 'Term 1',
      class: '1',
      productCategory: variant.productCategory ?? catOptions[0],
      subject: variant.subject ?? subjectOptions[0],
      level,
      specs: variant.specs ?? specOptions[0],
      isNew: true,
    };
  };

  const addCatalogProduct = (name: string) => {
    const variant = pickUnusedEditPOVariant(
      name,
      getCatalogMeta(name),
      products,
      getCatalogMeta,
    );
    if (variant === null) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    const newRow = buildNewProductRow(name, variant);
    if (findDuplicateEditPORowIndex(products, newRow, getCatalogMeta) >= 0) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    setProducts((prev) => [...prev, newRow]);
    setShowAddProductModal(false);
  };

  const editPORowNeedsApproval = (row: { id: string; isNew?: boolean }) =>
    row.isNew === true || !originalEditRowIds.has(row.id);

  const hasNewProducts = products.some(editPORowNeedsApproval);

  const removeProduct = (index: number) => {
    const row = products[index];
    if (!row?.isNew && originalProductNames.includes(normalizeProductName(row.product_name))) {
      showAlert('Not allowed', 'Original PO products cannot be removed here.');
      return;
    }
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!orderId) return;
    if (order?.pendingEdit?.status === 'pending') {
      showAlert('Pending', 'There is already a PO edit request waiting for manager approval.');
      return;
    }
    const transport_name = (transport.transport_name || '').trim();
    const transport_location = (transport.transport_location || '').trim();
    const transportation_landmark = (transport.transportation_landmark || '').trim();
    const pincode = (transport.pincode || '').trim();
    if (!transport_name || !transport_location || !transportation_landmark || !pincode) {
      showAlert(
        'Required',
        'All Transport Details fields are mandatory: Transport Name, Transport Location, Transportation Landmark, and Pincode.',
      );
      return;
    }
    const invalid = products.filter(
      (p) =>
        p.product_name?.trim() &&
        ((Number(p.quantity) || 0) <= 0 || (Number(p.unit_price) || 0) <= 0),
    );
    if (invalid.length > 0) {
      showAlert('Required', 'Each product must have quantity and unit price greater than 0.');
      return;
    }

    const term1Payload = products
      .filter((p) => p.product_name?.trim())
      .map((p) => {
        const src = p._source || {};
        const priceEditable = p.isNew === true && !originalEditRowIds.has(p.id);
        const unit_price = priceEditable
          ? Number(p.unit_price) || 0
          : Number(originalEditRowPrices[p.id] ?? p.unit_price) || 0;
        return {
          ...src,
          product_name: p.product_name.trim(),
          quantity: Number(p.quantity) || 0,
          unit_price,
          strength: Number(p.quantity) || 0,
          class: p.class || (src as any).class,
          level: p.level || (src as any).level,
          specs: p.specs || (src as any).specs,
          subject: p.subject || (src as any).subject,
          productCategory: p.productCategory || (src as any).productCategory,
          term: 'Term 1',
        };
      });
    // Keep Term 2 lines on the order (managed via Term-Wise DC, not this screen)
    const term2Payload = term2Products.map((p) => ({
      ...p,
      product_name: p.product_name || p.product || 'Abacus',
      quantity: Number(p.quantity) || 0,
      unit_price: Number(p.unit_price) || 0,
      term: 'Term 2',
    }));
    const productsPayload = [...term1Payload, ...term2Payload];
    const total_amount = productsPayload.reduce(
      (s, p) => s + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
      0,
    );
    const payload = {
      school_name: order?.school_name || '',
      contact_person: order?.contact_person || '',
      contact_mobile: order?.contact_mobile || '',
      contact_person2: order?.contact_person2 || '',
      contact_mobile2: order?.contact_mobile2 || '',
      email: order?.email || '',
      address: order?.address || '',
      school_type: order?.school_type || '',
      zone: order?.zone || '',
      location: order?.location || '',
      remarks: order?.remarks || '',
      products: productsPayload,
      total_amount,
      transport_name,
      transport_location,
      transportation_landmark,
      pincode,
      pod_proof_url: order?.pod_proof_url || '',
    };

    setSaving(true);
    try {
      if (hasNewProducts) {
        // New products require Executive Manager approval (PO Edit Request)
        await apiService.post(`/dc-orders/${orderId}/submit-edit`, payload);
        showAlert('Sent to executive manager for approval');
      } else {
        await apiService.put(`/dc-orders/${orderId}`, {
          products: productsPayload,
          total_amount,
          transport_name,
          transport_location,
          transportation_landmark,
          pincode,
        });
        const dcId = route?.params?.dcId as string | undefined;
        if (dcId) {
          try {
            await apiService.put(`/dc/${dcId}`, {
              productDetails: productsPayload.map((p) => ({
                product: p.product_name,
                quantity: p.quantity,
                strength: p.quantity,
                unit_price: p.unit_price,
                price: p.unit_price,
                term: p.term || 'Term 1',
              })),
              status: 'po_submitted',
            });
          } catch {
            /* optional sync */
          }
        }
        showAlert('PO submitted');
      }
      if (!navigateRoot('DCClient')) {
        navigation.navigate('DCClient');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!order) return null;

  // IN DC Flow = DC already requested (status !== 'saved'). PO change not allowed; show message only.
  const isInDcFlow = order.status != null && order.status !== 'saved';
  if (isInDcFlow) {
    return (
    <ScreenShell
      title="Edit PO"
      loading={loading}
    >
<View style={styles.dcFlowBlock}>
          <Text style={styles.dcFlowBlockMessage}>
            PO can only be changed before requesting DC. This client is already in the DC process.
          </Text>
          <TouchableOpacity style={styles.dcFlowBlockButton} onPress={() => navigation.goBack()}>
            <Text style={styles.dcFlowBlockButtonText}>Back to My Clients</Text>
          </TouchableOpacity>
        </View>
    </ScreenShell>
  );
  }

  const grandTotal = products.reduce((s, p) => {
    const priceEditable = p.isNew === true && !originalEditRowIds.has(p.id);
    const unitPrice = priceEditable
      ? Number(p.unit_price) || 0
      : Number(originalEditRowPrices[p.id] ?? p.unit_price) || 0;
    return s + (Number(p.quantity) || 0) * unitPrice;
  }, 0);

  return (
    <ScreenShell title={`Edit PO - ${order.school_name || 'Client'}`}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >

        {/* Current PO PDF card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current PO PDF</Text>
          {(currentPdfUrl && resolvedPdfUrl) ? (
            <View style={styles.poCard}>
              <Text style={styles.poCardLabel}>PO document attached</Text>
              <View style={styles.poCardActions}>
                <TouchableOpacity style={styles.poCardButton} onPress={() => openPdf(resolvedPdfUrl)}>
                  <Text style={styles.poCardButtonText}>View / Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.poCardButton} onPress={() => setPreviewPdfUrl(resolvedPdfUrl)}>
                  <Text style={styles.poCardButtonText}>Preview in app</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.hint}>No PO PDF uploaded yet.</Text>
          )}
        </View>

        {/* PO Change request status */}
        {poChange && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PO Change Request</Text>
            <View style={[styles.badge, poChange.status === 'PENDING_MANAGER_APPROVAL' && styles.badgePending, poChange.status === 'APPROVED' && styles.badgeSuccess, poChange.status === 'REJECTED' && styles.badgeRejected]}>
              <Text style={styles.badgeText}>
                {poChange.status === 'PENDING_MANAGER_APPROVAL' && 'Pending Manager Approval'}
                {poChange.status === 'APPROVED' && 'Approved'}
                {poChange.status === 'REJECTED' && 'Rejected'}
              </Text>
            </View>
            {poChange.requestedAt && (
              <Text style={styles.metaText}>Requested at {new Date(poChange.requestedAt).toLocaleString()}</Text>
            )}
            {(poChange.status === 'APPROVED' || poChange.status === 'REJECTED') && (poChange.managerRemarks || poChange.rejectionReason) && (
              <View style={styles.managerRemarksBox}>
                <Text style={styles.managerRemarksLabel}>Manager remarks</Text>
                <Text style={styles.managerRemarksText}>{poChange.managerRemarks || poChange.rejectionReason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Request PO Change button - only when no pending request */}
        {(!poChange || poChange.status !== 'PENDING_MANAGER_APPROVAL') && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.requestChangeButton} onPress={() => setShowRequestModal(true)}>
              <Text style={styles.requestChangeButtonText}>Request PO Change</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Upload a new PDF and add optional remarks. Manager approval required before you can Request DC.</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transport Details</Text>
          <Text style={styles.hint}>All fields are mandatory before you can Request DC.</Text>
          <Text style={styles.label}>Transport Name *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.transport_name}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, transport_name: t }))}
            placeholder="Transport name"
          />
          <Text style={styles.label}>Transport Location *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.transport_location}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, transport_location: t }))}
            placeholder="Transport location"
          />
          <Text style={styles.label}>Transportation Landmark *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.transportation_landmark}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, transportation_landmark: t }))}
            placeholder="Landmark"
          />
          <Text style={styles.label}>Pincode *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.pincode}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, pincode: t }))}
            placeholder="Pincode"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.productsHeaderRow}>
            <Text style={styles.sectionTitle}>Products Interested</Text>
            <TouchableOpacity
              style={styles.addProductBtn}
              onPress={() => setShowAddProductModal(true)}
            >
              <Text style={styles.addProductBtnText}>+ Add Product</Text>
            </TouchableOpacity>
          </View>
          {term2Products.length > 0 ? (
            <Text style={styles.hint}>
              {term2Products.length} Term 2 product
              {term2Products.length === 1 ? '' : 's'} hidden here — manage in Term-Wise DC.
            </Text>
          ) : null}
          {hasNewProducts ? (
            <Text style={styles.hint}>
              New products require Executive Manager approval (PO Edit Request) when you save.
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
            <View style={{ width: EDIT_PO_TABLE_WIDTH }}>
              <View style={[styles.tableHeader, { width: EDIT_PO_TABLE_WIDTH }]}>
                {EDIT_PO_TABLE_COLUMNS.map((col) => (
                  <EditPOTableCell key={col.id} width={col.width} align={col.align}>
                    <Text style={styles.th} numberOfLines={1}>
                      {col.label}
                    </Text>
                  </EditPOTableCell>
                ))}
              </View>
              {products.map((p, idx) => {
                const catOptions = getEditPOCategoryOptions(p.product_name);
                const subjectOptions = getEditPOSubjectOptions(p.product_name);
                const levelOptions = getEditPOLevelOptions(p.product_name);
                const specOptions = getEditPOSpecOptions(p.product_name);
                const lockedUnitPrice = Number(originalEditRowPrices[p.id] ?? p.unit_price) || 0;
                const priceEditable = p.isNew === true && !originalEditRowIds.has(p.id);
                const displayUnitPrice = priceEditable ? Number(p.unit_price) || 0 : lockedUnitPrice;
                const lineTotal = (p.quantity || 0) * displayUnitPrice;
                const canRemove =
                  !!p.isNew || !originalProductNames.includes(normalizeProductName(p.product_name));

                const renderMetaCell = (
                  width: number,
                  options: string[],
                  value: string | undefined,
                  onChange: (v: string) => void,
                ) => (
                  <EditPOTableCell width={width}>
                    {options.length > 0 ? (
                      <WebSelect
                        compact
                        value={value || options[0]}
                        onValueChange={onChange}
                        items={options.map((o) => ({ label: o, value: o }))}
                      />
                    ) : (
                      <Text style={styles.emptyMeta}>-</Text>
                    )}
                  </EditPOTableCell>
                );

                return (
                  <View key={p.id} style={[styles.productRowWide, { width: EDIT_PO_TABLE_WIDTH }]}>
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[0].width}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {p.product_name}
                      </Text>
                      {canRemove ? <Text style={styles.newBadge}>New</Text> : null}
                    </EditPOTableCell>
                    {renderMetaCell(
                      EDIT_PO_TABLE_COLUMNS[1].width,
                      catOptions,
                      p.productCategory,
                      (v) => updateProductField(idx, 'productCategory', v),
                    )}
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[2].width}>
                      {p.isNew || p.class ? (
                        <WebSelect
                          compact
                          value={p.class || CLASS_OPTIONS[0]}
                          onValueChange={(v) => updateProductField(idx, 'class', v)}
                          items={CLASS_OPTIONS.map((c) => ({ label: c, value: c }))}
                        />
                      ) : (
                        <Text style={styles.emptyMeta}>-</Text>
                      )}
                    </EditPOTableCell>
                    {renderMetaCell(
                      EDIT_PO_TABLE_COLUMNS[3].width,
                      subjectOptions,
                      p.subject,
                      (v) => updateProductField(idx, 'subject', v),
                    )}
                    {renderMetaCell(
                      EDIT_PO_TABLE_COLUMNS[4].width,
                      levelOptions,
                      p.level,
                      (v) => updateProductField(idx, 'level', v),
                    )}
                    {renderMetaCell(
                      EDIT_PO_TABLE_COLUMNS[5].width,
                      specOptions,
                      p.specs,
                      (v) => updateProductField(idx, 'specs', v),
                    )}
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[6].width} align="center">
                      <WebInput
                        style={[styles.tableInput, styles.qtyInput]}
                        value={String(p.quantity)}
                        onChangeText={(t) => {
                          const n = t.replace(/[^\d]/g, '');
                          updateProduct(idx, 'quantity', n === '' ? 0 : parseInt(n, 10));
                        }}
                        keyboardType="number-pad"
                        placeholder="Qty"
                        editable
                        selectTextOnFocus
                      />
                    </EditPOTableCell>
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[7].width} align="right">
                      {priceEditable ? (
                        <WebInput
                          style={styles.tableInput}
                          value={String(p.unit_price)}
                          onChangeText={(t) => updateProduct(idx, 'unit_price', parseFloat(t) || 0)}
                          keyboardType="decimal-pad"
                          placeholder="Price"
                        />
                      ) : (
                        <Text style={styles.tablePriceLocked}>{lockedUnitPrice.toFixed(2)}</Text>
                      )}
                    </EditPOTableCell>
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[8].width} align="right">
                      <Text style={styles.lineTotal}>{lineTotal.toFixed(2)}</Text>
                    </EditPOTableCell>
                    <EditPOTableCell width={EDIT_PO_TABLE_COLUMNS[9].width} align="center">
                      {canRemove ? (
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(idx)}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.removeBtnPlaceholder} />
                      )}
                    </EditPOTableCell>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <Text style={styles.grandTotal}>Grand Total: ₹{grandTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.textLight} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Request PO Change modal */}
      <Modal visible={showRequestModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request PO Change</Text>
              <TouchableOpacity onPress={() => { setShowRequestModal(false); setNewPdfUrl(''); setChangeRemarks(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.hint}>Upload the new PO PDF. Manager must approve before the change is applied and you can Request DC.</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickNewPdfForChange}>
                <Text style={styles.uploadButtonText}>{newPdfUrl ? 'New PDF selected' : 'Choose new PDF'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Remarks (optional)</Text>
              <WebInput
                style={styles.remarksInput}
                value={changeRemarks}
                onChangeText={setChangeRemarks}
                placeholder="Reason for change"
                multiline
                numberOfLines={3}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonSubmit, submittingChange && styles.buttonDisabled]} onPress={submitPoChangeRequest} disabled={submittingChange}>
                {submittingChange ? <ActivityIndicator size="small" color={colors.textLight} /> : <Text style={styles.modalButtonTextSubmit}>Submit request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product modal — catalog products not already on the original PO */}
      <Modal visible={showAddProductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => setShowAddProductModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.hint}>
                Select a product from the catalog. Products not on the original PO need manager
                approval when you save.
              </Text>
              {catalogProducts.length === 0 ? (
                <Text style={styles.hint}>No products available in the catalog.</Text>
              ) : (
                catalogProducts.map((name) => {
                  const isOriginal = originalProductNames.includes(normalizeProductName(name));
                  const nextVariant = pickUnusedEditPOVariant(
                    name,
                    getCatalogMeta(name),
                    products,
                    getCatalogMeta,
                  );
                  const nextHint = nextVariant ? formatEditPOVariantHint(nextVariant) : '';
                  const alreadyInList = products.some(
                    (p) => normalizeProductName(p.product_name) === normalizeProductName(name),
                  );
                  const canAdd = canAddAnotherEditPOVariant(
                    name,
                    getCatalogMeta(name),
                    products,
                    getCatalogMeta,
                  );
                  return (
                    <View key={name} style={styles.catalogRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogName}>{name}</Text>
                        {isOriginal ? (
                          <Text style={styles.catalogMeta}>On original PO</Text>
                        ) : (
                          <Text style={styles.catalogMetaNew}>New — needs approval</Text>
                        )}
                        {alreadyInList && nextHint ? (
                          <Text style={styles.catalogMetaNext}>Next: {nextHint}</Text>
                        ) : null}
                        {alreadyInList && !canAdd ? (
                          <Text style={styles.catalogMetaWarn}>All variants already added</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={[styles.catalogAddBtn, !canAdd && styles.catalogAddBtnDisabled]}
                        onPress={() => addCatalogProduct(name)}
                        disabled={!canAdd}
                      >
                        <Text style={styles.catalogAddBtnText}>
                          {alreadyInList ? 'Add variant' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowAddProductModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PDF Preview modal */}
      <Modal visible={!!previewPdfUrl} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PO Preview</Text>
              <TouchableOpacity onPress={() => setPreviewPdfUrl(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {previewPdfUrl && WebView ? (
              <WebView source={{ uri: previewPdfUrl }} style={styles.webview} />
            ) : previewPdfUrl ? (
              <TouchableOpacity style={styles.poCardButton} onPress={() => openPdf(previewPdfUrl)}>
                <Text style={styles.poCardButtonText}>Open in browser</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  dcFlowBlock: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  dcFlowBlockMessage: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  dcFlowBlockButton: { paddingVertical: 14, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: 12 },
  dcFlowBlockButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editPoTableCell: {
    paddingHorizontal: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editPoTableCellCenter: { alignItems: 'center' },
  editPoTableCellRight: { alignItems: 'flex-end' },
  th: { ...typography.label.small, fontWeight: '600', color: colors.textSecondary, fontSize: 11 },
  tableInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.backgroundLight,
  },
  tablePriceLocked: {
    width: '100%',
    textAlign: 'right',
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  colName: { flex: 1 },
  colQty: { width: 56 },
  colPrice: { width: 72 },
  colTotal: { width: 64, textAlign: 'right' },
  lineTotal: { fontSize: 12, fontWeight: '600', textAlign: 'right', color: colors.textPrimary },
  grandTotal: { ...typography.heading.h4, color: colors.primary, marginTop: 12, fontWeight: '700' },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  productsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addProductBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  addProductBtnText: { ...typography.body.small, color: colors.textLight, fontWeight: '700' },
  productNameCol: { flex: 1, marginRight: 4 },
  newBadge: {
    ...typography.label.small,
    color: colors.warning,
    fontWeight: '700',
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnPlaceholder: { width: 28 },
  removeBtnText: { color: colors.error, fontSize: 16, fontWeight: '700' },
  colAction: { width: 28 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  catalogName: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  catalogMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 2 },
  catalogMetaNew: { ...typography.body.small, color: colors.warning, marginTop: 2, fontWeight: '600' },
  catalogMetaNext: { ...typography.body.small, color: colors.success, marginTop: 2 },
  catalogMetaWarn: { ...typography.body.small, color: colors.warning, marginTop: 2 },
  catalogAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  catalogAddBtnText: { ...typography.body.small, color: colors.primary, fontWeight: '700' },
  catalogAddBtnDisabled: { opacity: 0.45 },
  poCard: { backgroundColor: colors.backgroundDark, borderRadius: 12, padding: 16, marginBottom: 8 },
  poCardLabel: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  poCardActions: { flexDirection: 'row', gap: 12 },
  poCardButton: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 8 },
  poCardButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  badgePending: { backgroundColor: colors.warning + '25' },
  badgeSuccess: { backgroundColor: colors.success + '25' },
  badgeRejected: { backgroundColor: colors.error + '25' },
  badgeText: { ...typography.body.small, fontWeight: '600', color: colors.textPrimary },
  metaText: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  rejectionText: { ...typography.body.small, color: colors.error, marginTop: 4 },
  managerRemarksBox: { marginTop: 12, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 10 },
  managerRemarksLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 6 },
  managerRemarksText: { ...typography.body.medium, color: colors.textPrimary },
  requestChangeButton: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8 },
  requestChangeButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  productRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colNameWide: { width: 88 },
  colMeta: { width: 76 },
  metaCell: { ...typography.body.small, color: colors.textSecondary, fontSize: 11 },
  emptyMeta: { fontSize: 12, color: colors.textMuted, textAlign: 'center', width: '100%' },
  qtyInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
  },
  priceLocked: {
    backgroundColor: colors.background,
    textAlign: 'right',
    paddingVertical: 10,
    color: colors.textSecondary,
  },
  inputReadOnly: { backgroundColor: colors.background, opacity: 0.85 },
  productName: { ...typography.body.medium, color: colors.textPrimary, fontSize: 13 },
  uploadButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.backgroundDark, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 },
  uploadButtonText: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  remarksInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, ...typography.body.medium, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  saveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  saveButtonText: { ...typography.heading.h4, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20 },
  modalButtonCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  modalButtonSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  modalButtonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  previewModalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, flex: 1, maxHeight: '90%' },
  webview: { flex: 1, minHeight: 400 },
});
