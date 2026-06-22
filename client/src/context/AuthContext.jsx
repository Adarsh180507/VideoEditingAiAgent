import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  // Whenever the app loads, check if we have a token saved
  useEffect(() => {
    if (token) {
      // Decode the token payload manually just to get the user ID/email
      // (in a production app, you'd verify this with the backend)
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          window
            .atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join(""),
        );

        const decoded = JSON.parse(jsonPayload);
        // We set a temporary user object until they make a real API call
        setUser({ id: decoded.id });
      } catch (e) {
        logout();
      }
    }
  }, [token]);

  const login = (userData, jwtToken) => {
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  // Helper function to update credits in the UI instantly after generating a video
  const updateCredits = (newBalance) => {
    if (user) {
      setUser({ ...user, credits: newBalance });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateCredits }}>
      {children}
    </AuthContext.Provider>
  );
};
