function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function pickField(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}

type TransportSource = {
  transport_name?: string;
  transport_location?: string;
  transportation_landmark?: string;
  pincode?: string;
  pendingEdit?: {
    transport_name?: string;
    transport_location?: string;
    transportation_landmark?: string;
    pincode?: string;
    status?: string;
  };
  dcOrderId?: TransportSource | string | null;
};

function resolveOrder(source: TransportSource | null | undefined): TransportSource | null {
  if (!source) return null;
  if (source.dcOrderId && typeof source.dcOrderId === 'object') {
    return { ...source, ...source.dcOrderId };
  }
  return source;
}

/** All Transport Details fields must be filled (after Edit PO) before Request DC. */
export function isTransportComplete(source: TransportSource | null | undefined): boolean {
  const order = resolveOrder(source);
  const pe = order?.pendingEdit || null;
  const transport_name = pickField(pe?.transport_name, order?.transport_name);
  const transport_location = pickField(pe?.transport_location, order?.transport_location);
  const transportation_landmark = pickField(
    pe?.transportation_landmark,
    order?.transportation_landmark,
  );
  const pincode = pickField(pe?.pincode, order?.pincode);
  return (
    nonEmpty(transport_name) &&
    nonEmpty(transport_location) &&
    nonEmpty(transportation_landmark) &&
    nonEmpty(pincode)
  );
}

export const TRANSPORT_REQUIRED_MESSAGE = 'Add transport details in Edit PO first.';
