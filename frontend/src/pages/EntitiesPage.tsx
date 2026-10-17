import { useEffect, useState } from "react";
import {
  listEntities,
  listAccounts,
  type EntitySummary,
  type Account,
} from "../api";
import { Link } from "react-router-dom";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    setLoading(true);
    listEntities(selectedAccount || undefined)
      .then(setEntities)
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  const filtered = entities.filter((e) =>
    e.NAME.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Counterparties</h1>
        <div className="text-sm text-slate-500">{entities.length} total</div>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        {accounts.length > 0 && (
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.ID} value={a.ID}>
                {a.NAME} ••••{a.ACCOUNT_LAST4} ({a.ACCOUNT_TYPE})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3 text-right">Sent</th>
                <th className="px-6 py-3 text-right">Received</th>
                <th className="px-6 py-3 text-right">Txns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.ID} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <Link
                      to={`/entities/${e.ID}`}
                      className="font-medium hover:underline"
                    >
                      {e.NAME}
                    </Link>
                    {!e.IS_VERIFIED && (
                      <span className="ml-2 text-xs text-amber-600">
                        unverified
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm">
                    {Number(e.SENT) > 0 ? formatINR(Number(e.SENT)) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-green-700">
                    {Number(e.RECEIVED) > 0 ? formatINR(Number(e.RECEIVED)) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-500">
                    {e.TX_COUNT}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}