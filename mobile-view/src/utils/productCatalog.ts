/** Product catalog helpers — aligned with Products admin & Close Lead flows. */

export type RaiseDcProductRowSource = {
  product?: string;
  product_name?: string;
  productName?: string;
  class?: string | number;
  category?: string;
  productCategory?: string;
  specs?: string;
  subject?: string;
  level?: string;
  term?: string;
  strength?: number;
  quantity?: number;
};

export function findCatalogProduct(catalog: any[], productName: string) {
  const key = String(productName || '').trim().toLowerCase();
  if (!key) return undefined;
  return catalog.find(
    (p) =>
      String(p.productName || p.name || p.product || '')
        .trim()
        .toLowerCase() === key,
  );
}

export function getCatalogProductNames(catalog: any[]): string[] {
  return catalog
    .map((p) => p.productName || p.name || p.product)
    .filter(Boolean);
}

export function getProductLevelsOptions(catalog: any[], productName: string): string[] {
  const product = findCatalogProduct(catalog, productName);
  if (Array.isArray(product?.productLevels) && product.productLevels.length > 0) {
    return product.productLevels.map((l: any) => String(l).trim()).filter(Boolean);
  }
  return [];
}

export function getProductSpecsOptions(catalog: any[], productName: string): string[] {
  const product = findCatalogProduct(catalog, productName);
  if (!product?.hasSpecs) return [];
  if (Array.isArray(product.specs) && product.specs.length > 0) {
    return product.specs.map((s: any) => String(s).trim()).filter(Boolean);
  }
  if (typeof product.specs === 'string' && product.specs.trim()) {
    return [product.specs.trim()];
  }
  return [];
}

export function getProductSubjectsOptions(catalog: any[], productName: string): string[] {
  const product = findCatalogProduct(catalog, productName);
  if (!product?.hasSubjects) return [];
  if (Array.isArray(product.subjects) && product.subjects.length > 0) {
    return product.subjects.map((s: any) => String(s).trim()).filter(Boolean);
  }
  return [];
}

export function getProductCategoryOptions(catalog: any[], productName: string): string[] {
  const product = findCatalogProduct(catalog, productName);
  if (!product?.hasCategory) return [];
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories.map((c: any) => String(c).trim()).filter(Boolean);
  }
  return [];
}

export function matchCatalogOption(value: string | undefined, options: string[]): string {
  const v = String(value || '').trim();
  if (!v || options.length === 0) return '';
  if (options.includes(v)) return v;
  return options.find((o) => o.toLowerCase() === v.toLowerCase()) || '';
}

export function normalizeStudentCategory(raw: any, fallback: string, categoryOptions: string[]) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return fallback;
  if (v === 'New Students') return 'new Students';
  if (v === 'Existing Students') return 'Old Students';
  if (v === 'Both') return 'NA';
  if (v === 'New School') return 'new Students';
  if (v === 'Existing School') return 'Old Students';
  return categoryOptions.includes(v) ? v : fallback;
}

export function mapSourceToRaiseDcRow(
  p: RaiseDcProductRowSource,
  catalog: any[],
  categoryFallback: string,
  categoryOptions: string[],
  idx: number,
) {
  const productName =
    p.product || p.product_name || p.productName || getCatalogProductNames(catalog)[0] || '';
  const skuOptions = getProductCategoryOptions(catalog, productName);
  const specOptions = getProductSpecsOptions(catalog, productName);
  const subjectOptions = getProductSubjectsOptions(catalog, productName);
  const levelOptions = getProductLevelsOptions(catalog, productName);

  const matchedSku = matchCatalogOption(p.productCategory, skuOptions) || skuOptions[0] || undefined;
  const matchedSpec = matchCatalogOption(p.specs, specOptions) || specOptions[0] || '';
  const matchedSubject =
    matchCatalogOption(p.subject, subjectOptions) || subjectOptions[0] || undefined;
  const matchedLevel = matchCatalogOption(p.level, levelOptions) || levelOptions[0] || '';

  return {
    id: String(idx + 1),
    product: productName,
    class: p.class != null && String(p.class).trim() ? String(p.class) : '1',
    category: normalizeStudentCategory(p.category, categoryFallback, categoryOptions),
    productCategory: matchedSku,
    specs: matchedSpec,
    subject: matchedSubject,
    strength: Number(p.strength ?? p.quantity) || 0,
    level: matchedLevel,
    term: p.term || 'Term 1',
  };
}

export function applyCatalogDefaultsToRow(
  row: {
    product: string;
    level: string;
    specs: string;
    subject?: string;
    productCategory?: string;
  },
  catalog: any[],
) {
  const productName = row.product;
  const skuOptions = getProductCategoryOptions(catalog, productName);
  const specOptions = getProductSpecsOptions(catalog, productName);
  const subjectOptions = getProductSubjectsOptions(catalog, productName);
  const levelOptions = getProductLevelsOptions(catalog, productName);

  return {
    ...row,
    productCategory: row.productCategory || skuOptions[0] || undefined,
    specs: row.specs || specOptions[0] || '',
    subject: row.subject ?? subjectOptions[0] ?? undefined,
    level: row.level || levelOptions[0] || '',
  };
}
