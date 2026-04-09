import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { RefreshCw, Upload, ImageIcon, Shield, ArrowLeft, Clock, PackageX } from "lucide-react";
import { Link } from "wouter";

type ScheduleInterval = "off" | "1h" | "2h" | "4h" | "6h" | "12h" | "24h";

interface TimeWindow {
  startHour: number;
  endHour: number;
}

const SCHEDULE_OPTIONS: { value: ScheduleInterval; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "1h", label: "Every 1 hour" },
  { value: "2h", label: "Every 2 hours" },
  { value: "4h", label: "Every 4 hours" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? "AM" : "PM";
  const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: i, label: `${display}:00 ${suffix}` };
});

interface SyncStats {
  categoriesSynced: number;
  productsSynced: number;
  pprItemsSynced: number;
  attributesSynced: number;
  relatedItemsSynced: number;
  syncedBy: string;
  durationMs: number;
  completedAt: string;
  success: boolean;
}

function formatSyncDate(iso: string) {
  if (!iso) return null;
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  return new Date(ts).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSyncTimeOfDay(iso: string) {
  if (!iso) return null;
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function SyncSection({ employeeName }: { employeeName: string }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; detail: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncStats | null>(null);
  const [schedule, setSchedule] = useState<ScheduleInterval>("6h");
  const [windowEnabled, setWindowEnabled] = useState(false);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(17);
  const [syncTimes, setSyncTimes] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
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
    fetch("/api/dev/sync/schedule")
      .then(r => r.json())
      .then(data => {
        if (data?.interval) setSchedule(data.interval);
        if (data?.timeWindow) {
          setWindowEnabled(true);
          setWindowStart(data.timeWindow.startHour);
          setWindowEnd(data.timeWindow.endHour);
        }
        if (data?.syncTimes) setSyncTimes(data.syncTimes);
      })
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
          <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
            <div>
              <span className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Date </span>
              <span className="text-gray-700 font-medium">{formatSyncDate(lastSync.completedAt)}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Time </span>
              <span className="text-gray-700 font-medium">{formatSyncTimeOfDay(lastSync.completedAt)}</span>
            </div>
            {lastSync.syncedBy && (
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">By </span>
                <span className="text-gray-700 font-medium">{lastSync.syncedBy}</span>
              </div>
            )}
            {lastSync.durationMs > 0 && (
              <div>
                <span className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Duration </span>
                <span className="text-gray-700 font-medium">{formatDuration(lastSync.durationMs)}</span>
              </div>
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
                  durationMs: data.durationMs ?? 0,
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

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Automatic Sync Schedule</span>
          {savingSchedule && <span className="text-xs text-gray-400 ml-1">Saving…</span>}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Frequency</span>
            <select
              value={schedule}
              onChange={async (e) => {
                const newInterval = e.target.value as ScheduleInterval;
                setSchedule(newInterval);
                setSavingSchedule(true);
                try {
                  const res = await fetch("/api/dev/sync/schedule", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ interval: newInterval }),
                  });
                  const data = await res.json();
                  if (data?.syncTimes) setSyncTimes(data.syncTimes);
                } catch {}
                setSavingSchedule(false);
              }}
              disabled={savingSchedule}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 w-fit"
            >
              {SCHEDULE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {schedule !== "off" && (
              <>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">First Sync</span>
                <select
                  value={windowEnabled ? windowStart : ""}
                  onChange={async (e) => {
                    const newStart = Number(e.target.value);
                    setWindowStart(newStart);
                    if (!windowEnabled) setWindowEnabled(true);
                    setSavingSchedule(true);
                    try {
                      const res = await fetch("/api/dev/sync/schedule", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          timeWindow: { startHour: newStart, endHour: windowEnabled ? windowEnd : 23 },
                        }),
                      });
                      const data = await res.json();
                      if (data?.syncTimes) setSyncTimes(data.syncTimes);
                      if (data?.timeWindow) {
                        setWindowEnd(data.timeWindow.endHour);
                      }
                    } catch {}
                    setSavingSchedule(false);
                  }}
                  disabled={savingSchedule}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 w-fit"
                >
                  {!windowEnabled && <option value="">All day</option>}
                  {HOUR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Last Sync</span>
                <select
                  value={windowEnabled ? windowEnd : ""}
                  onChange={async (e) => {
                    const newEnd = Number(e.target.value);
                    setWindowEnd(newEnd);
                    if (!windowEnabled) setWindowEnabled(true);
                    setSavingSchedule(true);
                    try {
                      const res = await fetch("/api/dev/sync/schedule", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          timeWindow: { startHour: windowEnabled ? windowStart : 0, endHour: newEnd },
                        }),
                      });
                      const data = await res.json();
                      if (data?.syncTimes) setSyncTimes(data.syncTimes);
                      if (data?.timeWindow) {
                        setWindowStart(data.timeWindow.startHour);
                      }
                    } catch {}
                    setSavingSchedule(false);
                  }}
                  disabled={savingSchedule}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 w-fit"
                >
                  {!windowEnabled && <option value="">All day</option>}
                  {HOUR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {schedule === "off" && (
            <p className="text-xs text-amber-600">Sync will only run when triggered manually</p>
          )}

          {schedule !== "off" && windowEnabled && (
            <button
              onClick={async () => {
                setWindowEnabled(false);
                setSavingSchedule(true);
                try {
                  const res = await fetch("/api/dev/sync/schedule", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ timeWindow: null }),
                  });
                  const data = await res.json();
                  if (data?.syncTimes) setSyncTimes(data.syncTimes);
                } catch {}
                setSavingSchedule(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              Reset to all day
            </button>
          )}

          {schedule !== "off" && syncTimes.length > 0 && (
            <div className="pt-3 border-t border-gray-200">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sync Times (ET)</span>
              <p className="text-sm text-gray-700 mt-1">{syncTimes.join(", ")}</p>
            </div>
          )}
        </div>
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

function UncategorizedSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["productStats"],
    queryFn: async () => {
      const res = await fetch("/api/products/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json() as Promise<{ productsWithoutCategory: number }>;
    },
    staleTime: 60000,
  });

  const count = data?.productsWithoutCategory ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <PackageX size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Without Category</h2>
            <p className="text-sm text-gray-500">
              {isLoading ? "Loading…" : `${count} product${count !== 1 ? "s" : ""} without a category`}
            </p>
          </div>
        </div>
        {count > 0 && (
          <Link
            href="/uncategorized"
            className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            View Products →
          </Link>
        )}
      </div>
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

  const sections = [
    { id: "sync", label: "NetSuite Sync", icon: RefreshCw },
    { id: "uncategorized", label: "Without Category", icon: PackageX },
    { id: "hero", label: "Hero Image", icon: ImageIcon },
  ];

  const [activeSection, setActiveSection] = useState("sync");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">Manage application settings</p>
        </div>
      </div>

      <div className="flex gap-8">
        <nav className="w-48 shrink-0 hidden lg:block">
          <div className="sticky top-8 space-y-1">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    activeSection === s.id
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <Icon size={14} />
                  {s.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-6">
          <div id="sync">
            <SyncSection employeeName={`${employee.firstName} ${employee.lastName}`} />
          </div>
          <div id="uncategorized">
            <UncategorizedSection />
          </div>
          <div id="hero">
            <HeroImageSection employeeId={employee.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
