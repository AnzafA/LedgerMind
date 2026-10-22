import { useEffect, useState, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import {
  getEntity,
  verifyEntity,
  renameEntity,
  mergeEntity,
  listEntities,
  type EntityDetail,
  type EntitySummary,
} from "../api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useReactToPrint } from "react-to-print";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(s: string): string {
  // Exasol might return "2026-10-08 00:00:00". We only want the date part.
  const datePart = s.split(" ")[0]; 
  
  // If it's already YYYY-MM-DD
  if (datePart.includes("-")) {
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  
  // Fallback
  return s;
}

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [verifying, setVerifying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [merging, setMerging] = useState(false);
  
  const [newName, setNewName] = useState("");
  const [allEntities, setAllEntities] = useState<EntitySummary[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const previousAccountId = location.state?.accountId;

  // PDF Export Setup
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `LedgerMind_${data?.entity.NAME || "Statement"}`,
  });

  useEffect(() => {
    if (!id) return;
    getEntity(id)
      .then(setData)
      .catch((e) => setError(e.message));
    listEntities().then(setAllEntities);
  }, [id]);

  async function handleVerify() {
    if (!id || !data) return;
    setVerifying(true);
    await verifyEntity(id);
    setData({ ...data, entity: { ...data.entity, IS_VERIFIED: true } });
    setVerifying(false);
  }

  async function handleRename() {
    if (!id || !newName || !data) return;
    setRenaming(true);
    await renameEntity(id, newName);
    setData({ ...data, entity: { ...data.entity, NAME: newName } });
    setNewName("");
    setRenaming(false);
  }

  async function handleMerge() {
    if (!id || !mergeTarget || !data) return;
    if (!confirm(`Are you sure you want to merge "${data.entity.NAME}" into another entity? This cannot be undone.`)) return;
    
    setMerging(true);
    try {
      await mergeEntity(id, mergeTarget);
      navigate(previousAccountId ? `/entities?accountId=${previousAccountId}` : "/entities");
    } catch (e: any) {
      alert(e.message);
      setMerging(false);
    }
  }

  if (error) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Entity not found</h2>
        <p className="text-red-500 mb-6 text-sm max-w-lg mx-auto">{error}</p>
        <Link to={previousAccountId ? `/entities?accountId=${previousAccountId}` : "/entities"} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
          ← Back to Counterparties
        </Link>
      </div>
    );
  }

  if (!data) return <div className="text-slate-500 p-8">Loading…</div>;

  const sent = Number(data.totals.SENT);
  const received = Number(data.totals.RECEIVED);

  const chartData = [
    { name: "Sent", value: sent },
    { name: "Received", value: received },
  ];
  const COLORS = ["#ef4444", "#15803d"];

  return (
    <div>
      <Link to={previousAccountId ? `/entities?accountId=${previousAccountId}` : "/entities"} className="text-sm text-slate-500 hover:underline">
        ← Counterparties
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{data.entity.NAME}</h1>
          <div className="mt-2 flex gap-2 flex-wrap">
            {data.identifiers.map((i, idx) => (
              <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">
                {i.IDENTIFIER_TYPE}: {i.IDENTIFIER_VALUE}
              </span>
            ))}
          </div>
          
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Rename entity..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button onClick={handleRename} disabled={!newName || renaming} className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg disabled:opacity-50 hover:bg-slate-800 transition">
              {renaming ? "Saving..." : "Rename"}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {!data.entity.IS_VERIFIED && (
            <button onClick={handleVerify} disabled={verifying} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
              {verifying ? "Verifying…" : "Mark as verified"}
            </button>
          )}
          <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* --- SCREEN UI (HIDDEN WHEN PRINTING) --- */}
      <div className="print:hidden">
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total sent</div>
            <div className="text-2xl font-semibold font-mono text-red-600">{formatINR(sent)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total received</div>
            <div className="text-2xl font-semibold font-mono text-green-700">{formatINR(received)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Transactions</div>
            <div className="text-2xl font-semibold font-mono">{data.totals.TX_COUNT}</div>
          </div>
        </div>

        {(sent > 0 || received > 0) && (
          <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 h-64 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Money Flow</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatINR(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Is this a duplicate?</h3>
          <p className="text-xs text-slate-500 mb-4">Merge this entity into another to combine their histories.</p>
          <div className="flex gap-2">
            <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">Select target entity to merge into...</option>
              {allEntities.filter(e => e.ID !== id).map(e => (
                <option key={e.ID} value={e.ID}>{e.NAME} ({e.IDENTIFIERS})</option>
              ))}
            </select>
            <button onClick={handleMerge} disabled={!mergeTarget || merging} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700 transition">
              {merging ? "Merging..." : "Merge"}
            </button>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-lg font-semibold">Transactions</h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Raw Bank Narration</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.transactions.map((t) => (
                <tr key={t.ID} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm whitespace-nowrap">{formatDate(t.OCCURRED_AT)}</td>
                  <td className="px-6 py-3 text-sm whitespace-nowrap">{t.ACCOUNT_NAME} ••••{t.ACCOUNT_LAST4}</td>
                  <td className="px-6 py-3 text-xs text-slate-500 font-mono break-all max-w-xs">{t.DESCRIPTION}</td>
                  <td className={`px-6 py-3 text-right font-mono text-sm whitespace-nowrap ${t.DIRECTION === "DEBIT" ? "text-red-600" : "text-green-700"}`}>
                    {t.DIRECTION === "DEBIT" ? "−" : "+"}{formatINR(Number(t.AMOUNT))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- PRINT-ONLY PDF TEMPLATE --- */}
      <div className="hidden print:block" ref={printRef}>
        <div className="p-8 max-w-4xl mx-auto text-slate-900">
          <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tight">Ledger Statement</h1>
              <p className="text-slate-500 mt-1">Generated by LedgerMind</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">Date Generated</div>
              <div className="font-mono">{new Date().toLocaleDateString("en-IN")}</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Entity Details</h2>
            <div className="text-2xl font-bold">{data.entity.NAME}</div>
            <div className="text-sm font-mono text-slate-600 mt-1">
              {data.identifiers.map(i => i.IDENTIFIER_VALUE).join(" | ")}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-100 p-4 rounded-lg">
            <div>
              <div className="text-xs text-slate-500 uppercase">Total Sent</div>
              <div className="text-xl font-mono font-bold">{formatINR(sent)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase">Total Received</div>
              <div className="text-xl font-mono font-bold">{formatINR(received)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase">Transactions</div>
              <div className="text-xl font-mono font-bold">{data.totals.TX_COUNT}</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2">Date</th>
                <th className="py-2">Account</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.ID} className="border-b border-slate-200">
                  <td className="py-2 whitespace-nowrap">{formatDate(t.OCCURRED_AT)}</td>
                  <td className="py-2 whitespace-nowrap">{t.ACCOUNT_NAME} ••••{t.ACCOUNT_LAST4}</td>
                  <td className="py-2 text-xs max-w-xs truncate">{t.DESCRIPTION}</td>
                  <td className={`py-2 text-right font-mono ${t.DIRECTION === "DEBIT" ? "text-red-600" : "text-green-700"}`}>
                    {t.DIRECTION === "DEBIT" ? "−" : "+"}{formatINR(Number(t.AMOUNT))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 text-center text-xs text-slate-400">
            This is a computer-generated statement from LedgerMind. All amounts are mathematically reconciled.
          </div>
        </div>
      </div>
    </div>
  );
}