import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Upload, ImageIcon, Shield, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface SyncStats {
  categoriesSynced: number;
  productsSynced: number;
  pprItemsSynced: number;
  attributesSynced: number;
  relatedItemsSynced: number;
  syncedBy: string;
  completedAt: string;
  success: boolean;
}

function formatSyncTime(iso: string) {
  if (!iso) return null;
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  return new Date(ts).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function SyncSection({ employeeName }: { employeeName: string }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; detail: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncStats | null>(null);
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    fetch("/api/dev/sync/last")
      .then(r => r.json())
      .then(data => { if (data) setLastSync(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">NetSuite Sync</h3>
      <p className="text-sm text-gray-500 mb-4">
        Pull the latest products, categories, and pricing from NetSuite into the local database.
      </p>

      {lastSync && lastSync.completedAt && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Last Sync</div>
          <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-2">
            <span>{formatSyncTime(lastSync.completedAt)}</span>
            {lastSync.syncedBy && (
              <span className="text-xs text-gray-400 font-normal">by {lastSync.syncedBy}</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">{lastSync.categoriesSynced.toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Categories</div>
            </div>
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">{lastSync.productsSynced.toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Products</div>
            </div>
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">{lastSync.relatedItemsSynced.toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Related Items</div>
            </div>
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">{lastSync.pprItemsSynced.toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">PPRs</div>
            </div>
            <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">{lastSync.attributesSynced.toLocaleString()}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Attributes</div>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {syncing && progress && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{progress.detail}</span>
              <span>{Math.round(progress.percent)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {result && (
          <div className={`mb-3 text-sm font-medium ${result.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>
            {result}
          </div>
        )}

        <button
          onClick={async () => {
            if (syncing) return;
            setSyncing(true);
            setResult(null);
            setProgress({ percent: 2, detail: "Starting…" });
            pollRef.current = setInterval(async () => {
              try {
                const r = await fetch("/api/dev/sync/progress");
                const p = await r.json();
                if (p.stage !== "idle") setProgress({ percent: p.percent, detail: p.detail });
              } catch {}
            }, 600);
            try {
              const res = await fetch("/api/dev/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncedBy: employeeName }),
              });
              const data = await res.json();
              stopPolling();
              if (data.status === "complete") {
                setProgress({ percent: 100, detail: "Complete!" });
                setResult(`Successfully synced ${data.productsSynced} products`);
                setLastSync({
                  categoriesSynced: data.categoriesSynced ?? 0,
                  productsSynced: data.productsSynced ?? 0,
                  pprItemsSynced: data.pprItemsSynced ?? 0,
                  attributesSynced: data.attributesSynced ?? 0,
                  relatedItemsSynced: data.relatedItemsSynced ?? 0,
                  syncedBy: data.syncedBy ?? "",
                  completedAt: data.completedAt ?? new Date().toISOString(),
                  success: true,
                });
                qc.invalidateQueries();
              } else if (data.status === "already_running") {
                setResult("Sync is already running");
              } else {
                setResult("Sync failed");
              }
            } catch {
              stopPolling();
              setResult("Sync failed");
            } finally {
              setSyncing(false);
              setTimeout(() => { setResult(null); setProgress(null); }, 6000);
            }
          }}
          disabled={syncing}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Run Sync Now"}
        </button>
      </div>
    </div>
  );
}

function HeroImageSection({ employeeId }: { employeeId: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(`${import.meta.env.BASE_URL}hero-kitchen.png?t=${Date.now()}`);
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/admin/hero-image", {
        method: "POST",
        headers: { "X-Employee-Id": employeeId },
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPreviewUrl(`${import.meta.env.BASE_URL}hero-kitchen.png?t=${Date.now()}`);
        setMessage({ type: "success", text: "Homepage image updated successfully" });
      } else {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to upload image" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Homepage Hero Image</h3>
      <p className="text-sm text-gray-500 mb-4">
        This image is displayed as the banner on the homepage. Recommended size: 1920×800 or similar wide aspect ratio.
      </p>

      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Current hero image"
            className="w-full h-[200px] object-cover"
            onError={() => setPreviewUrl(null)}
          />
        ) : (
          <div className="w-full h-[200px] bg-gray-50 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon size={32} className="mb-2" />
            <span className="text-sm">No hero image set</span>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        <Upload size={14} />
        {uploading ? "Uploading…" : "Change Image"}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const { employee } = useAuth();

  if (!employee?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Shield size={48} className="mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Access Denied</h2>
        <p className="text-sm">You don't have admin privileges.</p>
        <Link href="/" className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">Manage application settings</p>
        </div>
      </div>

      <div className="space-y-6">
        <SyncSection employeeName={`${employee.firstName} ${employee.lastName}`} />
        <HeroImageSection employeeId={employee.id} />
      </div>
    </div>
  );
}
