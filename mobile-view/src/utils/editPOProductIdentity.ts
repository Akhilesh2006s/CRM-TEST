/**
 * Edit PO duplicate detection (mobile copy).
 * Keep in sync with ../../lib/editPOProductIdentity.ts
 */

export type EditPOProductCatalogMeta = {
  hasCategory?: boolean;
  categories?: string[];
  hasSubjects?: boolean;
  subjects?: string[];
  productLevels?: string[];
  hasSpecs?: boolean;
  specs?: string | string[];
};

export type EditPOIdentityField = 'productCategory' | 'subject' | 'level' | 'specs';

export type EditPOProductVariant = Partial<
  Record<EditPOIdentityField, string | undefined>
>;

function normKeyPart(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeSpecsList(specs?: string | string[]): string[] {
  if (Array.isArray(specs)) return specs.map((s) => String(s).trim()).filter(Boolean);
  if (typeof specs === 'string' && specs.trim()) return [specs.trim()];
  return [];
}

export function getEditPOIdentityFields(
  catalog?: EditPOProductCatalogMeta | null,
): EditPOIdentityField[] {
  const fields: EditPOIdentityField[] = [];
  if (catalog?.hasCategory && Array.isArray(catalog.categories) && catalog.categories.length > 0) {
    fields.push('productCategory');
  }
  if (catalog?.hasSubjects && Array.isArray(catalog.subjects) && catalog.subjects.length > 0) {
    fields.push('subject');
  }
  if (Array.isArray(catalog?.productLevels) && catalog!.productLevels!.length > 0) {
    fields.push('level');
  }
  const specList = normalizeSpecsList(catalog?.specs);
  if (catalog?.hasSpecs && specList.length > 0) {
    fields.push('specs');
  }
  return fields;
}

function identityFieldValue(row: Record<string, any>, field: EditPOIdentityField): string {
  switch (field) {
    case 'productCategory':
      return normKeyPart(row.productCategory ?? row.category);
    case 'subject':
      return normKeyPart(row.subject);
    case 'level':
      return normKeyPart(row.level);
    case 'specs':
      return normKeyPart(row.specs);
    default:
      return '';
  }
}

function optionsForIdentityField(
  field: EditPOIdentityField,
  catalog?: EditPOProductCatalogMeta | null,
): string[] {
  if (!catalog) return [];
  switch (field) {
    case 'productCategory':
      return Array.isArray(catalog.categories) ? catalog.categories : [];
    case 'subject':
      return Array.isArray(catalog.subjects) ? catalog.subjects : [];
    case 'level':
      return Array.isArray(catalog.productLevels) ? catalog.productLevels : [];
    case 'specs':
      return normalizeSpecsList(catalog.specs);
    default:
      return [];
  }
}

function cartesianCombinations(lists: string[][]): string[][] {
  if (lists.length === 0) return [[]];
  return lists.reduce<string[][]>(
    (acc, list) => {
      if (list.length === 0) return acc;
      const next: string[][] = [];
      for (const prefix of acc) {
        for (const item of list) {
          next.push([...prefix, item]);
        }
      }
      return next;
    },
    [[]],
  );
}

function rowMatchesProduct(row: Record<string, any>, productKey: string): boolean {
  return normKeyPart(row.product_name || row.product || row.productName) === productKey;
}

export function editPOProductLineKey(
  row: Record<string, any>,
  getCatalogMeta?: (productName: string) => EditPOProductCatalogMeta | null | undefined,
): string {
  const productName = String(row.product_name || row.product || row.productName || '').trim();
  const product = normKeyPart(productName);
  const catalog = getCatalogMeta?.(productName);
  const fields = getEditPOIdentityFields(catalog);
  if (fields.length === 0) return product;
  return [product, ...fields.map((f) => identityFieldValue(row, f))].join('|');
}

export function findDuplicateEditPORowIndex(
  rows: Record<string, any>[],
  candidate: Record<string, any>,
  getCatalogMeta?: (productName: string) => EditPOProductCatalogMeta | null | undefined,
  excludeId?: string,
): number {
  const key = editPOProductLineKey(candidate, getCatalogMeta);
  return rows.findIndex(
    (r) =>
      (excludeId == null || r.id !== excludeId) &&
      editPOProductLineKey(r, getCatalogMeta) === key,
  );
}

export const EDIT_PO_DUPLICATE_MESSAGE =
  'Already existing, try to change the quantity';

export function formatEditPOVariantHint(variant: EditPOProductVariant): string {
  return [variant.productCategory, variant.subject, variant.level, variant.specs]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export function pickUnusedEditPOVariant(
  productName: string,
  catalog: EditPOProductCatalogMeta | null | undefined,
  existingRows: Record<string, any>[],
  getCatalogMeta?: (productName: string) => EditPOProductCatalogMeta | null | undefined,
): EditPOProductVariant | null {
  const productKey = normKeyPart(productName);
  const siblingRows = existingRows.filter((r) => rowMatchesProduct(r, productKey));
  const fields = getEditPOIdentityFields(catalog);

  if (fields.length === 0) {
    return siblingRows.length > 0 ? null : {};
  }

  const optionLists = fields.map((f) => optionsForIdentityField(f, catalog));
  if (optionLists.some((list) => list.length === 0)) return null;

  const usedKeys = new Set(siblingRows.map((r) => editPOProductLineKey(r, getCatalogMeta)));

  for (const combo of cartesianCombinations(optionLists)) {
    const candidate: Record<string, any> = { product_name: productName };
    fields.forEach((field, idx) => {
      candidate[field] = combo[idx];
    });
    const key = editPOProductLineKey(candidate, getCatalogMeta);
    if (!usedKeys.has(key)) {
      const variant: EditPOProductVariant = {};
      fields.forEach((field, idx) => {
        variant[field] = combo[idx];
      });
      return variant;
    }
  }

  return null;
}

export function canAddAnotherEditPOVariant(
  productName: string,
  catalog: EditPOProductCatalogMeta | null | undefined,
  existingRows: Record<string, any>[],
  getCatalogMeta?: (productName: string) => EditPOProductCatalogMeta | null | undefined,
): boolean {
  return pickUnusedEditPOVariant(productName, catalog, existingRows, getCatalogMeta) !== null;
}

export function editPORowIdentityPatchIsDuplicate(
  rows: Record<string, any>[],
  candidate: Record<string, any>,
  getCatalogMeta?: (productName: string) => EditPOProductCatalogMeta | null | undefined,
  excludeId?: string,
): boolean {
  return findDuplicateEditPORowIndex(rows, candidate, getCatalogMeta, excludeId) >= 0;
}
