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
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-lg">Import complete</div>
            <div
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                summary.reconciles
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {summary.reconciles ? "✓ Reconciled" : "✗ Mismatch"}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">Total transactions</dt>
            <dd className="font-medium text-right">{summary.totalTransactions}</dd>
            <dt className="text-slate-500">Imported</dt>
            <dd className="font-medium text-right">{summary.importedCount}</dd>
            <dt className="text-slate-500">Self-transfers skipped</dt>
            <dd className="font-medium text-right">{summary.skippedSelfTransfers}</dd>
                        <dt className="text-slate-500">Bank charges / Interest</dt>
            <dd className="font-medium text-right">{summary.skippedBankCharges}</dd>
            <dt className="text-slate-500">Entities created</dt>
            <dd className="font-medium text-right">{summary.entitiesCreated}</dd>
            <dt className="text-slate-500">Entities matched</dt>
            <dd className="font-medium text-right">{summary.entitiesMatched}</dd>
            {summary.openingBalance != null && (
              <>
                <dt className="text-slate-500">Opening balance</dt>
                <dd className="font-medium text-right">
                  {formatINR(summary.openingBalance)}
                </dd>
              </>
            )}
            {summary.closingBalance != null && (
              <>
                <dt className="text-slate-500">Closing balance</dt>
                <dd className="font-medium text-right">
                  {formatINR(summary.closingBalance)}
                </dd>
              </>
            )}
          </dl>

          <button
            onClick={() => navigate("/entities")}
            className="mt-6 w-full bg-slate-900 text-white rounded-xl py-3 font-medium hover:bg-slate-800 transition"
          >
            View counterparties →
          </button>
        </div>
      )}
    </div>
  );
}