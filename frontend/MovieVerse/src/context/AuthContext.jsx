import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ---------------------------------------------------------
  // AUTO LOGIN USING TOKEN
  // ---------------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/protected")
      .then((res) => {
        setUser(res.data.user); // user comes from JWT backend
      })
      .catch(() => {
        logout();
      })
      .finally(() => setLoading(false));
  }, []);

  // ---------------------------------------------------------
  // LOGIN (BACKEND)
  // ---------------------------------------------------------
  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });

      // Save token
      localStorage.setItem("token", res.data.token);

      // Save user returned from backend
      setUser(res.data.user);

      return res.data.user;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Login failed");
    }
  };

  // ---------------------------------------------------------
  // REGISTER (BACKEND)
  // ---------------------------------------------------------
  const signup = async (name, email, password, role = "user") => {
  try {
    await api.post("/auth/register", { name, email, password, role });

    // Auto-login after successful signup
    return await login(email, password);

  } catch (err) {
    throw new Error(err.response?.data?.message || "Signup failed");
  }
};


  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  // ---------------------------------------------------------
  // MODAL CONTROL
  // ---------------------------------------------------------
  const openAuthModal = () => setShowAuthModal(true);
  const closeAuthModal = () => setShowAuthModal(false);

  // ---------------------------------------------------------
  // PROVIDER VALUE
  // ---------------------------------------------------------
  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    showAuthModal,
    openAuthModal,
    closeAuthModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
