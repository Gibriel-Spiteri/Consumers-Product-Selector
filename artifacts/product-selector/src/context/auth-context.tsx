import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface Employee {
  id: string;
  entityId: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  locationId: string | null;
  locationName: string | null;
}

interface AuthContextType {
  employee: Employee | null;
  isLoading: boolean;
  isAdmin: boolean;
  realIsAdmin: boolean;
  viewAsNonAdmin: boolean;
  setViewAsNonAdmin: (v: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "ps_auth";
const VIEW_KEY = "ps_view_as_non_admin";
// Signed sign-in token from /api/auth/login; the server requires it for NetSuite estimates.
const TOKEN_KEY = "ps_session";

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null | undefined) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

// Every generated API hook sends the token; plain fetch calls use authHeaders().
setAuthTokenGetter(readToken);

export function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewAsNonAdmin, setViewAsNonAdminState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setViewAsNonAdmin = useCallback((v: boolean) => {
    setViewAsNonAdminState(v);
    try {
      if (v) localStorage.setItem(VIEW_KEY, "1");
      else localStorage.removeItem(VIEW_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Signed in before sign-in tokens existed: sign in once more.
    if (!readToken()) {
      localStorage.removeItem(STORAGE_KEY);
      setIsLoading(false);
      return;
    }

    try {
      const data = JSON.parse(stored) as Employee;
      const numericId = Number(data?.id);
      if (!Number.isFinite(numericId)) {
        localStorage.removeItem(STORAGE_KEY);
        setIsLoading(false);
        return;
      }
      fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ employeeId: data.id }),
      })
        .then(r => r.json())
        .then(result => {
          if (result.valid && result.employee) {
            setEmployee(result.employee);
            writeToken(result.token ?? readToken());
          } else {
            localStorage.removeItem(STORAGE_KEY);
            writeToken(null);
          }
        })
        .catch(() => {
          setEmployee(data);
        })
        .finally(() => setIsLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setEmployee(data.employee);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.employee));
      writeToken(data.token);
      setViewAsNonAdmin(true);
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to authentication service" };
    }
  }, [setViewAsNonAdmin]);

  const logout = useCallback(() => {
    setEmployee(null);
    localStorage.removeItem(STORAGE_KEY);
    writeToken(null);
    setViewAsNonAdmin(false);
  }, [setViewAsNonAdmin]);

  const realIsAdmin = employee?.isAdmin ?? false;
  const isAdmin = realIsAdmin && !viewAsNonAdmin;

  return (
    <AuthContext.Provider
      value={{
        employee,
        isLoading,
        isAdmin,
        realIsAdmin,
        viewAsNonAdmin,
        setViewAsNonAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
