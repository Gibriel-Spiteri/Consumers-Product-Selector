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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "ps_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to authentication service" };
    }
  }, []);

  const logout = useCallback(() => {
    setEmployee(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ employee, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
