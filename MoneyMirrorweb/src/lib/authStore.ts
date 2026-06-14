/**
 * authStore.ts
 * Single source of truth for the logged-in user.
 * Login → call setUser(). Logout → call clearUser().
 * Components subscribe with useAuthStore() and re-render automatically.
 */
import { create } from "zustand";

export type MmUser = {
  user_id?: string;
  name: string;
  email: string;
  profile_image?: string;
  created_at?: string;
};

type AuthState = {
  user: MmUser | null;
  setUser: (u: MmUser) => void;
  clearUser: () => void;
};

// Initialise from localStorage so a page-refresh keeps the user logged in
function readUser(): MmUser | null {
  try {
    const raw = localStorage.getItem("mm_user");
    return raw ? (JSON.parse(raw) as MmUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readUser(),

  setUser: (u) => {
    localStorage.setItem("mm_user", JSON.stringify(u));
    set({ user: u });
  },

  clearUser: () => {
    localStorage.removeItem("mm_user");
    set({ user: null });
  },
}));
