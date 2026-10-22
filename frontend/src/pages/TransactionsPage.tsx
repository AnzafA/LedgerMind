import { useEffect, useState } from "react";
import { listTransactions, listAccounts, type GlobalTransaction, type Account } from "../api";
import { Link } from "react-router-dom";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

function formatDate(s: string): string {
  const datePart = s.split(" ")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<GlobalTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    setLoading(true);
    listTransactions(selectedAccount || undefined)
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  const filtered = transactions.filter(t => 
    (t.ENTITY_NAME || "").toLowerCase().includes(query.toLowerCase()) || 
    t.DESCRIPTION.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Global Ledger</h1>
        <div className="text-sm text-slate-500">{transactions.length} transactions</div>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search narration or entity..."
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
            {accounts.map(a => (
              <option key={a.ID} value={a.ID}>{a.NAME} ••••{a.ACCOUNT_LAST4}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Entity</th>
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Narration</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.ID} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm whitespace-nowrap">{formatDate(t.OCCURRED_AT)}</td>
                  <td className="px-6 py-3 text-sm">
                    {t.ENTITY_NAME ? (
                      <span className="font-medium text-slate-900">{t.ENTITY_NAME}</span>
                    ) : (
                      <span className="text-slate-400 italic">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">{t.ACCOUNT_NAME} ••••{t.ACCOUNT_LAST4}</td>
                  <td className="px-6 py-3 text-xs text-slate-500 font-mono break-all max-w-xs">{t.DESCRIPTION}</td>
                  <td className={`px-6 py-3 text-right font-mono text-sm whitespace-nowrap ${t.DIRECTION === "DEBIT" ? "text-red-600" : "text-green-700"}`}>
                    {t.DIRECTION === "DEBIT" ? "−" : "+"}{formatINR(Number(t.AMOUNT))}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}