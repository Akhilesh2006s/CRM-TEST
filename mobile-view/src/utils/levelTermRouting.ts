/**
 * Route product rows to My Clients (Term 1) vs Term-Wise DC (Term 2) by level.
 *
 * - Catalog index 0 / Level 1 / "Term 1" → Term 1 (My Clients)
 * - Catalog index 1 / Level 2 / "Term 2" (when a first level is also present) → Term 2
 * - Custom level names (e.g. "hi") use catalog order: 1st → Term 1, 2nd → Term 2
 */

export type ProductTerm = 'Term 1' | 'Term 2' | 'Both';

function normalizeLevelKey(level: unknown): string {
  return String(level ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function isLevelOne(level: unknown): boolean {
  const k = normalizeLevelKey(level);
  return (
    k === 'level1' ||
    k === 'l1' ||
    k.startsWith('level1') ||
    k === 'term1' ||
    k.startsWith('term1')
  );
}

export function isLevelTwo(level: unknown): boolean {
  const k = normalizeLevelKey(level);
  return (
    k === 'level2' ||
    k === 'l2' ||
    k.startsWith('level2') ||
    k === 'term2' ||
    k.startsWith('term2')
  );
}

function levelCatalogIndex(level: unknown, catalogLevels: string[]): number {
  const key = String(level ?? '').trim().toLowerCase();
  if (!key) return -1;
  return catalogLevels.findIndex((l) => String(l).trim().toLowerCase() === key);
}

/** True when this row is the product's first (Term 1) stage. */
export function isFirstStageLevel(
  level: unknown,
  catalogLevels: string[] = [],
): boolean {
  if (isLevelOne(level)) return true;
  if (isLevelTwo(level)) return false;
  const idx = levelCatalogIndex(level, catalogLevels);
  return idx === 0 || (idx < 0 && !String(level ?? '').trim());
}

/** True when this row is the product's second (Term 2) stage. */
export function isSecondStageLevel(
  level: unknown,
  catalogLevels: string[] = [],
): boolean {
  if (isLevelTwo(level)) return true;
  if (isLevelOne(level)) return false;
  return levelCatalogIndex(level, catalogLevels) === 1;
}

export function assignTermsByLevelCombination<T extends { product?: unknown; level?: unknown; term?: unknown }>(
  rows: T[],
  catalogByProduct?: Record<string, string[]> | ((product: string) => string[]),
): Array<T & { term: ProductTerm }> {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const levelsFor = (product: unknown): string[] => {
    const name = String(product || '').trim();
    if (!name || !catalogByProduct) return [];
    if (typeof catalogByProduct === 'function') return catalogByProduct(name) || [];
    return catalogByProduct[name] || catalogByProduct[name.toLowerCase()] || [];
  };

  return rows.map((r) => {
    const catalog = levelsFor(r.product);
    const hasFirst = rows.some(
      (x) =>
        String(x.product || '').trim().toLowerCase() ===
          String(r.product || '').trim().toLowerCase() &&
        isFirstStageLevel(x.level, catalog),
    );

    if (isSecondStageLevel(r.level, catalog)) {
      return { ...r, term: (hasFirst ? 'Term 2' : 'Term 1') as ProductTerm };
    }
    return { ...r, term: 'Term 1' as ProductTerm };
  });
}

export function formatProductWithLevel(productName: string, level?: unknown): string {
  const name = String(productName || '').trim() || 'Product';
  const lvl = String(level ?? '').trim();
  return lvl ? `${name} (${lvl})` : name;
}
