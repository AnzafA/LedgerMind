import { useEffect, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { getEntity, verifyEntity, renameEntity, mergeEntity, listEntities, type EntityDetail, type EntitySummary } from "../api";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  // Rename state
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Merge state
  const [allEntities, setAllEntities] = useState<EntitySummary[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");
  const [merging, setMerging] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const previousAccountId = location.state?.accountId;

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
      // Navigate back to entities page after merge
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
        <p className="text-slate-500 mb-6">
          {error === "Entity not found" 
            ? "This counterparty may have been merged or deleted." 
            : error}
        </p>
        <Link 
          to={previousAccountId ? `/entities?accountId=${previousAccountId}` : "/entities"} 
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
        >
          ← Back to Counterparties
        </Link>
      </div>
    );
  }
  if (!data) return <div className="text-slate-500">Loading…</div>;

  const sent = Number(data.totals.SENT);
  const received = Number(data.totals.RECEIVED);

  return (
    <div>
      <Link 
        to={previousAccountId ? `/entities?accountId=${previousAccountId}` : "/entities"} 
        className="text-sm text-slate-500 hover:underline"
      >
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
              placeholder="Rename..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button onClick={handleRename} disabled={!newName || renaming} className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg disabled:opacity-50 hover:bg-slate-800 transition">
              {renaming ? "Saving..." : "Rename"}
            </button>
          </div>
        </div>

        {!data.entity.IS_VERIFIED && (
          <button onClick={handleVerify} disabled={verifying} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
            {verifying ? "Verifying…" : "Mark as verified"}
          </button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total sent</div>
          <div className="text-2xl font-semibold font-mono">{formatINR(sent)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total received</div>
          <div className="text-2xl font-semibold font-mono text-green-700">{formatINR(received)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Transactions</div>
          <div className="text-2xl font-semibold font-mono">{data.totals.TX_COUNT}</div>
        </div>
      </div>

      {/* MERGE UI */}
      <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Is this a duplicate?</h3>
        <p className="text-xs text-slate-500 mb-4">If this entity is the same as another person (e.g., "Ag Arwal" and "Agarw Al"), merge them here. This action is permanent.</p>
        <div className="flex gap-2">
          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none">
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Raw Bank Narration</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.transactions.map((t) => (
              <tr key={t.ID}>
                <td className="px-6 py-3 text-sm whitespace-nowrap">{formatDate(t.OCCURRED_AT)}</td>
                <td className="px-6 py-3 text-xs text-slate-500 font-mono break-all max-w-lg">
                  {t.DESCRIPTION}
                </td>
                <td className={`px-6 py-3 text-right font-mono text-sm whitespace-nowrap ${t.DIRECTION === "DEBIT" ? "text-red-600" : "text-green-700"}`}>
                  {t.DIRECTION === "DEBIT" ? "−" : "+"}{formatINR(Number(t.AMOUNT))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}