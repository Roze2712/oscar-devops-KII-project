import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/** True when `sort_order` is not on `products` yet (migration not applied). */
export function isMissingSortOrderColumn(
  error: PostgrestError | null | undefined,
): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("sort_order") &&
    (msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("column"))
  );
}

type FetchOrderedProductsOptions = {
  select: string;
  /** Secondary / fallback ordering by `id`. */
  idAscending: boolean;
};

/**
 * Loads products ordered by `sort_order`, then `id`.
 * Falls back to `id` only when the `sort_order` column is missing.
 */
export async function fetchOrderedProducts<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  { select, idAscending }: FetchOrderedProductsOptions,
) {
  const withSortOrder = await supabase
    .from("products")
    .select(select)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: idAscending });

  if (!withSortOrder.error) {
    return {
      data: withSortOrder.data as T[] | null,
      error: withSortOrder.error,
      sortOrderSupported: true as const,
    };
  }

  if (!isMissingSortOrderColumn(withSortOrder.error)) {
    return {
      data: withSortOrder.data as T[] | null,
      error: withSortOrder.error,
      sortOrderSupported: false as const,
    };
  }

  const selectFallback = select
    .split(",")
    .map((column) => column.trim())
    .filter((column) => column && column !== "sort_order")
    .join(", ");

  const fallback = await supabase
    .from("products")
    .select(selectFallback)
    .order("id", { ascending: idAscending });

  return {
    data: fallback.data as T[] | null,
    error: fallback.error,
    sortOrderSupported: false as const,
  };
}
