import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "splitease_auth_token";
const USER_KEY = "splitease_user";

interface AuthUser {
  userId: number;
  email: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, newToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser)).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
