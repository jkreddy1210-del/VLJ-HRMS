"use client";

import { useEffect, useState } from "react";
import { useLookups } from "@/hooks/use-lookups";

export function useListPagination(apiPagination) {
  const { lookups } = useLookups();
  const config = lookups?.pagination;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(config?.defaultLimit ?? null);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (config?.defaultLimit && limit === null) {
      setLimit(config.defaultLimit);
    }
  }, [config?.defaultLimit, limit]);

  useEffect(() => {
    if (apiPagination) {
      setPagination(apiPagination);
      if (apiPagination.limit) {
        setLimit(apiPagination.limit);
      }
    }
  }, [apiPagination]);

  const pageSizeOptions =
    pagination?.pageSizeOptions || config?.pageSizeOptions || [];

  return {
    page,
    setPage,
    limit: limit ?? config?.defaultLimit ?? 25,
    setLimit,
    pagination,
    setPagination,
    pageSizeOptions,
    ready: limit !== null,
  };
}
