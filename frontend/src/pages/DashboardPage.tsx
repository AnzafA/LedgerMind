import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listEntities, listAccounts, type EntitySummary, type Account } from "../api";
import { getMonthlyAnalytics, type MonthlyAnalytics } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [query, setQuery] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("");
  
  const navigate = useNavigate();
    useEffect(() => {
    getMonthlyAnalytics().then(setChartData);
  }, []);
  useEffect(() => {
    listAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    let start = "";
    let end = "";

    if (timeRange === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = firstDay.toISOString().slice(0, 10) + " 00:00:00";
      end = lastDay.toISOString().slice(0, 10) + " 23:59:59";
    } else if (timeRange === "last_30_days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start = thirtyDaysAgo.toISOString().slice(0, 10) + " 00:00:00";
      end = now.toISOString().slice(0, 10) + " 23:59:59";
    } else if (timeRange === "this_year") {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      start = firstDay.toISOString().slice(0, 10) + " 00:00:00";
      end = lastDay.toISOString().slice(0, 10) + " 23:59:59";
    }

    listEntities(
      selectedAccount || undefined, 
      start || undefined, 
      end || undefined
    )
      .then(setEntities)
      .finally(() => setLoading(false));
    
  }, [timeRange, selectedAccount]);

  const totalSent = entities.reduce((sum, e) => sum + Number(e.SENT), 0);
  const totalReceived = entities.reduce((sum, e) => sum + Number(e.RECEIVED), 0);
  const needsReview = entities.filter((e) => !e.IS_VERIFIED).length;
  const totalTx = entities.reduce((sum, e) => sum + e.TX_COUNT, 0);
    // Calculate the Top 5 entities you sent money to
  const topSpendersData = [...entities]
    .filter((e) => Number(e.SENT) > 0)
    .sort((a, b) => Number(b.SENT) - Number(a.SENT))
    .slice(0, 5)
    .map((e) => ({
      name: e.NAME.length > 15 ? e.NAME.substring(0, 15) + "..." : e.NAME,
      fullName: e.NAME,
      amount: Number(e.SENT),
    }))
    .reverse(); // Recharts renders bottom-to-top, so we reverse to show the biggest at the top
  const [chartData, setChartData] = useState<MonthlyAnalytics[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/entities?q=${encodeURIComponent(query)}`);
    }
  };

  // 1. Show spinner while loading (Early Return)
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Empty state ONLY if the database is truly empty (no filters applied)
  if (entities.length === 0 && timeRange === "all" && !selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">No data yet</h2>
        <p className="text-slate-500 mb-6 max-w-md">Upload your first bank statement to see your financial memory come to life.</p>
        <Link to="/upload" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition">
          Import a Statement
        </Link>
      </div>
    );
  }

  // 3. Main Dashboard Render
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Your Financial Memory</h1>
        
        {/* FILTERS */}
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-sm shadow-sm"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.ID} value={a.ID}>
                  {a.NAME} ••••{a.ACCOUNT_LAST4}
                </option>
              ))}
            </select>
          )}

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-sm shadow-sm"
          >
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_year">This Year</option>
          </select>
        </div>
      </div>
      
      <p className="text-slate-500 mb-8">Search, review, and verify your entire banking history.</p>

      {/* SEARCH BAR */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Search for a person or business (e.g. Rahul)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-5 py-4 text-lg rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button type="submit" className="absolute right-3 top-3 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition">
            Search
          </button>
        </div>
      </form>

      {/* MACRO STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Txns</div>
          <div className="text-2xl font-semibold">{totalTx}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Sent</div>
          <div className="text-2xl font-semibold text-red-600">{formatINR(totalSent)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Received</div>
          <div className="text-2xl font-semibold text-green-700">{formatINR(totalReceived)}</div>
        </div>
        <Link to="/entities" className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm hover:bg-amber-100 transition">
          <div className="text-xs text-amber-700 uppercase tracking-wider mb-2">Needs Review</div>
          <div className="text-2xl font-semibold text-amber-900">{needsReview}</div>
        </Link>
      </div>
            {/* TOP PAYEES CHART */}
      {topSpendersData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-10 shadow-sm h-80">
          <h2 className="text-lg font-semibold mb-6">Top 5 Counterparties (Money Sent)</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSpendersData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={100} />
              <Tooltip 
                formatter={(value: any) => formatINR(Number(value))}
                labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={30}>
                {topSpendersData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === topSpendersData.length - 1 ? "#ef4444" : "#fca5a5"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
                {/* CASH FLOW CHART */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-10 shadow-sm h-80">
          <h2 className="text-lg font-semibold mb-4">Monthly Cash Flow</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: any) => formatINR(Number(value))} cursor={{ fill: '#f1f5f9' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="sent" name="Money Sent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="received" name="Money Received" fill="#15803d" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* RECENT ENTITIES */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Top Counterparties</h2>
        <Link to="/entities" className="text-sm text-slate-500 hover:underline">View all →</Link>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {entities.slice(0, 5).map((e) => (
          <div key={e.ID} className="flex justify-between items-center p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <div>
              <Link to={`/entities/${e.ID}`} className="font-medium hover:underline">{e.NAME}</Link>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{e.IDENTIFIERS}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm">{formatINR(Number(e.SENT) + Number(e.RECEIVED))}</div>
              <div className="text-xs text-slate-500">{e.TX_COUNT} txns</div>
            </div>
          </div>
        ))}
        
        {/* If filters return 0 results */}
        {entities.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No transactions found for this filter.
          </div>
        )}
      </div>
    </div>
  );
}