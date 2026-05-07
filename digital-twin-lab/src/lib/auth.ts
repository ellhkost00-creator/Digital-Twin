import type { Role } from "./mock-data";

const STORAGE_KEY = "dtlab.role";

export type { Role };

export type RouteKey =
  | "/dashboard"
  | "/networks"
  | "/scenarios"
  | "/runs"
  | "/results"
  | "/conversion-tools"
  | "/connection-tool-devices"
  | "/users";

export const rolePermissions: Record<Role, RouteKey[]> = {
  admin: [
    "/dashboard",
    "/networks",
    "/scenarios",
    "/runs",
    "/results",
    "/conversion-tools",
    "/connection-tool-devices",
    "/users",
  ],
  researcher: [
    "/dashboard",
    "/networks",
    "/scenarios",
    "/runs",
    "/results",
    "/conversion-tools",
    "/connection-tool-devices",
  ],
  student: ["/dashboard", "/networks", "/runs", "/results"],
};

export function getCurrentRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "admin" || v === "researcher" || v === "student") {
    return v;
  }
  return null;
}

export function setCurrentRole(role: Role) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, role);
  window.dispatchEvent(new Event("dtlab-role-change"));
}

export function clearCurrentRole() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("dtlab-role-change"));
}

export function hasAccess(role: Role | null, route: RouteKey): boolean {
  if (!role) return false;
  return rolePermissions[role].includes(route);
}
