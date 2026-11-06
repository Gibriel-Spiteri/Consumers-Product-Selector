import type { BrowserIssueLog } from "@workspace/api-client-react";

const logs: BrowserIssueLog[] = [];
let installed = false;

export function redactBrowserDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:password|passwd|authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|ps_session)\s*["']?\s*[:=]\s*["']?[^\s,;}"']+/gi, "[credential redacted]")
    .replace(/\b[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+)?\b/g, "[token redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, value => {
      try { const url = new URL(value); return `${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}`; }
      catch { return "[url redacted]"; }
    }).slice(0, 2000);
}

function record(level: "warn" | "error", message: string) {
  logs.push({ timestamp: new Date().toISOString(), level, message: redactBrowserDiagnostic(message) });
  if (logs.length > 40) logs.shift();
}

export function browserIssueLogs() { return logs.map(log => ({ ...log })); }
export function clearIssueDiagnostics() { logs.length = 0; }

export function reportPageUrl() { return `${window.location.origin}${window.location.pathname}`; }

export function installIssueDiagnostics() {
  if (installed) return;
  installed = true;
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      // No object serialization: objects may contain employee/customer records, headers or credentials.
      record(level, args.map(arg => arg instanceof Error ? `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`
        : ["string", "number", "boolean"].includes(typeof arg) ? String(arg) : "[object omitted]").join(" "));
      original(...args);
    };
  }
  window.addEventListener("error", event => record("error", `${event.message}\n${event.error instanceof Error ? event.error.stack ?? "" : ""}`));
  window.addEventListener("unhandledrejection", event => record("error", event.reason instanceof Error
    ? `${event.reason.message}\n${event.reason.stack ?? ""}` : typeof event.reason === "string" ? event.reason : "Unhandled promise rejection"));
}

export async function captureIssueScreenshot(): Promise<Blob> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const canvas = await html2canvas(document.body, {
    x: window.scrollX, y: window.scrollY,
    width: window.innerWidth, height: window.innerHeight,
    scale: Math.min(1, 1440 / window.innerWidth),
    useCORS: true, allowTaint: false, logging: false, imageTimeout: 4000,
    ignoreElements: element => element.hasAttribute("data-report-overlay") || element.tagName === "IFRAME",
    onclone: doc => {
      // Mask all entered values and anything explicitly marked private.
      doc.querySelectorAll("input,textarea,select,[contenteditable=true],[data-private]").forEach(element => {
        if (element.tagName === "INPUT") { const input = element as HTMLInputElement; input.value = ""; input.placeholder = ""; input.checked = false; input.removeAttribute("value"); }
        else if (element.tagName === "TEXTAREA") { const input = element as HTMLTextAreaElement; input.value = ""; input.placeholder = ""; input.textContent = ""; }
        else if (element.tagName === "SELECT") { (element as HTMLSelectElement).selectedIndex = -1; }
        if (element.hasAttribute("data-private") || element.getAttribute("contenteditable") === "true") { element.textContent = "[hidden]"; }
      });
    },
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) reject(new Error("Screenshot could not be rendered."));
    else if (blob.size > 2 * 1024 * 1024) reject(new Error("Screenshot exceeds the image size limit."));
    else resolve(blob);
    canvas.width = canvas.height = 0;
  }, "image/jpeg", 0.8));
}
