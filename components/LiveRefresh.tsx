"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Silently refreshes the page every `intervalMs` milliseconds.
 * Only mounted when a match is live so we get live score updates.
 */
export default function LiveRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
