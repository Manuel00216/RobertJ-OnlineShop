export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Converts page/pageSize into the inclusive range Supabase expects. */
export function toRange({ page, pageSize }: PaginationParams) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
