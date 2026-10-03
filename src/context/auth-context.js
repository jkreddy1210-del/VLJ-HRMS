"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api-client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("emp_token");
      const stored = localStorage.getItem("emp_user");
      if (token && stored) {
        try {
          const { user: freshUser } = await api.me();
          setUser(freshUser);
          localStorage.setItem("emp_user", JSON.stringify(freshUser));
        } catch {
          localStorage.removeItem("emp_token");
          localStorage.removeItem("emp_user");
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    localStorage.setItem("emp_token", data.token);
    localStorage.setItem("emp_user", JSON.stringify(data.user));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("emp_user");
    localStorage.removeItem("emp_token");
  };

  const hasPermission = (perm) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("Full System Access") || user.permissions.includes("All Permissions")) return true;
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
