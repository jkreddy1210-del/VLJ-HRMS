"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only after client mount — prevents hydration mismatches
 * for theme, localStorage, matchMedia, etc.
 */
export function ClientGate({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback;
  return children;
}
