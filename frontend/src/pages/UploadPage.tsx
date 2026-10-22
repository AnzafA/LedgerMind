import { useState, useRef } from "react";
import { importStatement, type ImportSummary } from "../api";
import { useNavigate } from "react-router-dom";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const s = await importStatement(file);
      setSummary(s);
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Upload a bank statement
      </h1>
      <p className="text-slate-500 mb-8">
        We parse, reconcile, and organize every transaction by counterparty.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center cursor-pointer hover:border-slate-400 hover:bg-white transition"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf" // <--- ADD .pdf
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <div className="text-sm text-slate-500">Selected</div>
            <div className="font-medium">{file.name}</div>
          </div>
        ) : (
          <div>
            <div className="text-lg font-medium mb-1">Click to select a CSV or PDF</div>
            <div className="text-sm text-slate-500">
              Indian Bank account statement
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleImport}
        disabled={!file || busy}
        className="mt-6 w-full bg-slate-900 text-white rounded-xl py-3 font-medium disabled:opacity-40 hover:bg-slate-800 transition"
      >
        {busy ? "Importing…" : "Import statement"}
      </button>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          <div className="font-medium mb-1">Import failed</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

            {summary && (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-lg text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Import Successful</h2>
          <p className="text-slate-500 mb-6">
            Reconciled perfectly against the bank's closing balance.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">Imported</div>
              <div className="text-xl font-semibold">{summary.importedCount}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">New Entities</div>
              <div className="text-xl font-semibold">{summary.entitiesCreated}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase">Skipped (Self)</div>
              <div className="text-xl font-semibold">{summary.skippedSelfTransfers}</div>
            </div>
          </div>

                      <button
            onClick={() => navigate(`/entities?importId=${summary.importId}`)}
            className="w-full bg-slate-900 text-white rounded-xl py-3 font-medium hover:bg-slate-800 transition"
          >
            View Counterparties →
          </button>
        </div>
      )}
    </div>
  );
}