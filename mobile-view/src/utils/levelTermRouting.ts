/**
 * Route product rows to My Clients (Term 1) vs Term-Wise DC (Term 2) by level.
 *
 * - Level 1 (and no-level products) → Term 1
 * - Level 2 + Level 1 present → Term 2 (Term-Wise DC)
 * - Level 2 only (no Level 1) → Term 1 (My Clients, not Term-Wise)
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
  return k === 'level1' || k === 'l1' || k.startsWith('level1');
}

export function isLevelTwo(level: unknown): boolean {
  const k = normalizeLevelKey(level);
  return k === 'level2' || k === 'l2' || k.startsWith('level2');
}

export function assignTermsByLevelCombination<T extends { level?: unknown; term?: unknown }>(
  rows: T[],
): Array<T & { term: ProductTerm }> {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const hasLevel1 = rows.some((r) => isLevelOne(r.level));
  return rows.map((r) => {
    if (isLevelTwo(r.level)) {
      return { ...r, term: (hasLevel1 ? 'Term 2' : 'Term 1') as ProductTerm };
    }
    return { ...r, term: 'Term 1' as ProductTerm };
  });
}

export function formatProductWithLevel(productName: string, level?: unknown): string {
  const name = String(productName || '').trim() || 'Product';
  const lvl = String(level ?? '').trim();
  return lvl ? `${name} (${lvl})` : name;
}
