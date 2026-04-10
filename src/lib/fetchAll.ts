import { supabase } from '@/lib/supabase';

/**
 * Fetch all rows from a table, bypassing the 1000-row default limit.
 * Uses pagination with a batch size of 1000.
 */
export async function fetchAllRows<T = any>(
  table: string,
  select = '*',
  filters?: { column: string; value: string }[]
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (filters) {
      for (const f of filters) {
        query = query.eq(f.column, f.value);
      }
    }
    const { data, error } = await query;
    if (error || !data) break;
    allRows = allRows.concat(data as T[]);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allRows;
}
