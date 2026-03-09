/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "cpg_token";
const USER_KEY = "cpg_user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const persistAuth = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const clearAuth = useCallback(() => {
    setToken("");
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authApi.me(token);
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch {
      clearAuth();
    }
  }, [token, clearAuth]);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      try {
        const data = await authApi.login({ email, password });
        persistAuth(data.token, data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );

  const signup = useCallback(
    async (name, email, password) => {
      setLoading(true);
      try {
        const data = await authApi.signup({ name, email, password });
        persistAuth(data.token, data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!token) throw new Error("Not authenticated");
      const data = await authApi.changePassword(token, { currentPassword, newPassword });
      await refreshMe();
      return data;
    },
    [token, refreshMe]
  );

  const createUser = useCallback(
    async (payload) => {
      if (!token) throw new Error("Not authenticated");
      return authApi.createUser(token, payload);
    },
    [token]
  );

  const onboardMerchant = useCallback(
    async (payload) => {
      if (!token) throw new Error("Not authenticated");
      return authApi.onboardMerchant(token, payload);
    },
    [token]
  );

  useEffect(() => {
    if (token && !user) {
      refreshMe();
    }
  }, [token, user, refreshMe]);

  const value = {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    signup,
    logout,
    refreshMe,
    changePassword,
    createUser,
    onboardMerchant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
