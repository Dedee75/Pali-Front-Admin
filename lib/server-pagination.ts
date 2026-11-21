'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Filter = string | number | boolean | null | undefined;
export type PageResult<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export function useServerPagination(filters: Record<string, Filter> = {}) {
  const key = new URLSearchParams(
    Object.entries(filters)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .map(([name, value]) => [name, String(value)]),
  ).toString();
  const [position, setPosition] = useState({ key, page: 1, limit: 10 });
  if (position.key !== key) setPosition({ ...position, key, page: 1 });
  const [count, setCount] = useState({ key, total: 0, query: '' });
  const pageSize = position.limit;
  const currentPage = position.key === key ? position.page : 1;
  const query = `${key}${key ? '&' : ''}page=${currentPage}&limit=${pageSize}`;
  const latest = useRef({ query, key });
  useEffect(() => {
    latest.current = { query, key };
  }, [query, key]);
  const isLatest = useCallback(
    (requestedQuery: string) => requestedQuery === latest.current.query,
    [],
  );
  const accept = useCallback(
    (result: PageResult<unknown>, requestedQuery: string) => {
      if (requestedQuery !== latest.current.query) return false;
      if (!result?.meta || !Array.isArray(result.data))
        throw new Error(
          'Invalid list response. Reload after updating the backend.',
        );
      setCount({
        key: latest.current.key,
        total: result.meta.total,
        query: requestedQuery,
      });
      const last = Math.max(1, result.meta.totalPages);
      if (result.meta.page > last) {
        setPosition((previous) => ({
          ...previous,
          key: latest.current.key,
          page: last,
        }));
        return false;
      }
      return true;
    },
    [],
  );
  const setCurrentPage = (page: number | ((value: number) => number)) =>
    setPosition((previous) => ({
      ...previous,
      key,
      page: Math.max(1, typeof page === 'function' ? page(currentPage) : page),
    }));
  const setPageSize = (limit: number) => setPosition({ key, page: 1, limit });
  return {
    query,
    accept,
    isLatest,
    isCurrent: count.query === query,
    total: count.key === key ? count.total : 0,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    startIndex: (currentPage - 1) * pageSize,
  };
}

// Select menus need every small option row, rather than a truncated first page.
// Fetch sequential bounded pages; never request student/submission/image directories here.
export async function loadOptions<T>(
  fetcher: (endpoint: string) => Promise<unknown>,
  endpoint: '/batches' | '/users/teachers',
) {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = (await fetcher(
      `${endpoint}?page=${page}&limit=100`,
    )) as PageResult<T>;
    if (!result?.meta || !Array.isArray(result.data))
      throw new Error('Invalid options response');
    rows.push(...result.data);
    if (page >= result.meta.totalPages) return rows;
  }
}

export function mergeSelection<T extends { id: number }>(
  previous: T[],
  currentPage: T[],
  ids: number[],
): T[] {
  const pool = new Map(
    [...previous, ...currentPage].map((row) => [row.id, row]),
  );
  return [...new Set(ids)]
    .map((id) => pool.get(id))
    .filter((row): row is T => row !== undefined);
}
