import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Copy, Download, Loader2, Puzzle } from "lucide-react";
import { authHeaders } from "@/context/auth-context";
import { useVendorPicks } from "@/context/vendor-picks-context";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useQuoteHelperInfo } from "@/hooks/use-quote-helper-info";
import { QUOTE_HELPER_DOWNLOAD_URL, downloadFileName, quoteHelperStatus } from "@/lib/quote-helper";

// Browsers block links to their own settings pages, so the address is shown with a Copy button.
function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[13px] text-gray-800">
      {address}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => {});
        }}
        className="p-0.5 text-gray-400 hover:text-gray-700"
        aria-label={`Copy ${address}`}
        title="Copy"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}

function InstallSteps({ browser, address, developerModeWhere }: { browser: string; address: string; developerModeWhere: string }) {
  return (
    <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
      <li>
        Click <b>Download</b> above. In your Downloads folder, right-click the zip and choose <b>Extract All</b>. Keep the
        extracted <b>consumers-quote-helper</b> folder somewhere it will stay, for example Documents: {browser} loads the
        extension from that folder.
      </li>
      <li>In {browser}, go to <CopyAddress address={address} /> (paste it into the address bar).</li>
      <li>Turn on <b>Developer mode</b> ({developerModeWhere}).</li>
      <li>Click <b>Load unpacked</b> and choose the <b>consumers-quote-helper</b> folder (the one with manifest.json in it).</li>
      {/* <li>Optional: click the puzzle icon in the toolbar and pin <b>Consumers Quote Helper</b>.</li> */}
      <li>Optional: click the puzzle icon in the toolbar and pin <b>Consumers QuickAdd</b>.</li>
      <li>Refresh this page. The box at the top should say it is installed.</li>
    </ol>
  );
}

// 2026-11-05 (Gib): the extension is now called Consumers QuickAdd (1.5.0). This page was "Quote Helper" / "Consumers
// Quote Helper" in its title, breadcrumb, heading and steps; its address stays /quote-helper.
export default function QuoteHelperPage() {
  // useDocumentTitle("Quote Helper | Consumers Product Selector");
  useDocumentTitle("QuickAdd | Consumers Product Selector");
  const info = useQuoteHelperInfo();
  const { extensionReady, extensionVersion } = useVendorPicks();
  const latest = info.data?.version ?? null;
  const status = quoteHelperStatus(extensionVersion, latest, extensionReady);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(QUOTE_HELPER_DOWNLOAD_URL, { headers: authHeaders() });
      if (res.status === 401) throw new Error("Your sign-in has expired. Sign out, sign in again, then retry.");
      if (!res.ok) throw new Error("The download is not available right now. Please retry in a minute.");
      const blob = await res.blob();
      const name = downloadFileName(res.headers.get("Content-Disposition"), latest);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDownloaded(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The download failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-gray-600">QuickAdd</span>
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <Puzzle size={24} className="text-[#7B4DA8]" />
        Consumers QuickAdd
      </h1>
      {/* 2026-11-05: picks go straight onto the Quote List since PR #11. Was: "...and the items land on the Special Order
          page under Picked on vendor websites, ready to add to the quote list." */}
      <p className="text-sm text-gray-600 mb-6">
        A Microsoft Edge and Google Chrome extension for showroom PCs. Customers pick products on a vendor's own website,
        and the items go straight onto the <Link href="/list" className="underline">Quote List</Link> as special orders,
        with the Type suggested, as soon as this Product Selector is open in the same browser. A line the vendor page
        left incomplete is marked <b>Needs ...</b> for you to finish before pushing it to an estimate.
      </p>

      <section aria-label="QuickAdd in this browser" className="mb-6" data-testid="quote-helper-status">
        {status === "current" && (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>Installed in this browser (version {extensionVersion}). It is up to date.</span>
          </div>
        )}
        {status === "outdated" && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              This browser has version {extensionVersion}. Version {latest} is ready: download it, extract it over the old
              folder, then click <b>Reload</b> under Consumers Quote Helper (its name before 1.5.0) on the extensions
              page. It shows as Consumers QuickAdd after that.
            </span>
          </div>
        )}
        {status === "unknown" && (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Installed in this browser{extensionVersion ? ` (version ${extensionVersion})` : ""}.
            {latest && !extensionVersion && ` The newest version is ${latest}; on the extensions page, check the version under Consumers QuickAdd (Consumers Quote Helper before 1.5.0).`}
          </div>
        )}
        {status === "not-installed" && (
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Not installed in this browser yet. Download it and follow the steps below.
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <button
          type="button"
          onClick={download}
          disabled={busy || info.isLoading || !info.data?.available}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
          data-testid="button-download-quote-helper"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Download{latest ? ` version ${latest}` : ""}
        </button>
        {info.isError && <span className="text-sm text-red-600">Could not check the download. Refresh the page to retry.</span>}
        {info.data && !info.data.available && <span className="text-sm text-red-600">The extension files are not on this server.</span>}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
      {downloaded && <p role="status" className="text-sm text-emerald-700 mb-2">Downloaded {downloaded}. Now follow the steps below.</p>}

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Install in Microsoft Edge</h2>
          <InstallSteps browser="Edge" address="edge://extensions" developerModeWhere="on the left" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Install in Google Chrome</h2>
          <InstallSteps browser="Chrome" address="chrome://extensions" developerModeWhere="top right" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Update to a new version</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
            <li>Download it again and extract it over the old <b>consumers-quote-helper</b> folder, replacing the files.</li>
            {/* <li>On the extensions page, click <b>Reload</b> under Consumers Quote Helper.</li> */}
            <li>
              On the extensions page, click <b>Reload</b> under Consumers QuickAdd (called Consumers Quote Helper before
              1.5.0).
            </li>
          </ol>
        </div>
        {info.data?.policy && (
          <div data-testid="quickadd-group-policy">
            <h2 className="text-base font-semibold text-gray-900 mb-2">For IT: install it on every showroom PC (Group Policy)</h2>
            <p className="text-sm text-gray-700 mb-2">
              Nothing to do on the PCs, and new versions arrive on their own. On the domain controller, in the Group
              Policy that applies to the showroom PCs, open <b>Computer Configuration &gt; Policies &gt; Administrative
              Templates &gt; Microsoft Edge &gt; Extensions &gt; Control which extensions are installed silently</b>,
              set it to <b>Enabled</b>, click <b>Show...</b> and add this line:
            </p>
            <div className="mb-2 overflow-x-auto"><CopyAddress address={info.data.policy.value} /></div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              <li>Extension ID {info.data.policy.extensionId}, version {info.data.policy.version} on this server.</li>
              <li>
                Remove any copy loaded with Load unpacked first (edge://extensions, <b>Remove</b>); a PC with both can show
                two buttons.
              </li>
              <li>
                A PC picks it up at its next policy refresh (about 90 minutes) or after <b>gpupdate /force</b> and an Edge
                restart. It then shows on edge://extensions as installed by your organization.
              </li>
              <li>For Chrome, the same line goes in Google &gt; Google Chrome &gt; Extensions &gt; Configure the list of force-installed apps and extensions.</li>
            </ul>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-600 space-y-1">
          <p>
            When you load it, the browser warns that the extension can read and change data on websites. It only runs on
            the special-order vendor sites and on this Product Selector.
          </p>
          {/* <p>
            Picks stay in the browser where they were made until you use them on the Special Order page. Nothing goes to
            NetSuite until you add the item and push the quote list as usual.
          </p> */}
          <p>
            Picks wait in the browser where they were made until this Product Selector is open there, then move to the
            Quote List. A pick from a vendor site with several product lines waits on the{" "}
            <Link href="/special-order" className="underline">Special Order</Link> page instead, for you to choose the
            line. Nothing goes to NetSuite until you push the quote list as usual.
          </p>
        </div>
      </section>
    </div>
  );
}
