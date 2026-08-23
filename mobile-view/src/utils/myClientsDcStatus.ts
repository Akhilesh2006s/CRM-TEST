/** Resolve My Clients DC badge status from DC row + linked DcOrder fields. */
export function resolveMyClientsDcStatus(dc: {
  status?: string;
  poPhotoUrl?: string;
  poDocument?: string;
  productDetails?: Array<{ quantity?: number; strength?: number; price?: number; unit_price?: number }>;
  dcOrderId?: {
    status?: string;
    pendingEdit?: { status?: string };
    products?: Array<{ quantity?: number; unit_price?: number }>;
    pod_proof_url?: string;
    transport_name?: string;
    transport_location?: string;
    pincode?: string;
  } | string | null;
} | null | undefined): string {
  if (!dc) return 'created';
  const order =
    dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null
      ? dc.dcOrderId
      : null;
  const pe = order?.pendingEdit;
  const orderStatus = String(order?.status || '').trim();
  const raw = String(dc.status || 'created').trim() || 'created';

  if (orderStatus === 'dc_requested') return 'dc_requested';
  if (pe?.status === 'pending') return 'sent_to_manager';
  if (pe?.status === 'approved') {
    if (raw === 'created' || raw === 'sent_to_manager') return 'po_submitted';
  }

  const hasPo = !!(dc.poPhotoUrl || dc.poDocument || order?.pod_proof_url);
  const orderProducts = Array.isArray(order?.products) ? order.products : [];
  const detailLines = Array.isArray(dc.productDetails) ? dc.productDetails : [];
  const hasPricedLines =
    orderProducts.some(
      (p) => (Number(p?.quantity) || 0) > 0 && (Number(p?.unit_price) || 0) > 0,
    ) ||
    detailLines.some(
      (p) =>
        (Number(p?.quantity) || Number(p?.strength) || 0) > 0 &&
        (Number(p?.price) || Number(p?.unit_price) || 0) > 0,
    );
  const hasTransport =
    !!String(order?.transport_name || '').trim() &&
    !!String(order?.transport_location || '').trim() &&
    !!String(order?.pincode || '').trim();

  if ((raw === 'created' || raw === 'sent_to_manager') && hasPo && hasPricedLines && hasTransport) {
    return 'po_submitted';
  }

  return raw;
}
