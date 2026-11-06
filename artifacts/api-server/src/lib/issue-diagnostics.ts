// Never persist raw headers, request bodies, storage contents or object dumps as browser diagnostics.
export function redactDiagnosticText(value: string, maxLength = 2000): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:password|passwd|authorization|cookie|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|ps_session)\s*["']?\s*[:=]\s*["']?[^\s,;}"']+/gi, "[credential redacted]")
    .replace(/\b[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+)?\b/g, "[token redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, value => {
      try { const url = new URL(value); return `${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}`; }
      catch { return "[url redacted]"; }
    })
    .slice(0, maxLength);
}

export function safeReportUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    // Query strings and fragments may carry credentials or customer data.
    return `${url.origin}${url.pathname}`.slice(0, 2000);
  } catch { return ""; }
}

export function caseStatusFields(row: Record<string, unknown>) {
  return {
    caseNumber: row.casenumber == null ? null : String(row.casenumber),
    caseStatus: row.statusname == null ? null : String(row.statusname),
  };
}
