import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface Employee {
  id: string;
  entityId: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
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

    try {
      const data = JSON.parse(stored) as Employee;
      fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: data.id }),
      })
        .then(r => r.json())
        .then(result => {
          if (result.valid && result.employee) {
            setEmployee(result.employee);
          } else {
            localStorage.removeItem(STORAGE_KEY);
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
      setViewAsNonAdmin(true);
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to authentication service" };
    }
  }, [setViewAsNonAdmin]);

  const logout = useCallback(() => {
    setEmployee(null);
    localStorage.removeItem(STORAGE_KEY);
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
