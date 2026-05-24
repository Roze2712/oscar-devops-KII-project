const STORAGE_KEY = "oscar-dt-admin-product-order";

export function readStoredProductOrder(): number[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return null;
  }
}

export function writeStoredProductOrder(ids: number[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function applyStoredProductOrder<T extends { id: number }>(
  products: T[],
): T[] {
  const ids = readStoredProductOrder();
  if (!ids?.length) return products;

  const byId = new Map(products.map((product) => [product.id, product]));
  const ordered: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  for (const product of products) {
    if (!ids.includes(product.id)) ordered.push(product);
  }
  return ordered;
}
