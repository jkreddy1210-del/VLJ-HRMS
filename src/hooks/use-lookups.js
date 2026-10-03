"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

let cache = null;
let cachePromise = null;

export function useLookups() {
  const [lookups, setLookups] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) {
      setLookups(cache);
      setLoading(false);
      return;
    }

    if (!cachePromise) {
      cachePromise = api
        .lookups()
        .then((data) => {
          cache = data;
          return data;
        })
        .finally(() => {
          cachePromise = null;
        });
    }

    cachePromise
      .then((data) => setLookups(data))
      .catch(() => setLookups(null))
      .finally(() => setLoading(false));
  }, []);

  return { lookups, loading };
}

export function clearLookupsCache() {
  cache = null;
  cachePromise = null;
}
