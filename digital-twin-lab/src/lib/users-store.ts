import type { Role } from "./auth";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  isSelf?: boolean;
}

const STORAGE_KEY = "dtlab.users";
const EVENT = "dtlab-users-change";

const seed: ManagedUser[] = [
  { id: "u-1", name: "Marco Rossi", email: "marco.rossi@dtlab.io", role: "admin", initials: "MR", isSelf: true },
  { id: "u-2", name: "Dr. Elena Marchetti", email: "elena.marchetti@dtlab.io", role: "researcher", initials: "EM" },
  { id: "u-3", name: "Sofia Bianchi", email: "sofia.bianchi@dtlab.io", role: "student", initials: "SB" },
  { id: "u-4", name: "Luca Conti", email: "luca.conti@dtlab.io", role: "student", initials: "LC" },
  { id: "u-5", name: "Giulia Ferrari", email: "giulia.ferrari@dtlab.io", role: "researcher", initials: "GF" },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getUsers(): ManagedUser[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as ManagedUser[];
  } catch {
    return seed;
  }
}

function persist(users: ManagedUser[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event(EVENT));
}

export function setUsers(users: ManagedUser[]) {
  persist(users);
}

export function addUser(input: { name: string; email: string; role: Role }): ManagedUser {
  const users = getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === input.email.toLowerCase());
  if (existing) return existing;
  const user: ManagedUser = {
    id: `u-${Date.now()}`,
    name: input.name,
    email: input.email,
    role: input.role,
    initials: getInitials(input.name),
  };
  persist([...users, user]);
  return user;
}

export function removeUser(id: string) {
  persist(getUsers().filter((u) => u.id !== id));
}

export function updateUserRole(id: string, role: Role) {
  persist(getUsers().map((u) => (u.id === id ? { ...u, role } : u)));
}

export function subscribeUsers(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
