import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface Employee {
  id: string;
  name: string;
}

interface AuthContextType {
  employee: Employee | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loginError: string | null;
  isLoggingIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "employee-auth";

function loadSession(): Employee | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Employee;
  } catch {
    return null;
  }
}

function saveSession(employee: Employee): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(loadSession);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }

      const emp: Employee = {
        id: data.employeeId,
        name: data.employeeName,
      };
      setEmployee(emp);
      saveSession(emp);
    } catch {
      setLoginError("Unable to reach login service");
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    setEmployee(null);
    clearSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        employee,
        isAuthenticated: employee !== null,
        login,
        logout,
        loginError,
        isLoggingIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
