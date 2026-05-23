import React, { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { axiosPrivate } from "@/api/axios";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  watchlist: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, userData: User) => void;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  checkAuthStatus: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Stores tokens in localStorage and updates React state atomically
  const login = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (token) {
        await axiosPrivate.post("/auth/logout");
      }
    } catch (e) {
      // Silently fail — we still want to clear state even if server call fails
      console.warn("[Auth] Server logout failed, clearing local state anyway", e);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosPrivate.get("/auth/me");
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        // Server responded but returned no user — clear stale tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
      }
    } catch (error: any) {
      console.warn("[Auth] Session check failed:", error?.response?.data?.message || error.message);
      // If 401 and refresh fails inside the interceptor, tokens are already cleared
      if (error?.response?.status !== 401) {
        // Non-auth errors (e.g., network down): keep user logged in optimistically
        // by reading from localStorage if we had a token
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount: restore session from stored token
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);

