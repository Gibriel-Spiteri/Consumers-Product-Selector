import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Loader2, AlertCircle, LogIn } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function LoginBrand() {
  const { data, isLoading } = useQuery({
    queryKey: ["adminLogo"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logo");
      if (!res.ok) return { mode: "text" as const, svg: null };
      return res.json() as Promise<{ mode: "text" | "image"; svg: string | null }>;
    },
    staleTime: 5 * 60_000,
    gcTime: Infinity,
  });

  if (isLoading || !data) {
    return <span className="inline-block h-[28px] w-[200px]" aria-hidden />;
  }

  if (data.mode === "image" && data.svg) {
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`;
    return (
      <img
        src={dataUrl}
        alt="Consumers"
        className="h-[28px] w-auto max-w-[200px] object-contain inline-block align-middle"
      />
    );
  }
  return <span className="text-gray-900">CONSUMERS</span>;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    const result = await login(email.trim(), password.trim());
    if (!result.success) {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight inline-flex items-center justify-center gap-2 flex-wrap">
            <LoginBrand />
            <span className="text-amber-500 relative top-[4px] -left-[2px]">PRODUCT SELECTOR</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">Sign in with your employee credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-[12px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@consumersmail.com"
              autoComplete="email"
              autoFocus
              required
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-gray-300"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-gray-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
