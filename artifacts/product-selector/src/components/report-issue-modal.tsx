import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertCircle, CheckCircle2, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAdminIssuesQueryKey, requestIssueScreenshotUpload, submitIssueReport, type BrowserIssueLog } from "@workspace/api-client-react";
import { browserIssueLogs, captureIssueScreenshot, reportPageUrl } from "@/lib/issue-diagnostics";
import { cn } from "@/lib/utils";

type Step = "compose" | "sending" | "success" | "error";

export function ReportIssueModal({ open, onClose, initialDetail = "" }: { open: boolean; onClose: () => void; initialDetail?: string }) {
  const [step, setStep] = useState<Step>("compose");
  const [issue, setIssue] = useState("");
  const [detail, setDetail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [caseNumber, setCaseNumber] = useState<string | null>(null);
  const [captureState, setCaptureState] = useState<"capturing" | "ready" | "failed">("capturing");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [logs, setLogs] = useState<BrowserIssueLog[]>([]);
  const requestId = useRef("");
  const uploadedPath = useRef<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      setStep("compose");
      setIssue("");
      setDetail(initialDetail);
      setErrorMsg(null);
      setCaseNumber(null);
      setCurrentUrl(reportPageUrl());
      setLogs(browserIssueLogs());
      requestId.current = crypto.randomUUID();
      uploadedPath.current = null;
      setCaptureState("capturing");
      setCaptureError(null);
      setScreenshot(null);
      void Promise.race([
        captureIssueScreenshot(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Capture timed out")), 8000); }),
      ]).then(blob => {
        if (!cancelled) { setScreenshot(blob); setCaptureState("ready"); }
      }).catch(() => {
        if (!cancelled) {
          setCaptureState("failed");
          setCaptureError("The browser could not capture this page. URL and browser logs are still included.");
        }
      }).finally(() => { if (timeout) clearTimeout(timeout); });
    }
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmedIssue = issue.trim();
  const trimmedDetail = detail.trim();

  const handleSend = async () => {
    setStep("sending");
    setErrorMsg(null);
    try {
      let diagnosticError = captureError;
      if (!uploadedPath.current) {
        try {
          const upload = await requestIssueScreenshotUpload({ signal: AbortSignal.timeout(10000) });
          if (screenshot) {
            const response = await fetch(upload.uploadUrl, {
              method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: screenshot,
              signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) throw new Error("Screenshot upload failed");
            uploadedPath.current = upload.objectPath;
          }
        } catch (err) {
          const status = (err as { status?: number }).status;
          // Do not submit to the legacy case endpoint before the report-history API is active.
          if (status === 404) throw new Error("The issue reporting update is not active yet. Please try after it is activated.");
          if (status === 401 || status === 403) throw err;
          diagnosticError = "Screenshot could not be uploaded. The issue, URL and browser logs were saved without an image.";
          setCaptureError(diagnosticError);
        }
      }
      const data = await submitIssueReport({
        requestId: requestId.current, subject: trimmedIssue, detail: trimmedDetail,
        pageUrl: currentUrl,
        browserInfo: `${navigator.userAgent} | viewport ${window.innerWidth}×${window.innerHeight}`.slice(0, 500),
        browserLogs: logs, screenshotPath: uploadedPath.current, captureError: diagnosticError,
      }, { signal: AbortSignal.timeout(60000) });
      setCaseNumber(data.caseNumber);
      void qc.invalidateQueries({ queryKey: getGetAdminIssuesQueryKey() });
      setStep("success");
    } catch (err: unknown) {
      const apiError = err as { data?: { error?: string }; message?: string };
      setErrorMsg(apiError.data?.error || apiError.message || "Failed to send");
      setStep("error");
    }
  };

  return (
    <div
      data-report-overlay
      className="fixed inset-0 z-[10001] flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Report an Issue</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "compose" && (
            <>
              <div>
                <label htmlFor="issue" className="block text-[12px] font-semibold uppercase tracking-widest mb-1.5 text-[#5b6069]">
                  Issue
                </label>
                <input
                  id="issue"
                  type="text"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Brief summary"
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>
              <div>
                <label htmlFor="detail" className="block text-[12px] font-semibold uppercase tracking-widest mb-1.5 text-[#5b6069]">
                  Detail
                </label>
                <textarea
                  id="detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={5}
                  maxLength={10000}
                  placeholder="Describe what happened, what you expected, and any steps to reproduce."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-y"
                />
              </div>
            </>
          )}

          {step === "sending" && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" />
              Creating case in NetSuite…
            </div>
          )}

          {step === "success" && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">
                  Case sent{caseNumber ? ` — #${caseNumber}` : ""}.
                </div>
                <div className="text-emerald-600/80 text-[12px] mt-0.5">
                  An Innovation &amp; Technology team member will follow up.
                </div>
                {!caseNumber && <p className="text-[12px] mt-1">The case number will appear in Admin once NetSuite provides it.</p>}
                {captureError && <p className="text-amber-700 text-[12px] mt-1">{captureError}</p>}
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Could not create the case.</div>
                {errorMsg && <div className="text-red-600/80 text-[12px] mt-0.5 break-all">{errorMsg}</div>}
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          {step === "compose" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!trimmedIssue || !trimmedDetail || captureState === "capturing"}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  !trimmedIssue || !trimmedDetail || captureState === "capturing"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-amber-500 text-white hover:bg-amber-600",
                )}
              >
                {captureState === "capturing" ? <Loader2 size={14} className="animate-spin" aria-label="Preparing report" /> : <Send size={14} />}
                Send
              </button>
            </>
          )}

          {(step === "sending") && (
            <button type="button" disabled className="px-4 py-2 rounded-lg text-sm text-gray-400 cursor-not-allowed">
              Sending…
            </button>
          )}

          {(step === "success" || step === "error") && (
            <>
              {step === "error" && (
                <button
                  type="button"
                  onClick={() => setStep("compose")}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
