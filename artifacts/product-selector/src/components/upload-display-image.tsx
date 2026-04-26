import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, X, Upload, AlertCircle, Check } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_LONGEST_EDGE = 800;

interface UploadDisplayImageProps {
  netsuiteId: string;
  productName: string;
  variant?: "card-overlay" | "inline-button";
  onUploaded?: (imageUrl: string) => void;
}

function authHeaders(employeeId: string | number | undefined | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const v = employeeId == null ? "" : String(employeeId).trim();
  if (v && /^\d+$/.test(v)) h["x-employee-id"] = v;
  return h;
}

function employeeIdString(employeeId: string | number | undefined | null): string {
  const v = employeeId == null ? "" : String(employeeId).trim();
  return /^\d+$/.test(v) ? v : "";
}

async function resizeToPng(blob: Blob, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => {
      if (!b) reject(new Error("Failed to encode PNG"));
      else resolve(b);
    }, "image/png");
  });
}

export function UploadDisplayImage({
  netsuiteId,
  productName,
  variant = "card-overlay",
  onUploaded,
}: UploadDisplayImageProps) {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [stage, setStage] = useState<"idle" | "processing" | "ready" | "uploading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    if (rawPreview) URL.revokeObjectURL(rawPreview);
    if (processedPreview) URL.revokeObjectURL(processedPreview);
    setRawPreview(null);
    setProcessedPreview(null);
    setProcessedBlob(null);
    setStage("idle");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [rawPreview, processedPreview]);

  useEffect(() => {
    return () => {
      if (rawPreview) URL.revokeObjectURL(rawPreview);
      if (processedPreview) URL.revokeObjectURL(processedPreview);
    };
  }, [rawPreview, processedPreview]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Image is too large. Please choose a file under 15 MB.");
      return;
    }
    setError(null);
    setRawPreview(URL.createObjectURL(file));
    setStage("processing");
    try {
      const mod = await import("@imgly/background-removal");
      const removeBackground = mod.removeBackground ?? (mod as unknown as { default: typeof mod.removeBackground }).default;
      const cutOut = await removeBackground(file);
      const png = await resizeToPng(cutOut, MAX_OUTPUT_LONGEST_EDGE);
      setProcessedBlob(png);
      setProcessedPreview(URL.createObjectURL(png));
      setStage("ready");
    } catch (err) {
      console.error("Background removal failed", err);
      setError(err instanceof Error ? err.message : "Background removal failed.");
      setStage("idle");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!processedBlob || !employee) return;
    setStage("uploading");
    setError(null);
    try {
      const empId = employeeIdString(employee.id);
      if (!empId) throw new Error("Your account is missing an employee id. Please sign out and back in.");
      const reqRes = await fetch(
        `/api/products/${encodeURIComponent(netsuiteId)}/image/request-upload`,
        {
          method: "POST",
          headers: authHeaders(empId),
          body: JSON.stringify({ employeeId: empId }),
        }
      );
      if (!reqRes.ok) {
        const e = await reqRes.json().catch(() => ({}));
        throw new Error(e.error || `Upload request failed (${reqRes.status})`);
      }
      const { uploadUrl, objectKey } = (await reqRes.json()) as { uploadUrl: string; objectKey: string };

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: processedBlob,
      });
      if (!putRes.ok) throw new Error(`Upload to storage failed (${putRes.status})`);

      const confirmRes = await fetch(
        `/api/products/${encodeURIComponent(netsuiteId)}/image/confirm`,
        {
          method: "POST",
          headers: authHeaders(empId),
          body: JSON.stringify({
            employeeId: empId,
            objectKey,
            byteSize: processedBlob.size,
          }),
        }
      );
      if (!confirmRes.ok) {
        const e = await confirmRes.json().catch(() => ({}));
        throw new Error(e.error || `Confirm failed (${confirmRes.status})`);
      }
      const confirmData = (await confirmRes.json()) as { imageUrl: string };

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categoryProducts"] }),
        queryClient.invalidateQueries({ queryKey: ["productDetail"] }),
        queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string" && q.queryKey[0].toLowerCase().includes("product") }),
      ]);

      setStage("done");
      onUploaded?.(confirmData.imageUrl);
      setTimeout(() => close(), 700);
    } catch (err) {
      console.error("Upload failed", err);
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStage("ready");
    }
  }, [processedBlob, employee, netsuiteId, queryClient, onUploaded, close]);

  if (!employee) return null;

  const trigger =
    variant === "card-overlay" ? (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Upload a silhouette photo"
        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <Camera size={10} /> Add Photo
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <Camera size={14} /> Add Photo
      </button>
    );

  return (
    <>
      {trigger}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) close(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Add a display photo</h3>
            <p className="text-xs text-gray-500 mb-4 line-clamp-2">{productName}</p>

            {!rawPreview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-amber-300 hover:bg-amber-50/40 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500"
              >
                <Upload size={20} />
                <span className="text-sm font-medium">Choose a photo</span>
                <span className="text-[11px]">JPEG/PNG/HEIC up to 15 MB</span>
              </button>
            )}

            {rawPreview && (
              <div className="grid grid-cols-2 gap-3">
                <figure className="space-y-1">
                  <figcaption className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Original</figcaption>
                  <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden">
                    <img src={rawPreview} alt="Original" className="max-w-full max-h-full object-contain" />
                  </div>
                </figure>
                <figure className="space-y-1">
                  <figcaption className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Cleaned</figcaption>
                  <div
                    className="aspect-square rounded-xl flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg,#f3f4f6 25%,transparent 25%,transparent 75%,#f3f4f6 75%),linear-gradient(45deg,#f3f4f6 25%,transparent 25%,transparent 75%,#f3f4f6 75%)",
                      backgroundSize: "12px 12px",
                      backgroundPosition: "0 0,6px 6px",
                    }}
                  >
                    {stage === "processing" && (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-[11px]">Removing background…</span>
                      </div>
                    )}
                    {processedPreview && stage !== "processing" && (
                      <img src={processedPreview} alt="Background removed" className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                </figure>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={stage === "uploading" || stage === "processing"}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40"
              >
                {rawPreview ? "Choose a different photo" : ""}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={stage !== "ready"}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                    stage === "ready"
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  {stage === "uploading" && <Loader2 size={12} className="animate-spin" />}
                  {stage === "done" && <Check size={12} />}
                  {stage === "uploading" ? "Uploading…" : stage === "done" ? "Saved" : "Save photo"}
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
