import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getAccessToken,
  getCurrentUser,
  loginUser,
  logoutUser,
} from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
  if (!getAccessToken()) {
    if (active) setLoading(false);
    return;
  }

  try {
    const currentUser = await getCurrentUser();

    if (active) {
      setUser(currentUser);
    }
  } catch (error) {
    console.error("Session restoration failed:", error);

    // Only clear the session when the server explicitly
    // rejects the token or the account is no longer eligible.
    if (error.status === 401 || error.status === 403) {
      await logoutUser();

      if (active) {
        setUser(null);
      }
    } else {
      // Keep the token for temporary network/server failures.
      // Do not silently destroy an otherwise valid session.
      if (active) {
        setUser(null);
      }
    }
  } finally {
    if (active) {
      setLoading(false);
    }
  }
}

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function signIn(email, password) {
    const authenticatedUser = await loginUser({
      email,
      password,
    });

    setUser(authenticatedUser);
    return authenticatedUser;
  }

  async function signOut() {
    await logoutUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}