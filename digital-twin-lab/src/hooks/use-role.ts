import { useEffect, useState } from "react";
import { getCurrentRole, type Role } from "@/lib/auth";

export function useRole(): { role: Role | null; ready: boolean } {
  // Always start as null/false to match SSR; read storage after mount.
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(getCurrentRole());
    setReady(true);
    const update = () => setRole(getCurrentRole());
    window.addEventListener("dtlab-role-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("dtlab-role-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return { role, ready };
}
