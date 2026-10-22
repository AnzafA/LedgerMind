import { useEffect, useState } from "react";
import {
  listEntities,
  listAccounts,
  type EntitySummary,
  type Account,
} from "../api";
import { Link, useSearchParams } from "react-router-dom";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read all URL params
  const selectedAccount = searchParams.get("accountId") || "";
  const importId = searchParams.get("importId") || "";
  const [query, setQuery] = useState(searchParams.get("q") || "");

  // Sync search query to URL
  const handleSearchChange = (val: string) => {
    setQuery(val);
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set("q", val);
    else newParams.delete("q");
    setSearchParams(newParams);
  };

  useEffect(() => {
    listAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Pass accountId and importId to the API
    listEntities(
      selectedAccount || undefined, 
      undefined, 
      undefined, 
      importId || undefined
    )
      .then(setEntities)
      .catch((err) => {
        setError("Failed to load entities. Please check backend terminal.");
      })
      .finally(() => setLoading(false));
  }, [selectedAccount, importId]);

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set("accountId", val);
    else newParams.delete("accountId");
    setSearchParams(newParams);
  };

  const handleClearImportFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("importId");
    setSearchParams(newParams);
  };

  const filtered = entities.filter((e) =>
    e.NAME.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Counterparties</h1>
        <div className="text-sm text-slate-500">{entities.length} total</div>
      </div>

      {/* FILTERED VIEW BANNER */}
      {importId && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
          <div>
            <span className="font-semibold">Filtered View:</span> Showing only entities from the statement you just imported.
          </div>
          <button 
            onClick={handleClearImportFilter}
            className="text-sm font-medium underline hover:text-blue-900"
          >
            View All Entities
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">Total Counterparties</div>
          <div className="text-2xl font-semibold">{filtered.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">Total Sent</div>
          <div className="text-2xl font-semibold text-red-600">
            {formatINR(filtered.reduce((sum, e) => sum + Number(e.SENT), 0))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">Total Received</div>
          <div className="text-2xl font-semibold text-green-700">
            {formatINR(filtered.reduce((sum, e) => sum + Number(e.RECEIVED), 0))}
          </div>
        </div>
      </div>

      {/* SEARCH & ACCOUNT FILTER */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
        />
        {accounts.length > 0 && (
          <select
            value={selectedAccount}
            onChange={handleAccountChange}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
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

      {/* TABLE */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          {error}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                      state={{ accountId: selectedAccount }}
                      className="font-medium hover:underline block"
                    >
                      {e.NAME}
                    </Link>
                    {e.IDENTIFIERS && (
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {e.IDENTIFIERS}
                      </div>
                    )}
                    {!e.IS_VERIFIED && (
                      <span className="text-xs text-amber-600 block mt-0.5">
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    No entities found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}