"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { UserBrief, TokenResponse } from "@/types";
import { api, ApiRequestError } from "@/lib/api";
import {
  getStoredUser,
  setStoredUser,
  setTokens,
  clearSession,
  isAuthenticated as checkAuth,
} from "@/lib/auth";

// ============================================================
// Context Types
// ============================================================

interface AuthContextType {
  user: UserBrief | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================
// Auth Provider
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // On mount → hydrate user from localStorage, then verify with /api/auth/me
  useEffect(() => {
    const init = async () => {
      const storedUser = getStoredUser();
      if (storedUser && checkAuth()) {
        setUser(storedUser);
        try {
          // Verify token is still valid by calling /me
          const freshUser = await api.get<UserBrief>("/api/auth/me");
          setUser(freshUser);
          setStoredUser(freshUser);
        } catch {
          // Token invalid → clear session
          clearSession();
          setUser(null);
        }
      } else {
        // If missing local storage but cookie might exist, clear it to prevent loops
        clearSession();
        setUser(null);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // ---- Login ----
  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.post<TokenResponse>("/api/auth/login", {
        username,
        password,
      });

      // Store in localStorage (for API client)
      setTokens(data.access_token, data.refresh_token);
      setStoredUser(data.user);
      setUser(data.user);

      // Also set cookie for Next.js middleware (httpOnly = false so JS can set it)
      document.cookie = `access_token=${data.access_token}; path=/; max-age=${60 * 30}; SameSite=Lax`;

      router.push("/dashboard");
    },
    [router],
  );

  // ---- Logout ----
  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignore errors — always clear session
    }
    clearSession();
    setUser(null);
    // Clear cookie
    document.cookie =
      "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
