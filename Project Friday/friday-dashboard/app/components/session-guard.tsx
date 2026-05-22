"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enforces tab-level session isolation.
 * sessionStorage is cleared automatically when a tab/window closes,
 * so any new tab opening Friday is forced to re-authenticate.
 */
export default function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    // Don't guard the login page itself
    if (window.location.pathname.startsWith("/login")) return;

    if (!sessionStorage.getItem("friday_alive")) {
      // Clear the server-side cookie then redirect
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        router.replace("/login");
      });
    }
  }, [router]);

  return null;
}
