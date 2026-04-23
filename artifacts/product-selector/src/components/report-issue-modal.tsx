import { useEffect, useState } from "react";
import { X, Loader2, AlertCircle, CheckCircle2, Send, Save, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

type Step = "compose" | "review" | "sending" | "success" | "error";

export function ReportIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employee } = useAuth();
  const [step, setStep] = useState<Step>("compose");
  const [issue, setIssue] = useState("");
  const [detail, setDetail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (open) {
      setStep("compose");
      setIssue("");
      setDetail("");
      setErrorMsg(null);
      setCurrentUrl(typeof window !== "undefined" ? window.location.href : "");
    }
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
  const finalDetail = `${trimmedDetail}\n\nURL: ${currentUrl}`;
  const toTitleCase = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const userName = employee
    ? toTitleCase(`${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim())
    : "";

  const handleSave = () => {
    if (!trimmedIssue || !trimmedDetail) return;
    setStep("review");
  };

  const handleSend = async () => {
    setStep("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: trimmedIssue,
          detail: finalDetail,
          employee: employee
            ? {
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                id: employee.id,
              }
            : null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      setStep("success");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send");
      setStep("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
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
                <label htmlFor="detail" className="block text-[12px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                  Detail
                </label>
                <textarea
                  id="detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={5}
                  placeholder="Describe what happened, what you expected, and any steps to reproduce."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-y"
                />
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Issue</div>
                <div className="text-sm text-gray-900 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{trimmedIssue}</div>
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Detail</div>
                <div className="text-sm text-gray-900 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{trimmedDetail}</div>
              </div>
              <div className="text-[11px] text-gray-500 italic flex items-center gap-1.5">
                <ExternalLink size={11} />
                Page URL will be appended to detail on send.
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
                <div className="font-medium">Case sent.</div>
                <div className="text-emerald-600/80 text-[12px] mt-0.5">
                  An Innovation &amp; Technology team member will follow up.
                </div>
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

          {/* Combined Signed in as / Page URL info box */}
          {(step === "compose" || step === "review") && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-[12px] divide-y divide-gray-200/60">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-gray-500 uppercase tracking-widest font-semibold">Signed in as</span>
                <span className="text-gray-800 font-medium">{userName || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-1.5">
                <span className="text-gray-500 uppercase tracking-widest font-semibold shrink-0">Page URL</span>
                <span className="text-gray-700 font-mono text-[11px] break-all text-right">{currentUrl}</span>
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
                onClick={handleSave}
                disabled={!trimmedIssue || !trimmedDetail}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  !trimmedIssue || !trimmedDetail
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800",
                )}
              >
                <Save size={14} />
                Save
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <button
                type="button"
                onClick={() => setStep("compose")}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                <Send size={14} />
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
                  onClick={() => setStep("review")}
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
