"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/types";
import { getToken, getUser } from "@/lib/auth";

/** Reactive auth state. `required` redirects to /login when signed out. */
export function useAuth(required = false) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      const u = getToken() ? getUser() : null;
      setUser(u);
      setReady(true);
      if (required && !u) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    };
    sync();
    window.addEventListener("vazhi-auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vazhi-auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, [required, router]);

  return { user, ready };
}
