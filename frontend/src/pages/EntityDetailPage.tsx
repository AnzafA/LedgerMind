import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getEntity, verifyEntity,type EntityDetail } from "../api";

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

  useEffect(() => {
    if (!id) return;
    getEntity(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  async function handleVerify() {
    if (!id || !data) return;
    setVerifying(true);
    await verifyEntity(id);
    setData({ ...data, entity: { ...data.entity, IS_VERIFIED: true } });
    setVerifying(false);
  }

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500">Loading…</div>;

  const sent = Number(data.totals.SENT);
  const received = Number(data.totals.RECEIVED);

  return (
    <div>
      <Link to="/entities" className="text-sm text-slate-500 hover:underline">
        ← Counterparties
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.entity.NAME}
          </h1>
          <div className="mt-2 flex gap-2 flex-wrap">
            {data.identifiers.map((i, idx) => (
              <span
                key={idx}
                className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono"
              >
                {i.IDENTIFIER_TYPE}: {i.IDENTIFIER_VALUE}
              </span>
            ))}
          </div>
        </div>
        {!data.entity.IS_VERIFIED && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Mark as verified"}
          </button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Total sent
          </div>
          <div className="text-2xl font-semibold font-mono">{formatINR(sent)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Total received
          </div>
          <div className="text-2xl font-semibold font-mono text-green-700">
            {formatINR(received)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Transactions
          </div>
          <div className="text-2xl font-semibold font-mono">
            {data.totals.TX_COUNT}
          </div>
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Transactions</h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.transactions.map((t) => (
              <tr key={t.ID}>
                <td className="px-6 py-3 text-sm whitespace-nowrap">
                  {formatDate(t.OCCURRED_AT)}
                </td>
                <td className="px-6 py-3 text-sm text-slate-600 max-w-md truncate">
                  {t.DESCRIPTION}
                </td>
                <td
                  className={`px-6 py-3 text-right font-mono text-sm whitespace-nowrap ${
                    t.DIRECTION === "DEBIT" ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {t.DIRECTION === "DEBIT" ? "−" : "+"}
                  {formatINR(Number(t.AMOUNT))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}