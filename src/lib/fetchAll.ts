import { supabase } from '@/lib/supabase';

/**
 * Fetch all rows from a table, bypassing the 1000-row default limit.
 */
export async function fetchAllRows(
  table: 'students' | 'risk_cases' | 'outcomes' | 'follow_ups' | 'app_users' | 'intervention_forms',
  select = '*',
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    allRows = allRows.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allRows;
}
