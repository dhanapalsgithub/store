import { useEffect, useState } from "react";
import { Sheet, CheckCircle2, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function SheetsSetup() {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState("");

  const load = () => {
    api.get("/setup/status").then((r) => setStatus(r.data)).catch(() => {});
    api.get("/setup/apps-script").then((r) => setCode(r.data.code)).catch(() => {});
  };
  useEffect(load, []);

  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Apps Script code copied — paste it in script.google.com");
  };

  return (
    <div className="space-y-5 fade-up" data-testid="sheets-setup">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Google Sheets Sync</h2>
        <p className="text-sm text-slate-500">Connect your Google Sheet via Apps Script Web App</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4" data-testid="sheets-status-card">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${status?.connected ? "bg-emerald-50" : "bg-amber-50"}`}>
          <Sheet size={20} className={status?.connected ? "text-emerald-700" : "text-amber-600"} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            {status?.connected ? (
              <><CheckCircle2 size={16} className="text-emerald-600" /> Connected to Google Sheets</>
            ) : (
              <><AlertCircle size={16} className="text-amber-500" /> Running on local fallback database</>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5" data-testid="sheets-mode-label">
            Mode: <span className="font-bold">{status?.mode === "google_sheets" ? "Google Sheets (Apps Script)" : "Local fallback (MongoDB)"}</span>
            {!status?.appsScriptConfigured && " — APPS_SCRIPT_URL not set"}
          </p>
        </div>
        <button data-testid="sheets-sync-now-button" onClick={() => { load(); toast.info("Connection re-checked"); }}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 transition active:scale-95">
          <RefreshCw size={13} /> Re-check
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-900 mb-3">Setup Steps</h3>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Open your Google Sheet → <span className="font-semibold">Extensions → Apps Script</span></li>
          <li>Delete existing code, paste the script below, and <span className="font-semibold">Save</span></li>
          <li><span className="font-semibold">Deploy → New deployment → Web app</span> (Execute as: <b>Me</b>, Access: <b>Anyone</b>)</li>
          <li>Copy the Web App URL and ask the developer/agent to set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-bold">APPS_SCRIPT_URL</code> in backend .env and restart</li>
          <li>The app auto-switches to your Sheet and seeds Users + 45 Products on first run</li>
        </ol>
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Code.gs — copy this</p>
          <button data-testid="copy-apps-script-button" onClick={copy}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition">
            <Copy size={13} /> Copy
          </button>
        </div>
        <pre className="text-[11px] text-slate-300 p-5 overflow-x-auto max-h-96 overflow-y-auto" data-testid="apps-script-code">{code || "Loading…"}</pre>
      </div>
    </div>
  );
}
