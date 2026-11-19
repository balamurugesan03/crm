import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';

export function useResourceList(queryKey, api, extraParams = {}) {
  const [search, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const params = { page, search: debouncedSearch || undefined, ...extraParams };

  const query = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => api.list(params),
    placeholderData: keepPreviousData,
  });

  function setSearch(value) {
    setSearchRaw(value);
    setPage(1);
  }

  return {
    ...query,
    items: query.data?.items || [],
    pages: query.data?.pages || 1,
    total: query.data?.total,
    search,
    setSearch,
    page,
    setPage,
  };
}
